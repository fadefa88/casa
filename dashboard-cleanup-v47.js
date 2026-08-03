(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
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

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === wanted
    ) || null;
  }

  function setText(node, value) {
    if (!node) return;
    if (node.textContent !== value) node.textContent = value;
    node.classList.toggle('ha-null-value', value === NULL_TEXT);
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((item) =>
      normalize(item.querySelector('small')?.textContent) === wanted
    );
    return row?.querySelector('strong') || null;
  }

  function removeCard(title) {
    findCard(title)?.remove();
  }

  function patchTechnology() {
    const card = findCard('Tecnologia');
    if (!card) return;
    setText(card.querySelector('.card-head > strong'), NULL_TEXT);
    card.querySelectorAll('.metric-grid strong').forEach((node) => setText(node, NULL_TEXT));
  }

  function patchSolarMetadata() {
    const card = findCard('Fotovoltaico casa');
    if (!card) return;

    const view = currentView();
    const items = view === 'energia'
      ? [
          ['Potenza pannelli', '3 kW'],
          ['Costo energia', '0,287 €/kWh'],
          ['Fornitore', 'Alperia'],
        ]
      : view === 'panoramica'
        ? [['Potenza pannelli', '3 kW']]
        : [];

    let strip = card.querySelector('.pv-system-strip');
    if (!items.length) {
      strip?.remove();
      return;
    }

    const signature = items.map(([label, value]) => `${label}:${value}`).join('|');
    if (strip?.dataset.signature === signature) return;

    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'pv-system-strip';
      card.appendChild(strip);
    }

    strip.dataset.signature = signature;
    strip.style.setProperty('--pv-meta-columns', String(items.length));
    strip.innerHTML = items.map(([label, value]) =>
      `<div><small>${label}</small><strong>${value}</strong></div>`
    ).join('');
  }

  function configuredCoverIds() {
    const ids = new Set();
    const add = (value) => {
      if (Array.isArray(value)) value.forEach(add);
      else if (typeof value === 'string' && value.startsWith('cover.')) ids.add(value);
    };

    (window.CASA_ROOMS || []).forEach((room) => {
      add(room?.entities?.cover);
      add(room?.candidates?.cover);
    });

    return [...ids].filter((entityId) => states().has(entityId));
  }

  function liveCoverSnapshot() {
    if (!connected()) return null;
    const ids = configuredCoverIds();
    if (ids.length !== 10) return null;

    const positions = ids.map((entityId) => {
      const entity = states().get(entityId);
      const current = Number(entity?.attributes?.current_position);
      if (Number.isFinite(current)) return Math.max(0, Math.min(100, current));
      if (entity?.state === 'open') return 100;
      if (entity?.state === 'closed') return 0;
      return 50;
    });

    return {
      total: 10,
      open: positions.filter((value) => value > 80).length,
      closed: positions.filter((value) => value < 10).length,
      average: positions.reduce((sum, value) => sum + value, 0) / positions.length,
    };
  }

  function coverSnapshot() {
    return liveCoverSnapshot() || { total: 10, open: 0, closed: 10, average: 0 };
  }

  function patchShutters() {
    const snapshot = coverSnapshot();
    const average = `${Math.round(snapshot.average)}%`;

    const overview = findCard('Comfort e stanze');
    const overviewTile = [...(overview?.querySelectorAll('.overview-kpi') || [])].find((item) =>
      normalize(item.querySelector('small')?.textContent) === 'tapparelle'
    );
    setText(overviewTile?.querySelector('strong'), average);

    const card = findCard('Tapparelle');
    if (!card) return;
    setText(card.querySelector('.card-head > strong'), average);
    setText(metricNode(card, 'Apertura media'), average);
    setText(metricNode(card, 'Motorizzate'), String(snapshot.total));
    setText(metricNode(card, 'Aperte'), String(snapshot.open));
    setText(metricNode(card, 'Chiuse'), String(snapshot.closed));
  }

  function injectStyles() {
    if (document.querySelector('#dashboard-cleanup-v47-styles')) return;
    const style = document.createElement('style');
    style.id = 'dashboard-cleanup-v47-styles';
    style.textContent = `
      .pv-system-strip{
        display:grid;
        grid-template-columns:repeat(var(--pv-meta-columns,1),minmax(0,1fr));
        gap:.45rem;
        margin-top:.55rem;
      }
      .pv-system-strip>div{
        min-width:0;
        padding:.48rem .55rem;
        border:1px solid rgba(255,255,255,.09);
        border-radius:.72rem;
        background:rgba(2,12,24,.28);
      }
      .pv-system-strip small,.pv-system-strip strong{display:block}
      .pv-system-strip small{color:#8ea2b7;font-size:.68rem}
      .pv-system-strip strong{margin-top:.15rem;font-size:.88rem;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    scheduled = false;
    injectStyles();
    removeCard('Riepilogo linea');
    removeCard('Videocitofono');
    patchTechnology();
    patchSolarMetadata();
    patchShutters();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  setInterval(schedule, 500);
  schedule();
})();
