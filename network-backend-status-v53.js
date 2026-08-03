(() => {
  'use strict';

  const config = window.CASA_DASHBOARD_CONFIG || {};
  const endpoint = config.networkMonitorUrl || '/api/network-status';
  const UPDATE_MS = 5000;
  const UI_GUARD_MS = 250;
  const STORAGE_KEY = 'casa-network-monitor-last-status';
  const PRIMARY_RATE = '2,5 Gbit/s';
  const BACKUP_RATE = '1 Gbit/s';
  const TIME_ZONE = 'Europe/Rome';

  const timeFormatter = new Intl.DateTimeFormat('it-IT', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat('it-IT', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  let cached = loadCachedStatus();
  let failures = 0;
  let applying = false;
  let refreshing = false;

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function loadCachedStatus() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch (_error) {
      return null;
    }
  }

  function persistCachedStatus(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (_error) {
      // La dashboard continua a funzionare anche con storage disabilitato.
    }
  }

  function durationLabel(startedAt) {
    if (!startedAt) return '';
    const started = Date.parse(startedAt);
    if (!Number.isFinite(started)) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours} h${remaining ? ` ${remaining} min` : ''}`;
  }

  function updateClock() {
    const now = new Date();
    const clock = document.querySelector('#clock');
    const date = document.querySelector('#date');
    const timeText = timeFormatter.format(now);
    const dateText = dateFormatter.format(now).replace(/\./g, '');
    if (clock && clock.textContent !== timeText) clock.textContent = timeText;
    if (date && date.textContent !== dateText) date.textContent = dateText;
  }

  function removeHaPill() {
    document.querySelector('#ha-pill')?.remove();
  }

  function findCard(title) {
    const wanted = normalize(title);
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === wanted
    ) || null;
  }

  function findFritzCard() {
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent).startsWith('fritz box 7690')
    ) || null;
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((item) =>
      normalize(item.querySelector('small')?.textContent) === wanted
    );
    return row?.querySelector('strong') || null;
  }

  function labeledValueNode(card, label) {
    const wanted = normalize(label);
    const labelNode = [...(card?.querySelectorAll('small, span') || [])].find((node) =>
      normalize(node.textContent) === wanted
    );
    if (!labelNode) return null;
    const parent = labelNode.parentElement;
    return parent?.querySelector(':scope > strong') || parent?.querySelector('strong') || null;
  }

  function setText(node, value) {
    if (!node) return;
    if (node.textContent !== value) node.textContent = value;
    node.classList.remove('ha-null-value');
    delete node.dataset.haNull;
  }

  function setHtml(node, value) {
    if (node && node.innerHTML !== value) node.innerHTML = value;
  }

  function effectiveLink() {
    return String(cached?.link || 'unknown').toLowerCase();
  }

  function effectiveRate() {
    const link = effectiveLink();
    if (link === 'backup') return BACKUP_RATE;
    if (link === 'primary') return PRIMARY_RATE;
    return null;
  }

  function patchMetric(cardTitle, label, value) {
    if (!value) return;
    setText(metricNode(findCard(cardTitle), label), value);
  }

  function applyPill() {
    const pill = document.querySelector('#backup-pill');
    if (!pill || !cached) return;

    const healthy = cached.healthy === true;
    const link = effectiveLink();
    let label = '5G stato sconosciuto';
    let cls = 'warn';

    if (!healthy) {
      label = 'Monitor rete non disponibile';
      cls = 'bad';
    } else if (link === 'backup') {
      const elapsed = durationLabel(cached.failover_started_at);
      label = `5G attivo${elapsed ? ` · ${elapsed}` : ''}`;
      cls = 'bad';
    } else if (link === 'primary') {
      label = '5G standby';
      cls = 'warn';
    }

    const className = `pill ${cls}`;
    if (pill.className !== className) pill.className = className;
    setHtml(pill, `<i class="fa-solid fa-tower-cell"></i> ${label}`);

    const title = [
      cached.public_ip ? `IP pubblico: ${cached.public_ip}` : '',
      cached.routed_prefix ? `Prefisso: ${cached.routed_prefix}` : '',
      Array.isArray(cached.origin_asns) && cached.origin_asns.length
        ? `ASN: ${cached.origin_asns.join(', ')}`
        : '',
      cached.checked_at ? `Controllato: ${new Date(cached.checked_at).toLocaleString('it-IT')}` : '',
    ].filter(Boolean).join('\n');
    if (pill.title !== title) pill.title = title;
  }

  function applyRates() {
    const rate = effectiveRate();
    if (!rate) return;

    patchMetric('Internet', 'Download', rate);
    patchMetric('Internet', 'Upload', rate);

    const fritz = findFritzCard();
    setText(metricNode(fritz, 'Link download'), rate);
    setText(metricNode(fritz, 'Link upload'), rate);

    window.CASA_NETWORK_EFFECTIVE_RATE = rate;
    document.documentElement.dataset.networkLink = effectiveLink();
  }

  function applyNetworkLabels() {
    const link = effectiveLink();
    if (!['primary', 'backup'].includes(link)) return;

    const fritz = findFritzCard();
    const fritzTitle = fritz?.querySelector('.card-head .title');
    if (fritzTitle) {
      const wanted = link === 'backup' ? 'FRITZ!Box 7690 · 5G' : 'FRITZ!Box 7690 · FTTH';
      const icon = fritzTitle.querySelector('i')?.outerHTML || '<i class="fa-solid fa-router"></i>';
      setHtml(fritzTitle, `${icon} ${wanted}`);
    }

    const devicesCard = findCard('Dispositivi connessi');
    const wanValue = labeledValueNode(devicesCard, 'Stato WAN');
    setText(wanValue, link === 'backup' ? 'Connesso (Failover 5G)' : 'Connesso');
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      updateClock();
      removeHaPill();
      if (cached) {
        applyPill();
        applyRates();
        applyNetworkLabels();
        window.CASA_NETWORK_MONITOR = cached;
      }
    } finally {
      applying = false;
    }
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      cached = await response.json();
      failures = 0;
      persistCachedStatus(cached);
      apply();
    } catch (error) {
      failures += 1;
      if (failures >= 3 && cached) {
        cached = { ...cached, healthy: false, error: String(error) };
        apply();
      }
    } finally {
      clearTimeout(timeout);
      refreshing = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (!applying) apply();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const refreshTimer = setInterval(refresh, UPDATE_MS);
  const guardTimer = setInterval(apply, UI_GUARD_MS);
  const clockTimer = setInterval(updateClock, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateClock();
      refresh();
    }
  });
  window.addEventListener('beforeunload', () => {
    clearInterval(refreshTimer);
    clearInterval(guardTimer);
    clearInterval(clockTimer);
    observer.disconnect();
  });

  apply();
  refresh();
})();
