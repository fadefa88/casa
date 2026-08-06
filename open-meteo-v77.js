/**
 * Meteo esterno Open-Meteo per Casa3D.
 * Sorgente primaria: Open-Meteo. Fallback: Home Assistant, poi cache locale.
 */
(() => {
  'use strict';

  const defaults = {
    latitude: 45.47862,
    longitude: 11.84566,
    location: 'Limena',
    timezone: 'Europe/Rome',
    refreshMs: 15 * 60 * 1000,
  };
  const settings = {
    ...defaults,
    ...(window.CASA_DASHBOARD_CONFIG?.openMeteo || {}),
  };

  const CACHE_KEY = 'casa-open-meteo-v1';
  const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  let latest = null;
  let inFlight = null;
  let lastHtml = '';
  let scheduled = false;

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

  const HA_CONDITION = {
    'clear-night': ['Sereno', 'fa-moon'],
    cloudy: ['Nuvoloso', 'fa-cloud'],
    exceptional: ['Condizioni eccezionali', 'fa-triangle-exclamation'],
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

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached?.payload || !Number.isFinite(Number(cached.fetchedAt))) return null;
      return cached;
    } catch (_error) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), payload }));
    } catch (_error) {
      // La card continua a funzionare anche senza localStorage.
    }
  }

  function finite(value) {
    return Number.isFinite(Number(value));
  }

  function temperature(value) {
    return finite(value) ? `${fmt.format(Number(value))} °C` : '—';
  }

  function percentage(value) {
    return finite(value) ? `${fmt.format(Number(value))}%` : '—';
  }

  function windDirection(value) {
    if (!finite(value)) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round((((Number(value) % 360) + 360) % 360) / 45) % 8;
    return directions[index];
  }

  function wind(value, bearing, gusts) {
    if (!finite(value)) return { text: '—', title: '' };
    const direction = windDirection(bearing);
    const base = `${fmt.format(Number(value))} km/h${direction ? ` ${direction}` : ''}`;
    const title = finite(gusts) ? `Raffiche fino a ${fmt.format(Number(gusts))} km/h` : '';
    return { text: base, title };
  }

  function dayLabel(value) {
    const date = new Date(`${value}T12:00:00`);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat('it-IT', { weekday: 'short' })
      .format(date)
      .replace('.', '');
  }

  function timeLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function wmoInfo(code, isDay = 1) {
    const numeric = Number(code);
    const info = WMO[numeric] || ['Condizioni meteo', 'fa-cloud-sun'];
    if ((numeric === 0 || numeric === 1) && Number(isDay) === 0) return [info[0], 'fa-moon'];
    return info;
  }

  function apiUrl() {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(settings.latitude));
    url.searchParams.set('longitude', String(settings.longitude));
    url.searchParams.set('current', [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','));
    url.searchParams.set('daily', [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
    ].join(','));
    url.searchParams.set('timezone', settings.timezone);
    url.searchParams.set('forecast_days', '5');
    url.searchParams.set('temperature_unit', 'celsius');
    url.searchParams.set('wind_speed_unit', 'kmh');
    return url.toString();
  }

  function parseOpenMeteo(payload) {
    const current = payload?.current;
    const daily = payload?.daily;
    if (!current || !finite(current.temperature_2m)) throw new Error('Risposta Open-Meteo incompleta');

    const forecast = Array.isArray(daily?.time)
      ? daily.time.slice(0, 5).map((date, index) => ({
          date,
          weatherCode: daily.weather_code?.[index],
          high: daily.temperature_2m_max?.[index],
          low: daily.temperature_2m_min?.[index],
        }))
      : [];

    return {
      source: 'open-meteo',
      sourceLabel: 'Open‑Meteo',
      location: settings.location,
      fetchedAt: new Date().toISOString(),
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      weatherCode: current.weather_code,
      isDay: current.is_day,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      windGusts: current.wind_gusts_10m,
      forecast,
    };
  }

  function usableHaEntity(entity) {
    return Boolean(entity
      && String(entity.entity_id || '').startsWith('weather.')
      && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state)));
  }

  function homeAssistantWeather() {
    const states = window.CASA_HA?.state?.states;
    if (!(states instanceof Map)) return null;

    const configured = window.CASA_DASHBOARD_CONFIG?.entities?.weather;
    const ids = [
      ...(Array.isArray(configured) ? configured : [configured]).filter(Boolean),
      'weather.forecast_casa',
      'weather.casa',
      'weather.forecast_home',
      'weather.home',
    ];

    let entity = ids.map((id) => states.get(id)).find(usableHaEntity);
    if (!entity) entity = [...states.values()].find(usableHaEntity);
    if (!entity) return null;

    const attrs = entity.attributes || {};
    const forecast = Array.isArray(attrs.forecast)
      ? attrs.forecast.slice(0, 5).map((item) => ({
          date: String(item.datetime || '').slice(0, 10),
          condition: item.condition,
          high: item.temperature,
          low: item.templow,
        }))
      : [];

    return {
      source: 'home-assistant',
      sourceLabel: 'Home Assistant · backup',
      location: attrs.friendly_name || settings.location,
      fetchedAt: entity.last_updated || new Date().toISOString(),
      temperature: attrs.temperature,
      apparentTemperature: attrs.apparent_temperature,
      humidity: attrs.humidity,
      condition: entity.state,
      windSpeed: attrs.wind_speed,
      windDirection: attrs.wind_bearing,
      windGusts: attrs.wind_gust_speed,
      forecast,
    };
  }

  function cachedWeather() {
    const cached = readCache();
    if (!cached || Date.now() - Number(cached.fetchedAt) > MAX_CACHE_AGE_MS) return null;
    try {
      const parsed = parseOpenMeteo(cached.payload);
      return {
        ...parsed,
        source: 'cache',
        sourceLabel: 'Open‑Meteo · ultimo dato',
        fetchedAt: new Date(Number(cached.fetchedAt)).toISOString(),
      };
    } catch (_error) {
      return null;
    }
  }

  function conditionInfo(model, forecastItem = null) {
    if (model.source === 'home-assistant') {
      const condition = forecastItem?.condition || model.condition;
      return HA_CONDITION[String(condition || '').toLowerCase()] || ['Condizioni meteo', 'fa-cloud-sun'];
    }
    return wmoInfo(forecastItem?.weatherCode ?? model.weatherCode, model.isDay);
  }

  function forecastHtml(model) {
    if (!Array.isArray(model.forecast) || !model.forecast.length) return '';
    return `<div class="open-meteo-forecast">${model.forecast.slice(0, 5).map((item) => {
      const [label, icon] = conditionInfo(model, item);
      return `<div title="${label}"><small>${dayLabel(item.date)}</small><i class="fa-solid ${icon}"></i><strong>${temperature(item.high).replace(' °C', '°')}</strong><span>${temperature(item.low).replace(' °C', '°')}</span></div>`;
    }).join('')}</div>`;
  }

  function buildCard(model) {
    const [condition, icon] = conditionInfo(model);
    const windValue = wind(model.windSpeed, model.windDirection, model.windGusts);
    const updated = timeLabel(model.fetchedAt);
    const sourceText = `${model.sourceLabel}${updated ? ` · ${updated}` : ''}`;
    const source = model.source === 'open-meteo' || model.source === 'cache'
      ? `<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">${sourceText}</a>`
      : sourceText;

    return `<section class="card weather-overview-card open-meteo-card" data-open-meteo-overview="true">
      <div class="card-head"><span class="title"><i class="fa-solid fa-cloud-sun"></i> Meteo esterno</span><strong>${temperature(model.temperature)}</strong></div>
      <div class="weather-current">
        <div class="weather-condition-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="weather-condition"><strong>${condition}</strong><small>${finite(model.apparentTemperature) ? `Percepita ${temperature(model.apparentTemperature)}` : model.location}</small></div>
      </div>
      <div class="weather-metrics">
        <div><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>${percentage(model.humidity)}</strong></div>
        <div${windValue.title ? ` title="${windValue.title}"` : ''}><i class="fa-solid fa-wind"></i><small>Vento</small><strong>${windValue.text}</strong></div>
      </div>
      ${forecastHtml(model)}
      <small class="open-meteo-source">${source}</small>
    </section>`;
  }

  function unavailableCard() {
    return `<section class="card weather-overview-card open-meteo-card" data-open-meteo-overview="true">
      <div class="card-head"><span class="title"><i class="fa-solid fa-cloud-sun"></i> Meteo esterno</span><strong>—</strong></div>
      <div class="weather-current"><div class="weather-condition-icon"><i class="fa-solid fa-cloud"></i></div><div class="weather-condition"><strong>Dati non disponibili</strong><small>Nuovo tentativo automatico</small></div></div>
      <div class="weather-metrics">
        <div><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>—</strong></div>
        <div><i class="fa-solid fa-wind"></i><small>Vento</small><strong>—</strong></div>
      </div>
    </section>`;
  }

  function injectStyles() {
    if (document.querySelector('#open-meteo-v77-styles')) return;
    const style = document.createElement('style');
    style.id = 'open-meteo-v77-styles';
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
      .open-meteo-source{display:block;margin-top:.42rem;color:#70869b;font-size:.58rem;text-align:right}
      .open-meteo-source a{color:inherit;text-decoration:none}
      .open-meteo-source a:hover{text-decoration:underline}
      @media(max-width:900px){.open-meteo-forecast{grid-template-columns:repeat(5,minmax(2.6rem,1fr));overflow-x:auto}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    scheduled = false;
    injectStyles();
    if (normalize(document.querySelector('#view-title')?.textContent) !== 'panoramica') return;

    const left = document.querySelector('#left-rail');
    if (!left) return;
    const houseCard = [...left.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === 'bilancio casa'
    );
    if (!houseCard) return;

    const model = latest || homeAssistantWeather() || cachedWeather();
    const html = model ? buildCard(model) : unavailableCard();
    const existing = left.querySelector('[data-open-meteo-overview="true"]');

    if (existing) {
      if (html !== lastHtml) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        existing.replaceWith(wrapper.firstElementChild);
      }
    } else {
      houseCard.insertAdjacentHTML('afterend', html);
    }
    lastHtml = html;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  async function refresh() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const response = await fetch(apiUrl(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
        const payload = await response.json();
        latest = parseOpenMeteo(payload);
        writeCache(payload);
      } catch (error) {
        console.warn('[Casa3D] Open-Meteo non disponibile, uso fallback:', error);
        latest = homeAssistantWeather() || cachedWeather();
      } finally {
        inFlight = null;
        schedule();
      }
    })();
    return inFlight;
  }

  const cached = cachedWeather();
  if (cached) latest = cached;

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  const renderTimer = setInterval(schedule, 1000);
  const refreshTimer = setInterval(refresh, Math.max(60_000, Number(settings.refreshMs) || defaults.refreshMs));

  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    clearInterval(renderTimer);
    clearInterval(refreshTimer);
  });

  schedule();
  refresh();
})();
