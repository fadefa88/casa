import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
const $=s=>document.querySelector(s),canvas=$("#scene"),loading=$("#loading"),progress=$("#progress"),status=$("#status");
const scene=new THREE.Scene();scene.background=new THREE.Color(0xdce6f0);scene.fog=new THREE.Fog(0xdce6f0,45,100);
const camera=new THREE.PerspectiveCamera(38,1,.04,260);camera.position.set(22,18,22);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.03).texture;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.07;controls.screenSpacePanning=true;controls.minDistance=3;controls.maxDistance=90;controls.maxPolarAngle=Math.PI/2.01;
scene.add(new THREE.HemisphereLight(0xffffff,0x8b8b8b,1.5));const sun=new THREE.DirectionalLight(0xffffff,2.05);sun.position.set(15,24,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;scene.add(sun);const fill=new THREE.DirectionalLight(0xffffff,.35);fill.position.set(-15,11,-12);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.ShadowMaterial({color:0x64748b,opacity:.11}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const world=new THREE.Group(),first=new THREE.Group(),second=new THREE.Group();world.add(first,second);scene.add(world);
let current="both",selected=null,saved=null,down=null,allMeshes=[],allEntries=[];
function makeFabricTexture(base="#8b8f94", dark="#73777c"){
  const c=document.createElement('canvas'); c.width=128; c.height=128; const ctx=c.getContext('2d');
  ctx.fillStyle=base; ctx.fillRect(0,0,c.width,c.height);
  for(let i=0;i<2400;i++){ const x=Math.random()*128, y=Math.random()*128; const a=Math.random()*0.18; ctx.fillStyle=`rgba(0,0,0,${a})`; ctx.fillRect(x,y,1,1); }
  ctx.strokeStyle=dark; ctx.globalAlpha=.08;
  for(let i=0;i<128;i+=4){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(128,i); ctx.stroke(); }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2); return tex;
}
function makePlasticMaterial(color){ return new THREE.MeshPhysicalMaterial({color:new THREE.Color(color), roughness:.62, metalness:0.0, clearcoat:.18, clearcoatRoughness:.55, side:THREE.DoubleSide}); }
function makeWhiteUniform(){ return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.62, metalness:0.0, side:THREE.DoubleSide}); }
function makeMetalGray(){ return new THREE.MeshPhysicalMaterial({color:0xb7bcc2, roughness:.42, metalness:.88, envMapIntensity:1.0, side:THREE.DoubleSide}); }
function makeFabricGray(){ return new THREE.MeshPhysicalMaterial({color:0xc5c9cd, roughness:.95, metalness:0.0, map:makeFabricTexture('#c9cdd1','#a7adb3'), side:THREE.DoubleSide}); }

function makeInteriorWallWhite(){ return new THREE.MeshPhysicalMaterial({color:0xf1efe9, roughness:.94, metalness:0.0, side:THREE.DoubleSide}); }
function makeBlackFabric(){ return new THREE.MeshPhysicalMaterial({color:0x242529, roughness:.97, metalness:0.0, map:makeFabricTexture('#2d2f33','#17191c'), side:THREE.DoubleSide}); }
function makeGrayMarble(){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const ctx=c.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,256,256); grad.addColorStop(0,'#d8d9da'); grad.addColorStop(.52,'#bfc1c3'); grad.addColorStop(1,'#a5a8ab');
  ctx.fillStyle=grad; ctx.fillRect(0,0,256,256);
  for(let i=0;i<24;i++){
    ctx.strokeStyle=`rgba(${Math.random()>.5?'255,255,255':'82,86,90'},${0.08+Math.random()*0.12})`;
    ctx.lineWidth=.7+Math.random()*1.8; ctx.beginPath();
    let x=Math.random()*256, y=Math.random()*256; ctx.moveTo(x,y);
    for(let j=0;j<7;j++){ x+=(Math.random()-.5)*72; y+=(Math.random()-.5)*34; ctx.lineTo(x,y); }
    ctx.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2.2,2.2);
  return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.38, metalness:0.0, map:tex, side:THREE.DoubleSide});
}
function makeMirrorMaterial(){ return new THREE.MeshPhysicalMaterial({color:0xf5f7fa, roughness:.035, metalness:1.0, envMapIntensity:1.8, side:THREE.DoubleSide}); }

