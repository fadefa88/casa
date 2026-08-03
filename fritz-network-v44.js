(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const SENSOR_CACHE_MS = 30000;
  const UPDATE_MS = 5000;
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

  let sensorIds = {};
  let lastResolve = 0;
  let timer = null;
  let frame = null;
  let rendering = false;
  let lastNetworkSignature = '';
  let lastOverviewSignature = '';

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const escapeHtml = (value) => String(value ?? NULL_TEXT)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const haState = () => window.CASA_HA?.state;
  const states = () => haState()?.states instanceof Map ? haState().states : new Map();
  const connected = () => haState()?.connected === true;
  const currentView = () => normalize(document.querySelector('#view-title')?.textContent);

  const valid = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(normalize(entity.state))
  );

  const entityText = (entity) => normalize([
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
      excludes: ['tempo di attivita', 'uptime']
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
      exact: ['Velocità effettiva di scaricamento'],
      includes: ['velocita effettiva di scaricamento', 'current download', 'download throughput'],
      excludes: ['massima', 'pacchetti', 'totale']
    },
    currentUp: {
      exact: ['Velocità effettiva di caricamento'],
      includes: ['velocita effettiva di caricamento', 'current upload', 'upload throughput'],
      excludes: ['massima', 'pacchetti', 'totale']
    },
    uptimeConnection: {
      exact: ['Tempo di attività della connessione'],
      includes: ['tempo di attivita della connessione', 'connection uptime'],
      excludes: []
    },
    uptimeDevice: {
      exact: ['Tempo di attività'],
      includes: ['tempo di attivita', 'device uptime', 'system uptime'],
      excludes: ['connessione']
    },
    cpuTemp: {
      exact: ['Temperatura CPU'],
      includes: ['temperatura cpu', 'cpu temperature'],
      excludes: []
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
    devices: {
      exact: ['Dispositivi connessi'],
      includes: ['dispositivi connessi', 'connected devices', 'connected clients'],
      excludes: ['wifi', 'wlan']
    }
  };

  function scoreEntity(entity, spec) {
    if (!valid(entity)) return -Infinity;
    const domain = entity.entity_id.split('.')[0];
    if (!['sensor', 'binary_sensor'].includes(domain)) return -Infinity;

    const friendly = normalize(entity.attributes?.friendly_name);
    const text = entityText(entity);
    if (spec.excludes.some((term) => text.includes(normalize(term)))) return -Infinity;

    let score = 0;
    for (const exact of spec.exact) {
      const candidate = normalize(exact);
      if (friendly === candidate) score = Math.max(score, 120);
      else if (friendly.startsWith(`${candidate} `)) score = Math.max(score, 95);
    }
    for (const part of spec.includes) {
      const candidate = normalize(part);
      if (friendly.includes(candidate)) score += 40;
      else if (text.includes(candidate)) score += 20;
    }

    if (text.includes('fritz')) score += 14;
    if (text.includes('7690')) score += 12;
    if (text.includes('avm')) score += 8;
    return score;
  }

  function resolveSensors(force = false) {
    const now = Date.now();
    if (!force && now - lastResolve < SENSOR_CACHE_MS && Object.keys(sensorIds).length) return;

    const resolved = {};
    for (const [key, spec] of Object.entries(SPECS)) {
      let best = null;
      let bestScore = -Infinity;
      for (const entity of states().values()) {
        const score = scoreEntity(entity, spec);
        if (score > bestScore) {
          bestScore = score;
          best = entity;
        }
      }
      resolved[key] = bestScore >= 40 ? best?.entity_id || null : null;
    }

    sensorIds = resolved;
    lastResolve = now;
  }

  const entity = (key) => sensorIds[key] ? states().get(sensorIds[key]) : null;

  function countConnectedDevices() {
    const explicit = entity('devices');
    const explicitValue = Number(explicit?.state);
    if (valid(explicit) && Number.isFinite(explicitValue)) return Math.round(explicitValue);

    const unique = new Set();
    for (const item of states().values()) {
      if (!item.entity_id.startsWith('device_tracker.')) continue;
      if (normalize(item.state) !== 'home') continue;
      if (normalize(item.attributes?.source_type) !== 'router') continue;
      const id = item.attributes?.mac
        || item.attributes?.hostname
        || item.attributes?.friendly_name
        || item.entity_id;
      unique.add(normalize(id));
    }
    return unique.size || null;
  }

  function statusValue(item) {
    if (!valid(item)) return NULL_TEXT;
    const value = normalize(item.state);
    if (['on', 'connected', 'connesso', 'online', 'up', 'true', 'collegato'].includes(value)) return 'Connesso';
    if (['off', 'disconnected', 'disconnesso', 'offline', 'down', 'false', 'scollegato'].includes(value)) return 'Disconnesso';
    return String(item.state);
  }

  function parseNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const normalized = text
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function durationSeconds(item) {
    if (!valid(item)) return null;

    const raw = String(item.state).trim();
    const unit = normalize(item.attributes?.unit_of_measurement);
    const deviceClass = normalize(item.attributes?.device_class);
    const numeric = parseNumber(raw);

    if (deviceClass === 'timestamp' || /^\d{4}-\d{2}-\d{2}[t ]/i.test(raw)) {
      const timestamp = Date.parse(raw);
      if (Number.isFinite(timestamp)) return Math.max(0, (Date.now() - timestamp) / 1000);
    }

    if (numeric !== null) {
      if (unit.includes('millisecond') || unit === 'ms') return numeric / 1000;
      if (unit.includes('second') || unit === 's' || unit === 'sec') return numeric;
      if (unit.includes('minute') || unit === 'min') return numeric * 60;
      if (unit.includes('hour') || unit.includes('ora') || unit === 'h') return numeric * 3600;
      if (unit.includes('day') || unit.includes('giorn') || unit === 'd') return numeric * 86400;

      if (numeric > 1_000_000_000_000) return Math.max(0, (Date.now() - numeric) / 1000);
      if (numeric > 1_000_000_000) return Math.max(0, Date.now() / 1000 - numeric);
      return numeric;
    }

    const iso = raw.match(/^P(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i);
    if (iso) {
      return parseNumber(iso[1]) * 86400
        + parseNumber(iso[2]) * 3600
        + parseNumber(iso[3]) * 60
        + parseNumber(iso[4]);
    }

    const dayClock = raw.match(/^(\d+)\s+(?:day|days|giorno|giorni),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/i);
    if (dayClock) {
      return Number(dayClock[1]) * 86400
        + Number(dayClock[2]) * 3600
        + Number(dayClock[3]) * 60
        + Number(dayClock[4] || 0);
    }

    const clock = raw.match(/^(\d{1,4}):(\d{2})(?::(\d{2}))?$/);
    if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] || 0);

    let seconds = 0;
    const text = normalize(raw);
    const rules = [
      [/([\d.,]+)\s*(?:giorno|giorni|day|days|d)\b/i, 86400],
      [/([\d.,]+)\s*(?:ora|ore|hour|hours|h)\b/i, 3600],
      [/([\d.,]+)\s*(?:minuto|minuti|minute|minutes|min)\b/i, 60],
      [/([\d.,]+)\s*(?:secondo|secondi|second|seconds|sec|s)\b/i, 1]
    ];
    for (const [pattern, multiplier] of rules) {
      const match = text.match(pattern);
      if (match) seconds += (parseNumber(match[1]) || 0) * multiplier;
    }
    return seconds > 0 ? seconds : null;
  }

  function durationValue(item) {
    const seconds = durationSeconds(item);
    if (!Number.isFinite(seconds)) return valid(item) ? String(item.state) : NULL_TEXT;

    const totalMinutes = Math.max(0, Math.floor(seconds / 60));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];

    if (days) parts.push(`${days} ${days === 1 ? 'giorno' : 'giorni'}`);
    if (hours) parts.push(`${hours} h`);
    if (minutes || !parts.length) parts.push(`${minutes} min`);
    return parts.join(' ');
  }

  function rateValue(item, mode = 'traffic') {
    if (!valid(item)) return NULL_TEXT;
    const numeric = parseNumber(item.state);
    const rawUnit = String(item.attributes?.unit_of_measurement || '').trim();
    const unit = normalize(rawUnit);
    if (numeric === null) return rawUnit ? `${item.state} ${rawUnit}` : String(item.state);

    let mbit = null;
    if (unit.includes('gbit')) mbit = numeric * 1000;
    else if (unit.includes('mbit')) mbit = numeric;
    else if (unit.includes('kbit')) mbit = numeric / 1000;
    else if (unit.includes('kib s')) mbit = numeric * 8.192 / 1000;
    else if (unit.includes('kb s')) mbit = numeric * 8 / 1000;
    else if (unit.includes('mib s')) mbit = numeric * 8.388608;
    else if (unit.includes('mb s')) mbit = numeric * 8;
    else if (unit === 'b s' || unit.includes('byte s')) mbit = numeric * 8 / 1_000_000;

    if (mbit === null) return rawUnit ? `${fmt.format(numeric)} ${rawUnit}` : fmt.format(numeric);
    if (mbit >= 1000) return `${fmt.format(mbit / 1000)} Gbit/s`;
    if (mbit >= 1) return `${fmt.format(mbit)} Mbit/s`;
    return `${fmt.format(mbit * 1000)} kbit/s`;
  }

  function genericValue(item, kind = 'generic') {
    if (!valid(item)) return NULL_TEXT;
    if (kind === 'status') return statusValue(item);
    if (kind === 'duration') return durationValue(item);
    if (kind === 'link') return rateValue(item, 'link');
    if (kind === 'traffic') return rateValue(item, 'traffic');
    if (kind === 'ip') return String(item.state);

    const numeric = parseNumber(item.state);
    const unit = String(item.attributes?.unit_of_measurement || '').trim();
    if (numeric === null) return unit ? `${item.state} ${unit}` : String(item.state);
    if (kind === 'temperature') return `${fmt.format(numeric)} ${unit || '°C'}`;
    return unit ? `${fmt.format(numeric)} ${unit}` : fmt.format(numeric);
  }

  function collectData() {
    resolveSensors();
    const wanEntity = entity('wan') || entity('connection');
    return {
      wan: statusValue(wanEntity),
      externalIp: genericValue(entity('externalIp'), 'ip'),
      maxDown: genericValue(entity('maxDown'), 'link'),
      maxUp: genericValue(entity('maxUp'), 'link'),
      currentDown: genericValue(entity('currentDown'), 'traffic'),
      currentUp: genericValue(entity('currentUp'), 'traffic'),
      uptimeConnection: genericValue(entity('uptimeConnection'), 'duration'),
      uptimeDevice: genericValue(entity('uptimeDevice'), 'duration'),
      cpuTemp: genericValue(entity('cpuTemp'), 'temperature'),
      gbReceived: genericValue(entity('gbReceived')),
      gbSent: genericValue(entity('gbSent')),
      devices: countConnectedDevices()
    };
  }

  function metric(label, value) {
    const nullClass = value === NULL_TEXT ? ' ha-null-value' : '';
    return `<div><small>${escapeHtml(label)}</small><strong class="${nullClass.trim()}">${escapeHtml(value)}</strong></div>`;
  }

  function card(title, value, icon, rows, extra = '') {
    const nullClass = value === NULL_TEXT ? ' ha-null-value' : '';
    return `<section class="card network-card modern-network-card">
      <div class="card-head"><span class="title"><i class="fa-solid ${icon}"></i> ${escapeHtml(title)}</span><strong class="${nullClass.trim()}">${escapeHtml(value)}</strong></div>
      <div class="metric-grid two">${rows.map(([label, rowValue]) => metric(label, rowValue)).join('')}</div>
      ${extra}
    </section>`;
  }

  function renderNetwork(data, force = false) {
    if (currentView() !== 'rete') return;
    const left = document.querySelector('#left-rail');
    const right = document.querySelector('#right-rail');
    if (!left || !right) return;

    const signature = JSON.stringify(data);
    const modernAlready = Boolean(left.querySelector('.modern-network-card') && right.querySelector('.modern-network-card'));
    if (!force && modernAlready && signature === lastNetworkSignature) {
      document.body.classList.remove('modern-network-pending');
      return;
    }

    rendering = true;
    left.innerHTML =
      card('FRITZ!Box 7690', data.wan, 'fa-router', [
        ['Link download', data.maxDown],
        ['Link upload', data.maxUp],
        ['Traffico download', data.currentDown],
        ['Traffico upload', data.currentUp]
      ]) +
      card('Connessione WAN', data.wan, 'fa-globe', [
        ['IP esterno', data.externalIp],
        ['Uptime connessione', data.uptimeConnection],
        ['Temperatura CPU', data.cpuTemp],
        ['Uptime FRITZ!Box', data.uptimeDevice]
      ]);

    const devices = Number.isFinite(data.devices) ? String(data.devices) : NULL_TEXT;
    right.innerHTML =
      card('Dispositivi connessi', devices, 'fa-laptop-house', [
        ['Totale online', devices],
        ['Dati ricevuti', data.gbReceived],
        ['Dati inviati', data.gbSent],
        ['Stato WAN', data.wan]
      ]) +
      card('Riepilogo linea', data.maxDown, 'fa-network-wired', [
        ['Download massimo', data.maxDown],
        ['Upload massimo', data.maxUp],
        ['Download attuale', data.currentDown],
        ['Upload attuale', data.currentUp]
      ], '<div class="card-actions"><button data-action="network-test"><i class="fa-solid fa-rotate"></i> Aggiorna dati</button></div>');

    lastNetworkSignature = signature;
    document.body.classList.remove('modern-network-pending');
    requestAnimationFrame(() => { rendering = false; });
  }

  function renderOverview(data) {
    if (currentView() !== 'panoramica') return;
    const networkCard = [...document.querySelectorAll('.card')].find((node) =>
      normalize(node.querySelector('.card-head .title')?.textContent) === 'rete'
    );
    if (!networkCard) return;

    const devices = Number.isFinite(data.devices) ? String(data.devices) : NULL_TEXT;
    const signature = JSON.stringify([data.wan, data.maxDown, data.maxUp, devices, data.uptimeConnection]);
    if (signature === lastOverviewSignature) return;

    const header = networkCard.querySelector('.card-head > strong');
    if (header) header.textContent = data.wan;
    const rows = [
      ['Download', data.maxDown],
      ['Upload', data.maxUp],
      ['Dispositivi', devices],
      ['Uptime', data.uptimeConnection]
    ];
    [...networkCard.querySelectorAll('.metric-grid > div')].forEach((cell, index) => {
      const row = rows[index];
      if (!row) return;
      const label = cell.querySelector('small');
      const value = cell.querySelector('strong');
      if (label) label.textContent = row[0];
      if (value) {
        value.textContent = row[1];
        value.classList.toggle('ha-null-value', row[1] === NULL_TEXT);
      }
    });
    lastOverviewSignature = signature;
  }

  function apply(force = false) {
    if (document.hidden) return;
    const view = currentView();
    if (!['rete', 'panoramica'].includes(view)) return;
    if (force) resolveSensors(true);
    const data = connected() ? collectData() : {
      wan: NULL_TEXT, externalIp: NULL_TEXT, maxDown: NULL_TEXT, maxUp: NULL_TEXT,
      currentDown: NULL_TEXT, currentUp: NULL_TEXT, uptimeConnection: NULL_TEXT,
      uptimeDevice: NULL_TEXT, cpuTemp: NULL_TEXT, gbReceived: NULL_TEXT,
      gbSent: NULL_TEXT, devices: null
    };
    renderNetwork(data, force);
    renderOverview(data);
    window.CASA_FRITZBOX = data;
  }

  function schedule(force = false) {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      apply(force);
    });
  }

  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (!viewButton) return;
    if (viewButton.dataset.view === 'network') {
      document.body.classList.add('modern-network-pending');
      setTimeout(() => schedule(true), 0);
    } else {
      document.body.classList.remove('modern-network-pending');
    }
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="network-test"]')) {
      lastResolve = 0;
      setTimeout(() => schedule(true), 50);
    }
  });

  const railObserver = new MutationObserver(() => {
    if (rendering) return;
    const view = currentView();
    if (view === 'rete') {
      const left = document.querySelector('#left-rail');
      const right = document.querySelector('#right-rail');
      const modern = Boolean(left?.querySelector('.modern-network-card') && right?.querySelector('.modern-network-card'));
      if (!modern) {
        document.body.classList.add('modern-network-pending');
        schedule(false);
      }
    } else if (view === 'panoramica') {
      schedule(false);
    }
  });

  const leftRail = document.querySelector('#left-rail');
  const rightRail = document.querySelector('#right-rail');
  if (leftRail) railObserver.observe(leftRail, { childList: true });
  if (rightRail) railObserver.observe(rightRail, { childList: true });

  const style = document.createElement('style');
  style.textContent = `
    body.modern-network-pending #left-rail > *,
    body.modern-network-pending #right-rail > * {
      visibility: hidden !important;
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule(true);
  });

  timer = setInterval(() => schedule(false), UPDATE_MS);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    railObserver.disconnect();
  });

  schedule(true);
})();
