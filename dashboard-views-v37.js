import {
  appState, rooms, $, fmt, money, power, energy, speed, sum,
  alarmLabel, alarmClass, average, lightsOn, shuttersAverage,
} from './dashboard-state-v37.js';

const left = $('#left-rail');
const right = $('#right-rail');
const context = $('#context-panel');
const markerLayer = $('#room-marker-layer');

const card = ({ title, value = '', body = '', cls = '', icon = 'fa-chart-simple', target = '' }) => `
  <section class="card ${cls} ${target ? 'clickable-card' : ''}" ${target ? `data-view-target="${target}" role="button" tabindex="0"` : ''}>
    <div class="card-head">
      <span class="title"><i class="fa-solid ${icon}"></i> ${title}</span>
      ${value ? `<strong>${value}</strong>` : ''}
    </div>
    ${body}
    ${target ? '<span class="card-open"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>' : ''}
  </section>`;

const metrics = (items) => `
  <div class="metric-grid two">
    ${items.map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join('')}
  </div>`;

function header() {
  const data = appState.data;
  const alarm = $('#alarm-pill');
  alarm.className = `pill ${alarmClass(data.alarmState)}`;
  alarm.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${alarmLabel(data.alarmState)}`;
  $('#internet-pill').innerHTML = `<i class="fa-solid fa-globe"></i> FTTH ${data.networkState}`;
  $('#backup-pill').innerHTML = `<i class="fa-solid fa-tower-cell"></i> 5G ${data.backup5gStatus}`;
  $('#ha-pill').innerHTML = `<i class="fa-solid fa-flask"></i> Dati demo`;
}

function solarCard(target = 'energy') {
  const data = appState.data;
  const net = data.pvPower - data.housePower;
  return card({
    title: 'Fotovoltaico casa',
    value: power(data.pvPower),
    icon: 'fa-solar-panel',
    cls: 'pv-card featured-card',
    target,
    body: `
      <div class="energy-flow">
        <div class="flow-node solar"><i class="fa-solid fa-sun"></i><small>Produzione</small><strong>${power(data.pvPower)}</strong></div>
        <i class="fa-solid fa-arrow-right flow-arrow"></i>
        <div class="flow-node home"><i class="fa-solid fa-house"></i><small>Casa</small><strong>${power(Math.min(data.pvPower, data.housePower))}</strong></div>
        <i class="fa-solid fa-arrow-right-arrow-left flow-arrow"></i>
        <div class="flow-node grid"><i class="fa-solid fa-bolt"></i><small>Rete</small><strong>${net >= 0 ? '↑' : '↓'} ${power(Math.abs(net))}</strong></div>
      </div>
      ${metrics([
        ['Produzione oggi', energy(data.pvToday)],
        ['Autoconsumo', `${Math.round(data.pvSelf)}%`],
        ['Prelievo', energy(data.gridImport)],
        ['Immissione', energy(data.gridExport)],
      ])}`,
  });
}

function houseCard() {
  const data = appState.data;
  return card({
    title: 'Bilancio casa',
    value: power(data.housePower),
    icon: 'fa-gauge-high',
    cls: 'energy-card',
    target: 'energy',
    body: metrics([
      ['Consumo oggi', energy(data.houseToday)],
      ['Costo stimato', money.format(data.houseCost)],
      ['Picco', `${fmt.format(data.housePeak)} kW`],
      ['Vs ieri', `${data.houseVs > 0 ? '+' : ''}${Math.round(data.houseVs)}%`],
    ]),
  });
}

function overview() {
  const data = appState.data;
  left.innerHTML = solarCard('energy') + houseCard();
  right.innerHTML =
    card({
      title: 'Comfort e stanze',
      value: `${fmt.format(average('temperature'))} °C`,
      icon: 'fa-house',
      target: 'rooms',
      body: `<div class="overview-kpis">
        <div class="overview-kpi"><i class="fa-solid fa-temperature-half"></i><small>Media interna</small><strong>${fmt.format(average('temperature'))} °C</strong></div>
        <div class="overview-kpi"><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>${Math.round(average('humidity'))}%</strong></div>
        <div class="overview-kpi"><i class="fa-solid fa-lightbulb"></i><small>Luci accese</small><strong>${lightsOn()}</strong></div>
        <div class="overview-kpi"><i class="fa-solid fa-window-maximize"></i><small>Tapparelle</small><strong>${Math.round(shuttersAverage())}%</strong></div>
      </div>`,
    }) +
    card({
      title: 'Sicurezza',
      value: alarmLabel(data.alarmState),
      icon: 'fa-shield-halved',
      target: 'security',
      body: `
        <div class="status-line"><span>Allarme</span><strong>${alarmLabel(data.alarmState)}</strong></div>
        <div class="status-line"><span>Videocitofono</span><strong>Online</strong></div>
        <div class="status-line"><span>Luci accese</span><strong>${lightsOn()}</strong></div>`,
    }) +
    card({
      title: 'Rete',
      value: `${fmt.format(data.networkPing)} ms`,
      icon: 'fa-network-wired',
      cls: 'network-card',
      target: 'network',
      body: metrics([
        ['Download', speed(data.networkLinkDown)],
        ['Upload', speed(data.networkLinkUp)],
        ['Dispositivi', Math.round(data.networkClients)],
        ['Backup 5G', data.backup5gStatus],
      ]),
    });
  context.hidden = true;
}

function roomButton(room) {
  const state = appState.data.roomStates[room.id];
  return `<button class="room-card ${room.type === 'outdoor' ? 'outdoor' : ''} ${appState.selectedRoom === room.id ? 'active' : ''}" data-room="${room.id}">
    <span class="room-icon"><i class="fa-solid ${room.icon}"></i></span>
    <span class="room-main">
      <span class="room-name">${room.name}</span>
      <span class="room-sub">${state.lightOn ? 'Luce accesa' : 'Luce spenta'}${Number.isFinite(state.cover) ? ` · Tapparella ${Math.round(state.cover)}%` : ''}</span>
    </span>
    <span class="room-temp"><strong>${fmt.format(state.temperature)}°</strong><small>${Math.round(state.humidity)}%</small></span>
  </button>`;
}

function roomColumn(floor) {
  const floorRooms = rooms.filter((room) => room.floor === floor);
  return card({
    title: floor === 'first' ? 'Primo piano' : 'Secondo piano',
    value: `${floorRooms.length} ambienti`,
    icon: floor === 'first' ? 'fa-1' : 'fa-2',
    cls: 'fill scrollable compact',
    body: `<div class="room-list">${floorRooms.map(roomButton).join('')}</div>`,
  });
}

export function roomContext() {
  const room = rooms.find((item) => item.id === appState.selectedRoom) || rooms[0];
  const state = appState.data.roomStates[room.id];
  context.hidden = false;
  context.innerHTML = `<div class="context-grid">
    <div class="context-room"><i class="fa-solid ${room.icon}"></i><div><strong>${room.name}</strong><small>${room.floor === 'first' ? 'Primo piano' : 'Secondo piano'}</small></div></div>
    <div class="context-metric"><small>Temperatura</small><strong>${fmt.format(state.temperature)} °C</strong></div>
    <div class="context-metric"><small>Umidità</small><strong>${Math.round(state.humidity)}%</strong></div>
    <div class="context-metric"><small>Luce</small><strong>${state.lightOn ? 'Accesa' : 'Spenta'}</strong></div>
    <div class="context-metric"><small>Tapparella</small><strong>${Number.isFinite(state.cover) ? `${Math.round(state.cover)}%` : '—'}</strong></div>
    <div class="context-actions">
      <button data-action="room-light" data-room="${room.id}" title="Luce"><i class="fa-solid fa-lightbulb"></i></button>
      ${room.entities.cover ? `<button data-action="room-cover-open" data-room="${room.id}" title="Apri"><i class="fa-solid fa-arrow-up"></i></button><button data-action="room-cover-close" data-room="${room.id}" title="Chiudi"><i class="fa-solid fa-arrow-down"></i></button>` : ''}
    </div>
  </div>`;
}

function roomsView() {
  left.innerHTML = roomColumn('first');
  right.innerHTML = roomColumn('second');
  roomContext();
}

function energyView() {
  const data = appState.data;
  const appliances = sum(data.washerPower, data.dryerPower, data.ovenPower, data.fridgePower);
  const tv = sum(data.tvPower, data.shieldPower, data.mediaPcPower, data.hddPower);
  const studio = sum(data.pcPower, data.monitorPower, data.ps5Power, data.dockPower);
  left.innerHTML = solarCard('energy') + houseCard();
  right.innerHTML =
    card({
      title: 'Linee Shelly', value: power(sum(data.heatPumpPower, data.inductionPower)), icon: 'fa-bolt-lightning', cls: 'shelly-card',
      body: metrics([['Pompa di calore', power(data.heatPumpPower)], ['Modalità', data.heatPumpMode], ['Induzione', power(data.inductionPower)], ['Oggi', energy(sum(data.heatPumpToday, data.inductionToday))]),
    }) +
    card({
      title: 'Elettrodomestici', value: power(appliances), icon: 'fa-plug', cls: 'appliances-card',
      body: metrics([['Lavatrice', power(data.washerPower)], ['Asciugatrice', power(data.dryerPower)], ['Forno', power(data.ovenPower)], ['Frigorifero', power(data.fridgePower)]),
    }) +
    card({
      title: 'Tecnologia', value: power(tv + studio), icon: 'fa-microchip', cls: 'tech-card',
      body: metrics([['Zona TV', power(tv)], ['Studio / gaming', power(studio)], ['Mini PC + HDD', power(sum(data.mediaPcPower, data.hddPower))], ['PC + PS5', power(sum(data.pcPower, data.ps5Power))]),
    });
  context.hidden = true;
}

function networkView() {
  const data = appState.data;
  left.innerHTML =
    card({
      title: 'FRITZ!Box 7690', value: data.networkState, icon: 'fa-router', cls: 'network-card',
      body: metrics([['Link download', speed(data.networkLinkDown)], ['Link upload', speed(data.networkLinkUp)], ['Traffico download', speed(data.networkCurrentDown)], ['Traffico upload', speed(data.networkCurrentUp)]]),
    }) +
    card({
      title: 'Qualità connessione', value: `${fmt.format(data.networkPing)} ms`, icon: 'fa-wave-square',
      body: metrics([['Ping', `${fmt.format(data.networkPing)} ms`], ['Jitter', `${fmt.format(data.networkJitter)} ms`], ['Perdita pacchetti', `${fmt.format(data.networkPacketLoss)}%`], ['Uptime', `${fmt.format(data.networkUptimeHours)} h`]]),
    });
  right.innerHTML =
    card({
      title: 'Dispositivi', value: Math.round(data.networkClients), icon: 'fa-users',
      body: `<div class="network-health"><div class="score">92</div><div><strong>Rete stabile</strong><small>${Math.round(data.networkWifiClients)} Wi‑Fi · ${Math.max(0, Math.round(data.networkClients - data.networkWifiClients))} cablati</small></div></div>${metrics([['Client Wi‑Fi', Math.round(data.networkWifiClients)], ['Client totali', Math.round(data.networkClients)], ['FTTH', data.networkState], ['Backup 5G', data.backup5gStatus]])}`,
    }) +
    card({
      title: 'Backup e diagnostica', value: 'Pronto', icon: 'fa-tower-cell',
      body: `<div class="status-line"><span>WAN principale</span><strong><span class="status-dot ok"></span>FTTH</strong></div><div class="status-line"><span>Failover</span><strong><span class="status-dot warn"></span>${data.backup5gStatus}</strong></div><div class="card-actions"><button data-action="network-test"><i class="fa-solid fa-gauge"></i> Test connessione</button></div>`,
    });
  context.hidden = true;
}

function securityView() {
  const data = appState.data;
  const firstLights = rooms.filter((room) => room.floor === 'first' && data.roomStates[room.id].lightOn).length;
  const secondLights = rooms.filter((room) => room.floor === 'second' && data.roomStates[room.id].lightOn).length;
  const motorized = rooms.filter((room) => room.entities.cover).length;
  const open = rooms.filter((room) => Number(data.roomStates[room.id].cover) > 80).length;
  const closed = rooms.filter((room) => Number(data.roomStates[room.id].cover) < 10).length;

  left.innerHTML =
    card({
      title: 'Allarme', value: alarmLabel(data.alarmState), icon: 'fa-shield-halved',
      body: `<div class="security-grid"><div class="security-tile"><i class="fa-solid fa-shield-halved"></i><small>Stato</small><strong>${alarmLabel(data.alarmState)}</strong></div><div class="security-tile"><i class="fa-solid fa-house-lock"></i><small>Modalità</small><strong>${data.alarmState === 'armed_home' ? 'Notte' : 'Casa'}</strong></div></div><div class="card-actions"><button data-action="alarm-home">Notte</button><button data-action="alarm-away">Totale</button><button class="danger" data-action="alarm-disarm">Disattiva</button></div>`,
    }) +
    card({
      title: 'Videocitofono', value: 'Online', icon: 'fa-video',
      body: `<div class="intercom-preview"><i class="fa-solid fa-video"></i><strong>Ingresso principale</strong><small>${data.doorbellLastEvent}</small></div><div class="card-actions"><button class="primary" data-action="open-intercom"><i class="fa-solid fa-video"></i> Apri video</button></div>`,
    });

  right.innerHTML =
    card({
      title: 'Luci', value: `${lightsOn()} accese`, icon: 'fa-lightbulb',
      body: `${metrics([['Primo piano', firstLights], ['Secondo piano', secondLights], ['Totale stanze', rooms.length], ['Stato', lightsOn() ? 'Attive' : 'Tutte spente']])}<div class="card-actions"><button data-action="lights-off-all"><i class="fa-solid fa-lightbulb"></i> Spegni tutte</button></div>`,
    }) +
    card({
      title: 'Tapparelle', value: `${Math.round(shuttersAverage())}%`, icon: 'fa-window-maximize',
      body: `${metrics([['Apertura media', `${Math.round(shuttersAverage())}%`], ['Motorizzate', motorized], ['Aperte', open], ['Chiuse', closed]])}<div class="card-actions"><button data-action="covers-open-all"><i class="fa-solid fa-arrow-up"></i> Apri tutte</button><button data-action="covers-stop-all"><i class="fa-solid fa-stop"></i> Stop</button><button class="danger" data-action="covers-close-all"><i class="fa-solid fa-arrow-down"></i> Chiudi tutte</button></div>`,
    });
  context.hidden = true;
}

export function renderApp() {
  if (!appState.data) return;
  header();
  const titles = { overview: 'Panoramica', rooms: 'Stanze', energy: 'Energia', network: 'Rete', security: 'Sicurezza' };
  $('#view-title').textContent = titles[appState.view] || 'Panoramica';
  document.querySelectorAll('.view-nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === appState.view);
  });
  markerLayer.hidden = appState.view !== 'rooms';
  const renderer = { overview, rooms: roomsView, energy: energyView, network: networkView, security: securityView }[appState.view] || overview;
  renderer();
}
