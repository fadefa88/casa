window.CASA_DASHBOARD_CONFIG = {
  mode: 'auto',
  demoFallback: false,
  showNullWhenOffline: true,
  refreshMs: 5000,

  // QUI devi sostituire URL e token dopo il trasferimento sul server on-premise.
  // Token: Home Assistant -> Profilo utente -> Token di accesso a lunga durata.
  homeAssistant: {
    url: 'http://homeassistant.local:8123',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjYzhlZmVmMDQ3MzM0ZTFmOTljMWFkYzY4YzU3ODFjNiIsImlhdCI6MTc4NTc1MTgwOSwiZXhwIjoyMTAxMTExODA5fQ.N91RgAoOU9Y5bqnAmj4onmnd0oCjM_FlugIiuBP9pR0'
  },

  videoIntercomUrl: '',

  // Ogni voce può essere una stringa o un array di possibili entity_id.
  // Il dashboard usa la prima entità realmente presente in Home Assistant.
  entities: {
    housePower: ['sensor.house_power', 'sensor.potenza_casa'],
    houseToday: ['sensor.house_today_energy', 'sensor.energia_casa_oggi'],
    houseCost: ['sensor.house_today_cost', 'sensor.costo_energia_oggi'],
    housePeak: ['sensor.house_daily_peak', 'sensor.picco_potenza_giornaliero'],
    houseVsYesterday: ['sensor.house_vs_yesterday_percent', 'sensor.consumo_vs_ieri'],

    pvPower: ['sensor.fronius_power', 'sensor.fotovoltaico_potenza'],
    pvToday: ['sensor.fronius_today', 'sensor.fotovoltaico_energia_oggi'],
    pvSelfConsumption: ['sensor.pv_self_consumption_percent', 'sensor.autoconsumo_fotovoltaico'],
    gridImport: ['sensor.grid_import_today', 'sensor.prelievo_rete_oggi'],
    gridExport: ['sensor.grid_export_today', 'sensor.immissione_rete_oggi'],

    heatPumpPower: ['sensor.heat_pump_power', 'sensor.pompa_di_calore_potenza'],
    heatPumpToday: ['sensor.heat_pump_today_energy', 'sensor.pompa_di_calore_energia_oggi'],
    heatPumpMonth: ['sensor.heat_pump_month_energy', 'sensor.pompa_di_calore_energia_mese'],
    heatPumpMode: ['sensor.heat_pump_mode', 'sensor.modalita_pompa_di_calore'],
    inductionPower: ['sensor.induction_power', 'sensor.induzione_potenza'],
    inductionToday: ['sensor.induction_today_energy', 'sensor.induzione_energia_oggi'],
    inductionPeak: ['sensor.induction_peak_power', 'sensor.induzione_picco'],

    washerPower: ['sensor.washer_power', 'sensor.lavatrice_potenza'],
    washerToday: ['sensor.washer_today_energy', 'sensor.lavatrice_energia_oggi'],
    washerState: ['sensor.washer_state', 'sensor.lavatrice_stato'],
    dryerPower: ['sensor.dryer_power', 'sensor.asciugatrice_potenza'],
    dryerToday: ['sensor.dryer_today_energy', 'sensor.asciugatrice_energia_oggi'],
    dryerState: ['sensor.dryer_state', 'sensor.asciugatrice_stato'],
    ovenPower: ['sensor.oven_power', 'sensor.forno_potenza'],
    ovenToday: ['sensor.oven_today_energy', 'sensor.forno_energia_oggi'],
    ovenState: ['sensor.oven_state', 'sensor.forno_stato'],
    fridgePower: ['sensor.fridge_power', 'sensor.frigorifero_potenza'],
    fridgeToday: ['sensor.fridge_today_energy', 'sensor.frigorifero_energia_oggi'],
    fridgeState: ['sensor.fridge_state', 'sensor.frigorifero_stato'],

    tvPower: ['sensor.tv_power', 'sensor.tv_potenza'],
    shieldPower: ['sensor.nvidia_shield_power', 'sensor.shield_potenza'],
    mediaPcPower: ['sensor.media_mini_pc_power', 'sensor.mini_pc_potenza'],
    hddPower: ['sensor.media_hdd_power', 'sensor.hdd_potenza'],
    pcPower: ['sensor.office_pc_power', 'sensor.pc_studio_potenza'],
    monitorPower: ['sensor.office_monitor_power', 'sensor.monitor_potenza'],
    ps5Power: ['sensor.ps5_power', 'sensor.ps5_potenza'],
    dockPower: ['sensor.office_dock_power', 'sensor.dock_potenza'],

    networkState: ['sensor.fritzbox_wan_status', 'sensor.fritz_box_connessione'],
    networkLinkDown: ['sensor.fritzbox_link_download_mbps', 'sensor.fritz_box_download_massimo'],
    networkLinkUp: ['sensor.fritzbox_link_upload_mbps', 'sensor.fritz_box_upload_massimo'],
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
