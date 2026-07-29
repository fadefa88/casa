import {cfg,rooms,appState,$,fmt,demoData,fetchHA} from './dashboard-state-v36.js';
import {renderApp,roomContext} from './dashboard-views-v36.js';
const markerLayer=$('#room-marker-layer');let toastTimer=null;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,2200)}
function createMarkers(){if(!appState.data)return;markerLayer.innerHTML=rooms.map(r=>`<button class="room-marker" data-room="${r.id}"><strong>${r.name}</strong><span>${fmt.format(appState.data.roomStates[r.id].temperature)}° <em>${appState.data.roomStates[r.id].lightOn?'●':''}</em></span></button>`).join('')}
function markers(){if(appState.view!=='rooms'||!appState.data)return;const ctx=window.CASA_3D_CONTEXT,rect=$('#scene')?.getBoundingClientRect();if(!ctx?.camera||!ctx?.renderer||!rect)return;if(!markerLayer.children.length)createMarkers();rooms.forEach(r=>{const marker=markerLayer.querySelector(`[data-room="${r.id}"]`),anchor=ctx.anchors?.find(a=>a.modelKey===r.modelKey);if(!marker||!anchor)return;if(appState.floor!=='both'&&appState.floor!==r.floor){marker.classList.remove('visible');return}const p=anchor.point.clone().project(ctx.camera),visible=p.z>-1&&p.z<1;marker.style.left=`${rect.left+(p.x*.5+.5)*rect.width}px`;marker.style.top=`${rect.top+(-p.y*.5+.5)*rect.height}px`;marker.classList.toggle('visible',visible);marker.classList.toggle('active',appState.selectedRoom===r.id)})}
(function markerLoop(){markers();requestAnimationFrame(markerLoop)})();window.addEventListener('casa:rooms-ready',()=>{if(appState.view==='rooms')createMarkers()});
async function service(domain,name,entity){if(cfg.mode!=='homeassistant'){toast('Comando simulato in modalità demo');return}const {url,token}=cfg.homeAssistant||{};const r=await fetch(`${url.replace(/\/$/,'')}/api/services/${domain}/${name}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({entity_id:entity})});if(!r.ok)throw new Error(`HTTP ${r.status}`)}
async function action(a,roomId){const r=rooms.find(x=>x.id===roomId),s=r&&appState.data.roomStates[r.id];try{
  if(a==='room-light'&&r?.entities.lights){s.lightOn=!s.lightOn;await service('light',s.lightOn?'turn_on':'turn_off',r.entities.lights)}
  if(a==='room-cover-open'&&r?.entities.cover){s.cover=100;await service('cover','open_cover',r.entities.cover)}
  if(a==='room-cover-close'&&r?.entities.cover){s.cover=0;await service('cover','close_cover',r.entities.cover)}
  if(a==='covers-open-all'){rooms.forEach(x=>{if(x.entities.cover)appState.data.roomStates[x.id].cover=100});await service('cover','open_cover',cfg.entities.allShutters)}
  if(a==='covers-close-all'){if(!confirm('Chiudere tutte le tapparelle?'))return;rooms.forEach(x=>{if(x.entities.cover)appState.data.roomStates[x.id].cover=0});await service('cover','close_cover',cfg.entities.allShutters)}
  if(a==='covers-stop-all')await service('cover','stop_cover',cfg.entities.allShutters);
  if(a==='lights-off-all'){rooms.forEach(x=>appState.data.roomStates[x.id].lightOn=false);await service('light','turn_off',cfg.entities.allLights)}
  if(a==='alarm-home'){appState.data.alarmState='armed_home';await service('alarm_control_panel','alarm_arm_home',cfg.entities.alarm)}
  if(a==='alarm-away'){appState.data.alarmState='armed_away';await service('alarm_control_panel','alarm_arm_away',cfg.entities.alarm)}
  if(a==='alarm-disarm'){if(!confirm('Disattivare l’allarme?'))return;appState.data.alarmState='disarmed';await service('alarm_control_panel','alarm_disarm',cfg.entities.alarm)}
  if(a==='open-intercom')openIntercom();
  if(a==='open-gate'){if(!confirm('Aprire il cancello?'))return;await service('button','press',cfg.entities.gateButton)}
  if(a==='network-test')toast('Test rete avviato: risultati dai sensori Home Assistant');
  renderApp();if(appState.view==='rooms'){createMarkers();roomContext()}
}catch(e){console.error(e);toast('Comando non riuscito')}}
function openIntercom(){const d=$('#intercom-modal'),v=$('#intercom-video');if(cfg.videoIntercomUrl)v.innerHTML=`<img src="${cfg.videoIntercomUrl}" alt="Videocitofono" style="width:100%;height:100%;object-fit:cover;border-radius:14px">`;d.showModal()}
document.addEventListener('click',e=>{const view=e.target.closest('[data-view]');if(view){appState.view=view.dataset.view;renderApp();if(appState.view==='rooms')createMarkers();return}const room=e.target.closest('[data-room]');if(room&&!e.target.closest('[data-action]')){appState.selectedRoom=room.dataset.room;const r=rooms.find(x=>x.id===appState.selectedRoom);appState.floor=r.floor;document.querySelector(`.tablet-floor-nav [data-floor="${r.floor}"]`)?.click();appState.view='rooms';renderApp();createMarkers();return}const a=e.target.closest('[data-action]');if(a)action(a.dataset.action,a.dataset.room)});
document.querySelectorAll('.tablet-floor-nav [data-floor]').forEach(b=>b.addEventListener('click',()=>appState.floor=b.dataset.floor));$('#close-intercom').addEventListener('click',()=>$('#intercom-modal').close());
function clock(){const n=new Date();$('#clock').textContent=n.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});$('#date').textContent=n.toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'})}clock();setInterval(clock,1000);
async function refresh(){try{appState.data=cfg.mode==='homeassistant'?await fetchHA():demoData();renderApp();if(appState.view==='rooms')createMarkers()}catch(e){console.error(e);appState.data=demoData();renderApp();toast('Home Assistant non raggiungibile: dati demo')}}refresh();setInterval(refresh,cfg.refreshMs||5000);
const scene=$('#scene');if(scene){scene.style.pointerEvents='auto';scene.style.touchAction='none'}
