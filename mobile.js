(() => {
  const media = window.matchMedia('(max-width: 820px)');
  const canvas = document.getElementById('c');
  const viewer = document.getElementById('view');
  const leftPanel = document.querySelector('.panel:not(.r)');
  const rightPanel = document.querySelector('.panel.r');

  if (!canvas || !viewer || !leftPanel || !rightPanel) return;

  leftPanel.classList.add('mobile-left');

  const backdrop = document.createElement('div');
  backdrop.className = 'mobile-backdrop';
  document.body.appendChild(backdrop);

  const topbar = document.createElement('div');
  topbar.className = 'mobile-topbar';
  topbar.innerHTML = `
    <div class="mobile-topbar-group">
      <button class="mobile-control" id="mobileMenu" aria-label="Apri controlli">☰</button>
      <div class="mobile-page-title">Casa 5B · modello 3D</div>
    </div>
    <div class="mobile-topbar-group">
      <button class="mobile-control" id="mobileInfo" aria-label="Apri dettagli stanza">ⓘ</button>
    </div>`;
  document.body.appendChild(topbar);

  const dock = document.createElement('div');
  dock.className = 'mobile-dock';
  dock.innerHTML = `
    <button type="button" data-mobile-view="iso">3D</button>
    <button type="button" data-mobile-view="top">Alto</button>
    <button type="button" data-mobile-view="reset">Reset</button>`;
  document.body.appendChild(dock);

  function closePanels() {
    leftPanel.classList.remove('mobile-open');
    rightPanel.classList.remove('mobile-open');
    backdrop.classList.remove('visible');
  }

  function openPanel(panel) {
    closePanels();
    panel.classList.add('mobile-open');
    backdrop.classList.add('visible');
  }

  function ensureCloseButton(panel) {
    if (panel.querySelector(':scope > .mobile-panel-close')) return;
    const close = document.createElement('button');
    close.className = 'mobile-panel-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Chiudi pannello');
    close.textContent = '×';
    close.addEventListener('click', closePanels);
    panel.prepend(close);
  }

  ensureCloseButton(leftPanel);
  ensureCloseButton(rightPanel);

  new MutationObserver(() => ensureCloseButton(rightPanel)).observe(rightPanel, {
    childList: true
  });

  document.getElementById('mobileMenu').addEventListener('click', () => openPanel(leftPanel));
  document.getElementById('mobileInfo').addEventListener('click', () => openPanel(rightPanel));
  backdrop.addEventListener('click', closePanels);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePanels();
  });

  leftPanel.addEventListener('click', event => {
    if (!media.matches || !event.target.closest('.room')) return;
    setTimeout(() => openPanel(rightPanel), 0);
  });

  function setView(mode) {
    if (!media.matches) return;

    if (mode === 'iso' || mode === 'reset') {
      yaw = -0.82;
      pitch = 0.72;
      z = 48;
      px = 0;
      py = 62;
    }

    if (mode === 'top') {
      yaw = 0;
      pitch = 1.56;
      z = 54;
      px = 0;
      py = 70;
    }

    if (mode === 'reset') {
      const gap = document.getElementById('gap');
      const opacity = document.getElementById('opacity');
      if (gap) {
        gap.value = '3.3';
        gap.dispatchEvent(new Event('input'));
      }
      if (opacity) {
        opacity.value = '0.88';
        opacity.dispatchEvent(new Event('input'));
      }
    }
  }

  dock.querySelectorAll('[data-mobile-view]').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.mobileView));
  });

  const pointers = new Map();
  let primaryId = null;
  let lastX = 0;
  let lastY = 0;
  let moved = false;
  let pinchDistance = 0;
  let pinchMidpoint = null;

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  canvas.addEventListener('pointerdown', event => {
    if (!media.matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    viewer.classList.add('dragging');

    if (pointers.size === 1) {
      primaryId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      moved = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = distance(a, b);
      pinchMidpoint = midpoint(a, b);
      moved = true;
    }
  }, true);

  canvas.addEventListener('pointermove', event => {
    if (!media.matches || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()].slice(0, 2);
      const nextDistance = distance(a, b);
      const nextMidpoint = midpoint(a, b);

      if (pinchDistance > 0) {
        z *= nextDistance / pinchDistance;
        z = Math.max(25, Math.min(125, z));
      }

      if (pinchMidpoint) {
        px += nextMidpoint.x - pinchMidpoint.x;
        py += nextMidpoint.y - pinchMidpoint.y;
      }

      pinchDistance = nextDistance;
      pinchMidpoint = nextMidpoint;
      moved = true;
      return;
    }

    if (event.pointerId !== primaryId) return;

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;

    yaw += dx * 0.008;
    pitch += dy * 0.006;
    lastX = event.clientX;
    lastY = event.clientY;
  }, true);

  function finishPointer(event) {
    if (!media.matches || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const wasSingleTap = pointers.size === 1 && event.pointerId === primaryId && !moved;
    pointers.delete(event.pointerId);

    if (wasSingleTap) {
      const rect = canvas.getBoundingClientRect();
      const tapX = event.clientX - rect.left;
      const tapY = event.clientY - rect.top;
      const hit = marks.find(marker => Math.hypot(tapX - marker.x, tapY - marker.y) <= marker.r + 12);
      if (hit) {
        select(hit.id);
        openPanel(rightPanel);
      }
    }

    if (pointers.size === 1) {
      const [id, point] = pointers.entries().next().value;
      primaryId = id;
      lastX = point.x;
      lastY = point.y;
      pinchDistance = 0;
      pinchMidpoint = null;
      moved = true;
    } else if (pointers.size === 0) {
      primaryId = null;
      pinchDistance = 0;
      pinchMidpoint = null;
      viewer.classList.remove('dragging');
    }

    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (_) {}
  }

  canvas.addEventListener('pointerup', finishPointer, true);
  canvas.addEventListener('pointercancel', finishPointer, true);

  function applyMobileState() {
    if (media.matches) {
      setView('iso');
    } else {
      closePanels();
    }
  }

  media.addEventListener?.('change', applyMobileState);
  window.addEventListener('orientationchange', () => {
    setTimeout(() => media.matches && setView('iso'), 180);
  });

  applyMobileState();
})();
