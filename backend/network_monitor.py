#!/usr/bin/env python3
"""Public IP/failover monitor and small Casa dashboard backend.

Besides the network-status API, the same service exposes a restricted Home
Assistant energy proxy. Browser clients never receive the HA token: the token
is kept server-side and the frontend only receives SolarNet/Fronius energy
states plus aggregated long-term statistics.
"""

from __future__ import annotations

import base64
import hashlib
import ipaddress
import json
import logging
import os
import signal
import socket
import ssl
import struct
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, time as dt_time, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable
from urllib.error import URLError
from urllib.parse import parse_qs, quote, urlparse, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

LOG = logging.getLogger("casa-network-monitor")
STOP_EVENT = threading.Event()
STATUS_LOCK = threading.Lock()

ENERGY_TIMEZONE = ZoneInfo("Europe/Rome")
ENERGY_HISTORY_START = date(2026, 8, 17)
ENERGY_ENTITY_IDS: dict[str, tuple[str, ...]] = {
    "pv": (
        "sensor.solarnet_energia_giornaliera",
        "sensor.vano_tecnico_solarnet_energia_giornaliera",
    ),
    "house": ("sensor.vano_tecnico_solarnet_consumo_casa_oggi",),
    "import": ("sensor.vano_tecnico_solarnet_giornaliero_import",),
    "export": ("sensor.vano_tecnico_solarnet_energia_esportata_giorno",),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def csv_values(name: str, default: str = "") -> list[str]:
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


def csv_integers(name: str, default: str = "") -> list[int]:
    values: list[int] = []
    for raw in csv_values(name, default):
        normalized = raw.upper().removeprefix("AS")
        try:
            values.append(int(normalized))
        except ValueError:
            LOG.warning("Ignoring invalid ASN in %s: %s", name, raw)
    return values


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    interval_seconds: int
    request_timeout_seconds: int
    providers: tuple[str, ...]
    primary_networks: tuple[str, ...]
    backup_networks: tuple[str, ...]
    primary_asns: tuple[int, ...]
    backup_asns: tuple[int, ...]
    network_info_url: str
    auto_learn_primary: bool
    listen_host: str
    listen_port: int
    cors_origin: str
    data_dir: Path
    home_assistant_url: str
    home_assistant_token: str

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            interval_seconds=max(30, int(os.getenv("CHECK_INTERVAL_SECONDS", "45"))),
            request_timeout_seconds=max(2, int(os.getenv("REQUEST_TIMEOUT_SECONDS", "8"))),
            providers=tuple(csv_values(
                "IP_PROVIDERS",
                "https://api.ipify.org,https://ifconfig.me/ip,https://icanhazip.com",
            )),
            primary_networks=tuple(csv_values("PRIMARY_IP_NETWORKS")),
            backup_networks=tuple(csv_values("BACKUP_IP_NETWORKS")),
            primary_asns=tuple(csv_integers("PRIMARY_ASNS", "202870")),
            backup_asns=tuple(csv_integers("BACKUP_ASNS", "1267,24608")),
            network_info_url=os.getenv(
                "NETWORK_INFO_URL",
                "https://stat.ripe.net/data/network-info/data.json?resource={ip}",
            ),
            auto_learn_primary=env_bool("AUTO_LEARN_PRIMARY", True),
            listen_host=os.getenv("LISTEN_HOST", "127.0.0.1"),
            listen_port=int(os.getenv("LISTEN_PORT", "8787")),
            cors_origin=os.getenv("CORS_ORIGIN", "*"),
            data_dir=Path(os.getenv("DATA_DIR", "/var/lib/casa-network-monitor")),
            home_assistant_url=os.getenv("HA_URL", "http://homeassistant.local:8123").rstrip("/"),
            home_assistant_token=os.getenv("HA_TOKEN", "").strip(),
        )


@dataclass
class Status:
    healthy: bool = False
    link: str = "unknown"
    public_ip: str | None = None
    previous_ip: str | None = None
    routed_prefix: str | None = None
    origin_asns: list[int] = field(default_factory=list)
    classification_reason: str | None = None
    source: str | None = None
    checked_at: str | None = None
    started_at: str = ""
    failover_started_at: str | None = None
    last_failover_started_at: str | None = None
    last_failover_ended_at: str | None = None
    last_failover_duration_seconds: int | None = None
    consecutive_failures: int = 0
    error: str | None = None


