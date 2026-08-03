(() => {
  'use strict';

  const NULL = 'NULL';
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  const SENSOR_REFRESH_MS = 30000;
  const RENDER_INTERVAL_MS = 5000;

  let sensorIds = {};
  let lastSensorResolve = 0;
  let lastNetworkSignature = '';
  let lastOverviewSignature = '';
  let applyTimer = null;

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const escapeHtml = (value) => String(value ?? NULL)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const ha = () => window.CASA_HA?.state;
  const connected = () => ha()?.connected === true;
  const states = () => ha()?.states instanceof Map ? ha().states : new Map();

  const valid = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(normalize(entity.state))
  );

  const friendly = (entity) => normalize(entity?.attributes?.friendly_name);
  const description = (entity) => normalize([
    entity?.entity_id,
    entity?.attributes?.friendly_name,
    entity?.attributes?.device_class,
    entity?.attributes?.unit_of_measurement,
  ].filter(Boolean).join(' '));

  const SPECS = {
    wan: {
      exact: ['Stato della WAN'],
      includes: ['stato della wan', 'wan status'],
      excludes: ['non disponibile']
    },
    connection: {
      exact: ['Connessione', 'Collegamento'],
      includes: ['connessione', 'collegamento'],
      excludes: ['uptime', 'tempo di attivita']
    },
    externalIp: {
      exact: ['IP esterno'],
      includes: ['ip esterno', 'external ip'],
      excludes: ['ipv6']
    },
    maxDown: {
      exact: ['Velocità massima di scaricamento'],
      includes: ['velocita massima di scaricamento', 'maximum download', 'max downstream'],
      excludes: ['pacchetti']
    },
    maxUp: {
      exact: ['Velocità massima di caricamento'],
      includes: ['velocita massima di caricamento', 'maximum upload', 'max upstream'],
      excludes: ['pacchetti']
    },
    currentDown: {
      exact: ['Velocità effettiva di scaricamento', 'Velocità di scaricamento'],
      includes: ['velocita effettiva di scaricamento', 'velocita di scaricamento', 'current download', 'download throughput'],
      excludes: ['massima', 'pacchetti', 'totale']
    },
    currentUp: {
      exact: ['Velocità effettiva di caricamento', 'Velocità di caricamento'],
      includes: ['velocita effettiva di caricamento', 'velocita di caricamento', 'current upload', 'upload throughput'],
      excludes: ['massima', 'pacchetti', 'totale']
    },
    uptimeConnection: {
      exact: ['Tempo di attività della connessione'],
      includes: ['tempo di attivita della connessione', 'connection uptime']
    },
    uptimeDevice: {
      exact: ['Tempo di attività'],
      includes: ['tempo di attivita', 'device uptime'],
      excludes: ['connessione']
    },
    cpuTemp: {
      exact: ['Temperatura CPU'],
      includes: ['temperatura cpu', 'cpu temperature']
    },
    gbReceived: {
      exact: ['GB ricevuti'],
      includes: ['gb ricevuti', 'received gb', 'data received'],
      excludes: ['velocita', 'pacchetti']
    },
    gbSent: {
      exact: ['GB inviati'],
      includes: ['gb inviati', 'sent gb', 'data sent'],
      excludes: ['velocita', 'pacchetti']
    },
    deviceSensor: {
      exact: ['Dispositivi connessi'],
      includes: ['dispositivi connessi', 'connected devices', 'connected clients'],
      excludes: ['wifi', 'wlan']
    }
  };

  function pickSensor({ exact = [], includes = [], excludes = [], domains = ['sensor', 'binary_sensor'] }) {
    let best = null;
    let bestScore = -Infinity;

    for (const entity of states().values()) {
      if (!valid(entity)) continue;
      const domain = entity.entity_id.split('.')[0];
      if (!domains.includes(domain)) continue;

      const name = friendly(entity);
      const text = description(entity);
      if (excludes.some((term) => text.includes(normalize(term)))) continue;

      let score = 0;
      exact.forEach((term) => {
        const token = normalize(term);
        if (name === token) score = Math.max(score, 100);
        else if (name.startsWith(token)) score = Math.max(score, 80);
      });
      includes.forEach((term) => {
        const token = normalize(term);
        if (name.includes(token)) score += 28;
        else if (text.includes(token)) score += 14;
      });

      if (text.includes('fritz')) score += 12;
      if (text.includes('avm')) score += 8;
      if (text.includes('7690')) score += 8;

      if (score > bestScore) {
        bestScore = score;
        best = entity;
      }
    }

    return bestScore >= 28 ? best : null;
  }

  function resolveSensors(force = false) {
    const now = Date.now();
    if (!force && now - lastSensorResolve < SENSOR_REFRESH_MS && Object.keys(sensorIds).length) return;

    const next = {};
    Object.entries(SPECS).forEach(([key, spec]) => {
      const current = sensorIds[key] ? states().get(sensorIds[key]) : null;
      const entity = valid(current) ? current : pickSensor(spec);
      if (entity) next[key] = entity.entity_id;
    });

    sensorIds = next;
    lastSensorResolve = now;
  }

  function sensor(key) {
    const entity = states().get(sensorIds[key]);
    return valid(entity) ? entity : null;
  }

  function countRouterDevices() {
    const unique = new Set();
    for (const entity of states().values()) {
      if (!entity.entity_id.startsWith('device_tracker.')) continue;
      if (normalize(entity.state) !== 'home') continue;
      if (normalize(entity.attributes?.source_type) !== 'router') continue;
      const key = entity.attributes?.mac
        || entity.attributes?.hostname
        || entity.attributes?.friendly_name
        || entity.entity_id;
      unique.add(normalize(key));
    }
    return unique.size || null;
  }

  function getData() {
    resolveSensors();
    const deviceEntity = sensor('deviceSensor');
    return {
      wan: sensor('wan') || sensor('connection'),
      externalIp: sensor('externalIp'),
      maxDown: sensor('maxDown'),
      maxUp: sensor('maxUp'),
      currentDown: sensor('currentDown'),
      currentUp: sensor('currentUp'),
      uptimeConnection: sensor('uptimeConnection'),
      uptimeDevice: sensor('uptimeDevice'),
      cpuTemp: sensor('cpuTemp'),
      gbReceived: sensor('gbReceived'),
      gbSent: sensor('gbSent'),
      devices: deviceEntity && Number.isFinite(Number(deviceEntity.state))
        ? Number(deviceEntity.state)
        : countRouterDevices()
    };
  }

  function status(entity) {
    if (!valid(entity)) return NULL;
    const value = normalize(entity.state);
    if (['on', 'connected', 'connesso', 'online', 'up', 'true', 'collegato'].includes(value)) return 'Connesso';
    if (['off', 'disconnected', 'disconnesso', 'offline', 'down', 'false', 'scollegato'].includes(value)) return 'Disconnesso';
    return String(entity.state);
  }

  function durationSeconds(entity) {
    if (!valid(entity)) return null;

    const raw = String(entity.state).trim();
    const normalizedRaw = normalize(raw);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    const numeric = Number(raw.replace(',', '.'));

    if (Number.isFinite(numeric)) {
      if (unit.includes('day') || unit.includes('giorn') || unit === 'd') return numeric * 86400;
      if (unit.includes('hour') || unit.includes('ora') || unit === 'h') return numeric * 3600;
      if (unit.includes('minute') || unit.includes('minut') || unit === 'min') return numeric * 60;
      if (unit.includes('millisecond') || unit === 'ms') return numeric / 1000;
      return numeric;
    }

    const iso = raw.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
    if (iso) {
      return Number(iso[1] || 0) * 86400
        + Number(iso[2] || 0) * 3600
        + Number(iso[3] || 0) * 60
        + Number(iso[4] || 0);
    }

    const dayClock = raw.match(/^(\d+)\s+(?:day|days|giorno|giorni),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/i);
    if (dayClock) {
      return Number(dayClock[1]) * 86400
        + Number(dayClock[2]) * 3600
        + Number(dayClock[3]) * 60
        + Number(dayClock[4] || 0);
    }

    const clock = raw.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
    if (clock) {
      return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] || 0);
    }

    let seconds = 0;
    const patterns = [
      [/([\d.,]+)\s*(?:giorno|giorni|day|days|d)\b/i, 86400],
      [/([\d.,]+)\s*(?:ora|ore|hour|hours|h)\b/i, 3600],
      [/([\d.,]+)\s*(?:minuto|minuti|minute|minutes|min)\b/i, 60],
      [/([\d.,]+)\s*(?:secondo|secondi|second|seconds|s)\b/i, 1]
    ];
    patterns.forEach(([pattern, multiplier]) => {
      const match = normalizedRaw.match(pattern);
      if (match) seconds += Number(match[1].replace(',', '.')) * multiplier;
    });
    return seconds > 0 ? seconds : null;
  }

  function formatDuration(entity) {
    const totalSeconds = durationSeconds(entity);
    if (!Number.isFinite(totalSeconds)) return valid(entity) ? String(entity.state) : NULL;

    const totalMinutes = Math.max(0, Math.floor(totalSeconds / 60));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];

    if (days) parts.push(`${days} g`);
    if (hours || days) parts.push(`${hours} h`);
    if (minutes || (!days && !hours)) parts.push(`${minutes} min`);

    return parts.slice(0, 3).join(' ');
  }

  function formatValue(entity, kind = 'generic') {
    if (!valid(entity)) return NULL;
    if (kind === 'duration') return formatDuration(entity);

    const raw = String(entity.state);
    const value = Number(raw.replace(',', '.'));
    const unit = String(entity.attributes?.unit_of_measurement || '').trim();
    const unitNorm = normalize(unit);

    if (kind === 'ip') return raw;
    if (kind === 'status') return status(entity);
    if (!Number.isFinite(value)) return unit ? `${raw} ${unit}` : raw;

    if (kind === 'link') {
      if (unitNorm.includes('kbit')) {
        if (Math.abs(value) >= 1_000_000) return `${fmt.format(value / 1_000_000)} Gbit/s`;
        if (Math.abs(value) >= 1_000) return `${fmt.format(value / 1_000)} Mbit/s`;
        return `${fmt.format(value)} kbit/s`;
      }
      if (unitNorm.includes('mbit')) return `${fmt.format(value)} Mbit/s`;
      if (unitNorm.includes('gbit')) return `${fmt.format(value)} Gbit/s`;
    }

    if (kind === 'temperature') return `${fmt.format(value)} ${unit || '°C'}`;
    if (kind === 'count') return `${Math.round(value)}`;
    return unit ? `${fmt.format(value)} ${unit}` : fmt.format(value);
  }

  function metric(label, value) {
    return `<div><small>${escapeHtml(label)}</small><strong class="${value === NULL ? 'ha-null-value' : ''}">${escapeHtml(value)}</strong></div>`;
  }

  function card(title, value, icon, rows, extra = '') {
    return `<section class="card network-card">
      <div class="card-head"><span class="title"><i class="fa-solid ${icon}"></i> ${escapeHtml(title)}</span><strong class="${value === NULL ? 'ha-null-value' : ''}">${escapeHtml(value)}</strong></div>
      <div class="metric-grid two">${rows.map(([label, rowValue]) => metric(label, rowValue)).join('')}</div>
      ${extra}
    </section>`;
  }

  function networkPayload(data) {
    const wanStatus = status(data.wan);
    const devices = Number.isFinite(data.devices) ? String(data.devices) : NULL;
    return {
      wanStatus,
      devices,
      linkDown: formatValue(data.maxDown, 'link'),
      linkUp: formatValue(data.maxUp, 'link'),
      trafficDown: formatValue(data.currentDown),
      trafficUp: formatValue(data.currentUp),
      externalIp: formatValue(data.externalIp, 'ip'),
      uptimeConnection: formatValue(data.uptimeConnection, 'duration'),
      uptimeDevice: formatValue(data.uptimeDevice, 'duration'),
      cpu: formatValue(data.cpuTemp, 'temperature'),
      received: formatValue(data.gbReceived),
      sent: formatValue(data.gbSent)
    };
  }

  function renderNetworkView(payload) {
    if (normalize(document.querySelector('#view-title')?.textContent) !== 'rete') return;

    const left = document.querySelector('#left-rail');
    const right = document.querySelector('#right-rail');
    if (!left || !right) return;

    const signature = JSON.stringify(payload);
    const alreadyRendered = left.querySelector('.card-head .title')?.textContent.includes('FRITZ!Box');
    if (signature === lastNetworkSignature && alreadyRendered) return;

    left.innerHTML =
      card('FRITZ!Box 7690', payload.wanStatus, 'fa-router', [
        ['Link download', payload.linkDown],
        ['Link upload', payload.linkUp],
        ['Traffico download', payload.trafficDown],
        ['Traffico upload', payload.trafficUp],
      ]) +
      card('Connessione WAN', payload.wanStatus, 'fa-globe', [
        ['IP esterno', payload.externalIp],
        ['Uptime connessione', payload.uptimeConnection],
        ['Temperatura CPU', payload.cpu],
        ['Uptime FRITZ!Box', payload.uptimeDevice],
      ]);

    right.innerHTML =
      card('Dispositivi connessi', payload.devices, 'fa-laptop-house', [
        ['Totale online', payload.devices],
        ['Dati ricevuti', payload.received],
        ['Dati inviati', payload.sent],
        ['Stato WAN', payload.wanStatus],
      ]) +
      card('Riepilogo linea', payload.linkDown, 'fa-network-wired', [
        ['Download massimo', payload.linkDown],
        ['Upload massimo', payload.linkUp],
        ['Download attuale', payload.trafficDown],
        ['Upload attuale', payload.trafficUp],
      ], '<div class="card-actions"><button data-action="network-test"><i class="fa-solid fa-rotate"></i> Aggiorna dati</button></div>');

    lastNetworkSignature = signature;
  }

  function renderOverviewCard(payload) {
    if (normalize(document.querySelector('#view-title')?.textContent) !== 'panoramica') return;

    const cardNode = [...document.querySelectorAll('.card')].find((node) =>
      normalize(node.querySelector('.card-head .title')?.textContent) === 'rete'
    );
    if (!cardNode) return;

    const signature = JSON.stringify([
      payload.wanStatus,
      payload.linkDown,
      payload.linkUp,
      payload.devices,
      payload.uptimeConnection
    ]);
    if (signature === lastOverviewSignature) return;

    const header = cardNode.querySelector('.card-head > strong');
    if (header) header.textContent = payload.wanStatus;

    const cells = [...cardNode.querySelectorAll('.metric-grid > div')];
    const rows = [
      ['Download', payload.linkDown],
      ['Upload', payload.linkUp],
      ['Dispositivi', payload.devices],
      ['Uptime', payload.uptimeConnection],
    ];

    cells.forEach((cell, index) => {
      const row = rows[index];
      if (!row) return;
      const label = cell.querySelector('small');
      const value = cell.querySelector('strong');
      if (label) label.textContent = row[0];
      if (value) {
        value.textContent = row[1];
        value.classList.toggle('ha-null-value', row[1] === NULL);
      }
    });

    lastOverviewSignature = signature;
  }

  function apply(forceResolve = false) {
    if (!connected() || document.hidden) return;
    const view = normalize(document.querySelector('#view-title')?.textContent);
    if (!['rete', 'panoramica'].includes(view)) return;

    if (forceResolve) resolveSensors(true);
    const data = getData();
    const payload = networkPayload(data);
    renderOverviewCard(payload);
    renderNetworkView(payload);
    window.CASA_FRITZBOX = data;
  }

  function scheduleApply(forceResolve = false, delay = 80) {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(() => apply(forceResolve), delay);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-view="network"], [data-view="overview"], [data-view-target="network"]')) {
      scheduleApply(false, 120);
    }
    if (event.target.closest('[data-action="network-test"]')) {
      lastSensorResolve = 0;
      lastNetworkSignature = '';
      scheduleApply(true, 350);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleApply(true, 100);
  });

  setInterval(() => apply(false), RENDER_INTERVAL_MS);
  scheduleApply(true, 500);
})();