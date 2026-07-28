const cfg = window.CASA_DASHBOARD_CONFIG || { mode: 'demo', refreshMs: 5000, entities: {} };
const $ = (selector) => document.querySelector(selector);
const ids = [
  'clock','date','house-power','house-today','house-cost','house-peak','house-vs',
  'pv-power','pv-flow-production','pv-home-use','pv-grid-flow','pv-today','pv-self','grid-import','grid-export',
  'network-state','network-down','network-up','network-ping','network-clients',
  'shelly-total','hp-power','hp-mode','induction-power','shelly-today',
  'appliances-total','washer-power','dryer-power','oven-power','fridge-power',
  'tech-total','tv-zone-total','studio-total','media-lab-total','gaming-core-total',
  'internet-pill','ha-pill','backup-pill','detail-title','detail-grid','detail-note','detail-panel'
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const power = (value) => Number(value) >= 1000 ? `${number.format(Number(value) / 1000)} kW` : `${Math.round(Number(value) || 0)} W`;
const energy = (value) => `${number.format(Number(value) || 0)} kWh`;
const speed = (value) => Number(value) >= 1000 ? `${number.format(Number(value) / 1000)} Gbps` : `${number.format(Number(value) || 0)} Mbps`;
const sum = (...values) => values.reduce((total, value) => total + Number(value || 0), 0);
let latest = null;
let activeDetail = 'pv';

function text(id, value) { if (el[id]) el[id].textContent = value; }
function updateClock() {
  const now = new Date();
  text('clock', now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
  text('date', now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }));
}
updateClock(); setInterval(updateClock, 1000);

const demoBase = {
  housePower: 3280, houseToday: 18.6, houseCost: 5.31, housePeak: 5.42, houseVs: -6,
  pvPower: 4180, pvToday: 19.8, pvSelf: 78, gridImport: 5.2, gridExport: 6.8,
  heatPumpPower: 1420, heatPumpToday: 7.8, heatPumpMonth: 126.4, heatPumpMode: 'Raffrescamento',
  inductionPower: 0, inductionSession: 0, inductionToday: 1.1, inductionPeak: 3.6,
  washerPower: 510, washerToday: 0.8, washerState: 'In funzione', dryerPower: 0, dryerToday: 0, dryerState: 'Spenta',
  ovenPower: 0, ovenToday: 0.5, ovenState: 'Spento', fridgePower: 180, fridgeToday: 1.1, fridgeState: 'Compressore attivo',
  tvPower: 112, shieldPower: 9, mediaPcPower: 48, hddPower: 17,
  pcPower: 250, monitorPower: 38, ps5Power: 0, dockPower: 22,
  networkState: 'Online', networkLinkDown: 2500, networkLinkUp: 1000, networkCurrentDown: 412, networkCurrentUp: 84,
  networkPing: 7, networkJitter: 1.4, networkPacketLoss: 0, networkUptimeHours: 326,
  networkClients: 31, networkWifiClients: 18, backup5gStatus: 'Standby'
};
function jitter(base) {
  const data = { ...base };
  ['housePower','pvPower','heatPumpPower','washerPower','fridgePower','tvPower','shieldPower','mediaPcPower','hddPower','pcPower','monitorPower','dockPower','networkCurrentDown','networkCurrentUp','networkPing','networkJitter'].forEach((key) => {
    data[key] = Math.max(0, Number(base[key] || 0) * (1 + (Math.random() * .06 - .03)));
  });
  return data;
}