class HomeAssistantError(RuntimeError):
    """Home Assistant API or websocket failure."""


def _read_exact(sock: socket.socket, length: int) -> bytes:
    data = bytearray()
    while len(data) < length:
        chunk = sock.recv(length - len(data))
        if not chunk:
            raise HomeAssistantError("Home Assistant websocket closed unexpectedly")
        data.extend(chunk)
    return bytes(data)


def _ws_send_frame(sock: socket.socket, payload: bytes, opcode: int = 0x1) -> None:
    mask = os.urandom(4)
    first = 0x80 | (opcode & 0x0F)
    length = len(payload)
    if length < 126:
        header = struct.pack("!BB", first, 0x80 | length)
    elif length <= 0xFFFF:
        header = struct.pack("!BBH", first, 0x80 | 126, length)
    else:
        header = struct.pack("!BBQ", first, 0x80 | 127, length)
    masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
    sock.sendall(header + mask + masked)


def _ws_receive_message(sock: socket.socket) -> str:
    fragments = bytearray()
    started = False
    while True:
        first, second = struct.unpack("!BB", _read_exact(sock, 2))
        fin = bool(first & 0x80)
        opcode = first & 0x0F
        masked = bool(second & 0x80)
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", _read_exact(sock, 2))[0]
        elif length == 127:
            length = struct.unpack("!Q", _read_exact(sock, 8))[0]
        if length > 16 * 1024 * 1024:
            raise HomeAssistantError("Home Assistant websocket response too large")
        mask = _read_exact(sock, 4) if masked else b""
        payload = _read_exact(sock, length)
        if masked:
            payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))

        if opcode == 0x8:
            raise HomeAssistantError("Home Assistant websocket closed")
        if opcode == 0x9:
            _ws_send_frame(sock, payload, opcode=0xA)
            continue
        if opcode == 0xA:
            continue
        if opcode == 0x1:
            fragments = bytearray(payload)
            started = True
        elif opcode == 0x0 and started:
            fragments.extend(payload)
        else:
            continue
        if fin:
            return fragments.decode("utf-8")


def _ws_connect(url: str, timeout: int) -> socket.socket:
    parsed = urlparse(url)
    if parsed.scheme not in {"ws", "wss"} or not parsed.hostname:
        raise HomeAssistantError("Invalid Home Assistant websocket URL")
    port = parsed.port or (443 if parsed.scheme == "wss" else 80)
    raw = socket.create_connection((parsed.hostname, port), timeout=timeout)
    sock: socket.socket
    if parsed.scheme == "wss":
        context = ssl.create_default_context()
        sock = context.wrap_socket(raw, server_hostname=parsed.hostname)
    else:
        sock = raw
    sock.settimeout(timeout)

    path = parsed.path or "/"
    if parsed.query:
        path += f"?{parsed.query}"
    default_port = 443 if parsed.scheme == "wss" else 80
    host = parsed.hostname if port == default_port else f"{parsed.hostname}:{port}"
    key = base64.b64encode(os.urandom(16)).decode("ascii")
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n"
    )
    sock.sendall(request.encode("ascii"))

    response = bytearray()
    while b"\r\n\r\n" not in response:
        chunk = sock.recv(4096)
        if not chunk:
            raise HomeAssistantError("Home Assistant websocket handshake failed")
        response.extend(chunk)
        if len(response) > 65536:
            raise HomeAssistantError("Home Assistant websocket handshake too large")
    header = bytes(response).split(b"\r\n\r\n", 1)[0].decode("latin-1")
    status_line = header.split("\r\n", 1)[0]
    if " 101 " not in f" {status_line} ":
        raise HomeAssistantError(f"Home Assistant websocket handshake rejected: {status_line}")

    accept_expected = base64.b64encode(
        hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()
    ).decode("ascii")
    headers = {}
    for line in header.split("\r\n")[1:]:
        if ":" in line:
            name, value = line.split(":", 1)
            headers[name.strip().lower()] = value.strip()
    if headers.get("sec-websocket-accept") != accept_expected:
        raise HomeAssistantError("Home Assistant websocket handshake validation failed")
    return sock