function makeWoodTexture(base='#8d6f4f', dark='#6d5338', light='#b08d67'){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const ctx=c.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,256,0); grad.addColorStop(0,base); grad.addColorStop(.5,light); grad.addColorStop(1,base);
  ctx.fillStyle=grad; ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=6){ ctx.fillStyle=`rgba(255,255,255,${0.02+Math.random()*0.03})`; ctx.fillRect(0,y,256,1); }
  for(let i=0;i<90;i++){
    ctx.strokeStyle=`rgba(${Math.random()>.5?'255,255,255':'40,24,10'},${0.03+Math.random()*0.06})`;
    ctx.lineWidth=.6+Math.random()*1.1; ctx.beginPath();
    let x=Math.random()*256; ctx.moveTo(x,0); for(let y=0;y<=256;y+=24){ x += (Math.random()-.5)*14; ctx.lineTo(x,y); } ctx.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1.4,1.4); return tex;
}
function makeWoodMaterial(base='#8d6f4f', dark='#6d5338', light='#b08d67'){
  return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.72, metalness:0.0, map:makeWoodTexture(base,dark,light), side:THREE.DoubleSide});
}
function makeLinenMaterial(base='#d8d1c8', dark='#bab1a6', repeat=2.2){
  const mat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(base), roughness:.96, metalness:0.0, map:makeFabricTexture(base,dark), side:THREE.DoubleSide});
  if(mat.map) mat.map.repeat.set(repeat,repeat);
  return mat;
}
function makeQuiltTexture(base='#ece8e2', line='#d6d1ca', accent='rgba(255,255,255,0.18)'){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const ctx=c.getContext('2d');
  ctx.fillStyle=base; ctx.fillRect(0,0,256,256);
  for(let i=0;i<1800;i++){ const x=Math.random()*256, y=Math.random()*256; ctx.fillStyle=`rgba(0,0,0,${Math.random()*0.03})`; ctx.fillRect(x,y,1,1); }
  ctx.strokeStyle=line; ctx.lineWidth=2;
  for(let y=18;y<256;y+=36){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); }
  for(let x=18;x<256;x+=42){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,256); ctx.stroke(); }
  ctx.strokeStyle=accent; ctx.lineWidth=1;
  for(let y=0;y<256;y+=18){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2); return tex;
}
function makeQuiltMaterial(base='#ece8e2', line='#d6d1ca'){
  return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.95, metalness:0.0, map:makeQuiltTexture(base,line), side:THREE.DoubleSide});
}
function makeBedMaterialMasterUpholstery(){ return makeLinenMaterial('#c8beb1','#a59787',2.1); }
function makeBedMaterialMasterDuvet(){ return makeQuiltMaterial('#f1eee8','#d8d2c9'); }
function makeBedMaterialMasterAccent(){ return makeLinenMaterial('#b5a08e','#8b7767',2.6); }
function makeBedMaterialSecondHeadboard(){ return makeLinenMaterial('#6f7e8a','#55616b',2.0); }
function makeBedMaterialSecondDuvet(){ return makeQuiltMaterial('#dfe6ea','#bcc8cf'); }
function makeBedMaterialSecondPillows(){ return makeLinenMaterial('#f5f4f2','#d5d2cd',2.8); }
function makeBedMaterialSecondAccent(){ return makeWoodMaterial('#7f654a','#5d4733','#9a7a59'); }
function makeSofaRealisticLightGray(){
  const mat=new THREE.MeshPhysicalMaterial({color:0xcfd3d6, roughness:.98, metalness:0.0, map:makeFabricTexture('#c9ced2','#aab0b5'), side:THREE.DoubleSide});
  if(mat.map) mat.map.repeat.set(2.6,2.2);
  return mat;
}

