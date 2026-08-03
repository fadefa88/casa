(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const config = window.CASA_DASHBOARD_CONFIG || {};
  const rooms = Array.isArray(window.CASA_ROOMS) ? window.CASA_ROOMS : [];
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  let scheduled = false;

  const VALUE_SELECTORS = [
    '.card-head > strong', '.metric-grid strong', '.overview-kpi strong',
    '.status-line strong', '.security-tile strong', '.network-health .score',
    '.network-health strong', '.network-health small', '.room-temp strong',
    '.room-sub', '.context-metric strong', '.context-climate strong',
    '.context-climate small', '.intercom-preview small'
  ];

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

  const isConnected = () => window.CASA_HA?.state?.connected === true;

  const isValid = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(String(entity.state || '').toLowerCase())
  );

  function setText(node, value, nullFlag = value == null) {
    if (!node) return;
    const next = value == null ? NULL_TEXT : String(value);
    if (node.textContent !== next) node.textContent = next;
    node.classList.toggle('ha-null-value', nullFlag);
    if (nullFlag) node.dataset.haNull = 'true';
    else delete node.dataset.haNull;
  }

  function setHtml(node, value) {
    if (node && node.innerHTML !== value) node.innerHTML = value;
  }

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) => {
      const label = card.querySelector('.card-head .title');
      return label && normalize(label.textContent) === wanted;
    }) || null;
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div, .status-line') || [])].find((node) => {
      const labelNode = node.querySelector('small, span');
      return labelNode && normalize(labelNode.textContent) === wanted;
    });
    return row?.querySelector('strong') || null;
  }

  function applyNullState() {
    const offline = !isConnected();
    document.body.classList.toggle('ha-offline-null', offline);
    if (!offline) return;

    document.querySelectorAll(VALUE_SELECTORS.join(',')).forEach((node) => setText(node, null));
    setHtml(document.querySelector('#alarm-pill'), '<i class="fa-solid fa-shield-halved"></i> NULL');
    setHtml(document.querySelector('#internet-pill'), '<i class="fa-solid fa-globe"></i> NULL');
    setHtml(document.querySelector('#backup-pill'), '<i class="fa-solid fa-tower-cell"></i> NULL');

    const ha = document.querySelector('#ha-pill');
    if (ha) {
      ha.className = 'pill bad';
      setHtml(ha, '<i class="fa-solid fa-triangle-exclamation"></i> HA OFFLINE · NULL');
    }
  }

  function entityDescription(entity) {
    return normalize([
      entity?.entity_id,
      entity?.attributes?.friendly_name,
      entity?.attributes?.device_class,
      entity?.attributes?.unit_of_measurement,
    ].filter(Boolean).join(' '));
  }

  function roomCandidates(room, key) {
    const values = [];
    const primary = room?.entities?.[key];
    const extra = room?.candidates?.[key];
    if (Array.isArray(primary)) values.push(...primary); else if (primary) values.push(primary);
    if (Array.isArray(extra)) values.push(...extra); else if (extra) values.push(extra);
    return [...new Set(values.filter(Boolean))];
  }

  function resolveRoomEntity(room, key, domain) {
    const map = states();
    for (const entityId of roomCandidates(room, key)) {
      if (isValid(map.get(entityId))) return entityId;
    }

    const roomTokens = [room?.name, ...(room?.aliases || [])].map(normalize).filter(Boolean);
    const kindWords = {
      temperature:['temperatura','temperature'],
      climate:['clima','termostato','thermostat'],
    }[key] || [];

    let best = null;
    let bestScore = 0;
    for (const [entityId, entity] of map) {
      if (!isValid(entity) || !entityId.startsWith(`${domain}.`)) continue;
      const text = entityDescription(entity);
      let score = 0;
      roomTokens.forEach((token) => {
        if (token && text.includes(token)) score = Math.max(score, 7 + token.split(' ').length * 2);
      });
      if (kindWords.some((word) => text.includes(word))) score += 3;
      if (score > bestScore) { bestScore = score; best = entityId; }
    }
    return bestScore >= 8 ? best : null;
  }

  function physicalTemperature(room) {
    const climateId = resolveRoomEntity(room, 'climate', 'climate');
    const sensorId = resolveRoomEntity(room, 'temperature', 'sensor');
    const climate = states().get(climateId);
    const sensor = states().get(sensorId);
    const value = Number(climate?.attributes?.current_temperature ?? sensor?.state);
    return Number.isFinite(value) ? value : null;
  }

  function effectiveTemperature(room, cache = new Map(), visiting = new Set()) {
    if (!room) return null;
    if (cache.has(room.id)) return cache.get(room.id);
    if (visiting.has(room.id)) return null;
    visiting.add(room.id);
    const source = room.temperatureFrom
      ? rooms.find((candidate) => candidate.id === room.temperatureFrom)
      : room;
    const value = source === room
      ? physicalTemperature(room)
      : effectiveTemperature(source, cache, visiting);
    visiting.delete(room.id);
    cache.set(room.id, value);
    return value;
  }

  function patchSharedTemperatures() {
    document.querySelectorAll('.room-temp small').forEach((node) => node.remove());

    const cache = new Map();
    rooms.forEach((room) => {
      const value = effectiveTemperature(room, cache);
      const card = document.querySelector(`.room-card[data-room="${room.id}"]`);
      setText(card?.querySelector('.room-temp strong'), value == null ? null : `${fmt.format(value)}°`);
    });

    const activeCard = document.querySelector('.room-card.active[data-room]');
    const activeRoom = rooms.find((room) => room.id === activeCard?.dataset.room);
    if (activeRoom) {
      const value = effectiveTemperature(activeRoom, cache);
      document.querySelectorAll('#context-panel .context-metric').forEach((metric) => {
        if (normalize(metric.querySelector('small')?.textContent) === 'temperatura') {
          setText(metric.querySelector('strong'), value == null ? null : `${fmt.format(value)} °C`);
        }
      });
    }

    const uniqueSources = new Set();
    const temperatures = [];
    rooms.forEach((room) => {
      const sourceId = room.temperatureFrom || room.id;
      if (uniqueSources.has(sourceId)) return;
      uniqueSources.add(sourceId);
      const value = effectiveTemperature(room, cache);
      if (Number.isFinite(value)) temperatures.push(value);
    });
    const average = temperatures.length
      ? temperatures.reduce((total, value) => total + value, 0) / temperatures.length
      : null;
    const comfort = findCard('Comfort e stanze');
    if (comfort) {
      setText(comfort.querySelector('.card-head > strong'), average == null ? null : `${fmt.format(average)} °C`);
      [...comfort.querySelectorAll('.overview-kpi')].forEach((kpi) => {
        if (normalize(kpi.querySelector('small')?.textContent) === 'media interna') {
          setText(kpi.querySelector('strong'), average == null ? null : `${fmt.format(average)} °C`);
        }
      });
    }
  }

  const NETWORK_RULES = {
    networkState: {
      domains:['sensor','binary_sensor'],
      phrases:['connection status','stato connessione','wan status','internet status','connection state'],
      words:['connection','connessione','wan','internet','status','stato'],
      reject:['uptime','throughput','download','upload','received','sent']
    },
    networkLinkDown: {
      domains:['sensor'],
      phrases:['link download throughput','download link throughput','max downstream','link download','downstream max'],
      words:['link','download','downstream','throughput'],
      reject:['received','ricevuti','current','attuale','kib s','mb s']
    },
    networkLinkUp: {
      domains:['sensor'],
      phrases:['link upload throughput','upload link throughput','max upstream','link upload','upstream max'],
      words:['link','upload','upstream','throughput'],
      reject:['sent','inviati','current','attuale','kib s','mb s']
    },
    networkCurrentDown: {
      domains:['sensor'],
      phrases:['kib s received','mb s received','current download','download attuale','received data rate','download rate'],
      words:['received','ricevuti','download','downstream'],
      reject:['link download','max downstream','total','totale','gb received']
    },
    networkCurrentUp: {
      domains:['sensor'],
      phrases:['kib s sent','mb s sent','current upload','upload attuale','sent data rate','upload rate'],
      words:['sent','inviati','upload','upstream'],
      reject:['link upload','max upstream','total','totale','gb sent']
    },
    networkUptimeHours: {
      domains:['sensor'],
      phrases:['connection uptime','uptime connessione','device uptime','tempo attivita'],
      words:['uptime','durata','attivita'],
      reject:[]
    },
    networkClients: {
      domains:['sensor'],
      phrases:['connected devices','dispositivi connessi','connected clients','client totali','active hosts'],
      words:['devices','dispositivi','clients','client','hosts'],
      reject:['wifi','wlan']
    },
    networkWifiClients: {
      domains:['sensor'],
      phrases:['wifi devices','dispositivi wifi','wifi clients','client wifi','wlan devices'],
      words:['wifi','wlan','clients','devices'],
      reject:[]
    },
    networkPing: {
      domains:['sensor'], phrases:['ping','internet ping','wan ping'], words:['ping','latency','latenza'], reject:[]
    },
    networkJitter: {
      domains:['sensor'], phrases:['jitter'], words:['jitter'], reject:[]
    },
    networkPacketLoss: {
      domains:['sensor'], phrases:['packet loss','perdita pacchetti'], words:['packet','loss','perdita'], reject:[]
    }
  };

  function configuredCandidates(key) {
    const configured = config.entities?.[key];
    return (Array.isArray(configured) ? configured : [configured]).filter(Boolean);
  }

  function resolveNetwork(key) {
    const map = states();
    for (const entityId of configuredCandidates(key)) {
      if (isValid(map.get(entityId))) return map.get(entityId);
    }

    const rule = NETWORK_RULES[key];
    if (!rule) return null;
    let best = null;
    let bestScore = 0;

    for (const [entityId, entity] of map) {
      if (!isValid(entity)) continue;
      const domain = entityId.split('.')[0];
      if (!rule.domains.includes(domain)) continue;
      const text = entityDescription(entity);
      const fritz = text.includes('fritz') || text.includes('avm') || text.includes('7690');
      const requiresFritz = !['networkPing','networkJitter','networkPacketLoss'].includes(key);
      if (requiresFritz && !fritz) continue;

      let score = fritz ? 12 : 0;
      rule.phrases.forEach((phrase) => { if (text.includes(normalize(phrase))) score += 14; });
      rule.words.forEach((word) => { if (text.includes(normalize(word))) score += 3; });
      rule.reject.forEach((word) => { if (text.includes(normalize(word))) score -= 12; });

      if (score > bestScore) { bestScore = score; best = entity; }
    }

    return bestScore >= 15 ? best : null;
  }

  function displayNetwork(entity, key) {
    if (!isValid(entity)) return null;
    const raw = String(entity.state);
    const normalized = normalize(raw);
    const unit = String(entity.attributes?.unit_of_measurement || '').trim();

    if (key === 'networkState') {
      if (['on','connected','online','up','true'].includes(normalized)) return 'Online';
      if (['off','disconnected','offline','down','false'].includes(normalized)) return 'Offline';
      return raw;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return unit ? `${raw} ${unit}` : raw;
    if (key === 'networkClients' || key === 'networkWifiClients') return `${Math.round(numeric)}`;

    const unitNormalized = normalize(unit);
    if (key === 'networkUptimeHours') {
      if (unitNormalized.includes('second')) {
        const hours = numeric / 3600;
        return hours >= 48 ? `${fmt.format(hours / 24)} giorni` : `${fmt.format(hours)} h`;
      }
      if (unitNormalized.includes('minute')) return `${fmt.format(numeric / 60)} h`;
    }
    return unit ? `${fmt.format(numeric)} ${unit}` : fmt.format(numeric);
  }

  function patchCardMetric(cardTitle, label, entity, key) {
    const card = findCard(cardTitle);
    setText(metricNode(card, label), displayNetwork(entity, key));
  }

  function patchCardHeader(cardTitle, entity, key) {
    const card = findCard(cardTitle);
    setText(card?.querySelector('.card-head > strong'), displayNetwork(entity, key));
  }

  function patchFritzBox() {
    const resolved = {};
    Object.keys(NETWORK_RULES).forEach((key) => { resolved[key] = resolveNetwork(key); });
    const backup = configuredCandidates('backup5gStatus').map((id) => states().get(id)).find(isValid) || null;

    const statusText = displayNetwork(resolved.networkState, 'networkState')
      || (resolved.networkLinkDown ? 'Online' : null);

    const internetPill = document.querySelector('#internet-pill');
    if (internetPill) {
      internetPill.className = `pill ${statusText === 'Online' ? 'ok' : statusText === 'Offline' ? 'bad' : 'warn'}`;
      setHtml(internetPill, `<i class="fa-solid fa-globe"></i> ${statusText || NULL_TEXT}`);
    }

    patchCardHeader('Rete', resolved.networkPing, 'networkPing');
    patchCardMetric('Rete', 'Download', resolved.networkLinkDown, 'networkLinkDown');
    patchCardMetric('Rete', 'Upload', resolved.networkLinkUp, 'networkLinkUp');
    patchCardMetric('Rete', 'Dispositivi', resolved.networkClients, 'networkClients');
    patchCardMetric('Rete', 'Backup 5G', backup, 'backup5gStatus');

    const fritzCard = findCard('FRITZ!Box 7690');
    setText(fritzCard?.querySelector('.card-head > strong'), statusText);
    patchCardMetric('FRITZ!Box 7690', 'Link download', resolved.networkLinkDown, 'networkLinkDown');
    patchCardMetric('FRITZ!Box 7690', 'Link upload', resolved.networkLinkUp, 'networkLinkUp');
    patchCardMetric('FRITZ!Box 7690', 'Traffico download', resolved.networkCurrentDown, 'networkCurrentDown');
    patchCardMetric('FRITZ!Box 7690', 'Traffico upload', resolved.networkCurrentUp, 'networkCurrentUp');

    patchCardHeader('Qualità connessione', resolved.networkPing, 'networkPing');
    patchCardMetric('Qualità connessione', 'Ping', resolved.networkPing, 'networkPing');
    patchCardMetric('Qualità connessione', 'Jitter', resolved.networkJitter, 'networkJitter');
    patchCardMetric('Qualità connessione', 'Perdita pacchetti', resolved.networkPacketLoss, 'networkPacketLoss');
    patchCardMetric('Qualità connessione', 'Uptime', resolved.networkUptimeHours, 'networkUptimeHours');

    patchCardHeader('Dispositivi', resolved.networkClients, 'networkClients');
    patchCardMetric('Dispositivi', 'Client Wi‑Fi', resolved.networkWifiClients, 'networkWifiClients');
    patchCardMetric('Dispositivi', 'Client totali', resolved.networkClients, 'networkClients');
    const devicesCard = findCard('Dispositivi');
    patchCardMetric('Dispositivi', 'FTTH', resolved.networkState || resolved.networkLinkDown, 'networkState');
    patchCardMetric('Dispositivi', 'Backup 5G', backup, 'backup5gStatus');

    const health = devicesCard?.querySelector('.network-health');
    if (health) {
      setText(health.querySelector('.score'), null);
      setText(health.querySelector('strong'), statusText ? `Rete ${statusText.toLowerCase()}` : null);
      const wifi = displayNetwork(resolved.networkWifiClients, 'networkWifiClients');
      const total = Number(resolved.networkClients?.state);
      const wifiNumber = Number(resolved.networkWifiClients?.state);
      const wired = Number.isFinite(total) && Number.isFinite(wifiNumber) ? Math.max(0, total - wifiNumber) : null;
      setText(health.querySelector('small'), wifi != null && wired != null ? `${wifi} Wi‑Fi · ${wired} cablati` : null);
    }
  }

  function applyOnlineFixes() {
    if (!isConnected()) return;
    document.body.classList.remove('ha-offline-null');
    patchSharedTemperatures();
    patchFritzBox();
  }

  function apply() {
    scheduled = false;
    applyNullState();
    applyOnlineFixes();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  const style = document.createElement('style');
  style.textContent = `
    .room-temp small { display:none !important; }
    .ha-null-value, body.ha-offline-null [data-ha-null="true"] { color:#ff9d9d !important; }
    body.ha-offline-null [data-action] {
      opacity:.42 !important;
      pointer-events:none !important;
      cursor:not-allowed !important;
    }
    body.ha-offline-null #ha-pill {
      color:#ffd4d4 !important;
      border-color:rgba(255,100,100,.45) !important;
      background:rgba(120,20,20,.24) !important;
    }
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList:true, subtree:true });
  setInterval(schedule, 500);
  schedule();
})();