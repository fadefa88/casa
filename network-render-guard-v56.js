(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const FRITZ_STORAGE_KEY = 'casa-fritzbox-stable-data';
  const MONITOR_STORAGE_KEY = 'casa-network-monitor-last-status';
  const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch (_error) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Funziona anche quando localStorage non è disponibile.
    }
  }

  let stable = {
    wan: 'Connesso',
    maxDown: '2,5 Gbit/s',
    maxUp: '2,5 Gbit/s',
    currentDown: NULL_TEXT,
    currentUp: NULL_TEXT,
    devices: NULL_TEXT,
    uptimeConnection: NULL_TEXT,
    ...readJson(FRITZ_STORAGE_KEY),
  };

  function monitorState() {
    return window.CASA_NETWORK_MONITOR || readJson(MONITOR_STORAGE_KEY) || null;
  }

  function activeLink() {
    return normalize(monitorState()?.link || 'primary');
  }

  function effectiveRate() {
    return activeLink() === 'backup' ? '1 Gbit/s' : '2,5 Gbit/s';
  }

  function validValue(value) {
    const text = String(value ?? '').trim();
    return Boolean(text && normalize(text) !== 'null');
  }

  function mergeStable(source) {
    if (!source || typeof source !== 'object') return;
    const next = { ...stable };
    Object.entries(source).forEach(([key, value]) => {
      if (validValue(value)) next[key] = value;
    });
    next.maxDown = effectiveRate();
    next.maxUp = effectiveRate();
    stable = next;
    window.CASA_FRITZBOX_STABLE = stable;
    writeJson(FRITZ_STORAGE_KEY, stable);
  }

  function stateMap() {
    return window.CASA_HA?.state?.states instanceof Map
      ? window.CASA_HA.state.states
      : new Map();
  }

  function validEntity(entity) {
    return Boolean(entity && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state)));
  }

  function findTrafficEntity(direction) {
    const wanted = direction === 'download'
      ? 'velocita effettiva di scaricamento'
      : 'velocita effettiva di caricamento';
    let best = null;
    let bestScore = -1;

    for (const entity of stateMap().values()) {
      if (!validEntity(entity) || !entity.entity_id.startsWith('sensor.')) continue;
      const friendly = normalize(entity.attributes?.friendly_name);
      const entityId = normalize(entity.entity_id);
      const text = `${friendly} ${entityId}`;
      if (!text.includes(wanted)) continue;
      if (text.includes('massima') || text.includes('pacchetti')) continue;

      let score = 100;
      if (friendly === wanted) score += 30;
      if (text.includes('fritz')) score += 15;
      if (text.includes('7690')) score += 10;
      if (score > bestScore) {
        bestScore = score;
        best = entity;
      }
    }
    return best;
  }

  function rawRate(entity) {
    if (!validEntity(entity)) return NULL_TEXT;
    const raw = String(entity.state ?? '').trim();
    const numeric = Number(raw.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    const unit = String(entity.attributes?.unit_of_measurement || '').trim();
    if (!Number.isFinite(numeric)) return unit ? `${raw} ${unit}` : raw;
    return unit ? `${fmt.format(numeric)} ${unit}` : fmt.format(numeric);
  }

  function refreshStableData() {
    mergeStable(window.CASA_FRITZBOX);

    const download = rawRate(findTrafficEntity('download'));
    const upload = rawRate(findTrafficEntity('upload'));
    mergeStable({ currentDown: download, currentUp: upload });
  }

  function findCard(root, title, startsWith = false) {
    const wanted = normalize(title);
    return [...root.querySelectorAll('.card')].find((card) => {
      const current = normalize(card.querySelector('.card-head .title')?.textContent);
      return startsWith ? current.startsWith(wanted) : current === wanted;
    }) || null;
  }

  function metricNode(card, label) {
    const wanted = normalize(label);
    const row = [...(card?.querySelectorAll('.metric-grid > div') || [])].find((item) =>
      normalize(item.querySelector('small')?.textContent) === wanted
    );
    return row?.querySelector('strong') || null;
  }

  function setText(node, value) {
    if (!node || !validValue(value)) return;
    node.textContent = value;
    node.classList.remove('ha-null-value');
  }

  function patchInternet(root) {
    const card = findCard(root, 'Internet');
    if (!card) return;
    setText(card.querySelector('.card-head > strong'), stable.wan);
    setText(metricNode(card, 'Download'), effectiveRate());
    setText(metricNode(card, 'Upload'), effectiveRate());
    setText(metricNode(card, 'Dispositivi'), stable.devices);
    setText(metricNode(card, 'Uptime'), stable.uptimeConnection);
  }

  function patchFritz(root) {
    const card = findCard(root, 'FRITZ Box 7690', true);
    if (!card) return;
    setText(metricNode(card, 'Link download'), effectiveRate());
    setText(metricNode(card, 'Link upload'), effectiveRate());
    setText(metricNode(card, 'Traffico download'), stable.currentDown);
    setText(metricNode(card, 'Traffico upload'), stable.currentUp);
  }

  function patchRoot(root) {
    if (!root) return;
    patchInternet(root);
    patchFritz(root);
  }

  function transformHtml(html) {
    if (typeof html !== 'string' || !html.includes('class="card')) return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    patchRoot(template.content);
    return template.innerHTML;
  }

  function protectInnerHtml(element) {
    if (!element || element.dataset.networkRenderGuard === '1') return;
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!descriptor?.get || !descriptor?.set) return;

    Object.defineProperty(element, 'innerHTML', {
      configurable: true,
      enumerable: false,
      get() {
        return descriptor.get.call(this);
      },
      set(value) {
        refreshStableData();
        descriptor.set.call(this, transformHtml(value));
      },
    });
    element.dataset.networkRenderGuard = '1';
  }

  const left = document.querySelector('#left-rail');
  const right = document.querySelector('#right-rail');
  protectInnerHtml(left);
  protectInnerHtml(right);

  function apply() {
    refreshStableData();
    patchRoot(document);
  }

  const observer = new MutationObserver(apply);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  const timer = setInterval(apply, 500);

  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  apply();
})();
