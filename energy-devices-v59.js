(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const config = window.CASA_DASHBOARD_CONFIG || {};
  const openGroups = new Set();
  let scheduled = false;

  const APPLIANCES = [
    { key: 'washerPower', label: 'Lavatrice', names: ['lavatrice', 'washing machine', 'washer'] },
    { key: 'dryerPower', label: 'Asciugatrice', names: ['asciugatrice', 'tumble dryer', 'dryer'] },
    { key: 'ovenPower', label: 'Forno', names: ['forno', 'oven'] },
    { key: 'fridgePower', label: 'Frigorifero', names: ['frigorifero', 'frigo congelatore', 'frigo', 'congelatore', 'fridge freezer', 'fridge', 'freezer'] },
    { key: 'dishwasherPower', label: 'Lavastoviglie', names: ['lavastoviglie', 'dishwasher', 'lavapiatti'] },
  ];

  const TECH_GROUPS = [
    {
      id: 'zona-tv',
      label: 'ZONA TV',
      icon: 'fa-tv',
      devices: [
        { key: 'tvPower', label: 'TV', names: ['televisore', 'smart tv', 'samsung tv', 'tv'] },
        { key: 'shieldPower', label: 'Nvidia Shield', names: ['nvidia shield', 'shield tv', 'shield'] },
        { key: 'mediaPcPower', label: 'Mini PC', names: ['mini pc', 'minipc', 'media mini pc'] },
        { key: 'hddPower', label: 'HDD', names: ['hard disk', 'hdd', 'disco esterno'] },
      ],
    },
    {
      id: 'studio-gaming',
      label: 'Studio / gaming',
      icon: 'fa-gamepad',
      devices: [
        { key: 'pcPower', label: 'PC', names: ['pc studio', 'computer studio', 'office pc', 'desktop pc'] },
        { key: 'monitorPower', label: 'Monitor', names: ['monitor studio', 'office monitor', 'monitor'] },
        { key: 'ps5Power', label: 'PS5', names: ['playstation 5', 'ps5'] },
        { key: 'dockPower', label: 'Splitter', names: ['splitter', 'dock studio', 'office dock', 'dock'] },
      ],
    },
  ];

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

  const valid = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(String(entity.state || '').toLowerCase())
  );

  function description(entity) {
    return normalize([
      entity?.entity_id,
      entity?.attributes?.friendly_name,
      entity?.attributes?.device_class,
      entity?.attributes?.unit_of_measurement,
      entity?.attributes?.icon,
    ].filter(Boolean).join(' '));
  }

  function configuredCandidates(key) {
    const configured = config.entities?.[key];
    return (Array.isArray(configured) ? configured : [configured]).filter(Boolean);
  }

  function isPowerSensor(entity) {
    if (!valid(entity) || !String(entity.entity_id || '').startsWith('sensor.')) return false;
    const text = description(entity);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    const deviceClass = normalize(entity.attributes?.device_class);
    const positive = deviceClass === 'power'
      || ['w', 'kw', 'mw'].includes(unit)
      || text.includes(' power ')
      || text.includes(' potenza ')
      || text.endsWith(' power')
      || text.endsWith(' potenza');
    const negative = [
      'energy', 'energia', 'consumption', 'consumo totale', 'total', 'totale',
      'kwh', 'wh', 'voltage', 'tensione', 'volt', 'current', 'corrente',
      'ampere', 'frequency', 'frequenza', 'power factor', 'fattore di potenza'
    ].some((word) => text.includes(normalize(word)));
    return positive && !negative && Number.isFinite(Number(entity.state));
  }

  function resolvePower(rule) {
    const map = states();
    for (const entityId of configuredCandidates(rule.key)) {
      const entity = map.get(entityId);
      if (isPowerSensor(entity)) return entity;
    }

    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!isPowerSensor(entity)) continue;
      const text = description(entity);
      let score = 0;

      for (const name of rule.names) {
        const candidate = normalize(name);
        if (candidate && text.includes(candidate)) {
          score = Math.max(score, 20 + candidate.split(' ').length * 5);
        }
      }

      if (text.includes('shelly')) score += 7;
      if (text.includes('plug') || text.includes('presa')) score += 4;
      if (text.includes('power') || text.includes('potenza')) score += 4;
      if (normalize(entity.attributes?.device_class) === 'power') score += 4;

      if (score > bestScore) {
        bestScore = score;
        best = entity;
      }
    }

    return bestScore >= 20 ? best : null;
  }

  function watts(entity) {
    if (!isPowerSensor(entity)) return null;
    const value = Number(entity.state);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    if (unit === 'kw') return value * 1000;
    if (unit === 'mw') return value * 1000000;
    return value;
  }

  function formatPower(value) {
    if (!Number.isFinite(value)) return NULL_TEXT;
    if (Math.abs(value) >= 1000) {
      return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value / 1000)} kW`;
    }
    return `${Math.round(value)} W`;
  }

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) => {
      const label = card.querySelector('.card-head .title');
      return label && normalize(label.textContent) === wanted;
    }) || null;
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function metricRow(card, label) {
    const wanted = normalize(label);
    return [...(card?.querySelectorAll('.metric-grid > div') || [])].find((row) => {
      const small = row.querySelector('small');
      return small && normalize(small.textContent) === wanted;
    }) || null;
  }

  function ensureStyles() {
    if (document.getElementById('energy-devices-v59-styles')) return;
    const style = document.createElement('style');
    style.id = 'energy-devices-v59-styles';
    style.textContent = `
      .appliances-card .metric-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
      .appliances-card .metric-grid.two>div:last-child:nth-child(odd){grid-column:1/-1}
      .tech-groups{display:grid;gap:.55rem;margin-top:.5rem}
      .tech-zone{border:1px solid rgba(255,255,255,.1);border-radius:.82rem;background:rgba(3,15,28,.34);overflow:hidden}
      .tech-zone>summary{display:flex;align-items:center;gap:.55rem;min-height:2.8rem;padding:.62rem .72rem;cursor:pointer;list-style:none;user-select:none}
      .tech-zone>summary::-webkit-details-marker{display:none}
      .tech-zone>summary i:first-child{width:1.2rem;text-align:center;color:#73c8ff}
      .tech-zone>summary span{font-size:.78rem;font-weight:800;letter-spacing:.035em;flex:1}
      .tech-zone>summary strong{font-size:.9rem;white-space:nowrap}
      .tech-zone>summary .tech-chevron{width:auto;color:#8da3b7;transition:transform .18s ease}
      .tech-zone[open]>summary .tech-chevron{transform:rotate(180deg)}
      .tech-device-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.42rem;padding:0 .62rem .62rem}
      .tech-device{display:flex;align-items:center;justify-content:space-between;gap:.45rem;padding:.48rem .55rem;border-radius:.62rem;background:rgba(255,255,255,.045)}
      .tech-device small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tech-device strong{font-size:.82rem;white-space:nowrap}
      @media (max-width:760px){.tech-device-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function patchAppliances() {
    const card = findCard('Elettrodomestici');
    if (!card) return;
    const grid = card.querySelector('.metric-grid');
    if (!grid) return;

    let dishwasherRow = metricRow(card, 'Lavastoviglie');
    if (!dishwasherRow) {
      dishwasherRow = document.createElement('div');
      dishwasherRow.dataset.deviceKey = 'dishwasherPower';
      dishwasherRow.innerHTML = '<small>Lavastoviglie</small><strong>NULL</strong>';
      grid.appendChild(dishwasherRow);
    }

    let total = 0;
    let found = 0;
    APPLIANCES.forEach((rule) => {
      const value = watts(resolvePower(rule));
      const row = metricRow(card, rule.label);
      setText(row?.querySelector('strong'), formatPower(value));
      if (Number.isFinite(value)) {
        total += value;
        found += 1;
      }
    });

    setText(card.querySelector('.card-head > strong'), found ? formatPower(total) : NULL_TEXT);
  }

  function techMarkup() {
    return `<div class="tech-groups">${TECH_GROUPS.map((group) => `
      <details class="tech-zone" data-tech-group="${group.id}" ${openGroups.has(group.id) ? 'open' : ''}>
        <summary>
          <i class="fa-solid ${group.icon}"></i>
          <span>${group.label}</span>
          <strong data-tech-total="${group.id}">${NULL_TEXT}</strong>
          <i class="fa-solid fa-chevron-down tech-chevron"></i>
        </summary>
        <div class="tech-device-grid">
          ${group.devices.map((device) => `<div class="tech-device" data-tech-device="${device.key}"><small>${device.label}</small><strong>${NULL_TEXT}</strong></div>`).join('')}
        </div>
      </details>
    `).join('')}</div>`;
  }

  function ensureTechnologyStructure(card) {
    let container = card.querySelector('.tech-groups');
    if (container) return container;

    [...card.children].forEach((node) => {
      if (!node.classList.contains('card-head')) node.remove();
    });
    card.insertAdjacentHTML('beforeend', techMarkup());
    container = card.querySelector('.tech-groups');

    container?.querySelectorAll('.tech-zone').forEach((details) => {
      details.addEventListener('toggle', () => {
        const id = details.dataset.techGroup;
        if (!id) return;
        if (details.open) openGroups.add(id);
        else openGroups.delete(id);
      });
    });

    return container;
  }

  function patchTechnology() {
    const card = findCard('Tecnologia');
    if (!card) return;
    ensureTechnologyStructure(card);

    let grandTotal = 0;
    let grandFound = 0;

    TECH_GROUPS.forEach((group) => {
      let groupTotal = 0;
      let groupFound = 0;

      group.devices.forEach((device) => {
        const value = watts(resolvePower(device));
        const valueNode = card.querySelector(`[data-tech-device="${device.key}"] strong`);
        setText(valueNode, formatPower(value));
        if (Number.isFinite(value)) {
          groupTotal += value;
          groupFound += 1;
          grandTotal += value;
          grandFound += 1;
        }
      });

      setText(
        card.querySelector(`[data-tech-total="${group.id}"]`),
        groupFound ? formatPower(groupTotal) : NULL_TEXT
      );
    });

    setText(card.querySelector('.card-head > strong'), grandFound ? formatPower(grandTotal) : NULL_TEXT);
  }

  function apply() {
    scheduled = false;
    ensureStyles();
    patchAppliances();
    patchTechnology();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(schedule, 750);
  schedule();
})();
