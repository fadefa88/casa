import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#scene");
const loading = document.querySelector("#loading");
const loadingProgress = document.querySelector("#loading-progress");
const statusText = document.querySelector("#status-text");
const statusDot = document.querySelector(".status-dot");
const fatalError = document.querySelector("#fatal-error");
const fatalErrorMessage = document.querySelector("#fatal-error-message");
const infoCard = document.querySelector("#info-card");
const infoRoom = document.querySelector("#info-room");
const infoType = document.querySelector("#info-type");
const infoFloor = document.querySelector("#info-floor");
const hint = document.querySelector("#hint");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce5ef);
scene.fog = new THREE.Fog(0xdce5ef, 38, 85);

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 250);
camera.position.set(20, 16, 20);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.screenSpacePanning = true;
controls.minDistance = 4;
controls.maxDistance = 75;
controls.maxPolarAngle = Math.PI / 2.02;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x728099, 2.3));

const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
keyLight.position.set(14, 24, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -30;
keyLight.shadow.camera.right = 30;
keyLight.shadow.camera.top = 30;
keyLight.shadow.camera.bottom = -30;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xbdd5ff, 1.05);
fillLight.position.set(-16, 10, -12);
scene.add(fillLight);

const modelContainer = new THREE.Group();
scene.add(modelContainer);

const groundMaterial = new THREE.ShadowMaterial({
  color: 0x6c7b90,
  opacity: 0.12,
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let model = null;
let mode = "side";
let lowerObjects = [];
let upperObjects = [];
let floorBounds = {};
let selectedObject = null;
let savedMaterials = null;
let baseModelBounds = null;
let isAutoRotating = false;
let pointerDown = null;

const niceType = (raw) => {
  const map = {
    Walls: "Pareti",
    Doors: "Porte",
    Windows_Openings: "Finestre e aperture",
    Floors_Ceilings: "Pavimenti e solai",
    Components: "Componente architettonico",
  };
  return map[raw] || raw?.replaceAll("_", " ") || "Elemento architettonico";
};

const niceRoom = (raw) => {
  const map = {
    Bedroom: "Camera",
    MasterBedroom: "Camera matrimoniale",
    Bathroom: "Bagno",
    MasterBathroom: "Bagno principale",
    LivingRoom: "Soggiorno",
    LivingDiningRoom: "Soggiorno e cucina",
    EquipmentRoom: "Vano tecnico",
    Corridor: "Corridoio",
    Terrace: "Terrazza",
    OtherRoom: "Locale",
    none: "Elemento comune",
  };
  const key = raw?.split("-")[0];
  return map[key] || raw || "Locale";
};

function resizeRenderer() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const needResize =
    canvas.width !== Math.floor(width * pixelRatio) ||
    canvas.height !== Math.floor(height * pixelRatio);

  if (needResize) {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }
}

function objectBounds(objects) {
  const result = new THREE.Box3();
  result.makeEmpty();

  objects.forEach((object) => {
    if (!object.visible) return;
    result.union(new THREE.Box3().setFromObject(object));
  });

  return result;
}

function fitCamera(direction = "iso", animate = false) {
  if (!model) return;

  modelContainer.updateMatrixWorld(true);
  const visibleObjects = [...lowerObjects, ...upperObjects].filter((item) => item.visible);
  const box = objectBounds(visibleObjects);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y * 1.7, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxSize * 0.63) / Math.tan(fov / 2);
  distance *= direction === "top" ? 1.05 : 1.15;

  let cameraPosition;
  if (direction === "top") {
    cameraPosition = new THREE.Vector3(center.x, center.y + distance, center.z + 0.001);
  } else {
    const vector = new THREE.Vector3(1, 0.72, 1).normalize();
    cameraPosition = center.clone().add(vector.multiplyScalar(distance));
  }

  camera.position.copy(cameraPosition);
  controls.target.copy(center);
  controls.update();
}

function resetObjectTransforms() {
  [...lowerObjects, ...upperObjects].forEach((object) => {
    const original = object.userData.originalTransform;
    object.position.copy(original.position);
    object.quaternion.copy(original.quaternion);
    object.scale.copy(original.scale);
    object.visible = true;
  });
}

function setMode(nextMode, refit = true) {
  if (!model) return;
  mode = nextMode;
  resetObjectTransforms();

  const lowerBase = floorBounds.lower.min.y;
  const upperBase = floorBounds.upper.min.y;
  const fullSize = baseModelBounds.getSize(new THREE.Vector3());
  const horizontalGap = fullSize.x * 0.56;

  if (nextMode === "lower") {
    upperObjects.forEach((object) => { object.visible = false; });
    lowerObjects.forEach((object) => { object.position.y -= lowerBase; });
    ground.position.y = -0.025;
  } else if (nextMode === "upper") {
    lowerObjects.forEach((object) => { object.visible = false; });
    upperObjects.forEach((object) => { object.position.y -= upperBase; });
    ground.position.y = -0.025;
  } else if (nextMode === "side") {
    lowerObjects.forEach((object) => {
      object.position.x -= horizontalGap;
      object.position.y -= lowerBase;
    });
    upperObjects.forEach((object) => {
      object.position.x += horizontalGap;
      object.position.y -= upperBase;
    });
    ground.position.y = -0.025;
  } else {
    ground.position.y = baseModelBounds.min.y - 0.025;
  }

  modelContainer.updateMatrixWorld(true);
  clearSelection();

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === nextMode);
  });

  const labels = {
    side: "Piani affiancati",
    stacked: "Casa completa",
    lower: "Piano inferiore",
    upper: "Piano superiore",
  };
  statusText.textContent = labels[nextMode];

  if (refit) {
    requestAnimationFrame(() => fitCamera("iso"));
  }
}