function localMeshBounds(mesh){
  const pos=mesh.geometry?.attributes?.position;
  if(!pos) return null;
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox ? mesh.geometry.boundingBox.clone() : null;
}
function addDoorHandleToMesh(mesh){
  const bb=localMeshBounds(mesh); if(!bb) return;
  const size=new THREE.Vector3(); bb.getSize(size);
  const center=new THREE.Vector3(); bb.getCenter(center);
  const dims=[{axis:'x',v:size.x},{axis:'y',v:size.y},{axis:'z',v:size.z}].sort((a,b)=>b.v-a.v);
  const vertical='y';
  const widthAxis = dims.find(d=>d.axis!=='y')?.axis || 'x';
  const depthAxis = ['x','y','z'].find(a=>a!==vertical && a!==widthAxis) || 'z';
  const getMin=a=>bb.min[a], getMax=a=>bb.max[a], set=(obj,a,val)=>{obj[a]=val};
  const mat=makeMetalGray();
  const group=new THREE.Group(); group.name='door_handle';
  const barLen=Math.max(size.y*0.14,0.10); const barRadius=Math.max(Math.min(size.x,size.z,size.y)*0.015,0.010);
  const barGeom=new THREE.CylinderGeometry(barRadius,barRadius,barLen,18);
  const mountGeom=new THREE.CylinderGeometry(barRadius*0.65,barRadius*0.65,Math.max(size[depthAxis]*0.7,0.018),14);
  const sideOffset=Math.max(size[depthAxis]*0.55,0.018);
  const widthInset=Math.max(size[widthAxis]*0.08,0.055);
  const yPos=center.y;
  const widthPos=getMax(widthAxis)-widthInset;
  const faceFront=getMax(depthAxis)+sideOffset*0.5;
  const faceBack=getMin(depthAxis)-sideOffset*0.5;
  const makeSide=(face,sign)=>{
    const bar=new THREE.Mesh(barGeom,mat.clone());
    if(widthAxis==='x') bar.rotation.z=Math.PI/2;
    else if(widthAxis==='z') bar.rotation.x=Math.PI/2;
    const p=new THREE.Vector3(center.x,yPos,center.z); set(p,widthAxis,widthPos); set(p,depthAxis,face); bar.position.copy(p); group.add(bar);
    [-barLen*0.28,barLen*0.28].forEach(off=>{
      const mount=new THREE.Mesh(mountGeom,mat.clone());
      if(depthAxis==='x') mount.rotation.z=Math.PI/2; else if(depthAxis==='z') mount.rotation.x=Math.PI/2;
      const mp=p.clone(); mp.y+=off; set(mp,depthAxis, face - sign*sideOffset*0.30); mount.position.copy(mp); group.add(mount);
    });
  };
  makeSide(faceFront,1); makeSide(faceBack,-1);
  mesh.add(group);
}
function addThumbturnToMesh(mesh){
  const bb=localMeshBounds(mesh); if(!bb) return;
  const size=new THREE.Vector3(); bb.getSize(size);
  const center=new THREE.Vector3(); bb.getCenter(center);
  const dims=[{axis:'x',v:size.x},{axis:'y',v:size.y},{axis:'z',v:size.z}].sort((a,b)=>b.v-a.v);
  const widthAxis = dims.find(d=>d.axis!=='y')?.axis || 'x';
  const depthAxis = ['x','y','z'].find(a=>a!=='y' && a!==widthAxis) || 'z';
  const set=(obj,a,val)=>{obj[a]=val};
  const faceFront=bb.max[depthAxis]+Math.max(size[depthAxis]*0.5,0.015);
  const faceBack=bb.min[depthAxis]-Math.max(size[depthAxis]*0.5,0.015);
  const widthPos=bb.getCenter(new THREE.Vector3())[widthAxis];
  const yPos=center.y;
  const discR=Math.max(Math.min(size.x,size.z,size.y)*0.035,0.018);
  const discGeom=new THREE.CylinderGeometry(discR,discR,Math.max(size[depthAxis]*0.4,0.012),20);
  const slotGeom=new THREE.BoxGeometry(discR*1.25, discR*0.18, Math.max(size[depthAxis]*0.55,0.006));
  const group=new THREE.Group(); group.name='door_thumbturn';
  const addSide=(face)=>{
    const disc=new THREE.Mesh(discGeom,makeMetalGray());
    if(depthAxis==='x') disc.rotation.z=Math.PI/2; else if(depthAxis==='z') disc.rotation.x=Math.PI/2;
    const p=new THREE.Vector3(center.x,yPos,center.z); set(p,widthAxis,widthPos); set(p,depthAxis,face); disc.position.copy(p); group.add(disc);
    const slot=new THREE.Mesh(slotGeom,makeMetalGray());
    const sp=p.clone(); sp.y+=discR*0.03; slot.position.copy(sp); group.add(slot);
  };
  addSide(faceFront); addSide(faceBack); mesh.add(group);
}
function addDoorHardware(){
  const byInstance=new Map();
  allMeshes.forEach(mesh=>{
    const name=mesh.name||'';
    if(!name.includes('__door_')) return;
    const parts=name.split('__'); const instanceId=parts[2]||mesh.uuid;
    const title=parts[3]||'';
    if(!byInstance.has(instanceId)) byInstance.set(instanceId,{title,meshes:[]});
    byInstance.get(instanceId).meshes.push(mesh);
  });
  byInstance.forEach(({title,meshes})=>{
    const candidates=meshes.filter(m=>(m.geometry?.attributes?.position?.count||0)>0);
    if(!candidates.length) return;
    let target=candidates[0], best=-1;
    candidates.forEach(m=>{ const bb=localMeshBounds(m); if(!bb) return; const s=new THREE.Vector3(); bb.getSize(s); const vol=Math.abs(s.x*s.y*s.z); if(vol>best){best=vol; target=m;} });
    if(title.includes('door_pocket_door')) addThumbturnToMesh(target);
    else if(title.includes('door_entry_single_swing_door')) addDoorHandleToMesh(target);
  });
}
function prepare(root){const items=[];root.traverse(o=>{if(!o.isMesh)return;items.push(o);o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.side=THREE.DoubleSide;m.needsUpdate=true})});for(const o of items){const n=o.name||o.parent?.name||"";(n.startsWith("first__")?first:second).attach(o)}allMeshes=items;applyCustomOverrides();applySecondFloorMansard();buildObjectIndex()}
function bounds(){world.updateMatrixWorld(true);const b=new THREE.Box3();b.makeEmpty();if(first.visible)b.union(new THREE.Box3().setFromObject(first));if(second.visible)b.union(new THREE.Box3().setFromObject(second));return b}
function fit(top=false){const b=bounds();if(b.isEmpty())return;const size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),max=Math.max(size.x,size.z,size.y*1.55),fov=THREE.MathUtils.degToRad(camera.fov),dist=(max*.66)/Math.tan(fov/2)*(top?1.05:1.17);camera.position.copy(top?new THREE.Vector3(center.x,center.y+dist,center.z+.001):center.clone().add(new THREE.Vector3(1,.72,1).normalize().multiplyScalar(dist)));controls.target.copy(center);controls.update()}
function clear(){if(selected&&saved)selected.material=saved;selected=saved=null;$("#info").hidden=true}
function setFloor(mode){current=mode;first.visible=mode!=="second";second.visible=mode!=="first";document.querySelectorAll("[data-floor]").forEach(b=>b.classList.toggle("active",b.dataset.floor===mode));status.textContent=mode==="both"?"Entrambi i piani":mode==="first"?"Primo piano":"Secondo piano";ground.position.y=mode==="second"?-.12:-3.02;clear();applySearchFilter($("#object-search")?.value||"");requestAnimationFrame(()=>fit(false))}
function parseParts(name=""){const parts=name.split("__");return {floorCode:parts[0]||"",roomCode:parts[1]||"",instanceId:parts[2]||"",title:(parts[3]||"Elemento").replaceAll("_"," "),slot:(parts[4]||parts.at(-1)||"mesh").replaceAll("_"," "),raw:name}}
function floorLabel(code){return code==="first"?"Primo piano":code==="second"?"Secondo piano":code||"-"}
function closeObjectList(){const panel=$("#object-list");panel.hidden=true;$("#list-toggle").classList.remove("active")}
function focusObject(obj){const box=new THREE.Box3().setFromObject(obj);const center=box.getCenter(new THREE.Vector3());controls.target.copy(center);camera.position.copy(center.clone().add(new THREE.Vector3(1,.55,1).normalize().multiplyScalar(Math.max(1.4,box.getSize(new THREE.Vector3()).length()*1.8))));controls.update()}
function selectObject(obj){clear();selected=obj;saved=selected.material;const arr=Array.isArray(saved)?saved:[saved];const hi=arr.map(m=>{const c=m.clone();if("emissive"in c){c.emissive.set(0x1f65d1);c.emissiveIntensity=.32}return c});selected.material=Array.isArray(saved)?hi:hi[0];const meta=parseParts(selected.name||"");$("#info-title").textContent=meta.title;$("#info-detail").textContent=`${meta.slot} · ${floorLabel(meta.floorCode)}`;$("#meta-floor").textContent=floorLabel(meta.floorCode);$("#meta-room").textContent=meta.roomCode||"-";$("#meta-instance").textContent=meta.instanceId||"-";$("#meta-slot").textContent=meta.slot||"-";$("#object-code").value=meta.raw;$("#info").hidden=false}
function pick(e){const r=canvas.getBoundingClientRect();const pointer=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1));const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);const visible=allMeshes.filter(o=>o.visible&&o.parent?.visible!==false);const hits=ray.intersectObjects(visible,false);if(!hits.length){clear();return}selectObject(hits[0].object)}
function buildObjectIndex(){const map=new Map();for(const mesh of allMeshes){if(mesh.visible===false)continue;const meta=parseParts(mesh.name||"");const key=meta.raw||mesh.uuid;if(!map.has(key)){map.set(key,{mesh,meta,text:`${meta.title} ${meta.slot} ${meta.roomCode} ${meta.instanceId} ${meta.raw}`.toLowerCase()})}}allEntries=[...map.values()].sort((a,b)=>a.meta.title.localeCompare(b.meta.title));applySearchFilter("")}
function applySearchFilter(term){const results=$("#object-results"); if(!results) return; const q=(term||"").trim().toLowerCase(); results.innerHTML=""; const filtered=allEntries.filter(entry=>{if(current==="first"&&entry.meta.floorCode!=="first")return false; if(current==="second"&&entry.meta.floorCode!=="second")return false; return !q || entry.text.includes(q)}); $("#object-count").textContent=`${filtered.length} oggetti`; filtered.slice(0,400).forEach(entry=>{const btn=document.createElement('button'); btn.className='object-item'; btn.innerHTML=`<strong>${entry.meta.title}</strong><small>${floorLabel(entry.meta.floorCode)} · ${entry.meta.roomCode || '-'} · ${entry.meta.slot}</small>`; btn.onclick=()=>{selectObject(entry.mesh);focusObject(entry.mesh);closeObjectList();$("#info").hidden=false}; results.appendChild(btn)}); if(filtered.length>400){const more=document.createElement('div'); more.className='object-count'; more.textContent='Mostrati solo i primi 400 risultati. Affina la ricerca.'; results.appendChild(more)}}
function meshesByPredicate(pred){ return allMeshes.filter(m=>pred(m.name||"", m)); }
function assignMaterial(meshes, materialFactory){ meshes.forEach((mesh, idx)=>{ const mat=materialFactory(mesh, idx); if(mat) mesh.material=mat; }); }
function cloneMaterialPreservingTextures(sourceMesh){ const src=Array.isArray(sourceMesh.material)?sourceMesh.material[0]:sourceMesh.material; return src?.clone ? src.clone() : src; }

