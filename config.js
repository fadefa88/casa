window.CASA_DASHBOARD_CONFIG = {
  mode: 'auto',
  demoFallback: false,
  showNullWhenOffline: true,
  refreshMs: 5000,

  openMeteo: {
    latitude: 45.47862,
    longitude: 11.84566,
    timezone: 'Europe/Rome',
    refreshMs: 15 * 60 * 1000
  },

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
    heatPumpYesterday: ['sensor.heat_pump_yesterday_energy', 'sensor.pompa_di_calore_energia_ieri'],
    heatPumpMonth: ['sensor.heat_pump_month_energy', 'sensor.pompa_di_calore_energia_mese'],
    heatPumpMode: ['sensor.heat_pump_mode', 'sensor.modalita_pompa_di_calore'],
    inductionPower: ['sensor.induction_power', 'sensor.induzione_potenza'],
    inductionToday: ['sensor.induction_today_energy', 'sensor.induzione_energia_oggi'],
    inductionYesterday: ['sensor.induction_yesterday_energy', 'sensor.induzione_energia_ieri'],
    inductionMonth: ['sensor.induction_month_energy', 'sensor.induzione_energia_mese'],
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

/* ===== Meteo esterno · Open-Meteo ===== */
(() => {
  'use strict';

  const CFG = window.CASA_DASHBOARD_CONFIG?.openMeteo || {};
  const CACHE_KEY = 'casa-open-meteo';
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const finite = (value) => Number.isFinite(Number(value));
  const temp = (value) => finite(value) ? `${fmt.format(Number(value))} °C` : '—';
  const pct = (value) => finite(value) ? `${fmt.format(Number(value))}%` : '—';

  let model = null;
  let request = null;
  let lastSignature = '';

  const WMO = {
    0: ['Sereno', 'fa-sun'], 1: ['Prevalentemente sereno', 'fa-sun'], 2: ['Parzialmente nuvoloso', 'fa-cloud-sun'], 3: ['Coperto', 'fa-cloud'],
    45: ['Nebbia', 'fa-smog'], 48: ['Nebbia con brina', 'fa-smog'],
    51: ['Pioviggine debole', 'fa-cloud-rain'], 53: ['Pioviggine', 'fa-cloud-rain'], 55: ['Pioviggine intensa', 'fa-cloud-showers-heavy'],
    56: ['Pioviggine gelata', 'fa-cloud-rain'], 57: ['Pioviggine gelata intensa', 'fa-cloud-showers-heavy'],
    61: ['Pioggia debole', 'fa-cloud-rain'], 63: ['Pioggia', 'fa-cloud-rain'], 65: ['Pioggia intensa', 'fa-cloud-showers-water'],
    66: ['Pioggia gelata', 'fa-cloud-rain'], 67: ['Pioggia gelata intensa', 'fa-cloud-showers-heavy'],
    71: ['Neve debole', 'fa-snowflake'], 73: ['Neve', 'fa-snowflake'], 75: ['Neve intensa', 'fa-snowflake'], 77: ['Granelli di neve', 'fa-snowflake'],
    80: ['Rovesci deboli', 'fa-cloud-rain'], 81: ['Rovesci', 'fa-cloud-showers-heavy'], 82: ['Rovesci violenti', 'fa-cloud-showers-water'],
    85: ['Rovesci di neve', 'fa-snowflake'], 86: ['Rovesci di neve intensi', 'fa-snowflake'],
    95: ['Temporale', 'fa-cloud-bolt'], 96: ['Temporale con grandine', 'fa-cloud-bolt'], 99: ['Temporale forte con grandine', 'fa-cloud-bolt']
  };

  const HA = {
    'clear-night': ['Sereno', 'fa-moon'], cloudy: ['Nuvoloso', 'fa-cloud'], fog: ['Nebbia', 'fa-smog'], hail: ['Grandine', 'fa-cloud-showers-heavy'],
    lightning: ['Temporale', 'fa-bolt'], 'lightning-rainy': ['Temporale con pioggia', 'fa-cloud-bolt'], partlycloudy: ['Parzialmente nuvoloso', 'fa-cloud-sun'],
    pouring: ['Pioggia intensa', 'fa-cloud-showers-water'], rainy: ['Pioggia', 'fa-cloud-rain'], snowy: ['Neve', 'fa-snowflake'],
    'snowy-rainy': ['Nevischio', 'fa-cloud-meatball'], sunny: ['Soleggiato', 'fa-sun'], windy: ['Ventoso', 'fa-wind'], 'windy-variant': ['Ventoso e nuvoloso', 'fa-wind']
  };

  function direction(value) {
    if (!finite(value)) return '';
    const values = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return values[Math.round((((Number(value) % 360) + 360) % 360) / 45) % 8];
  }

  function day(value) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(date).replace('.', '') : '—';
  }

  function info(current, item = null) {
    if (current.source === 'ha') return HA[String(item?.condition || current.condition || '').toLowerCase()] || ['Condizioni meteo', 'fa-cloud-sun'];
    const code = Number(item?.weatherCode ?? current.weatherCode);
    const result = WMO[code] || ['Condizioni meteo', 'fa-cloud-sun'];
    return (code === 0 || code === 1) && Number(current.isDay) === 0 ? [result[0], 'fa-moon'] : result;
  }

  function apiUrl() {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(CFG.latitude ?? 45.47862));
    url.searchParams.set('longitude', String(CFG.longitude ?? 11.84566));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m');
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
    url.searchParams.set('timezone', CFG.timezone || 'Europe/Rome');
    url.searchParams.set('forecast_days', '5');
    url.searchParams.set('temperature_unit', 'celsius');
    url.searchParams.set('wind_speed_unit', 'kmh');
    return url.toString();
  }

  function parse(payload) {
    const current = payload?.current;
    const daily = payload?.daily;
    if (!current || !finite(current.temperature_2m)) throw new Error('Open-Meteo response invalid');
    return {
      source: 'open-meteo', temperature: current.temperature_2m, apparent: current.apparent_temperature,
      humidity: current.relative_humidity_2m, weatherCode: current.weather_code, isDay: current.is_day,
      windSpeed: current.wind_speed_10m, windDirection: current.wind_direction_10m, windGusts: current.wind_gusts_10m,
      forecast: Array.isArray(daily?.time) ? daily.time.slice(0, 5).map((date, index) => ({
        date, weatherCode: daily.weather_code?.[index], high: daily.temperature_2m_max?.[index], low: daily.temperature_2m_min?.[index]
      })) : []
    };
  }

  function haFallback() {
    const states = window.CASA_HA?.state?.states;
    if (!(states instanceof Map)) return null;
    const configured = window.CASA_DASHBOARD_CONFIG?.entities?.weather;
    const preferred = [...(Array.isArray(configured) ? configured : [configured]).filter(Boolean), 'weather.forecast_casa', 'weather.casa', 'weather.forecast_home', 'weather.home'];
    const valid = (entity) => entity && String(entity.entity_id || '').startsWith('weather.') && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state));
    let entity = preferred.map((id) => states.get(id)).find(valid);
    if (!entity) entity = [...states.values()].find(valid);
    if (!entity) return null;
    const a = entity.attributes || {};
    return {
      source: 'ha', condition: entity.state, temperature: a.temperature, apparent: a.apparent_temperature, humidity: a.humidity,
      windSpeed: a.wind_speed, windDirection: a.wind_bearing, windGusts: a.wind_gust_speed,
      forecast: Array.isArray(a.forecast) ? a.forecast.slice(0, 5).map((item) => ({
        date: String(item.datetime || '').slice(0, 10), condition: item.condition, high: item.temperature, low: item.templow
      })) : []
    };
  }

  function save(payload) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch (_error) {}
  }

  function cached() {
    try { return parse(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')); } catch (_error) { return null; }
  }

  function injectStyles() {
    if (document.querySelector('#casa-open-meteo-styles')) return;
    const style = document.createElement('style');
    style.id = 'casa-open-meteo-styles';
    style.textContent = `
      .weather-overview-card[data-weather-overview="true"]{display:none!important}
      .open-meteo-card{overflow:hidden}
      .open-meteo-card .weather-current{display:flex;align-items:center;gap:.75rem;margin:.2rem 0 .55rem}
      .open-meteo-card .weather-condition-icon{display:grid;place-items:center;width:2.9rem;height:2.9rem;border-radius:50%;background:rgba(255,210,70,.12);font-size:1.55rem;color:#ffd64a;flex:0 0 auto}
      .open-meteo-card .weather-condition{min-width:0}.open-meteo-card .weather-condition>strong,.open-meteo-card .weather-condition>small{display:block}.open-meteo-card .weather-condition>strong{font-size:1.05rem}.open-meteo-card .weather-condition>small{margin-top:.12rem;color:#8ea2b7;font-size:.72rem}
      .open-meteo-card .weather-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem}
      .open-meteo-card .weather-metrics>div{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:.38rem;align-items:center;min-width:0;padding:.42rem .45rem;border:1px solid rgba(255,255,255,.08);border-radius:.68rem;background:rgba(2,12,24,.25)}
      .open-meteo-card .weather-metrics i{grid-row:1/3;color:#55b6ff}.open-meteo-card .weather-metrics small,.open-meteo-card .weather-metrics strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.open-meteo-card .weather-metrics small{font-size:.62rem;color:#8ea2b7}.open-meteo-card .weather-metrics strong{font-size:.75rem}
      .open-meteo-forecast{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.25rem;margin-top:.48rem;padding-top:.48rem;border-top:1px solid rgba(255,255,255,.08)}
      .open-meteo-forecast>div{text-align:center;min-width:0}.open-meteo-forecast small,.open-meteo-forecast strong,.open-meteo-forecast span{display:block}.open-meteo-forecast small{font-size:.62rem;color:#8ea2b7;text-transform:capitalize}.open-meteo-forecast i{margin:.2rem 0;font-size:.95rem;color:#ffd64a}.open-meteo-forecast strong{font-size:.74rem}.open-meteo-forecast span{font-size:.62rem;color:#8ea2b7}
      @media(max-width:900px){.open-meteo-card .weather-metrics{grid-template-columns:1fr}.open-meteo-forecast{grid-template-columns:repeat(5,minmax(2.6rem,1fr));overflow-x:auto}}
    `;
    document.head.appendChild(style);
  }

  function cardHtml(current) {
    const [condition, icon] = info(current);
    const dir = direction(current.windDirection);
    const wind = finite(current.windSpeed) ? `${fmt.format(Number(current.windSpeed))} km/h${dir ? ` ${dir}` : ''}` : '—';
    const gustTitle = finite(current.windGusts) ? ` title="Raffiche fino a ${fmt.format(Number(current.windGusts))} km/h"` : '';
    const forecast = Array.isArray(current.forecast) ? current.forecast.slice(0, 5) : [];
    const forecastHtml = forecast.length ? `<div class="open-meteo-forecast">${forecast.map((item) => {
      const [label, itemIcon] = info(current, item);
      return `<div title="${label}"><small>${day(item.date)}</small><i class="fa-solid ${itemIcon}"></i><strong>${temp(item.high).replace(' °C', '°')}</strong><span>${temp(item.low).replace(' °C', '°')}</span></div>`;
    }).join('')}</div>` : '';

    return `<section class="card weather-overview-card open-meteo-card" data-open-meteo-overview="true">
      <div class="card-head"><span class="title"><i class="fa-solid fa-cloud-sun"></i> Meteo esterno</span><strong>${temp(current.temperature)}</strong></div>
      <div class="weather-current"><div class="weather-condition-icon"><i class="fa-solid ${icon}"></i></div><div class="weather-condition"><strong>${condition}</strong><small>${finite(current.apparent) ? `Percepita ${temp(current.apparent)}` : ''}</small></div></div>
      <div class="weather-metrics"><div><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>${pct(current.humidity)}</strong></div><div${gustTitle}><i class="fa-solid fa-wind"></i><small>Vento</small><strong>${wind}</strong></div></div>
      ${forecastHtml}
    </section>`;
  }

  function render() {
    injectStyles();
    if (normalize(document.querySelector('#view-title')?.textContent) !== 'panoramica') return;
    const left = document.querySelector('#left-rail');
    if (!left) return;
    const house = [...left.querySelectorAll('.card')].find((card) => normalize(card.querySelector('.card-head .title')?.textContent) === 'bilancio casa');
    if (!house) return;
    const current = model || haFallback() || cached();
    if (!current) return;
    const signature = JSON.stringify(current);
    const existing = left.querySelector('[data-open-meteo-overview="true"]');
    if (!existing) {
      house.insertAdjacentHTML('afterend', cardHtml(current));
      lastSignature = signature;
    } else if (signature !== lastSignature) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = cardHtml(current).trim();
      existing.replaceWith(wrapper.firstElementChild);
      lastSignature = signature;
    }
  }

  async function refresh() {
    if (request) return request;
    request = (async () => {
      try {
        const response = await fetch(apiUrl(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        model = parse(payload);
        save(payload);
      } catch (error) {
        console.warn('[Casa3D] Open-Meteo fallback:', error);
        model = haFallback() || cached();
      } finally {
        request = null;
        render();
      }
    })();
    return request;
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.view-nav [data-view]')) return;
    setTimeout(render, 100);
    setTimeout(render, 500);
  }, true);

  model = cached();
  render();
  refresh();

  const ensureTimer = setInterval(render, 5000);
  const refreshTimer = setInterval(refresh, Math.max(60000, Number(CFG.refreshMs) || 15 * 60 * 1000));
  window.addEventListener('beforeunload', () => {
    clearInterval(ensureTimer);
    clearInterval(refreshTimer);
  });
})();
