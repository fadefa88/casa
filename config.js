window.CASA_DASHBOARD_CONFIG = {
  mode: 'demo',
  refreshMs: 5000,
  homeAssistant: { url: '', token: '' },
  videoIntercomUrl: '',
  entities: {
    housePower:'sensor.house_power',houseToday:'sensor.house_today_energy',houseCost:'sensor.house_today_cost',housePeak:'sensor.house_daily_peak',houseVsYesterday:'sensor.house_vs_yesterday_percent',
    pvPower:'sensor.fronius_power',pvToday:'sensor.fronius_today',pvSelfConsumption:'sensor.pv_self_consumption_percent',gridImport:'sensor.grid_import_today',gridExport:'sensor.grid_export_today',
    heatPumpPower:'sensor.heat_pump_power',heatPumpToday:'sensor.heat_pump_today_energy',heatPumpMonth:'sensor.heat_pump_month_energy',heatPumpMode:'sensor.heat_pump_mode',
    inductionPower:'sensor.induction_power',inductionSession:'sensor.induction_session_energy',inductionToday:'sensor.induction_today_energy',inductionPeak:'sensor.induction_peak_power',
    washerPower:'sensor.washer_power',washerToday:'sensor.washer_today_energy',washerState:'sensor.washer_state',dryerPower:'sensor.dryer_power',dryerToday:'sensor.dryer_today_energy',dryerState:'sensor.dryer_state',ovenPower:'sensor.oven_power',ovenToday:'sensor.oven_today_energy',ovenState:'sensor.oven_state',fridgePower:'sensor.fridge_power',fridgeToday:'sensor.fridge_today_energy',fridgeState:'sensor.fridge_state',
    tvPower:'sensor.tv_power',shieldPower:'sensor.nvidia_shield_power',mediaPcPower:'sensor.media_mini_pc_power',hddPower:'sensor.media_hdd_power',pcPower:'sensor.office_pc_power',monitorPower:'sensor.office_monitor_power',ps5Power:'sensor.ps5_power',dockPower:'sensor.office_dock_power',
    networkState:'sensor.fritzbox_wan_status',networkLinkDown:'sensor.fritzbox_link_download_mbps',networkLinkUp:'sensor.fritzbox_link_upload_mbps',networkCurrentDown:'sensor.internet_download_mbps',networkCurrentUp:'sensor.internet_upload_mbps',networkPing:'sensor.internet_ping_ms',networkJitter:'sensor.internet_jitter_ms',networkPacketLoss:'sensor.internet_packet_loss_percent',networkUptimeHours:'sensor.fritzbox_uptime_hours',networkClients:'sensor.fritzbox_connected_devices',networkWifiClients:'sensor.fritzbox_wifi_devices',backup5gStatus:'sensor.backup_5g_status',
    alarm:'alarm_control_panel.home',allLights:'light.tutte_le_luci',allShutters:'cover.tutte_le_tapparelle',doorbellCamera:'camera.videocitofono',doorbellLastEvent:'sensor.videocitofono_ultimo_evento',gateButton:'button.apri_cancello'
  }
};
