const cfg=window.CASA_DASHBOARD_CONFIG||{mode:'demo',refreshMs:5000};
const $=s=>document.querySelector(s);
const els={
  clock:$('#clock'), date:$('#date'), housePower:$('#house-power'), houseToday:$('#house-today'), houseCost:$('#house-cost'), housePeak:$('#house-peak'), houseVs:$('#house-vs'),
  pvPower:$('#pv-power'), pvToday:$('#pv-today'), pvSelf:$('#pv-self'), gridImport:$('#grid-import'), gridExport:$('#grid-export'),
  networkStatus:$('#network-status'), routerLatency:$('#router-latency'), backupStatus:$('#backup-status'), switchLoad:$('#switch-load'), haLag:$('#ha-lag'),
  climateMode:$('#climate-mode'), tempIn:$('#temp-in'), tempOut:$('#temp-out'), hpPower:$('#hp-power'), vmcPower:$('#vmc-power'),
  quickTotal:$('#quick-total'), tvPower:$('#tv-power'), studioPower:$('#studio-power'), inductionPower:$('#induction-power'), labPower:$('#lab-power'),
  homeState:$('#home-state'), alarmState:$('#alarm-state'), lightsPt:$('#lights-pt'), lightsP1:$('#lights-p1'), lastUpdate:$('#last-update'),
  internetPill:$('#internet-pill'), haPill:$('#ha-pill'), backupPill:$('#backup-pill'), detailTitle:$('#detail-title'), detailGrid:$('#detail-grid'), detailNote:$('#detail-note')
};
const detailSets={
  hp:[['Consumo attuale','1.42 kW'],['Oggi','7.8 kWh'],['Modalità','Riscaldamento'],['Ultimo update','8 s fa']],
  vmc:[['Consumo attuale','68 W'],['Portata','182 m³/h'],['Modalità','Auto'],['Filtri','OK']],
  tv:[['Consumo attuale','214 W'],['Oggi','1.9 kWh'],['Componenti','Shield + TV + Switch'],['Stato','Attivo']],
  studio:[['Consumo attuale','286 W'],['Oggi','2.6 kWh'],['Componenti','Mini PC + monitor'],['Stato','Attivo']],
  network:[['FTTH','Online'],['Backup 5G','Standby'],['Ping router','6 ms'],['Home Assistant','Demo collegata']],
  pv:[['Produzione','1.86 kW'],['Oggi','12.4 kWh'],['Autoconsumo','71%'],['Scambio','0.9 kWh']]
};
function fmt(n,u='',d=0){return `${Number(n).toFixed(d)} ${u}`.trim()}
function updateClock(){const now=new Date(); els.clock.textContent=now.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}); els.date.textContent=now.toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'});} updateClock(); setInterval(updateClock,1000);
function buildDetail(key){const rows=detailSets[key]||[]; const titles={hp:'Pompa di calore',vmc:'VMC',tv:'Zona TV',studio:'Studio',network:'Rete e core',pv:'Fotovoltaico'}; els.detailTitle.textContent=titles[key]||'Dettaglio'; els.detailGrid.innerHTML=''; rows.forEach(([a,b])=>{const div=document.createElement('div'); div.className='detail-cell'; div.innerHTML=`<small>${a}</small><strong>${b}</strong>`; els.detailGrid.appendChild(div);});}
buildDetail('hp'); document.querySelectorAll('.hotspot').forEach(b=>b.addEventListener('click',()=>buildDetail(b.dataset.detail)));
const demoBase={housePower:1840,houseToday:14.6,houseCost:4.18,housePeak:3.92,houseVs:-8,pvPower:1860,pvToday:12.4,pvSelf:71,gridImport:6.1,gridExport:1.8,tempIn:24.1,tempOut:31.6,hpPower:1420,vmcPower:68,tvPower:214,studioPower:286,inductionPower:0,labPower:122,routerLatency:6,switchLoad:34,haLag:3};
function randomize(base){const o={...base}; for(const k of Object.keys(o)){ if(typeof o[k]==='number'){ const delta=Math.random()*0.08-0.04; o[k]=Math.max(0, o[k]*(1+delta)); } } return o; }
function render(data){
  els.housePower.textContent=fmt(data.housePower,'W'); els.houseToday.textContent=fmt(data.houseToday,'kWh',1); els.houseCost.textContent='€'+Number(data.houseCost).toFixed(2); els.housePeak.textContent=fmt(data.housePeak,'kW',2); els.houseVs.textContent=(data.houseVs>0?'+':'')+Number(data.houseVs).toFixed(0)+'%';
  els.pvPower.textContent=fmt(data.pvPower,'W'); els.pvToday.textContent=fmt(data.pvToday,'kWh',1); els.pvSelf.textContent=Number(data.pvSelf).toFixed(0)+'%'; els.gridImport.textContent=fmt(data.gridImport,'kWh',1); els.gridExport.textContent=fmt(data.gridExport,'kWh',1);
  els.networkStatus.textContent='OK'; els.routerLatency.textContent=fmt(data.routerLatency,'ms',0); els.backupStatus.textContent='Standby'; els.switchLoad.textContent=Number(data.switchLoad).toFixed(0)+'%'; els.haLag.textContent=fmt(data.haLag,'s',0);
  els.climateMode.textContent='Comfort'; els.tempIn.textContent=fmt(data.tempIn,'°C',1); els.tempOut.textContent=fmt(data.tempOut,'°C',1); els.hpPower.textContent=fmt(data.hpPower,'W'); els.vmcPower.textContent=fmt(data.vmcPower,'W');
  const quickTotal=data.tvPower+data.studioPower+data.inductionPower+data.labPower; els.quickTotal.textContent=fmt(quickTotal,'W'); els.tvPower.textContent=fmt(data.tvPower,'W'); els.studioPower.textContent=fmt(data.studioPower,'W'); els.inductionPower.textContent=fmt(data.inductionPower,'W'); els.labPower.textContent=fmt(data.labPower,'W');
  els.homeState.textContent='Normale'; els.alarmState.textContent='Disattivo'; els.lightsPt.textContent='Off'; els.lightsP1.textContent='Off'; els.lastUpdate.textContent=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  els.haPill.textContent=cfg.mode==='homeassistant'?'Home Assistant live':'Home Assistant demo';
}
async function fetchHomeAssistant(){
  const {url,token}=cfg.homeAssistant||{}; if(!url||!token) throw new Error('Config HA incompleta');
  const res=await fetch(url.replace(/\/$/,'')+'/api/states',{headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}}); if(!res.ok) throw new Error('HTTP '+res.status); const states=await res.json();
  const map=Object.fromEntries(states.map(s=>[s.entity_id,s]));
  const get=(k, fallback=0)=>Number(map[cfg.entities[k]]?.state ?? fallback);
  return {housePower:get('housePower'),houseToday:get('houseToday'),houseCost:get('houseCost'),housePeak:get('housePower')/1000,houseVs:-5,pvPower:get('pvPower'),pvToday:get('pvToday'),pvSelf:70,gridImport:get('gridImport'),gridExport:get('gridExport'),tempIn:get('tempIn'),tempOut:get('tempOut'),hpPower:get('heatPumpPower'),vmcPower:get('vmcPower'),tvPower:get('tvPower'),studioPower:get('studioPower'),inductionPower:get('inductionPower'),labPower:get('labPower'),routerLatency:get('routerLatency'),switchLoad:get('switchLoad'),haLag:2};
}
async function refresh(){try{const data=cfg.mode==='homeassistant'?await fetchHomeAssistant():randomize(demoBase); render(data); els.internetPill.className='pill ok'; els.internetPill.textContent='FTTH online'; els.backupPill.className='pill warn'; els.backupPill.textContent='5G standby';}catch(err){console.error(err); render(randomize(demoBase)); els.haPill.className='pill bad'; els.haPill.textContent='HA non raggiungibile'; els.detailNote.innerHTML='Dati demo. Configurazione Home Assistant non ancora collegata oppure non raggiungibile.';}}
refresh(); setInterval(refresh, cfg.refreshMs||5000);
// dashboard wall tablet: disabilita selezione e trascinamento della casa
const scene=$('#scene'); scene.style.pointerEvents='none';
