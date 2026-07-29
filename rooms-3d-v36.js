import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

window.CASA_3D_CONTEXT = window.CASA_3D_CONTEXT || { scene:null, camera:null, renderer:null, anchors:[] };

const originalRender = THREE.WebGLRenderer.prototype.render;
THREE.WebGLRenderer.prototype.render = function(scene, camera) {
  window.CASA_3D_CONTEXT.scene = scene;
  window.CASA_3D_CONTEXT.camera = camera;
  window.CASA_3D_CONTEXT.renderer = this;
  return originalRender.call(this, scene, camera);
};

const originalLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function(url, onLoad, onProgress, onError) {
  return originalLoad.call(this, url, (gltf) => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const grouped = new Map();
    root.traverse((object) => {
      if (!object.isMesh || !object.name) return;
      const parts = object.name.split('__');
      if (!['first','second'].includes(parts[0]) || !parts[1] || parts[1] === 'none') return;
      const key = `${parts[0]}__${parts[1]}`;
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;
      if (!grouped.has(key)) grouped.set(key, box);
      else grouped.get(key).union(box);
    });
    window.CASA_3D_CONTEXT.anchors = [...grouped].map(([modelKey, box]) => {
      const point = box.getCenter(new THREE.Vector3());
      point.y = box.max.y + 0.18;
      return { modelKey, floor:modelKey.startsWith('first__')?'first':'second', point };
    });
    window.dispatchEvent(new CustomEvent('casa:rooms-ready', { detail:window.CASA_3D_CONTEXT.anchors }));
    onLoad?.(gltf);
  }, onProgress, onError);
};
