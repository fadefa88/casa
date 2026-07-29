export const cfg=window.CASA_DASHBOARD_CONFIG||{mode:'demo',refreshMs:5000,entities:{}};
export const rooms=window.CASA_ROOMS||[];
export const appState={view:'overview',floor:'both',selectedRoom:rooms[0]?.id||null,data:null};
export const $=s=>document.querySelector(s);
export const fmt=new Intl.NumberFormat('it-IT',{maximumFractionDigits:1});
export const money=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
export const power=v=>Number(v)>=1000?`${fmt.format(Number(v)/1000)} kW`:`${Math.round(Number(v)||0)} W`;
export const energy=v=>`${fmt.format(Number(v)||0)} kWh`;
export const speed=v=>Number(v)>=1000?`${fmt.format(Number(v)/1000)} Gbps`:`${fmt.format(Number(v)||0)} Mbps`;
export const sum=(...v)=>v.reduce((a,b)=>a+Number(b||0),0);
export const alarmLabel=s=>s==='armed_away'?'Inserito totale':s==='armed_home'?'Inserito notte':s==='triggered'?'ALLARME':'Disattivato';
export const alarmClass=s=>s==='triggered'?'bad':s==='disarmed'?'ok':'warn';

const demo={housePower:3280,houseToday:18.6,houseCost:5.31,housePeak:5.42,houseVs:-6,pvPower:4180,pvToday:19.8,pvSelf:78,gridImport:5.2,gridExport:6.8,heatPumpPower:1420,heatPumpToday:7.8,heatPumpMonth:126.4,heatPumpMode:'Raffrescamento',inductionPower:0,inductionToday:1.1,inductionPeak:3.6,washerPower:510,washerState:'In funzione',dryerPower:0,dryerState:'Spenta',ovenPower:0,ovenState:'Spento',fridgePower:180,fridgeState:'Compressore attivo',tvPower:112,shieldPower:9,mediaPcPower:48,hddPower:17,pcPower:250,monitorPower:38,ps5Power:0,dockPower:22,networkState:'Online',networkLinkDown:2500,networkLinkUp:1000,networkCurrentDown:412,networkCurrentUp:84,networkPing:7,networkJitter:1.4,networkPacketLoss:0,networkUptimeHours:326,networkClients:31,networkWifiClients:18,backup5gStatus:'Standby',alarmState:'disarmed',doorbellLastEvent:'Nessun evento recente'};
export const roomDemo=Object.fromEntries(rooms.map((r,i)=>[r.id,{temperature:r.type==='outdoor'?27.8+i*.15:21.8+(i%6)*.35,humidity:r.type==='outdoor'?52:43+(i%5)*3,lightOn:i%4===0,cover:r.entities.cover?35+(i*11)%66:null}]));
export function demoData(){const d={...demo,roomStates:structuredClone(roomDemo)};['housePower','pvPower','heatPumpPower','washerPower','fridgePower','networkCurrentDown','networkCurrentUp','networkPing','networkJitter'].forEach(k=>d[k]=Math.max(0,d[k]*(1+(Math.random()*.05-.025))));return d}

export function average(key,type='indoor'){const vals=rooms.filter(r=>r.type===type).map(r=>Number(appState.data.roomStates?.[r.id]?.[key])).filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}
export function lightsOn(){return rooms.filter(r=>appState.data.roomStates?.[r.id]?.lightOn).length}
export function shuttersAverage(){const vals=rooms.map(r=>appState.data.roomStates?.[r.id]?.cover).filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}

export async function fetchHA(){
  const {url,token}=cfg.homeAssistant||{};
  if(!url||!token)throw new Error('HA non configurato');
  const res=await fetch(`${url.replace(/\/$/,'')}/api/states`,{headers:{Authorization:`Bearer ${token}`}});
  if(!res.ok)throw new Error(`HA ${res.status}`);
  const states=await res.json(),map=Object.fromEntries(states.map(x=>[x.entity_id,x]));
  const raw=(id,f=0)=>map[id]?.state??f;
  const num=(id,f=0)=>{const n=Number(raw(id,f));return Number.isFinite(n)?n:f};
  const d=demoData();
  for(const [k,id] of Object.entries(cfg.entities||{})){
    if(k==='alarm')d.alarmState=String(raw(id,'disarmed'));
    else if(k==='doorbellLastEvent')d.doorbellLastEvent=String(raw(id,'-'));
    else if(k==='networkState'||k==='backup5gStatus'||k==='heatPumpMode'||k.endsWith('State'))d[k]=String(raw(id,d[k]??'-'));
    else if(k in d)d[k]=num(id,d[k]);
  }
  d.roomStates={};
  for(const r of rooms){
    const e=r.entities||{},light=map[e.lights],cover=map[e.cover];
    d.roomStates[r.id]={temperature:num(e.temperature,roomDemo[r.id].temperature),humidity:num(e.humidity,roomDemo[r.id].humidity),lightOn:light?.state==='on',cover:cover?Number(cover.attributes?.current_position??(cover.state==='open'?100:0)):null};
  }
  return d;
}
