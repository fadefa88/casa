(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const rooms = Array.isArray(window.CASA_ROOMS) && window.CASA_ROOMS.length ? window.CASA_ROOMS : [
    { id: 'living', floor: 'first', name: 'Soggiorno e cucina', icon: 'fa-couch', type: 'indoor', entities: { cover: 'cover.soggiorno' } },
    { id: 'master', floor: 'first', name: 'Camera matrimoniale', icon: 'fa-bed', type: 'indoor', entities: { cover: 'cover.camera_matrimoniale' } },
    { id: 'bedroom', floor: 'first', name: 'Camera', icon: 'fa-bed', type: 'indoor', entities: { cover: 'cover.camera' } },
    { id: 'bath', floor: 'first', name: 'Bagno', icon: 'fa-bath', type: 'indoor', entities: {} },
    { id: 'attic', floor: 'second', name: 'Soggiorno mansarda', icon: 'fa-couch', type: 'indoor', entities: { cover: 'cover.soggiorno_mansarda' } },
  ];

  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const power = (value) => Number(value) >= 1000 ? `${fmt.format(Number(value) / 1000)} kW` : `${Math.round(Number(value) || 0)} W`;
  const energy = (value) => `${fmt.format(Number(value) || 0)} kWh`;
  const speed = (value) => Number(value) >= 1000 ? `${fmt.format(Number(value) / 1000)} Gbps` : `${fmt.format(Number(value) || 0)} Mbps`;
  const sum = (...values) => values.reduce((total, value) => total + Number(value || 0), 0);

  const data = {
    housePower: 3280, houseToday: 18.6, houseCost: 5.31, housePeak: 5.42, houseVs: -6,
    pvPower: 4180, pvToday: 19.8, pvSelf: 78, gridImport: 5.2, gridExport: 6.8,
    heatPumpPower: 1420, heatPumpToday: 7.8, heatPumpMonth: 126.4, heatPumpMode: 'Raffrescamento',
    inductionPower: 0, inductionToday: 1.1, inductionPeak: 3.6,
    washerPower: 510, washerState: 'In funzione', dryerPower: 0, dryerState: 'Spenta',
    ovenPower: 0, ovenState: 'Spento', fridgePower: 180, fridgeState: 'Compressore attivo',
    tvPower: 112, shieldPower: 9, mediaPcPower: 48, hddPower: 17,
    pcPower: 250, monitorPower: 38, ps5Power: 0, dockPower: 22,
    networkState: 'Online', networkLinkDown: 2500, networkLinkUp: 1000,
    networkCurrentDown: 412, networkCurrentUp: 84, networkPing: 7, networkJitter: 1.4,
    networkPacketLoss: 0, networkUptimeHours: 326, networkClients: 31, networkWifiClients: 18,
    backup5gStatus: 'Standby', alarmState: 'disarmed', doorbellLastEvent: 'Movimento rilevato alle 07:42',
  };

  const roomStates = Object.fromEntries(rooms.map((room, index) => [room.id, {
    temperature: room.type === 'outdoor' ? 28.2 + (index % 3) * 0.4 : 21.7 + (index % 6) * 0.45,
    humidity: room.type === 'outdoor' ? 51 : 43 + (index % 5) * 3,
    lightOn: [0, 2, 6, 10].includes(index),
    cover: room.entities?.cover ? 25 + (index * 13) % 76 : null,
  }]));

  const state = { view: 'overview', selectedRoom: rooms[0]?.id || null };
  const left = $('#left-rail');
  const right = $('#right-rail');
  const context = $('#context-panel');
  const markerLayer = $('#room-marker-layer');
  const toastNode = $('#toast');
  let toastTimer = null;

  const alarmLabel = () => data.alarmState === 'armed_away' ? 'Inserito totale' : data.alarmState === 'armed_home' ? 'Inserito notte' : data.alarmState === 'triggered' ? 'ALLARME' : 'Disattivato';
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

  function toast(message) {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastNode.hidden = true; }, 2200);
  }

  function metrics(items) {
    return `<div class="metric-grid two">${items.map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>`;
  }

  function card({ title, value = '', icon = 'fa-chart-simple', cls = '', body = '', target = '' }) {
    return `<section class="card ${cls} ${target ? 'clickable-card' : ''}" ${target ? `data-view-target="${target}" role="button" tabindex="0"` : ''}>
      <div class="card-head"><span class="title"><i class="fa-solid ${icon}"></i> ${title}</span>${value ? `<strong>${value}</strong>` : ''}</div>
      ${body}${target ? '<span class="card-open"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>' : ''}
    </section>`;
  }

  function solarCard() {
    const net = data.pvPower - data.housePower;
    return card({ title: 'Fotovoltaico casa', value: power(data.pvPower), icon: 'fa-solar-panel', cls: 'pv-card featured-card', target: 'energy', body: `
      <div class="energy-flow">
        <div class="flow-node solar"><i class="fa-solid fa-sun"></i><small>Produzione</small><strong>${power(data.pvPower)}</strong></div>
        <i class="fa-solid fa-arrow-right flow-arrow"></i>
        <div class="flow-node home"><i class="fa-solid fa-house"></i><small>Casa</small><strong>${power(Math.min(data.pvPower, data.housePower))}</strong></div>
        <i class="fa-solid fa-arrow-right-arrow-left flow-arrow"></i>
        <div class="flow-node grid"><i class="fa-solid fa-bolt"></i><small>Rete</small><strong>${net >= 0 ? '↑' : '↓'} ${power(Math.abs(net))}</strong></div>
      </div>${metrics([['Produzione oggi', energy(data.pvToday)], ['Autoconsumo', `${data.pvSelf}%`], ['Prelievo', energy(data.gridImport)], ['Immissione', energy(data.gridExport)]])}` });
  }

  function houseCard() {
    return card({ title: 'Bilancio casa', value: power(data.housePower), icon: 'fa-gauge-high', cls: 'energy-card', target: 'energy', body: metrics([
      ['Consumo oggi', energy(data.houseToday)], ['Costo stimato', money.format(data.houseCost)], ['Picco', `${fmt.format(data.housePeak)} kW`], ['Vs ieri', `${data.houseVs}%`],
    ]) });
  }

  function updateHeader() {
    const alarm = $('#alarm-pill');
    if (alarm) { alarm.className = `pill ${alarmClass()}`; alarm.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${alarmLabel()}`; }
    if ($('#internet-pill')) $('#internet-pill').innerHTML = `<i class="fa-solid fa-globe"></i> FTTH ${data.networkState}`;
    if ($('#backup-pill')) $('#backup-pill').innerHTML = `<i class="fa-solid fa-tower-cell"></i> 5G ${data.backup5gStatus}`;
    if ($('#ha-pill')) $('#ha-pill').innerHTML = '<i class="fa-solid fa-flask"></i> Demo v38';
  }

  function overviewView() {
    left.innerHTML = solarCard() + houseCard();
    right.innerHTML = card({ title: 'Comfort e stanze', value: `${fmt.format(average('temperature'))} °C`, icon: 'fa-house', target: 'rooms', body: `<div class="overview-kpis">
      <div class="overview-kpi"><i class="fa-solid fa-temperature-half"></i><small>Media interna</small><strong>${fmt.format(average('temperature'))} °C</strong></div>
      <div class="overview-kpi"><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>${Math.round(average('humidity'))}%</strong></div>
      <div class="overview-kpi"><i class="fa-solid fa-lightbulb"></i><small>Luci accese</small><strong>${lightsOn()}</strong></div>
      <div class="overview-kpi"><i class="fa-solid fa-window-maximize"></i><small>Tapparelle</small><strong>${Math.round(shuttersAverage())}%</strong></div></div>` }) +
      card({ title: 'Sicurezza', value: alarmLabel(), icon: 'fa-shield-halved', target: 'security', body: `<div class="status-line"><span>Allarme</span><strong>${alarmLabel()}</strong></div><div class="status-line"><span>Videocitofono</span><strong>Online</strong></div><div class="status-line"><span>Luci accese</span><strong>${lightsOn()}</strong></div>` }) +
      card({ title: 'Rete', value: `${fmt.format(data.networkPing)} ms`, icon: 'fa-network-wired', cls: 'network-card', target: 'network', body: metrics([['Download', speed(data.networkLinkDown)], ['Upload', speed(data.networkLinkUp)], ['Dispositivi', data.networkClients], ['Backup 5G', data.backup5gStatus]]) });
    context.hidden = true;
  }

  function roomButton(room) {
    const roomState = roomStates[room.id];
    return `<button class="room-card ${room.type === 'outdoor' ? 'outdoor' : ''} ${state.selectedRoom === room.id ? 'active' : ''}" data-room="${room.id}">
      <span class="room-icon"><i class="fa-solid ${room.icon || 'fa-door-open'}"></i></span>
      <span class="room-main"><span class="room-name">${room.name}</span><span class="room-sub">${roomState.lightOn ? 'Luce accesa' : 'Luce spenta'}${Number.isFinite(roomState.cover) ? ` · Tapparella ${Math.round(roomState.cover)}%` : ''}</span></span>
      <span class="room-temp"><strong>${fmt.format(roomState.temperature)}°</strong><small>${Math.round(roomState.humidity)}%</small></span>
    </button>`;
  }

  function roomColumn(floor) {
    const floorRooms = rooms.filter((room) => room.floor === floor);
    return card({ title: floor === 'first' ? 'Primo piano' : 'Secondo piano', value: `${floorRooms.length} ambienti`, icon: floor === 'first' ? 'fa-1' : 'fa-2', cls: 'fill scrollable compact', body: `<div class="room-list">${floorRooms.map(roomButton).join('')}</div>` });
  }

  function renderRoomContext() {
    const room = rooms.find((item) => item.id === state.selectedRoom) || rooms[0];
    const roomState = roomStates[room.id];
    context.hidden = false;
    context.innerHTML = `<div class="context-grid"><div class="context-room"><i class="fa-solid ${room.icon || 'fa-door-open'}"></i><div><strong>${room.name}</strong><small>${room.floor === 'first' ? 'Primo piano' : 'Secondo piano'}</small></div></div>
      <div class="context-metric"><small>Temperatura</small><strong>${fmt.format(roomState.temperature)} °C</strong></div><div class="context-metric"><small>Umidità</small><strong>${Math.round(roomState.humidity)}%</strong></div>
      <div class="context-metric"><small>Luce</small><strong>${roomState.lightOn ? 'Accesa' : 'Spenta'}</strong></div><div class="context-metric"><small>Tapparella</small><strong>${Number.isFinite(roomState.cover) ? `${Math.round(roomState.cover)}%` : '—'}</strong></div>
      <div class="context-actions"><button data-action="room-light" data-room="${room.id}"><i class="fa-solid fa-lightbulb"></i></button>${Number.isFinite(roomState.cover) ? `<button data-action="room-cover-open" data-room="${room.id}"><i class="fa-solid fa-arrow-up"></i></button><button data-action="room-cover-close" data-room="${room.id}"><i class="fa-solid fa-arrow-down"></i></button>` : ''}</div></div>`;
  }

  function roomsView() {
    left.innerHTML = roomColumn('first');
    right.innerHTML = roomColumn('second');
    renderRoomContext();
  }

  function energyView() {
    const appliances = sum(data.washerPower, data.dryerPower, data.ovenPower, data.fridgePower);
    const tv = sum(data.tvPower, data.shieldPower, data.mediaPcPower, data.hddPower);
    const studio = sum(data.pcPower, data.monitorPower, data.ps5Power, data.dockPower);
    left.innerHTML = solarCard() + houseCard();
    right.innerHTML = card({ title: 'Linee Shelly', value: power(sum(data.heatPumpPower, data.inductionPower)), icon: 'fa-bolt-lightning', cls: 'shelly-card', body: metrics([['Pompa di calore', power(data.heatPumpPower)], ['Modalità', data.heatPumpMode], ['Induzione', power(data.inductionPower)], ['Oggi', energy(sum(data.heatPumpToday, data.inductionToday))]]) }) +
      card({ title: 'Elettrodomestici', value: power(appliances), icon: 'fa-plug', cls: 'appliances-card', body: metrics([['Lavatrice', power(data.washerPower)], ['Asciugatrice', power(data.dryerPower)], ['Forno', power(data.ovenPower)], ['Frigorifero', power(data.fridgePower)]]) }) +
      card({ title: 'Tecnologia', value: power(tv + studio), icon: 'fa-microchip', cls: 'tech-card', body: metrics([['Zona TV', power(tv)], ['Studio / gaming', power(studio)], ['Mini PC + HDD', power(sum(data.mediaPcPower, data.hddPower))], ['PC + PS5', power(sum(data.pcPower, data.ps5Power))]]) });
    context.hidden = true;
  }

  function networkView() {
    left.innerHTML = card({ title: 'FRITZ!Box 7690', value: data.networkState, icon: 'fa-router', cls: 'network-card', body: metrics([['Link download', speed(data.networkLinkDown)], ['Link upload', speed(data.networkLinkUp)], ['Traffico download', speed(data.networkCurrentDown)], ['Traffico upload', speed(data.networkCurrentUp)]]) }) +
      card({ title: 'Qualità connessione', value: `${fmt.format(data.networkPing)} ms`, icon: 'fa-wave-square', body: metrics([['Ping', `${fmt.format(data.networkPing)} ms`], ['Jitter', `${fmt.format(data.networkJitter)} ms`], ['Perdita pacchetti', `${fmt.format(data.networkPacketLoss)}%`], ['Uptime', `${fmt.format(data.networkUptimeHours)} h`]]) });
    right.innerHTML = card({ title: 'Dispositivi', value: data.networkClients, icon: 'fa-users', body: `<div class="network-health"><div class="score">92</div><div><strong>Rete stabile</strong><small>${data.networkWifiClients} Wi‑Fi · ${data.networkClients - data.networkWifiClients} cablati</small></div></div>${metrics([['Client Wi‑Fi', data.networkWifiClients], ['Client totali', data.networkClients], ['FTTH', data.networkState], ['Backup 5G', data.backup5gStatus]])}` }) +
      card({ title: 'Backup e diagnostica', value: 'Pronto', icon: 'fa-tower-cell', body: `<div class="status-line"><span>WAN principale</span><strong><span class="status-dot ok"></span>FTTH</strong></div><div class="status-line"><span>Failover</span><strong><span class="status-dot warn"></span>${data.backup5gStatus}</strong></div><div class="card-actions"><button data-action="network-test"><i class="fa-solid fa-gauge"></i> Test connessione</button></div>` });
    context.hidden = true;
  }

  function securityView() {
    const firstLights = rooms.filter((room) => room.floor === 'first' && roomStates[room.id].lightOn).length;
    const secondLights = rooms.filter((room) => room.floor === 'second' && roomStates[room.id].lightOn).length;
    const motorized = rooms.filter((room) => Number.isFinite(roomStates[room.id].cover)).length;
    left.innerHTML = card({ title: 'Allarme', value: alarmLabel(), icon: 'fa-shield-halved', body: `<div class="security-grid"><div class="security-tile"><i class="fa-solid fa-shield-halved"></i><small>Stato</small><strong>${alarmLabel()}</strong></div><div class="security-tile"><i class="fa-solid fa-house-lock"></i><small>Modalità</small><strong>${data.alarmState === 'armed_home' ? 'Notte' : 'Casa'}</strong></div></div><div class="card-actions"><button data-action="alarm-home">Notte</button><button data-action="alarm-away">Totale</button><button class="danger" data-action="alarm-disarm">Disattiva</button></div>` }) +
      card({ title: 'Videocitofono', value: 'Online', icon: 'fa-video', body: `<div class="intercom-preview"><i class="fa-solid fa-video"></i><strong>Ingresso principale</strong><small>${data.doorbellLastEvent}</small></div><div class="card-actions"><button class="primary" data-action="open-intercom"><i class="fa-solid fa-video"></i> Apri video</button></div>` });
    right.innerHTML = card({ title: 'Luci', value: `${lightsOn()} accese`, icon: 'fa-lightbulb', body: `${metrics([['Primo piano', firstLights], ['Secondo piano', secondLights], ['Totale stanze', rooms.length], ['Stato', lightsOn() ? 'Attive' : 'Tutte spente']])}<div class="card-actions"><button data-action="lights-off-all"><i class="fa-solid fa-lightbulb"></i> Spegni tutte</button></div>` }) +
      card({ title: 'Tapparelle', value: `${Math.round(shuttersAverage())}%`, icon: 'fa-window-maximize', body: `${metrics([['Apertura media', `${Math.round(shuttersAverage())}%`], ['Motorizzate', motorized], ['Aperte', rooms.filter((room) => Number(roomStates[room.id].cover) > 80).length], ['Chiuse', rooms.filter((room) => Number(roomStates[room.id].cover) < 10).length]])}<div class="card-actions"><button data-action="covers-open-all"><i class="fa-solid fa-arrow-up"></i> Apri tutte</button><button data-action="covers-stop-all"><i class="fa-solid fa-stop"></i> Stop</button><button class="danger" data-action="covers-close-all"><i class="fa-solid fa-arrow-down"></i> Chiudi tutte</button></div>` });
    context.hidden = true;
  }

  function render() {
    updateHeader();
    const titles = { overview: 'Panoramica', rooms: 'Stanze', energy: 'Energia', network: 'Rete', security: 'Sicurezza' };
    if ($('#view-title')) $('#view-title').textContent = titles[state.view] || 'Panoramica';
    document.querySelectorAll('.view-nav [data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
    if (markerLayer) markerLayer.hidden = true;
    ({ overview: overviewView, rooms: roomsView, energy: energyView, network: networkView, security: securityView }[state.view] || overviewView)();
  }

  function openIntercom() {
    const dialog = $('#intercom-modal');
    if (dialog?.showModal) dialog.showModal();
    else toast('Videocitofono demo aperto');
  }

  function runAction(action, roomId) {
    const roomState = roomStates[roomId];
    if (action === 'room-light' && roomState) roomState.lightOn = !roomState.lightOn;
    else if (action === 'room-cover-open' && roomState) roomState.cover = 100;
    else if (action === 'room-cover-close' && roomState) roomState.cover = 0;
    else if (action === 'covers-open-all') rooms.forEach((room) => { if (Number.isFinite(roomStates[room.id].cover)) roomStates[room.id].cover = 100; });
    else if (action === 'covers-close-all') rooms.forEach((room) => { if (Number.isFinite(roomStates[room.id].cover)) roomStates[room.id].cover = 0; });
    else if (action === 'covers-stop-all') toast('Tapparelle ferme');
    else if (action === 'lights-off-all') rooms.forEach((room) => { roomStates[room.id].lightOn = false; });
    else if (action === 'alarm-home') data.alarmState = 'armed_home';
    else if (action === 'alarm-away') data.alarmState = 'armed_away';
    else if (action === 'alarm-disarm') data.alarmState = 'disarmed';
    else if (action === 'open-intercom') openIntercom();
    else if (action === 'open-gate') toast('Cancello aperto in modalità demo');
    else if (action === 'network-test') toast('Test demo: ping 7 ms, jitter 1,4 ms');
    if (!['open-intercom', 'covers-stop-all', 'open-gate', 'network-test'].includes(action)) toast('Comando demo eseguito');
    render();
  }

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-view]');
    if (nav) { state.view = nav.dataset.view; render(); return; }
    const targetCard = event.target.closest('[data-view-target]');
    if (targetCard) { state.view = targetCard.dataset.viewTarget; render(); return; }
    const roomNode = event.target.closest('[data-room]');
    if (roomNode && !event.target.closest('[data-action]')) { state.selectedRoom = roomNode.dataset.room; state.view = 'rooms'; render(); return; }
    const actionNode = event.target.closest('[data-action]');
    if (actionNode) runAction(actionNode.dataset.action, actionNode.dataset.room);
  });

  document.addEventListener('keydown', (event) => {
    const cardNode = event.target.closest('[data-view-target]');
    if (cardNode && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); state.view = cardNode.dataset.viewTarget; render(); }
  });

  $('#close-intercom')?.addEventListener('click', () => $('#intercom-modal')?.close());
  const loading = $('#loading');
  if (loading) loading.style.pointerEvents = 'none';
  window.CASA_DASHBOARD_READY = 'v38';
  render();
})();
