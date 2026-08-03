(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const EXPECTED_SHUTTERS = 10;
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

  function patchShellyToday() {
    const card = findCard('Linee Shelly');
    if (!card) return;
    setText(metricNode(card, 'Oggi'), NULL_TEXT);
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

  function configuredCandidates(room) {
    const values = [];
    const primary = room?.entities?.cover;
    const candidates = room?.candidates?.cover;
    if (Array.isArray(primary)) values.push(...primary); else if (primary) values.push(primary);
    if (Array.isArray(candidates)) values.push(...candidates); else if (candidates) values.push(candidates);
    return [...new Set(values.filter(Boolean))];
  }

  function roomTokens(room) {
    return [room?.name, ...(room?.aliases || [])]
      .map(normalize)
      .filter((token) => token.length >= 4)
      .sort((a, b) => b.length - a.length);
  }

  function fuzzyScore(entity, room) {
    const text = coverText(entity);
    const tokens = roomTokens(room);
    let score = 0;

    tokens.forEach((token, index) => {
      if (!token || !text.includes(token)) return;
      score = Math.max(score, 70 + token.split(' ').length * 15 + Math.max(0, 10 - index));
    });

    if (text.includes('tapparella') || text.includes('shutter') || text.includes('blind')) score += 12;
    return score;
  }

  function discoverCovers() {
    if (!connected()) return [];

    const map = states();
    const available = [...map.values()].filter((entity) => validCover(entity) && !excludedCover(entity));
    const used = new Set();
    const resolved = [];
    const rooms = (window.CASA_ROOMS || []).filter((room) => configuredCandidates(room).length);

    rooms.forEach((room) => {
      let match = configuredCandidates(room)
        .map((entityId) => map.get(entityId))
        .find((entity) => validCover(entity) && !used.has(entity.entity_id));

      if (!match) {
        match = available
          .filter((entity) => !used.has(entity.entity_id))
          .map((entity) => ({ entity, score: fuzzyScore(entity, room) }))
          .sort((a, b) => b.score - a.score)
          .find((item) => item.score >= 70)?.entity || null;
      }

      if (match) {
        used.add(match.entity_id);
        resolved.push(match);
      }
    });

    available.forEach((entity) => {
      if (resolved.length >= EXPECTED_SHUTTERS || used.has(entity.entity_id)) return;
      used.add(entity.entity_id);
      resolved.push(entity);
    });

    return resolved.slice(0, EXPECTED_SHUTTERS);
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
    const covers = discoverCovers();
    if (!covers.length) return { total: EXPECTED_SHUTTERS, open: 0, closed: EXPECTED_SHUTTERS, average: 100 };

    const positions = covers.map(coverPosition);
    const knownPositions = positions.filter(Number.isFinite);
    const open = positions.filter((value) => Number.isFinite(value) && value < 99).length;
    const explicitlyClosed = positions.filter((value) => Number.isFinite(value) && value >= 99).length;
    const unresolved = Math.max(0, EXPECTED_SHUTTERS - open - explicitlyClosed);
    const closed = explicitlyClosed + unresolved;
    const average = [...knownPositions, ...Array(unresolved).fill(100)]
      .reduce((sum, value) => sum + value, 0) / EXPECTED_SHUTTERS;

    return { total: EXPECTED_SHUTTERS, open, closed, average };
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
    patchShellyToday();
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
