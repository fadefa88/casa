const response = await fetch('./app.js?v=27');
if (!response.ok) throw new Error(`Impossibile caricare app.js: ${response.status}`);
let source = await response.text();

const replacement = `function deformMeshForSecondFloorMansard(mesh){
  if(!mesh || !mesh.geometry?.attributes?.position) return;
  const geom = mesh.geometry.clone();
  const pos = geom.attributes.position;
  const world = mesh.matrixWorld.clone();
  const inv = mesh.matrixWorld.clone().invert();
  const p = new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(world);
    if(p.y > 0.001){
      const roofY = secondFloorRoofHeightAtZ(p.z);
      if(p.y > roofY) p.y = roofY;
    }
    p.applyMatrix4(inv);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  mesh.geometry = geom;
}
function applySecondFloorMansard`;

const pattern = /function deformMeshForSecondFloorMansard\(mesh\)\{[\s\S]*?\n\}\nfunction applySecondFloorMansard/;
if (!pattern.test(source)) throw new Error('Blocco mansardato non trovato in app.js');
source = source
  .replace(pattern, replacement)
  .replace('casa_homestyler.glb?v=27', 'casa_homestyler.glb?v=28');

const moduleUrl = URL.createObjectURL(new Blob([source], {type: 'text/javascript'}));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
