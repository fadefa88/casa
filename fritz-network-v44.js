(() => {
  'use strict';

  const NULL = 'NULL';
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const escapeHtml = (value) => String(value ?? NULL)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const ha = () => window.CASA_HA?.state;
  const connected = () => ha()?.connected === true;
  const states = () => ha()?.states instanceof Map ? ha().states : new Map();

  const valid = (entity) => Boolean(
    entity && !['unknown', 'unavailable', 'null', 'none', ''].includes(normalize(entity.state))
  );

  const friendly = (entity) => normalize(entity?.attributes?.friendly_name);
  const description = (entity) => normalize([
    entity?.entity_id,
    entity?.attributes?.friendly_name,
    entity?.attributes?.device_class,
    entity?.attributes?.unit_of_measurement,
  ].filter(Boolean).join(' '));

  function pickSensor({ exact = [], includes = [], excludes = [], domains = ['sensor', 'binary_sensor'] }) {
    let best = null;
    let bestScore = -Infinity;

    for (const entity of states().values()) {
      if (!valid(entity)) continue;
      const domain = entity.entity_id.split('.')[0];
      if (!domains.includes(domain)) continue;

      const name = friendly(entity);
      const text = description(entity);
      if (excludes.some((term) => text.includes(normalize(term)))) continue;

      let score = 0;
      exact.forEach((term) => {
        const token = normalize(term);
        if (name === token) score = Math.max(score, 100);
        else if (name.startsWith(token)) score = Math.max(score, 80);
      });
      includes.forEach((term) => {
        const token = normalize(term);
        if (name.includes(token)) score += 28;
        else if (text.includes(token)) score += 14;
      });

      if (text.includes('fritz')) score += 12;
      if (text.includes('avm')) score += 8;
      if (text.includes('7690')) score += 8;

      if (score > bestScore) {
        bestScore = score;
        best = entity;
      }
    }

    return bestScore >= 28 ? best : null;
  }

  function getData() {
    const wan = pickSensor({
      exact: ['Stato della WAN'],
      includes: ['stato della wan', 'wan status'],
      excludes: ['non disponibile']
    }) || pickSensor({
      exact: ['Connessione', 'Collegamento'],
      includes: ['connessione', 'collegamento'],
      excludes: ['uptime', 'tempo di attivita']
    });

    const externalIp = pickSensor({
      exact: ['IP esterno'],
      includes: ['ip esterno', 'external ip'],
      excludes: ['ipv6']
    });

    const maxDown = pickSensor({
      exact: ['Velocità massima di scaricamento'],
      includes: ['velocita massima di scaricamento', 'maximum download', 'max downstream'],
      excludes: ['pacchetti']
    });

    const maxUp = pickSensor({
      exact: ['Velocità massima di caricamento'],
      includes: ['velocita massima di caricamento', 'maximum upload', 'max upstream'],
      excludes: ['pacchetti']
    });

    const currentDown = pickSensor({
      exact: ['Velocità effettiva di scaricamento'],
      includes: ['velocita effettiva di scaricamento', 'current download', 'download throughput'],
      excludes: ['massima', 'pacchetti', 'totale']
    }) || pickSensor({
      exact: ['Velocità di scaricamento'],
      includes: ['velocita di scaricamento'],
      excludes: ['massima', 'pacchetti', 'totale']
    });

    const currentUp = pickSensor({
      exact: ['Velocità effettiva di caricamento'],
      includes: ['velocita effettiva di caricamento', 'current upload', 'upload throughput'],
      excludes: ['massima', 'pacchetti', 'totale']
    }) || pickSensor({
      exact: ['Velocità di caricamento'],
      includes: ['velocita di caricamento'],
      excludes: ['massima', 'pacchetti', 'totale']
    });

    const uptimeConnection = pickSensor({
      exact: ['Tempo di attività della connessione'],
      includes: ['tempo di attivita della connessione', 'connection uptime']
    });

    const uptimeDevice = pickSensor({
      exact: ['Tempo di attività'],
      includes: ['tempo di attivita', 'device uptime'],
      excludes: ['connessione']
    });

    const cpuTemp = pickSensor({
      exact: ['Temperatura CPU'],
      includes: ['temperatura cpu', 'cpu temperature']
    });

    const gbReceived = pickSensor({
      exact: ['GB ricevuti'],
      includes: ['gb ricevuti', 'received gb', 'data received'],
      excludes: ['velocita', 'pacchetti']
    });

    const gbSent = pickSensor({
      exact: ['GB inviati'],
      includes: ['gb inviati', 'sent gb', 'data sent'],
      excludes: ['velocita', 'pacchetti']
    });

    const deviceSensor = pickSensor({
      exact: ['Dispositivi connessi'],
      includes: ['dispositivi connessi', 'connected devices', 'connected clients'],
      excludes: ['wifi', 'wlan']
    });

    return {
      wan,
      externalIp,
      maxDown,
      maxUp,
      currentDown,
      currentUp,
      uptimeConnection,
      uptimeDevice,
      cpuTemp,
      gbReceived,
      gbSent,
      devices: deviceSensor ? Number(deviceSensor.state) : countRouterDevices()
    };
  }

  function countRouterDevices() {
    const unique = new Set();
    for (const entity of states().values()) {
      if (!entity.entity_id.startsWith('device_tracker.')) continue;
      if (normalize(entity.state) !== 'home') continue;
      if (normalize(entity.attributes?.source_type) !== 'router') continue;
      const key = entity.attributes?.mac
        || entity.attributes?.hostname
        || entity.attributes?.friendly_name
        || entity.entity_id;
      unique.add(normalize(key));
    }
    return unique.size || null;
  }

  function status(entity) {
    if (!valid(entity)) return NULL;
    const value = normalize(entity.state);
    if (['on', 'connected', 'connesso', 'online', 'up', 'true', 'collegato'].includes(value)) return 'Connesso';
    if (['off', 'disconnected', 'disconnesso', 'offline', 'down', 'false', 'scollegato'].includes(value)) return 'Disconnesso';
    return String(entity.state);
  }

  function formatValue(entity, kind = 'generic') {
    if (!valid(entity)) return NULL;
    const raw = String(entity.state);
    const value = Number(raw.replace(',', '.'));
    const unit = String(entity.attributes?.unit_of_measurement || '').trim();
    const unitNorm = normalize(unit);

    if (kind === 'ip') return raw;
    if (kind === 'status') return status(entity);
    if (!Number.isFinite(value)) return unit ? `${raw} ${unit}` : raw;

    if (kind === 'link') {
      if (unitNorm.includes('kbit')) {
        if (Math.abs(value) >= 1_000_000) return `${fmt.format(value / 1_000_000)} Gbit/s`;
        if (Math.abs(value) >= 1_000) return `${fmt.format(value / 1_000)} Mbit/s`;
        return `${fmt.format(value)} kbit/s`;
      }
      if (unitNorm.includes('mbit')) return `${fmt.format(value)} Mbit/s`;
      if (unitNorm.includes('gbit')) return `${fmt.format(value)} Gbit/s`;
    }

    if (kind === 'temperature') return `${fmt.format(value)} ${unit || '°C'}`;
    if (kind === 'count') return `${Math.round(value)}`;
    return unit ? `${fmt.format(value)} ${unit}` : fmt.format(value);
  }

  function metric(label, value) {
    return `<div><small>${escapeHtml(label)}</small><strong class="${value === NULL ? 'ha-null-value' : ''}">${escapeHtml(value)}</strong></div>`;
  }

  function card(title, value, icon, rows, extra = '') {
    return `<section class="card network-card">
      <div class="card-head"><span class="title"><i class="fa-solid ${icon}"></i> ${escapeHtml(title)}</span><strong class="${value === NULL ? 'ha-null-value' : ''}">${escapeHtml(value)}</strong></div>
      <div class="metric-grid two">${rows.map(([label, rowValue]) => metric(label, rowValue)).join('')}</div>
      ${extra}
    </section>`;
  }

  function renderNetworkView(data) {
    const title = normalize(document.querySelector('#view-title')?.textContent);
    if (title !== 'rete') return;

    const wanStatus = status(data.wan);
    const devices = Number.isFinite(data.devices) ? String(data.devices) : NULL;
    const linkDown = formatValue(data.maxDown, 'link');
    const linkUp = formatValue(data.maxUp, 'link');
    const trafficDown = formatValue(data.currentDown);
    const trafficUp = formatValue(data.currentUp);
    const externalIp = formatValue(data.externalIp, 'ip');
    const uptimeConnection = formatValue(data.uptimeConnection);
    const uptimeDevice = formatValue(data.uptimeDevice);
    const cpu = formatValue(data.cpuTemp, 'temperature');
    const received = formatValue(data.gbReceived);
    const sent = formatValue(data.gbSent);

    const left = document.querySelector('#left-rail');
    const right = document.querySelector('#right-rail');
    if (!left || !right) return;

    left.innerHTML =
      card('FRITZ!Box 7690', wanStatus, 'fa-router', [
        ['Link download', linkDown],
        ['Link upload', linkUp],
        ['Traffico download', trafficDown],
        ['Traffico upload', trafficUp],
      ]) +
      card('Connessione WAN', wanStatus, 'fa-globe', [
        ['IP esterno', externalIp],
        ['Uptime connessione', uptimeConnection],
        ['Temperatura CPU', cpu],
        ['Uptime FRITZ!Box', uptimeDevice],
      ]);

    right.innerHTML =
      card('Dispositivi connessi', devices, 'fa-laptop-house', [
        ['Totale online', devices],
        ['Dati ricevuti', received],
        ['Dati inviati', sent],
        ['Stato WAN', wanStatus],
      ]) +
      card('Riepilogo linea', linkDown, 'fa-network-wired', [
        ['Download massimo', linkDown],
        ['Upload massimo', linkUp],
        ['Download attuale', trafficDown],
        ['Upload attuale', trafficUp],
      ], '<div class="card-actions"><button data-action="network-test"><i class="fa-solid fa-rotate"></i> Aggiorna dati</button></div>');
  }

  function renderOverviewCard(data) {
    const title = normalize(document.querySelector('#view-title')?.textContent);
    if (title !== 'panoramica') return;

    const cardNode = [...document.querySelectorAll('.card')].find((node) =>
      normalize(node.querySelector('.card-head .title')?.textContent) === 'rete'
    );
    if (!cardNode) return;

    const wanStatus = status(data.wan);
    const devices = Number.isFinite(data.devices) ? String(data.devices) : NULL;
    const linkDown = formatValue(data.maxDown, 'link');
    const linkUp = formatValue(data.maxUp, 'link');
    const uptime = formatValue(data.uptimeConnection);

    const header = cardNode.querySelector('.card-head > strong');
    if (header) header.textContent = wanStatus;

    const cells = [...cardNode.querySelectorAll('.metric-grid > div')];
    const rows = [
      ['Download', linkDown],
      ['Upload', linkUp],
      ['Dispositivi', devices],
      ['Uptime', uptime],
    ];

    cells.forEach((cell, index) => {
      const row = rows[index];
      if (!row) return;
      const label = cell.querySelector('small');
      const value = cell.querySelector('strong');
      if (label) label.textContent = row[0];
      if (value) {
        value.textContent = row[1];
        value.classList.toggle('ha-null-value', row[1] === NULL);
      }
    });
  }

  function apply() {
    if (!connected()) return;
    const data = getData();
    renderOverviewCard(data);
    renderNetworkView(data);
    window.CASA_FRITZBOX = data;
  }

  const observer = new MutationObserver(() => requestAnimationFrame(apply));
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(apply, 500);
  apply();
})();
