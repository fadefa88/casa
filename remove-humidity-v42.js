(() => {
  'use strict';

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function removeHumidity() {
    document.querySelectorAll('.overview-kpi, .context-metric, .metric-grid > div, .status-line').forEach((node) => {
      const label = node.querySelector('small, span');
      if (normalize(label?.textContent) === 'umidita') node.remove();
    });

    document.querySelectorAll('.room-temp small').forEach((node) => node.remove());
  }

  const observer = new MutationObserver(removeHumidity);
  observer.observe(document.body, { childList: true, subtree: true });
  removeHumidity();
})();