class Monitor:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.config.data_dir.mkdir(parents=True, exist_ok=True)
        self.status_path = self.config.data_dir / "network-status.json"
        self.events_path = self.config.data_dir / "failover-events.jsonl"
        self.baseline_path = self.config.data_dir / "primary-ip.txt"
        self.primary_rules = self._parse_networks(self.config.primary_networks)
        self.backup_rules = self._parse_networks(self.config.backup_networks)
        self.status = self._load_status()
        if not self.status.started_at:
            self.status.started_at = utc_now()
        self.baseline_ip = self._load_baseline()

    @staticmethod
    def _parse_networks(values: Iterable[str]) -> tuple[ipaddress._BaseNetwork, ...]:
        parsed: list[ipaddress._BaseNetwork] = []
        for value in values:
            try:
                address = ipaddress.ip_address(value) if "/" not in value else None
                suffix = f"{address}/{address.max_prefixlen}" if address else value
                parsed.append(ipaddress.ip_network(suffix, strict=False))
            except ValueError:
                LOG.warning("Ignoring invalid IP/network rule: %s", value)
        return tuple(parsed)

    def _load_status(self) -> Status:
        try:
            data = json.loads(self.status_path.read_text(encoding="utf-8"))
            allowed = set(Status.__dataclass_fields__)
            return Status(**{key: value for key, value in data.items() if key in allowed})
        except (FileNotFoundError, json.JSONDecodeError, TypeError):
            return Status(started_at=utc_now())

    def _load_baseline(self) -> str | None:
        try:
            value = self.baseline_path.read_text(encoding="utf-8").strip()
            ipaddress.ip_address(value)
            return value
        except (FileNotFoundError, ValueError):
            return None

    def _save_baseline(self, value: str) -> None:
        self._atomic_write(self.baseline_path, f"{value}\n")
        self.baseline_ip = value
        LOG.info("Learned primary public IP: %s", value)

    @staticmethod
    def _atomic_write(path: Path, content: str) -> None:
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(content, encoding="utf-8")
        os.replace(temporary, path)

    def _persist_status(self) -> None:
        payload = json.dumps(asdict(self.status), ensure_ascii=False, indent=2, sort_keys=True)
        self._atomic_write(self.status_path, payload + "\n")

    def _append_event(self, event: dict[str, object]) -> None:
        with self.events_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")

    @staticmethod
    def _matches(ip_text: str, networks: tuple[ipaddress._BaseNetwork, ...]) -> bool:
        ip_value = ipaddress.ip_address(ip_text)
        return any(ip_value in network for network in networks)

    def classify(self, ip_text: str, origin_asns: Iterable[int]) -> tuple[str, str]:
        if self.backup_rules and self._matches(ip_text, self.backup_rules):
            return "backup", "backup_cidr"
        if self.primary_rules and self._matches(ip_text, self.primary_rules):
            return "primary", "primary_cidr"

        asn_set = set(origin_asns)
        if asn_set.intersection(self.config.backup_asns):
            return "backup", "backup_asn"
        if asn_set.intersection(self.config.primary_asns):
            return "primary", "primary_asn"

        if self.baseline_ip:
            result = "primary" if ip_text == self.baseline_ip else "backup"
            return result, "learned_ip"
        if self.config.auto_learn_primary:
            self._save_baseline(ip_text)
            return "primary", "auto_learned_ip"
        return "unknown", "unmatched"

    def fetch_public_ip(self) -> tuple[str, str]:
        errors: list[str] = []
        for provider in self.config.providers:
            request = Request(provider, headers={"User-Agent": "CasaNetworkMonitor/1.1"})
            try:
                with urlopen(request, timeout=self.config.request_timeout_seconds) as response:
                    body = response.read(128).decode("utf-8", errors="replace").strip()
                value = str(ipaddress.ip_address(body))
                return value, provider
            except (URLError, TimeoutError, ValueError, OSError) as exc:
                errors.append(f"{provider}: {exc}")
        raise RuntimeError("; ".join(errors) or "No IP provider configured")

    def fetch_network_info(self, ip_text: str) -> tuple[str | None, list[int]]:
        endpoint = self.config.network_info_url.replace("{ip}", quote(ip_text, safe=""))
        request = Request(endpoint, headers={"User-Agent": "CasaNetworkMonitor/1.1"})
        with urlopen(request, timeout=self.config.request_timeout_seconds) as response:
            payload = json.loads(response.read(64 * 1024).decode("utf-8"))
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise RuntimeError("Invalid network-info response")

        prefix = data.get("prefix")
        raw_asns = data.get("asns") or []
        asns: list[int] = []
        for raw in raw_asns:
            try:
                asns.append(int(raw))
            except (TypeError, ValueError):
                continue
        return str(prefix) if prefix else None, asns

    def _handle_transition(self, old_link: str, new_link: str, old_ip: str | None, new_ip: str) -> None:
        now = utc_now()
        if new_link == "backup" and old_link != "backup":
            self.status.failover_started_at = now
            self.status.last_failover_started_at = now
            self._append_event({
                "event": "failover_started",
                "at": now,
                "from_link": old_link,
                "from_ip": old_ip,
                "to_link": new_link,
                "to_ip": new_ip,
            })
            LOG.warning("Failover started: %s -> %s", old_ip, new_ip)
        elif old_link == "backup" and new_link == "primary":
            started = self.status.failover_started_at or self.status.last_failover_started_at
            duration = None
            if started:
                try:
                    start_dt = datetime.fromisoformat(started)
                    duration = max(0, int((datetime.now(timezone.utc) - start_dt).total_seconds()))
                except ValueError:
                    duration = None
            self.status.failover_started_at = None
            self.status.last_failover_ended_at = now
            self.status.last_failover_duration_seconds = duration
            self._append_event({
                "event": "failover_ended",
                "at": now,
                "from_link": old_link,
                "from_ip": old_ip,
                "to_link": new_link,
                "to_ip": new_ip,
                "duration_seconds": duration,
            })
            LOG.info("Failover ended: %s -> %s", old_ip, new_ip)
        elif old_ip and old_ip != new_ip:
            self._append_event({
                "event": "public_ip_changed",
                "at": now,
                "link": new_link,
                "from_ip": old_ip,
                "to_ip": new_ip,
            })

    def check_once(self) -> None:
        with STATUS_LOCK:
            old_link = self.status.link
            old_ip = self.status.public_ip

        try:
            public_ip, source = self.fetch_public_ip()
            routed_prefix: str | None = None
            origin_asns: list[int] = []
            try:
                routed_prefix, origin_asns = self.fetch_network_info(public_ip)
            except Exception as exc:
                LOG.warning("Network-info lookup failed for %s: %s", public_ip, exc)

            new_link, reason = self.classify(public_ip, origin_asns)
            with STATUS_LOCK:
                self._handle_transition(old_link, new_link, old_ip, public_ip)
                self.status.previous_ip = old_ip if old_ip != public_ip else self.status.previous_ip
                self.status.public_ip = public_ip
                self.status.routed_prefix = routed_prefix
                self.status.origin_asns = origin_asns
                self.status.classification_reason = reason
                self.status.link = new_link
                self.status.source = source
                self.status.checked_at = utc_now()
                self.status.healthy = True
                self.status.consecutive_failures = 0
                self.status.error = None
                self._persist_status()
            LOG.info(
                "Public IP %s prefix=%s asns=%s classified as %s (%s)",
                public_ip,
                routed_prefix,
                origin_asns,
                new_link,
                reason,
            )
        except Exception as exc:
            LOG.warning("Public IP check failed: %s", exc)
            with STATUS_LOCK:
                self.status.checked_at = utc_now()
                self.status.healthy = False
                self.status.consecutive_failures += 1
                self.status.error = str(exc)
                self._persist_status()

    def snapshot(self) -> dict[str, object]:
        with STATUS_LOCK:
            return asdict(self.status)

    def run(self) -> None:
        while not STOP_EVENT.is_set():
            started = time.monotonic()
            self.check_once()
            elapsed = time.monotonic() - started
            STOP_EVENT.wait(max(1.0, self.config.interval_seconds - elapsed))

    def _require_ha(self) -> None:
        if not self.config.home_assistant_url or not self.config.home_assistant_token:
            raise HomeAssistantError("Home Assistant URL/token not configured server-side")

    def _ha_request_json(self, path: str) -> object:
        self._require_ha()
        request = Request(
            f"{self.config.home_assistant_url}{path}",
            headers={
                "Authorization": f"Bearer {self.config.home_assistant_token}",
                "Content-Type": "application/json",
                "User-Agent": "CasaDashboardBackend/1.0",
            },
        )
        with urlopen(request, timeout=self.config.request_timeout_seconds) as response:
            return json.loads(response.read(8 * 1024 * 1024).decode("utf-8"))

    def energy_states(self) -> list[dict[str, object]]:
        payload = self._ha_request_json("/api/states")
        if not isinstance(payload, list):
            raise HomeAssistantError("Invalid Home Assistant states response")
        result: list[dict[str, object]] = []
        for raw in payload:
            if not isinstance(raw, dict):
                continue
            entity_id = str(raw.get("entity_id") or "").lower()
            if not entity_id.startswith("sensor."):
                continue
            if not any(word in entity_id for word in ("solarnet", "fronius", "fotovoltaico")):
                continue
            result.append(raw)
        return result

    def _ha_ws_url(self) -> str:
        base = self.config.home_assistant_url
        if base.startswith("https://"):
            return "wss://" + base.removeprefix("https://") + "/api/websocket"
        if base.startswith("http://"):
            return "ws://" + base.removeprefix("http://") + "/api/websocket"
        raise HomeAssistantError("Unsupported Home Assistant URL")

    def _ha_ws_command(self, command: dict[str, object]) -> object:
        self._require_ha()
        sock = _ws_connect(self._ha_ws_url(), self.config.request_timeout_seconds)
        try:
            sent_command = False
            while True:
                message = json.loads(_ws_receive_message(sock))
                message_type = message.get("type")
                if message_type == "auth_required":
                    _ws_send_frame(
                        sock,
                        json.dumps({
                            "type": "auth",
                            "access_token": self.config.home_assistant_token,
                        }).encode("utf-8"),
                    )
                    continue
                if message_type == "auth_invalid":
                    raise HomeAssistantError("Home Assistant authentication rejected")
                if message_type == "auth_ok" and not sent_command:
                    payload = {"id": 1, **command}
                    _ws_send_frame(sock, json.dumps(payload).encode("utf-8"))
                    sent_command = True
                    continue
                if message_type == "result" and message.get("id") == 1:
                    if not message.get("success"):
                        error = message.get("error") or {}
                        raise HomeAssistantError(str(error.get("message") or "Home Assistant statistics error"))
                    return message.get("result")
        finally:
            try:
                _ws_send_frame(sock, b"", opcode=0x8)
            except Exception:
                pass
            try:
                sock.close()
            except Exception:
                pass

    @staticmethod
    def _row_change(rows: object, start_ms: int, end_ms: int) -> float | None:
        if not isinstance(rows, list):
            return None
        values: list[float] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            try:
                change = float(row["change"])
            except (KeyError, TypeError, ValueError):
                continue
            row_start = row.get("start")
            row_end = row.get("end")
            if isinstance(row_start, (int, float)) and isinstance(row_end, (int, float)):
                if row_end <= start_ms or row_start >= end_ms:
                    continue
            values.append(change)
        return sum(values) if values else None

    def energy_history(self, date_text: str) -> dict[str, object]:
        try:
            selected = date.fromisoformat(date_text)
        except ValueError as exc:
            raise ValueError("Invalid date; expected YYYY-MM-DD") from exc
        if selected < ENERGY_HISTORY_START:
            raise ValueError("Energy history starts on 2026-08-17")
        today = datetime.now(ENERGY_TIMEZONE).date()
        if selected >= today:
            raise ValueError("Persistent history is available for completed days only")

        start = datetime.combine(selected, dt_time.min, tzinfo=ENERGY_TIMEZONE)
        end = start + timedelta(days=1)
        statistic_ids = sorted({entity for ids in ENERGY_ENTITY_IDS.values() for entity in ids})
        result = self._ha_ws_command({
            "type": "recorder/statistics_during_period",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "statistic_ids": statistic_ids,
            "period": "day",
            "types": ["change"],
            "units": {"energy": "kWh"},
        })
        if not isinstance(result, dict):
            raise HomeAssistantError("Invalid Home Assistant statistics response")

        start_ms = int(start.timestamp() * 1000)
        end_ms = int(end.timestamp() * 1000)
        values: dict[str, float | None] = {}
        for kind, candidates in ENERGY_ENTITY_IDS.items():
            value = None
            for entity_id in candidates:
                candidate = self._row_change(result.get(entity_id), start_ms, end_ms)
                if candidate is not None:
                    value = candidate
                    break
            values[kind] = value

        if values["house"] is None and all(values[key] is not None for key in ("pv", "import", "export")):
            values["house"] = max(
                0.0,
                float(values["pv"]) + float(values["import"]) - float(values["export"]),
            )

        coverage = None
        if (
            values["pv"] is not None
            and values["export"] is not None
            and values["house"] is not None
            and float(values["house"]) > 0
        ):
            self_used = max(0.0, float(values["pv"]) - float(values["export"]))
            coverage = max(0.0, min(100.0, self_used / float(values["house"]) * 100.0))

        rounded = {
            key: round(float(value), 4) if value is not None else None
            for key, value in values.items()
        }
        return {
            "date": selected.isoformat(),
            **rounded,
            "coverage": round(coverage, 2) if coverage is not None else None,
            "source": "home_assistant_long_term_statistics",
        }


