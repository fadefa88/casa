(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const config = window.CASA_DASHBOARD_CONFIG || {};
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  let scheduled = false;

  const DEVICES = {
    heatPump: {
      label: 'Pompa di calore', powerKey: 'heatPumpPower',
      todayKey: 'heatPumpToday', yesterdayKey: 'heatPumpYesterday', monthKey: 'heatPumpMonth',
      aliases: ['pompa di calore', 'heat pump', 'pdc']
    },
    induction: {
      label: 'Induzione', powerKey: 'inductionPower',
      todayKey: 'inductionToday', yesterdayKey: 'inductionYesterday', monthKey: 'inductionMonth',
      aliases: ['induzione', 'piano induzione', 'induction']
    },
    washer: {
      label: 'Lavatrice', powerKey: 'washerPower',
      todayKey: 'washerToday', yesterdayKey: 'washerYesterday', monthKey: 'washerMonth',
      aliases: ['lavatrice', 'washing machine', 'washer']
    },
    dryer: {
      label: 'Asciugatrice', powerKey: 'dryerPower',
      todayKey: 'dryerToday', yesterdayKey: 'dryerYesterday', monthKey: 'dryerMonth',
      aliases: ['asciugatrice', 'tumble dryer', 'dryer']
    },
    oven: {
      label: 'Forno', powerKey: 'ovenPower',
      todayKey: 'ovenToday', yesterdayKey: 'ovenYesterday', monthKey: 'ovenMonth',
      aliases: ['forno', 'oven']
    },
    fridge: {
      label: 'Frigorifero', powerKey: 'fridgePower',
      todayKey: 'fridgeToday', yesterdayKey: 'fridgeYesterday', monthKey: 'fridgeMonth',
      aliases: ['frigorifero', 'frigo congelatore', 'frigo', 'congelatore', 'fridge freezer', 'fridge', 'freezer']
    },
    dishwasher: {
      label: 'Lavastoviglie', powerKey: 'dishwasherPower',
      todayKey: 'dishwasherToday', yesterdayKey: 'dishwasherYesterday', monthKey: 'dishwasherMonth',
      aliases: ['lavastoviglie', 'lavapiatti', 'dishwasher']
    },
    tv: {
      label: 'TV', powerKey: 'tvPower', todayKey: 'tvToday', yesterdayKey: 'tvYesterday', monthKey: 'tvMonth',
      aliases: ['tv', 'televisore', 'smart tv', 'samsung tv']
    },
    shield: {
      label: 'Nvidia Shield', powerKey: 'shieldPower',
      todayKey: 'shieldToday', yesterdayKey: 'shieldYesterday', monthKey: 'shieldMonth',
      aliases: ['nvidia shield', 'shield tv', 'shield']
    },
    mediaPc: {
      label: 'Mini PC', powerKey: 'mediaPcPower',
      todayKey: 'mediaPcToday', yesterdayKey: 'mediaPcYesterday', monthKey: 'mediaPcMonth',
      aliases: ['mini pc', 'minipc', 'media mini pc']
    },
    hdd: {
      label: 'HDD', powerKey: 'hddPower', todayKey: 'hddToday', yesterdayKey: 'hddYesterday', monthKey: 'hddMonth',
      aliases: ['hdd', 'hard disk', 'disco esterno']
    },
    pc: {
      label: 'PC', powerKey: 'pcPower', todayKey: 'pcToday', yesterdayKey: 'pcYesterday', monthKey: 'pcMonth',
      aliases: ['pc', 'pc studio', 'computer studio', 'office pc', 'desktop pc'],
      exclude: ['mini pc', 'minipc', 'media pc']
    },
    monitor: {
      label: 'Monitor', powerKey: 'monitorPower',
      todayKey: 'monitorToday', yesterdayKey: 'monitorYesterday', monthKey: 'monitorMonth',
      aliases: ['monitor', 'monitor studio', 'office monitor']
    },
    ps5: {
      label: 'PS5', powerKey: 'ps5Power', todayKey: 'ps5Today', yesterdayKey: 'ps5Yesterday', monthKey: 'ps5Month',
      aliases: ['ps 5', 'ps5', 'playstation 5', 'playstation5']
    },
    dock: {
      label: 'Splitter', powerKey: 'dockPower', todayKey: 'dockToday', yesterdayKey: 'dockYesterday', monthKey: 'dockMonth',
      aliases: ['splitter', 'dock studio', 'office dock', 'dock']
    },
  };

  const GROUPS = {
    shelly: ['heatPump', 'induction'],
    appliances: ['washer', 'dryer', 'oven', 'fridge', 'dishwasher'],
    technology: ['tv', 'shield', 'mediaPc', 'hdd', 'pc', 'monitor', 'ps5', 'dock'],
  };

  const FRONIUS = {
    acPower: { type: 'power', labels: ['potenza alternata', 'ac power', 'inverter ac power', 'potenza ac', 'fronius power'] },
    pvPower: { type: 'power', labels: ['potenza fotovoltaica', 'photovoltaic power', 'pv power', 'potenza pannelli', 'dc power'] },
    dayEnergy: { type: 'energy', labels: ['energia giornaliera', 'daily energy', 'energy day', 'day energy', 'produzione giornaliera', 'fronius today'] },
    yearEnergy: { type: 'energy', labels: ['energia annuale', 'yearly energy', 'annual energy', 'energy year', 'produzione annuale'] },
    totalEnergy: { type: 'energy', labels: ['energia totale', 'total energy', 'lifetime energy', 'produzione totale'] },
  };

  const PERIOD_WORDS = {
    today: ['oggi', 'today', 'daily', 'giornaliera', 'giornaliero', 'day energy'],
    yesterday: ['ieri', 'yesterday', 'previous day', 'giorno precedente'],
    month: ['mese', 'mensile', 'month', 'monthly'],
  };

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const compact = (value) => normalize(value).replace(/\s+/g, '');

  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();
  const connected = () => window.CASA_HA?.state?.connected === true;
  const valid = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(normalize(entity.state))
  );

  function configuredCandidates(key) {
    const configured = config.entities?.[key];
    return (Array.isArray(configured) ? configured : [configured]).filter(Boolean);
  }

  function entityParts(entity) {
    const entityName = normalize(String(entity?.entity_id || '').replace(/^[^.]+\./, ''));
    const friendly = normalize(entity?.attributes?.friendly_name);
    const text = normalize([
      entityName, friendly, entity?.attributes?.device_class,
      entity?.attributes?.unit_of_measurement, entity?.attributes?.icon,
    ].filter(Boolean).join(' '));
    return { entityName, friendly, text };
  }

  function isPowerSensor(entity) {
    if (!valid(entity) || !String(entity.entity_id || '').startsWith('sensor.')) return false;
    if (!Number.isFinite(Number(entity.state))) return false;
    const { text } = entityParts(entity);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    const deviceClass = normalize(entity.attributes?.device_class);
    const positive = deviceClass === 'power' || ['w', 'kw', 'mw'].includes(unit) || /(^| )(power|potenza)( |$)/.test(text);
    const negative = ['energy','energia','kwh','wh','mwh','voltage','tensione','current','corrente','frequency','frequenza','power factor'].some((word) => text.includes(word));
    return positive && !negative;
  }

  function isEnergySensor(entity) {
    if (!valid(entity) || !String(entity.entity_id || '').startsWith('sensor.')) return false;
    if (!Number.isFinite(Number(entity.state)) && !Number.isFinite(Number(entity.attributes?.last_period))) return false;
    const unit = normalize(entity.attributes?.unit_of_measurement);
    const deviceClass = normalize(entity.attributes?.device_class);
    return deviceClass === 'energy' || ['wh','kwh','mwh'].includes(unit);
  }

  function aliasScore(value, alias) {
    const normalizedValue = normalize(value);
    const normalizedAlias = normalize(alias);
    if (!normalizedValue || !normalizedAlias) return 0;
    if (normalizedValue === normalizedAlias) return 110;
    if (compact(normalizedValue) === compact(normalizedAlias)) return 106;
    const suffixes = ['power','potenza','energy','energia','consumo','presa','plug','switch'];
    if (suffixes.some((suffix) => normalizedValue === `${normalizedAlias} ${suffix}`)) return 100;
    const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^| )${escaped}( |$)`).test(normalizedValue)) return normalizedAlias.length <= 2 ? 78 : 90;
    if (compact(normalizedAlias).length >= 3 && compact(normalizedValue).includes(compact(normalizedAlias))) return 72;
    return 0;
  }

  function deviceScore(entity, device) {
    const parts = entityParts(entity);
    if ((device.exclude || []).some((term) => parts.text.includes(normalize(term)))) return 0;
    let score = 0;
    for (const alias of device.aliases) {
      score = Math.max(score, aliasScore(parts.friendly, alias), aliasScore(parts.entityName, alias) - 4);
    }
    if (parts.text.includes('shelly')) score += 5;
    if (parts.text.includes('plug') || parts.text.includes('presa')) score += 3;
    return score;
  }

  function resolvePower(device) {
    const map = states();
    for (const entityId of configuredCandidates(device.powerKey)) {
      const entity = map.get(entityId);
      if (isPowerSensor(entity)) return entity;
    }
    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!isPowerSensor(entity)) continue;
      const score = deviceScore(entity, device);
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 72 ? best : null;
  }

  function periodScore(entity, period) {
    const text = entityParts(entity).text;
    const words = PERIOD_WORDS[period] || [];
    let score = words.reduce((total, word) => total + (text.includes(normalize(word)) ? (word.includes(' ') ? 18 : 12) : 0), 0);
    if (period === 'today' && ['ieri','yesterday','mese','month','annuale','yearly','totale','total'].some((word) => text.includes(word))) score -= 40;
    if (period === 'yesterday' && !['ieri','yesterday','previous day','giorno precedente'].some((word) => text.includes(normalize(word)))) score -= 50;
    if (period === 'month' && ['anno','year','totale','total'].some((word) => text.includes(word))) score -= 35;
    return score;
  }

  function resolveEnergy(device, period) {
    const key = period === 'today' ? device.todayKey : period === 'yesterday' ? device.yesterdayKey : device.monthKey;
    const map = states();
    for (const entityId of configuredCandidates(key)) {
      const entity = map.get(entityId);
      if (isEnergySensor(entity)) return entity;
    }

    let best = null;
    let bestScore = 0;
    for (const entity of map.values()) {
      if (!isEnergySensor(entity)) continue;
      const score = deviceScore(entity, device) + periodScore(entity, period);
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 88 ? best : null;
  }

  function watts(entity) {
    if (!isPowerSensor(entity)) return null;
    const value = Number(entity.state);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    if (unit === 'kw') return value * 1000;
    if (unit === 'mw') return value * 1000000;
    return value;
  }

  function energyKwh(entity, rawValue = entity?.state) {
    if (!isEnergySensor(entity) || !Number.isFinite(Number(rawValue))) return null;
    const value = Number(rawValue);
    const unit = normalize(entity.attributes?.unit_of_measurement);
    if (unit === 'wh') return value / 1000;
    if (unit === 'mwh') return value * 1000;
    return value;
  }

  function periodValue(device, period) {
    if (period === 'yesterday') {
      const direct = resolveEnergy(device, 'yesterday');
      if (direct) {
        const directValue = Number.isFinite(Number(direct.attributes?.last_period))
          ? direct.attributes.last_period : direct.state;
        return { entity: direct, value: energyKwh(direct, directValue) };
      }
      const daily = resolveEnergy(device, 'today');
      if (daily && Number.isFinite(Number(daily.attributes?.last_period))) {
        return { entity: daily, value: energyKwh(daily, daily.attributes.last_period) };
      }
      return { entity: null, value: null };
    }
    const entity = resolveEnergy(device, period);
    return { entity, value: energyKwh(entity) };
  }

  function formatPower(value) {
    if (!Number.isFinite(value)) return NULL_TEXT;
    if (Math.abs(value) >= 1000) return `${fmt.format(value / 1000)} kW`;
    return `${Math.round(value)} W`;
  }

  function formatEnergyKwh(value) {
    if (!Number.isFinite(value)) return NULL_TEXT;
    return `${fmt.format(value)} kWh`;
  }

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === wanted
    ) || null;
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((node) =>
      normalize(node.querySelector('small')?.textContent) === wanted
    );
    return row?.querySelector('strong') || null;
  }

  function setValue(node, value) {
    if (!node) return;
    if (node.textContent !== value) node.textContent = value;
    node.classList.toggle('ha-null-value', value === NULL_TEXT);
  }

  function groupPeriodTotal(deviceIds, period) {
    let total = 0;
    for (const id of deviceIds) {
      const { value } = periodValue(DEVICES[id], period);
      if (!Number.isFinite(value)) return null;
      total += value;
    }
    return total;
  }

  function patchPeriodStrip(card, groupId, deviceIds) {
    const strip = card?.querySelector(`.energy-period-strip[data-energy-group="${groupId}"]`);
    if (!strip) return;
    ['today','yesterday','month'].forEach((period) => {
      setValue(strip.querySelector(`[data-period="${period}"]`), formatEnergyKwh(groupPeriodTotal(deviceIds, period)));
    });
  }

  function patchPowerCard(title, groupId, deviceIds) {
    const card = findCard(title);
    if (!card) return;
    let total = 0;
    let found = 0;
    const resolved = {};

    deviceIds.forEach((id) => {
      const device = DEVICES[id];
      const entity = resolvePower(device);
      const value = watts(entity);
      resolved[id] = { entity, value };
      if (Number.isFinite(value)) { total += value; found += 1; }

      if (groupId === 'technology') {
        setValue(card.querySelector(`[data-tech-device="${device.powerKey}"] strong`), formatPower(value));
      } else {
        setValue(metricNode(card, device.label), formatPower(value));
      }
    });

    setValue(card.querySelector('.card-head > strong'), found ? formatPower(total) : NULL_TEXT);
    if (groupId === 'technology') {
      const tvIds = ['tv','shield','mediaPc','hdd'];
      const studioIds = ['pc','monitor','ps5','dock'];
      const subtotal = (ids) => {
        const values = ids.map((id) => resolved[id]?.value);
        return values.some(Number.isFinite) ? values.filter(Number.isFinite).reduce((sum, value) => sum + value, 0) : null;
      };
      setValue(card.querySelector('[data-tech-total="zona-tv"]'), formatPower(subtotal(tvIds)));
      setValue(card.querySelector('[data-tech-total="studio-gaming"]'), formatPower(subtotal(studioIds)));
    }
    patchPeriodStrip(card, groupId, deviceIds);
    return resolved;
  }

  function configuredEntity(key, validator) {
    const map = states();
    return configuredCandidates(key).map((id) => map.get(id)).find(validator) || null;
  }

  function solarSignal(entity) {
    const text = entityParts(entity).text;
    return ['fronius','inverter','solarnet','fotovolta','photovolta','solar',' pv '].some((word) => text.includes(normalize(word)));
  }

  function resolveFronius(rule, referenceEntity = null) {
    let best = null;
    let bestScore = 0;
    const reference = compact(referenceEntity?.entity_id || '').replace(/sensor/g, '');
    for (const entity of states().values()) {
      const validType = rule.type === 'power' ? isPowerSensor(entity) : isEnergySensor(entity);
      if (!validType || !solarSignal(entity)) continue;
      const parts = entityParts(entity);
      let score = 18;
      rule.labels.forEach((label) => {
        const normalized = normalize(label);
        if (parts.friendly === normalized) score = Math.max(score, 70);
        else if (parts.friendly.includes(normalized)) score = Math.max(score, 55);
        else if (parts.text.includes(normalized)) score = Math.max(score, 42);
      });
      if (reference && compact(parts.entityName).includes(reference.slice(0, 6))) score += 5;
      if (score > bestScore) { bestScore = score; best = entity; }
    }
    return bestScore >= 38 ? best : null;
  }

  function patchFronius() {
    const card = findCard('Fotovoltaico casa');
    if (!card || !connected()) return;

    const productionEntity = configuredEntity('pvPower', isPowerSensor) || resolveFronius(FRONIUS.acPower);
    const panelEntity = resolveFronius(FRONIUS.pvPower, productionEntity);
    const dayEntity = configuredEntity('pvToday', isEnergySensor) || resolveFronius(FRONIUS.dayEnergy, productionEntity);
    const yearEntity = resolveFronius(FRONIUS.yearEnergy, productionEntity);
    const totalEntity = resolveFronius(FRONIUS.totalEnergy, productionEntity);
    const houseEntity = configuredEntity('housePower', isPowerSensor);

    const production = watts(productionEntity);
    const house = watts(houseEntity);
    const panelPower = watts(panelEntity);
    const dayKwh = energyKwh(dayEntity);
    const yearKwh = energyKwh(yearEntity);
    const totalKwh = energyKwh(totalEntity);

    setValue(card.querySelector('.card-head > strong'), formatPower(production));
    [...card.querySelectorAll('.flow-node')].forEach((node) => {
      const label = normalize(node.querySelector('small')?.textContent);
      if (label === 'produzione') setValue(node.querySelector('strong'), formatPower(production));
      if (label === 'casa') {
        const selfConsumption = Number.isFinite(production) && Number.isFinite(house) ? Math.min(Math.max(0, production), Math.max(0, house)) : null;
        setValue(node.querySelector('strong'), formatPower(selfConsumption));
      }
      if (label === 'rete') {
        if (!Number.isFinite(production) || !Number.isFinite(house)) setValue(node.querySelector('strong'), NULL_TEXT);
        else {
          const net = production - house;
          setValue(node.querySelector('strong'), `${net >= 0 ? '↑' : '↓'} ${formatPower(Math.abs(net))}`);
        }
      }
    });

    const cells = [...card.querySelectorAll('.metric-grid > div')].slice(0, 4);
    const values = [
      ['Produzione oggi', formatEnergyKwh(dayKwh)],
      ['Produzione anno', formatEnergyKwh(yearKwh)],
      ['Energia totale', formatEnergyKwh(totalKwh)],
      ['Potenza pannelli', Number.isFinite(panelPower) ? formatPower(panelPower) : '3 kW'],
    ];
    cells.forEach((cell, index) => {
      const [label, value] = values[index];
      if (cell.querySelector('small')) cell.querySelector('small').textContent = label;
      setValue(cell.querySelector('strong'), value);
    });

    window.CASA_FRONIUS = {
      productionEntity, panelEntity, dayEntity, yearEntity, totalEntity, houseEntity,
      production, house, dayKwh, yearKwh, totalKwh,
    };
  }

  function apply() {
    scheduled = false;
    if (!connected()) return;
    window.CASA_SHELLY_APPLIANCES = patchPowerCard('Elettrodomestici', 'appliances', GROUPS.appliances) || {};
    patchPowerCard('Linee Shelly', 'shelly', GROUPS.shelly);
    patchPowerCard('Tecnologia', 'technology', GROUPS.technology);
    patchFronius();
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
