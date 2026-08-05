/**
 * Casa 5B - bundle applicativo consolidato
 * Generato il 2026-08-05 dalla versione locale del sito.
 * Contiene dashboard, integrazione Home Assistant, rete, energia,
 * stanze, correzioni UI, navigazione e applicazione 3D.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/* ===== network-render-guard-v56.js ===== */
(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const FRITZ_STORAGE_KEY = 'casa-fritzbox-stable-data';
  const MONITOR_STORAGE_KEY = 'casa-network-monitor-last-status';
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch (_error) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Funziona anche quando localStorage non è disponibile.
    }
  }

  let stable = {
    wan: 'Connesso',
    maxDown: '2,5 Gbit/s',
    maxUp: '2,5 Gbit/s',
    currentDown: NULL_TEXT,
    currentUp: NULL_TEXT,
    devices: NULL_TEXT,
    uptimeConnection: NULL_TEXT,
    ...readJson(FRITZ_STORAGE_KEY),
  };

  function monitorState() {
    return window.CASA_NETWORK_MONITOR || readJson(MONITOR_STORAGE_KEY) || null;
  }

  function activeLink() {
    return normalize(monitorState()?.link || 'primary');
  }

  function effectiveRate() {
    return activeLink() === 'backup' ? '1 Gbit/s' : '2,5 Gbit/s';
  }

  function validValue(value) {
    const text = String(value ?? '').trim();
    return Boolean(text && normalize(text) !== 'null');
  }

  function mergeStable(source) {
    if (!source || typeof source !== 'object') return;
    const next = { ...stable };
    Object.entries(source).forEach(([key, value]) => {
      if (validValue(value)) next[key] = value;
    });
    next.maxDown = effectiveRate();
    next.maxUp = effectiveRate();
    stable = next;
    window.CASA_FRITZBOX_STABLE = stable;
    writeJson(FRITZ_STORAGE_KEY, stable);
  }

  function stateMap() {
    return window.CASA_HA?.state?.states instanceof Map
      ? window.CASA_HA.state.states
      : new Map();
  }

  function validEntity(entity) {
    return Boolean(entity && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state)));
  }

  function findTrafficEntity(direction) {
    const wanted = direction === 'download'
      ? 'velocita effettiva di scaricamento'
      : 'velocita effettiva di caricamento';
    let best = null;
    let bestScore = -1;

    for (const entity of stateMap().values()) {
      if (!validEntity(entity) || !entity.entity_id.startsWith('sensor.')) continue;
      const friendly = normalize(entity.attributes?.friendly_name);
      const entityId = normalize(entity.entity_id);
      const text = `${friendly} ${entityId}`;
      if (!text.includes(wanted)) continue;
      if (text.includes('massima') || text.includes('pacchetti')) continue;

      let score = 100;
      if (friendly === wanted) score += 30;
      if (text.includes('fritz')) score += 15;
      if (text.includes('7690')) score += 10;
      if (score > bestScore) {
        bestScore = score;
        best = entity;
      }
    }
    return best;
  }

  function rawRate(entity) {
    if (!validEntity(entity)) return NULL_TEXT;
    const raw = String(entity.state ?? '').trim();
    const numeric = Number(raw.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    const unit = String(entity.attributes?.unit_of_measurement || '').trim();
    if (!Number.isFinite(numeric)) return unit ? `${raw} ${unit}` : raw;
    return unit ? `${fmt.format(numeric)} ${unit}` : fmt.format(numeric);
  }

  function refreshStableData() {
    mergeStable(window.CASA_FRITZBOX);

    const download = rawRate(findTrafficEntity('download'));
    const upload = rawRate(findTrafficEntity('upload'));
    mergeStable({ currentDown: download, currentUp: upload });
  }

  function findCard(root, title, startsWith = false) {
    const wanted = normalize(title);
    return [...root.querySelectorAll('.card')].find((card) => {
      const current = normalize(card.querySelector('.card-head .title')?.textContent);
      return startsWith ? current.startsWith(wanted) : current === wanted;
    }) || null;
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((item) =>
      normalize(item.querySelector('small')?.textContent) === wanted
    );
    return row?.querySelector('strong') || null;
  }

  function setText(node, value) {
    if (!node || !validValue(value)) return;
    if (node.textContent !== value) node.textContent = value;
    node.classList.remove('ha-null-value');
  }

  function patchInternet(root) {
    const card = findCard(root, 'Internet');
    if (!card) return;
    setText(card.querySelector('.card-head > strong'), stable.wan);
    setText(metricNode(card, 'Download'), effectiveRate());
    setText(metricNode(card, 'Upload'), effectiveRate());
    setText(metricNode(card, 'Dispositivi'), stable.devices);
    setText(metricNode(card, 'Uptime'), stable.uptimeConnection);
  }

  function patchFritz(root) {
    const card = findCard(root, 'FRITZ Box 7690', true);
    if (!card) return;
    setText(metricNode(card, 'Link download'), effectiveRate());
    setText(metricNode(card, 'Link upload'), effectiveRate());
    setText(metricNode(card, 'Traffico download'), stable.currentDown);
    setText(metricNode(card, 'Traffico upload'), stable.currentUp);
  }

  function patchRoot(root) {
    if (!root) return;
    patchInternet(root);
    patchFritz(root);
  }

  function transformHtml(html) {
    if (typeof html !== 'string' || !html.includes('class="card')) return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    patchRoot(template.content);
    return template.innerHTML;
  }

  function protectInnerHtml(element) {
    if (!element || element.dataset.networkRenderGuard === '1') return;
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!descriptor?.get || !descriptor?.set) return;

    Object.defineProperty(element, 'innerHTML', {
      configurable: true,
      enumerable: false,
      get() {
        return descriptor.get.call(this);
      },
      set(value) {
        refreshStableData();
        descriptor.set.call(this, transformHtml(value));
      },
    });
    element.dataset.networkRenderGuard = '1';
  }

  const left = document.querySelector('#left-rail');
  const right = document.querySelector('#right-rail');
  protectInnerHtml(left);
  protectInnerHtml(right);

  function apply() {
    refreshStableData();
    patchRoot(document);
  }

  const observer = new MutationObserver(apply);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  const timer = setInterval(apply, 500);

  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  apply();
})();

/* ===== dashboard-v38.js ===== */
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
      if (room.id === 'second-mansarda' && ['temperature','climate'].includes(key) && /(?:camera|bagno|vano tecnico|locale tecnico) mansarda/.test(text)) continue;
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
  window.CASA_HA = { sync: syncHomeAssistant, service: callService, fetch: haFetch, state: ui };
  render();
  syncHomeAssistant();
  refreshTimer = setInterval(() => syncHomeAssistant({ quiet: true }), Math.max(2000, number(config.refreshMs, 5000)));
  window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
})();

/* ===== ha-data-guard-v41.js ===== */
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
    // Fotovoltaico, linee Shelly, elettrodomestici e tecnologia sono gestiti
    // dal resolver energetico, che distingue correttamente 0 da dato assente.
    patchHeader('Bilancio casa', 'housePower');
    patchMetric('Bilancio casa', 'Consumo oggi', 'houseToday');
    patchMetric('Bilancio casa', 'Costo stimato', 'houseCost');
    patchMetric('Bilancio casa', 'Picco', 'housePeak');
    patchMetric('Bilancio casa', 'Vs ieri', 'houseVsYesterday');

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

/* ===== null-fallback-v40.js ===== */
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
      if (room?.id === 'second-mansarda' && ['temperature','climate'].includes(key) && /(?:camera|bagno|vano tecnico|locale tecnico) mansarda/.test(text)) continue;
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

/* ===== remove-humidity-v42.js ===== */
(() => {
  'use strict';

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function removeHumidity() {
    document.querySelectorAll('.overview-kpi, .context-metric, .metric-grid > div, .status-line').forEach((node) => {
      const label = node.querySelector('small, span');
      if (normalize(label?.textContent) === 'umidita') node.remove();
    });

    document.querySelectorAll('.room-temp small').forEach((node) => node.remove());
  }

  const observer = new MutationObserver(removeHumidity);
  observer.observe(document.body, { childList: true, subtree: true });
  removeHumidity();
})();

