const cfg = window.CASA_DASHBOARD_CONFIG || { mode: 'demo', refreshMs: 5000, entities: {} };
const $ = (selector) => document.querySelector(selector);

const ids = [
  'clock','date','house-power','house-today','house-cost','house-peak','house-vs',
  'pv-power','pv-today','pv-self','grid-import','grid-export',
  'shelly-total','hp-power','hp-mode','induction-power','shelly-today',
  'appliances-total','washer-power','dryer-power','oven-power','fridge-power',
  'tv-zone-total','tv-power','shield-power','media-pc-power','hdd-power',
  'studio-total','pc-power','monitor-power','ps5-power','dock-power',
  'internet-pill','ha-pill','backup-pill','detail-title','detail-grid','detail-note'
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const power = (value) => value >= 1000 ? `${number.format(value / 1000)} kW` : `${Math.round(value)} W`;
const energy = (value) => `${number.format(value)} kWh`;
const sum = (...values) => values.reduce((total, value) => total + Number(value || 0), 0);

let latest = null;
let activeDetail = 'pv';

function updateClock() {
  const now = new Date();
  el.clock.textContent = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  el.date.textContent = now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
}
updateClock();
setInterval(updateClock, 1000);

const demoBase = {
  housePower: 3280, houseToday: 18.6, houseCost: 5.31, housePeak: 5.42, houseVs: -6,
  pvPower: 1860, pvToday: 12.4, pvSelf: 71, gridImport: 7.2, gridExport: 1.8,
  heatPumpPower: 1420, heatPumpToday: 7.8, heatPumpMonth: 126.4, heatPumpMode: 'Raffrescamento',
  inductionPower: 0, inductionSession: 0, inductionToday: 1.1, inductionPeak: 3.6,
  washerPower: 510, washerToday: 0.8, washerState: 'In funzione',
  dryerPower: 0, dryerToday: 0, dryerState: 'Spenta',
  ovenPower: 0, ovenToday: 0.5, ovenState: 'Spento',
  fridgePower: 180, fridgeToday: 1.1, fridgeState: 'Compressore attivo',
  tvPower: 112, shieldPower: 9, mediaPcPower: 48, hddPower: 17,
  pcPower: 250, monitorPower: 38, ps5Power: 0, dockPower: 22
};

function jitter(base) {
  const data = { ...base };
  const liveKeys = ['housePower','pvPower','heatPumpPower','washerPower','fridgePower','tvPower','shieldPower','mediaPcPower','hddPower','pcPower','monitorPower','dockPower'];
  liveKeys.forEach((key) => {
    data[key] = Math.max(0, base[key] * (1 + (Math.random() * 0.06 - 0.03)));
  });
  return data;
}

function text(id, value) {
  if (el[id]) el[id].textContent = value;
}

function render(data) {
  latest = data;
  const appliancesTotal = sum(data.washerPower, data.dryerPower, data.ovenPower, data.fridgePower);
  const tvTotal = sum(data.tvPower, data.shieldPower, data.mediaPcPower, data.hddPower);
  const studioTotal = sum(data.pcPower, data.monitorPower, data.ps5Power, data.dockPower);
  const shellyTotal = sum(data.heatPumpPower, data.inductionPower);

  text('house-power', power(data.housePower));
  text('house-today', energy(data.houseToday));
  text('house-cost', euro.format(data.houseCost));
  text('house-peak', `${number.format(data.housePeak)} kW`);
  text('house-vs', `${data.houseVs > 0 ? '+' : ''}${Math.round(data.houseVs)}%`);

  text('pv-power', power(data.pvPower));
  text('pv-today', energy(data.pvToday));
  text('pv-self', `${Math.round(data.pvSelf)}%`);
  text('grid-import', energy(data.gridImport));
  text('grid-export', energy(data.gridExport));

  text('shelly-total', power(shellyTotal));
  text('hp-power', power(data.heatPumpPower));
  text('hp-mode', data.heatPumpMode);
  text('induction-power', power(data.inductionPower));
  text('shelly-today', energy(sum(data.heatPumpToday, data.inductionToday)));

  text('appliances-total', power(appliancesTotal));
  text('washer-power', power(data.washerPower));
  text('dryer-power', power(data.dryerPower));
  text('oven-power', power(data.ovenPower));
  text('fridge-power', power(data.fridgePower));

  text('tv-zone-total', power(tvTotal));
  text('tv-power', power(data.tvPower));
  text('shield-power', power(data.shieldPower));
  text('media-pc-power', power(data.mediaPcPower));
  text('hdd-power', power(data.hddPower));

  text('studio-total', power(studioTotal));
  text('pc-power', power(data.pcPower));
  text('monitor-power', power(data.monitorPower));
  text('ps5-power', power(data.ps5Power));
  text('dock-power', power(data.dockPower));

  text('ha-pill', cfg.mode === 'homeassistant' ? 'Home Assistant live' : 'Home Assistant demo');
  renderDetail(activeDetail);
}

function detailRows(key, data) {
  const appliancesTotal = sum(data.washerPower, data.dryerPower, data.ovenPower, data.fridgePower);
  const tvTotal = sum(data.tvPower, data.shieldPower, data.mediaPcPower, data.hddPower);
  const studioTotal = sum(data.pcPower, data.monitorPower, data.ps5Power, data.dockPower);
  const definitions = {
    pv: {
      title: 'Fotovoltaico',
      rows: [['Produzione', power(data.pvPower)], ['Oggi', energy(data.pvToday)], ['Autoconsumo', `${Math.round(data.pvSelf)}%`], ['Rete', `${energy(data.gridImport)} / ${energy(data.gridExport)}`]]
    },
    hp: {
      title: 'Pompa di calore',
      rows: [['Consumo', power(data.heatPumpPower)], ['Oggi', energy(data.heatPumpToday)], ['Modalità', data.heatPumpMode], ['Mese', energy(data.heatPumpMonth)]]
    },
    induction: {
      title: 'Piano a induzione',
      rows: [['Consumo', power(data.inductionPower)], ['Sessione', energy(data.inductionSession)], ['Oggi', energy(data.inductionToday)], ['Picco', `${number.format(data.inductionPeak)} kW`]]
    },
    appliances: {
      title: `Elettrodomestici · ${power(appliancesTotal)}`,
      rows: [['Lavatrice', `${power(data.washerPower)} · ${data.washerState}`], ['Asciugatrice', `${power(data.dryerPower)} · ${data.dryerState}`], ['Forno', `${power(data.ovenPower)} · ${data.ovenState}`], ['Frigorifero', `${power(data.fridgePower)} · ${data.fridgeState}`]]
    },
    tv: {
      title: `Zona TV · ${power(tvTotal)}`,
      rows: [['TV', power(data.tvPower)], ['Nvidia Shield', power(data.shieldPower)], ['Mini PC', power(data.mediaPcPower)], ['HDD', power(data.hddPower)]]
    },
    studio: {
      title: `Studio e gaming · ${power(studioTotal)}`,
      rows: [['PC', power(data.pcPower)], ['Monitor', power(data.monitorPower)], ['PS5', power(data.ps5Power)], ['Dock / splitter', power(data.dockPower)]]
    }
  };
  return definitions[key] || definitions.pv;
}

function renderDetail(key) {
  if (!latest || !el['detail-grid']) return;
  activeDetail = key;
  const detail = detailRows(key, latest);
  text('detail-title', detail.title);
  el['detail-grid'].innerHTML = '';
  detail.rows.forEach(([label, value]) => {
    const cell = document.createElement('div');
    cell.className = 'detail-cell';
    cell.innerHTML = `<small>${label}</small><strong>${value}</strong>`;
    el['detail-grid'].appendChild(cell);
  });
  document.querySelectorAll('.hotspot').forEach((button) => button.classList.toggle('active', button.dataset.detail === key));
}

document.querySelectorAll('.hotspot').forEach((button) => {
  button.addEventListener('click', () => renderDetail(button.dataset.detail));
});

async function fetchHomeAssistant() {
  const { url, token } = cfg.homeAssistant || {};
  if (!url || !token) throw new Error('Configurazione Home Assistant incompleta');
  const response = await fetch(`${url.replace(/\/$/, '')}/api/states`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(`Home Assistant HTTP ${response.status}`);
  const states = await response.json();
  const stateMap = Object.fromEntries(states.map((state) => [state.entity_id, state]));
  const raw = (key, fallback = 0) => stateMap[cfg.entities?.[key]]?.state ?? fallback;
  const numeric = (key, fallback = 0) => {
    const value = Number(raw(key, fallback));
    return Number.isFinite(value) ? value : fallback;
  };
  const string = (key, fallback = '-') => String(raw(key, fallback));

  return {
    housePower: numeric('housePower'), houseToday: numeric('houseToday'), houseCost: numeric('houseCost'), housePeak: numeric('housePeak'), houseVs: numeric('houseVsYesterday'),
    pvPower: numeric('pvPower'), pvToday: numeric('pvToday'), pvSelf: numeric('pvSelfConsumption'), gridImport: numeric('gridImport'), gridExport: numeric('gridExport'),
    heatPumpPower: numeric('heatPumpPower'), heatPumpToday: numeric('heatPumpToday'), heatPumpMonth: numeric('heatPumpMonth'), heatPumpMode: string('heatPumpMode', 'Standby'),
    inductionPower: numeric('inductionPower'), inductionSession: numeric('inductionSession'), inductionToday: numeric('inductionToday'), inductionPeak: numeric('inductionPeak'),
    washerPower: numeric('washerPower'), washerToday: numeric('washerToday'), washerState: string('washerState', 'Spenta'),
    dryerPower: numeric('dryerPower'), dryerToday: numeric('dryerToday'), dryerState: string('dryerState', 'Spenta'),
    ovenPower: numeric('ovenPower'), ovenToday: numeric('ovenToday'), ovenState: string('ovenState', 'Spento'),
    fridgePower: numeric('fridgePower'), fridgeToday: numeric('fridgeToday'), fridgeState: string('fridgeState', 'Standby'),
    tvPower: numeric('tvPower'), shieldPower: numeric('shieldPower'), mediaPcPower: numeric('mediaPcPower'), hddPower: numeric('hddPower'),
    pcPower: numeric('pcPower'), monitorPower: numeric('monitorPower'), ps5Power: numeric('ps5Power'), dockPower: numeric('dockPower')
  };
}

async function refresh() {
  try {
    const data = cfg.mode === 'homeassistant' ? await fetchHomeAssistant() : jitter(demoBase);
    render(data);
    el['ha-pill'].className = 'pill ok';
    el['internet-pill'].className = 'pill ok';
    el['backup-pill'].className = 'pill warn';
  } catch (error) {
    console.error(error);
    render(jitter(demoBase));
    el['ha-pill'].className = 'pill bad';
    el['ha-pill'].textContent = 'HA non raggiungibile';
    el['detail-note'].textContent = 'Home Assistant non raggiungibile: valori demo temporanei.';
  }
}

refresh();
setInterval(refresh, cfg.refreshMs || 5000);

const scene = $('#scene');
if (scene) {
  scene.style.pointerEvents = 'auto';
  scene.style.touchAction = 'none';
}
