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

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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
    wan: { exact:['Stato della WAN'], includes:['stato della wan','wan status'], excludes:['non disponibile'] },
    connection: { exact:['Connessione','Collegamento'], includes:['connessione','collegamento'], excludes:['tempo di attivita','uptime'] },
    externalIp: { exact:['IP esterno'], includes:['ip esterno','external ip'], excludes:['ipv6'] },
    maxDown: { exact:['Velocità massima di scaricamento'], includes:['velocita massima di scaricamento','maximum download','max downstream'], excludes:['pacchetti'] },
    maxUp: { exact:['Velocità massima di caricamento'], includes:['velocita massima di caricamento','maximum upload','max upstream'], excludes:['pacchetti'] },
    currentDown: { exact:['Velocità effettiva di scaricamento'], includes:['velocita effettiva di scaricamento','current download','download throughput'], excludes:['massima','pacchetti','totale'] },
    currentUp: { exact:['Velocità effettiva di caricamento'], includes:['velocita effettiva di caricamento','current upload','upload throughput'], excludes:['massima','pacchetti','totale'] },
    uptimeConnection: { exact:['Tempo di attività della connessione'], includes:['tempo di attivita della connessione','connection uptime'], excludes:[] },
    uptimeDevice: { exact:['Tempo di attività'], includes:['tempo di attivita','device uptime','system uptime'], excludes:['connessione'] },
    cpuTemp: { exact:['Temperatura CPU'], includes:['temperatura cpu','cpu temperature'], excludes:[] },
    gbReceived: { exact:['GB ricevuti'], includes:['gb ricevuti','received gb','data received'], excludes:['velocita','pacchetti'] },
    gbSent: { exact:['GB inviati'], includes:['gb inviati','sent gb','data sent'], excludes:['velocita','pacchetti'] },
    devices: { exact:['Dispositivi connessi'], includes:['dispositivi connessi','connected devices','connected clients'], excludes:['wifi','wlan'] }
  };

  function scoreEntity(entity, spec) {
    if (!valid(entity)) return -Infinity;
    const domain = entity.entity_id.split('.')[0];
    if (!['sensor', 'binary_sensor'].includes(domain)) return -Infinity;

    const friendly = normalize(entity.attributes?.friendly_name);
    const text = entityText(entity);
    if (spec.excludes.some((term) => text.includes(normalize(term)))) return -Infinity;

    let score = 0;
    spec.exact.forEach((term) => {
      const token = normalize(term);
      if (friendly === token) score = Math.max(score, 120);
      else if (friendly.startsWith(`${token} `)) score = Math.max(score, 95);
    });
    spec.includes.forEach((term) => {
      const token = normalize(term);
      if (friendly.includes(token)) score += 40;
      else if (text.includes(token)) score += 20;
    });

    if (text.includes('fritz')) score += 14;
    if (text.includes('7690')) score += 12;
    if (text.includes('avm')) score += 8;
    return score;
  }

  function resolveSensors(force = false) {
    const now = Date.now();
    if (!force && now - lastResolve < SENSOR_CACHE_MS && Object.keys(sensorIds).length) return;

    const resolved = {};
    Object.entries(SPECS).forEach(([key, spec]) => {
      let best = null;
      let bestScore = -Infinity;
      states().forEach((entity) => {
        const score = scoreEntity(entity, spec);
        if (score > bestScore) {
          bestScore = score;
          best = entity;
        }
      });
      resolved[key] = bestScore >= 40 ? best?.entity_id || null : null;
    });

    sensorIds = resolved;
    lastResolve = now;
  }

  const entity = (key) => sensorIds[key] ? states().get(sensorIds[key]) : null;

  function countConnectedDevices() {
    const explicit = entity('devices');
    const value = Number(explicit?.state);
    if (valid(explicit) && Number.isFinite(value)) return Math.round(value);

    const unique = new Set();
    states().forEach((item) => {
      if (!item.entity_id.startsWith('device_tracker.')) return;
      if (normalize(item.state) !== 'home') return;
      if (normalize(item.attributes?.source_type) !== 'router') return;
      unique.add(normalize(item.attributes?.mac || item.attributes?.hostname || item.attributes?.friendly_name || item.entity_id));
    });
    return unique.size || null;
  }

  function statusValue(item) {
    if (!valid(item)) return NULL_TEXT;
    const value = normalize(item.state);
    if (['on','connected','connesso','online','up','true','collegato'].includes(value)) return 'Connesso';
    if (['off','disconnected','disconnesso','offline','down','false','scollegato'].includes(value)) return 'Disconnesso';
    return String(item.state);
  }

  function parseNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const parsed = Number(text.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
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
      return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 1000) : null;
    }

    if (numeric !== null) {
      if (unit.includes('millisecond') || unit === 'ms') return numeric / 1000;
      if (unit.includes('second') || ['s','sec'].includes(unit)) return numeric;
      if (unit.includes('minute') || unit === 'min') return numeric * 60;
      if (unit.includes('hour') || unit.includes('ora') || unit === 'h') return numeric * 3600;
      if (unit.includes('day') || unit.includes('giorn') || unit === 'd') return numeric * 86400;
      if (numeric > 1_000_000_000_000) return Math.max(0, (Date.now() - numeric) / 1000);
      if (numeric > 1_000_000_000) return Math.max(0, Date.now() / 1000 - numeric);
      return numeric;
    }

    const iso = raw.match(/^P(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i);
    if (iso) {
      return (parseNumber(iso[1]) || 0) * 86400
        + (parseNumber(iso[2]) || 0) * 3600
        + (parseNumber(iso[3]) || 0) * 60
        + (parseNumber(iso[4]) || 0);
    }

    const dayClock = raw.match(/^(\d+)\s+(?:day|days|giorno|giorni),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/i);
    if (dayClock) {
      return Number(dayClock[1]) * 86400 + Number(dayClock[2]) * 3600 + Number(dayClock[3]) * 60 + Number(dayClock[4] || 0);
    }

    const clock = raw.match(/^(\d{1,4}):(\d{2})(?::(\d{2}))?$/);
    if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] || 0);

    const text = normalize(raw);
    let seconds = 0;
    [
      [/([\d.,]+)\s*(?:giorno|giorni|day|days|d)\b/i, 86400],
      [/([\d.,]+)\s*(?:ora|ore|hour|hours|h)\b/i, 3600],
      [/([\d.,]+)\s*(?:minuto|minuti|minute|minutes|min)\b/i, 60],
      [/([\d.,]+)\s*(?:secondo|secondi|second|seconds|sec|s)\b/i, 1]
    ].forEach(([pattern, multiplier]) => {
      const match = text.match(pattern);
      if (match) seconds += (parseNumber(match[1]) || 0) * multiplier;
    });
    return seconds || null;
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

  function rateValue(item) {
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
    if (kind === 'duration') return durationValue(item);
    if (kind === 'rate') return rateValue(item);
    if (kind === 'ip') return String(item.state);

    const numeric = parseNumber(item.state);
    const unit = String(item.attributes?.unit_of_measurement || '').trim();
    if (numeric === null) return unit ? `${item.state} ${unit}` : String(item.state);
    if (kind === 'temperature') return `${fmt.format(numeric)} ${unit || '°C'}`;
    return unit ? `${fmt.format(numeric)} ${unit}` : fmt.format(numeric);
  }

  function collectData() {
    resolveSensors();
    const devices = countConnectedDevices();
    return {
      wan: statusValue(entity('wan') || entity('connection')),
      externalIp: genericValue(entity('externalIp'), 'ip'),
      maxDown: genericValue(entity('maxDown'), 'rate'),
      maxUp: genericValue(entity('maxUp'), 'rate'),
      currentDown: genericValue(entity('currentDown'), 'rate'),
      currentUp: genericValue(entity('currentUp'), 'rate'),
      uptimeConnection: genericValue(entity('uptimeConnection'), 'duration'),
      uptimeDevice: genericValue(entity('uptimeDevice'), 'duration'),
      cpuTemp: genericValue(entity('cpuTemp'), 'temperature'),
      gbReceived: genericValue(entity('gbReceived')),
      gbSent: genericValue(entity('gbSent')),
      devices: Number.isFinite(devices) ? String(devices) : NULL_TEXT
    };
  }

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === wanted
    ) || null;
  }

  function setText(node, value) {
    if (!node) return;
    if (node.textContent !== value) node.textContent = value;
    node.classList.toggle('ha-null-value', value === NULL_TEXT);
  }

  function patchMetric(cardTitle, label, value) {
    const card = findCard(cardTitle);
    if (!card) return;
    const wanted = normalize(label);
    const row = [...card.querySelectorAll('.metric-grid > div')].find((item) =>
      normalize(item.querySelector('small')?.textContent) === wanted
    );
    setText(row?.querySelector('strong'), value);
  }

  function patchHeader(cardTitle, value) {
    setText(findCard(cardTitle)?.querySelector('.card-head > strong'), value);
  }

  function patchNetworkView(data) {
    if (currentView() !== 'rete') return;

    patchHeader('FRITZ!Box 7690', data.wan);
    patchMetric('FRITZ!Box 7690', 'Link download', data.maxDown);
    patchMetric('FRITZ!Box 7690', 'Link upload', data.maxUp);
    patchMetric('FRITZ!Box 7690', 'Traffico download', data.currentDown);
    patchMetric('FRITZ!Box 7690', 'Traffico upload', data.currentUp);

    patchHeader('Connessione WAN', data.wan);
    patchMetric('Connessione WAN', 'IP esterno', data.externalIp);
    patchMetric('Connessione WAN', 'Uptime connessione', data.uptimeConnection);
    patchMetric('Connessione WAN', 'Temperatura CPU', data.cpuTemp);
    patchMetric('Connessione WAN', 'Uptime FRITZ!Box', data.uptimeDevice);

    patchHeader('Dispositivi connessi', data.devices);
    patchMetric('Dispositivi connessi', 'Totale online', data.devices);
    patchMetric('Dispositivi connessi', 'Dati ricevuti', data.gbReceived);
    patchMetric('Dispositivi connessi', 'Dati inviati', data.gbSent);
    patchMetric('Dispositivi connessi', 'Stato WAN', data.wan);

    patchHeader('Riepilogo linea', data.maxDown);
    patchMetric('Riepilogo linea', 'Download massimo', data.maxDown);
    patchMetric('Riepilogo linea', 'Upload massimo', data.maxUp);
    patchMetric('Riepilogo linea', 'Download attuale', data.currentDown);
    patchMetric('Riepilogo linea', 'Upload attuale', data.currentUp);
  }

  function patchOverview(data) {
    if (currentView() !== 'panoramica') return;
    patchHeader('Rete', data.wan);
    patchMetric('Rete', 'Download', data.maxDown);
    patchMetric('Rete', 'Upload', data.maxUp);
    patchMetric('Rete', 'Dispositivi', data.devices);
    patchMetric('Rete', 'Uptime', data.uptimeConnection);
  }

  function apply(force = false) {
    if (document.hidden || !connected()) return;
    const view = currentView();
    if (!['rete', 'panoramica'].includes(view)) return;
    resolveSensors(force);
    const data = collectData();
    patchNetworkView(data);
    patchOverview(data);
    window.CASA_FRITZBOX = data;
  }

  function schedule(force = false) {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      apply(force);
    });
  }

  const observer = new MutationObserver(() => schedule(false));
  const left = document.querySelector('#left-rail');
  const right = document.querySelector('#right-rail');
  if (left) observer.observe(left, { childList: true, subtree: false });
  if (right) observer.observe(right, { childList: true, subtree: false });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="network-test"]')) {
      lastResolve = 0;
      setTimeout(() => schedule(true), 50);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule(true);
  });

  timer = setInterval(() => schedule(false), UPDATE_MS);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  schedule(true);
})();