/* ===== shelly-appliances-v43.js ===== */
(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const config = window.CASA_DASHBOARD_CONFIG || {};
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  let scheduled = false;

  const DEVICES = {
    heatPump: {
      label: 'Pompa di calore', powerKey: 'heatPumpPower',
      todayKey: 'heatPumpToday', yesterdayKey: 'heatPumpYesterday', monthKey: 'heatPumpMonth',
      aliases: ['pompa di calore', 'heat pump', 'pdc']
    },
    induction: {
      label: 'Induzione', powerKey: 'inductionPower',
      todayKey: 'inductionToday', yesterdayKey: 'inductionYesterday', monthKey: 'inductionMonth',
      aliases: ['induzione', 'piano induzione', 'induction']
    },
    washer: {
      label: 'Lavatrice', powerKey: 'washerPower',
      todayKey: 'washerToday', yesterdayKey: 'washerYesterday', monthKey: 'washerMonth',
      aliases: ['lavatrice', 'washing machine', 'washer']
    },
    dryer: {
      label: 'Asciugatrice', powerKey: 'dryerPower',
      todayKey: 'dryerToday', yesterdayKey: 'dryerYesterday', monthKey: 'dryerMonth',
      aliases: ['asciugatrice', 'tumble dryer', 'dryer']
    },
    oven: {
      label: 'Forno', powerKey: 'ovenPower',
      todayKey: 'ovenToday', yesterdayKey: 'ovenYesterday', monthKey: 'ovenMonth',
      aliases: ['forno', 'oven']
    },
    fridge: {
      label: 'Frigorifero', powerKey: 'fridgePower',
      todayKey: 'fridgeToday', yesterdayKey: 'fridgeYesterday', monthKey: 'fridgeMonth',
      aliases: ['frigorifero', 'frigo congelatore', 'frigo', 'congelatore', 'fridge freezer', 'fridge', 'freezer']
    },
    dishwasher: {
      label: 'Lavastoviglie', powerKey: 'dishwasherPower',
      todayKey: 'dishwasherToday', yesterdayKey: 'dishwasherYesterday', monthKey: 'dishwasherMonth',
      aliases: ['lavastoviglie', 'lavapiatti', 'dishwasher']
    },
    tv: {
      label: 'TV', powerKey: 'tvPower', todayKey: 'tvToday', yesterdayKey: 'tvYesterday', monthKey: 'tvMonth',
      aliases: ['tv', 'televisore', 'smart tv', 'samsung tv']
    },
    shield: {
      label: 'Nvidia Shield', powerKey: 'shieldPower',
      todayKey: 'shieldToday', yesterdayKey: 'shieldYesterday', monthKey: 'shieldMonth',
      aliases: ['nvidia shield', 'shield tv', 'shield']
    },
    mediaPc: {
      label: 'Mini PC', powerKey: 'mediaPcPower',
      todayKey: 'mediaPcToday', yesterdayKey: 'mediaPcYesterday', monthKey: 'mediaPcMonth',
      aliases: ['mini pc', 'minipc', 'media mini pc']
    },
    hdd: {
      label: 'HDD', powerKey: 'hddPower', todayKey: 'hddToday', yesterdayKey: 'hddYesterday', monthKey: 'hddMonth',
      aliases: ['hdd', 'hard disk', 'disco esterno']
    },
    pc: {
      label: 'PC', powerKey: 'pcPower', todayKey: 'pcToday', yesterdayKey: 'pcYesterday', monthKey: 'pcMonth',
      aliases: ['pc', 'pc studio', 'computer studio', 'office pc', 'desktop pc'],
      exclude: ['mini pc', 'minipc', 'media pc']
    },
    monitor: {
      label: 'Monitor', powerKey: 'monitorPower',
      todayKey: 'monitorToday', yesterdayKey: 'monitorYesterday', monthKey: 'monitorMonth',
      aliases: ['monitor', 'monitor studio', 'office monitor']
    },
    ps5: {
      label: 'PS5', powerKey: 'ps5Power', todayKey: 'ps5Today', yesterdayKey: 'ps5Yesterday', monthKey: 'ps5Month',
      aliases: ['ps 5', 'ps5', 'playstation 5', 'playstation5']
    },
    dock: {
      label: 'Splitter', powerKey: 'dockPower', todayKey: 'dockToday', yesterdayKey: 'dockYesterday', monthKey: 'dockMonth',
      aliases: ['splitter', 'dock studio', 'office dock', 'dock']
    },
  };

  const GROUPS = {
    shelly: ['heatPump', 'induction'],
    appliances: ['washer', 'dryer', 'oven', 'fridge', 'dishwasher'],
    technology: ['tv', 'shield', 'mediaPc', 'hdd', 'pc', 'monitor', 'ps5', 'dock'],
  };

  // Totali energetici deterministici per le card Casa 3D.
  // Oggi = stato helper giornaliero; Ieri = last_period del giornaliero;
  // Mese = stato helper mensile. Nessun riconoscimento automatico o fallback storico.
  const GROUP_PERIOD_HELPERS = {
    appliances: {
      washer: {
        daily: 'sensor.vano_tecnico_shelly_plug_lavatrice_lavatrice_energia_giornaliera',
        monthly: 'sensor.vano_tecnico_shelly_plug_lavatrice_lavatrice_energia_mensile',
      },
      dishwasher: {
        daily: 'sensor.cucina_shelly_plug_lavastoviglie_lavastoviglie_energia_giornaliera',
        monthly: 'sensor.cucina_shelly_plug_lavastoviglie_lavastoviglie_energia_mensile',
      },
      fridge: {
        daily: 'sensor.cucina_shelly_plug_frigo_frigo_energia_giornaliera',
        monthly: 'sensor.cucina_shelly_plug_frigo_frigo_energia_mensile',
      },
      oven: {
        daily: 'sensor.cucina_shelly_plug_forno_forno_energia_giornaliera',
        monthly: 'sensor.cucina_shelly_plug_forno_forno_energia_mensile',
      },
      dryer: {
        daily: 'sensor.vano_tecnico_shelly_plug_asciugatrice_asciugatrice_energia_giornaliera',
        monthly: 'sensor.vano_tecnico_shelly_plug_asciugatrice_asciugatrice_energia_mensile',
      },
    },
    technology: {
      tv: {
        daily: 'sensor.salotto_tv_energia_giornaliera',
        monthly: 'sensor.salotto_tv_energia_mensile',
      },
      dock: {
        daily: 'sensor.studio_splitter_energia_giornaliera',
        monthly: 'sensor.studio_splitter_energia_mensile',
      },
      ps5: {
        daily: 'sensor.studio_ps_5_ps5_energia_giornaliera',
        monthly: 'sensor.studio_ps_5_ps5_energia_mensile',
      },
      pc: {
        daily: 'sensor.studio_pc_energia_giornaliera',
        monthly: 'sensor.studio_pc_energia_mensile',
      },
      shield: {
        daily: 'sensor.salotto_nvidia_shield_shield_energia_giornaliera',
        monthly: 'sensor.salotto_nvidia_shield_shield_energia_mensile',
      },
      monitor: {
        daily: 'sensor.studio_monitor_energia_giornaliera',
        monthly: 'sensor.studio_monitor_energia_mensile',
      },
      mediaPc: {
        daily: 'sensor.salotto_mini_pc_energia_giornaliera',
        monthly: 'sensor.salotto_mini_pc_energia_mensile',
      },
      hdd: {
        daily: 'sensor.salotto_hdd_energia_giornaliera',
        monthly: 'sensor.salotto_hdd_energia_mensile',
      },
    },
  };

  const FRONIUS = {
    acPower: {
      type: 'power',
      labels: ['potenza alternata', 'potenza ca', 'ac power', 'inverter ac power', 'potenza inverter', 'inverter power', 'fronius power'],
      exclude: ['carico', 'load', 'rete', 'grid', 'batteria', 'battery']
    },
    pvPower: {
      type: 'power',
      labels: ['potenza fotovoltaica', 'potenza fotovoltaico', 'power photovoltaics', 'photovoltaic power', 'pv power', 'solar power', 'produzione fotovoltaica', 'potenza pannelli', 'dc power'],
      exclude: ['carico', 'load', 'rete', 'grid', 'batteria', 'battery']
    },
    dayEnergy: { type: 'energy', labels: ['energia giornaliera', 'daily energy', 'energy day', 'day energy', 'produzione giornaliera', 'energia oggi', 'fronius today'] },
    yearEnergy: { type: 'energy', labels: ['energia annuale', 'yearly energy', 'annual energy', 'energy year', 'produzione annuale'] },
    totalEnergy: { type: 'energy', labels: ['energia totale', 'total energy', 'lifetime energy', 'produzione totale'] },
  };

  const PERIOD_WORDS = {
    today: ['oggi', 'today', 'daily', 'giornaliera', 'giornaliero', 'day energy'],
    yesterday: ['ieri', 'yesterday', 'previous day', 'giorno precedente'],
    month: ['mese', 'mensile', 'month', 'monthly'],
  };

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const compact = (value) => normalize(value).replace(/\s+/g, '');

  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();
  const connected = () => window.CASA_HA?.state?.connected === true;
  const valid = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(normalize(entity.state))
  );

  function configuredCandidates(key) {
    const configured = config.entities?.[key];
    return (Array.isArray(configured) ? configured : [configured]).filter(Boolean);
  }

  function entityParts(entity) {
    const entityName = normalize(String(entity?.entity_id || '').replace(/^[^.]+\./, ''));
    const friendly = normalize(entity?.attributes?.friendly_name);
    const text = normalize([
      entityName, friendly, entity?.attributes?.device_class,
      entity?.attributes?.unit_of_measurement, entity?.attributes?.icon,
    ].filter(Boolean).join(' '));
    return { entityName, friendly, text };
  }

  function isPowerSensor(entity) {
    if (!valid(entity) || !String(entity.entity_id || '').startsWith('sensor.')) return false;
    if (!Number.isFinite(Number(entity.state))) return false;
    const { text } = entityParts(entity);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    const deviceClass = normalize(entity.attributes?.device_class);
    const positive = deviceClass === 'power' || ['w', 'kw', 'mw'].includes(unit) || /(^| )(power|potenza)( |$)/.test(text);
    const negative = ['energy','energia','kwh','wh','mwh','voltage','tensione','current','corrente','frequency','frequenza','power factor'].some((word) => text.includes(word));
    return positive && !negative;
  }

  function isEnergySensor(entity) {
    if (!valid(entity) || !String(entity.entity_id || '').startsWith('sensor.')) return false;
    if (!Number.isFinite(Number(entity.state)) && !Number.isFinite(Number(entity.attributes?.last_period))) return false;
    const unit = normalize(entity.attributes?.unit_of_measurement);
    const deviceClass = normalize(entity.attributes?.device_class);
    return deviceClass === 'energy' || ['wh','kwh','mwh'].includes(unit);
  }

  function aliasScore(value, alias) {
    const normalizedValue = normalize(value);
    const normalizedAlias = normalize(alias);
    if (!normalizedValue || !normalizedAlias) return 0;
    if (normalizedValue === normalizedAlias) return 110;
    if (compact(normalizedValue) === compact(normalizedAlias)) return 106;
    const suffixes = ['power','potenza','energy','energia','consumo','presa','plug','switch'];
    if (suffixes.some((suffix) => normalizedValue === `${normalizedAlias} ${suffix}`)) return 100;
    const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^| )${escaped}( |$)`).test(normalizedValue)) return normalizedAlias.length <= 2 ? 78 : 90;
    if (compact(normalizedAlias).length >= 3 && compact(normalizedValue).includes(compact(normalizedAlias))) return 72;
    return 0;
  }

  function deviceScore(entity, device) {
    const parts = entityParts(entity);
    if ((device.exclude || []).some((term) => parts.text.includes(normalize(term)))) return 0;
    let score = 0;
    for (const alias of device.aliases) {
      score = Math.max(score, aliasScore(parts.friendly, alias), aliasScore(parts.entityName, alias) - 4);
    }
    if (parts.text.includes('shelly')) score += 5;
    if (parts.text.includes('plug') || parts.text.includes('presa')) score += 3;
    return score;
  }

  function resolvePower(device) {
    const map = states();
    for (const entityId of configuredCandidates(device.powerKey)) {
      const entity = map.get(entityId);
      if (isPowerSensor(entity)) return entity;
    }
    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!isPowerSensor(entity)) continue;
      const score = deviceScore(entity, device);
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 72 ? best : null;
  }

  function periodScore(entity, period) {
    const text = entityParts(entity).text;
    const words = PERIOD_WORDS[period] || [];
    let score = words.reduce((total, word) => total + (text.includes(normalize(word)) ? (word.includes(' ') ? 18 : 12) : 0), 0);
    if (period === 'today' && ['ieri','yesterday','mese','month','annuale','yearly','totale','total'].some((word) => text.includes(word))) score -= 40;
    if (period === 'yesterday' && !['ieri','yesterday','previous day','giorno precedente'].some((word) => text.includes(normalize(word)))) score -= 50;
    if (period === 'month' && ['anno','year','totale','total'].some((word) => text.includes(word))) score -= 35;
    return score;
  }

  function utilityMeterPeriod(entity) {
    const text = entityParts(entity).text;
    const attrs = entity?.attributes || {};
    const meter = normalize(attrs.meter_period || attrs.period || attrs.cycle || attrs.tariff);
    const lastReset = Date.parse(attrs.last_reset || attrs.last_reset_time || '');
    const reset = Number.isFinite(lastReset) ? new Date(lastReset) : null;
    if (meter.includes('day') || meter.includes('giorn')) return 'today';
    if (meter.includes('month') || meter.includes('mese')) return 'month';
    if (reset) {
      const now = new Date();
      if (reset.getFullYear() === now.getFullYear() && reset.getMonth() === now.getMonth() && reset.getDate() === now.getDate()) return 'today';
      if (reset.getFullYear() === now.getFullYear() && reset.getMonth() === now.getMonth() && reset.getDate() === 1) return 'month';
    }
    if (Number.isFinite(Number(attrs.last_period)) && ['utility meter','utility_meter'].some((word) => text.includes(normalize(word)))) return 'today';
    return null;
  }

  function hasPeriodEvidence(entity, period) {
    const text = entityParts(entity).text;
    const words = PERIOD_WORDS[period] || [];
    if (words.some((word) => text.includes(normalize(word)))) return true;
    if (period === 'today' || period === 'month') return utilityMeterPeriod(entity) === period;
    return false;
  }

  function resolveEnergy(device, period) {
    const key = period === 'today' ? device.todayKey : period === 'yesterday' ? device.yesterdayKey : device.monthKey;
    const map = states();
    for (const entityId of configuredCandidates(key)) {
      const entity = map.get(entityId);
      if (isEnergySensor(entity)) return entity;
    }

    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!isEnergySensor(entity) || !hasPeriodEvidence(entity, period)) continue;
      const score = deviceScore(entity, device) + periodScore(entity, period);
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 88 ? best : null;
  }

  function watts(entity) {
    if (!isPowerSensor(entity)) return null;
    const value = Number(entity.state);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    if (unit === 'kw') return value * 1000;
    if (unit === 'mw') return value * 1000000;
    return value;
  }

  function energyKwh(entity, rawValue = entity?.state) {
    if (!isEnergySensor(entity) || !Number.isFinite(Number(rawValue))) return null;
    const value = Number(rawValue);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    if (unit === 'wh') return value / 1000;
    if (unit === 'mwh') return value * 1000;
    return value;
  }

  function periodValue(device, period) {
    if (period === 'yesterday') {
      const direct = resolveEnergy(device, 'yesterday');
      if (direct) return { entity: direct, value: energyKwh(direct, direct.state) };
      const daily = resolveEnergy(device, 'today');
      if (daily && Number.isFinite(Number(daily.attributes?.last_period))) {
        return { entity: daily, value: energyKwh(daily, daily.attributes.last_period) };
      }
      return { entity: null, value: null };
    }
    const entity = resolveEnergy(device, period);
    return { entity, value: energyKwh(entity) };
  }

  const historyCache = new Map();

  function resolveCumulativeEnergy(device) {
    let best = null;
    let bestScore = 0;
    for (const entity of states().values()) {
      if (!isEnergySensor(entity)) continue;
      const parts = entityParts(entity);
      if (Object.values(PERIOD_WORDS).flat().some((word) => parts.text.includes(normalize(word)))) continue;
      if (['anno','year','totale giornaliero','daily total'].some((word) => parts.text.includes(normalize(word)))) continue;
      let score = deviceScore(entity, device);
      const stateClass = normalize(entity.attributes?.state_class);
      if (stateClass === 'total increasing' || stateClass === 'total_increasing') score += 24;
      else if (stateClass === 'total') score += 12;
      if (parts.text.includes('total energy') || parts.text.includes('energia totale') || parts.text.includes('consumo totale')) score += 8;
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 90 ? best : null;
  }

  function periodRange(period) {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    if (period === 'today') start.setHours(0, 0, 0, 0);
    else if (period === 'yesterday') {
      end.setHours(0, 0, 0, 0);
      start.setTime(end.getTime());
      start.setDate(start.getDate() - 1);
    } else if (period === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    return { start, end };
  }

  function historyTimestamp(item) {
    const value = Date.parse(item?.last_updated || item?.last_changed || '');
    return Number.isFinite(value) ? value : null;
  }

  function rawHistoryValue(item) {
    const value = Number(item?.state);
    return Number.isFinite(value) ? value : null;
  }

  function rawToKwh(entity, value) {
    if (!Number.isFinite(value)) return null;
    const unit = normalize(entity?.attributes?.unit_of_measurement);
    if (unit === 'wh') return value / 1000;
    if (unit === 'mwh') return value * 1000;
    return value;
  }

  async function historyEnergy(entity, period) {
    if (!entity || typeof window.CASA_HA?.fetch !== 'function') return null;
    const { start, end } = periodRange(period);
    const movingBucket = Math.floor(end.getTime() / 300000);
    const cacheKey = `${entity.entity_id}|${period}|${start.toISOString().slice(0, 10)}|${period === 'today' || period === 'month' ? movingBucket : 'closed'}`;
    if (historyCache.has(cacheKey)) return historyCache.get(cacheKey);

    const task = (async () => {
      try {
        const queryStart = new Date(start);
        queryStart.setHours(queryStart.getHours() - 2);
        const queryEnd = new Date(end);
        const path = `/api/history/period/${encodeURIComponent(queryStart.toISOString())}?filter_entity_id=${encodeURIComponent(entity.entity_id)}&end_time=${encodeURIComponent(queryEnd.toISOString())}&minimal_response&no_attributes`;
        const payload = await window.CASA_HA.fetch(path);
        const rows = Array.isArray(payload?.[0]) ? payload[0] : [];
        const points = rows.map((item) => ({ time: historyTimestamp(item), value: rawHistoryValue(item) }))
          .filter((item) => Number.isFinite(item.time) && Number.isFinite(item.value))
          .sort((a, b) => a.time - b.time);
        if (!points.length) return null;

        const startMs = start.getTime();
        const endMs = end.getTime();
        let baseline = [...points].reverse().find((point) => point.time <= startMs) || points.find((point) => point.time >= startMs);
        if (!baseline) return null;
        let previous = baseline.value;
        let total = 0;
        let samples = 0;

        for (const point of points) {
          if (point.time <= baseline.time || point.time < startMs) continue;
          if (point.time > endMs) break;
          const diff = point.value - previous;
          total += diff >= 0 ? diff : Math.max(0, point.value);
          previous = point.value;
          samples += 1;
        }

        if (!samples) return 0;
        return rawToKwh(entity, total);
      } catch (error) {
        console.warn(`[Casa 5B] Storico energia non disponibile per ${entity.entity_id}`, error);
        return null;
      }
    })();
    historyCache.set(cacheKey, task);
    return task;
  }

  const statisticsCache = new Map();

  function statisticsPayload(payload) {
    return payload?.service_response?.statistics
      || payload?.response?.statistics
      || payload?.statistics
      || null;
  }

  function statisticRowsValue(rows) {
    if (!Array.isArray(rows) || !rows.length) return null;
    const changes = rows.map((row) => Number(row?.change)).filter(Number.isFinite);
    if (changes.length) return changes.reduce((total, value) => total + value, 0);
    const sums = rows.map((row) => Number(row?.sum)).filter(Number.isFinite);
    if (sums.length >= 2) return Math.max(0, sums.at(-1) - sums[0]);
    return null;
  }

  async function recorderStatistics(entities, period) {
    if (!entities.length || typeof window.CASA_HA?.fetch !== 'function') return new Map();
    const { start, end } = periodRange(period);
    const movingBucket = Math.floor(end.getTime() / 300000);
    const ids = entities.map((entity) => entity.entity_id).sort();
    const cacheKey = `${ids.join(',')}|${period}|${start.toISOString().slice(0, 10)}|${period === 'yesterday' ? 'closed' : movingBucket}`;
    if (statisticsCache.has(cacheKey)) return statisticsCache.get(cacheKey);

    const task = (async () => {
      try {
        const payload = await window.CASA_HA.fetch('/api/services/recorder/get_statistics?return_response', {
          method: 'POST',
          body: JSON.stringify({
            statistic_ids: ids,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            period: 'day',
            types: ['change', 'sum'],
            units: { energy: 'kWh' },
          }),
        });
        const statistics = statisticsPayload(payload);
        if (!statistics || typeof statistics !== 'object') return new Map();
        return new Map(ids.map((id) => [id, statisticRowsValue(statistics[id])]));
      } catch (error) {
        console.info('[Casa 5B] recorder.get_statistics non disponibile; uso lo storico stati.', error);
        return new Map();
      }
    })();
    statisticsCache.set(cacheKey, task);
    return task;
  }

  async function historicalGroupTotal(deviceIds, period) {
    const entities = deviceIds.map((id) => resolveCumulativeEnergy(DEVICES[id]));
    if (entities.some((entity) => !entity)) return null;

    const statistics = await recorderStatistics(entities, period);
    const values = await Promise.all(entities.map(async (entity) => {
      const statisticValue = statistics.get(entity.entity_id);
      if (Number.isFinite(statisticValue)) return statisticValue;
      return historyEnergy(entity, period);
    }));
    if (values.some((value) => !Number.isFinite(value))) return null;
    return values.reduce((total, value) => total + value, 0);
  }

  function patchHistoricalStrip(groupId, deviceIds) {
    ['today', 'yesterday', 'month'].forEach(async (period) => {
      const currentStrip = document.querySelector(`.energy-period-strip[data-energy-group="${groupId}"]`);
      const currentNode = currentStrip?.querySelector(`[data-period="${period}"]`);
      if (!currentNode || currentNode.textContent !== NULL_TEXT) return;
      const value = await historicalGroupTotal(deviceIds, period);
      const latestStrip = document.querySelector(`.energy-period-strip[data-energy-group="${groupId}"]`);
      setValue(latestStrip?.querySelector(`[data-period="${period}"]`), formatEnergyKwh(value));
    });
  }

  function formatPower(value) {
    if (!Number.isFinite(value)) return NULL_TEXT;
    if (Math.abs(value) >= 1000) return `${fmt.format(value / 1000)} kW`;
    return `${Math.round(value)} W`;
  }

  function formatEnergyKwh(value) {
    if (!Number.isFinite(value)) return NULL_TEXT;
    return `${fmt.format(value)} kWh`;
  }

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === wanted
    ) || null;
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((node) =>
      normalize(node.querySelector('small')?.textContent) === wanted
    );
    return row?.querySelector('strong') || null;
  }

  function setValue(node, value) {
    if (!node) return;
    if (node.textContent !== value) node.textContent = value;
    node.classList.toggle('ha-null-value', value === NULL_TEXT);
  }

  function exactGroupPeriodTotal(groupId, period) {
    const helpers = GROUP_PERIOD_HELPERS[groupId];
    if (!helpers) return null;

    let total = 0;
    for (const helper of Object.values(helpers)) {
      const entityId = period === 'month' ? helper.monthly : helper.daily;
      const entity = states().get(entityId);
      if (!isEnergySensor(entity)) return null;

      const rawValue = period === 'yesterday' ? entity.attributes?.last_period : entity.state;
      const value = energyKwh(entity, rawValue);
      if (!Number.isFinite(value)) return null;
      total += value;
    }
    return total;
  }

  function groupPeriodTotal(groupId, deviceIds, period) {
    if (GROUP_PERIOD_HELPERS[groupId]) return exactGroupPeriodTotal(groupId, period);

    let total = 0;
    for (const id of deviceIds) {
      const { value } = periodValue(DEVICES[id], period);
      if (!Number.isFinite(value)) return null;
      total += value;
    }
    return total;
  }

  function patchPeriodStrip(card, groupId, deviceIds) {
    const strip = card?.querySelector(`.energy-period-strip[data-energy-group="${groupId}"]`);
    if (!strip) return;
    ['today','yesterday','month'].forEach((period) => {
      setValue(strip.querySelector(`[data-period="${period}"]`), formatEnergyKwh(groupPeriodTotal(groupId, deviceIds, period)));
    });
  }

  function patchPowerCard(title, groupId, deviceIds) {
    const card = findCard(title);
    if (!card) return;
    let total = 0;
    let found = 0;
    const resolved = {};

    deviceIds.forEach((id) => {
      const device = DEVICES[id];
      const entity = resolvePower(device);
      const value = watts(entity);
      resolved[id] = { entity, value };
      if (Number.isFinite(value)) { total += value; found += 1; }

      if (groupId === 'technology') {
        setValue(card.querySelector(`[data-tech-device="${device.powerKey}"] strong`), formatPower(value));
      } else {
        setValue(metricNode(card, device.label), formatPower(value));
      }
    });

    setValue(card.querySelector('.card-head > strong'), found ? formatPower(total) : NULL_TEXT);
    if (groupId === 'technology') {
      const tvIds = ['tv','shield','mediaPc','hdd'];
      const studioIds = ['pc','monitor','ps5','dock'];
      const subtotal = (ids) => {
        const values = ids.map((id) => resolved[id]?.value);
        return values.some(Number.isFinite) ? values.filter(Number.isFinite).reduce((sum, value) => sum + value, 0) : null;
      };
      setValue(card.querySelector('[data-tech-total="zona-tv"]'), formatPower(subtotal(tvIds)));
      setValue(card.querySelector('[data-tech-total="studio-gaming"]'), formatPower(subtotal(studioIds)));
    }
    patchPeriodStrip(card, groupId, deviceIds);
    if (!GROUP_PERIOD_HELPERS[groupId]) patchHistoricalStrip(groupId, deviceIds);
    return resolved;
  }

  function configuredEntity(key, validator) {
    const map = states();
    return configuredCandidates(key).map((id) => map.get(id)).find(validator) || null;
  }

  function solarSignal(entity) {
    const text = entityParts(entity).text;
    return ['fronius','inverter','solarnet','fotovolta','photovolta','solar',' pv '].some((word) => text.includes(normalize(word)));
  }

  function resolveFronius(rule, referenceEntity = null) {
    let best = null;
    let bestScore = 0;
    const reference = compact(referenceEntity?.entity_id || '').replace(/sensor/g, '');
    for (const entity of states().values()) {
      const validType = rule.type === 'power' ? isPowerSensor(entity) : isEnergySensor(entity);
      if (!validType || !solarSignal(entity)) continue;
      const parts = entityParts(entity);
      if ((rule.exclude || []).some((word) => parts.text.includes(normalize(word)))) continue;
      let score = 18;
      rule.labels.forEach((label) => {
        const normalized = normalize(label);
        if (parts.friendly === normalized || parts.entityName === normalized) score = Math.max(score, 78);
        else if (parts.friendly.includes(normalized) || parts.entityName.includes(normalized)) score = Math.max(score, 62);
        else if (parts.text.includes(normalized)) score = Math.max(score, 46);
      });
      if (parts.text.includes('fronius')) score += 8;
      if (parts.text.includes('inverter')) score += 6;
      if (reference && compact(parts.entityName).includes(reference.slice(0, 6))) score += 5;
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 34 ? best : null;
  }

  function resolveProductionPower() {
    return configuredEntity('pvPower', isPowerSensor)
      || resolveFronius(FRONIUS.pvPower)
      || resolveFronius(FRONIUS.acPower);
  }

  function patchFronius() {
    const card = findCard('Fotovoltaico casa');
    if (!card || !connected()) return;

    const productionEntity = resolveProductionPower();
    const panelEntity = resolveFronius(FRONIUS.pvPower, productionEntity) || productionEntity;
    const dayEntity = configuredEntity('pvToday', isEnergySensor) || resolveFronius(FRONIUS.dayEnergy, productionEntity);
    const yearEntity = resolveFronius(FRONIUS.yearEnergy, productionEntity);
    const totalEntity = resolveFronius(FRONIUS.totalEnergy, productionEntity);
    const houseEntity = configuredEntity('housePower', isPowerSensor);

    const measuredProduction = watts(productionEntity);
    const production = Number.isFinite(measuredProduction) ? Math.max(0, measuredProduction) : 0;
    const house = watts(houseEntity);
    const panelPower = watts(panelEntity);
    const dayKwh = energyKwh(dayEntity);
    const yearKwh = energyKwh(yearEntity);
    const totalKwh = energyKwh(totalEntity);

    setValue(card.querySelector('.card-head > strong'), formatPower(production));
    [...card.querySelectorAll('.flow-node')].forEach((node) => {
      const label = normalize(node.querySelector('small')?.textContent);
      if (label === 'produzione') setValue(node.querySelector('strong'), formatPower(production));
      if (label === 'casa') {
        const selfConsumption = Number.isFinite(production) && Number.isFinite(house) ? Math.min(Math.max(0, production), Math.max(0, house)) : null;
        setValue(node.querySelector('strong'), formatPower(selfConsumption));
      }
      if (label === 'rete') {
        if (!Number.isFinite(production) || !Number.isFinite(house)) setValue(node.querySelector('strong'), NULL_TEXT);
        else {
          const net = production - house;
          setValue(node.querySelector('strong'), `${net >= 0 ? '↑' : '↓'} ${formatPower(Math.abs(net))}`);
        }
      }
    });

    const cells = [...card.querySelectorAll('.metric-grid > div')].slice(0, 4);
    const values = [
      ['Produzione oggi', formatEnergyKwh(dayKwh)],
      ['Produzione anno', formatEnergyKwh(yearKwh)],
      ['Energia totale', formatEnergyKwh(totalKwh)],
      ['Potenza pannelli', Number.isFinite(panelPower) ? formatPower(panelPower) : '3 kW'],
    ];
    cells.forEach((cell, index) => {
      const [label, value] = values[index];
      if (cell.querySelector('small')) cell.querySelector('small').textContent = label;
      setValue(cell.querySelector('strong'), value);
    });

    window.CASA_FRONIUS = {
      productionEntity, panelEntity, dayEntity, yearEntity, totalEntity, houseEntity,
      production, house, dayKwh, yearKwh, totalKwh,
    };
  }

  function apply() {
    scheduled = false;
    if (!connected()) return;
    window.CASA_SHELLY_APPLIANCES = patchPowerCard('Elettrodomestici', 'appliances', GROUPS.appliances) || {};
    patchPowerCard('Linee Shelly', 'shelly', GROUPS.shelly);
    patchPowerCard('Tecnologia', 'technology', GROUPS.technology);
    patchFronius();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(schedule, 750);
  schedule();
})();

/* ===== fritz-network-v44.js ===== */
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

    patchHeader('FRITZ!Box 7690 · FTTH', data.wan);
    patchMetric('FRITZ!Box 7690 · FTTH', 'Link download', data.maxDown);
    patchMetric('FRITZ!Box 7690 · FTTH', 'Link upload', data.maxUp);
    patchMetric('FRITZ!Box 7690 · FTTH', 'Traffico download', data.currentDown);
    patchMetric('FRITZ!Box 7690 · FTTH', 'Traffico upload', data.currentUp);

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
    patchHeader('Internet', data.wan);
    patchMetric('Internet', 'Download', data.maxDown);
    patchMetric('Internet', 'Upload', data.maxUp);
    patchMetric('Internet', 'Dispositivi', data.devices);
    patchMetric('Internet', 'Uptime', data.uptimeConnection);
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

/* ===== internet-uptime-stability-v50.js ===== */
(() => {
  'use strict';

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function compactDuration(value) {
    return String(value ?? 'NULL')
      .replace(/(\d+)\s+(?:giorno|giorni)\b/gi, '$1 gg');
  }

  function internetCard() {
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === 'internet'
    ) || null;
  }

  function uptimeNode() {
    const card = internetCard();
    if (!card) return null;
    const row = [...card.querySelectorAll('.metric-grid > div')].find((item) =>
      normalize(item.querySelector('small')?.textContent) === 'uptime'
    );
    return row?.querySelector('strong') || null;
  }

  function patch() {
    if (normalize(document.querySelector('#view-title')?.textContent) !== 'panoramica') return;
    const cached = window.CASA_FRITZBOX?.uptimeConnection;
    if (!cached) return;

    const node = uptimeNode();
    if (!node) return;
    const value = compactDuration(cached);
    if (node.textContent !== value) node.textContent = value;
    node.classList.toggle('ha-null-value', value === 'NULL');
  }

  const rightRail = document.querySelector('#right-rail');
  const observer = new MutationObserver(patch);
  if (rightRail) {
    observer.observe(rightRail, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  const timer = setInterval(patch, 250);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) patch();
  });
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  patch();
})();

/* ===== network-backend-status-v53.js ===== */
(() => {
  'use strict';

  const config = window.CASA_DASHBOARD_CONFIG || {};
  const endpoint = config.networkMonitorUrl || '/api/network-status';
  const UPDATE_MS = 5000;
  const UI_GUARD_MS = 250;
  const STORAGE_KEY = 'casa-network-monitor-last-status';
  const PRIMARY_RATE = '2,5 Gbit/s';
  const BACKUP_RATE = '1 Gbit/s';
  const TIME_ZONE = 'Europe/Rome';

  const timeFormatter = new Intl.DateTimeFormat('it-IT', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat('it-IT', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  let cached = loadCachedStatus();
  let failures = 0;
  let applying = false;
  let refreshing = false;

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function loadCachedStatus() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch (_error) {
      return null;
    }
  }

  function persistCachedStatus(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (_error) {
      // La dashboard continua a funzionare anche con storage disabilitato.
    }
  }

  function durationLabel(startedAt) {
    if (!startedAt) return '';
    const started = Date.parse(startedAt);
    if (!Number.isFinite(started)) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours} h${remaining ? ` ${remaining} min` : ''}`;
  }

  function updateClock() {
    const now = new Date();
    const clock = document.querySelector('#clock');
    const date = document.querySelector('#date');
    const timeText = timeFormatter.format(now);
    const dateText = dateFormatter.format(now).replace(/\./g, '');
    if (clock && clock.textContent !== timeText) clock.textContent = timeText;
    if (date && date.textContent !== dateText) date.textContent = dateText;
  }

  function removeHaPill() {
    document.querySelector('#ha-pill')?.remove();
  }

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === wanted
    ) || null;
  }

  function findFritzCard() {
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent).startsWith('fritz box 7690')
    ) || null;
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((item) =>
      normalize(item.querySelector('small')?.textContent) === wanted
    );
    return row?.querySelector('strong') || null;
  }

  function labeledValueNode(card, label) {
    const wanted = normalize(label);
    const labelNode = [...(card?.querySelectorAll('small, span') || [])].find((node) =>
      normalize(node.textContent) === wanted
    );
    if (!labelNode) return null;
    const parent = labelNode.parentElement;
    return parent?.querySelector(':scope > strong') || parent?.querySelector('strong') || null;
  }

  function setText(node, value) {
    if (!node) return;
    if (node.textContent !== value) node.textContent = value;
    node.classList.remove('ha-null-value');
    delete node.dataset.haNull;
  }

  function setHtml(node, value) {
    if (node && node.innerHTML !== value) node.innerHTML = value;
  }

  function effectiveLink() {
    return String(cached?.link || 'unknown').toLowerCase();
  }

  function effectiveRate() {
    const link = effectiveLink();
    if (link === 'backup') return BACKUP_RATE;
    if (link === 'primary') return PRIMARY_RATE;
    return null;
  }

  function patchMetric(cardTitle, label, value) {
    if (!value) return;
    setText(metricNode(findCard(cardTitle), label), value);
  }

  function applyPill() {
    const pill = document.querySelector('#backup-pill');
    if (!pill || !cached) return;

    const healthy = cached.healthy === true;
    const link = effectiveLink();
    let label = '5G stato sconosciuto';
    let cls = 'warn';

    if (!healthy) {
      label = 'Monitor rete non disponibile';
      cls = 'bad';
    } else if (link === 'backup') {
      const elapsed = durationLabel(cached.failover_started_at);
      label = `5G attivo${elapsed ? ` · ${elapsed}` : ''}`;
      cls = 'bad';
    } else if (link === 'primary') {
      label = '5G standby';
      cls = 'warn';
    }

    const className = `pill ${cls}`;
    if (pill.className !== className) pill.className = className;
    setHtml(pill, `<i class="fa-solid fa-tower-cell"></i> ${label}`);

    const title = [
      cached.public_ip ? `IP pubblico: ${cached.public_ip}` : '',
      cached.routed_prefix ? `Prefisso: ${cached.routed_prefix}` : '',
      Array.isArray(cached.origin_asns) && cached.origin_asns.length
        ? `ASN: ${cached.origin_asns.join(', ')}`
        : '',
      cached.checked_at ? `Controllato: ${new Date(cached.checked_at).toLocaleString('it-IT')}` : '',
    ].filter(Boolean).join('\n');
    if (pill.title !== title) pill.title = title;
  }

  function applyRates() {
    const rate = effectiveRate();
    if (!rate) return;

    patchMetric('Internet', 'Download', rate);
    patchMetric('Internet', 'Upload', rate);

    const fritz = findFritzCard();
    setText(metricNode(fritz, 'Link download'), rate);
    setText(metricNode(fritz, 'Link upload'), rate);

    window.CASA_NETWORK_EFFECTIVE_RATE = rate;
    document.documentElement.dataset.networkLink = effectiveLink();
  }

  function applyNetworkLabels() {
    const link = effectiveLink();
    if (!['primary', 'backup'].includes(link)) return;

    const fritz = findFritzCard();
    const fritzTitle = fritz?.querySelector('.card-head .title');
    if (fritzTitle) {
      const wanted = link === 'backup' ? 'FRITZ!Box 7690 · 5G' : 'FRITZ!Box 7690 · FTTH';
      const icon = fritzTitle.querySelector('i')?.outerHTML || '<i class="fa-solid fa-router"></i>';
      setHtml(fritzTitle, `${icon} ${wanted}`);
    }

    const devicesCard = findCard('Dispositivi connessi');
    const wanValue = labeledValueNode(devicesCard, 'Stato WAN');
    setText(wanValue, link === 'backup' ? 'Connesso (Failover 5G)' : 'Connesso');
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      updateClock();
      removeHaPill();
      if (cached) {
        applyPill();
        applyRates();
        applyNetworkLabels();
        window.CASA_NETWORK_MONITOR = cached;
      }
    } finally {
      applying = false;
    }
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      cached = await response.json();
      failures = 0;
      persistCachedStatus(cached);
      apply();
    } catch (error) {
      failures += 1;
      if (failures >= 3 && cached) {
        cached = { ...cached, healthy: false, error: String(error) };
        apply();
      }
    } finally {
      clearTimeout(timeout);
      refreshing = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (!applying) apply();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const refreshTimer = setInterval(refresh, UPDATE_MS);
  const guardTimer = setInterval(apply, UI_GUARD_MS);
  const clockTimer = setInterval(updateClock, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateClock();
      refresh();
    }
  });
  window.addEventListener('beforeunload', () => {
    clearInterval(refreshTimer);
    clearInterval(guardTimer);
    clearInterval(clockTimer);
    observer.disconnect();
  });

  apply();
  refresh();
})();

