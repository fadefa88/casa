/**
 * Casa3D · Meteo esterno Open-Meteo v78
 * Nessun MutationObserver globale: evita loop di rendering quando Home Assistant
 * aggiorna frequentemente il DOM della dashboard locale.
 */
(() => {
  'use strict';

  const CFG = {
    latitude: 45.47862,
    longitude: 11.84566,
    timezone: 'Europe/Rome',
    refreshMs: 15 * 60 * 1000,
    ...(window.CASA_DASHBOARD_CONFIG?.openMeteo || {}),
  };

  const CACHE_KEY = 'casa-open-meteo-v78';
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  let model = null;
  let request = null;
  let lastSignature = '';

  const WMO = {
    0: ['Sereno', 'fa-sun'],
    1: ['Prevalentemente sereno', 'fa-sun'],
    2: ['Parzialmente nuvoloso', 'fa-cloud-sun'],
    3: ['Coperto', 'fa-cloud'],
    45: ['Nebbia', 'fa-smog'],
    48: ['Nebbia con brina', 'fa-smog'],
    51: ['Pioviggine debole', 'fa-cloud-rain'],
    53: ['Pioviggine', 'fa-cloud-rain'],
    55: ['Pioviggine intensa', 'fa-cloud-showers-heavy'],
    56: ['Pioviggine gelata', 'fa-cloud-rain'],
    57: ['Pioviggine gelata intensa', 'fa-cloud-showers-heavy'],
    61: ['Pioggia debole', 'fa-cloud-rain'],
    63: ['Pioggia', 'fa-cloud-rain'],
    65: ['Pioggia intensa', 'fa-cloud-showers-water'],
    66: ['Pioggia gelata', 'fa-cloud-rain'],
    67: ['Pioggia gelata intensa', 'fa-cloud-showers-heavy'],
    71: ['Neve debole', 'fa-snowflake'],
    73: ['Neve', 'fa-snowflake'],
    75: ['Neve intensa', 'fa-snowflake'],
    77: ['Granelli di neve', 'fa-snowflake'],
    80: ['Rovesci deboli', 'fa-cloud-rain'],
    81: ['Rovesci', 'fa-cloud-showers-heavy'],
    82: ['Rovesci violenti', 'fa-cloud-showers-water'],
    85: ['Rovesci di neve', 'fa-snowflake'],
    86: ['Rovesci di neve intensi', 'fa-snowflake'],
    95: ['Temporale', 'fa-cloud-bolt'],
    96: ['Temporale con grandine', 'fa-cloud-bolt'],
    99: ['Temporale forte con grandine', 'fa-cloud-bolt'],
  };

  const HA = {
    'clear-night': ['Sereno', 'fa-moon'],
    cloudy: ['Nuvoloso', 'fa-cloud'],
    fog: ['Nebbia', 'fa-smog'],
    hail: ['Grandine', 'fa-cloud-showers-heavy'],
    lightning: ['Temporale', 'fa-bolt'],
    'lightning-rainy': ['Temporale con pioggia', 'fa-cloud-bolt'],
    partlycloudy: ['Parzialmente nuvoloso', 'fa-cloud-sun'],
    pouring: ['Pioggia intensa', 'fa-cloud-showers-water'],
    rainy: ['Pioggia', 'fa-cloud-rain'],
    snowy: ['Neve', 'fa-snowflake'],
    'snowy-rainy': ['Nevischio', 'fa-cloud-meatball'],
    sunny: ['Soleggiato', 'fa-sun'],
    windy: ['Ventoso', 'fa-wind'],
    'windy-variant': ['Ventoso e nuvoloso', 'fa-wind'],
  };

  const finite = (value) => Number.isFinite(Number(value));
  const temp = (value) => finite(value) ? `${fmt.format(Number(value))} °C` : '—';
  const pct = (value) => finite(value) ? `${fmt.format(Number(value))}%` : '—';

  function direction(value) {
    if (!finite(value)) return '';
    const values = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return values[Math.round((((Number(value) % 360) + 360) % 360) / 45) % 8];
  }

  function day(value) {
    const date = new Date(`${value}T12:00:00`);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(date).replace('.', '');
  }

  function info(current, item = null) {
    if (current.source === 'ha') {
      return HA[String(item?.condition || current.condition || '').toLowerCase()] || ['Condizioni meteo', 'fa-cloud-sun'];
    }
    const code = Number(item?.weatherCode ?? current.weatherCode);
    const result = WMO[code] || ['Condizioni meteo', 'fa-cloud-sun'];
    if ((code === 0 || code === 1) && Number(current.isDay) === 0) return [result[0], 'fa-moon'];
    return result;
  }

  function apiUrl() {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(CFG.latitude));
    url.searchParams.set('longitude', String(CFG.longitude));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m');
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
    url.searchParams.set('timezone', CFG.timezone);
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
      source: 'open-meteo',
      temperature: current.temperature_2m,
      apparent: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      weatherCode: current.weather_code,
      isDay: current.is_day,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      windGusts: current.wind_gusts_10m,
      forecast: Array.isArray(daily?.time) ? daily.time.slice(0, 5).map((date, index) => ({
        date,
        weatherCode: daily.weather_code?.[index],
        high: daily.temperature_2m_max?.[index],
        low: daily.temperature_2m_min?.[index],
      })) : [],
    };
  }

  function haFallback() {
    const states = window.CASA_HA?.state?.states;
    if (!(states instanceof Map)) return null;
    const preferred = ['weather.forecast_casa', 'weather.casa', 'weather.forecast_home', 'weather.home'];
    const configured = window.CASA_DASHBOARD_CONFIG?.entities?.weather;
    preferred.unshift(...(Array.isArray(configured) ? configured : [configured]).filter(Boolean));

    const valid = (entity) => entity
      && String(entity.entity_id || '').startsWith('weather.')
      && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state));

    let entity = preferred.map((id) => states.get(id)).find(valid);
    if (!entity) entity = [...states.values()].find(valid);
    if (!entity) return null;
    const a = entity.attributes || {};
    return {
      source: 'ha',
      condition: entity.state,
      temperature: a.temperature,
      apparent: a.apparent_temperature,
      humidity: a.humidity,
      windSpeed: a.wind_speed,
      windDirection: a.wind_bearing,
      windGusts: a.wind_gust_speed,
      forecast: Array.isArray(a.forecast) ? a.forecast.slice(0, 5).map((item) => ({
        date: String(item.datetime || '').slice(0, 10),
        condition: item.condition,
        high: item.temperature,
        low: item.templow,
      })) : [],
    };
  }

  function save(payload) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch (_error) {}
  }

  function cached() {
    try { return parse(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')); } catch (_error) { return null; }
  }

  function injectStyles() {
    if (document.querySelector('#open-meteo-v78-styles')) return;
    const style = document.createElement('style');
    style.id = 'open-meteo-v78-styles';
    style.textContent = `
      .weather-overview-card[data-weather-overview="true"]{display:none!important}
      .open-meteo-card{overflow:hidden}
      .open-meteo-forecast{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.25rem;margin-top:.48rem;padding-top:.48rem;border-top:1px solid rgba(255,255,255,.08)}
      .open-meteo-forecast>div{text-align:center;min-width:0}
      .open-meteo-forecast small,.open-meteo-forecast strong,.open-meteo-forecast span{display:block}
      .open-meteo-forecast small{font-size:.62rem;color:#8ea2b7;text-transform:capitalize}
      .open-meteo-forecast i{margin:.2rem 0;font-size:.95rem;color:#ffd64a}
      .open-meteo-forecast strong{font-size:.74rem}
      .open-meteo-forecast span{font-size:.62rem;color:#8ea2b7}
      @media(max-width:900px){.open-meteo-forecast{grid-template-columns:repeat(5,minmax(2.6rem,1fr));overflow-x:auto}}
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
      <div class="weather-current">
        <div class="weather-condition-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="weather-condition"><strong>${condition}</strong><small>${finite(current.apparent) ? `Percepita ${temp(current.apparent)}` : ''}</small></div>
      </div>
      <div class="weather-metrics">
        <div><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>${pct(current.humidity)}</strong></div>
        <div${gustTitle}><i class="fa-solid fa-wind"></i><small>Vento</small><strong>${wind}</strong></div>
      </div>
      ${forecastHtml}
    </section>`;
  }

  function render() {
    injectStyles();
    if (normalize(document.querySelector('#view-title')?.textContent) !== 'panoramica') return;
    const left = document.querySelector('#left-rail');
    if (!left) return;
    const house = [...left.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === 'bilancio casa'
    );
    if (!house) return;

    const current = model || haFallback() || cached();
    if (!current) return;
    const html = cardHtml(current);
    const signature = JSON.stringify(current);
    const existing = left.querySelector('[data-open-meteo-overview="true"]');

    if (!existing) {
      house.insertAdjacentHTML('afterend', html);
      lastSignature = signature;
      return;
    }
    if (signature !== lastSignature) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
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

  // Solo un controllo leggero per reinserire la card se la dashboard principale
  // ricostruisce il pannello durante un refresh Home Assistant.
  const ensureTimer = setInterval(render, 5000);
  const refreshTimer = setInterval(refresh, Math.max(60_000, Number(CFG.refreshMs) || 15 * 60 * 1000));
  window.addEventListener('beforeunload', () => {
    clearInterval(ensureTimer);
    clearInterval(refreshTimer);
  });
})();
