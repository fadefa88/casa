(() => {
  'use strict';

  const NULL_TEXT = 'NULL';
  let applying = false;

  const ROOM_LIGHTS = {
    'first-salotto': ['Luce Salotto', 'Scale', 'Ingresso', 'Luce Esterna Salotto'],
    'first-cucina': ['Pensili Cucina'],
    'first-camera-matrimoniale': ['Luce Camera Matrimoniale', 'Luca Camera Matrimoniale'],
    'first-corridoio': ['Corridoio'],
    'first-studio': ['Luce Studio', 'Luce Esterna Studio'],
    'first-cameretta': ['Luce Cameretta'],
    'first-bagno-matrimoniale': ['Luce Bagno Matrimoniale', 'Specchio Bagno Matrimoniale'],
    'first-bagno-ospiti': ['Luce Bagno Ospiti', 'Specchio Bagno Ospiti'],
    'second-vano-tecnico': ['Luce Vano Tecnico', 'Vano Tecnico', 'Luce Locale Tecnico'],
    'second-bagno-mansarda': ['Luce Bagno Mansarda', 'Specchio Bagno Mansarda'],
    'second-mansarda': [
      'Led Mansarda DX',
      'Led Mansarda SX',
      'Led Mansarda Centrale',
      'Luce Esterna Mansarda',
      'Corridoio Mansarda',
    ],
    'second-camera-mansarda': ['Luce Camera Mansarda', 'Luce Esterna Camera Mansarda'],
  };

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const states = () => window.CASA_HA?.state?.states instanceof Map
    ? window.CASA_HA.state.states
    : new Map();

  function entityName(entity) {
    return normalize(entity?.attributes?.friendly_name || '');
  }

  function entityObjectId(entity) {
    return normalize(String(entity?.entity_id || '').split('.').slice(1).join(' '));
  }

  function stateIsUsable(entity) {
    return Boolean(entity && !['unknown', 'unavailable', 'none', 'null', ''].includes(normalize(entity.state)));
  }

  function resolveEntity({ names = [], domains = [], exactIds = [] }) {
    const map = states();

    for (const entityId of exactIds) {
      const entity = map.get(entityId);
      if (entity && domains.includes(entity.entity_id.split('.')[0])) return entity;
    }

    const wantedNames = [...new Set(names.map(normalize).filter(Boolean))];
    let best = null;
    let bestScore = -Infinity;

    for (const entity of map.values()) {
      const domain = String(entity.entity_id || '').split('.')[0];
      if (!domains.includes(domain)) continue;

      const friendly = entityName(entity);
      const objectId = entityObjectId(entity);
      const text = normalize(`${friendly} ${objectId}`);
      let score = -Infinity;

      wantedNames.forEach((name, index) => {
        const penalty = index * 2;
        if (friendly === name) score = Math.max(score, 220 - penalty);
        else if (objectId === name) score = Math.max(score, 210 - penalty);
        else if (friendly.startsWith(`${name} `) || friendly.endsWith(` ${name}`)) {
          score = Math.max(score, 170 - penalty);
        } else {
          const tokens = name.split(' ').filter((token) => token.length > 2);
          if (tokens.length && tokens.every((token) => text.includes(token))) {
            score = Math.max(score, 105 + tokens.length * 8 - penalty);
          }
        }
      });

      if (stateIsUsable(entity)) score += 4;
      if (score > bestScore) {
        bestScore = score;
        best = entity;
      }
    }

    return bestScore >= 120 ? best : null;
  }

  function resolveLight(name) {
    return resolveEntity({
      names: [name],
      domains: ['light', 'switch', 'input_boolean'],
    });
  }

  function resolveVanoTecnicoLight() {
    return resolveEntity({
      names: ['Luce Vano Tecnico', 'Vano Tecnico', 'Luce Locale Tecnico', 'Locale Tecnico'],
      domains: ['light', 'switch', 'input_boolean'],
      exactIds: [
        'light.luce_vano_tecnico',
        'light.vano_tecnico',
        'light.locale_tecnico',
        'switch.luce_vano_tecnico',
        'switch.vano_tecnico',
        'switch.locale_tecnico',
        'input_boolean.luce_vano_tecnico',
      ],
    });
  }

  function resolveMansardaCover() {
    return resolveEntity({
      names: ['Tapparella Mansarda'],
      domains: ['cover'],
      exactIds: ['cover.tapparella_mansarda', 'cover.mansarda'],
    });
  }

  function patchRoomActivity() {
    Object.entries(ROOM_LIGHTS).forEach(([roomId, names]) => {
      const card = document.querySelector(`[data-room-device-select="${roomId}"]`);
      const statusNode = card?.querySelector('.room-device-side small');
      if (!statusNode) return;

      const uniqueEntities = new Map();
      names.forEach((name) => {
        const entity = roomId === 'second-vano-tecnico'
          ? resolveVanoTecnicoLight()
          : resolveLight(name);
        if (entity) uniqueEntities.set(entity.entity_id, entity);
      });

      const resolved = [...uniqueEntities.values()];
      const activeLights = resolved.filter((entity) => normalize(entity.state) === 'on').length;
      let label = 'Tutto spento';

      if (!resolved.length && names.length) label = NULL_TEXT;
      else if (activeLights === 1) label = '1 luce accesa';
      else if (activeLights > 1) label = `${activeLights} luci accese`;

      if (statusNode.textContent !== label) statusNode.textContent = label;
      statusNode.classList.toggle('active', activeLights > 0);
    });
  }

  function patchLightTile(tile, entity) {
    if (!tile || !entity) return;
    const status = normalize(entity.state);
    const expectedClass = status === 'on' ? 'on' : 'off';
    const expectedLabel = status === 'on' ? 'Accesa' : 'Spenta';

    if (tile.dataset.haDeviceToggle !== entity.entity_id) {
      tile.dataset.haDeviceToggle = entity.entity_id;
    }
    if (tile.hasAttribute('disabled')) tile.removeAttribute('disabled');
    if (!tile.classList.contains(expectedClass) || tile.classList.contains('null')) {
      tile.classList.remove('null', 'on', 'off');
      tile.classList.add(expectedClass);
    }

    const stateNode = tile.querySelector('.ha-device-copy small');
    if (stateNode && stateNode.textContent !== expectedLabel) stateNode.textContent = expectedLabel;
  }

  function patchVanoTecnico() {
    const selected = document.querySelector('[data-room-device-select="second-vano-tecnico"].active');
    if (!selected) return;
    const entity = resolveVanoTecnicoLight();
    const tile = document.querySelector('#context-panel .ha-device-section.light .ha-device-tile.light');
    patchLightTile(tile, entity);
  }

  function coverStatus(entity) {
    const state = normalize(entity?.state);
    if (state === 'closed') return { label: 'Chiusa', cls: 'closed' };
    if (state === 'closing') return { label: 'In chiusura', cls: 'moving' };
    if (state === 'opening') return { label: 'In apertura', cls: 'moving' };
    if (state === 'open') return { label: 'Aperta', cls: 'on' };
    const position = Number(entity?.attributes?.current_position);
    if (Number.isFinite(position)) {
      return position >= 99
        ? { label: 'Chiusa', cls: 'closed' }
        : { label: `${position.toLocaleString('it-IT', { maximumFractionDigits: 1 })}% chiusa`, cls: 'on' };
    }
    return { label: String(entity?.state || NULL_TEXT), cls: 'null' };
  }

  function patchMansardaCover() {
    const selected = document.querySelector('[data-room-device-select="second-mansarda"].active');
    if (!selected) return;

    const entity = resolveMansardaCover();
    if (!entity) return;

    const coverTiles = [...document.querySelectorAll('#context-panel .ha-device-section.cover .ha-device-tile.cover')];
    const tile = coverTiles.find((node) =>
      normalize(node.querySelector('.ha-device-copy strong')?.textContent) === 'portafinestra'
    ) || coverTiles[0];
    if (!tile) return;

    tile.querySelectorAll('[data-ha-cover-action]').forEach((button) => {
      if (button.dataset.entityId !== entity.entity_id) button.dataset.entityId = entity.entity_id;
      if (button.hasAttribute('disabled')) button.removeAttribute('disabled');
    });

    const status = coverStatus(entity);
    if (!tile.classList.contains(status.cls) || tile.classList.contains('null')) {
      tile.classList.remove('null', 'on', 'closed', 'moving');
      tile.classList.add(status.cls);
    }
    const stateNode = tile.querySelector('.ha-device-copy small');
    if (stateNode && stateNode.textContent !== status.label) stateNode.textContent = status.label;
  }

  function apply() {
    if (applying || normalize(document.querySelector('#view-title')?.textContent) !== 'stanze') return;
    applying = true;
    try {
      patchRoomActivity();
      patchVanoTecnico();
      patchMansardaCover();
    } finally {
      applying = false;
    }
  }

  // Osserva solo ricostruzioni del layout. Gli aggiornamenti testuali sono gestiti
  // dal timer e non devono riattivare ricorsivamente il MutationObserver.
  const observer = new MutationObserver(() => {
    if (!applying) requestAnimationFrame(apply);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const timer = setInterval(apply, 500);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  apply();
})();
