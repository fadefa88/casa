export const cfg = window.CASA_DASHBOARD_CONFIG || { mode: 'demo', refreshMs: 10000, entities: {} };
export const rooms = window.CASA_ROOMS || [];

export const appState = {
  view: 'overview',
  floor: 'both',
  selectedRoom: rooms[0]?.id || null,
  data: null,
};

export const $ = (selector) => document.querySelector(selector);
export const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
export const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
export const power = (value) => Number(value) >= 1000
  ? `${fmt.format(Number(value) / 1000)} kW`
  : `${Math.round(Number(value) || 0)} W`;
export const energy = (value) => `${fmt.format(Number(value) || 0)} kWh`;
export const speed = (value) => Number(value) >= 1000
  ? `${fmt.format(Number(value) / 1000)} Gbps`
  : `${fmt.format(Number(value) || 0)} Mbps`;
export const sum = (...values) => values.reduce((total, value) => total + Number(value || 0), 0);
export const alarmLabel = (state) => state === 'armed_away'
  ? 'Inserito totale'
  : state === 'armed_home'
    ? 'Inserito notte'
    : state === 'triggered'
      ? 'ALLARME'
      : 'Disattivato';
export const alarmClass = (state) => state === 'triggered' ? 'bad' : state === 'disarmed' ? 'ok' : 'warn';

const baseDemo = {
  housePower: 3280,
  houseToday: 18.6,
  houseCost: 5.31,
  housePeak: 5.42,
  houseVs: -6,
  pvPower: 4180,
  pvToday: 19.8,
  pvSelf: 78,
  gridImport: 5.2,
  gridExport: 6.8,
  heatPumpPower: 1420,
  heatPumpToday: 7.8,
  heatPumpMonth: 126.4,
  heatPumpMode: 'Raffrescamento',
  inductionPower: 0,
  inductionSession: 0,
  inductionToday: 1.1,
  inductionPeak: 3.6,
  washerPower: 510,
  washerToday: 0.8,
  washerState: 'In funzione',
  dryerPower: 0,
  dryerToday: 0,
  dryerState: 'Spenta',
  ovenPower: 0,
  ovenToday: 0.5,
  ovenState: 'Spento',
  fridgePower: 180,
  fridgeToday: 1.1,
  fridgeState: 'Compressore attivo',
  tvPower: 112,
  shieldPower: 9,
  mediaPcPower: 48,
  hddPower: 17,
  pcPower: 250,
  monitorPower: 38,
  ps5Power: 0,
  dockPower: 22,
  networkState: 'Online',
  networkLinkDown: 2500,
  networkLinkUp: 1000,
  networkCurrentDown: 412,
  networkCurrentUp: 84,
  networkPing: 7,
  networkJitter: 1.4,
  networkPacketLoss: 0,
  networkUptimeHours: 326,
  networkClients: 31,
  networkWifiClients: 18,
  backup5gStatus: 'Standby',
  alarmState: 'disarmed',
  doorbellLastEvent: 'Movimento rilevato alle 07:42',
};

export const roomDemo = Object.fromEntries(rooms.map((room, index) => [
  room.id,
  {
    temperature: room.type === 'outdoor' ? 28.2 + (index % 3) * 0.4 : 21.7 + (index % 6) * 0.45,
    humidity: room.type === 'outdoor' ? 51 : 43 + (index % 5) * 3,
    lightOn: [0, 2, 6, 10].includes(index),
    cover: room.entities.cover ? 25 + (index * 13) % 76 : null,
  },
]));

export function demoData() {
  return {
    ...baseDemo,
    roomStates: structuredClone(roomDemo),
  };
}

export function average(key, type = 'indoor') {
  const values = rooms
    .filter((room) => room.type === type)
    .map((room) => Number(appState.data?.roomStates?.[room.id]?.[key]))
    .filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function lightsOn() {
  return rooms.filter((room) => appState.data?.roomStates?.[room.id]?.lightOn).length;
}

export function shuttersAverage() {
  const values = rooms
    .map((room) => appState.data?.roomStates?.[room.id]?.cover)
    .filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export async function fetchHA() {
  const { url, token } = cfg.homeAssistant || {};
  if (!url || !token) throw new Error('Home Assistant non configurato');

  const response = await fetch(`${url.replace(/\/$/, '')}/api/states`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Home Assistant HTTP ${response.status}`);

  const states = await response.json();
  const map = Object.fromEntries(states.map((state) => [state.entity_id, state]));
  const raw = (entityId, fallback = 0) => map[entityId]?.state ?? fallback;
  const numeric = (entityId, fallback = 0) => {
    const value = Number(raw(entityId, fallback));
    return Number.isFinite(value) ? value : fallback;
  };

  const data = demoData();
  for (const [key, entityId] of Object.entries(cfg.entities || {})) {
    if (key === 'alarm') data.alarmState = String(raw(entityId, 'disarmed'));
    else if (key === 'doorbellLastEvent') data.doorbellLastEvent = String(raw(entityId, '-'));
    else if (['networkState', 'backup5gStatus', 'heatPumpMode'].includes(key) || key.endsWith('State')) {
      data[key] = String(raw(entityId, data[key] ?? '-'));
    } else if (key in data) {
      data[key] = numeric(entityId, data[key]);
    }
  }

  data.roomStates = {};
  for (const room of rooms) {
    const entities = room.entities || {};
    const light = map[entities.lights];
    const cover = map[entities.cover];
    data.roomStates[room.id] = {
      temperature: numeric(entities.temperature, roomDemo[room.id].temperature),
      humidity: numeric(entities.humidity, roomDemo[room.id].humidity),
      lightOn: light?.state === 'on',
      cover: cover
        ? Number(cover.attributes?.current_position ?? (cover.state === 'open' ? 100 : 0))
        : null,
    };
  }
  return data;
}
