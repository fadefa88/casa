(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const config = window.CASA_DASHBOARD_CONFIG || {};
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  let scheduled = false;

  const APPLIANCES = {
    washerPower: {
      label: 'Lavatrice',
      names: ['lavatrice', 'washing machine', 'washer']
    },
    dryerPower: {
      label: 'Asciugatrice',
      names: ['asciugatrice', 'tumble dryer', 'dryer']
    },
    ovenPower: {
      label: 'Forno',
      names: ['forno', 'oven']
    },
    fridgePower: {
      label: 'Frigorifero',
      names: ['frigorifero', 'frigo congelatore', 'frigo', 'congelatore', 'fridge freezer', 'fridge', 'freezer']
    }
  };

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

  const connected = () => window.CASA_HA?.state?.connected === true;

  const valid = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(String(entity.state || '').toLowerCase())
  );

  function description(entity) {
    return normalize([
      entity.entity_id,
      entity.attributes?.friendly_name,
      entity.attributes?.device_class,
      entity.attributes?.unit_of_measurement,
      entity.attributes?.icon,
    ].filter(Boolean).join(' '));
  }

  function configuredCandidates(key) {
    const configured = config.entities?.[key];
    return (Array.isArray(configured) ? configured : [configured]).filter(Boolean);
  }

  function isPowerSensor(entity) {
    if (!valid(entity) || !entity.entity_id.startsWith('sensor.')) return false;
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

  function resolvePower(key, rule) {
    const map = states();

    for (const entityId of configuredCandidates(key)) {
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
        const normalizedName = normalize(name);
        if (text.includes(normalizedName)) {
          score = Math.max(score, 18 + normalizedName.split(' ').length * 4);
        }
      }

      if (text.includes('shelly')) score += 8;
      if (text.includes('plug') || text.includes('presa')) score += 4;
      if (text.includes('power') || text.includes('potenza')) score += 5;
      if (normalize(entity.attributes?.device_class) === 'power') score += 5;

      if (score > bestScore) {
        bestScore = score;
        best = entity;
      }
    }

    return bestScore >= 18 ? best : null;
  }

  function watts(entity) {
    if (!isPowerSensor(entity)) return null;
    const value = Number(entity.state);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    if (unit === 'kw') return value * 1000;
    if (unit === 'mw') return value / 1000;
    return value;
  }

  function formatPower(value) {
    if (!Number.isFinite(value)) return NULL_TEXT;
    if (Math.abs(value) >= 1000) return `${fmt.format(value / 1000)} kW`;
    return `${Math.round(value)} W`;
  }

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) => {
      const label = card.querySelector('.card-head .title');
      return label && normalize(label.textContent) === wanted;
    }) || null;
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((node) => {
      const small = node.querySelector('small');
      return small && normalize(small.textContent) === wanted;
    });
    return row?.querySelector('strong') || null;
  }

  function setValue(node, value) {
    if (!node) return;
    if (node.textContent !== value) node.textContent = value;
    node.classList.toggle('ha-null-value', value === NULL_TEXT);
  }

  function patchAppliances() {
    if (!connected()) return;
    const card = findCard('Elettrodomestici');
    if (!card) return;

    const resolved = {};
    let total = 0;
    let found = 0;

    Object.entries(APPLIANCES).forEach(([key, rule]) => {
      const entity = resolvePower(key, rule);
      const value = watts(entity);
      resolved[key] = { entity, value };
      setValue(metricNode(card, rule.label), formatPower(value));
      if (Number.isFinite(value)) {
        total += value;
        found += 1;
      }
    });

    setValue(card.querySelector('.card-head > strong'), found ? formatPower(total) : NULL_TEXT);

    window.CASA_SHELLY_APPLIANCES = resolved;
  }

  function apply() {
    scheduled = false;
    patchAppliances();
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
