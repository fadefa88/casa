(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const config = window.CASA_DASHBOARD_CONFIG || {};
  const rooms = Array.isArray(window.CASA_ROOMS) ? window.CASA_ROOMS : [];
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  let scheduled = false;
  let syncRequested = false;

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

  const connected = () => window.CASA_HA?.state?.connected === true;

  const isValidState = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(String(entity.state || '').toLowerCase())
  );

  const entityDescription = (entity) => normalize([
    entity.entity_id,
    entity.attributes?.friendly_name,
    entity.attributes?.device_class,
    entity.attributes?.unit_of_measurement,
  ].filter(Boolean).join(' '));

  function configuredCandidates(key) {
    const value = config.entities?.[key];
    return (Array.isArray(value) ? value : [value]).filter(Boolean);
  }

  function exactGlobal(key) {
    const map = states();
    return configuredCandidates(key).find((entityId) => isValidState(map.get(entityId))) || null;
  }

  const NETWORK_RULES = {
    networkState: { domains:['sensor','binary_sensor'], words:['wan','internet','connessione','connection','link','status','stato'] },
    networkLinkDown: { domains:['sensor'], words:['download','downstream','ricezione','receive','max downstream','link download'] },
    networkLinkUp: { domains:['sensor'], words:['upload','upstream','trasmissione','send','max upstream','link upload'] },
    networkCurrentDown: { domains:['sensor'], words:['download attuale','current download','download throughput','ricezione dati','received data rate','download rate'] },
    networkCurrentUp: { domains:['sensor'], words:['upload attuale','current upload','upload throughput','trasmissione dati','sent data rate','upload rate'] },
    networkPing: { domains:['sensor'], words:['ping','latenza','latency'] },
    networkJitter: { domains:['sensor'], words:['jitter'] },
    networkPacketLoss: { domains:['sensor'], words:['packet loss','perdita pacchetti'] },
    networkUptimeHours: { domains:['sensor'], words:['uptime','tempo attivita','connection uptime'] },
    networkClients: { domains:['sensor'], words:['dispositivi connessi','connected devices','clients','client totali','hosts'] },
    networkWifiClients: { domains:['sensor'], words:['wifi devices','dispositivi wifi','wifi clients','client wifi','wlan devices'] },
  };

  function fuzzyNetwork(key) {
    const rule = NETWORK_RULES[key];
    if (!rule) return null;
    let best = null;
    let bestScore = 0;

    for (const [entityId, entity] of states()) {
      if (!isValidState(entity)) continue;
      const domain = entityId.split('.')[0];
      if (!rule.domains.includes(domain)) continue;
      const text = entityDescription(entity);
      const isFritz = text.includes('fritz') || text.includes('avm') || text.includes('7690') || text.includes('7590');
      if (!isFritz) continue;

      let score = 8;
      for (const word of rule.words) {
        if (text.includes(normalize(word))) score += word.includes(' ') ? 6 : 3;
      }

      const unit = normalize(entity.attributes?.unit_of_measurement);
      if (['networkLinkDown','networkLinkUp','networkCurrentDown','networkCurrentUp'].includes(key) && /bit|bps/.test(unit)) score += 2;
      if (key === 'networkPing' && /ms|millisecond/.test(unit)) score += 3;
      if (key === 'networkPacketLoss' && /%|percent/.test(unit)) score += 3;
      if (key === 'networkUptimeHours' && /hour|ora|h/.test(unit)) score += 2;

      if (score > bestScore) {
        bestScore = score;
        best = entityId;
      }
    }

    return bestScore >= 11 ? best : null;
  }

  function resolveGlobal(key) {
    const exact = exactGlobal(key);
    if (exact) return exact;

    const fuzzy = fuzzyNetwork(key);
    if (!fuzzy) return null;

    const current = configuredCandidates(key);
    if (!current.includes(fuzzy)) {
      config.entities = config.entities || {};
      config.entities[key] = [fuzzy, ...current];
      syncRequested = true;
    }
    return fuzzy;
  }

  function availableGlobal(key) {
    const entityId = resolveGlobal(key);
    return entityId ? states().get(entityId) : null;
  }

  function roomCandidates(room, key) {
    const values = [];
    const primary = room.entities?.[key];
    const extra = room.candidates?.[key];
    if (Array.isArray(primary)) values.push(...primary); else if (primary) values.push(primary);
    if (Array.isArray(extra)) values.push(...extra); else if (extra) values.push(extra);
    return [...new Set(values.filter(Boolean))];
  }

  function resolveRoom(room, key, domain) {
    const map = states();
    for (const entityId of roomCandidates(room, key)) {
      if (isValidState(map.get(entityId))) return entityId;
    }

    const roomTokens = [room.name, ...(room.aliases || [])].map(normalize).filter(Boolean);
    const kindWords = {
      temperature:['temperatura','temperature'], humidity:['umidita','humidity'], lights:['luce','luci','light'],
      cover:['tapparella','tapparelle','cover','shutter'], climate:['clima','termostato','thermostat'],
    }[key] || [];

    let best = null;
    let bestScore = 0;
    for (const [entityId, entity] of map) {
      if (!isValidState(entity) || !entityId.startsWith(`${domain}.`)) continue;
      const text = entityDescription(entity);
      let score = 0;
      for (const token of roomTokens) {
        if (token && text.includes(token)) score = Math.max(score, 6 + token.split(' ').length * 2);
      }
      if (kindWords.some((word) => text.includes(word))) score += 2;
      if (score > bestScore) { bestScore = score; best = entityId; }
    }
    return bestScore >= 7 ? best : null;
  }

  const setText = (node, value) => {
    if (!node) return;
    const next = value == null ? NULL_TEXT : String(value);
    if (node.textContent !== next) node.textContent = next;
    node.classList.toggle('ha-null-value', next === NULL_TEXT);
  };

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
      const small = node.querySelector('small, span');
      return small && normalize(small.textContent) === wanted;
    });
    return row?.querySelector('strong') || null;
  }

  function patchMetric(cardTitle, label, key) {
    const card = findCard(cardTitle);
    if (!card) return;
    if (!availableGlobal(key)) setText(metricNode(card, label), null);
  }

  function patchHeader(cardTitle, key) {
    const card = findCard(cardTitle);
    if (!card) return;
    if (!availableGlobal(key)) setText(card.querySelector('.card-head > strong'), null);
  }

  function patchEnergyAndNetwork() {
    patchHeader('Fotovoltaico casa', 'pvPower');
    patchMetric('Fotovoltaico casa', 'Produzione oggi', 'pvToday');
    patchMetric('Fotovoltaico casa', 'Autoconsumo', 'pvSelfConsumption');
    patchMetric('Fotovoltaico casa', 'Prelievo', 'gridImport');
    patchMetric('Fotovoltaico casa', 'Immissione', 'gridExport');

    const pvCard = findCard('Fotovoltaico casa');
    if (pvCard) {
      const nodes = [...pvCard.querySelectorAll('.flow-node')];
      const pvOk = Boolean(availableGlobal('pvPower'));
      const houseOk = Boolean(availableGlobal('housePower'));
      nodes.forEach((node) => {
        const label = normalize(node.querySelector('small')?.textContent);
        if (label === 'produzione' && !pvOk) setText(node.querySelector('strong'), null);
        if ((label === 'casa' || label === 'rete') && !(pvOk && houseOk)) setText(node.querySelector('strong'), null);
      });
    }

    patchHeader('Bilancio casa', 'housePower');
    patchMetric('Bilancio casa', 'Consumo oggi', 'houseToday');
    patchMetric('Bilancio casa', 'Costo stimato', 'houseCost');
    patchMetric('Bilancio casa', 'Picco', 'housePeak');
    patchMetric('Bilancio casa', 'Vs ieri', 'houseVsYesterday');

    patchHeader('Linee Shelly', 'heatPumpPower');
    patchMetric('Linee Shelly', 'Pompa di calore', 'heatPumpPower');
    patchMetric('Linee Shelly', 'Modalità', 'heatPumpMode');
    patchMetric('Linee Shelly', 'Induzione', 'inductionPower');

    patchMetric('Elettrodomestici', 'Lavatrice', 'washerPower');
    patchMetric('Elettrodomestici', 'Asciugatrice', 'dryerPower');
    patchMetric('Elettrodomestici', 'Forno', 'ovenPower');
    patchMetric('Elettrodomestici', 'Frigorifero', 'fridgePower');

    patchHeader('Rete', 'networkPing');
    patchMetric('Rete', 'Download', 'networkLinkDown');
    patchMetric('Rete', 'Upload', 'networkLinkUp');
    patchMetric('Rete', 'Dispositivi', 'networkClients');
    patchMetric('Rete', 'Backup 5G', 'backup5gStatus');

    patchHeader('FRITZ!Box 7690', 'networkState');
    patchMetric('FRITZ!Box 7690', 'Link download', 'networkLinkDown');
    patchMetric('FRITZ!Box 7690', 'Link upload', 'networkLinkUp');
    patchMetric('FRITZ!Box 7690', 'Traffico download', 'networkCurrentDown');
    patchMetric('FRITZ!Box 7690', 'Traffico upload', 'networkCurrentUp');

    patchHeader('Qualità connessione', 'networkPing');
    patchMetric('Qualità connessione', 'Ping', 'networkPing');
    patchMetric('Qualità connessione', 'Jitter', 'networkJitter');
    patchMetric('Qualità connessione', 'Perdita pacchetti', 'networkPacketLoss');
    patchMetric('Qualità connessione', 'Uptime', 'networkUptimeHours');

    patchHeader('Dispositivi', 'networkClients');
    patchMetric('Dispositivi', 'Client Wi‑Fi', 'networkWifiClients');
    patchMetric('Dispositivi', 'Client totali', 'networkClients');
    patchMetric('Dispositivi', 'FTTH', 'networkState');
    patchMetric('Dispositivi', 'Backup 5G', 'backup5gStatus');
  }

  function climateLabel(state) {
    const value = String(state || '').toLowerCase();
    if (value === 'off') return 'Spento';
    if (value.includes('cool')) return 'Raffrescamento';
    if (value.includes('heat')) return 'Riscaldamento';
    if (value === 'auto' || value === 'heat_cool') return 'Automatico';
    return state || NULL_TEXT;
  }

  function roomSnapshot(room) {
    const climateId = resolveRoom(room, 'climate', 'climate');
    const tempId = resolveRoom(room, 'temperature', 'sensor');
    const humidityId = resolveRoom(room, 'humidity', 'sensor');
    const lightId = resolveRoom(room, 'lights', 'light');
    const coverId = resolveRoom(room, 'cover', 'cover');
    const climate = states().get(climateId);
    const tempSensor = states().get(tempId);
    const humiditySensor = states().get(humidityId);
    const light = states().get(lightId);
    const cover = states().get(coverId);

    const currentTemperature = Number(climate?.attributes?.current_temperature ?? tempSensor?.state);
    const humidity = Number(climate?.attributes?.current_humidity ?? humiditySensor?.state);
    const position = Number(cover?.attributes?.current_position);

    return {
      climateId, tempId, humidityId, lightId, coverId,
      temperature: Number.isFinite(currentTemperature) ? currentTemperature : null,
      humidity: Number.isFinite(humidity) ? humidity : null,
      lightOn: light ? light.state === 'on' : null,
      cover: Number.isFinite(position) ? position : cover?.state === 'open' ? 100 : cover?.state === 'closed' ? 0 : null,
      climateMode: climate?.state || null,
      targetTemperature: Number.isFinite(Number(climate?.attributes?.temperature)) ? Number(climate.attributes.temperature) : null,
    };
  }

  function patchRooms() {
    const snapshots = new Map(rooms.map((room) => [room.id, roomSnapshot(room)]));

    document.querySelectorAll('.room-card[data-room]').forEach((card) => {
      const room = rooms.find((entry) => entry.id === card.dataset.room);
      const snap = snapshots.get(card.dataset.room);
      if (!room || !snap) return;
      setText(card.querySelector('.room-temp strong'), snap.temperature == null ? null : `${fmt.format(snap.temperature)}°`);
      setText(card.querySelector('.room-temp small'), snap.humidity == null ? null : `${Math.round(snap.humidity)}%`);

      const parts = [];
      parts.push(snap.lightOn == null ? 'Luce NULL' : snap.lightOn ? 'Luce accesa' : 'Luce spenta');
      if (room.entities?.cover || room.candidates?.cover) parts.push(snap.cover == null ? 'Tapparella NULL' : `Tapparella ${Math.round(snap.cover)}%`);
      if (room.entities?.climate || room.candidates?.climate) parts.push(snap.climateMode == null ? 'Clima NULL' : climateLabel(snap.climateMode));
      setText(card.querySelector('.room-sub'), parts.join(' · '));
    });

    const comfort = findCard('Comfort e stanze');
    if (comfort) {
      const indoor = rooms.map((room) => snapshots.get(room.id)).filter(Boolean);
      const temps = indoor.map((snap) => snap.temperature).filter(Number.isFinite);
      const humidity = indoor.map((snap) => snap.humidity).filter(Number.isFinite);
      const lights = indoor.map((snap) => snap.lightOn).filter((value) => value !== null);
      const covers = indoor.map((snap) => snap.cover).filter(Number.isFinite);
      const avg = (values) => values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;

      setText(comfort.querySelector('.card-head > strong'), temps.length ? `${fmt.format(avg(temps))} °C` : null);
      const kpis = [...comfort.querySelectorAll('.overview-kpi')];
      kpis.forEach((kpi) => {
        const label = normalize(kpi.querySelector('small')?.textContent);
        if (label === 'media interna') setText(kpi.querySelector('strong'), temps.length ? `${fmt.format(avg(temps))} °C` : null);
        if (label === 'umidita') setText(kpi.querySelector('strong'), humidity.length ? `${Math.round(avg(humidity))}%` : null);
        if (label === 'luci accese') setText(kpi.querySelector('strong'), lights.length ? lights.filter(Boolean).length : null);
        if (label === 'tapparelle') setText(kpi.querySelector('strong'), covers.length ? `${Math.round(avg(covers))}%` : null);
      });
    }

    const activeCard = document.querySelector('.room-card.active[data-room]');
    const activeRoom = rooms.find((room) => room.id === activeCard?.dataset.room);
    const active = activeRoom ? snapshots.get(activeRoom.id) : null;
    if (active) {
      document.querySelectorAll('#context-panel .context-metric').forEach((metric) => {
        const label = normalize(metric.querySelector('small')?.textContent);
        if (label === 'temperatura') setText(metric.querySelector('strong'), active.temperature == null ? null : `${fmt.format(active.temperature)} °C`);
        if (label === 'umidita') setText(metric.querySelector('strong'), active.humidity == null ? null : `${Math.round(active.humidity)}%`);
        if (label === 'luce') setText(metric.querySelector('strong'), active.lightOn == null ? null : active.lightOn ? 'Accesa' : 'Spenta');
        if (label === 'tapparella') setText(metric.querySelector('strong'), active.cover == null ? null : `${Math.round(active.cover)}%`);
      });
      const climateBox = document.querySelector('#context-panel .context-climate');
      if (climateBox && active.climateMode == null) {
        setText(climateBox.querySelector('strong'), null);
        setText(climateBox.querySelector('small'), null);
        climateBox.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      }
    }
  }

  function apply() {
    scheduled = false;
    if (!connected()) return;
    patchEnergyAndNetwork();
    patchRooms();

    if (syncRequested && !window.CASA_HA?.state?.connecting) {
      syncRequested = false;
      setTimeout(() => window.CASA_HA?.sync?.({ quiet:true }), 50);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  const style = document.createElement('style');
  style.textContent = `.ha-null-value{color:#ff9d9d!important}.ha-null-value::selection{background:transparent}`;
  document.head.appendChild(style);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList:true, subtree:true });
  setInterval(schedule, 1000);
  schedule();
})();