class ApiHandler(BaseHTTPRequestHandler):
    monitor: Monitor
    cors_origin: str

    def _send_json(self, status: HTTPStatus, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", self.cors_origin)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(HTTPStatus.NO_CONTENT, {})

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path.rstrip("/") == "/api/network-status":
            query = parse_qs(parsed.query)
            view = (query.get("view") or [""])[0]
            try:
                if view == "energy-states":
                    self._send_json(HTTPStatus.OK, self.monitor.energy_states())
                    return
                if view == "energy-history":
                    date_text = (query.get("date") or [""])[0]
                    if not date_text:
                        self._send_json(HTTPStatus.BAD_REQUEST, {"error": "missing_date"})
                        return
                    self._send_json(HTTPStatus.OK, self.monitor.energy_history(date_text))
                    return
            except ValueError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request", "message": str(exc)})
                return
            except (HomeAssistantError, URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
                LOG.warning("Energy API request failed: %s", exc)
                self._send_json(
                    HTTPStatus.SERVICE_UNAVAILABLE,
                    {"error": "home_assistant_unavailable", "message": str(exc)},
                )
                return

            self._send_json(HTTPStatus.OK, self.monitor.snapshot())
            return

        if parsed.path.rstrip("/") == "/healthz":
            snapshot = self.monitor.snapshot()
            status = HTTPStatus.OK if snapshot.get("healthy") else HTTPStatus.SERVICE_UNAVAILABLE
            self._send_json(status, {
                "healthy": snapshot.get("healthy"),
                "checked_at": snapshot.get("checked_at"),
            })
            return

        self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def log_message(self, format_string: str, *args: object) -> None:
        LOG.debug("HTTP %s", format_string % args)


def main() -> int:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    config = Config.from_env()
    monitor = Monitor(config)

    ApiHandler.monitor = monitor
    ApiHandler.cors_origin = config.cors_origin
    server = ThreadingHTTPServer((config.listen_host, config.listen_port), ApiHandler)

    def stop_handler(signum: int, _frame: object) -> None:
        LOG.info("Stopping after signal %s", signum)
        STOP_EVENT.set()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop_handler)
    signal.signal(signal.SIGINT, stop_handler)

    worker = threading.Thread(target=monitor.run, name="ip-monitor", daemon=True)
    worker.start()
    LOG.info("Casa backend listening on http://%s:%s", config.listen_host, config.listen_port)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        STOP_EVENT.set()
        worker.join(timeout=5)
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
