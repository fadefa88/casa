const scene = document.querySelector('#scene');
if (scene) {
  scene.style.pointerEvents = 'auto';
  scene.style.touchAction = 'none';
}

const visibleFloorButtons = [...document.querySelectorAll('.tablet-floor-nav [data-floor]')];
const legacyFloorButtons = [...document.querySelectorAll('.floors [data-floor]')];

visibleFloorButtons.forEach((button) => {
  button.addEventListener('click', () => {
    visibleFloorButtons.forEach((item) => item.classList.toggle('active', item === button));
    legacyFloorButtons.find((item) => item.dataset.floor === button.dataset.floor)?.click();
  });
});

const fullButton = document.querySelector('#full');
fullButton?.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn('Schermo intero non disponibile', error);
  }
});

document.querySelector('#reset')?.addEventListener('click', () => location.reload());

const note = document.querySelector('#detail-note');
if (note) {
  note.innerHTML = 'Dati demo. Trascina la casa per ruotarla, usa due dita per zoomare e i pulsanti per cambiare piano. Per i dati reali collega Home Assistant in <code>config.js</code>.';
}
