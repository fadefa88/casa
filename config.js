window.CASA_DASHBOARD_CONFIG = {
  mode: 'auto',
  demoFallback: false,
  showNullWhenOffline: true,
  refreshMs: 5000,

  // QUI devi sostituire URL e token dopo il trasferimento sul server on-premise.
  // Token: Home Assistant -> Profilo utente -> Token di accesso a lunga durata.
  homeAssistant: {
    url: 'http://homeassistant.local:8123',
    token: 'insert token'
  },

  videoIntercomUrl: '',

  // Ogni voce può essere una stringa o un array di possibili entity_id.
  // Il dashboard usa la prima entità realmente presente in Home Assistant.
  entities: {
    // Bilancio casa: consumo totale misurato da SolarNet e helper Utility Meter dedicati.
    housePower: [
      'sensor.vano_tecnico_solarnet_power_load_consumed',
      'sensor.vano_tecnico_solarnet_power_load',
      'sensor.house_power',
      'sensor.potenza_casa'
    ],
    houseToday: ['sensor.vano_tecnico_solarnet_giornaliero_import'],
    houseMonth: ['sensor.vano_tecnico_solarnet_mensile_import'],

    pvPower: ['sensor.fronius_power', 'sensor.fotovoltaico_potenza'],
    pvToday: ['sensor.fronius_today', 'sensor.fotovoltaico_energia_oggi'],
    pvSelfConsumption: ['sensor.pv_self_consumption_percent', 'sensor.autoconsumo_fotovoltaico'],
    gridImport: ['sensor.grid_import_today', 'sensor.prelievo_rete_oggi'],
    gridExport: ['sensor.grid_export_today', 'sensor.immissione_rete_oggi'],

    // Flussi istantanei SolarNet usati nella card "Fotovoltaico casa".
    solarLoadConsumed: [
      'sensor.vano_tecnico_solarnet_power_load_consumed',
      'sensor.vano_tecnico_solarnet_power_load'
    ],
    solarGridExportPower: [
      'sensor.vano_tecnico_solarnet_power_grid_export',
      'sensor.vano_tecnico_solarnet_grid_export'
    ],
    solarGridImportPower: [
      'sensor.vano_tecnico_solarnet_power_grid_import',
      'sensor.vano_tecnico_solarnet_grid_import'
    ],

    // Linee Shelly: stessi sensori/helper usati in consumi-test.
    heatPumpPower: ['sensor.vano_tecnico_shelly_pompa_di_calore_potenza'],
    heatPumpToday: ['sensor.vano_tecnico_shelly_pompa_di_calore_giornaliero_pompa_calore'],
    heatPumpYesterday: [],
    heatPumpMonth: ['sensor.vano_tecnico_shelly_pompa_di_calore_mensile_pompa_calore'],
    heatPumpYear: ['sensor.vano_tecnico_shelly_pompa_di_calore_annuale_pompa_di_calore'],
    heatPumpMode: ['sensor.heat_pump_mode', 'sensor.modalita_pompa_di_calore'],
    inductionPower: ['sensor.cucina_shelly_induzione_potenza'],
    inductionToday: ['sensor.cucina_shelly_induzione_induzione_gg'],
    inductionYesterday: [],
    inductionMonth: ['sensor.cucina_shelly_induzione_induzione_kwh_mese'],
    inductionYear: ['sensor.cucina_shelly_induzione_induzione_kwh_anno'],
    inductionPeak: ['sensor.induction_peak_power', 'sensor.induzione_picco'],

    washerPower: ['sensor.washer_power', 'sensor.lavatrice_potenza'],
    washerToday: ['sensor.washer_today_energy', 'sensor.lavatrice_energia_oggi'],
    washerYesterday: ['sensor.washer_yesterday_energy', 'sensor.lavatrice_energia_ieri'],
    washerMonth: ['sensor.washer_month_energy', 'sensor.lavatrice_energia_mese'],
    washerState: ['sensor.washer_state', 'sensor.lavatrice_stato'],
    dryerPower: ['sensor.dryer_power', 'sensor.asciugatrice_potenza'],
    dryerToday: ['sensor.dryer_today_energy', 'sensor.asciugatrice_energia_oggi'],
    dryerYesterday: ['sensor.dryer_yesterday_energy', 'sensor.asciugatrice_energia_ieri'],
    dryerMonth: ['sensor.dryer_month_energy', 'sensor.asciugatrice_energia_mese'],
    dryerState: ['sensor.dryer_state', 'sensor.asciugatrice_stato'],
    ovenPower: ['sensor.oven_power', 'sensor.forno_potenza'],
    ovenToday: ['sensor.oven_today_energy', 'sensor.forno_energia_oggi'],
    ovenYesterday: ['sensor.oven_yesterday_energy', 'sensor.forno_energia_ieri'],
    ovenMonth: ['sensor.oven_month_energy', 'sensor.forno_energia_mese'],
    ovenState: ['sensor.oven_state', 'sensor.forno_stato'],
    fridgePower: ['sensor.fridge_power', 'sensor.frigorifero_potenza'],
    fridgeToday: ['sensor.fridge_today_energy', 'sensor.frigorifero_energia_oggi'],
    fridgeYesterday: ['sensor.fridge_yesterday_energy', 'sensor.frigorifero_energia_ieri'],
    fridgeMonth: ['sensor.fridge_month_energy', 'sensor.frigorifero_energia_mese'],
    fridgeState: ['sensor.fridge_state', 'sensor.frigorifero_stato'],
    dishwasherPower: ['sensor.dishwasher_power', 'sensor.lavastoviglie_potenza'],
    dishwasherToday: ['sensor.dishwasher_today_energy', 'sensor.lavastoviglie_energia_oggi'],
    dishwasherYesterday: ['sensor.dishwasher_yesterday_energy', 'sensor.lavastoviglie_energia_ieri'],
    dishwasherMonth: ['sensor.dishwasher_month_energy', 'sensor.lavastoviglie_energia_mese'],
    dishwasherState: ['sensor.dishwasher_state', 'sensor.lavastoviglie_stato'],

    // Tecnologia · Zona TV. Sono incluse le varianti tipiche create da Shelly/Home Assistant.
    tvPower: [
      'sensor.tv_power',
      'sensor.tv_potenza',
      'sensor.tv_switch_0_power',
      'sensor.tv_channel_1_power',
      'sensor.tv_consumo',
      'sensor.televisore_power',
      'sensor.televisore_potenza'
    ],
    shieldPower: [
      'sensor.nvidia_shield_power',
      'sensor.nvidia_shield_potenza',
      'sensor.nvidia_shield_switch_0_power',
      'sensor.nvidia_shield_channel_1_power',
      'sensor.nvidia_shield_consumo',
      'sensor.shield_power',
      'sensor.shield_potenza'
    ],
    mediaPcPower: [
      'sensor.mini_pc_power',
      'sensor.mini_pc_potenza',
      'sensor.mini_pc_switch_0_power',
      'sensor.mini_pc_channel_1_power',
      'sensor.mini_pc_consumo',
      'sensor.media_mini_pc_power'
    ],
    hddPower: [
      'sensor.hdd_power',
      'sensor.hdd_potenza',
      'sensor.hdd_switch_0_power',
      'sensor.hdd_channel_1_power',
      'sensor.hdd_consumo',
      'sensor.media_hdd_power'
    ],


    tvToday: ['sensor.tv_today_energy', 'sensor.tv_energia_oggi'],
    tvYesterday: ['sensor.tv_yesterday_energy', 'sensor.tv_energia_ieri'],
    tvMonth: ['sensor.tv_month_energy', 'sensor.tv_energia_mese'],
    shieldToday: ['sensor.nvidia_shield_today_energy', 'sensor.nvidia_shield_energia_oggi', 'sensor.shield_energia_oggi'],
    shieldYesterday: ['sensor.nvidia_shield_yesterday_energy', 'sensor.nvidia_shield_energia_ieri', 'sensor.shield_energia_ieri'],
    shieldMonth: ['sensor.nvidia_shield_month_energy', 'sensor.nvidia_shield_energia_mese', 'sensor.shield_energia_mese'],
    mediaPcToday: ['sensor.mini_pc_today_energy', 'sensor.mini_pc_energia_oggi'],
    mediaPcYesterday: ['sensor.mini_pc_yesterday_energy', 'sensor.mini_pc_energia_ieri'],
    mediaPcMonth: ['sensor.mini_pc_month_energy', 'sensor.mini_pc_energia_mese'],
    hddToday: ['sensor.hdd_today_energy', 'sensor.hdd_energia_oggi'],
    hddYesterday: ['sensor.hdd_yesterday_energy', 'sensor.hdd_energia_ieri'],
    hddMonth: ['sensor.hdd_month_energy', 'sensor.hdd_energia_mese'],

    pcPower: ['sensor.pc_power', 'sensor.pc_potenza', 'sensor.office_pc_power', 'sensor.pc_studio_potenza'],
    pcToday: ['sensor.pc_today_energy', 'sensor.pc_energia_oggi', 'sensor.pc_studio_energia_oggi'],
    pcYesterday: ['sensor.pc_yesterday_energy', 'sensor.pc_energia_ieri', 'sensor.pc_studio_energia_ieri'],
    pcMonth: ['sensor.pc_month_energy', 'sensor.pc_energia_mese', 'sensor.pc_studio_energia_mese'],
    monitorPower: ['sensor.office_monitor_power', 'sensor.monitor_power', 'sensor.monitor_potenza'],
    monitorToday: ['sensor.monitor_today_energy', 'sensor.monitor_energia_oggi'],
    monitorYesterday: ['sensor.monitor_yesterday_energy', 'sensor.monitor_energia_ieri'],
    monitorMonth: ['sensor.monitor_month_energy', 'sensor.monitor_energia_mese'],
    ps5Power: ['sensor.ps_5_power', 'sensor.ps_5_potenza', 'sensor.ps5_power', 'sensor.ps5_potenza'],
    ps5Today: ['sensor.ps_5_today_energy', 'sensor.ps5_today_energy', 'sensor.ps_5_energia_oggi', 'sensor.ps5_energia_oggi'],
    ps5Yesterday: ['sensor.ps_5_yesterday_energy', 'sensor.ps5_yesterday_energy', 'sensor.ps_5_energia_ieri', 'sensor.ps5_energia_ieri'],
    ps5Month: ['sensor.ps_5_month_energy', 'sensor.ps5_month_energy', 'sensor.ps_5_energia_mese', 'sensor.ps5_energia_mese'],
    dockPower: ['sensor.office_dock_power', 'sensor.dock_power', 'sensor.dock_potenza', 'sensor.splitter_power', 'sensor.splitter_potenza'],
    dockToday: ['sensor.splitter_today_energy', 'sensor.splitter_energia_oggi', 'sensor.dock_energia_oggi'],
    dockYesterday: ['sensor.splitter_yesterday_energy', 'sensor.splitter_energia_ieri', 'sensor.dock_energia_ieri'],
    dockMonth: ['sensor.splitter_month_energy', 'sensor.splitter_energia_mese', 'sensor.dock_energia_mese'],

    networkState: ['sensor.fritzbox_wan_status', 'sensor.fritz_box_connessione'],
    networkLinkDown: ['sensor.fritzbox_link_download_mbps', 'sensor.fritz_box_download_massimo'],
    networkLinkUp: ['sensor.fritzbox_link_upload_mbps', 'sensor.fritz_box_upload_attuale'],
    networkCurrentDown: ['sensor.internet_download_mbps', 'sensor.fritz_box_download_attuale'],
    networkCurrentUp: ['sensor.internet_upload_mbps', 'sensor.fritz_box_upload_attuale'],
    networkPing: ['sensor.internet_ping_ms', 'sensor.ping'],
    networkJitter: ['sensor.internet_jitter_ms', 'sensor.jitter'],
    networkPacketLoss: ['sensor.internet_packet_loss_percent', 'sensor.packet_loss'],
    networkUptimeHours: ['sensor.fritzbox_uptime_hours', 'sensor.fritz_box_uptime'],
    networkClients: ['sensor.fritzbox_connected_devices', 'sensor.fritz_box_dispositivi_connessi'],
    networkWifiClients: ['sensor.fritzbox_wifi_devices', 'sensor.fritz_box_dispositivi_wifi'],
    backup5gStatus: ['sensor.backup_5g_status', 'sensor.stato_backup_5g'],

    alarm: ['alarm_control_panel.home', 'alarm_control_panel.casa'],
    allLights: ['light.tutte_le_luci', 'light.casa'],
    allShutters: ['cover.tutte_le_tapparelle', 'cover.casa'],
    doorbellCamera: ['camera.videocitofono', 'camera.ingresso_principale'],
    doorbellLastEvent: ['sensor.videocitofono_ultimo_evento', 'sensor.ultimo_evento_videocitofono'],
    gateButton: ['button.apri_cancello', 'button.cancello']
  }
};