/* ===== dashboard-cleanup-v47.js ===== */
(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const EXPECTED_SHUTTERS = 10;
  const SHUTTER_DEFINITIONS = [
    { label:'Tapparella Salotto', names:['Tapparella Salotto'], ids:['cover.tapparella_salotto','cover.salotto'] },
    { label:'Portafinestra Salotto', names:['Portafinestra Salotto'], ids:['cover.portafinestra_salotto'] },
    { label:'Tapparella Scale', names:['Tapparella Scale'], ids:['cover.tapparella_scale','cover.scale'] },
    { label:'Tapparella Cucina', names:['Tapparella Cucina'], ids:['cover.tapparella_cucina','cover.cucina'] },
    { label:'Tapparella Camera Matrimoniale', names:['Tapparella Camera Matrimoniale'], ids:['cover.tapparella_camera_matrimoniale','cover.camera_matrimoniale'] },
    { label:'Portafinestra Studio', names:['Portafinestra Studio'], ids:['cover.portafinestra_studio','cover.studio'] },
    { label:'Tapparella Cameretta', names:['Tapparella Cameretta'], ids:['cover.tapparella_cameretta','cover.cameretta'] },
    { label:'Tapparella Bagno Mansarda', names:['Tapparella Bagno Mansarda'], ids:['cover.tapparella_bagno_mansarda','cover.bagno_mansarda'] },
    { label:'Portafinestra Mansarda', names:['Portafinestra Mansarda','Tapparella Mansarda'], ids:['cover.portafinestra_mansarda','cover.tapparella_mansarda','cover.mansarda'] },
    { label:'Portafinestra Camera Mansarda', names:['Portafinestra Camera Mansarda'], ids:['cover.portafinestra_camera_mansarda','cover.camera_mansarda'] },
  ];
  let scheduled = false;

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const currentView = () => normalize(document.querySelector('#view-title')?.textContent);
  const connected = () => window.CASA_HA?.state?.connected === true;
  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

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

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((item) =>
      normalize(item.querySelector('small')?.textContent) === wanted
    );
    return row?.querySelector('strong') || null;
  }

  function removeCard(title) {
    findCard(title)?.remove();
  }

  function patchSolarMetadata() {
    const card = findCard('Fotovoltaico casa');
    if (!card) return;

    setText(metricNode(card, 'Potenza pannelli'), '3 kW');

    const items = currentView() === 'energia'
      ? [
          ['Costo energia', '0,287 €/kWh'],
          ['Fornitore', 'Alperia'],
        ]
      : [];

    let strip = card.querySelector('.pv-system-strip');
    if (!items.length) {
      strip?.remove();
      return;
    }

    const signature = items.map(([label, value]) => `${label}:${value}`).join('|');
    if (strip?.dataset.signature === signature) return;

    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'pv-system-strip';
      card.appendChild(strip);
    }

    strip.dataset.signature = signature;
    strip.style.setProperty('--pv-meta-columns', String(items.length));
    strip.innerHTML = items.map(([label, value]) =>
      `<div><small>${label}</small><strong>${value}</strong></div>`
    ).join('');
  }

  function compactUptimeDays() {
    document.querySelectorAll('.card strong').forEach((node) => {
      const value = node.textContent || '';
      const compact = value.replace(/(\d+)\s+(?:giorno|giorni)\b/gi, '$1 gg');
      if (compact !== value) node.textContent = compact;
    });
  }

  function validCover(entity) {
    return Boolean(
      entity
      && entity.entity_id?.startsWith('cover.')
      && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state))
    );
  }

  function coverText(entity) {
    return normalize([
      entity?.entity_id,
      entity?.attributes?.friendly_name,
      entity?.attributes?.device_class,
    ].filter(Boolean).join(' '));
  }

  function excludedCover(entity) {
    const text = coverText(entity);
    return [
      'tutte le tapparelle', 'tutte tapparelle', 'all shutters', 'all covers',
      'gruppo tapparelle', 'cover group', 'garage', 'cancello', 'gate',
      'porta', 'door', 'tenda', 'awning',
    ].some((token) => text.includes(normalize(token)));
  }

  function coverObjectId(entity) {
    return normalize(String(entity?.entity_id || '').split('.').slice(1).join(' '));
  }

  function resolveDefinedCover(definition, used) {
    const map = states();
    for (const entityId of definition.ids) {
      const entity = map.get(entityId);
      if (validCover(entity) && !used.has(entity.entity_id)) return entity;
    }

    const wanted = definition.names.map(normalize);
    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!validCover(entity) || used.has(entity.entity_id)) continue;
      const friendly = normalize(entity.attributes?.friendly_name);
      const objectId = coverObjectId(entity);
      const text = normalize(`${friendly} ${objectId}`);
      let score = 0;
      wanted.forEach((name, index) => {
        const penalty = index * 2;
        if (friendly === name) score = Math.max(score, 220 - penalty);
        else if (objectId === name) score = Math.max(score, 210 - penalty);
        else {
          const tokens = name.split(' ').filter((token) => token.length > 2);
          if (tokens.length && tokens.every((token) => text.includes(token))) {
            score = Math.max(score, 110 + tokens.length * 10 - penalty);
          }
        }
      });
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 130 ? best : null;
  }

  function discoverCovers() {
    if (!connected()) return [];
    const used = new Set();
    const resolved = [];
    SHUTTER_DEFINITIONS.forEach((definition) => {
      const entity = resolveDefinedCover(definition, used);
      if (!entity) return;
      used.add(entity.entity_id);
      resolved.push({ definition, entity });
    });
    window.CASA_SHUTTERS = {
      expected: SHUTTER_DEFINITIONS.map((item) => item.label),
      resolved: resolved.map(({ definition, entity }) => ({ label:definition.label, entity_id:entity.entity_id })),
    };
    return resolved;
  }

  function coverPosition(entity) {
    const current = Number(entity?.attributes?.current_position);
    if (Number.isFinite(current)) return Math.max(0, Math.min(100, current));

    const state = normalize(entity?.state);
    // Nell'integrazione MyHOME: 0 = completamente aperta, 100 = completamente chiusa.
    if (state === 'open') return 0;
    if (state === 'closed') return 100;
    return null;
  }

  function coverSnapshot() {
    const resolved = discoverCovers();
    const positions = resolved.map(({ entity }) => coverPosition(entity));
    const known = positions.filter(Number.isFinite);
    const open = known.filter((value) => value < 99).length;
    const closed = known.filter((value) => value >= 99).length;
    const complete = resolved.length === EXPECTED_SHUTTERS && known.length === EXPECTED_SHUTTERS;
    const average = complete ? known.reduce((sum, value) => sum + value, 0) / EXPECTED_SHUTTERS : null;
    return { total: EXPECTED_SHUTTERS, resolved: resolved.length, open, closed, average, complete };
  }

  function patchShutters() {
    const snapshot = coverSnapshot();
    const average = Number.isFinite(snapshot.average) ? `${Math.round(snapshot.average)}%` : NULL_TEXT;

    const overview = findCard('Comfort e stanze');
    const overviewTile = [...(overview?.querySelectorAll('.overview-kpi') || [])].find((item) =>
      normalize(item.querySelector('small')?.textContent) === 'tapparelle'
    );
    setText(overviewTile?.querySelector('strong'), average);

    const card = findCard('Tapparelle');
    if (!card) return;
    setText(card.querySelector('.card-head > strong'), average);
    setText(metricNode(card, 'Apertura media'), average);
    setText(metricNode(card, 'Motorizzate'), String(snapshot.total));
    setText(metricNode(card, 'Aperte'), String(snapshot.open));
    setText(metricNode(card, 'Chiuse'), String(snapshot.closed));
  }

  function injectStyles() {
    if (document.querySelector('#dashboard-cleanup-v47-styles')) return;
    const style = document.createElement('style');
    style.id = 'dashboard-cleanup-v47-styles';
    style.textContent = `
      .pv-system-strip{
        display:grid;
        grid-template-columns:repeat(var(--pv-meta-columns,1),minmax(0,1fr));
        gap:.45rem;
        margin-top:.55rem;
      }
      .pv-system-strip>div{
        min-width:0;
        padding:.48rem .55rem;
        border:1px solid rgba(255,255,255,.09);
        border-radius:.72rem;
        background:rgba(2,12,24,.28);
      }
      .pv-system-strip small,.pv-system-strip strong{display:block}
      .pv-system-strip small{color:#8ea2b7;font-size:.68rem}
      .pv-system-strip strong{margin-top:.15rem;font-size:.88rem;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    scheduled = false;
    injectStyles();
    removeCard('Riepilogo linea');
    removeCard('Videocitofono');
    patchSolarMetadata();
    compactUptimeDays();
    patchShutters();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  setInterval(schedule, 500);
  schedule();
})();

/* ===== weather-overview-v51.js ===== */
(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  let scheduled = false;

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const currentView = () => normalize(document.querySelector('#view-title')?.textContent);
  const connected = () => window.CASA_HA?.state?.connected === true;
  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

  const CONDITION = {
    'clear-night': ['Sereno', 'fa-moon'],
    cloudy: ['Nuvoloso', 'fa-cloud'],
    exceptional: ['Condizioni eccezionali', 'fa-triangle-exclamation'],
    fog: ['Nebbia', 'fa-smog'],
    hail: ['Grandine', 'fa-cloud-showers-heavy'],
    lightning: ['Temporale', 'fa-bolt'],
    'lightning-rainy': ['Temporale con pioggia', 'fa-cloud-bolt'],
    partlycloudy: ['Parzialmente nuvoloso', 'fa-cloud-sun'],
    pouring: ['Pioggia intensa', 'fa-cloud-showers-water'],
    rainy: ['Pioggia', 'fa-cloud-rain'],
    snowy: ['Neve', 'fa-snowflake'],
    'snowy-rainy': ['Nevischio', 'fa-cloud-meatball'],
    sunny: ['Soleggiato', 'fa-sun'],
    windy: ['Ventoso', 'fa-wind'],
    'windy-variant': ['Ventoso e nuvoloso', 'fa-wind'],
  };

  function valid(entity) {
    return Boolean(entity
      && entity.entity_id?.startsWith('weather.')
      && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state)));
  }

  function weatherEntity() {
    const map = states();
    const configured = window.CASA_DASHBOARD_CONFIG?.entities?.weather;
    const configuredIds = Array.isArray(configured) ? configured : [configured];
    const preferred = [
      ...configuredIds.filter(Boolean),
      'weather.forecast_casa',
      'weather.casa',
      'weather.forecast_home',
      'weather.home',
    ];

    for (const entityId of preferred) {
      const entity = map.get(entityId);
      if (valid(entity)) return entity;
    }

    return [...map.values()]
      .filter(valid)
      .map((entity) => {
        const text = normalize(`${entity.entity_id} ${entity.attributes?.friendly_name || ''}`);
        let score = 0;
        if (text.includes('casa')) score += 20;
        if (text.includes('forecast')) score += 10;
        if (text.includes('home')) score += 6;
        return { entity, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.entity || null;
  }

  function value(entity, attribute, unit = '') {
    const raw = entity?.attributes?.[attribute];
    if (raw === undefined || raw === null || raw === '') return NULL_TEXT;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? `${fmt.format(numeric)}${unit}` : `${raw}${unit}`;
  }

  function windDirection(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(((numeric % 360) + 360) % 360 / 45) % 8];
  }

  function conditionInfo(condition) {
    return CONDITION[String(condition || '').toLowerCase()] || [
      String(condition || NULL_TEXT).replaceAll('-', ' '),
      'fa-cloud-sun',
    ];
  }

  function dayLabel(datetime) {
    const date = new Date(datetime);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat('it-IT', { weekday: 'short' })
      .format(date)
      .replace('.', '');
  }

  function forecastHtml(entity) {
    const forecast = Array.isArray(entity?.attributes?.forecast)
      ? entity.attributes.forecast.slice(0, 5)
      : [];
    if (!forecast.length) return '';

    return `<div class="weather-forecast">${forecast.map((item) => {
      const [label, icon] = conditionInfo(item.condition);
      const high = Number.isFinite(Number(item.temperature)) ? `${fmt.format(Number(item.temperature))}°` : NULL_TEXT;
      const low = Number.isFinite(Number(item.templow)) ? `${fmt.format(Number(item.templow))}°` : '';
      return `<div title="${label}"><small>${dayLabel(item.datetime)}</small><i class="fa-solid ${icon}"></i><strong>${high}</strong>${low ? `<span>${low}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }

  function buildCard(entity) {
    const [condition, icon] = conditionInfo(entity?.state);
    const attrs = entity?.attributes || {};
    const temperatureUnit = attrs.temperature_unit || '°C';
    const pressureUnit = attrs.pressure_unit || 'hPa';
    const windUnit = attrs.wind_speed_unit || 'km/h';
    const temperature = value(entity, 'temperature', ` ${temperatureUnit}`);
    const apparent = value(entity, 'apparent_temperature', ` ${temperatureUnit}`);
    const pressure = value(entity, 'pressure', ` ${pressureUnit}`);
    const humidity = value(entity, 'humidity', '%');
    const wind = value(entity, 'wind_speed', ` ${windUnit}`);
    const direction = windDirection(attrs.wind_bearing);
    const windText = wind === NULL_TEXT ? NULL_TEXT : `${wind}${direction ? ` (${direction})` : ''}`;

    return `<section class="card weather-overview-card" data-weather-overview="true">
      <div class="card-head"><span class="title"><i class="fa-solid fa-cloud-sun"></i> Meteo esterno</span><strong>${temperature}</strong></div>
      <div class="weather-current">
        <div class="weather-condition-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="weather-condition"><strong>${condition}</strong><small>${apparent !== NULL_TEXT ? `Percepita ${apparent}` : (attrs.friendly_name || 'Casa')}</small></div>
      </div>
      <div class="weather-metrics">
        <div><i class="fa-solid fa-gauge-high"></i><small>Pressione</small><strong>${pressure}</strong></div>
        <div><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>${humidity}</strong></div>
        <div><i class="fa-solid fa-wind"></i><small>Vento</small><strong>${windText}</strong></div>
      </div>
      ${forecastHtml(entity)}
    </section>`;
  }

  function nullCard() {
    return `<section class="card weather-overview-card" data-weather-overview="true">
      <div class="card-head"><span class="title"><i class="fa-solid fa-cloud-sun"></i> Meteo esterno</span><strong class="ha-null-value">${NULL_TEXT}</strong></div>
      <div class="weather-current"><div class="weather-condition-icon"><i class="fa-solid fa-cloud"></i></div><div class="weather-condition"><strong class="ha-null-value">${NULL_TEXT}</strong><small>Home Assistant</small></div></div>
      <div class="weather-metrics">
        <div><i class="fa-solid fa-gauge-high"></i><small>Pressione</small><strong class="ha-null-value">${NULL_TEXT}</strong></div>
        <div><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong class="ha-null-value">${NULL_TEXT}</strong></div>
        <div><i class="fa-solid fa-wind"></i><small>Vento</small><strong class="ha-null-value">${NULL_TEXT}</strong></div>
      </div>
    </section>`;
  }

  function injectStyles() {
    if (document.querySelector('#weather-overview-v51-styles')) return;
    const style = document.createElement('style');
    style.id = 'weather-overview-v51-styles';
    style.textContent = `
      .weather-overview-card{overflow:hidden}
      .weather-current{display:flex;align-items:center;gap:.75rem;margin:.2rem 0 .55rem}
      .weather-condition-icon{display:grid;place-items:center;width:2.9rem;height:2.9rem;border-radius:50%;background:rgba(255,210,70,.12);font-size:1.55rem;color:#ffd64a;flex:0 0 auto}
      .weather-condition{min-width:0}.weather-condition>strong,.weather-condition>small{display:block}.weather-condition>strong{font-size:1.05rem}.weather-condition>small{margin-top:.12rem;color:#8ea2b7;font-size:.72rem}
      .weather-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem}
      .weather-metrics>div{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:.38rem;align-items:center;min-width:0;padding:.42rem .45rem;border:1px solid rgba(255,255,255,.08);border-radius:.68rem;background:rgba(2,12,24,.25)}
      .weather-metrics i{grid-row:1/3;color:#55b6ff}.weather-metrics small,.weather-metrics strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.weather-metrics small{font-size:.62rem;color:#8ea2b7}.weather-metrics strong{font-size:.75rem}
      .weather-forecast{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.25rem;margin-top:.48rem;padding-top:.48rem;border-top:1px solid rgba(255,255,255,.08)}
      .weather-forecast>div{text-align:center;min-width:0}.weather-forecast small,.weather-forecast strong,.weather-forecast span{display:block}.weather-forecast small{font-size:.62rem;color:#8ea2b7;text-transform:capitalize}.weather-forecast i{margin:.2rem 0;font-size:.95rem;color:#ffd64a}.weather-forecast strong{font-size:.74rem}.weather-forecast span{font-size:.62rem;color:#8ea2b7}
      @media(max-width:900px){.weather-metrics{grid-template-columns:1fr}.weather-forecast{grid-template-columns:repeat(5,minmax(2.6rem,1fr));overflow-x:auto}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    scheduled = false;
    injectStyles();
    if (currentView() !== 'panoramica') return;

    const left = document.querySelector('#left-rail');
    if (!left) return;
    const houseCard = [...left.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === 'bilancio casa'
    );
    if (!houseCard) return;

    const html = connected() && weatherEntity() ? buildCard(weatherEntity()) : nullCard();
    const existing = left.querySelector('[data-weather-overview="true"]');
    if (existing) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      const next = wrapper.firstElementChild;
      if (existing.outerHTML !== next.outerHTML) existing.replaceWith(next);
    } else {
      houseCard.insertAdjacentHTML('afterend', html);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = setInterval(schedule, 1000);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });
  schedule();
})();

/* ===== rooms-devices-v52.js ===== */
(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const rooms = Array.isArray(window.CASA_ROOMS) ? window.CASA_ROOMS : [];
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  let selectedRoomId = 'first-salotto';
  let scheduled = false;
  let lastSignature = '';

  const ROOM_DEVICES = {
    'first-salotto': [
      { source: 'Luce Salotto', label: 'Salotto', kind: 'light' },
      { source: 'Scale', label: 'Scale', kind: 'light' },
      { source: 'Ingresso', label: 'Ingresso', kind: 'light' },
      { source: 'Luce Esterna Salotto', label: 'Terrazza', kind: 'light' },
      { source: 'Tapparella Salotto', label: 'Salotto', kind: 'cover' },
      { source: 'Portafinestra Salotto', label: 'Portafinestra', kind: 'cover' },
      { source: 'Tapparella Scale', label: 'Scale', kind: 'cover' },
    ],
    'first-cucina': [
      { source: 'Pensili Cucina', label: 'Pensili', kind: 'light' },
      { source: 'Tapparella Cucina', label: 'Cucina', kind: 'cover' },
    ],
    'first-camera-matrimoniale': [
      { source: 'Luce Camera Matrimoniale', aliases: ['Luca Camera Matrimoniale'], label: 'Camera Matrimoniale', kind: 'light' },
      { source: 'Tapparella Camera Matrimoniale', label: 'Camera Matrimoniale', kind: 'cover' },
    ],
    'first-corridoio': [
      { source: 'Corridoio', label: 'Corridoio', kind: 'light' },
    ],
    'first-studio': [
      { source: 'Luce Studio', label: 'Studio', kind: 'light' },
      { source: 'Luce Esterna Studio', label: 'Terrazza', kind: 'light' },
      { source: 'Portafinestra Studio', label: 'Portafinestra', kind: 'cover' },
    ],
    'first-cameretta': [
      { source: 'Luce Cameretta', label: 'Cameretta', kind: 'light' },
      { source: 'Tapparella Cameretta', label: 'Cameretta', kind: 'cover' },
    ],
    'first-bagno-matrimoniale': [
      { source: 'Luce Bagno Matrimoniale', label: 'Bagno Matrimoniale', kind: 'light' },
      { source: 'Specchio Bagno Matrimoniale', label: 'Specchio Bagno Matrimoniale', kind: 'light' },
    ],
    'first-bagno-ospiti': [
      { source: 'Luce Bagno Ospiti', label: 'Bagno Ospiti', kind: 'light' },
      { source: 'Specchio Bagno Ospiti', label: 'Specchio Bagno Ospiti', kind: 'light' },
    ],
    'second-vano-tecnico': [
      { source: 'Luce Vano Tecnico', label: 'Vano Tecnico', kind: 'light' },
    ],
    'second-bagno-mansarda': [
      { source: 'Luce Bagno Mansarda', label: 'Bagno Mansarda', kind: 'light' },
      { source: 'Specchio Bagno Mansarda', label: 'Specchio Bagno Mansarda', kind: 'light' },
      { source: 'Tapparella Bagno Mansarda', label: 'Bagno Mansarda', kind: 'cover' },
    ],
    'second-mansarda': [
      { source: 'Led Mansarda DX', label: 'Led Mansarda DX', kind: 'light' },
      { source: 'Led Mansarda SX', label: 'Led Mansarda SX', kind: 'light' },
      { source: 'Led Mansarda Centrale', label: 'Led Mansarda Centrale', kind: 'light' },
      { source: 'Luce Esterna Mansarda', label: 'Terrazza', kind: 'light' },
      { source: 'Corridoio Mansarda', label: 'Corridoio', kind: 'light' },
      { source: 'Portafinestra Mansarda', label: 'Portafinestra', kind: 'cover' },
    ],
    'second-camera-mansarda': [
      { source: 'Luce Camera Mansarda', label: 'Camera Mansarda', kind: 'light' },
      { source: 'Luce Esterna Camera Mansarda', label: 'Terrazza', kind: 'light' },
      { source: 'Portafinestra Camera Mansarda', label: 'Portafinestra', kind: 'cover' },
    ],
  };

  const CLIMATE_SOURCE = {
    'first-salotto': { roomId: 'first-salotto' },
    'first-cucina': { roomId: 'first-salotto' },
    'first-camera-matrimoniale': { roomId: 'first-camera-matrimoniale' },
    'second-mansarda': { roomId: 'second-mansarda' },
    'second-camera-mansarda': { roomId: 'second-camera-mansarda' },
  };

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const currentView = () => normalize(document.querySelector('#view-title')?.textContent);
  const haState = () => window.CASA_HA?.state;
  const states = () => haState()?.states instanceof Map ? haState().states : new Map();
  const connected = () => haState()?.connected === true;

  function valid(entity) {
    return Boolean(entity && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state)));
  }

  function entityText(entity) {
    return normalize([
      entity?.entity_id,
      entity?.attributes?.friendly_name,
      entity?.attributes?.device_class,
    ].filter(Boolean).join(' '));
  }

  function itemName(item) {
    return item.label || item.source;
  }

  function preferredDomains(kind) {
    return kind === 'cover' ? ['cover'] : ['light', 'switch', 'input_boolean'];
  }

  function resolveDevice(item) {
    const map = states();
    const names = [item.source, ...(item.aliases || [])].map(normalize).filter(Boolean);
    const domains = preferredDomains(item.kind);
    let best = null;
    let bestScore = -Infinity;

    for (const entity of map.values()) {
      if (!valid(entity)) continue;
      const domain = entity.entity_id.split('.')[0];
      if (!domains.includes(domain)) continue;

      const friendly = normalize(entity.attributes?.friendly_name);
      const entityId = normalize(entity.entity_id.split('.').slice(1).join(' '));
      const text = entityText(entity);
      let score = -Infinity;

      names.forEach((name, index) => {
        const aliasPenalty = index * 3;
        if (friendly === name) score = Math.max(score, 150 - aliasPenalty);
        else if (entityId === name) score = Math.max(score, 140 - aliasPenalty);
        else if (friendly.startsWith(`${name} `) || friendly.endsWith(` ${name}`)) score = Math.max(score, 112 - aliasPenalty);
        else {
          const tokens = name.split(' ').filter((token) => token.length > 2);
          if (tokens.length && tokens.every((token) => text.includes(token))) {
            score = Math.max(score, 72 + tokens.length * 7 - aliasPenalty);
          }
        }
      });

      if (domain === domains[0]) score += 8;
      if (score > bestScore) { bestScore = score; best = entity; }
    }

    return bestScore >= 84 ? best : null;
  }

  function roomConfig(roomId) {
    return rooms.find((room) => room.id === roomId) || null;
  }

  function entityCandidates(room, key) {
    const values = [];
    const primary = room?.entities?.[key];
    const candidates = room?.candidates?.[key];
    if (Array.isArray(primary)) values.push(...primary); else if (primary) values.push(primary);
    if (Array.isArray(candidates)) values.push(...candidates); else if (candidates) values.push(candidates);
    return [...new Set(values.filter(Boolean))];
  }

  function resolveClimate(roomId) {
    const mapping = CLIMATE_SOURCE[roomId];
    if (!mapping) return null;
    const sourceRoom = roomConfig(mapping.roomId);
    const map = states();

    for (const entityId of entityCandidates(sourceRoom, 'climate')) {
      const entity = map.get(entityId);
      if (valid(entity) && entity.entity_id.startsWith('climate.')) return entity;
    }

    const tokens = [sourceRoom?.name, ...(sourceRoom?.aliases || [])]
      .map(normalize)
      .filter((token) => token.length >= 4);
    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!valid(entity) || !entity.entity_id.startsWith('climate.')) continue;
      const text = entityText(entity);
      if (roomId === 'second-mansarda' && /(?:camera|bagno|vano tecnico|locale tecnico) mansarda/.test(text)) continue;
      let score = 0;
      tokens.forEach((token) => {
        if (text.includes(token)) score = Math.max(score, 20 + token.split(' ').length * 8);
      });
      if (text.includes('clima') || text.includes('termostato') || text.includes('thermostat')) score += 8;
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 28 ? best : null;
  }

  function temperatureFor(roomId, visiting = new Set()) {
    const room = roomConfig(roomId);
    if (!room || visiting.has(roomId)) return null;
    visiting.add(roomId);
    if (room.temperatureFrom) return temperatureFor(room.temperatureFrom, visiting);

    const climate = resolveClimate(roomId);
    const climateTemperature = Number(climate?.attributes?.current_temperature);
    if (valid(climate) && Number.isFinite(climateTemperature)) return climateTemperature;

    const map = states();
    for (const entityId of entityCandidates(room, 'climate')) {
      const entity = map.get(entityId);
      const value = Number(entity?.attributes?.current_temperature);
      if (valid(entity) && Number.isFinite(value)) return value;
    }
    for (const entityId of entityCandidates(room, 'temperature')) {
      const entity = map.get(entityId);
      const value = Number(entity?.state);
      if (valid(entity) && Number.isFinite(value)) return value;
    }

    const tokens = [room.name, ...(room.aliases || [])].map(normalize).filter(Boolean);
    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!valid(entity) || !entity.entity_id.startsWith('sensor.')) continue;
      const text = entityText(entity);
      if (!text.includes('temperatura') && !text.includes('temperature')) continue;
      if (roomId === 'second-mansarda' && /(?:camera|bagno|vano tecnico|locale tecnico) mansarda/.test(text)) continue;
      const score = tokens.reduce((max, token) => Math.max(max, text.includes(token) ? 10 + token.split(' ').length * 3 : 0), 0);
      const value = Number(entity.state);
      if (Number.isFinite(value) && score > bestScore) { bestScore = score; best = value; }
    }
    return bestScore >= 10 ? best : null;
  }

  function deviceIcon(item) {
    return item.kind === 'cover' ? 'fa-window-maximize' : 'fa-lightbulb';
  }

  function deviceStatus(entity, item) {
    if (!valid(entity)) return { label: NULL_TEXT, active: false, cls: 'null' };
    const domain = entity.entity_id.split('.')[0];
    const state = normalize(entity.state);

    if (domain === 'cover' || item.kind === 'cover') {
      if (state === 'closed') return { label: 'Chiusa', active: false, cls: 'closed' };
      if (state === 'closing') return { label: 'In chiusura', active: true, cls: 'moving' };
      if (state === 'opening') return { label: 'In apertura', active: true, cls: 'moving' };
      if (state === 'open') return { label: 'Aperta', active: true, cls: 'on' };
      const position = Number(entity.attributes?.current_position);
      if (Number.isFinite(position)) {
        return position >= 99
          ? { label: 'Chiusa', active: false, cls: 'closed' }
          : { label: `${fmt.format(position)}% chiusa`, active: true, cls: 'on' };
      }
      return { label: String(entity.state), active: false, cls: '' };
    }

    if (state === 'on') return { label: 'Accesa', active: true, cls: 'on' };
    if (state === 'off') return { label: 'Spenta', active: false, cls: 'off' };
    return { label: String(entity.state), active: false, cls: '' };
  }

  function roomSnapshot(roomId) {
    const definitions = ROOM_DEVICES[roomId] || [];
    const devices = definitions.map((item) => {
      const entity = resolveDevice(item);
      return { item, entity, status: deviceStatus(entity, item) };
    });
    const lights = definitions.filter((item) => item.kind === 'light').length;
    const covers = definitions.filter((item) => item.kind === 'cover').length;
    const active = devices.filter((device) => device.status.active).length;
    const unavailable = devices.filter((device) => !device.entity).length;
    return { devices, lights, covers, active, unavailable, temperature: temperatureFor(roomId) };
  }

  function roomCard(room) {
    const snapshot = roomSnapshot(room.id);
    const selected = selectedRoomId === room.id;
    const detail = [
      snapshot.lights ? `${snapshot.lights} ${snapshot.lights === 1 ? 'luce' : 'luci'}` : '',
      snapshot.covers ? `${snapshot.covers} ${snapshot.covers === 1 ? 'tapparella' : 'tapparelle'}` : '',
    ].filter(Boolean).join(' · ') || 'Nessun dispositivo';
    const status = snapshot.unavailable === snapshot.devices.length && snapshot.devices.length
      ? NULL_TEXT
      : snapshot.active ? `${snapshot.active} attivi` : 'Tutto spento';
    const temperature = Number.isFinite(snapshot.temperature) ? `${fmt.format(snapshot.temperature)}°` : NULL_TEXT;

    return `<button class="room-device-card ${selected ? 'active' : ''}" data-room-device-select="${room.id}">
      <span class="room-device-icon"><i class="fa-solid ${room.icon || 'fa-door-open'}"></i></span>
      <span class="room-device-main"><strong>${room.name}</strong><small>${detail}</small></span>
      <span class="room-device-side"><strong>${temperature}</strong><small class="${snapshot.active ? 'active' : ''}">${status}</small></span>
    </button>`;
  }

  function floorHtml(floor) {
    const floorRooms = rooms.filter((room) => room.floor === floor);
    const title = floor === 'first' ? 'Primo piano' : 'Secondo piano';
    const icon = floor === 'first' ? 'fa-1' : 'fa-2';
    return `<section class="card room-device-floor" data-rooms-floor="${floor}">
      <div class="card-head"><span class="title"><i class="fa-solid ${icon}"></i> ${title}</span><strong>${floorRooms.length} ambienti</strong></div>
      <div class="room-device-list">${floorRooms.map(roomCard).join('')}</div>
    </section>`;
  }

  function lightTile(device) {
    const { item, entity, status } = device;
    const entityId = entity?.entity_id || '';
    const disabled = !entity ? 'disabled' : '';
    return `<button class="ha-device-tile light ${status.cls}" data-ha-device-toggle="${entityId}" ${disabled}>
      <span class="ha-device-icon"><i class="fa-solid ${deviceIcon(item)}"></i></span>
      <span class="ha-device-copy"><strong>${itemName(item)}</strong><small>${status.label}</small></span>
      <span class="ha-device-power"><i class="fa-solid fa-power-off"></i></span>
    </button>`;
  }

  function coverTile(device) {
    const { item, entity, status } = device;
    const entityId = entity?.entity_id || '';
    const disabled = !entity ? 'disabled' : '';
    return `<div class="ha-device-tile cover ${status.cls}">
      <span class="ha-device-icon"><i class="fa-solid ${deviceIcon(item)}"></i></span>
      <span class="ha-device-copy"><strong>${itemName(item)}</strong><small>${status.label}</small></span>
      <span class="ha-cover-actions">
        <button data-ha-cover-action="open_cover" data-entity-id="${entityId}" title="Apri" ${disabled}><i class="fa-solid fa-arrow-up"></i></button>
        <button data-ha-cover-action="stop_cover" data-entity-id="${entityId}" title="Stop" ${disabled}><i class="fa-solid fa-stop"></i></button>
        <button data-ha-cover-action="close_cover" data-entity-id="${entityId}" title="Chiudi" ${disabled}><i class="fa-solid fa-arrow-down"></i></button>
      </span>
    </div>`;
  }

  function deviceSection(title, icon, devices, kind) {
    if (!devices.length) return '';
    const tiles = devices.map((device) => kind === 'cover' ? coverTile(device) : lightTile(device)).join('');
    return `<section class="ha-device-section ${kind}">
      <div class="ha-device-section-title"><i class="fa-solid ${icon}"></i><span>${title}</span><small>${devices.length}</small></div>
      <div class="ha-device-row ${kind}">${tiles}</div>
    </section>`;
  }

  function climateHtml(roomId) {
    const mapping = CLIMATE_SOURCE[roomId];
    if (!mapping) return '';
    const entity = resolveClimate(roomId);
    const entityId = entity?.entity_id || '';
    const current = Number(entity?.attributes?.current_temperature ?? temperatureFor(roomId));
    const target = Number(entity?.attributes?.temperature);
    const disabled = entity ? '' : 'disabled';
    const state = normalize(entity?.state);
    const active = entity && state !== 'off';
    return `<div class="room-climate-control ${active ? 'active' : ''}">
      <div class="room-climate-copy"><span>Temperatura</span></div>
      <div class="room-climate-current"><strong>${Number.isFinite(current) ? `${fmt.format(current)}°` : NULL_TEXT}</strong></div>
      <div class="room-climate-actions">
        <button data-room-climate-action="down" data-entity-id="${entityId}" title="Riduci temperatura" ${disabled}><i class="fa-solid fa-minus"></i></button>
        <strong>${Number.isFinite(target) ? `${fmt.format(target)}°` : NULL_TEXT}</strong>
        <button data-room-climate-action="up" data-entity-id="${entityId}" title="Aumenta temperatura" ${disabled}><i class="fa-solid fa-plus"></i></button>
        <button class="power ${active ? 'active' : ''}" data-room-climate-action="power" data-entity-id="${entityId}" title="Accendi o spegni" ${disabled}><i class="fa-solid fa-power-off"></i></button>
      </div>
    </div>`;
  }

  function contextHtml(room) {
    const snapshot = roomSnapshot(room.id);
    const lights = snapshot.devices.filter((device) => device.item.kind === 'light');
    const covers = snapshot.devices.filter((device) => device.item.kind === 'cover');

    return `<div class="room-device-context-layout">
      <div class="room-device-context-head">
        <div class="room-device-context-summary">
          <span class="room-device-context-icon"><i class="fa-solid ${room.icon || 'fa-door-open'}"></i></span>
          <span><strong>${room.name}</strong></span>
        </div>
        ${climateHtml(room.id)}
      </div>
      <div class="ha-device-sections">
        ${deviceSection('Luci', 'fa-lightbulb', lights, 'light')}
        ${deviceSection('Tapparelle', 'fa-window-maximize', covers, 'cover')}
        ${!snapshot.devices.length ? '<div class="rooms-empty">Nessun dispositivo configurato</div>' : ''}
      </div>
    </div>`;
  }

  function signature() {
    const values = [currentView(), selectedRoomId, connected() ? '1' : '0'];
    Object.entries(ROOM_DEVICES).forEach(([roomId, definitions]) => {
      values.push(roomId, String(temperatureFor(roomId)));
      definitions.forEach((item) => {
        const entity = resolveDevice(item);
        values.push(item.source, itemName(item), item.kind, entity?.entity_id || '', entity?.state || '', String(entity?.attributes?.current_position ?? ''));
      });
    });
    Object.keys(CLIMATE_SOURCE).forEach((roomId) => {
      const climate = resolveClimate(roomId);
      values.push(roomId, climate?.entity_id || '', climate?.state || '', String(climate?.attributes?.current_temperature ?? ''), String(climate?.attributes?.temperature ?? ''));
    });
    return values.join('|');
  }

  function injectStyles() {
    if (document.querySelector('#rooms-devices-v52-styles')) return;
    const style = document.createElement('style');
    style.id = 'rooms-devices-v52-styles';
    style.textContent = `
      .room-device-floor{flex:0 0 auto!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;height:auto!important;min-height:0!important;align-self:stretch!important;padding-bottom:.6rem!important}
      .room-device-list{display:grid;gap:.38rem;margin-top:.45rem}
      .room-device-card{display:grid;grid-template-columns:2.35rem minmax(0,1fr) auto;align-items:center;gap:.55rem;width:100%;padding:.48rem .55rem;border:1px solid rgba(255,255,255,.075);border-radius:.78rem;background:rgba(255,255,255,.035);color:#f8fbff;text-align:left;cursor:pointer;transition:.16s ease}
      .room-device-card:hover,.room-device-card.active{border-color:rgba(96,165,250,.52);background:rgba(37,99,235,.17)}
      .room-device-icon{display:grid;place-items:center;width:2.25rem;height:2.25rem;border-radius:.68rem;background:rgba(59,130,246,.15);color:#93c5fd}
      .room-device-main,.room-device-side{min-width:0}.room-device-main strong,.room-device-main small,.room-device-side strong,.room-device-side small{display:block}
      .room-device-main strong{font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.room-device-main small{margin-top:.15rem;font-size:.55rem;color:#92a6bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .room-device-side{text-align:right}.room-device-side strong{font-size:.78rem}.room-device-side small{margin-top:.15rem;font-size:.5rem;color:#8ea2b7;white-space:nowrap}.room-device-side small.active{color:#86efac}
      .context-panel.rooms-device-context{min-height:11.3rem;padding:.6rem .7rem;overflow:hidden}
      .room-device-context-layout{display:grid;grid-template-columns:12rem minmax(0,1fr);gap:.65rem;height:100%;align-items:stretch}
      .room-device-context-head{display:flex;flex-direction:column;gap:.5rem;justify-content:center;padding:.55rem;border-radius:.82rem;background:rgba(255,255,255,.045);min-width:0}
      .room-device-context-summary{display:grid;grid-template-columns:2.45rem minmax(0,1fr);gap:.48rem;align-items:center;min-width:0}
      .room-device-context-icon{display:grid;place-items:center;width:2.35rem;height:2.35rem;border-radius:.72rem;background:rgba(37,99,235,.2);color:#93c5fd}
      .room-device-context-summary>span:last-child{min-width:0}.room-device-context-summary strong,.room-device-context-summary small{display:block}.room-device-context-summary strong{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.room-device-context-summary small{margin-top:.15rem;font-size:.52rem;color:#94a7bd;line-height:1.35}
      .room-climate-control{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.4rem;padding:.48rem;border:1px solid rgba(255,255,255,.075);border-radius:.7rem;background:rgba(2,12,24,.3)}
      .room-climate-copy span,.room-climate-copy small,.room-climate-current small,.room-climate-current strong{display:block}.room-climate-copy span{font-size:.58rem;font-weight:800}.room-climate-copy small{margin-top:.12rem;font-size:.45rem;color:#8ea2b7}.room-climate-current{text-align:right}.room-climate-current small{font-size:.42rem;color:#8ea2b7}.room-climate-current strong{font-size:.68rem;margin-top:.1rem}
      .room-climate-actions{grid-column:1/3;display:grid;grid-template-columns:1.55rem minmax(2.4rem,1fr) 1.55rem 1.75rem;gap:.22rem;align-items:center}.room-climate-actions>strong{text-align:center;font-size:.75rem}.room-climate-actions button{display:grid;place-items:center;height:1.55rem;padding:0;border:1px solid rgba(255,255,255,.1);border-radius:.46rem;background:rgba(255,255,255,.055);color:#e5eef9;cursor:pointer;font-size:.55rem}.room-climate-actions button:hover:not(:disabled){background:#2563eb}.room-climate-actions button.power.active{background:rgba(34,197,94,.16);color:#86efac;border-color:rgba(74,222,128,.28)}.room-climate-actions button:disabled{cursor:not-allowed;opacity:.45}
      .ha-device-sections{display:grid;grid-template-rows:auto auto;gap:.42rem;align-content:center;min-width:0;overflow:hidden}
      .ha-device-section{display:grid;grid-template-columns:4.25rem minmax(0,1fr);gap:.38rem;align-items:center;min-width:0}
      .ha-device-section-title{display:flex;align-items:center;gap:.32rem;color:#9fb2c8;min-width:0}.ha-device-section-title i{color:#93c5fd;font-size:.68rem}.ha-device-section-title span{font-size:.53rem;font-weight:850;text-transform:uppercase;letter-spacing:.04em}.ha-device-section-title small{display:grid;place-items:center;min-width:1.15rem;height:1.15rem;border-radius:999px;background:rgba(255,255,255,.07);font-size:.45rem}
      .ha-device-row{display:flex;align-items:stretch;gap:.38rem;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding-bottom:.04rem}.ha-device-row::-webkit-scrollbar{display:none}
      .ha-device-tile{display:grid;grid-template-columns:1.85rem minmax(0,1fr) 1.55rem;align-items:center;gap:.4rem;flex:0 1 9.5rem;width:9.5rem;max-width:9.5rem;min-height:3.45rem;padding:.42rem;border:1px solid rgba(255,255,255,.075);border-radius:.72rem;background:rgba(255,255,255,.04);color:#f8fbff;text-align:left;min-width:0}
      button.ha-device-tile{cursor:pointer}.ha-device-tile:hover:not(:disabled){border-color:rgba(96,165,250,.5);background:rgba(37,99,235,.14)}.ha-device-tile.on{border-color:rgba(74,222,128,.28);background:rgba(34,197,94,.09)}.ha-device-tile.null{opacity:.58}
      .ha-device-icon{display:grid;place-items:center;width:1.8rem;height:1.8rem;border-radius:.56rem;background:rgba(59,130,246,.14);color:#93c5fd}.ha-device-tile.on .ha-device-icon{background:rgba(34,197,94,.15);color:#86efac}
      .ha-device-copy{min-width:0}.ha-device-copy strong,.ha-device-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ha-device-copy strong{font-size:.59rem}.ha-device-copy small{margin-top:.15rem;font-size:.49rem;color:#91a5bd}.ha-device-tile.on .ha-device-copy small{color:#86efac}.ha-device-tile.null .ha-device-copy small{color:#ff9d9d}
      .ha-device-power{display:grid;place-items:center;width:1.45rem;height:1.45rem;border-radius:.45rem;background:rgba(255,255,255,.06);font-size:.58rem;color:#8ea2b7}.ha-device-tile.on .ha-device-power{color:#86efac;background:rgba(34,197,94,.14)}
      .ha-device-tile.cover{grid-template-columns:1.85rem minmax(0,1fr) auto;flex-basis:12rem;width:12rem;max-width:12rem}.ha-cover-actions{display:flex;gap:.18rem}.ha-cover-actions button{display:grid;place-items:center;width:1.35rem;height:1.35rem;padding:0;border:1px solid rgba(255,255,255,.1);border-radius:.38rem;background:rgba(255,255,255,.055);color:#dce8f7;font-size:.52rem;cursor:pointer}.ha-cover-actions button:hover:not(:disabled){background:#2563eb}.ha-cover-actions button:disabled,.ha-device-tile:disabled{cursor:not-allowed}
      .rooms-empty{display:grid;place-items:center;color:#8ea2b7;font-size:.66rem}
      @media(max-width:1450px){.room-device-context-layout{grid-template-columns:10.5rem minmax(0,1fr)}.ha-device-section{grid-template-columns:3.65rem minmax(0,1fr)}.ha-device-tile{flex-basis:8.6rem;width:8.6rem;max-width:8.6rem}.ha-device-tile.cover{flex-basis:11.2rem;width:11.2rem;max-width:11.2rem}}
      @media(orientation:landscape) and (max-width:999px) and (max-height:600px){
        .room-device-list{gap:.18rem;margin-top:.2rem}.room-device-card{grid-template-columns:1.5rem minmax(0,1fr) auto;gap:.28rem;padding:.2rem .28rem;border-radius:.45rem}.room-device-icon{width:1.42rem;height:1.42rem;border-radius:.4rem;font-size:.55rem}.room-device-main strong{font-size:.45rem}.room-device-main small{font-size:.34rem}.room-device-side strong{font-size:.48rem}.room-device-side small{font-size:.32rem}
        .context-panel.rooms-device-context{bottom:36px;min-height:6.4rem;padding:.28rem .35rem}.room-device-context-layout{grid-template-columns:7.8rem minmax(0,1fr);gap:.3rem}.room-device-context-head{gap:.25rem;padding:.3rem;border-radius:.48rem}.room-device-context-summary{grid-template-columns:1.55rem minmax(0,1fr);gap:.22rem}.room-device-context-icon{width:1.45rem;height:1.45rem;border-radius:.4rem;font-size:.55rem}.room-device-context-summary strong{font-size:.48rem}.room-device-context-summary small{font-size:.31rem}
        .room-climate-control{gap:.2rem;padding:.25rem;border-radius:.4rem}.room-climate-copy span{font-size:.36rem}.room-climate-copy small,.room-climate-current small{font-size:.27rem}.room-climate-current strong{font-size:.4rem}.room-climate-actions{grid-template-columns:.92rem minmax(1.5rem,1fr) .92rem 1rem;gap:.1rem}.room-climate-actions>strong{font-size:.42rem}.room-climate-actions button{height:.9rem;border-radius:.25rem;font-size:.28rem}
        .ha-device-sections{gap:.2rem}.ha-device-section{grid-template-columns:2.55rem minmax(0,1fr);gap:.2rem}.ha-device-section-title{gap:.16rem}.ha-device-section-title i{font-size:.38rem}.ha-device-section-title span{font-size:.31rem}.ha-device-section-title small{min-width:.7rem;height:.7rem;font-size:.27rem}.ha-device-row{gap:.2rem}
        .ha-device-tile{grid-template-columns:1.2rem minmax(0,1fr) 1rem;gap:.22rem;flex-basis:5.7rem;width:5.7rem;max-width:5.7rem;min-height:2.1rem;padding:.22rem;border-radius:.45rem}.ha-device-tile.cover{grid-template-columns:1.2rem minmax(0,1fr) auto;flex-basis:7.15rem;width:7.15rem;max-width:7.15rem}.ha-device-icon{width:1.15rem;height:1.15rem;border-radius:.35rem;font-size:.42rem}.ha-device-copy strong{font-size:.38rem}.ha-device-copy small{font-size:.31rem}.ha-device-power{width:.9rem;height:.9rem;border-radius:.28rem;font-size:.36rem}.ha-cover-actions{gap:.1rem}.ha-cover-actions button{width:.82rem;height:.82rem;border-radius:.25rem;font-size:.3rem}
      }
    `;
    document.head.appendChild(style);
  }

  function render(force = false) {
    scheduled = false;
    injectStyles();
    if (currentView() !== 'stanze') return;

    const left = document.querySelector('#left-rail');
    const right = document.querySelector('#right-rail');
    const context = document.querySelector('#context-panel');
    if (!left || !right || !context) return;

    if (!ROOM_DEVICES[selectedRoomId]) selectedRoomId = Object.keys(ROOM_DEVICES)[0];
    const room = roomConfig(selectedRoomId) || rooms[0];
    const nextSignature = signature();
    const installed = Boolean(left.querySelector('[data-rooms-floor="first"]') && right.querySelector('[data-rooms-floor="second"]'));
    if (!force && installed && nextSignature === lastSignature) return;

    left.innerHTML = floorHtml('first');
    right.innerHTML = floorHtml('second');
    context.hidden = false;
    context.classList.add('rooms-device-context');
    context.innerHTML = contextHtml(room);
    lastSignature = nextSignature;
  }

  function schedule(force = false) {
    if (scheduled && !force) return;
    scheduled = true;
    requestAnimationFrame(() => render(force));
  }

  document.addEventListener('click', (event) => {
    const roomButton = event.target.closest('[data-room-device-select]');
    if (roomButton) {
      selectedRoomId = roomButton.dataset.roomDeviceSelect;
      schedule(true);
      return;
    }

    const toggle = event.target.closest('[data-ha-device-toggle]');
    if (toggle && toggle.dataset.haDeviceToggle) {
      const entityId = toggle.dataset.haDeviceToggle;
      const domain = entityId.split('.')[0];
      window.CASA_HA?.service?.(domain, 'toggle', entityId, {}, toggle).then(() => schedule(true));
      return;
    }

    const coverButton = event.target.closest('[data-ha-cover-action]');
    if (coverButton && coverButton.dataset.entityId) {
      window.CASA_HA?.service?.('cover', coverButton.dataset.haCoverAction, coverButton.dataset.entityId, {}, coverButton).then(() => schedule(true));
      return;
    }

    const climateButton = event.target.closest('[data-room-climate-action]');
    if (climateButton && climateButton.dataset.entityId) {
      const entityId = climateButton.dataset.entityId;
      const entity = states().get(entityId);
      const action = climateButton.dataset.roomClimateAction;
      if (action === 'power') {
        const service = normalize(entity?.state) === 'off' ? 'turn_on' : 'turn_off';
        window.CASA_HA?.service?.('climate', service, entityId, {}, climateButton).then(() => schedule(true));
        return;
      }
      const currentTarget = Number(entity?.attributes?.temperature);
      const fallback = Number(entity?.attributes?.current_temperature);
      const base = Number.isFinite(currentTarget) ? currentTarget : (Number.isFinite(fallback) ? fallback : 20);
      const temperature = Math.max(10, Math.min(30, Math.round((base + (action === 'up' ? 0.5 : -0.5)) * 2) / 2));
      window.CASA_HA?.service?.('climate', 'set_temperature', entityId, { temperature }, climateButton).then(() => schedule(true));
    }
  }, true);

  const observer = new MutationObserver(() => schedule(false));
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = setInterval(() => schedule(false), 750);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });
  schedule(true);
})();

/* ===== rooms-corrections-v57.js ===== */
(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  let applying = false;

  const ROOM_LIGHTS = {
    'first-salotto': ['Luce Salotto', 'Scale', 'Ingresso', 'Luce Esterna Salotto'],
    'first-cucina': ['Pensili Cucina'],
    'first-camera-matrimoniale': ['Luce Camera Matrimoniale', 'Luca Camera Matrimoniale'],
    'first-corridoio': ['Corridoio'],
    'first-studio': ['Luce Studio', 'Luce Esterna Studio'],
    'first-cameretta': ['Luce Cameretta'],
    'first-bagno-matrimoniale': ['Luce Bagno Matrimoniale', 'Specchio Bagno Matrimoniale'],
    'first-bagno-ospiti': ['Luce Bagno Ospiti', 'Specchio Bagno Ospiti'],
    'second-vano-tecnico': ['Luce Vano Tecnico', 'Vano Tecnico', 'Luce Locale Tecnico'],
    'second-bagno-mansarda': ['Luce Bagno Mansarda', 'Specchio Bagno Mansarda'],
    'second-mansarda': [
      'Led Mansarda DX',
      'Led Mansarda SX',
      'Led Mansarda Centrale',
      'Luce Esterna Mansarda',
      'Corridoio Mansarda',
    ],
    'second-camera-mansarda': ['Luce Camera Mansarda', 'Luce Esterna Camera Mansarda'],
  };

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

  function entityName(entity) {
    return normalize(entity?.attributes?.friendly_name || '');
  }

  function entityObjectId(entity) {
    return normalize(String(entity?.entity_id || '').split('.').slice(1).join(' '));
  }

  function stateIsUsable(entity) {
    return Boolean(entity && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state)));
  }

  function resolveEntity({ names = [], domains = [], exactIds = [] }) {
    const map = states();

    for (const entityId of exactIds) {
      const entity = map.get(entityId);
      if (entity && domains.includes(entity.entity_id.split('.')[0])) return entity;
    }

    const wantedNames = [...new Set(names.map(normalize).filter(Boolean))];
    let best = null;
    let bestScore = -Infinity;

    for (const entity of map.values()) {
      const domain = String(entity.entity_id || '').split('.')[0];
      if (!domains.includes(domain)) continue;

      const friendly = entityName(entity);
      const objectId = entityObjectId(entity);
      const text = normalize(`${friendly} ${objectId}`);
      let score = -Infinity;

      wantedNames.forEach((name, index) => {
        const penalty = index * 2;
        if (friendly === name) score = Math.max(score, 220 - penalty);
        else if (objectId === name) score = Math.max(score, 210 - penalty);
        else if (friendly.startsWith(`${name} `) || friendly.endsWith(` ${name}`)) {
          score = Math.max(score, 170 - penalty);
        } else {
          const tokens = name.split(' ').filter((token) => token.length > 2);
          if (tokens.length && tokens.every((token) => text.includes(token))) {
            score = Math.max(score, 105 + tokens.length * 8 - penalty);
          }
        }
      });

      if (stateIsUsable(entity)) score += 4;
      if (score > bestScore) {
        bestScore = score;
        best = entity;
      }
    }

    return bestScore >= 120 ? best : null;
  }

  function resolveLight(name) {
    return resolveEntity({
      names: [name],
      domains: ['light', 'switch', 'input_boolean'],
    });
  }

  function resolveVanoTecnicoLight() {
    return resolveEntity({
      names: ['Luce Vano Tecnico', 'Vano Tecnico', 'Luce Locale Tecnico', 'Locale Tecnico'],
      domains: ['light', 'switch', 'input_boolean'],
      exactIds: [
        'light.luce_vano_tecnico',
        'light.vano_tecnico',
        'light.locale_tecnico',
        'switch.luce_vano_tecnico',
        'switch.vano_tecnico',
        'switch.locale_tecnico',
        'input_boolean.luce_vano_tecnico',
      ],
    });
  }

  function resolveMansardaCover() {
    return resolveEntity({
      names: ['Tapparella Mansarda'],
      domains: ['cover'],
      exactIds: ['cover.tapparella_mansarda', 'cover.mansarda'],
    });
  }

  function patchRoomActivity() {
    Object.entries(ROOM_LIGHTS).forEach(([roomId, names]) => {
      const card = document.querySelector(`[data-room-device-select="${roomId}"]`);
      const statusNode = card?.querySelector('.room-device-side small');
      if (!statusNode) return;

      const uniqueEntities = new Map();
      names.forEach((name) => {
        const entity = roomId === 'second-vano-tecnico'
          ? resolveVanoTecnicoLight()
          : resolveLight(name);
        if (entity) uniqueEntities.set(entity.entity_id, entity);
      });

      const resolved = [...uniqueEntities.values()];
      const activeLights = resolved.filter((entity) => normalize(entity.state) === 'on').length;
      let label = 'Tutto spento';

      if (!resolved.length && names.length) label = NULL_TEXT;
      else if (activeLights === 1) label = '1 luce accesa';
      else if (activeLights > 1) label = `${activeLights} luci accese`;

      if (statusNode.textContent !== label) statusNode.textContent = label;
      statusNode.classList.toggle('active', activeLights > 0);
    });
  }

  function patchLightTile(tile, entity) {
    if (!tile || !entity) return;
    const status = normalize(entity.state);
    const expectedClass = status === 'on' ? 'on' : 'off';
    const expectedLabel = status === 'on' ? 'Accesa' : 'Spenta';

    if (tile.dataset.haDeviceToggle !== entity.entity_id) {
      tile.dataset.haDeviceToggle = entity.entity_id;
    }
    if (tile.hasAttribute('disabled')) tile.removeAttribute('disabled');
    if (!tile.classList.contains(expectedClass) || tile.classList.contains('null')) {
      tile.classList.remove('null', 'on', 'off');
      tile.classList.add(expectedClass);
    }

    const stateNode = tile.querySelector('.ha-device-copy small');
    if (stateNode && stateNode.textContent !== expectedLabel) stateNode.textContent = expectedLabel;
  }

  function patchVanoTecnico() {
    const selected = document.querySelector('[data-room-device-select="second-vano-tecnico"].active');
    if (!selected) return;
    const entity = resolveVanoTecnicoLight();
    const tile = document.querySelector('#context-panel .ha-device-section.light .ha-device-tile.light');
    patchLightTile(tile, entity);
  }

  function coverStatus(entity) {
    const state = normalize(entity?.state);
    if (state === 'closed') return { label: 'Chiusa', cls: 'closed' };
    if (state === 'closing') return { label: 'In chiusura', cls: 'moving' };
    if (state === 'opening') return { label: 'In apertura', cls: 'moving' };
    if (state === 'open') return { label: 'Aperta', cls: 'on' };
    const position = Number(entity?.attributes?.current_position);
    if (Number.isFinite(position)) {
      return position >= 99
        ? { label: 'Chiusa', cls: 'closed' }
        : { label: `${position.toLocaleString('it-IT', { maximumFractionDigits: 1 })}% chiusa`, cls: 'on' };
    }
    return { label: String(entity?.state || NULL_TEXT), cls: 'null' };
  }

  function patchMansardaCover() {
    const selected = document.querySelector('[data-room-device-select="second-mansarda"].active');
    if (!selected) return;

    const entity = resolveMansardaCover();
    if (!entity) return;

    const coverTiles = [...document.querySelectorAll('#context-panel .ha-device-section.cover .ha-device-tile.cover')];
    const tile = coverTiles.find((node) =>
      normalize(node.querySelector('.ha-device-copy strong')?.textContent) === 'portafinestra'
    ) || coverTiles[0];
    if (!tile) return;

    tile.querySelectorAll('[data-ha-cover-action]').forEach((button) => {
      if (button.dataset.entityId !== entity.entity_id) button.dataset.entityId = entity.entity_id;
      if (button.hasAttribute('disabled')) button.removeAttribute('disabled');
    });

    const status = coverStatus(entity);
    if (!tile.classList.contains(status.cls) || tile.classList.contains('null')) {
      tile.classList.remove('null', 'on', 'closed', 'moving');
      tile.classList.add(status.cls);
    }
    const stateNode = tile.querySelector('.ha-device-copy small');
    if (stateNode && stateNode.textContent !== status.label) stateNode.textContent = status.label;
  }

  function apply() {
    if (applying || normalize(document.querySelector('#view-title')?.textContent) !== 'stanze') return;
    applying = true;
    try {
      patchRoomActivity();
      patchVanoTecnico();
      patchMansardaCover();
    } finally {
      applying = false;
    }
  }

  // Osserva solo ricostruzioni del layout. Gli aggiornamenti testuali sono gestiti
  // dal timer e non devono riattivare ricorsivamente il MutationObserver.
  const observer = new MutationObserver(() => {
    if (!applying) requestAnimationFrame(apply);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const timer = setInterval(apply, 500);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  apply();
})();

/* ===== Integrazione indicatori stanze nel modello 3D ===== */
{
window.CASA_3D_CONTEXT = window.CASA_3D_CONTEXT || { scene:null, camera:null, renderer:null, anchors:[] };

const originalRender = THREE.WebGLRenderer.prototype.render;
THREE.WebGLRenderer.prototype.render = function(scene, camera) {
  window.CASA_3D_CONTEXT.scene = scene;
  window.CASA_3D_CONTEXT.camera = camera;
  window.CASA_3D_CONTEXT.renderer = this;
  return originalRender.call(this, scene, camera);
};

const originalLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function(url, onLoad, onProgress, onError) {
  return originalLoad.call(this, url, (gltf) => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const grouped = new Map();
    root.traverse((object) => {
      if (!object.isMesh || !object.name) return;
      const parts = object.name.split('__');
      if (!['first','second'].includes(parts[0]) || !parts[1] || parts[1] === 'none') return;
      const key = `${parts[0]}__${parts[1]}`;
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;
      if (!grouped.has(key)) grouped.set(key, box);
      else grouped.get(key).union(box);
    });
    window.CASA_3D_CONTEXT.anchors = [...grouped].map(([modelKey, box]) => {
      const point = box.getCenter(new THREE.Vector3());
      point.y = box.max.y + 0.18;
      return { modelKey, floor:modelKey.startsWith('first__')?'first':'second', point };
    });
    window.dispatchEvent(new CustomEvent('casa:rooms-ready', { detail:window.CASA_3D_CONTEXT.anchors }));
    onLoad?.(gltf);
  }, onProgress, onError);
};
}

/* ===== Correzione materiale mobile mansarda ===== */
{
const TARGET_NAME = "second__LivingRoom-39392__59111__media_unit_floor-based_media_unit__solid_015";
const originalLoad = GLTFLoader.prototype.load;

GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  const patchedOnLoad = (gltf) => {
    const target = gltf.scene?.getObjectByName(TARGET_NAME);
    if (target) {
      target.material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.62,
        metalness: 0,
        side: THREE.DoubleSide,
      });
    } else {
      console.warn(`Elemento non trovato per il fix v27: ${TARGET_NAME}`);
    }
    onLoad?.(gltf);
  };

  return originalLoad.call(this, url, patchedOnLoad, onProgress, onError);
};
}

/* ===== Applicazione 3D consolidata (app.js + patch v25/v26) ===== */
const $=s=>document.querySelector(s),canvas=$("#scene"),loading=$("#loading"),progress=$("#progress"),status=$("#status");
const scene=new THREE.Scene();scene.background=new THREE.Color(0xdce6f0);scene.fog=new THREE.Fog(0xdce6f0,45,100);
const camera=new THREE.PerspectiveCamera(38,1,.04,260);camera.position.set(22,18,22);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.03).texture;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.07;controls.screenSpacePanning=true;controls.minDistance=3;controls.maxDistance=90;controls.maxPolarAngle=Math.PI/2.01;
scene.add(new THREE.HemisphereLight(0xffffff,0x8b8b8b,1.5));const sun=new THREE.DirectionalLight(0xffffff,2.05);sun.position.set(15,24,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;scene.add(sun);const fill=new THREE.DirectionalLight(0xffffff,.35);fill.position.set(-15,11,-12);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.ShadowMaterial({color:0x64748b,opacity:.11}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const world=new THREE.Group(),first=new THREE.Group(),second=new THREE.Group();world.add(first,second);scene.add(world);
let current="both",selected=null,saved=null,down=null,allMeshes=[],allEntries=[];
function makeFabricTexture(base="#8b8f94", dark="#73777c"){
  const c=document.createElement('canvas'); c.width=128; c.height=128; const ctx=c.getContext('2d');
  ctx.fillStyle=base; ctx.fillRect(0,0,c.width,c.height);
  for(let i=0;i<2400;i++){ const x=Math.random()*128, y=Math.random()*128; const a=Math.random()*0.18; ctx.fillStyle=`rgba(0,0,0,${a})`; ctx.fillRect(x,y,1,1); }
  ctx.strokeStyle=dark; ctx.globalAlpha=.08;
  for(let i=0;i<128;i+=4){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(128,i); ctx.stroke(); }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2); return tex;
}
function makePlasticMaterial(color){ return new THREE.MeshPhysicalMaterial({color:new THREE.Color(color), roughness:.62, metalness:0.0, clearcoat:.18, clearcoatRoughness:.55, side:THREE.DoubleSide}); }
function makeWhiteUniform(){ return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.62, metalness:0.0, side:THREE.DoubleSide}); }
function makeMetalGray(){ return new THREE.MeshPhysicalMaterial({color:0xb7bcc2, roughness:.42, metalness:.88, envMapIntensity:1.0, side:THREE.DoubleSide}); }
function makeFabricGray(){ return new THREE.MeshPhysicalMaterial({color:0xc5c9cd, roughness:.95, metalness:0.0, map:makeFabricTexture('#c9cdd1','#a7adb3'), side:THREE.DoubleSide}); }

function makeInteriorWallWhite(){ return new THREE.MeshPhysicalMaterial({color:0xe6e1d8, roughness:.94, metalness:0.0, side:THREE.DoubleSide}); }
function makeBlackFabric(){ return new THREE.MeshPhysicalMaterial({color:0x242529, roughness:.97, metalness:0.0, map:makeFabricTexture('#2d2f33','#17191c'), side:THREE.DoubleSide}); }
function makeGrayMarble(){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const ctx=c.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,256,256); grad.addColorStop(0,'#d8d9da'); grad.addColorStop(.52,'#bfc1c3'); grad.addColorStop(1,'#a5a8ab');
  ctx.fillStyle=grad; ctx.fillRect(0,0,256,256);
  for(let i=0;i<24;i++){
    ctx.strokeStyle=`rgba(${Math.random()>.5?'255,255,255':'82,86,90'},${0.08+Math.random()*0.12})`;
    ctx.lineWidth=.7+Math.random()*1.8; ctx.beginPath();
    let x=Math.random()*256, y=Math.random()*256; ctx.moveTo(x,y);
    for(let j=0;j<7;j++){ x+=(Math.random()-.5)*72; y+=(Math.random()-.5)*34; ctx.lineTo(x,y); }
    ctx.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2.2,2.2);
  return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.38, metalness:0.0, map:tex, side:THREE.DoubleSide});
}
function makeMirrorMaterial(){ return new THREE.MeshPhysicalMaterial({color:0xf5f7fa, roughness:.035, metalness:1.0, envMapIntensity:1.8, side:THREE.DoubleSide}); }

function makeWoodTexture(base='#8d6f4f', dark='#6d5338', light='#b08d67'){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const ctx=c.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,256,0); grad.addColorStop(0,base); grad.addColorStop(.5,light); grad.addColorStop(1,base);
  ctx.fillStyle=grad; ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=6){ ctx.fillStyle=`rgba(255,255,255,${0.02+Math.random()*0.03})`; ctx.fillRect(0,y,256,1); }
  for(let i=0;i<90;i++){
    ctx.strokeStyle=`rgba(${Math.random()>.5?'255,255,255':'40,24,10'},${0.03+Math.random()*0.06})`;
    ctx.lineWidth=.6+Math.random()*1.1; ctx.beginPath();
    let x=Math.random()*256; ctx.moveTo(x,0); for(let y=0;y<=256;y+=24){ x += (Math.random()-.5)*14; ctx.lineTo(x,y); } ctx.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1.4,1.4); return tex;
}
function makeWoodMaterial(base='#8d6f4f', dark='#6d5338', light='#b08d67'){
  return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.72, metalness:0.0, map:makeWoodTexture(base,dark,light), side:THREE.DoubleSide});
}
function makeLinenMaterial(base='#d8d1c8', dark='#bab1a6', repeat=2.2){
  const mat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(base), roughness:.96, metalness:0.0, map:makeFabricTexture(base,dark), side:THREE.DoubleSide});
  if(mat.map) mat.map.repeat.set(repeat,repeat);
  return mat;
}
function makeQuiltTexture(base='#ece8e2', line='#d6d1ca', accent='rgba(255,255,255,0.18)'){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const ctx=c.getContext('2d');
  ctx.fillStyle=base; ctx.fillRect(0,0,256,256);
  for(let i=0;i<1800;i++){ const x=Math.random()*256, y=Math.random()*256; ctx.fillStyle=`rgba(0,0,0,${Math.random()*0.03})`; ctx.fillRect(x,y,1,1); }
  ctx.strokeStyle=line; ctx.lineWidth=2;
  for(let y=18;y<256;y+=36){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); }
  for(let x=18;x<256;x+=42){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,256); ctx.stroke(); }
  ctx.strokeStyle=accent; ctx.lineWidth=1;
  for(let y=0;y<256;y+=18){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2); return tex;
}
function makeQuiltMaterial(base='#ece8e2', line='#d6d1ca'){
  return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.95, metalness:0.0, map:makeQuiltTexture(base,line), side:THREE.DoubleSide});
}
function makeBedMaterialMasterUpholstery(){ return makeLinenMaterial('#c8beb1','#a59787',2.1); }
function makeBedMaterialMasterDuvet(){ return makeQuiltMaterial('#f1eee8','#d8d2c9'); }
function makeBedMaterialMasterAccent(){ return makeLinenMaterial('#b5a08e','#8b7767',2.6); }
function makeBedMaterialSecondHeadboard(){ return makeLinenMaterial('#6f7e8a','#55616b',2.0); }
function makeBedMaterialSecondDuvet(){ return makeQuiltMaterial('#dfe6ea','#bcc8cf'); }
function makeBedMaterialSecondPillows(){ return makeLinenMaterial('#f5f4f2','#d5d2cd',2.8); }
function makeBedMaterialSecondAccent(){ return makeWoodMaterial('#7f654a','#5d4733','#9a7a59'); }
function makeSofaRealisticLightGray(){
  const mat=new THREE.MeshPhysicalMaterial({color:0xcfd3d6, roughness:.98, metalness:0.0, map:makeFabricTexture('#c9ced2','#aab0b5'), side:THREE.DoubleSide});
  if(mat.map) mat.map.repeat.set(2.6,2.2);
  return mat;
}

function localMeshBounds(mesh){
  const pos=mesh.geometry?.attributes?.position;
  if(!pos) return null;
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox ? mesh.geometry.boundingBox.clone() : null;
}
function addDoorHandleToMesh(mesh){
  const bb=localMeshBounds(mesh); if(!bb) return;
  const size=new THREE.Vector3(); bb.getSize(size);
  const center=new THREE.Vector3(); bb.getCenter(center);
  const dims=[{axis:'x',v:size.x},{axis:'y',v:size.y},{axis:'z',v:size.z}].sort((a,b)=>b.v-a.v);
  const vertical='y';
  const widthAxis = dims.find(d=>d.axis!=='y')?.axis || 'x';
  const depthAxis = ['x','y','z'].find(a=>a!==vertical && a!==widthAxis) || 'z';
  const getMin=a=>bb.min[a], getMax=a=>bb.max[a], set=(obj,a,val)=>{obj[a]=val};
  const mat=makeMetalGray();
  const group=new THREE.Group(); group.name='door_handle';
  const barLen=Math.max(size.y*0.14,0.10); const barRadius=Math.max(Math.min(size.x,size.z,size.y)*0.015,0.010);
  const barGeom=new THREE.CylinderGeometry(barRadius,barRadius,barLen,18);
  const mountGeom=new THREE.CylinderGeometry(barRadius*0.65,barRadius*0.65,Math.max(size[depthAxis]*0.7,0.018),14);
  const sideOffset=Math.max(size[depthAxis]*0.55,0.018);
  const widthInset=Math.max(size[widthAxis]*0.08,0.055);
  const yPos=center.y;
  const widthPos=getMax(widthAxis)-widthInset;
  const faceFront=getMax(depthAxis)+sideOffset*0.5;
  const faceBack=getMin(depthAxis)-sideOffset*0.5;
  const makeSide=(face,sign)=>{
    const bar=new THREE.Mesh(barGeom,mat.clone());
    if(widthAxis==='x') bar.rotation.z=Math.PI/2;
    else if(widthAxis==='z') bar.rotation.x=Math.PI/2;
    const p=new THREE.Vector3(center.x,yPos,center.z); set(p,widthAxis,widthPos); set(p,depthAxis,face); bar.position.copy(p); group.add(bar);
    [-barLen*0.28,barLen*0.28].forEach(off=>{
      const mount=new THREE.Mesh(mountGeom,mat.clone());
      if(depthAxis==='x') mount.rotation.z=Math.PI/2; else if(depthAxis==='z') mount.rotation.x=Math.PI/2;
      const mp=p.clone(); mp.y+=off; set(mp,depthAxis, face - sign*sideOffset*0.30); mount.position.copy(mp); group.add(mount);
    });
  };
  makeSide(faceFront,1); makeSide(faceBack,-1);
  mesh.add(group);
}
function addThumbturnToMesh(mesh){
  const bb=localMeshBounds(mesh); if(!bb) return;
  const size=new THREE.Vector3(); bb.getSize(size);
  const center=new THREE.Vector3(); bb.getCenter(center);
  const dims=[{axis:'x',v:size.x},{axis:'y',v:size.y},{axis:'z',v:size.z}].sort((a,b)=>b.v-a.v);
  const widthAxis = dims.find(d=>d.axis!=='y')?.axis || 'x';
  const depthAxis = ['x','y','z'].find(a=>a!=='y' && a!==widthAxis) || 'z';
  const set=(obj,a,val)=>{obj[a]=val};
  const faceFront=bb.max[depthAxis]+Math.max(size[depthAxis]*0.5,0.015);
  const faceBack=bb.min[depthAxis]-Math.max(size[depthAxis]*0.5,0.015);
  const widthPos=bb.getCenter(new THREE.Vector3())[widthAxis];
  const yPos=center.y;
  const discR=Math.max(Math.min(size.x,size.z,size.y)*0.035,0.018);
  const discGeom=new THREE.CylinderGeometry(discR,discR,Math.max(size[depthAxis]*0.4,0.012),20);
  const slotGeom=new THREE.BoxGeometry(discR*1.25, discR*0.18, Math.max(size[depthAxis]*0.55,0.006));
  const group=new THREE.Group(); group.name='door_thumbturn';
  const addSide=(face)=>{
    const disc=new THREE.Mesh(discGeom,makeMetalGray());
    if(depthAxis==='x') disc.rotation.z=Math.PI/2; else if(depthAxis==='z') disc.rotation.x=Math.PI/2;
    const p=new THREE.Vector3(center.x,yPos,center.z); set(p,widthAxis,widthPos); set(p,depthAxis,face); disc.position.copy(p); group.add(disc);
    const slot=new THREE.Mesh(slotGeom,makeMetalGray());
    const sp=p.clone(); sp.y+=discR*0.03; slot.position.copy(sp); group.add(slot);
  };
  addSide(faceFront); addSide(faceBack); mesh.add(group);
}
function addDoorHardware(){
  const byInstance=new Map();
  allMeshes.forEach(mesh=>{
    const name=mesh.name||'';
    if(!name.includes('__door_')) return;
    const parts=name.split('__'); const instanceId=parts[2]||mesh.uuid;
    const title=parts[3]||'';
    if(!byInstance.has(instanceId)) byInstance.set(instanceId,{title,meshes:[]});
    byInstance.get(instanceId).meshes.push(mesh);
  });
  byInstance.forEach(({title,meshes})=>{
    const candidates=meshes.filter(m=>(m.geometry?.attributes?.position?.count||0)>0);
    if(!candidates.length) return;
    let target=candidates[0], best=-1;
    candidates.forEach(m=>{ const bb=localMeshBounds(m); if(!bb) return; const s=new THREE.Vector3(); bb.getSize(s); const vol=Math.abs(s.x*s.y*s.z); if(vol>best){best=vol; target=m;} });
    if(title.includes('door_pocket_door')) addThumbturnToMesh(target);
    else if(title.includes('door_entry_single_swing_door')) addDoorHandleToMesh(target);
  });
}
function prepare(root){const items=[];root.traverse(o=>{if(!o.isMesh)return;items.push(o);o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.side=THREE.DoubleSide;m.needsUpdate=true})});for(const o of items){const n=o.name||o.parent?.name||"";(n.startsWith("first__")?first:second).attach(o)}allMeshes=items;applyCustomOverrides();applySecondFloorMansard();buildObjectIndex()}
function bounds(){world.updateMatrixWorld(true);const b=new THREE.Box3();b.makeEmpty();if(first.visible)b.union(new THREE.Box3().setFromObject(first));if(second.visible)b.union(new THREE.Box3().setFromObject(second));return b}
function fit(top=false){const b=bounds();if(b.isEmpty())return;const size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),max=Math.max(size.x,size.z,size.y*1.55),fov=THREE.MathUtils.degToRad(camera.fov),dist=(max*.66)/Math.tan(fov/2)*(top?1.05:1.17);camera.position.copy(top?new THREE.Vector3(center.x,center.y+dist,center.z+.001):center.clone().add(new THREE.Vector3(1,.72,1).normalize().multiplyScalar(dist)));controls.target.copy(center);controls.update()}
function clear(){if(selected&&saved)selected.material=saved;selected=saved=null;$("#info").hidden=true}
function setFloor(mode){current=mode;first.visible=mode!=="second";second.visible=mode!=="first";document.querySelectorAll("[data-floor]").forEach(b=>b.classList.toggle("active",b.dataset.floor===mode));status.textContent=mode==="both"?"Entrambi i piani":mode==="first"?"Primo piano":"Secondo piano";ground.position.y=mode==="second"?-.12:-3.02;clear();applySearchFilter($("#object-search")?.value||"");requestAnimationFrame(()=>fit(false))}
function parseParts(name=""){const parts=name.split("__");return {floorCode:parts[0]||"",roomCode:parts[1]||"",instanceId:parts[2]||"",title:(parts[3]||"Elemento").replaceAll("_"," "),slot:(parts[4]||parts.at(-1)||"mesh").replaceAll("_"," "),raw:name}}
function floorLabel(code){return code==="first"?"Primo piano":code==="second"?"Secondo piano":code||"-"}
function closeObjectList(){const panel=$("#object-list");panel.hidden=true;$("#list-toggle").classList.remove("active")}
function focusObject(obj){const box=new THREE.Box3().setFromObject(obj);const center=box.getCenter(new THREE.Vector3());controls.target.copy(center);camera.position.copy(center.clone().add(new THREE.Vector3(1,.55,1).normalize().multiplyScalar(Math.max(1.4,box.getSize(new THREE.Vector3()).length()*1.8))));controls.update()}
function selectObject(obj){clear();selected=obj;saved=selected.material;const arr=Array.isArray(saved)?saved:[saved];const hi=arr.map(m=>{const c=m.clone();if("emissive"in c){c.emissive.set(0x1f65d1);c.emissiveIntensity=.32}return c});selected.material=Array.isArray(saved)?hi:hi[0];const meta=parseParts(selected.name||"");$("#info-title").textContent=meta.title;$("#info-detail").textContent=`${meta.slot} · ${floorLabel(meta.floorCode)}`;$("#meta-floor").textContent=floorLabel(meta.floorCode);$("#meta-room").textContent=meta.roomCode||"-";$("#meta-instance").textContent=meta.instanceId||"-";$("#meta-slot").textContent=meta.slot||"-";$("#object-code").value=meta.raw;$("#info").hidden=false}
function pick(e){const r=canvas.getBoundingClientRect();const pointer=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1));const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);const visible=allMeshes.filter(o=>o.visible&&o.parent?.visible!==false);const hits=ray.intersectObjects(visible,false);if(!hits.length){clear();return}selectObject(hits[0].object)}
function buildObjectIndex(){const map=new Map();for(const mesh of allMeshes){if(mesh.visible===false)continue;const meta=parseParts(mesh.name||"");const key=meta.raw||mesh.uuid;if(!map.has(key)){map.set(key,{mesh,meta,text:`${meta.title} ${meta.slot} ${meta.roomCode} ${meta.instanceId} ${meta.raw}`.toLowerCase()})}}allEntries=[...map.values()].sort((a,b)=>a.meta.title.localeCompare(b.meta.title));applySearchFilter("")}
function applySearchFilter(term){const results=$("#object-results"); if(!results) return; const q=(term||"").trim().toLowerCase(); results.innerHTML=""; const filtered=allEntries.filter(entry=>{if(current==="first"&&entry.meta.floorCode!=="first")return false; if(current==="second"&&entry.meta.floorCode!=="second")return false; return !q || entry.text.includes(q)}); $("#object-count").textContent=`${filtered.length} oggetti`; filtered.slice(0,400).forEach(entry=>{const btn=document.createElement('button'); btn.className='object-item'; btn.innerHTML=`<strong>${entry.meta.title}</strong><small>${floorLabel(entry.meta.floorCode)} · ${entry.meta.roomCode || '-'} · ${entry.meta.slot}</small>`; btn.onclick=()=>{selectObject(entry.mesh);focusObject(entry.mesh);closeObjectList();$("#info").hidden=false}; results.appendChild(btn)}); if(filtered.length>400){const more=document.createElement('div'); more.className='object-count'; more.textContent='Mostrati solo i primi 400 risultati. Affina la ricerca.'; results.appendChild(more)}}
function meshesByPredicate(pred){ return allMeshes.filter(m=>pred(m.name||"", m)); }
function assignMaterial(meshes, materialFactory){ meshes.forEach((mesh, idx)=>{ const mat=materialFactory(mesh, idx); if(mat) mesh.material=mat; }); }
function cloneMaterialPreservingTextures(sourceMesh){ const src=Array.isArray(sourceMesh.material)?sourceMesh.material[0]:sourceMesh.material; return src?.clone ? src.clone() : src; }

function meshByName(name){ return allMeshes.find(m => m.name === name); }
function hideMesh(name){ const m=meshByName(name); if(m) m.visible=false; }
function setMaterial(name, materialFactory){ const m=meshByName(name); if(m) m.material=materialFactory(); }
function shiftMeshesTowardBaseCenter(targetNames, baseName, fraction=.5){
  const targets=targetNames.map(meshByName).filter(Boolean); const base=meshByName(baseName);
  if(!targets.length || !base) return;
  world.updateMatrixWorld(true);
  const tb=new THREE.Box3(); targets.forEach(m=>tb.expandByObject(m));
  const bb=new THREE.Box3().setFromObject(base);
  const tc=tb.getCenter(new THREE.Vector3()), bc=bb.getCenter(new THREE.Vector3()), bs=bb.getSize(new THREE.Vector3());
  const axis=bs.x>=bs.z?'x':'z';
  const raw=(bc[axis]-tc[axis])*fraction;
  const limit=Math.max(bs[axis]*.12,.04);
  const delta=THREE.MathUtils.clamp(raw,-limit,limit);
  targets.forEach(m=>{m.position[axis]+=delta;});
}
function scaleInstanceAroundCenter(instanceId, factor=.9){
  const meshes=allMeshes.filter(m=>(m.name||'').includes(`__${instanceId}__`));
  if(!meshes.length) return;
  world.updateMatrixWorld(true);
  const box=new THREE.Box3(); meshes.forEach(m=>box.expandByObject(m));
  const centerWorld=box.getCenter(new THREE.Vector3());
  const parent=meshes[0].parent || world;
  const centerLocal=parent.worldToLocal(centerWorld.clone());
  const holder=new THREE.Group(); holder.name=`scaled_instance_${instanceId}`; holder.position.copy(centerLocal); parent.add(holder); holder.updateMatrixWorld(true);
  meshes.forEach(m=>holder.attach(m));
  holder.scale.setScalar(factor);
}
function scaleMeshHeightFromBottom(name, factor=.95){
  const mesh=meshByName(name);
  if(!mesh || !mesh.geometry?.attributes?.position) return;
  const geom=mesh.geometry.clone();
  geom.computeBoundingBox();
  const bb=geom.boundingBox;
  const bottom=bb.min.y;
  const pos=geom.attributes.position;
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i);
    pos.setY(i, bottom + (y-bottom)*factor);
  }
  pos.needsUpdate=true;
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  mesh.geometry=geom;
}
function secondFloorRoofHeightAtZ(z){
  const zLow = -4.80556011;
  const zPeak = 2.03959;
  const zHigh = 6.03425978;
  const hLow = 0.86;
  const hPeak = 3.10;
  const hHigh = 2.05;
  if(z <= zPeak){
    const t = THREE.MathUtils.clamp((z - zLow) / Math.max(0.001, zPeak - zLow), 0, 1);
    return THREE.MathUtils.lerp(hLow, hPeak, t);
  }
  const t = THREE.MathUtils.clamp((z - zPeak) / Math.max(0.001, zHigh - zPeak), 0, 1);
  return THREE.MathUtils.lerp(hPeak, hHigh, t);
}
function isSecondFloorMansardMesh(name=''){
  if(!name.startsWith('second__')) return false;
  // Regola robusta: sul secondo piano deformiamo tutti i mesh architettonici/strutturali,
  // cioè quelli il cui terzo segmento NON è un instance id numerico di un arredo.
  // In questo modo il profilo mansardato copre anche Other, Component generici,
  // strutture personalizzate, front/back e tutte le pareti delle terrazze.
  const parts = name.split('__');
  if(parts.length < 4) return false;
  const category = parts[2] || '';
  if(category === 'Floor') return false;
  return !/^\d+$/.test(category);
}
function deformMeshForSecondFloorMansard(mesh){
  if(!mesh || !mesh.geometry?.attributes?.position) return;
  const geom = mesh.geometry.clone();
  const pos = geom.attributes.position;
  const world = mesh.matrixWorld.clone();
  const inv = mesh.matrixWorld.clone().invert();
  const p = new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(world);
    if(p.y > 0.001){
      const roofY = secondFloorRoofHeightAtZ(p.z);
      if(p.y > roofY) p.y = roofY;
    }
    p.applyMatrix4(inv);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  mesh.geometry = geom;
}
function applySecondFloorMansard(){
  world.updateMatrixWorld(true);
  const targets=allMeshes.filter(m => isSecondFloorMansardMesh(m.name || ''));
  targets.forEach(deformMeshForSecondFloorMansard);
  world.updateMatrixWorld(true);
  console.info(`Profilo mansardato applicato a ${targets.length} elementi strutturali del secondo piano.`);
}
function applyCustomOverrides(){
  // 1) shelf uses same texture/material as kitchen cabinet
  const sourceCabinet = allMeshes.find(m => m.name === 'first__LivingDiningRoom-116276__169003__cabinet_floor-based_kitchen_cabinet__solid_001');
  const targetShelf = allMeshes.find(m => m.name === 'first__LivingDiningRoom-116276__172324__shelf_decorative_shelf__solid_001');
  if(sourceCabinet && targetShelf){ const mat = cloneMaterialPreservingTextures(sourceCabinet); if(mat) targetShelf.material = mat; }

  // 1b) hide unwanted cabinet slot and force wall cabinet slot white
  const hiddenCabinetPart = allMeshes.find(m => m.name === 'first__LivingDiningRoom-116276__169003__cabinet_floor-based_kitchen_cabinet__solid_004');
  if(hiddenCabinetPart) hiddenCabinetPart.visible = false;
  const wallCabinetWhite = allMeshes.find(m => m.name === 'first__LivingDiningRoom-116276__169004__cabinet_wall-attached_cabinet__solid_003');
  if(wallCabinetWhite) wallCabinetWhite.material = makeWhiteUniform();

  // 2) white plastic chairs incl. legs
  const whiteChairInstances = ['175690','175676','172338','172345','172348','172351','172354','172357'];
  assignMaterial(meshesByPredicate(name => whiteChairInstances.some(id => name.includes(`__${id}__chair_chair__`))), () => makeWhiteUniform());

  // 3) blue plastic chair shells
  const blueInstances = ['165836','165832'];
  assignMaterial(meshesByPredicate(name => blueInstances.some(id => name.includes(`__${id}__chair_chair__`)) && (name.endsWith('__solid_002') || name.endsWith('__solid_003'))), () => makePlasticMaterial('#2563eb'));

  // 4) light-blue plastic chair shells
  assignMaterial(meshesByPredicate(name => name.includes('__165822__chair_chair__') && (name.endsWith('__solid_002') || name.endsWith('__solid_003'))), () => makePlasticMaterial('#7dd3fc'));

  // 5) gray fabric sofa part
  assignMaterial(meshesByPredicate(name => name === 'first__LivingDiningRoom-116276__165791__sofa_type_L_sofa__solid_002'), () => makeFabricGray());

  // realistic beds - first floor master bedroom
  ['first__MasterBedroom-105249__156058__bed_king-size_bed__solid_001','first__MasterBedroom-105249__156058__bed_king-size_bed__solid_004'].forEach(name=>setMaterial(name, makeBedMaterialMasterUpholstery));
  setMaterial('first__MasterBedroom-105249__156058__bed_king-size_bed__solid_002', makeBedMaterialMasterDuvet);
  setMaterial('first__MasterBedroom-105249__156058__bed_king-size_bed__solid_003', makeBedMaterialMasterAccent);

  // realistic beds - second floor bedroom, visually different from first floor
  ['second__Bedroom-35912__81315__bed_king-size_bed__solid_001','second__Bedroom-35912__81315__bed_king-size_bed__solid_005'].forEach(name=>setMaterial(name, makeBedMaterialSecondHeadboard));
  setMaterial('second__Bedroom-35912__81315__bed_king-size_bed__solid_008', makeBedMaterialSecondAccent);
  ['second__Bedroom-35912__81315__bed_king-size_bed__solid_002','second__Bedroom-35912__81315__bed_king-size_bed__solid_006'].forEach(name=>setMaterial(name, makeBedMaterialSecondDuvet));
  ['second__Bedroom-35912__81315__bed_king-size_bed__solid_003','second__Bedroom-35912__81315__bed_king-size_bed__solid_004','second__Bedroom-35912__81315__bed_king-size_bed__solid_007'].forEach(name=>setMaterial(name, makeBedMaterialSecondPillows));

  // more realistic light-gray fabric sofa on second floor
  setMaterial('second__LivingRoom-39392__50216__sofa_multi_seat_sofa__solid_001', makeSofaRealisticLightGray);

  // 6) media unit white uniform for selected slots
  const mediaTargets = new Set([
    'first__LivingDiningRoom-116276__165792__media_unit_floor-based_media_unit__solid_015',
    'first__LivingDiningRoom-116276__165792__media_unit_floor-based_media_unit__solid_016'
  ]);
  assignMaterial(meshesByPredicate(name => mediaTargets.has(name)), () => makeWhiteUniform());

  // Internal walls: warm off-white, visually distinct from pure-white furniture.
  assignMaterial(meshesByPredicate(name => name.includes('__WallInner__')), () => makeInteriorWallWhite());

  // Living/dining room details.
  setMaterial('first__LivingDiningRoom-116276__159314__storage_unit_armoire__solid_003', makeWhiteUniform);
  setMaterial('first__LivingDiningRoom-116276__169004__cabinet_wall-attached_cabinet__solid_002', makeWhiteUniform);
  setMaterial('first__LivingDiningRoom-116276__165832__chair_chair__solid_001', () => makePlasticMaterial('#2563eb'));
  setMaterial('first__LivingDiningRoom-116276__165836__chair_chair__solid_001', () => makePlasticMaterial('#2563eb'));
  setMaterial('first__LivingDiningRoom-116276__165822__chair_chair__solid_001', () => makePlasticMaterial('#7dd3fc'));

  // Doors: keep leaves white; built-in normal-door hardware stainless; no hardware on pocket doors.
  assignMaterial(meshesByPredicate(name => name.includes('__door_entry_single_swing_door__solid_002')), () => makeMetalGray());
  meshesByPredicate(name => name.includes('__door_pocket_door__solid_002')).forEach(m => m.visible=false);

  // Other room.
  setMaterial('first__OtherRoom-109066__175671__bed_crib__glass_001', makeWhiteUniform);
  setMaterial('first__OtherRoom-109066__159304__chair_armchair__solid_001', makeBlackFabric);

  // Bathrooms and bedroom.
  setMaterial('first__MasterBathroom-92592__Floor__925921785240859085_092592', makeGrayMarble);
  setMaterial('first__MasterBathroom-92592__149503__shower_shower_screen__solid_002', makeMetalGray);
  setMaterial('first__MasterBedroom-105249__156064__storage_unit_armoire__solid_001', makeMirrorMaterial);
  scaleMeshHeightFromBottom('first__MasterBedroom-105249__156064__storage_unit_armoire__solid_001', .995);
  hideMesh('first__Bathroom-109096__159307__shower_shower_screen__solid_002');
  hideMesh('second__Bathroom-37895__59107__shower_shower_screen__solid_002');

  // Equipment-room cabinet.
  setMaterial('second__EquipmentRoom-36717__61164__cabinet_floor-based_cabinet__solid_002', makeWhiteUniform);
  setMaterial('second__EquipmentRoom-36717__61164__cabinet_floor-based_cabinet__solid_003', makeWhiteUniform);

  // Terrace: remove selected parts, then reduce the whole floor-based outdoor-furniture instance by 10%.
  hideMesh('first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__glass_001');
  hideMesh('first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__solid_005');
  hideMesh('first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__solid_006');
  scaleInstanceAroundCenter('179008', .765);
}
canvas.addEventListener("pointerdown",e=>down={x:e.clientX,y:e.clientY});canvas.addEventListener("pointerup",e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5)pick(e);down=null});$("#close").onclick=clear;$("#copy-code").onclick=async()=>{const value=$("#object-code").value;try{await navigator.clipboard.writeText(value);const btn=$("#copy-code");const old=btn.textContent;btn.textContent="Copiato";setTimeout(()=>btn.textContent=old,1200)}catch{}};document.querySelectorAll("[data-floor]").forEach(b=>b.onclick=()=>setFloor(b.dataset.floor));$("#iso").onclick=()=>fit(false);$("#topview").onclick=()=>fit(true);$("#rotate").onclick=e=>{controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.55;e.currentTarget.classList.toggle("active",controls.autoRotate)};$("#reset").onclick=()=>{controls.autoRotate=false;$("#rotate").classList.remove("active");setFloor(current)};$("#full").onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch{}};$("#list-toggle").onclick=()=>{const panel=$("#object-list");const opening=panel.hidden;if(opening){panel.hidden=false;$("#list-toggle").classList.add("active");$("#object-search").focus();applySearchFilter($("#object-search").value||"")}else{closeObjectList()}};$("#close-list").onclick=closeObjectList;document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeObjectList()}});$("#object-search").addEventListener('input',e=>applySearchFilter(e.target.value));
new GLTFLoader().load("./assets/casa_homestyler.glb?v=29",g=>{prepare(g.scene);setFloor("both");loading.classList.add("hidden")},p=>{if(p.total)progress.textContent=`${Math.round(p.loaded/p.total*100)}%`;else progress.textContent="Download modello…"},e=>{console.error("Errore caricamento modello:",e);loading.classList.add("hidden")});
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight,d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.floor(w*d)||canvas.height!==Math.floor(h*d)){renderer.setPixelRatio(d);renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix()}}function loop(){resize();controls.update();renderer.render(scene,camera);requestAnimationFrame(loop)}loop();

/* ===== Navigazione dashboard ===== */
{
const scene = document.querySelector('#scene');
if (scene) {
  scene.style.pointerEvents = 'auto';
  scene.style.touchAction = 'none';
}

const visibleFloorButtons = [...document.querySelectorAll('.tablet-floor-nav [data-floor]')];
const legacyFloorButtons = [...document.querySelectorAll('.floors [data-floor]')];

visibleFloorButtons.forEach((button) => {
  button.addEventListener('click', () => {
    visibleFloorButtons.forEach((item) => item.classList.toggle('active', item === button));
    legacyFloorButtons.find((item) => item.dataset.floor === button.dataset.floor)?.click();
  });
});

const fullButton = document.querySelector('#full');
fullButton?.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn('Schermo intero non disponibile', error);
  }
});

document.querySelector('#reset')?.addEventListener('click', () => location.reload());

const note = document.querySelector('#detail-note');
if (note) {
  note.innerHTML = 'Dati demo. Trascina la casa per ruotarla, usa due dita per zoomare e i pulsanti per cambiare piano. Per i dati reali collega Home Assistant in <code>config.js</code>.';
}
}
