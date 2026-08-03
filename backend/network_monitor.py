#!/usr/bin/env python3
"""Public IP and failover monitor for the Casa dashboard.

The process checks the public IP from the mini-PC, resolves the routed prefix
and origin ASN through RIPEstat, classifies the active WAN, records failover
start/end events, persists a JSON status file and exposes a small local HTTP
API. It uses only the Python standard library.
"""

from __future__ import annotations

import ipaddress
import json
import logging
import os
import signal
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

LOG = logging.getLogger("casa-network-monitor")
STOP_EVENT = threading.Event()
STATUS_LOCK = threading.Lock()


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
            except Exception as exc:  # noqa: BLE001 - ASN lookup has a local fallback
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
        except Exception as exc:  # noqa: BLE001 - keep monitor alive
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


class ApiHandler(BaseHTTPRequestHandler):
    monitor: Monitor
    cors_origin: str

    def _send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
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

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send_json(HTTPStatus.NO_CONTENT, {})

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") == "/api/network-status":
            self._send_json(HTTPStatus.OK, self.monitor.snapshot())
            return
        if self.path.rstrip("/") == "/healthz":
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
    LOG.info("Network status API listening on http://%s:%s", config.listen_host, config.listen_port)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        STOP_EVENT.set()
        worker.join(timeout=5)
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
