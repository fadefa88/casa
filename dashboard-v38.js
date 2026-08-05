(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const config = window.CASA_DASHBOARD_CONFIG || {};
  const haConfig = config.homeAssistant || {};
  const rooms = Array.isArray(window.CASA_ROOMS) ? window.CASA_ROOMS : [];
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const power = (value) => Number(value) >= 1000 ? `${fmt.format(Number(value) / 1000)} kW` : `${Math.round(Number(value) || 0)} W`;
  const energy = (value) => `${fmt.format(Number(value) || 0)} kWh`;
  const finiteValue = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const periodEnergy = (value) => finiteValue(value) ? `${fmt.format(Number(value))} kWh` : 'NULL';
  const speed = (value) => Number(value) >= 1000 ? `${fmt.format(Number(value) / 1000)} Gbps` : `${fmt.format(Number(value) || 0)} Mbps`;
  const sum = (...values) => values.reduce((total, value) => total + Number(value || 0), 0);
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const data = {
    housePower: 3280, houseToday: 18.6, houseCost: 5.31, housePeak: 5.42, houseVs: -6,
    pvPower: 4180, pvToday: 19.8, pvSelf: 78, gridImport: 5.2, gridExport: 6.8,
    heatPumpPower: 1420, heatPumpToday: null, heatPumpYesterday: null, heatPumpMonth: null, heatPumpMode: 'Raffrescamento',
    inductionPower: 0, inductionToday: null, inductionYesterday: null, inductionMonth: null, inductionPeak: 3.6,
    washerPower: 510, washerToday: null, washerYesterday: null, washerMonth: null, washerState: 'In funzione',
    dryerPower: 0, dryerToday: null, dryerYesterday: null, dryerMonth: null, dryerState: 'Spenta',
    ovenPower: 0, ovenToday: null, ovenYesterday: null, ovenMonth: null, ovenState: 'Spento',
    fridgePower: 180, fridgeToday: null, fridgeYesterday: null, fridgeMonth: null, fridgeState: 'Compressore attivo',
    dishwasherPower: 0, dishwasherToday: null, dishwasherYesterday: null, dishwasherMonth: null,
    tvPower: 112, tvToday: null, tvYesterday: null, tvMonth: null,
    shieldPower: 9, shieldToday: null, shieldYesterday: null, shieldMonth: null,
    mediaPcPower: 48, mediaPcToday: null, mediaPcYesterday: null, mediaPcMonth: null,
    hddPower: 17, hddToday: null, hddYesterday: null, hddMonth: null,
    pcPower: 250, pcToday: null, pcYesterday: null, pcMonth: null,
    monitorPower: 38, monitorToday: null, monitorYesterday: null, monitorMonth: null,
    ps5Power: 0, ps5Today: null, ps5Yesterday: null, ps5Month: null,
    dockPower: 22, dockToday: null, dockYesterday: null, dockMonth: null,
    networkState: 'Online', networkLinkDown: 2500, networkLinkUp: 1000,
    networkCurrentDown: 412, networkCurrentUp: 84, networkPing: 7, networkJitter: 1.4,
    networkPacketLoss: 0, networkUptimeHours: 326, networkClients: 31, networkWifiClients: 18,
    backup5gStatus: 'Standby', alarmState: 'disarmed', doorbellLastEvent: 'Nessun evento recente',
  };

  const roomStates = Object.fromEntries(rooms.map((room, index) => [room.id, {
    temperature: room.type === 'outdoor' ? 27 + (index % 3) * 0.4 : 21.5 + (index % 6) * 0.45,
    humidity: room.type === 'outdoor' ? 51 : 43 + (index % 5) * 3,
    lightOn: [0, 2, 6, 10].includes(index),
    cover: room.entities?.cover ? 25 + (index * 13) % 76 : null,
    targetTemperature: room.type === 'outdoor' ? null : 24,
    hvacMode: room.type === 'outdoor' ? null : 'cool',
    hvacAction: room.type === 'outdoor' ? null : 'idle',
    resolved: {},
  }]));

  const ui = {
    view: 'overview', selectedRoom: rooms[0]?.id || null, connected: false,
    connecting: false, lastSync: null, source: 'demo', states: new Map(), entityCache: new Map(),
  };

  const left = $('#left-rail');
  const right = $('#right-rail');
  const context = $('#context-panel');
  const markerLayer = $('#room-marker-layer');
  const toastNode = $('#toast');
  let toastTimer = null;
  let refreshTimer = null;
  const techOpenGroups = new Set();

  injectLiveStyles();

  function injectLiveStyles() {
    if ($('#casa-live-styles')) return;
    const style = document.createElement('style');
    style.id = 'casa-live-styles';
    style.textContent = `
      .live-dot{display:inline-block;width:.5rem;height:.5rem;border-radius:50%;background:#35d07f;box-shadow:0 0 0 .22rem rgba(53,208,127,.12);margin-right:.35rem}.live-dot.demo{background:#f5b942;box-shadow:0 0 0 .22rem rgba(245,185,66,.12)}
      .context-climate{display:flex;align-items:center;gap:.55rem;padding:.4rem .55rem;border:1px solid rgba(255,255,255,.09);border-radius:.8rem;background:rgba(2,12,24,.32)}
      .context-climate button{min-width:2.35rem;height:2.35rem;border-radius:.7rem}.context-climate strong{min-width:4.6rem;text-align:center;font-size:1.05rem}
      .context-actions button.active{color:#ffd45f;border-color:rgba(255,212,95,.52);background:rgba(255,212,95,.12)}
      .room-hvac{display:inline-flex;align-items:center;gap:.25rem;color:#74c7ff}.room-hvac.off{color:#8ea2b7}.room-hvac.heating{color:#ff9b77}
      .card-actions button.busy,.context-actions button.busy{opacity:.5;pointer-events:none}
      .ha-error{color:#ff9d9d}.ha-ok{color:#76e0ad}
      .energy-period-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.38rem;margin-top:.55rem}
      .energy-period-strip>div{min-width:0;padding:.42rem .48rem;border:1px solid rgba(255,255,255,.08);border-radius:.68rem;background:rgba(2,12,24,.32);text-align:center}
      .energy-period-strip small,.energy-period-strip strong{display:block}.energy-period-strip small{font-size:.58rem;color:#8fa4bd;text-transform:uppercase;letter-spacing:.045em}.energy-period-strip strong{margin-top:.12rem;font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .tech-groups{display:grid;gap:.42rem}.tech-zone{border:1px solid rgba(255,255,255,.09);border-radius:.75rem;background:rgba(2,12,24,.28);overflow:hidden}.tech-zone>summary{display:flex;align-items:center;gap:.45rem;padding:.48rem .58rem;cursor:pointer;list-style:none}.tech-zone>summary::-webkit-details-marker{display:none}.tech-zone>summary span{flex:1;font-size:.7rem;font-weight:850;letter-spacing:.04em}.tech-zone>summary strong{font-size:.82rem}.tech-zone>summary .tech-chevron{font-size:.62rem;color:#8fa4bd;transition:transform .15s ease}.tech-zone[open]>summary .tech-chevron{transform:rotate(180deg)}
      .tech-device-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.32rem;padding:0 .48rem .48rem}.tech-device{display:flex;align-items:center;justify-content:space-between;gap:.4rem;padding:.38rem .44rem;border-radius:.55rem;background:rgba(255,255,255,.045)}.tech-device small{font-size:.62rem;color:#aebed1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tech-device strong{font-size:.72rem;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  function toast(message, kind = '') {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.className = `toast ${kind}`;
    toastNode.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastNode.hidden = true; }, 2600);
  }

  function metrics(items) {
    return `<div class="metric-grid two">${items.map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>`;
  }

  function energyPeriodStrip(group, values = {}) {
    return `<div class="energy-period-strip" data-energy-group="${group}">
      <div><small>Oggi</small><strong data-period="today">${periodEnergy(values.today)}</strong></div>
      <div><small>Ieri</small><strong data-period="yesterday">${periodEnergy(values.yesterday)}</strong></div>
      <div><small>Mese</small><strong data-period="month">${periodEnergy(values.month)}</strong></div>
    </div>`;
  }

  function technologyGroup(id, label, icon, total, devices) {
    return `<details class="tech-zone" data-tech-group="${id}" ${techOpenGroups.has(id) ? 'open' : ''}>
      <summary><i class="fa-solid ${icon}"></i><span>${label}</span><strong data-tech-total="${id}">${power(total)}</strong><i class="fa-solid fa-chevron-down tech-chevron"></i></summary>
      <div class="tech-device-grid">${devices.map(([key, deviceLabel, value]) => `<div class="tech-device" data-tech-device="${key}"><small>${deviceLabel}</small><strong>${power(value)}</strong></div>`).join('')}</div>
    </details>`;
  }

  function card({ title, value = '', icon = 'fa-chart-simple', cls = '', body = '', target = '' }) {
    return `<section class="card ${cls} ${target ? 'clickable-card' : ''}" ${target ? `data-view-target="${target}" role="button" tabindex="0"` : ''}>
      <div class="card-head"><span class="title"><i class="fa-solid ${icon}"></i> ${title}</span>${value ? `<strong>${value}</strong>` : ''}</div>
      ${body}${target ? '<span class="card-open"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>' : ''}
    </section>`;
  }

  function entityCandidates(room, key) {
    const values = [];
    const primary = room.entities?.[key];
    const candidates = room.candidates?.[key];
    if (Array.isArray(primary)) values.push(...primary); else if (primary) values.push(primary);
    if (Array.isArray(candidates)) values.push(...candidates); else if (candidates) values.push(candidates);
    return [...new Set(values.filter(Boolean))];
  }

  function exactOrFuzzy(room, key, domain) {
    const cacheKey = `${room.id}:${key}`;
    if (ui.entityCache.has(cacheKey)) return ui.entityCache.get(cacheKey);
    const candidates = entityCandidates(room, key);
    for (const entityId of candidates) {
      if (ui.states.has(entityId)) { ui.entityCache.set(cacheKey, entityId); return entityId; }
    }
    const tokens = [room.name, ...(room.aliases || [])].map(normalize).filter(Boolean);
    const keywords = {
      lights: ['luce', 'luci', 'light'], cover: ['tapparella', 'tapparelle', 'cover', 'shutter'],
      climate: ['clima', 'termostato', 'thermostat'], temperature: ['temperatura', 'temperature'], humidity: ['umidita', 'humidity'],
    }[key] || [];
    let best = null;
    let score = -1;
    for (const [entityId, entity] of ui.states) {
      if (!entityId.startsWith(`${domain}.`)) continue;
      const text = normalize(`${entityId} ${entity.attributes?.friendly_name || ''}`);
      const roomScore = tokens.reduce((max, token) => Math.max(max, token && text.includes(token) ? token.split(' ').length * 3 : 0), 0);
      const keyScore = keywords.some((word) => text.includes(word)) ? 2 : 0;
      const candidateScore = roomScore + keyScore;
      if (candidateScore > score && candidateScore >= 3) { best = entityId; score = candidateScore; }
    }
    if (best) ui.entityCache.set(cacheKey, best);
    return best;
  }

  function globalEntity(key, configuredFallback = true) {
    const configured = config.entities?.[key];
    const candidates = Array.isArray(configured) ? configured : [configured];
    return candidates.find((entityId) => ui.states.has(entityId)) || (configuredFallback ? candidates.find(Boolean) : null) || null;
  }

  function stateOf(entityId) { return entityId ? ui.states.get(entityId) : null; }
  function stateNumber(entityId, attribute) {
    const entity = stateOf(entityId);
    if (!entity) return null;
    const value = attribute ? entity.attributes?.[attribute] : entity.state;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function applyGlobalStates() {
    const map = {
      housePower: ['housePower'], houseToday: ['houseToday'], houseCost: ['houseCost'], housePeak: ['housePeak'], houseVs: ['houseVsYesterday'],
      pvPower: ['pvPower'], pvToday: ['pvToday'], pvSelf: ['pvSelfConsumption'], gridImport: ['gridImport'], gridExport: ['gridExport'],
      heatPumpPower: ['heatPumpPower'], heatPumpToday: ['heatPumpToday'], heatPumpYesterday: ['heatPumpYesterday'], heatPumpMonth: ['heatPumpMonth'],
      inductionPower: ['inductionPower'], inductionToday: ['inductionToday'], inductionYesterday: ['inductionYesterday'], inductionMonth: ['inductionMonth'], inductionPeak: ['inductionPeak'],
      washerPower: ['washerPower'], washerToday: ['washerToday'], washerYesterday: ['washerYesterday'], washerMonth: ['washerMonth'],
      dryerPower: ['dryerPower'], dryerToday: ['dryerToday'], dryerYesterday: ['dryerYesterday'], dryerMonth: ['dryerMonth'],
      ovenPower: ['ovenPower'], ovenToday: ['ovenToday'], ovenYesterday: ['ovenYesterday'], ovenMonth: ['ovenMonth'],
      fridgePower: ['fridgePower'], fridgeToday: ['fridgeToday'], fridgeYesterday: ['fridgeYesterday'], fridgeMonth: ['fridgeMonth'],
      dishwasherPower: ['dishwasherPower'], dishwasherToday: ['dishwasherToday'], dishwasherYesterday: ['dishwasherYesterday'], dishwasherMonth: ['dishwasherMonth'],
      tvPower: ['tvPower'], tvToday: ['tvToday'], tvYesterday: ['tvYesterday'], tvMonth: ['tvMonth'],
      shieldPower: ['shieldPower'], shieldToday: ['shieldToday'], shieldYesterday: ['shieldYesterday'], shieldMonth: ['shieldMonth'],
      mediaPcPower: ['mediaPcPower'], mediaPcToday: ['mediaPcToday'], mediaPcYesterday: ['mediaPcYesterday'], mediaPcMonth: ['mediaPcMonth'],
      hddPower: ['hddPower'], hddToday: ['hddToday'], hddYesterday: ['hddYesterday'], hddMonth: ['hddMonth'],
      pcPower: ['pcPower'], pcToday: ['pcToday'], pcYesterday: ['pcYesterday'], pcMonth: ['pcMonth'],
      monitorPower: ['monitorPower'], monitorToday: ['monitorToday'], monitorYesterday: ['monitorYesterday'], monitorMonth: ['monitorMonth'],
      ps5Power: ['ps5Power'], ps5Today: ['ps5Today'], ps5Yesterday: ['ps5Yesterday'], ps5Month: ['ps5Month'],
      dockPower: ['dockPower'], dockToday: ['dockToday'], dockYesterday: ['dockYesterday'], dockMonth: ['dockMonth'],
      networkLinkDown: ['networkLinkDown'], networkLinkUp: ['networkLinkUp'], networkCurrentDown: ['networkCurrentDown'], networkCurrentUp: ['networkCurrentUp'], networkPing: ['networkPing'], networkJitter: ['networkJitter'], networkPacketLoss: ['networkPacketLoss'], networkUptimeHours: ['networkUptimeHours'], networkClients: ['networkClients'], networkWifiClients: ['networkWifiClients'],
    };
    Object.entries(map).forEach(([dataKey, [entityKey]]) => {
      const value = stateNumber(globalEntity(entityKey));
      if (value !== null) data[dataKey] = value;
    });
    const textMap = {
      heatPumpMode: 'heatPumpMode', washerState: 'washerState', dryerState: 'dryerState', ovenState: 'ovenState', fridgeState: 'fridgeState', networkState: 'networkState', backup5gStatus: 'backup5gStatus', doorbellLastEvent: 'doorbellLastEvent',
    };
    Object.entries(textMap).forEach(([dataKey, entityKey]) => {
      const entity = stateOf(globalEntity(entityKey));
      if (entity && !['unknown', 'unavailable'].includes(entity.state)) data[dataKey] = entity.state;
    });
    const alarm = stateOf(globalEntity('alarm'));
    if (alarm) data.alarmState = alarm.state;
  }

  function applyRoomStates() {
    rooms.forEach((room) => {
      const target = roomStates[room.id];
      const climateId = exactOrFuzzy(room, 'climate', 'climate');
      const temperatureId = exactOrFuzzy(room, 'temperature', 'sensor');
      const humidityId = exactOrFuzzy(room, 'humidity', 'sensor');
      const lightId = exactOrFuzzy(room, 'lights', 'light');
      const coverId = exactOrFuzzy(room, 'cover', 'cover');
      target.resolved = { climate: climateId, temperature: temperatureId, humidity: humidityId, lights: lightId, cover: coverId };
      const climate = stateOf(climateId);
      const temp = climate?.attributes?.current_temperature ?? stateNumber(temperatureId);
      const humidity = climate?.attributes?.current_humidity ?? stateNumber(humidityId);
      if (Number.isFinite(Number(temp))) target.temperature = Number(temp);
      if (Number.isFinite(Number(humidity))) target.humidity = Number(humidity);
      if (climate) {
        target.targetTemperature = Number.isFinite(Number(climate.attributes?.temperature)) ? Number(climate.attributes.temperature) : target.targetTemperature;
        target.hvacMode = climate.state;
        target.hvacAction = climate.attributes?.hvac_action || climate.state;
      }
      const light = stateOf(lightId);
      if (light) target.lightOn = light.state === 'on';
      const cover = stateOf(coverId);
      if (cover) {
        const position = Number(cover.attributes?.current_position);
        target.cover = Number.isFinite(position) ? position : cover.state === 'open' ? 100 : cover.state === 'closed' ? 0 : target.cover;
      }
    });
  }

  function haBase() {
    const raw = String(haConfig.url || '').trim().replace(/\/$/, '');
    return raw;
  }

  function hasUsableConfig() {
    return Boolean(haBase() && haConfig.token && !String(haConfig.token).includes('REPLACE_'));
  }

  async function haFetch(path, options = {}) {
    const response = await fetch(`${haBase()}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${haConfig.token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Home Assistant ${response.status}`);
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function syncHomeAssistant({ quiet = false } = {}) {
    if (!hasUsableConfig()) {
      ui.connected = false; ui.source = 'demo'; updateHeader();
      return;
    }
    if (ui.connecting) return;
    ui.connecting = true;
    try {
      const states = await haFetch('/api/states');
      ui.states = new Map(states.map((entity) => [entity.entity_id, entity]));
      ui.entityCache.clear();
      applyGlobalStates();
      applyRoomStates();
      ui.connected = true; ui.source = 'home-assistant'; ui.lastSync = new Date();
      render();
    } catch (error) {
      ui.connected = false; ui.source = 'demo';
      updateHeader();
      if (!quiet && config.demoFallback === false) toast(`Connessione HA fallita: ${error.message}`, 'ha-error');
      console.warn('[Casa 5B] Home Assistant non raggiungibile, uso dati demo.', error);
    } finally {
      ui.connecting = false;
    }
  }

  async function callService(domain, service, entityId, serviceData = {}, button = null) {
    if (!entityId || (Array.isArray(entityId) && entityId.length === 0)) { toast('Entità Home Assistant non trovata', 'ha-error'); return false; }
    if (!ui.connected) { toast('Home Assistant non collegato: comando simulato'); return false; }
    button?.classList.add('busy');
    try {
      await haFetch(`/api/services/${domain}/${service}`, { method: 'POST', body: JSON.stringify({ entity_id: entityId, ...serviceData }) });
      await new Promise((resolve) => setTimeout(resolve, 350));
      await syncHomeAssistant({ quiet: true });
      return true;
    } catch (error) {
      toast(`Comando fallito: ${error.message}`, 'ha-error');
      return false;
    } finally {
      button?.classList.remove('busy');
    }
  }

  const alarmLabel = () => data.alarmState === 'armed_away' ? 'Inserito totale' : data.alarmState === 'armed_home' ? 'Inserito notte' : data.alarmState === 'triggered' ? 'ALLARME' : data.alarmState === 'unavailable' ? 'Non disponibile' : 'Disattivato';
  const alarmClass = () => data.alarmState === 'triggered' ? 'bad' : data.alarmState === 'disarmed' ? 'ok' : 'warn';
  const lightsOn = () => rooms.filter((room) => roomStates[room.id]?.lightOn).length;
  const average = (key) => {
    const values = rooms.filter((room) => room.type !== 'outdoor').map((room) => Number(roomStates[room.id]?.[key])).filter(Number.isFinite);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };
  const shuttersAverage = () => {
    const values = rooms.map((room) => roomStates[room.id]?.cover).filter(Number.isFinite);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };
  const hvacLabel = (roomState) => {
    const mode = String(roomState.hvacMode || '').toLowerCase();
    if (mode === 'off') return 'Spento';
    if (mode.includes('heat')) return 'Riscaldamento';
    if (mode.includes('cool')) return 'Raffrescamento';
    if (mode === 'auto' || mode === 'heat_cool') return 'Automatico';
    return mode ? mode.replaceAll('_', ' ') : '—';
  };

  function solarCard(clickable = true) {
    const production = Number.isFinite(Number(data.pvPower)) ? Math.max(0, Number(data.pvPower)) : 0;
    const house = Number.isFinite(Number(data.housePower)) ? Math.max(0, Number(data.housePower)) : 0;
    const net = production - house;
    return card({ title: 'Fotovoltaico casa', value: power(production), icon: 'fa-solar-panel', cls: 'pv-card featured-card', target: clickable ? 'energy' : '', body: `
      <div class="energy-flow"><div class="flow-node solar"><i class="fa-solid fa-sun"></i><small>Produzione</small><strong>${power(production)}</strong></div><i class="fa-solid fa-arrow-right flow-arrow"></i><div class="flow-node home"><i class="fa-solid fa-house"></i><small>Casa</small><strong>${power(Math.min(production, house))}</strong></div><i class="fa-solid fa-arrow-right-arrow-left flow-arrow"></i><div class="flow-node grid"><i class="fa-solid fa-bolt"></i><small>Rete</small><strong>${net >= 0 ? '↑' : '↓'} ${power(Math.abs(net))}</strong></div></div>
      ${metrics([['Produzione oggi', energy(data.pvToday)], ['Autoconsumo', `${fmt.format(data.pvSelf)}%`], ['Prelievo', energy(data.gridImport)], ['Immissione', energy(data.gridExport)]])}` });
  }

  function houseCard(clickable = true) {
    return card({ title: 'Bilancio casa', value: power(data.housePower), icon: 'fa-gauge-high', cls: 'energy-card', target: clickable ? 'energy' : '', body: metrics([
      ['Consumo oggi', energy(data.houseToday)], ['Costo stimato', money.format(data.houseCost)], ['Picco', `${fmt.format(data.housePeak)} kW`], ['Vs ieri', `${fmt.format(data.houseVs)}%`],
    ]) });
  }

  function updateHeader() {
    const alarm = $('#alarm-pill');
    if (alarm) { alarm.className = `pill ${alarmClass()}`; alarm.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${alarmLabel()}`; }
    if ($('#internet-pill')) $('#internet-pill').innerHTML = `<i class="fa-solid fa-globe"></i> FTTH ${data.networkState}`;
    if ($('#backup-pill')) $('#backup-pill').innerHTML = `<i class="fa-solid fa-tower-cell"></i> 5G ${data.backup5gStatus}`;
    if ($('#ha-pill')) {
      const label = ui.connected ? `HA live${ui.lastSync ? ` · ${ui.lastSync.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Demo · configura token';
      $('#ha-pill').className = `pill ${ui.connected ? 'ok' : 'warn'}`;
      $('#ha-pill').innerHTML = `<span class="live-dot ${ui.connected ? '' : 'demo'}"></span>${label}`;
    }
  }

  function overviewView() {
    left.innerHTML = solarCard() + houseCard();
    right.innerHTML = card({ title: 'Comfort e stanze', value: `${fmt.format(average('temperature'))} °C`, icon: 'fa-house', target: 'rooms', body: `<div class="overview-kpis">
      <div class="overview-kpi"><i class="fa-solid fa-temperature-half"></i><small>Media interna</small><strong>${fmt.format(average('temperature'))} °C</strong></div><div class="overview-kpi"><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>${Math.round(average('humidity'))}%</strong></div><div class="overview-kpi"><i class="fa-solid fa-lightbulb"></i><small>Luci accese</small><strong>${lightsOn()}</strong></div><div class="overview-kpi"><i class="fa-solid fa-window-maximize"></i><small>Tapparelle</small><strong>${Math.round(shuttersAverage())}%</strong></div></div>` }) +
      card({ title: 'Sicurezza', value: alarmLabel(), icon: 'fa-shield-halved', target: 'security', body: `<div class="status-line"><span>Allarme</span><strong>${alarmLabel()}</strong></div><div class="status-line"><span>Videocitofono</span><strong>${stateOf(globalEntity('doorbellCamera')) ? 'Online' : 'Da configurare'}</strong></div><div class="status-line"><span>Luci accese</span><strong>${lightsOn()}</strong></div>` }) +
      card({ title: 'Internet', value: 'NULL', icon: 'fa-network-wired', cls: 'network-card', target: 'network', body: metrics([['Download', 'NULL'], ['Upload', 'NULL'], ['Dispositivi', 'NULL'], ['Uptime', 'NULL']]) });
    context.hidden = true;
  }

  function roomButton(room) {
    const roomState = roomStates[room.id];
    const hvacClass = roomState.hvacMode === 'off' ? 'off' : String(roomState.hvacMode).includes('heat') ? 'heating' : '';
    return `<button class="room-card ${room.type === 'outdoor' ? 'outdoor' : ''} ${ui.selectedRoom === room.id ? 'active' : ''}" data-room="${room.id}">
      <span class="room-icon"><i class="fa-solid ${room.icon || 'fa-door-open'}"></i></span><span class="room-main"><span class="room-name">${room.name}</span><span class="room-sub">${roomState.lightOn ? 'Luce accesa' : 'Luce spenta'}${Number.isFinite(roomState.cover) ? ` · Tapparella ${Math.round(roomState.cover)}%` : ''}${roomState.hvacMode ? ` · <span class="room-hvac ${hvacClass}">${hvacLabel(roomState)}</span>` : ''}</span></span><span class="room-temp"><strong>${fmt.format(roomState.temperature)}°</strong><small>${Math.round(roomState.humidity)}%</small></span>
    </button>`;
  }

  function roomColumn(floor) {
    const floorRooms = rooms.filter((room) => room.floor === floor);
    return card({ title: floor === 'first' ? 'Primo piano' : 'Secondo piano', value: `${floorRooms.length} ambienti`, icon: floor === 'first' ? 'fa-1' : 'fa-2', cls: 'fill scrollable compact', body: `<div class="room-list">${floorRooms.map(roomButton).join('')}</div>` });
  }

  function renderRoomContext() {
    const room = rooms.find((item) => item.id === ui.selectedRoom) || rooms[0];
    if (!room) return;
    const roomState = roomStates[room.id];
    const hasClimate = Boolean(roomState.resolved.climate || room.entities?.climate);
    context.hidden = false;
    context.innerHTML = `<div class="context-grid"><div class="context-room"><i class="fa-solid ${room.icon || 'fa-door-open'}"></i><div><strong>${room.name}</strong><small>${room.floor === 'first' ? 'Primo piano' : 'Secondo piano'}</small></div></div>
      <div class="context-metric"><small>Temperatura</small><strong>${fmt.format(roomState.temperature)} °C</strong></div><div class="context-metric"><small>Umidità</small><strong>${Math.round(roomState.humidity)}%</strong></div><div class="context-metric"><small>Luce</small><strong>${roomState.lightOn ? 'Accesa' : 'Spenta'}</strong></div><div class="context-metric"><small>Tapparella</small><strong>${Number.isFinite(roomState.cover) ? `${Math.round(roomState.cover)}%` : '—'}</strong></div>
      ${hasClimate ? `<div class="context-climate"><button data-action="climate-down" data-room="${room.id}" title="Riduci setpoint"><i class="fa-solid fa-minus"></i></button><strong>${Number.isFinite(roomState.targetTemperature) ? `${fmt.format(roomState.targetTemperature)} °C` : '—'}</strong><button data-action="climate-up" data-room="${room.id}" title="Aumenta setpoint"><i class="fa-solid fa-plus"></i></button><button data-action="climate-power" data-room="${room.id}" class="${roomState.hvacMode !== 'off' ? 'active' : ''}" title="Accendi o spegni"><i class="fa-solid fa-power-off"></i></button><small>${hvacLabel(roomState)}</small></div>` : ''}
      <div class="context-actions"><button data-action="room-light" data-room="${room.id}" class="${roomState.lightOn ? 'active' : ''}" title="Luce"><i class="fa-solid fa-lightbulb"></i></button>${Number.isFinite(roomState.cover) ? `<button data-action="room-cover-open" data-room="${room.id}" title="Apri tapparella"><i class="fa-solid fa-arrow-up"></i></button><button data-action="room-cover-stop" data-room="${room.id}" title="Stop"><i class="fa-solid fa-stop"></i></button><button data-action="room-cover-close" data-room="${room.id}" title="Chiudi tapparella"><i class="fa-solid fa-arrow-down"></i></button>` : ''}</div></div>`;
  }

  function roomsView() { left.innerHTML = roomColumn('first'); right.innerHTML = roomColumn('second'); renderRoomContext(); }

  function energyView() {
    const appliances = sum(data.washerPower, data.dryerPower, data.ovenPower, data.fridgePower, data.dishwasherPower);
    const tv = sum(data.tvPower, data.shieldPower, data.mediaPcPower, data.hddPower);
    const studio = sum(data.pcPower, data.monitorPower, data.ps5Power, data.dockPower);
    const shellyPeriods = {
      today: finiteValue(data.heatPumpToday) && finiteValue(data.inductionToday) ? sum(data.heatPumpToday, data.inductionToday) : null,
      yesterday: finiteValue(data.heatPumpYesterday) && finiteValue(data.inductionYesterday) ? sum(data.heatPumpYesterday, data.inductionYesterday) : null,
      month: finiteValue(data.heatPumpMonth) && finiteValue(data.inductionMonth) ? sum(data.heatPumpMonth, data.inductionMonth) : null,
    };
    const appliancePeriods = { today:null, yesterday:null, month:null };
    const technologyPeriods = { today:null, yesterday:null, month:null };

    left.innerHTML = solarCard(false) + houseCard(false);
    right.innerHTML =
      card({ title: 'Linee Shelly', value: power(sum(data.heatPumpPower, data.inductionPower)), icon: 'fa-bolt-lightning', cls: 'shelly-card', body:
        metrics([['Pompa di calore', power(data.heatPumpPower)], ['Induzione', power(data.inductionPower)]]) + energyPeriodStrip('shelly', shellyPeriods) }) +
      card({ title: 'Elettrodomestici', value: power(appliances), icon: 'fa-plug', cls: 'appliances-card', body:
        metrics([['Lavatrice', power(data.washerPower)], ['Asciugatrice', power(data.dryerPower)], ['Forno', power(data.ovenPower)], ['Frigorifero', power(data.fridgePower)], ['Lavastoviglie', power(data.dishwasherPower)]]) + energyPeriodStrip('appliances', appliancePeriods) }) +
      card({ title: 'Tecnologia', value: power(tv + studio), icon: 'fa-microchip', cls: 'tech-card', body:
        `<div class="tech-groups">${technologyGroup('zona-tv', 'ZONA TV', 'fa-tv', tv, [
          ['tvPower','TV',data.tvPower], ['shieldPower','Nvidia Shield',data.shieldPower], ['mediaPcPower','Mini PC',data.mediaPcPower], ['hddPower','HDD',data.hddPower],
        ])}${technologyGroup('studio-gaming', 'Studio / gaming', 'fa-gamepad', studio, [
          ['pcPower','PC',data.pcPower], ['monitorPower','Monitor',data.monitorPower], ['ps5Power','PS5',data.ps5Power], ['dockPower','Splitter',data.dockPower],
        ])}</div>` + energyPeriodStrip('technology', technologyPeriods) });
    context.hidden = true;
  }

  function networkView() {
    const nullMetrics = (items) => metrics(items.map((label) => [label, 'NULL']));
    left.innerHTML =
      card({ title: 'FRITZ!Box 7690 · FTTH', value: 'NULL', icon: 'fa-router', cls: 'network-card modern-network-card', body: nullMetrics(['Link download', 'Link upload', 'Traffico download', 'Traffico upload']) }) +
      card({ title: 'Connessione WAN', value: 'NULL', icon: 'fa-globe', cls: 'network-card modern-network-card', body: nullMetrics(['IP esterno', 'Uptime connessione', 'Temperatura CPU', 'Uptime FRITZ!Box']) });
    right.innerHTML =
      card({ title: 'Dispositivi connessi', value: 'NULL', icon: 'fa-laptop-house', cls: 'network-card modern-network-card', body: nullMetrics(['Totale online', 'Dati ricevuti', 'Dati inviati', 'Stato WAN']) }) +
      card({ title: 'Riepilogo linea', value: 'NULL', icon: 'fa-network-wired', cls: 'network-card modern-network-card', body: nullMetrics(['Download massimo', 'Upload massimo', 'Download attuale', 'Upload attuale']) });
    context.hidden = true;
  }

  function securityView() {
    const firstLights = rooms.filter((room) => room.floor === 'first' && roomStates[room.id].lightOn).length;
    const secondLights = rooms.filter((room) => room.floor === 'second' && roomStates[room.id].lightOn).length;
    const motorized = rooms.filter((room) => Number.isFinite(roomStates[room.id].cover)).length;
    left.innerHTML = card({ title: 'Allarme', value: alarmLabel(), icon: 'fa-shield-halved', body: `<div class="security-grid"><div class="security-tile"><i class="fa-solid fa-shield-halved"></i><small>Stato</small><strong>${alarmLabel()}</strong></div><div class="security-tile"><i class="fa-solid fa-house-lock"></i><small>Modalità</small><strong>${data.alarmState === 'armed_home' ? 'Notte' : 'Casa'}</strong></div></div><div class="card-actions"><button data-action="alarm-home">Notte</button><button data-action="alarm-away">Totale</button><button class="danger" data-action="alarm-disarm">Disattiva</button></div>` }) + card({ title: 'Videocitofono', value: stateOf(globalEntity('doorbellCamera')) ? 'Online' : 'Da configurare', icon: 'fa-video', body: `<div class="intercom-preview"><i class="fa-solid fa-video"></i><strong>Ingresso principale</strong><small>${data.doorbellLastEvent}</small></div><div class="card-actions"><button class="primary" data-action="open-intercom"><i class="fa-solid fa-video"></i> Apri video</button><button data-action="open-gate"><i class="fa-solid fa-door-open"></i> Cancello</button></div>` });
    right.innerHTML = card({ title: 'Luci', value: `${lightsOn()} accese`, icon: 'fa-lightbulb', body: `${metrics([['Primo piano', firstLights], ['Secondo piano', secondLights], ['Totale stanze', rooms.length], ['Stato', lightsOn() ? 'Attive' : 'Tutte spente']])}<div class="card-actions"><button data-action="lights-off-all"><i class="fa-solid fa-lightbulb"></i> Spegni tutte</button></div>` }) + card({ title: 'Tapparelle', value: `${Math.round(shuttersAverage())}%`, icon: 'fa-window-maximize', body: `${metrics([['Apertura media', `${Math.round(shuttersAverage())}%`], ['Motorizzate', motorized], ['Aperte', rooms.filter((room) => Number(roomStates[room.id].cover) > 80).length], ['Chiuse', rooms.filter((room) => Number(roomStates[room.id].cover) < 10).length]])}<div class="card-actions"><button data-action="covers-open-all"><i class="fa-solid fa-arrow-up"></i> Apri tutte</button><button data-action="covers-stop-all"><i class="fa-solid fa-stop"></i> Stop</button><button class="danger" data-action="covers-close-all"><i class="fa-solid fa-arrow-down"></i> Chiudi tutte</button></div>` });
    context.hidden = true;
  }

  function render() {
    updateHeader();
    const titles = { overview: 'Panoramica', rooms: 'Stanze', energy: 'Energia', network: 'Rete', security: 'Sicurezza' };
    if ($('#view-title')) $('#view-title').textContent = titles[ui.view] || 'Panoramica';
    document.querySelectorAll('.view-nav [data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === ui.view));
    if (markerLayer) markerLayer.hidden = true;
    ({ overview: overviewView, rooms: roomsView, energy: energyView, network: networkView, security: securityView }[ui.view] || overviewView)();
  }

  function openIntercom() {
    const cameraId = globalEntity('doorbellCamera');
    const camera = stateOf(cameraId);
    const dialog = $('#intercom-modal');
    const video = $('#intercom-video');
    if (video && camera && haBase()) {
      const picture = camera.attributes?.entity_picture;
      if (picture) video.innerHTML = `<img src="${haBase()}${picture}" alt="Videocitofono" style="width:100%;height:100%;object-fit:cover"><span id="intercom-status">Flusso Home Assistant</span>`;
    }
    if (dialog?.showModal) dialog.showModal(); else toast('Videocitofono aperto');
  }

  function controlledShutterEntities() {
    const exact = window.CASA_SHUTTERS?.resolved?.map((item) => item.entity_id).filter(Boolean) || [];
    if (exact.length) return exact;
    return rooms.map((room) => roomStates[room.id].resolved.cover).filter(Boolean);
  }

  async function runAction(action, roomId, button) {
    const roomState = roomStates[roomId];
    const resolved = roomState?.resolved || {};
    if (action === 'room-light' && roomState) {
      if (await callService('light', 'toggle', resolved.lights, {}, button)) roomState.lightOn = !roomState.lightOn;
      else if (!ui.connected) roomState.lightOn = !roomState.lightOn;
    } else if (action === 'room-cover-open' && roomState) await callService('cover', 'open_cover', resolved.cover, {}, button);
    else if (action === 'room-cover-close' && roomState) await callService('cover', 'close_cover', resolved.cover, {}, button);
    else if (action === 'room-cover-stop' && roomState) await callService('cover', 'stop_cover', resolved.cover, {}, button);
    else if (action === 'climate-up' && roomState) await setClimateTemperature(roomState, number(roomState.targetTemperature, roomState.temperature) + 0.5, button);
    else if (action === 'climate-down' && roomState) await setClimateTemperature(roomState, number(roomState.targetTemperature, roomState.temperature) - 0.5, button);
    else if (action === 'climate-power' && roomState) await callService('climate', roomState.hvacMode === 'off' ? 'turn_on' : 'turn_off', resolved.climate, {}, button);
    else if (action === 'covers-open-all') await callService('cover', 'open_cover', controlledShutterEntities(), {}, button);
    else if (action === 'covers-close-all') await callService('cover', 'close_cover', controlledShutterEntities(), {}, button);
    else if (action === 'covers-stop-all') await callService('cover', 'stop_cover', controlledShutterEntities(), {}, button);
    else if (action === 'lights-off-all') await callService('light', 'turn_off', globalEntity('allLights', false) || rooms.map((room) => roomStates[room.id].resolved.lights).filter(Boolean), {}, button);
    else if (action === 'alarm-home') await callService('alarm_control_panel', 'alarm_arm_home', globalEntity('alarm'), {}, button);
    else if (action === 'alarm-away') await callService('alarm_control_panel', 'alarm_arm_away', globalEntity('alarm'), {}, button);
    else if (action === 'alarm-disarm') await callService('alarm_control_panel', 'alarm_disarm', globalEntity('alarm'), {}, button);
    else if (action === 'open-intercom') openIntercom();
    else if (action === 'open-gate') await callService('button', 'press', globalEntity('gateButton'), {}, button);
    render();
  }

  async function setClimateTemperature(roomState, temperature, button) {
    const clamped = Math.max(10, Math.min(30, Math.round(temperature * 2) / 2));
    if (await callService('climate', 'set_temperature', roomState.resolved.climate, { temperature: clamped }, button)) roomState.targetTemperature = clamped;
    else if (!ui.connected) roomState.targetTemperature = clamped;
  }

  document.addEventListener('toggle', (event) => {
    const details = event.target.closest?.('details[data-tech-group]');
    if (!details) return;
    if (details.open) techOpenGroups.add(details.dataset.techGroup);
    else techOpenGroups.delete(details.dataset.techGroup);
  }, true);

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-view]');
    if (nav) { ui.view = nav.dataset.view; render(); return; }
    const targetCard = event.target.closest('[data-view-target]');
    if (targetCard) { ui.view = targetCard.dataset.viewTarget; render(); return; }
    const roomNode = event.target.closest('[data-room]');
    if (roomNode && !event.target.closest('[data-action]')) { ui.selectedRoom = roomNode.dataset.room; ui.view = 'rooms'; render(); return; }
    const actionNode = event.target.closest('[data-action]');
    if (actionNode) runAction(actionNode.dataset.action, actionNode.dataset.room, actionNode);
  });

  document.addEventListener('keydown', (event) => {
    const cardNode = event.target.closest('[data-view-target]');
    if (cardNode && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); ui.view = cardNode.dataset.viewTarget; render(); }
  });

  $('#close-intercom')?.addEventListener('click', () => $('#intercom-modal')?.close());
  const loading = $('#loading');
  if (loading) loading.style.pointerEvents = 'none';
  window.CASA_DASHBOARD_READY = 'live-v46';
  window.CASA_HA = { sync: syncHomeAssistant, service: callService, state: ui };
  render();
  syncHomeAssistant();
  refreshTimer = setInterval(() => syncHomeAssistant({ quiet: true }), Math.max(2000, number(config.refreshMs, 5000)));
  window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
})();