function render(data) {
  latest = data;
  const appliancesTotal = sum(data.washerPower,data.dryerPower,data.ovenPower,data.fridgePower);
  const tvTotal = sum(data.tvPower,data.shieldPower,data.mediaPcPower,data.hddPower);
  const studioTotal = sum(data.pcPower,data.monitorPower,data.ps5Power,data.dockPower);
  const techTotal = tvTotal + studioTotal;
  const shellyTotal = sum(data.heatPumpPower,data.inductionPower);
  const pvHomeUse = Math.min(Number(data.pvPower || 0), Number(data.housePower || 0));
  const netGrid = Number(data.pvPower || 0) - Number(data.housePower || 0);

  text('house-power', power(data.housePower)); text('house-today', energy(data.houseToday)); text('house-cost', euro.format(data.houseCost));
  text('house-peak', `${number.format(data.housePeak)} kW`); text('house-vs', `${data.houseVs > 0 ? '+' : ''}${Math.round(data.houseVs)}%`);

  text('pv-power', power(data.pvPower)); text('pv-flow-production', power(data.pvPower)); text('pv-home-use', power(pvHomeUse));
  text('pv-grid-flow', `${netGrid >= 0 ? '↑ ' : '↓ '}${power(Math.abs(netGrid))}`); text('pv-today', energy(data.pvToday));
  text('pv-self', `${Math.round(data.pvSelf)}%`); text('grid-import', energy(data.gridImport)); text('grid-export', energy(data.gridExport));

  text('network-state', data.networkState); text('network-down', speed(data.networkLinkDown)); text('network-up', speed(data.networkLinkUp));
  text('network-ping', `${number.format(data.networkPing)} ms`); text('network-clients', `${Math.round(data.networkClients)} disp.`);

  text('shelly-total', power(shellyTotal)); text('hp-power', power(data.heatPumpPower)); text('hp-mode', data.heatPumpMode);
  text('induction-power', power(data.inductionPower)); text('shelly-today', energy(sum(data.heatPumpToday,data.inductionToday)));

  text('appliances-total', power(appliancesTotal)); text('washer-power', power(data.washerPower)); text('dryer-power', power(data.dryerPower));
  text('oven-power', power(data.ovenPower)); text('fridge-power', power(data.fridgePower));

  text('tech-total', power(techTotal)); text('tv-zone-total', power(tvTotal)); text('studio-total', power(studioTotal));
  text('media-lab-total', power(sum(data.mediaPcPower,data.hddPower))); text('gaming-core-total', power(sum(data.pcPower,data.ps5Power)));

  if (el['internet-pill']) {
    el['internet-pill'].className = `pill ${String(data.networkState).toLowerCase().includes('online') ? 'ok' : 'bad'}`;
    el['internet-pill'].innerHTML = `<i class="fa-solid fa-globe"></i> FTTH ${data.networkState}`;
  }
  if (el['backup-pill']) {
    const active = String(data.backup5gStatus).toLowerCase().includes('attiv');
    el['backup-pill'].className = `pill ${active ? 'ok' : 'warn'}`;
    el['backup-pill'].innerHTML = `<i class="fa-solid fa-tower-cell"></i> 5G ${data.backup5gStatus}`;
  }
  if (el['ha-pill']) el['ha-pill'].innerHTML = `<i class="fa-solid fa-server"></i> ${cfg.mode === 'homeassistant' ? 'Home Assistant live' : 'Home Assistant demo'}`;
  renderDetail(activeDetail);
}

const detailIcons = { pv:'fa-solar-panel', network:'fa-wifi', hp:'fa-fan', induction:'fa-fire-flame-simple', appliances:'fa-plug', tv:'fa-tv', studio:'fa-gamepad' };
function detailDefinition(key, data) {
  const appliancesTotal = sum(data.washerPower,data.dryerPower,data.ovenPower,data.fridgePower);
  const tvTotal = sum(data.tvPower,data.shieldPower,data.mediaPcPower,data.hddPower);
  const studioTotal = sum(data.pcPower,data.monitorPower,data.ps5Power,data.dockPower);
  const defs = {
    pv:{title:'Fotovoltaico',rows:[['Produzione',power(data.pvPower)],['Oggi',energy(data.pvToday)],['Autoconsumo',`${Math.round(data.pvSelf)}%`],['Rete',`${energy(data.gridImport)} / ${energy(data.gridExport)}`]]},
    network:{title:'Rete · FRITZ!Box 7690',rows:[['Traffico ↓ / ↑',`${speed(data.networkCurrentDown)} / ${speed(data.networkCurrentUp)}`],['Ping / jitter',`${number.format(data.networkPing)} / ${number.format(data.networkJitter)} ms`],['Perdita pacchetti',`${number.format(data.networkPacketLoss)}%`],['Uptime / Wi‑Fi',`${number.format(data.networkUptimeHours)} h · ${Math.round(data.networkWifiClients)} client`]]},
    hp:{title:'Pompa di calore',rows:[['Consumo',power(data.heatPumpPower)],['Oggi',energy(data.heatPumpToday)],['Modalità',data.heatPumpMode],['Mese',energy(data.heatPumpMonth)]]},
    induction:{title:'Piano a induzione',rows:[['Consumo',power(data.inductionPower)],['Sessione',energy(data.inductionSession)],['Oggi',energy(data.inductionToday)],['Picco',`${number.format(data.inductionPeak)} kW`]]},
    appliances:{title:`Elettrodomestici · ${power(appliancesTotal)}`,rows:[['Lavatrice',`${power(data.washerPower)} · ${data.washerState}`],['Asciugatrice',`${power(data.dryerPower)} · ${data.dryerState}`],['Forno',`${power(data.ovenPower)} · ${data.ovenState}`],['Frigorifero',`${power(data.fridgePower)} · ${data.fridgeState}`]]},
    tv:{title:`Zona TV · ${power(tvTotal)}`,rows:[['TV',power(data.tvPower)],['Nvidia Shield',power(data.shieldPower)],['Mini PC',power(data.mediaPcPower)],['HDD',power(data.hddPower)]]},
    studio:{title:`Studio e gaming · ${power(studioTotal)}`,rows:[['PC',power(data.pcPower)],['Monitor',power(data.monitorPower)],['PS5',power(data.ps5Power)],['Dock / splitter',power(data.dockPower)]]}
  };
  return defs[key] || defs.pv;
}
function renderDetail(key) {
  if (!latest || !el['detail-grid']) return;
  activeDetail = key;
  const detail = detailDefinition(key, latest);
  if (el['detail-title']) el['detail-title'].innerHTML = `<i class="fa-solid ${detailIcons[key] || detailIcons.pv}"></i> ${detail.title}`;
  if (el['detail-panel']) el['detail-panel'].dataset.detail = key;
  el['detail-grid'].innerHTML = '';
  detail.rows.forEach(([label,value]) => {
    const cell = document.createElement('div'); cell.className = 'detail-cell';
    cell.innerHTML = `<small>${label}</small><strong>${value}</strong>`; el['detail-grid'].appendChild(cell);
  });
  document.querySelectorAll('.hotspot').forEach((button) => button.classList.toggle('active', button.dataset.detail === key));
}
document.querySelectorAll('.hotspot').forEach((button) => button.addEventListener('click', () => renderDetail(button.dataset.detail)));