// Energia Live usa il backend same-origin: il browser non deve raggiungere
// direttamente Home Assistant quando la pagina e' pubblicata tramite Cloudflare.
(()=>{
  if(!/\/energia-live\.html$/i.test(window.location.pathname))return;

  const nativeFetch=window.fetch.bind(window);
  const backendUrl=(view,date='')=>{
    const url=new URL('/api/network-status',window.location.origin);
    url.searchParams.set('view',view);
    if(date)url.searchParams.set('date',date);
    return url.toString();
  };
  const romeDateKey=value=>{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const get=type=>parts.find(part=>part.type===type)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };

  window.fetch=(input,init={})=>{
    try{
      const raw=typeof input==='string'||input instanceof URL?String(input):String(input?.url||'');
      const url=new URL(raw,window.location.href);
      if(url.pathname.endsWith('/api/states')){
        return nativeFetch(backendUrl('energy-states'),{cache:'no-store',signal:init?.signal,credentials:'same-origin'});
      }
    }catch(_){ }
    return nativeFetch(input,init);
  };

  class EnergyHistorySocket{
    constructor(url){
      this.url=String(url||'');this.readyState=0;this.listeners=new Map();
      setTimeout(()=>{this.readyState=1;this.emit('open',{});this.message({type:'auth_required',ha_version:'backend'});},0);
    }
    addEventListener(type,callback){if(typeof callback!=='function')return;const list=this.listeners.get(type)||[];list.push(callback);this.listeners.set(type,list)}
    removeEventListener(type,callback){const list=this.listeners.get(type)||[];this.listeners.set(type,list.filter(item=>item!==callback))}
    emit(type,event){for(const callback of this.listeners.get(type)||[]){try{callback.call(this,event)}catch(error){console.error('[Energia Live proxy]',error)}}}
    message(payload){this.emit('message',{data:JSON.stringify(payload)})}
    send(raw){
      let msg;try{msg=JSON.parse(raw)}catch(_){return}
      if(msg.type==='auth'){
        setTimeout(()=>this.message({type:'auth_ok',ha_version:'backend'}),0);return;
      }
      if(msg.type!=='recorder/statistics_during_period')return;
      const date=romeDateKey(msg.start_time);
      nativeFetch(backendUrl('energy-history',date),{cache:'no-store',credentials:'same-origin'})
        .then(async response=>{
          const payload=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(payload?.message||`Backend energia ${response.status}`);
          const kindFor=id=>id.includes('consumo_casa')?'house':id.includes('import')?'import':id.includes('esportata')?'export':'pv';
          const start=Date.parse(msg.start_time),end=Date.parse(msg.end_time);
          const result={};
          for(const id of msg.statistic_ids||[]){
            const value=Number(payload[kindFor(id)]);
            result[id]=Number.isFinite(value)?[{start,end,change:value}]:[];
          }
          this.message({id:msg.id,type:'result',success:true,result});
        })
        .catch(error=>this.message({id:msg.id,type:'result',success:false,error:{code:'energy_backend',message:String(error?.message||error)}}));
    }
    close(){if(this.readyState===3)return;this.readyState=3;this.emit('close',{})}
  }
  EnergyHistorySocket.CONNECTING=0;EnergyHistorySocket.OPEN=1;EnergyHistorySocket.CLOSING=2;EnergyHistorySocket.CLOSED=3;
  window.WebSocket=EnergyHistorySocket;
})();