function meshByName(name){ return allMeshes.find(m => m.name === name); }
function hideMesh(name){ const m=meshByName(name); if(m) m.visible=false; }
function setMaterial(name, materialFactory){ const m=meshByName(name); if(m) m.material=materialFactory(); }
function shiftMeshesTowardBaseCenter(targetNames, baseName, fraction=.5){
  const targets=targetNames.map(meshByName).filter(Boolean); const base=meshByName(baseName);
  if(!targets.length || !base) return;
  world.updateMatrixWorld(true);
  const tb=new THREE.Box3(); targets.forEach(m=>tb.expandByObject(m));
  const bb=new THREE.Box3().setFromObject(base);
  const tc=tb.getCenter(new THREE.Vector3()), bc=bb.getCenter(new THREE.Vector3()), bs=bb.getSize(new THREE.Vector3());
  const axis=bs.x>=bs.z?'x':'z';
  const raw=(bc[axis]-tc[axis])*fraction;
  const limit=Math.max(bs[axis]*.12,.04);
  const delta=THREE.MathUtils.clamp(raw,-limit,limit);
  targets.forEach(m=>{m.position[axis]+=delta;});
}
function scaleInstanceAroundCenter(instanceId, factor=.9){
  const meshes=allMeshes.filter(m=>(m.name||'').includes(`__${instanceId}__`));
  if(!meshes.length) return;
  world.updateMatrixWorld(true);
  const box=new THREE.Box3(); meshes.forEach(m=>box.expandByObject(m));
  const centerWorld=box.getCenter(new THREE.Vector3());
  const parent=meshes[0].parent || world;
  const centerLocal=parent.worldToLocal(centerWorld.clone());
  const holder=new THREE.Group(); holder.name=`scaled_instance_${instanceId}`; holder.position.copy(centerLocal); parent.add(holder); holder.updateMatrixWorld(true);
  meshes.forEach(m=>holder.attach(m));
  holder.scale.setScalar(factor);
}
function scaleMeshHeightFromBottom(name, factor=.95){
  const mesh=meshByName(name);
  if(!mesh || !mesh.geometry?.attributes?.position) return;
  const geom=mesh.geometry.clone();
  geom.computeBoundingBox();
  const bb=geom.boundingBox;
  const bottom=bb.min.y;
  const pos=geom.attributes.position;
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i);
    pos.setY(i, bottom + (y-bottom)*factor);
  }
  pos.needsUpdate=true;
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  mesh.geometry=geom;
}
function secondFloorRoofHeightAtZ(z){
  const zLow = -4.80556011;
  const zPeak = 2.03959;
  const zHigh = 6.03425978;
  const hLow = 0.86;
  const hPeak = 3.10;
  const hHigh = 2.05;
  if(z <= zPeak){
    const t = THREE.MathUtils.clamp((z - zLow) / Math.max(0.001, zPeak - zLow), 0, 1);
    return THREE.MathUtils.lerp(hLow, hPeak, t);
  }
  const t = THREE.MathUtils.clamp((z - zPeak) / Math.max(0.001, zHigh - zPeak), 0, 1);
  return THREE.MathUtils.lerp(hPeak, hHigh, t);
}
function isSecondFloorMansardMesh(name=''){
  if(!name.startsWith('second__')) return false;
  // Regola robusta: sul secondo piano deformiamo tutti i mesh architettonici/strutturali,
  // cioè quelli il cui terzo segmento NON è un instance id numerico di un arredo.
  // In questo modo il profilo mansardato copre anche Other, Component generici,
  // strutture personalizzate, front/back e tutte le pareti delle terrazze.
  const parts = name.split('__');
  if(parts.length < 4) return false;
  const category = parts[2] || '';
  if(category === 'Floor') return false;
  return !/^\d+$/.test(category);
}
function deformMeshForSecondFloorMansard(mesh){
  if(!mesh || !mesh.geometry?.attributes?.position) return;
  const geom = mesh.geometry.clone();
  const pos = geom.attributes.position;
  const world = mesh.matrixWorld.clone();
  const inv = mesh.matrixWorld.clone().invert();
  const p = new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(world);
    if(p.y > 0.001){
      const targetTop = secondFloorRoofHeightAtZ(p.z);
      const factor = targetTop / 2.8;
      p.y *= factor;
    }
    p.applyMatrix4(inv);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  mesh.geometry = geom;
}
function applySecondFloorMansard(){
  world.updateMatrixWorld(true);
  const targets=allMeshes.filter(m => isSecondFloorMansardMesh(m.name || ''));
  targets.forEach(deformMeshForSecondFloorMansard);
  world.updateMatrixWorld(true);
  console.info(`Profilo mansardato applicato a ${targets.length} elementi strutturali del secondo piano.`);
}
function applyCustomOverrides(){
  // 1) shelf uses same texture/material as kitchen cabinet
  const sourceCabinet = allMeshes.find(m => m.name === 'first__LivingDiningRoom-116276__169003__cabinet_floor-based_kitchen_cabinet__solid_001');
  const targetShelf = allMeshes.find(m => m.name === 'first__LivingDiningRoom-116276__172324__shelf_decorative_shelf__solid_001');
  if(sourceCabinet && targetShelf){ const mat = cloneMaterialPreservingTextures(sourceCabinet); if(mat) targetShelf.material = mat; }

  // 1b) hide unwanted cabinet slot and force wall cabinet slot white
  const hiddenCabinetPart = allMeshes.find(m => m.name === 'first__LivingDiningRoom-116276__169003__cabinet_floor-based_kitchen_cabinet__solid_004');
  if(hiddenCabinetPart) hiddenCabinetPart.visible = false;
  const wallCabinetWhite = allMeshes.find(m => m.name === 'first__LivingDiningRoom-116276__169004__cabinet_wall-attached_cabinet__solid_003');
  if(wallCabinetWhite) wallCabinetWhite.material = makeWhiteUniform();

  // 2) white plastic chairs incl. legs
  const whiteChairInstances = ['175690','175676','172338','172345','172348','172351','172354','172357'];
  assignMaterial(meshesByPredicate(name => whiteChairInstances.some(id => name.includes(`__${id}__chair_chair__`))), () => makeWhiteUniform());

  // 3) blue plastic chair shells
  const blueInstances = ['165836','165832'];
  assignMaterial(meshesByPredicate(name => blueInstances.some(id => name.includes(`__${id}__chair_chair__`)) && (name.endsWith('__solid_002') || name.endsWith('__solid_003'))), () => makePlasticMaterial('#2563eb'));

  // 4) light-blue plastic chair shells
  assignMaterial(meshesByPredicate(name => name.includes('__165822__chair_chair__') && (name.endsWith('__solid_002') || name.endsWith('__solid_003'))), () => makePlasticMaterial('#7dd3fc'));

  // 5) gray fabric sofa part
  assignMaterial(meshesByPredicate(name => name === 'first__LivingDiningRoom-116276__165791__sofa_type_L_sofa__solid_002'), () => makeFabricGray());

  // realistic beds - first floor master bedroom
  ['first__MasterBedroom-105249__156058__bed_king-size_bed__solid_001','first__MasterBedroom-105249__156058__bed_king-size_bed__solid_004'].forEach(name=>setMaterial(name, makeBedMaterialMasterUpholstery));
  setMaterial('first__MasterBedroom-105249__156058__bed_king-size_bed__solid_002', makeBedMaterialMasterDuvet);
  setMaterial('first__MasterBedroom-105249__156058__bed_king-size_bed__solid_003', makeBedMaterialMasterAccent);

  // realistic beds - second floor bedroom, visually different from first floor
  ['second__Bedroom-35912__81315__bed_king-size_bed__solid_001','second__Bedroom-35912__81315__bed_king-size_bed__solid_005'].forEach(name=>setMaterial(name, makeBedMaterialSecondHeadboard));
  setMaterial('second__Bedroom-35912__81315__bed_king-size_bed__solid_008', makeBedMaterialSecondAccent);
  ['second__Bedroom-35912__81315__bed_king-size_bed__solid_002','second__Bedroom-35912__81315__bed_king-size_bed__solid_006'].forEach(name=>setMaterial(name, makeBedMaterialSecondDuvet));
  ['second__Bedroom-35912__81315__bed_king-size_bed__solid_003','second__Bedroom-35912__81315__bed_king-size_bed__solid_004','second__Bedroom-35912__81315__bed_king-size_bed__solid_007'].forEach(name=>setMaterial(name, makeBedMaterialSecondPillows));

  // more realistic light-gray fabric sofa on second floor
  setMaterial('second__LivingRoom-39392__50216__sofa_multi_seat_sofa__solid_001', makeSofaRealisticLightGray);

  // 6) media unit white uniform for selected slots
  const mediaTargets = new Set([
    'first__LivingDiningRoom-116276__165792__media_unit_floor-based_media_unit__solid_015',
    'first__LivingDiningRoom-116276__165792__media_unit_floor-based_media_unit__solid_016'
  ]);
  assignMaterial(meshesByPredicate(name => mediaTargets.has(name)), () => makeWhiteUniform());

  // Internal walls: warm off-white, visually distinct from pure-white furniture.
  assignMaterial(meshesByPredicate(name => name.includes('__WallInner__')), () => makeInteriorWallWhite());

  // Living/dining room details.
  setMaterial('first__LivingDiningRoom-116276__159314__storage_unit_armoire__solid_003', makeWhiteUniform);
  setMaterial('first__LivingDiningRoom-116276__169004__cabinet_wall-attached_cabinet__solid_002', makeWhiteUniform);
  setMaterial('first__LivingDiningRoom-116276__165832__chair_chair__solid_001', () => makePlasticMaterial('#2563eb'));
  setMaterial('first__LivingDiningRoom-116276__165836__chair_chair__solid_001', () => makePlasticMaterial('#2563eb'));
  setMaterial('first__LivingDiningRoom-116276__165822__chair_chair__solid_001', () => makePlasticMaterial('#7dd3fc'));

  // Doors: keep leaves white; built-in normal-door hardware stainless; no hardware on pocket doors.
  assignMaterial(meshesByPredicate(name => name.includes('__door_entry_single_swing_door__solid_002')), () => makeMetalGray());
  meshesByPredicate(name => name.includes('__door_pocket_door__solid_002')).forEach(m => m.visible=false);

  // Other room.
  setMaterial('first__OtherRoom-109066__175671__bed_crib__glass_001', makeWhiteUniform);
  setMaterial('first__OtherRoom-109066__159304__chair_armchair__solid_001', makeBlackFabric);

  // Bathrooms and bedroom.
  setMaterial('first__MasterBathroom-92592__Floor__925921785240859085_092592', makeGrayMarble);
  setMaterial('first__MasterBathroom-92592__149503__shower_shower_screen__solid_002', makeMetalGray);
  setMaterial('first__MasterBedroom-105249__156064__storage_unit_armoire__solid_001', makeMirrorMaterial);
  scaleMeshHeightFromBottom('first__MasterBedroom-105249__156064__storage_unit_armoire__solid_001', .995);
  hideMesh('first__Bathroom-109096__159307__shower_shower_screen__solid_002');
  hideMesh('second__Bathroom-37895__59107__shower_shower_screen__solid_002');

  // Equipment-room cabinet.
  setMaterial('second__EquipmentRoom-36717__61164__cabinet_floor-based_cabinet__solid_002', makeWhiteUniform);
  setMaterial('second__EquipmentRoom-36717__61164__cabinet_floor-based_cabinet__solid_003', makeWhiteUniform);

  // Terrace: remove selected parts, then reduce the whole floor-based outdoor-furniture instance by 10%.
  hideMesh('first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__glass_001');
  hideMesh('first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__solid_005');
  hideMesh('first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__solid_006');
  scaleInstanceAroundCenter('179008', .765);
}
canvas.addEventListener("pointerdown",e=>down={x:e.clientX,y:e.clientY});canvas.addEventListener("pointerup",e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5)pick(e);down=null});$("#close").onclick=clear;$("#copy-code").onclick=async()=>{const value=$("#object-code").value;try{await navigator.clipboard.writeText(value);const btn=$("#copy-code");const old=btn.textContent;btn.textContent="Copiato";setTimeout(()=>btn.textContent=old,1200)}catch{}};document.querySelectorAll("[data-floor]").forEach(b=>b.onclick=()=>setFloor(b.dataset.floor));$("#iso").onclick=()=>fit(false);$("#topview").onclick=()=>fit(true);$("#rotate").onclick=e=>{controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.55;e.currentTarget.classList.toggle("active",controls.autoRotate)};$("#reset").onclick=()=>{controls.autoRotate=false;$("#rotate").classList.remove("active");setFloor(current)};$("#full").onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch{}};$("#list-toggle").onclick=()=>{const panel=$("#object-list");const opening=panel.hidden;if(opening){panel.hidden=false;$("#list-toggle").classList.add("active");$("#object-search").focus();applySearchFilter($("#object-search").value||"")}else{closeObjectList()}};$("#close-list").onclick=closeObjectList;document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeObjectList()}});$("#object-search").addEventListener('input',e=>applySearchFilter(e.target.value));
new GLTFLoader().load("./assets/casa_homestyler.glb?v=27",g=>{prepare(g.scene);setFloor("both");loading.classList.add("hidden")},p=>{if(p.total)progress.textContent=`${Math.round(p.loaded/p.total*100)}%`;else progress.textContent="Download modello…"},e=>{console.error("Errore caricamento modello:",e);loading.classList.add("hidden")});
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight,d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.floor(w*d)||canvas.height!==Math.floor(h*d)){renderer.setPixelRatio(d);renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix()}}function loop(){resize();controls.update();renderer.render(scene,camera);requestAnimationFrame(loop)}loop();
