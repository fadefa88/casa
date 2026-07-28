import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const TARGET_NAME = "second__LivingRoom-39392__59111__media_unit_floor-based_media_unit__solid_015";
const originalLoad = GLTFLoader.prototype.load;

GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  const patchedOnLoad = (gltf) => {
    const target = gltf.scene?.getObjectByName(TARGET_NAME);
    if (target) {
      target.material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.62,
        metalness: 0,
        side: THREE.DoubleSide,
      });
    } else {
      console.warn(`Elemento non trovato per il fix v27: ${TARGET_NAME}`);
    }
    onLoad?.(gltf);
  };

  return originalLoad.call(this, url, patchedOnLoad, onProgress, onError);
};

await import("./app-v26.js?v=30");