function classifyFloors() {
  lowerObjects = [];
  upperObjects = [];

  model.children.forEach((object) => {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const centerY = box.getCenter(new THREE.Vector3()).y;
    const floor = centerY < -0.05 ? "lower" : "upper";

    object.userData.floor = floor;
    object.userData.originalTransform = {
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
    };

    if (floor === "lower") lowerObjects.push(object);
    else upperObjects.push(object);
  });

  floorBounds = {
    lower: objectBounds(lowerObjects),
    upper: objectBounds(upperObjects),
  };
}

function prepareMaterials() {
  model.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) return;
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;

      if ("roughness" in material) material.roughness = Math.max(material.roughness ?? 0.72, 0.56);
      if ("metalness" in material) material.metalness = Math.min(material.metalness ?? 0, 0.12);
    });
  });
}

function clearSelection() {
  if (selectedObject && savedMaterials) {
    selectedObject.material = savedMaterials;
  }
  selectedObject = null;
  savedMaterials = null;
  infoCard.hidden = true;
}

function selectObject(object) {
  clearSelection();
  selectedObject = object;
  savedMaterials = object.material;

  const originalMaterials = Array.isArray(object.material) ? object.material : [object.material];
  const highlighted = originalMaterials.map((material) => {
    const clone = material.clone();
    if ("emissive" in clone) {
      clone.emissive = new THREE.Color(0x2767cf);
      clone.emissiveIntensity = 0.36;
    }
    return clone;
  });
  object.material = Array.isArray(object.material) ? highlighted : highlighted[0];

  const [roomToken, typeToken] = object.name.split("__");
  infoRoom.textContent = niceRoom(roomToken);
  infoType.textContent = niceType(typeToken);
  infoFloor.textContent =
    object.userData.floor === "lower" ? "Piano inferiore" : "Piano superiore";
  infoCard.hidden = false;
}

function pick(event) {
  if (!model) return;

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const meshes = [];
  model.traverse((object) => {
    if (object.isMesh && object.visible && object.parent?.visible !== false) meshes.push(object);
  });

  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (hit) selectObject(hit.object);
  else clearSelection();
}

function showFatalError(error) {
  console.error(error);
  loading.classList.add("hidden");
  fatalError.hidden = false;
  fatalErrorMessage.textContent =
    "Controlla che il file assets/casa_web.glb sia presente e che la pagina sia pubblicata tramite GitHub Pages.";
  statusText.textContent = "Errore di caricamento";
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelector("#view-iso").addEventListener("click", () => fitCamera("iso"));
document.querySelector("#view-top").addEventListener("click", () => fitCamera("top"));
document.querySelector("#reset").addEventListener("click", () => {
  controls.autoRotate = false;
  isAutoRotating = false;
  document.querySelector("#auto-rotate").classList.remove("active");
  setMode(mode);
});
document.querySelector("#auto-rotate").addEventListener("click", (event) => {
  isAutoRotating = !isAutoRotating;
  controls.autoRotate = isAutoRotating;
  controls.autoRotateSpeed = 0.65;
  event.currentTarget.classList.toggle("active", isAutoRotating);
});
document.querySelector("#fullscreen").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    console.warn("Schermo intero non disponibile", error);
  }
});
document.querySelector("#close-info").addEventListener("click", clearSelection);

canvas.addEventListener("pointerdown", (event) => {
  pointerDown = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener("pointerup", (event) => {
  if (!pointerDown) return;
  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  if (moved < 5) pick(event);
  pointerDown = null;
});

setTimeout(() => {
  hint.style.opacity = "0";
}, 7500);

const loader = new GLTFLoader();
loader.load(
  "./assets/casa_web.glb",
  (gltf) => {
    model = gltf.scene;
    model.name = "Casa 5B";
    modelContainer.add(model);

    prepareMaterials();
    model.updateMatrixWorld(true);
    baseModelBounds = new THREE.Box3().setFromObject(model);
    classifyFloors();

    setMode("side", false);
    fitCamera("iso");

    loading.classList.add("hidden");
    statusDot.classList.add("ready");
    statusText.textContent = "Piani affiancati";
  },
  (progress) => {
    if (progress.total > 0) {
      const percentage = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
      loadingProgress.textContent = `${percentage}%`;
    } else {
      loadingProgress.textContent = "Download modello…";
    }
  },
  showFatalError
);

function render() {
  resizeRenderer();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

render();

window.addEventListener("resize", () => {
  resizeRenderer();
});
