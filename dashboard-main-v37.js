import { cfg, rooms, appState, $, fmt, demoData, fetchHA } from './dashboard-state-v37.js';
import { renderApp, roomContext } from './dashboard-views-v37.js';

const markerLayer = $('#room-marker-layer');
let toastTimer = null;

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
}

function createMarkers() {
  if (!appState.data || !markerLayer) return;
  markerLayer.innerHTML = rooms.map((room) => {
    const state = appState.data.roomStates[room.id];
    return `<button class="room-marker" data-room="${room.id}"><strong>${room.name}</strong><span>${fmt.format(state.temperature)}° <em>${state.lightOn ? '●' : ''}</em></span></button>`;
  }).join('');
}

function updateMarkers() {
  if (appState.view !== 'rooms' || !appState.data) return;
  const context = window.CASA_3D_CONTEXT;
  const rect = $('#scene')?.getBoundingClientRect();
  if (!context?.camera || !context?.renderer || !rect) return;
  if (!markerLayer.children.length) createMarkers();

  for (const room of rooms) {
    const marker = markerLayer.querySelector(`[data-room="${room.id}"]`);
    const anchor = context.anchors?.find((item) => item.modelKey === room.modelKey);
    if (!marker || !anchor) continue;
    if (appState.floor !== 'both' && appState.floor !== room.floor) {
      marker.classList.remove('visible');
      continue;
    }
    const point = anchor.point.clone().project(context.camera);
    marker.style.left = `${rect.left + (point.x * 0.5 + 0.5) * rect.width}px`;
    marker.style.top = `${rect.top + (-point.y * 0.5 + 0.5) * rect.height}px`;
    marker.classList.toggle('visible', point.z > -1 && point.z < 1);
    marker.classList.toggle('active', appState.selectedRoom === room.id);
  }
}

(function markerLoop() {
  updateMarkers();
  requestAnimationFrame(markerLoop);
}());

window.addEventListener('casa:rooms-ready', () => {
  if (appState.view === 'rooms') createMarkers();
});

async function callService(domain, serviceName, entityId) {
  if (cfg.mode !== 'homeassistant') {
    toast('Comando simulato: modalità demo');
    return;
  }
  const { url, token } = cfg.homeAssistant || {};
  const response = await fetch(`${url.replace(/\/$/, '')}/api/services/${domain}/${serviceName}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: entityId }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function runAction(action, roomId) {
  const room = rooms.find((item) => item.id === roomId);
  const state = room ? appState.data.roomStates[room.id] : null;
  try {
    if (action === 'room-light' && room?.entities.lights) {
      state.lightOn = !state.lightOn;
      await callService('light', state.lightOn ? 'turn_on' : 'turn_off', room.entities.lights);
    } else if (action === 'room-cover-open' && room?.entities.cover) {
      state.cover = 100;
      await callService('cover', 'open_cover', room.entities.cover);
    } else if (action === 'room-cover-close' && room?.entities.cover) {
      state.cover = 0;
      await callService('cover', 'close_cover', room.entities.cover);
    } else if (action === 'covers-open-all') {
      rooms.forEach((item) => { if (item.entities.cover) appState.data.roomStates[item.id].cover = 100; });
      await callService('cover', 'open_cover', cfg.entities.allShutters);
    } else if (action === 'covers-close-all') {
      if (!confirm('Chiudere tutte le tapparelle?')) return;
      rooms.forEach((item) => { if (item.entities.cover) appState.data.roomStates[item.id].cover = 0; });
      await callService('cover', 'close_cover', cfg.entities.allShutters);
    } else if (action === 'covers-stop-all') {
      await callService('cover', 'stop_cover', cfg.entities.allShutters);
    } else if (action === 'lights-off-all') {
      rooms.forEach((item) => { appState.data.roomStates[item.id].lightOn = false; });
      await callService('light', 'turn_off', cfg.entities.allLights);
    } else if (action === 'alarm-home') {
      appState.data.alarmState = 'armed_home';
      await callService('alarm_control_panel', 'alarm_arm_home', cfg.entities.alarm);
    } else if (action === 'alarm-away') {
      appState.data.alarmState = 'armed_away';
      await callService('alarm_control_panel', 'alarm_arm_away', cfg.entities.alarm);
    } else if (action === 'alarm-disarm') {
      appState.data.alarmState = 'disarmed';
      await callService('alarm_control_panel', 'alarm_disarm', cfg.entities.alarm);
    } else if (action === 'open-intercom') {
      openIntercom();
    } else if (action === 'open-gate') {
      if (!confirm('Aprire il cancello?')) return;
      await callService('button', 'press', cfg.entities.gateButton);
    } else if (action === 'network-test') {
      toast('Test rete demo completato: ping 7 ms, jitter 1,4 ms');
    }
    renderApp();
    if (appState.view === 'rooms') {
      createMarkers();
      roomContext();
    }
  } catch (error) {
    console.error(error);
    toast('Comando non riuscito');
  }
}

function openIntercom() {
  const dialog = $('#intercom-modal');
  const video = $('#intercom-video');
  if (cfg.videoIntercomUrl) {
    video.innerHTML = `<img src="${cfg.videoIntercomUrl}" alt="Videocitofono" style="width:100%;height:100%;object-fit:cover;border-radius:14px">`;
  }
  dialog.showModal();
}

function switchView(view) {
  appState.view = view;
  renderApp();
  if (view === 'rooms') createMarkers();
}

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-view]');
  if (nav) {
    switchView(nav.dataset.view);
    return;
  }

  const targetCard = event.target.closest('[data-view-target]');
  if (targetCard) {
    switchView(targetCard.dataset.viewTarget);
    return;
  }

  const roomNode = event.target.closest('[data-room]');
  if (roomNode && !event.target.closest('[data-action]')) {
    appState.selectedRoom = roomNode.dataset.room;
    const room = rooms.find((item) => item.id === appState.selectedRoom);
    if (room) {
      appState.floor = room.floor;
      document.querySelector(`.tablet-floor-nav [data-floor="${room.floor}"]`)?.click();
    }
    switchView('rooms');
    return;
  }

  const actionNode = event.target.closest('[data-action]');
  if (actionNode) runAction(actionNode.dataset.action, actionNode.dataset.room);
});

document.addEventListener('keydown', (event) => {
  const targetCard = event.target.closest('[data-view-target]');
  if (targetCard && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    switchView(targetCard.dataset.viewTarget);
  }
});

document.querySelectorAll('.tablet-floor-nav [data-floor]').forEach((button) => {
  button.addEventListener('click', () => { appState.floor = button.dataset.floor; });
});

$('#close-intercom')?.addEventListener('click', () => $('#intercom-modal').close());

function updateClock() {
  const now = new Date();
  $('#clock').textContent = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  $('#date').textContent = now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
}
updateClock();
setInterval(updateClock, 1000);

async function refresh() {
  try {
    appState.data = cfg.mode === 'homeassistant' ? await fetchHA() : demoData();
    renderApp();
    if (appState.view === 'rooms') createMarkers();
  } catch (error) {
    console.error(error);
    appState.data = demoData();
    renderApp();
    toast('Home Assistant non raggiungibile: dati demo');
  }
}

refresh();
if (cfg.mode === 'homeassistant') setInterval(refresh, cfg.refreshMs || 10000);

const scene = $('#scene');
if (scene) {
  scene.style.pointerEvents = 'auto';
  scene.style.touchAction = 'none';
}