// Grafici energia: UI e logica attive esclusivamente su energia-live.html.
(()=>{
  if(!/\/energia-live\.html$/i.test(window.location.pathname))return;

  const HISTORY_START='2026-08-17';
  const fmt=new Intl.NumberFormat('it-IT',{maximumFractionDigits:2});
  const cache=new Map();
  let rows=[];
  let requestSeq=0;
  let liveTimer=null;
  const TYPES=['pv','house','import','export'];
  const LABELS={pv:'Produzione FV',house:'Consumo casa',import:'Import rete',export:'Export rete'};
  const CSS_VARS={pv:'--solar',house:'--house',import:'--import',export:'--export'};
  const DAY_IDS={pv:['sensor.solarnet_energia_giornaliera','sensor.vano_tecnico_solarnet_energia_giornaliera'],house:['sensor.vano_tecnico_solarnet_consumo_casa_oggi'],import:['sensor.vano_tecnico_solarnet_giornaliero_import'],export:['sensor.vano_tecnico_solarnet_energia_esportata_giorno']};
  const q=selector=>document.querySelector(selector);
  const dateFromKey=key=>{const [y,m,d]=String(key).split('-').map(Number);return new Date(y,m-1,d,12,0,0)};
  const dateKey=(date=new Date())=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const get=type=>parts.find(part=>part.type===type)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`};
  const addDays=(key,days)=>{const d=dateFromKey(key);d.setDate(d.getDate()+days);const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
  const historyLabel=key=>dateFromKey(key).toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const shortDate=key=>dateFromKey(key).toLocaleDateString('it-IT',{day:'2-digit',month:'short'});
  const rangeLabel=(from,to)=>{const opts={day:'2-digit',month:'short',year:'numeric'};const a=dateFromKey(from).toLocaleDateString('it-IT',opts),b=dateFromKey(to).toLocaleDateString('it-IT',opts);return from===to?a:`${a} → ${b}`};
  const keysBetween=(from,to)=>{const out=[];let key=from,guard=0;while(key<=to&&guard<370){out.push(key);key=addDays(key,1);guard+=1}return out};
  const backendUrl=(view,date='')=>{const url=new URL('/api/network-status',window.location.origin);url.searchParams.set('view',view);if(date)url.searchParams.set('date',date);return url};
  const color=type=>getComputedStyle(document.documentElement).getPropertyValue(CSS_VARS[type]).trim()||'#73827e';
  const setText=(selector,value)=>{const node=q(selector);if(node)node.textContent=value};

  async function fetchHistoryDay(key){
    const response=await fetch(backendUrl('energy-history',key),{cache:'no-store',credentials:'same-origin'});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.message||`Storico ${response.status}`);
    const value=type=>Number.isFinite(Number(payload?.[type]))?Number(payload[type]):null;
    return {pv:value('pv'),house:value('house'),import:value('import'),export:value('export')};
  }
  async function fetchToday(){
    const response=await fetch(backendUrl('energy-states'),{cache:'no-store',credentials:'same-origin'}),payload=await response.json();
    if(!response.ok||!Array.isArray(payload))throw new Error(`Dati live ${response.status}`);
    const map=new Map(payload.map(entity=>[entity.entity_id,entity]));
    const read=type=>{for(const id of DAY_IDS[type]){const entity=map.get(id),n=Number(entity?.state);if(!Number.isFinite(n))continue;const unit=String(entity?.attributes?.unit_of_measurement||'').toLowerCase();if(unit==='wh')return n/1000;if(unit==='mwh')return n*1000;return n}return null};
    const values={pv:read('pv'),house:read('house'),import:read('import'),export:read('export')};
    if(!Number.isFinite(values.house)&&[values.pv,values.import,values.export].every(Number.isFinite))values.house=Math.max(0,values.pv+values.import-values.export);
    return values;
  }
  function svgNode(name,attrs={},text=''){const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));if(text!=='')node.textContent=text;return node}
  function renderTrend(data){
    const svg=q('#energy-trend-chart'),empty=q('#energy-chart-empty'),tooltip=q('#energy-chart-tooltip');if(!svg)return;svg.replaceChildren();if(tooltip)tooltip.hidden=true;if(!data.length){if(empty)empty.hidden=false;return}if(empty)empty.hidden=true;
    const W=1000,H=340,left=62,right=18,top=18,bottom=46,plotW=W-left-right,plotH=H-top-bottom;let max=0;for(const row of data)for(const type of TYPES)if(Number.isFinite(row[type]))max=Math.max(max,row[type]);max=Math.max(1,max*1.12);
    for(let i=0;i<=5;i++){const y=top+plotH*i/5,value=max*(1-i/5);svg.appendChild(svgNode('line',{x1:left,y1:y,x2:W-right,y2:y,stroke:'#dfe8e1','stroke-width':1}));svg.appendChild(svgNode('text',{x:left-10,y:y+4,'text-anchor':'end',fill:'#71827d','font-size':11,'font-weight':700},fmt.format(value>=100?Math.round(value):Math.round(value*10)/10)))}
    svg.appendChild(svgNode('text',{x:16,y:top+plotH/2,fill:'#71827d','font-size':10,'font-weight':800,transform:`rotate(-90 16 ${top+plotH/2})`},'kWh'));
    const count=Math.min(7,data.length),indexes=[...new Set(Array.from({length:count},(_,i)=>Math.round(i*(data.length-1)/Math.max(1,count-1))))];for(const index of indexes){const x=data.length===1?left+plotW/2:left+plotW*index/(data.length-1);svg.appendChild(svgNode('text',{x,y:H-18,'text-anchor':'middle',fill:'#71827d','font-size':10,'font-weight':700},shortDate(data[index].date)))}
    const positions={};for(const type of TYPES){positions[type]=[];let path='',pen=false;data.forEach((row,index)=>{const x=data.length===1?left+plotW/2:left+plotW*index/(data.length-1),value=row[type];if(!Number.isFinite(value)){positions[type].push(null);pen=false;return}const y=top+plotH-(value/max)*plotH;positions[type].push({x,y});path+=`${pen?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)} `;pen=true});if(path)svg.appendChild(svgNode('path',{d:path.trim(),fill:'none',stroke:color(type),'stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));if(data.length<=45)positions[type].forEach(pos=>{if(pos)svg.appendChild(svgNode('circle',{cx:pos.x,cy:pos.y,r:2.6,fill:color(type)}))})}
    const hover=svgNode('g',{'pointer-events':'none',visibility:'hidden'}),hoverLine=svgNode('line',{x1:left,y1:top,x2:left,y2:top+plotH,stroke:'#18312d','stroke-width':1,'stroke-dasharray':'4 4',opacity:.45});hover.appendChild(hoverLine);const dots={};for(const type of TYPES){dots[type]=svgNode('circle',{r:5,fill:color(type),stroke:'#fffdf8','stroke-width':2});hover.appendChild(dots[type])}svg.appendChild(hover);
    const overlay=svgNode('rect',{x:left,y:top,width:plotW,height:plotH,fill:'transparent','pointer-events':'all'});const show=event=>{const rect=svg.getBoundingClientRect(),vx=(event.clientX-rect.left)/Math.max(1,rect.width)*W,ratio=Math.max(0,Math.min(1,(vx-left)/plotW)),index=data.length===1?0:Math.round(ratio*(data.length-1)),row=data[index],x=data.length===1?left+plotW/2:left+plotW*index/(data.length-1);hover.setAttribute('visibility','visible');hoverLine.setAttribute('x1',x);hoverLine.setAttribute('x2',x);for(const type of TYPES){const pos=positions[type][index];dots[type].setAttribute('visibility',pos?'visible':'hidden');if(pos){dots[type].setAttribute('cx',pos.x);dots[type].setAttribute('cy',pos.y)}}if(tooltip){tooltip.innerHTML=`<strong>${historyLabel(row.date)}</strong>`+TYPES.map(type=>`<div><span>${LABELS[type]}</span><b>${Number.isFinite(row[type])?fmt.format(row[type])+' kWh':'--'}</b></div>`).join('');tooltip.hidden=false;tooltip.style.left=`${Math.max(15,Math.min(85,x/W*100))}%`}};overlay.addEventListener('pointermove',show);overlay.addEventListener('pointerdown',show);overlay.addEventListener('pointerleave',()=>{hover.setAttribute('visibility','hidden');if(tooltip)tooltip.hidden=true});svg.appendChild(overlay);
  }
  function renderTotals(data){const root=q('#energy-total-bars');if(!root)return;const totals=Object.fromEntries(TYPES.map(type=>[type,data.reduce((sum,row)=>sum+(Number.isFinite(row[type])?row[type]:0),0)])),max=Math.max(1,...Object.values(totals));root.innerHTML=TYPES.map(type=>`<div class="energy-total-col ${type}"><div class="energy-total-track"><i style="height:${Math.max(1,totals[type]/max*100)}%"></i></div><strong>${fmt.format(totals[type])} kWh</strong><small>${LABELS[type]}</small></div>`).join('');setText('#energy-chart-days',`${data.length} ${data.length===1?'giorno':'giorni'}`)}
  function render(){renderTrend(rows);renderTotals(rows)}
  async function loadRange(){
    const fromInput=q('#energy-chart-from'),toInput=q('#energy-chart-to');if(!fromInput||!toInput)return;const today=dateKey();let from=fromInput.value,to=toInput.value;if(!from||!to)return;if(from<HISTORY_START)from=HISTORY_START;if(to>today)to=today;if(from>to){[from,to]=[to,from];if(from<HISTORY_START)from=HISTORY_START}fromInput.value=from;toInput.value=to;setText('#energy-chart-range',rangeLabel(from,to));const seq=++requestSeq;setText('#energy-chart-status','Caricamento storico…');
    const lastCompleted=addDays(today,-1),pastTo=to<lastCompleted?to:lastCompleted,keys=from<=pastTo?keysBetween(from,pastTo):[],missing=keys.filter(key=>!cache.has(key));let done=0,next=0;const worker=async()=>{while(next<missing.length&&seq===requestSeq){const key=missing[next++];try{cache.set(key,await fetchHistoryDay(key))}catch(error){console.warn(`[Energia Live grafici] ${key}`,error);cache.set(key,null)}done+=1;if(done===missing.length||done%5===0)setText('#energy-chart-status',`Caricamento ${done}/${missing.length} giorni…`)}};await Promise.all(Array.from({length:Math.min(6,Math.max(1,missing.length))},worker));if(seq!==requestSeq)return;
    const nextRows=[];for(const key of keys){const value=cache.get(key);if(value&&Object.values(value).some(Number.isFinite))nextRows.push({date:key,...value})}if(from<=today&&to>=today){try{const current=await fetchToday();if(seq!==requestSeq)return;if(Object.values(current).some(Number.isFinite))nextRows.push({date:today,...current})}catch(error){console.warn('[Energia Live grafici] Oggi non disponibile',error)}}rows=nextRows.sort((a,b)=>a.date.localeCompare(b.date));render();setText('#energy-chart-status',rows.length?`${rows.length} giorni caricati · aggiornato ${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:'Nessun dato nel periodo');
  }
  function setPreset(mode){const today=dateKey(),from=q('#energy-chart-from'),to=q('#energy-chart-to');if(!from||!to)return;const year=today.slice(0,4);let start=mode==='30d'?addDays(today,-29):`${year}-01-01`;if(start<HISTORY_START)start=HISTORY_START;from.value=start;to.value=today;q('#energy-chart-year')?.classList.toggle('active',mode==='year');q('#energy-chart-30d')?.classList.toggle('active',mode==='30d');loadRange()}
  async function refreshToday(){const from=q('#energy-chart-from')?.value,to=q('#energy-chart-to')?.value,today=dateKey();if(!from||!to||today<from||today>to)return;try{const current=await fetchToday(),kept=rows.filter(row=>row.date!==today);if(Object.values(current).some(Number.isFinite))kept.push({date:today,...current});rows=kept.sort((a,b)=>a.date.localeCompare(b.date));render();setText('#energy-chart-status',`${rows.length} giorni caricati · live ${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`)}catch(error){console.warn('[Energia Live grafici] refresh live',error)}}
  function inject(){
    if(q('#energy-charts-section'))return;const main=q('main.app')||q('main');if(!main)return;
    const style=document.createElement('style');style.id='energy-charts-style';style.textContent=`.energy-charts{margin-top:16px;border:1.5px solid var(--line);border-radius:28px;background:var(--card);box-shadow:0 12px 38px rgba(38,76,65,.08);padding:16px}.energy-charts-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:14px}.energy-charts-title small{display:block;color:var(--muted);font-size:10px;font-weight:850;letter-spacing:.07em;text-transform:uppercase}.energy-charts-title h2{margin:3px 0 0;font-size:24px;letter-spacing:-.03em}.energy-chart-controls{display:flex;align-items:end;flex-wrap:wrap;gap:8px}.energy-chart-field{display:flex;flex-direction:column;gap:5px;color:var(--muted);font-size:10px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}.energy-chart-field input{min-height:40px;padding:7px 9px;border:1.5px solid var(--line);border-radius:13px;background:#f9fbf8;color:var(--ink);font-weight:800;color-scheme:light}.energy-chart-btn{min-height:40px;padding:8px 12px;border:1.5px solid var(--line);border-radius:13px;background:#f9fbf8;color:var(--ink);font-weight:850;cursor:pointer}.energy-chart-btn.primary{background:var(--ink);border-color:var(--ink);color:#fffdf8}.energy-chart-btn.active{border-color:var(--house);box-shadow:inset 0 0 0 1px var(--house)}.energy-chart-status{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;color:var(--muted);font-size:11px;font-weight:750}.energy-chart-status strong{color:var(--ink)}.energy-chart-legend{display:flex;flex-wrap:wrap;gap:8px 14px;margin-bottom:10px}.energy-chart-legend span{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;font-weight:800}.energy-chart-legend i{width:10px;height:10px;border-radius:50%}.energy-chart-legend .pv i{background:var(--solar)}.energy-chart-legend .house i{background:var(--house)}.energy-chart-legend .import i{background:var(--import)}.energy-chart-legend .export i{background:var(--export)}.energy-chart-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,.65fr);gap:12px}.energy-chart-card{min-width:0;border:1px solid #e2eae3;border-radius:20px;background:#f9fbf8;padding:12px}.energy-chart-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.energy-chart-card-head h3{margin:0;font-size:16px}.energy-chart-card-head span{color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.energy-chart-shell{position:relative;min-height:320px;overflow:hidden;border-radius:14px;background:#fffdf8}.energy-chart-svg{display:block;width:100%;height:320px;touch-action:none}.energy-chart-empty{position:absolute;inset:0;display:grid;place-items:center;padding:20px;color:var(--muted);font-size:12px;font-weight:800;text-align:center;pointer-events:none}.energy-chart-empty[hidden],.energy-chart-tooltip[hidden]{display:none}.energy-chart-tooltip{position:absolute;z-index:4;top:10px;min-width:170px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,253,248,.96);box-shadow:0 8px 26px rgba(38,76,65,.14);font-size:10px;pointer-events:none;transform:translateX(-50%)}.energy-chart-tooltip strong{display:block;margin-bottom:5px;font-size:11px}.energy-chart-tooltip div{display:flex;justify-content:space-between;gap:12px;margin-top:3px;color:var(--muted)}.energy-chart-tooltip b{color:var(--ink);font-variant-numeric:tabular-nums}.energy-total-bars{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;align-items:end;height:256px;padding:12px 4px 0}.energy-total-col{min-width:0;display:grid;grid-template-rows:1fr auto auto;gap:6px;height:100%;text-align:center}.energy-total-track{position:relative;align-self:stretch;border-radius:10px 10px 5px 5px;background:#eaf0eb;overflow:hidden}.energy-total-track i{position:absolute;left:0;right:0;bottom:0;min-height:2px;border-radius:8px 8px 4px 4px;transition:height .35s ease}.energy-total-col.pv .energy-total-track i{background:var(--solar)}.energy-total-col.house .energy-total-track i{background:var(--house)}.energy-total-col.import .energy-total-track i{background:var(--import)}.energy-total-col.export .energy-total-track i{background:var(--export)}.energy-total-col strong{font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}.energy-total-col small{color:var(--muted);font-size:9px;font-weight:850;text-transform:uppercase;line-height:1.1}.energy-chart-note{margin:9px 2px 0;color:var(--muted);font-size:10px;line-height:1.4}@media(max-width:900px){.energy-chart-grid{grid-template-columns:1fr}}@media(max-width:620px) and (orientation:portrait){.energy-charts{margin-top:9px;border-radius:21px;padding:12px}.energy-charts-head{align-items:stretch;flex-direction:column;gap:9px}.energy-charts-title h2{font-size:20px}.energy-chart-controls{display:grid;grid-template-columns:1fr 1fr}.energy-chart-field input,.energy-chart-btn{width:100%}.energy-chart-shell{min-height:270px}.energy-chart-svg{height:270px}.energy-total-bars{height:220px}.energy-chart-status{align-items:flex-start;flex-direction:column;gap:4px}}`;document.head.appendChild(style);
    const section=document.createElement('section');section.id='energy-charts-section';section.className='energy-charts';section.innerHTML=`<div class="energy-charts-head"><div class="energy-charts-title"><small>Statistiche giornaliere</small><h2>Andamento energia</h2></div><div class="energy-chart-controls"><button id="energy-chart-year" class="energy-chart-btn active" type="button">Anno</button><button id="energy-chart-30d" class="energy-chart-btn" type="button">Ultimi 30 gg</button><label class="energy-chart-field">Dal<input id="energy-chart-from" type="date" min="${HISTORY_START}"></label><label class="energy-chart-field">Al<input id="energy-chart-to" type="date" min="${HISTORY_START}"></label><button id="energy-chart-apply" class="energy-chart-btn primary" type="button">Aggiorna</button></div></div><div class="energy-chart-status"><strong id="energy-chart-range">--</strong><span id="energy-chart-status">In attesa dei dati…</span></div><div class="energy-chart-legend"><span class="pv"><i></i>Produzione FV</span><span class="house"><i></i>Consumo casa</span><span class="import"><i></i>Import rete</span><span class="export"><i></i>Export rete</span></div><div class="energy-chart-grid"><article class="energy-chart-card"><div class="energy-chart-card-head"><h3>Andamento giornaliero</h3><span>kWh / giorno</span></div><div class="energy-chart-shell"><svg id="energy-trend-chart" class="energy-chart-svg" viewBox="0 0 1000 340" preserveAspectRatio="none" role="img" aria-label="Andamento giornaliero energia"></svg><div id="energy-chart-empty" class="energy-chart-empty">Caricamento storico…</div><div id="energy-chart-tooltip" class="energy-chart-tooltip" hidden></div></div></article><article class="energy-chart-card"><div class="energy-chart-card-head"><h3>Totale periodo</h3><span id="energy-chart-days">0 giorni</span></div><div id="energy-total-bars" class="energy-total-bars"></div><div class="energy-chart-note">Dati conclusi dallo storico persistente di Home Assistant; il giorno corrente usa i contatori live.</div></article></div>`;main.appendChild(section);
    const today=dateKey(),yearStart=`${today.slice(0,4)}-01-01`,from=q('#energy-chart-from'),to=q('#energy-chart-to');from.min=HISTORY_START;to.min=HISTORY_START;from.max=today;to.max=today;from.value=yearStart>HISTORY_START?yearStart:HISTORY_START;to.value=today;q('#energy-chart-year').addEventListener('click',()=>setPreset('year'));q('#energy-chart-30d').addEventListener('click',()=>setPreset('30d'));q('#energy-chart-apply').addEventListener('click',()=>{q('#energy-chart-year').classList.remove('active');q('#energy-chart-30d').classList.remove('active');loadRange()});loadRange();liveTimer=setInterval(refreshToday,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});window.addEventListener('beforeunload',()=>{if(liveTimer)clearInterval(liveTimer)},{once:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
