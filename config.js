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
