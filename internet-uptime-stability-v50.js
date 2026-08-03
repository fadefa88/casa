(() => {
  'use strict';

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function compactDuration(value) {
    return String(value ?? 'NULL')
      .replace(/(\d+)\s+(?:giorno|giorni)\b/gi, '$1 gg');
  }

  function internetCard() {
    return [...document.querySelectorAll('.card')].find((card) =>
      normalize(card.querySelector('.card-head .title')?.textContent) === 'internet'
    ) || null;
  }

  function uptimeNode() {
    const card = internetCard();
    if (!card) return null;
    const row = [...card.querySelectorAll('.metric-grid > div')].find((item) =>
      normalize(item.querySelector('small')?.textContent) === 'uptime'
    );
    return row?.querySelector('strong') || null;
  }

  function patch() {
    if (normalize(document.querySelector('#view-title')?.textContent) !== 'panoramica') return;
    const cached = window.CASA_FRITZBOX?.uptimeConnection;
    if (!cached) return;

    const node = uptimeNode();
    if (!node) return;
    const value = compactDuration(cached);
    if (node.textContent !== value) node.textContent = value;
    node.classList.toggle('ha-null-value', value === 'NULL');
  }

  const rightRail = document.querySelector('#right-rail');
  const observer = new MutationObserver(patch);
  if (rightRail) {
    observer.observe(rightRail, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  const timer = setInterval(patch, 250);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) patch();
  });
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  patch();
})();
