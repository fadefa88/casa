(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  const VALUE_SELECTORS = [
    '.card-head > strong',
    '.metric-grid strong',
    '.overview-kpi strong',
    '.status-line strong',
    '.security-tile strong',
    '.network-health .score',
    '.network-health strong',
    '.network-health small',
    '.room-temp strong',
    '.room-temp small',
    '.room-sub',
    '.context-metric strong',
    '.context-climate strong',
    '.context-climate small',
    '.intercom-preview small'
  ];

  function isConnected() {
    return window.CASA_HA?.state?.connected === true;
  }

  function applyNullState() {
    const offline = !isConnected();
    document.body.classList.toggle('ha-offline-null', offline);

    if (!offline) return;

    document.querySelectorAll(VALUE_SELECTORS.join(',')).forEach((node) => {
      node.textContent = NULL_TEXT;
      node.dataset.haNull = 'true';
    });

    const alarm = document.querySelector('#alarm-pill');
    const internet = document.querySelector('#internet-pill');
    const backup = document.querySelector('#backup-pill');
    const ha = document.querySelector('#ha-pill');

    if (alarm) alarm.innerHTML = '<i class="fa-solid fa-shield-halved"></i> NULL';
    if (internet) internet.innerHTML = '<i class="fa-solid fa-globe"></i> NULL';
    if (backup) backup.innerHTML = '<i class="fa-solid fa-tower-cell"></i> NULL';
    if (ha) {
      ha.className = 'pill bad';
      ha.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> HA OFFLINE · NULL';
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    body.ha-offline-null [data-action] {
      opacity: .42 !important;
      pointer-events: none !important;
      cursor: not-allowed !important;
    }
    body.ha-offline-null [data-ha-null="true"] {
      color: #ff9d9d !important;
    }
    body.ha-offline-null #ha-pill {
      color: #ffd4d4 !important;
      border-color: rgba(255, 100, 100, .45) !important;
      background: rgba(120, 20, 20, .24) !important;
    }
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(() => applyNullState());
  observer.observe(document.body, { childList: true, subtree: true });

  applyNullState();
  setInterval(applyNullState, 750);
})();
