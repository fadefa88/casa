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
      { name: 'Luce Salotto', kind: 'light' },
      { name: 'Scale', kind: 'light' },
      { name: 'Ingresso', kind: 'light' },
      { name: 'Luce Esterna Salotto', kind: 'light' },
      { name: 'Tapparella Salotto', kind: 'cover' },
      { name: 'Portafinestra Salotto', kind: 'light' },
      { name: 'Tapparella Scale', kind: 'cover' },
    ],
    'first-cucina': [
      { name: 'Pensili Cucina', kind: 'light' },
      { name: 'Tapparella Cucina', kind: 'cover' },
    ],
    'first-camera-matrimoniale': [
      { name: 'Luca Camera Matrimoniale', aliases: ['Luce Camera Matrimoniale'], kind: 'light' },
      { name: 'Tapparella Camera Matrimoniale', kind: 'cover' },
    ],
    'first-corridoio': [
      { name: 'Corridoio', kind: 'light' },
    ],
    'first-studio': [
      { name: 'Luce Studio', kind: 'light' },
      { name: 'Luce Esterna Studio', kind: 'light' },
      { name: 'Portafinestra Studio', kind: 'light' },
    ],
    'first-cameretta': [
      { name: 'Luce Cameretta', kind: 'light' },
      { name: 'Tapparella Cameretta', kind: 'cover' },
    ],
    'first-bagno-matrimoniale': [
      { name: 'Luce Bagno Matrimoniale', kind: 'light' },
      { name: 'Specchio Bagno Matrimoniale', kind: 'light' },
    ],
    'first-bagno-ospiti': [
      { name: 'Luce Bagno Ospiti', kind: 'light' },
      { name: 'Specchio Bagno Ospiti', kind: 'light' },
    ],
    'second-vano-tecnico': [
      { name: 'Luce Vano Tecnico', kind: 'light' },
    ],
    'second-bagno-mansarda': [
      { name: 'Luce Bagno Mansarda', kind: 'light' },
      { name: 'Specchio Bagno Mansarda', kind: 'light' },
      { name: 'Tapparella Bagno Mansarda', kind: 'cover' },
    ],
    'second-mansarda': [
      { name: 'Led Mansarda DX', kind: 'light' },
      { name: 'Led Mansarda SX', kind: 'light' },
      { name: 'Led Mansarda Centrale', kind: 'light' },
      { name: 'Luce Esterna Mansarda', kind: 'light' },
      { name: 'Corridoio Mansarda', kind: 'light' },
      { name: 'Portafinestra Mansarda', kind: 'light' },
    ],
    'second-camera-mansarda': [
      { name: 'Luce Camera Mansarda', kind: 'light' },
      { name: 'Luce Esterna Camera Mansarda', kind: 'light' },
      { name: 'Portafinestra Camera Mansarda', kind: 'light' },
    ],
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

  function preferredDomains(kind) {
    return kind === 'cover'
      ? ['cover']
      : ['light', 'switch', 'input_boolean'];
  }

  function resolveDevice(item) {
    const map = states();
    const names = [item.name, ...(item.aliases || [])].map(normalize).filter(Boolean);
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
        if (friendly === name) score = Math.max(score, 140 - aliasPenalty);
        else if (entityId === name) score = Math.max(score, 130 - aliasPenalty);
        else if (friendly.startsWith(`${name} `) || friendly.endsWith(` ${name}`)) score = Math.max(score, 108 - aliasPenalty);
        else {
          const tokens = name.split(' ').filter((token) => token.length > 2);
          if (tokens.length && tokens.every((token) => text.includes(token))) {
            score = Math.max(score, 70 + tokens.length * 7 - aliasPenalty);
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

  function temperatureFor(roomId, visiting = new Set()) {
    const room = roomConfig(roomId);
    if (!room || visiting.has(roomId)) return null;
    visiting.add(roomId);
    if (room.temperatureFrom) return temperatureFor(room.temperatureFrom, visiting);

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
      const score = tokens.reduce((max, token) => Math.max(max, text.includes(token) ? 10 + token.split(' ').length * 3 : 0), 0);
      const value = Number(entity.state);
      if (Number.isFinite(value) && score > bestScore) { bestScore = score; best = value; }
    }
    return bestScore >= 10 ? best : null;
  }

  function deviceIcon(item) {
    const name = normalize(item.name);
    if (item.kind === 'cover') return 'fa-window-maximize';
    if (name.includes('specchio')) return 'fa-mirror';
    if (name.includes('scale')) return 'fa-stairs';
    if (name.includes('ingresso')) return 'fa-door-closed';
    if (name.includes('esterna')) return 'fa-sun';
    if (name.includes('portafinestra')) return 'fa-door-open';
    if (name.includes('led')) return 'fa-lightbulb';
    return 'fa-lightbulb';
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
    return `<section class="card fill scrollable room-device-floor" data-rooms-floor="${floor}">
      <div class="card-head"><span class="title"><i class="fa-solid ${icon}"></i> ${title}</span><strong>${floorRooms.length} ambienti</strong></div>
      <div class="room-device-list">${floorRooms.map(roomCard).join('')}</div>
    </section>`;
  }

  function lightTile(device) {
    const { item, entity, status } = device;
    const entityId = entity?.entity_id || '';
    const disabled = !entity ? 'disabled' : '';
    return `<button class="ha-device-tile ${status.cls}" data-ha-device-toggle="${entityId}" ${disabled}>
      <span class="ha-device-icon"><i class="fa-solid ${deviceIcon(item)}"></i></span>
      <span class="ha-device-copy"><strong>${item.name}</strong><small>${status.label}</small></span>
      <span class="ha-device-power"><i class="fa-solid fa-power-off"></i></span>
    </button>`;
  }

  function coverTile(device) {
    const { item, entity, status } = device;
    const entityId = entity?.entity_id || '';
    const disabled = !entity ? 'disabled' : '';
    return `<div class="ha-device-tile cover ${status.cls}">
      <span class="ha-device-icon"><i class="fa-solid ${deviceIcon(item)}"></i></span>
      <span class="ha-device-copy"><strong>${item.name}</strong><small>${status.label}</small></span>
      <span class="ha-cover-actions">
        <button data-ha-cover-action="open_cover" data-entity-id="${entityId}" title="Apri" ${disabled}><i class="fa-solid fa-arrow-up"></i></button>
        <button data-ha-cover-action="stop_cover" data-entity-id="${entityId}" title="Stop" ${disabled}><i class="fa-solid fa-stop"></i></button>
        <button data-ha-cover-action="close_cover" data-entity-id="${entityId}" title="Chiudi" ${disabled}><i class="fa-solid fa-arrow-down"></i></button>
      </span>
    </div>`;
  }

  function contextHtml(room) {
    const snapshot = roomSnapshot(room.id);
    const floor = room.floor === 'first' ? 'Primo piano' : 'Secondo piano';
    const temperature = Number.isFinite(snapshot.temperature) ? `${fmt.format(snapshot.temperature)} °C` : NULL_TEXT;
    const available = snapshot.devices.length - snapshot.unavailable;
    const devices = snapshot.devices.map((device) => device.item.kind === 'cover' ? coverTile(device) : lightTile(device)).join('');

    return `<div class="room-device-context-layout">
      <div class="room-device-context-head">
        <span class="room-device-context-icon"><i class="fa-solid ${room.icon || 'fa-door-open'}"></i></span>
        <span><strong>${room.name}</strong><small>${floor} · ${available}/${snapshot.devices.length} dispositivi collegati</small></span>
        <span class="room-device-context-temp"><small>Temperatura</small><strong>${temperature}</strong></span>
      </div>
      <div class="ha-device-grid">${devices || '<div class="rooms-empty">Nessun dispositivo configurato</div>'}</div>
    </div>`;
  }

  function signature() {
    const values = [currentView(), selectedRoomId, connected() ? '1' : '0'];
    Object.entries(ROOM_DEVICES).forEach(([roomId, definitions]) => {
      values.push(roomId, String(temperatureFor(roomId)));
      definitions.forEach((item) => {
        const entity = resolveDevice(item);
        values.push(item.name, entity?.entity_id || '', entity?.state || '', String(entity?.attributes?.current_position ?? ''));
      });
    });
    return values.join('|');
  }

  function injectStyles() {
    if (document.querySelector('#rooms-devices-v52-styles')) return;
    const style = document.createElement('style');
    style.id = 'rooms-devices-v52-styles';
    style.textContent = `
      .room-device-floor{padding-bottom:.6rem!important}
      .room-device-list{display:grid;gap:.38rem;margin-top:.45rem}
      .room-device-card{display:grid;grid-template-columns:2.35rem minmax(0,1fr) auto;align-items:center;gap:.55rem;width:100%;padding:.48rem .55rem;border:1px solid rgba(255,255,255,.075);border-radius:.78rem;background:rgba(255,255,255,.035);color:#f8fbff;text-align:left;cursor:pointer;transition:.16s ease}
      .room-device-card:hover,.room-device-card.active{border-color:rgba(96,165,250,.52);background:rgba(37,99,235,.17)}
      .room-device-icon{display:grid;place-items:center;width:2.25rem;height:2.25rem;border-radius:.68rem;background:rgba(59,130,246,.15);color:#93c5fd}
      .room-device-main,.room-device-side{min-width:0}.room-device-main strong,.room-device-main small,.room-device-side strong,.room-device-side small{display:block}
      .room-device-main strong{font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.room-device-main small{margin-top:.15rem;font-size:.55rem;color:#92a6bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .room-device-side{text-align:right}.room-device-side strong{font-size:.78rem}.room-device-side small{margin-top:.15rem;font-size:.5rem;color:#8ea2b7;white-space:nowrap}.room-device-side small.active{color:#86efac}
      .context-panel.rooms-device-context{min-height:8.8rem;padding:.62rem .72rem;overflow:hidden}
      .room-device-context-layout{display:grid;grid-template-columns:10.5rem minmax(0,1fr);gap:.65rem;height:100%;align-items:stretch}
      .room-device-context-head{display:grid;grid-template-columns:2.45rem minmax(0,1fr);grid-template-rows:auto auto;gap:.45rem;align-content:center;padding:.55rem;border-radius:.82rem;background:rgba(255,255,255,.045)}
      .room-device-context-icon{grid-row:1/3;display:grid;place-items:center;width:2.35rem;height:2.35rem;border-radius:.72rem;background:rgba(37,99,235,.2);color:#93c5fd}
      .room-device-context-head>span:nth-child(2){min-width:0}.room-device-context-head>span:nth-child(2)>strong,.room-device-context-head>span:nth-child(2)>small{display:block}.room-device-context-head>span:nth-child(2)>strong{font-size:.82rem}.room-device-context-head>span:nth-child(2)>small{margin-top:.15rem;font-size:.52rem;color:#94a7bd;line-height:1.35}
      .room-device-context-temp{grid-column:1/3;display:flex;align-items:center;justify-content:space-between;padding-top:.38rem;border-top:1px solid rgba(255,255,255,.07)}.room-device-context-temp small{font-size:.52rem;color:#8ea2b7}.room-device-context-temp strong{font-size:.78rem}
      .ha-device-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.2rem,1fr));gap:.38rem;align-content:center;min-width:0;overflow:auto;scrollbar-width:none}.ha-device-grid::-webkit-scrollbar{display:none}
      .ha-device-tile{display:grid;grid-template-columns:1.85rem minmax(0,1fr) 1.55rem;align-items:center;gap:.4rem;min-height:3.45rem;padding:.42rem;border:1px solid rgba(255,255,255,.075);border-radius:.72rem;background:rgba(255,255,255,.04);color:#f8fbff;text-align:left;min-width:0}
      button.ha-device-tile{cursor:pointer}.ha-device-tile:hover:not(:disabled){border-color:rgba(96,165,250,.5);background:rgba(37,99,235,.14)}.ha-device-tile.on{border-color:rgba(74,222,128,.28);background:rgba(34,197,94,.09)}.ha-device-tile.null{opacity:.58}
      .ha-device-icon{display:grid;place-items:center;width:1.8rem;height:1.8rem;border-radius:.56rem;background:rgba(59,130,246,.14);color:#93c5fd}.ha-device-tile.on .ha-device-icon{background:rgba(34,197,94,.15);color:#86efac}
      .ha-device-copy{min-width:0}.ha-device-copy strong,.ha-device-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ha-device-copy strong{font-size:.59rem}.ha-device-copy small{margin-top:.15rem;font-size:.49rem;color:#91a5bd}.ha-device-tile.on .ha-device-copy small{color:#86efac}.ha-device-tile.null .ha-device-copy small{color:#ff9d9d}
      .ha-device-power{display:grid;place-items:center;width:1.45rem;height:1.45rem;border-radius:.45rem;background:rgba(255,255,255,.06);font-size:.58rem;color:#8ea2b7}.ha-device-tile.on .ha-device-power{color:#86efac;background:rgba(34,197,94,.14)}
      .ha-device-tile.cover{grid-template-columns:1.85rem minmax(0,1fr) auto}.ha-cover-actions{display:flex;gap:.18rem}.ha-cover-actions button{display:grid;place-items:center;width:1.35rem;height:1.35rem;padding:0;border:1px solid rgba(255,255,255,.1);border-radius:.38rem;background:rgba(255,255,255,.055);color:#dce8f7;font-size:.52rem;cursor:pointer}.ha-cover-actions button:hover:not(:disabled){background:#2563eb}.ha-cover-actions button:disabled,.ha-device-tile:disabled{cursor:not-allowed}
      .rooms-empty{display:grid;place-items:center;color:#8ea2b7;font-size:.66rem}
      @media(max-width:1450px){.room-device-context-layout{grid-template-columns:9rem minmax(0,1fr)}.ha-device-grid{grid-template-columns:repeat(auto-fit,minmax(7.4rem,1fr))}}
      @media(orientation:landscape) and (max-height:600px){
        .room-device-list{gap:.18rem;margin-top:.2rem}.room-device-card{grid-template-columns:1.5rem minmax(0,1fr) auto;gap:.28rem;padding:.2rem .28rem;border-radius:.45rem}.room-device-icon{width:1.42rem;height:1.42rem;border-radius:.4rem;font-size:.55rem}.room-device-main strong{font-size:.45rem}.room-device-main small{font-size:.34rem}.room-device-side strong{font-size:.48rem}.room-device-side small{font-size:.32rem}
        .context-panel.rooms-device-context{bottom:36px;min-height:4.9rem;padding:.28rem .35rem}.room-device-context-layout{grid-template-columns:6.8rem minmax(0,1fr);gap:.3rem}.room-device-context-head{grid-template-columns:1.55rem minmax(0,1fr);gap:.22rem;padding:.3rem;border-radius:.48rem}.room-device-context-icon{width:1.45rem;height:1.45rem;border-radius:.4rem;font-size:.55rem}.room-device-context-head>span:nth-child(2)>strong{font-size:.48rem}.room-device-context-head>span:nth-child(2)>small,.room-device-context-temp small{font-size:.31rem}.room-device-context-temp{padding-top:.2rem}.room-device-context-temp strong{font-size:.45rem}
        .ha-device-grid{grid-template-columns:repeat(auto-fit,minmax(5.7rem,1fr));gap:.2rem}.ha-device-tile{grid-template-columns:1.2rem minmax(0,1fr) 1rem;gap:.22rem;min-height:2.1rem;padding:.22rem;border-radius:.45rem}.ha-device-tile.cover{grid-template-columns:1.2rem minmax(0,1fr) auto}.ha-device-icon{width:1.15rem;height:1.15rem;border-radius:.35rem;font-size:.42rem}.ha-device-copy strong{font-size:.38rem}.ha-device-copy small{font-size:.31rem}.ha-device-power{width:.9rem;height:.9rem;border-radius:.28rem;font-size:.36rem}.ha-cover-actions{gap:.1rem}.ha-cover-actions button{width:.82rem;height:.82rem;border-radius:.25rem;font-size:.3rem}
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
