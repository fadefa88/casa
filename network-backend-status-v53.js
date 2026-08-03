(() => {
  'use strict';

  const config = window.CASA_DASHBOARD_CONFIG || {};
  const endpoint = config.networkMonitorUrl || '/api/network-status';
  const UPDATE_MS = 30000;
  let cached = null;
  let failures = 0;
  let applying = false;

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

  function apply() {
    if (applying || !cached) return;
    const pill = document.querySelector('#backup-pill');
    if (!pill) return;
    applying = true;
    try {
      const healthy = cached.healthy === true;
      const link = String(cached.link || 'unknown').toLowerCase();
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

      pill.className = `pill ${cls}`;
      pill.innerHTML = `<i class="fa-solid fa-tower-cell"></i> ${label}`;
      pill.title = [
        cached.public_ip ? `IP pubblico: ${cached.public_ip}` : '',
        cached.checked_at ? `Controllato: ${new Date(cached.checked_at).toLocaleString('it-IT')}` : '',
      ].filter(Boolean).join('\n');
    } finally {
      applying = false;
    }
  }

  async function refresh() {
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
      window.CASA_NETWORK_MONITOR = cached;
      apply();
    } catch (error) {
      failures += 1;
      if (failures >= 3 && cached) {
        cached = { ...cached, healthy: false, error: String(error) };
        window.CASA_NETWORK_MONITOR = cached;
        apply();
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  const observer = new MutationObserver(() => {
    if (!applying) requestAnimationFrame(apply);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  const timer = setInterval(refresh, UPDATE_MS);
  const uiTimer = setInterval(apply, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    clearInterval(uiTimer);
    observer.disconnect();
  });

  refresh();
})();
