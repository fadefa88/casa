(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const EXPECTED_SHUTTERS = 10;
  const SHUTTER_DEFINITIONS = [
    { label:'Tapparella Salotto', names:['Tapparella Salotto'], ids:['cover.tapparella_salotto','cover.salotto'] },
    { label:'Portafinestra Salotto', names:['Portafinestra Salotto'], ids:['cover.portafinestra_salotto'] },
    { label:'Tapparella Scale', names:['Tapparella Scale'], ids:['cover.tapparella_scale','cover.scale'] },
    { label:'Tapparella Cucina', names:['Tapparella Cucina'], ids:['cover.tapparella_cucina','cover.cucina'] },
    { label:'Tapparella Camera Matrimoniale', names:['Tapparella Camera Matrimoniale'], ids:['cover.tapparella_camera_matrimoniale','cover.camera_matrimoniale'] },
    { label:'Portafinestra Studio', names:['Portafinestra Studio'], ids:['cover.portafinestra_studio','cover.studio'] },
    { label:'Tapparella Cameretta', names:['Tapparella Cameretta'], ids:['cover.tapparella_cameretta','cover.cameretta'] },
    { label:'Tapparella Bagno Mansarda', names:['Tapparella Bagno Mansarda'], ids:['cover.tapparella_bagno_mansarda','cover.bagno_mansarda'] },
    { label:'Portafinestra Mansarda', names:['Portafinestra Mansarda','Tapparella Mansarda'], ids:['cover.portafinestra_mansarda','cover.tapparella_mansarda','cover.mansarda'] },
    { label:'Portafinestra Camera Mansarda', names:['Portafinestra Camera Mansarda'], ids:['cover.portafinestra_camera_mansarda','cover.camera_mansarda'] },
  ];
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

  function patchSolarMetadata() {
    const card = findCard('Fotovoltaico casa');
    if (!card) return;

    setText(metricNode(card, 'Potenza pannelli'), '3 kW');

    const items = currentView() === 'energia'
      ? [
          ['Costo energia', '0,287 €/kWh'],
          ['Fornitore', 'Alperia'],
        ]
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

  function compactUptimeDays() {
    document.querySelectorAll('.card strong').forEach((node) => {
      const value = node.textContent || '';
      const compact = value.replace(/(\d+)\s+(?:giorno|giorni)\b/gi, '$1 gg');
      if (compact !== value) node.textContent = compact;
    });
  }

  function validCover(entity) {
    return Boolean(
      entity
      && entity.entity_id?.startsWith('cover.')
      && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state))
    );
  }

  function coverText(entity) {
    return normalize([
      entity?.entity_id,
      entity?.attributes?.friendly_name,
      entity?.attributes?.device_class,
    ].filter(Boolean).join(' '));
  }

  function excludedCover(entity) {
    const text = coverText(entity);
    return [
      'tutte le tapparelle', 'tutte tapparelle', 'all shutters', 'all covers',
      'gruppo tapparelle', 'cover group', 'garage', 'cancello', 'gate',
      'porta', 'door', 'tenda', 'awning',
    ].some((token) => text.includes(normalize(token)));
  }

  function coverObjectId(entity) {
    return normalize(String(entity?.entity_id || '').split('.').slice(1).join(' '));
  }

  function resolveDefinedCover(definition, used) {
    const map = states();
    for (const entityId of definition.ids) {
      const entity = map.get(entityId);
      if (validCover(entity) && !used.has(entity.entity_id)) return entity;
    }

    const wanted = definition.names.map(normalize);
    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!validCover(entity) || used.has(entity.entity_id)) continue;
      const friendly = normalize(entity.attributes?.friendly_name);
      const objectId = coverObjectId(entity);
      const text = normalize(`${friendly} ${objectId}`);
      let score = 0;
      wanted.forEach((name, index) => {
        const penalty = index * 2;
        if (friendly === name) score = Math.max(score, 220 - penalty);
        else if (objectId === name) score = Math.max(score, 210 - penalty);
        else {
          const tokens = name.split(' ').filter((token) => token.length > 2);
          if (tokens.length && tokens.every((token) => text.includes(token))) {
            score = Math.max(score, 110 + tokens.length * 10 - penalty);
          }
        }
      });
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 130 ? best : null;
  }

  function discoverCovers() {
    if (!connected()) return [];
    const used = new Set();
    const resolved = [];
    SHUTTER_DEFINITIONS.forEach((definition) => {
      const entity = resolveDefinedCover(definition, used);
      if (!entity) return;
      used.add(entity.entity_id);
      resolved.push({ definition, entity });
    });
    window.CASA_SHUTTERS = {
      expected: SHUTTER_DEFINITIONS.map((item) => item.label),
      resolved: resolved.map(({ definition, entity }) => ({ label:definition.label, entity_id:entity.entity_id })),
    };
    return resolved;
  }

  function coverPosition(entity) {
    const current = Number(entity?.attributes?.current_position);
    if (Number.isFinite(current)) return Math.max(0, Math.min(100, current));

    const state = normalize(entity?.state);
    // Nell'integrazione MyHOME: 0 = completamente aperta, 100 = completamente chiusa.
    if (state === 'open') return 0;
    if (state === 'closed') return 100;
    return null;
  }

  function coverSnapshot() {
    const resolved = discoverCovers();
    const positions = resolved.map(({ entity }) => coverPosition(entity));
    const known = positions.filter(Number.isFinite);
    const open = known.filter((value) => value < 99).length;
    const closed = known.filter((value) => value >= 99).length;
    const complete = resolved.length === EXPECTED_SHUTTERS && known.length === EXPECTED_SHUTTERS;
    const average = complete ? known.reduce((sum, value) => sum + value, 0) / EXPECTED_SHUTTERS : null;
    return { total: EXPECTED_SHUTTERS, resolved: resolved.length, open, closed, average, complete };
  }

  function patchShutters() {
    const snapshot = coverSnapshot();
    const average = Number.isFinite(snapshot.average) ? `${Math.round(snapshot.average)}%` : NULL_TEXT;

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
    patchSolarMetadata();
    compactUptimeDays();
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
