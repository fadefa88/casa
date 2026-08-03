(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  let scheduled = false;

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const currentView = () => normalize(document.querySelector('#view-title')?.textContent);
  const connected = () => window.CASA_HA?.state?.connected === true;
  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

  const CONDITION = {
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

  function valid(entity) {
    return Boolean(entity
      && entity.entity_id?.startsWith('weather.')
      && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state)));
  }

  function weatherEntity() {
    const map = states();
    const configured = window.CASA_DASHBOARD_CONFIG?.entities?.weather;
    const configuredIds = Array.isArray(configured) ? configured : [configured];
    const preferred = [
      ...configuredIds.filter(Boolean),
      'weather.forecast_casa',
      'weather.casa',
      'weather.forecast_home',
      'weather.home',
    ];

    for (const entityId of preferred) {
      const entity = map.get(entityId);
      if (valid(entity)) return entity;
    }

    return [...map.values()]
      .filter(valid)
      .map((entity) => {
        const text = normalize(`${entity.entity_id} ${entity.attributes?.friendly_name || ''}`);
        let score = 0;
        if (text.includes('casa')) score += 20;
        if (text.includes('forecast')) score += 10;
        if (text.includes('home')) score += 6;
        return { entity, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.entity || null;
  }

  function value(entity, attribute, unit = '') {
    const raw = entity?.attributes?.[attribute];
    if (raw === undefined || raw === null || raw === '') return NULL_TEXT;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? `${fmt.format(numeric)}${unit}` : `${raw}${unit}`;
  }

  function windDirection(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(((numeric % 360) + 360) % 360 / 45) % 8];
  }

  function conditionInfo(condition) {
    return CONDITION[String(condition || '').toLowerCase()] || [
      String(condition || NULL_TEXT).replaceAll('-', ' '),
      'fa-cloud-sun',
    ];
  }

  function dayLabel(datetime) {
    const date = new Date(datetime);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat('it-IT', { weekday: 'short' })
      .format(date)
      .replace('.', '');
  }

  function forecastHtml(entity) {
    const forecast = Array.isArray(entity?.attributes?.forecast)
      ? entity.attributes.forecast.slice(0, 5)
      : [];
    if (!forecast.length) return '';

    return `<div class="weather-forecast">${forecast.map((item) => {
      const [label, icon] = conditionInfo(item.condition);
      const high = Number.isFinite(Number(item.temperature)) ? `${fmt.format(Number(item.temperature))}°` : NULL_TEXT;
      const low = Number.isFinite(Number(item.templow)) ? `${fmt.format(Number(item.templow))}°` : '';
      return `<div title="${label}"><small>${dayLabel(item.datetime)}</small><i class="fa-solid ${icon}"></i><strong>${high}</strong>${low ? `<span>${low}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }

  function buildCard(entity) {
    const [condition, icon] = conditionInfo(entity?.state);
    const attrs = entity?.attributes || {};
    const temperatureUnit = attrs.temperature_unit || '°C';
    const pressureUnit = attrs.pressure_unit || 'hPa';
    const windUnit = attrs.wind_speed_unit || 'km/h';
    const temperature = value(entity, 'temperature', ` ${temperatureUnit}`);
    const apparent = value(entity, 'apparent_temperature', ` ${temperatureUnit}`);
    const pressure = value(entity, 'pressure', ` ${pressureUnit}`);
    const humidity = value(entity, 'humidity', '%');
    const wind = value(entity, 'wind_speed', ` ${windUnit}`);
    const direction = windDirection(attrs.wind_bearing);
    const windText = wind === NULL_TEXT ? NULL_TEXT : `${wind}${direction ? ` (${direction})` : ''}`;

    return `<section class="card weather-overview-card" data-weather-overview="true">
      <div class="card-head"><span class="title"><i class="fa-solid fa-cloud-sun"></i> Meteo esterno</span><strong>${temperature}</strong></div>
      <div class="weather-current">
        <div class="weather-condition-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="weather-condition"><strong>${condition}</strong><small>${apparent !== NULL_TEXT ? `Percepita ${apparent}` : (attrs.friendly_name || 'Casa')}</small></div>
      </div>
      <div class="weather-metrics">
        <div><i class="fa-solid fa-gauge-high"></i><small>Pressione</small><strong>${pressure}</strong></div>
        <div><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong>${humidity}</strong></div>
        <div><i class="fa-solid fa-wind"></i><small>Vento</small><strong>${windText}</strong></div>
      </div>
      ${forecastHtml(entity)}
    </section>`;
  }

  function nullCard() {
    return `<section class="card weather-overview-card" data-weather-overview="true">
      <div class="card-head"><span class="title"><i class="fa-solid fa-cloud-sun"></i> Meteo esterno</span><strong class="ha-null-value">${NULL_TEXT}</strong></div>
      <div class="weather-current"><div class="weather-condition-icon"><i class="fa-solid fa-cloud"></i></div><div class="weather-condition"><strong class="ha-null-value">${NULL_TEXT}</strong><small>Home Assistant</small></div></div>
      <div class="weather-metrics">
        <div><i class="fa-solid fa-gauge-high"></i><small>Pressione</small><strong class="ha-null-value">${NULL_TEXT}</strong></div>
        <div><i class="fa-solid fa-droplet"></i><small>Umidità</small><strong class="ha-null-value">${NULL_TEXT}</strong></div>
        <div><i class="fa-solid fa-wind"></i><small>Vento</small><strong class="ha-null-value">${NULL_TEXT}</strong></div>
      </div>
    </section>`;
  }

  function injectStyles() {
    if (document.querySelector('#weather-overview-v51-styles')) return;
    const style = document.createElement('style');
    style.id = 'weather-overview-v51-styles';
    style.textContent = `
      .weather-overview-card{overflow:hidden}
      .weather-current{display:flex;align-items:center;gap:.75rem;margin:.2rem 0 .55rem}
      .weather-condition-icon{display:grid;place-items:center;width:2.9rem;height:2.9rem;border-radius:50%;background:rgba(255,210,70,.12);font-size:1.55rem;color:#ffd64a;flex:0 0 auto}
      .weather-condition{min-width:0}.weather-condition>strong,.weather-condition>small{display:block}.weather-condition>strong{font-size:1.05rem}.weather-condition>small{margin-top:.12rem;color:#8ea2b7;font-size:.72rem}
      .weather-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem}
      .weather-metrics>div{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:.38rem;align-items:center;min-width:0;padding:.42rem .45rem;border:1px solid rgba(255,255,255,.08);border-radius:.68rem;background:rgba(2,12,24,.25)}
      .weather-metrics i{grid-row:1/3;color:#55b6ff}.weather-metrics small,.weather-metrics strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.weather-metrics small{font-size:.62rem;color:#8ea2b7}.weather-metrics strong{font-size:.75rem}
      .weather-forecast{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.25rem;margin-top:.48rem;padding-top:.48rem;border-top:1px solid rgba(255,255,255,.08)}
      .weather-forecast>div{text-align:center;min-width:0}.weather-forecast small,.weather-forecast strong,.weather-forecast span{display:block}.weather-forecast small{font-size:.62rem;color:#8ea2b7;text-transform:capitalize}.weather-forecast i{margin:.2rem 0;font-size:.95rem;color:#ffd64a}.weather-forecast strong{font-size:.74rem}.weather-forecast span{font-size:.62rem;color:#8ea2b7}
      @media(max-width:900px){.weather-metrics{grid-template-columns:1fr}.weather-forecast{grid-template-columns:repeat(5,minmax(2.6rem,1fr));overflow-x:auto}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    scheduled = false;
    injectStyles();
    if (currentView() !== 'panoramica') return;

    const left = document.querySelector('#left-rail');
    if (!left) return;
    const houseCard = [...left.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === 'bilancio casa'
    );
    if (!houseCard) return;

    const html = connected() && weatherEntity() ? buildCard(weatherEntity()) : nullCard();
    const existing = left.querySelector('[data-weather-overview="true"]');
    if (existing) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      const next = wrapper.firstElementChild;
      if (existing.outerHTML !== next.outerHTML) existing.replaceWith(next);
    } else {
      houseCard.insertAdjacentHTML('afterend', html);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = setInterval(schedule, 1000);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });
  schedule();
})();