async function fetchHomeAssistant() {
  const { url, token } = cfg.homeAssistant || {};
  if (!url || !token) throw new Error('Configurazione Home Assistant incompleta');
  const response = await fetch(`${url.replace(/\/$/,'')}/api/states`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Home Assistant HTTP ${response.status}`);
  const states = await response.json();
  const map = Object.fromEntries(states.map((state) => [state.entity_id,state]));
  const raw = (key,fallback=0) => map[cfg.entities?.[key]]?.state ?? fallback;
  const numeric = (key,fallback=0) => { const value=Number(raw(key,fallback)); return Number.isFinite(value)?value:fallback; };
  const string = (key,fallback='-') => String(raw(key,fallback));
  return {
    housePower:numeric('housePower'),houseToday:numeric('houseToday'),houseCost:numeric('houseCost'),housePeak:numeric('housePeak'),houseVs:numeric('houseVsYesterday'),
    pvPower:numeric('pvPower'),pvToday:numeric('pvToday'),pvSelf:numeric('pvSelfConsumption'),gridImport:numeric('gridImport'),gridExport:numeric('gridExport'),
    heatPumpPower:numeric('heatPumpPower'),heatPumpToday:numeric('heatPumpToday'),heatPumpMonth:numeric('heatPumpMonth'),heatPumpMode:string('heatPumpMode','Standby'),
    inductionPower:numeric('inductionPower'),inductionSession:numeric('inductionSession'),inductionToday:numeric('inductionToday'),inductionPeak:numeric('inductionPeak'),
    washerPower:numeric('washerPower'),washerToday:numeric('washerToday'),washerState:string('washerState','Spenta'),
    dryerPower:numeric('dryerPower'),dryerToday:numeric('dryerToday'),dryerState:string('dryerState','Spenta'),
    ovenPower:numeric('ovenPower'),ovenToday:numeric('ovenToday'),ovenState:string('ovenState','Spento'),
    fridgePower:numeric('fridgePower'),fridgeToday:numeric('fridgeToday'),fridgeState:string('fridgeState','Standby'),
    tvPower:numeric('tvPower'),shieldPower:numeric('shieldPower'),mediaPcPower:numeric('mediaPcPower'),hddPower:numeric('hddPower'),
    pcPower:numeric('pcPower'),monitorPower:numeric('monitorPower'),ps5Power:numeric('ps5Power'),dockPower:numeric('dockPower'),
    networkState:string('networkState','Online'),networkLinkDown:numeric('networkLinkDown'),networkLinkUp:numeric('networkLinkUp'),
    networkCurrentDown:numeric('networkCurrentDown'),networkCurrentUp:numeric('networkCurrentUp'),networkPing:numeric('networkPing'),
    networkJitter:numeric('networkJitter'),networkPacketLoss:numeric('networkPacketLoss'),networkUptimeHours:numeric('networkUptimeHours'),
    networkClients:numeric('networkClients'),networkWifiClients:numeric('networkWifiClients'),backup5gStatus:string('backup5gStatus','Standby')
  };
}
async function refresh() {
  try {
    render(cfg.mode === 'homeassistant' ? await fetchHomeAssistant() : jitter(demoBase));
    if (el['ha-pill']) el['ha-pill'].className = 'pill info';
  } catch (error) {
    console.error(error); render(jitter(demoBase));
    if (el['ha-pill']) { el['ha-pill'].className = 'pill bad'; el['ha-pill'].innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> HA non raggiungibile'; }
    if (el['detail-note']) el['detail-note'].textContent = 'Home Assistant non raggiungibile: valori demo temporanei.';
  }
}
refresh(); setInterval(refresh, cfg.refreshMs || 5000);
const scene = $('#scene'); if (scene) { scene.style.pointerEvents='auto'; scene.style.touchAction='none'; }
