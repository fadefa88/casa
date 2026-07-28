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
    if(!mesh.visible || !name.includes('__door_')) return;
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
function prepare(root){const items=[];root.traverse(o=>{if(!o.isMesh)return;items.push(o);o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.side=THREE.DoubleSide;m.needsUpdate=true})});for(const o of items){const n=o.name||o.parent?.name||"";(n.startsWith("first__")?first:second).attach(o)}allMeshes=items;applyCustomOverrides();addDoorHardware();buildObjectIndex()}
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
function buildObjectIndex(){const map=new Map();for(const mesh of allMeshes){if(mesh.visible===false) continue; const meta=parseParts(mesh.name||"");const key=meta.raw||mesh.uuid;if(!map.has(key)){map.set(key,{mesh,meta,text:`${meta.title} ${meta.slot} ${meta.roomCode} ${meta.instanceId} ${meta.raw}`.toLowerCase()})}}allEntries=[...map.values()].sort((a,b)=>a.meta.title.localeCompare(b.meta.title));applySearchFilter("")}
function applySearchFilter(term){const results=$("#object-results"); if(!results) return; const q=(term||"").trim().toLowerCase(); results.innerHTML=""; const filtered=allEntries.filter(entry=>{if(current==="first"&&entry.meta.floorCode!=="first")return false; if(current==="second"&&entry.meta.floorCode!=="second")return false; return !q || entry.text.includes(q)}); $("#object-count").textContent=`${filtered.length} oggetti`; filtered.slice(0,400).forEach(entry=>{const btn=document.createElement('button'); btn.className='object-item'; btn.innerHTML=`<strong>${entry.meta.title}</strong><small>${floorLabel(entry.meta.floorCode)} · ${entry.meta.roomCode || '-'} · ${entry.meta.slot}</small>`; btn.onclick=()=>{selectObject(entry.mesh);focusObject(entry.mesh);closeObjectList();$("#info").hidden=false}; results.appendChild(btn)}); if(filtered.length>400){const more=document.createElement('div'); more.className='object-count'; more.textContent='Mostrati solo i primi 400 risultati. Affina la ricerca.'; results.appendChild(more)}}
function meshesByPredicate(pred){ return allMeshes.filter(m=>pred(m.name||"", m)); }
function assignMaterial(meshes, materialFactory){ meshes.forEach((mesh, idx)=>{ const mat=materialFactory(mesh, idx); if(mat) mesh.material=mat; }); }
function cloneMaterialPreservingTextures(sourceMesh){ const src=Array.isArray(sourceMesh.material)?sourceMesh.material[0]:sourceMesh.material; return src?.clone ? src.clone() : src; }

function getMesh(name){ return allMeshes.find(m => m.name === name); }
function getMeshesByNames(names){ const set=new Set(names); return allMeshes.filter(m => set.has(m.name)); }
function hideByNames(names){ getMeshesByNames(names).forEach(m => m.visible=false); }
function scaleGeometryAboutCenter(mesh, fx=1, fy=1, fz=1){
  if(!mesh?.geometry?.attributes?.position) return;
  const geom=mesh.geometry.clone(); geom.computeBoundingBox();
  const bb=geom.boundingBox; const c=bb.getCenter(new THREE.Vector3());
  const pos=geom.attributes.position;
  for(let i=0;i<pos.count;i++){
    pos.setXYZ(i, c.x + (pos.getX(i)-c.x)*fx, c.y + (pos.getY(i)-c.y)*fy, c.z + (pos.getZ(i)-c.z)*fz);
  }
  pos.needsUpdate=true; geom.computeVertexNormals(); geom.computeBoundingBox(); mesh.geometry=geom;
}
function widenAndThicken(mesh, widen=1.04, thicken=1.8){
  if(!mesh?.geometry?.boundingBox) mesh?.geometry?.computeBoundingBox?.();
  const bb=mesh?.geometry?.boundingBox; if(!bb) return;
  const size=bb.getSize(new THREE.Vector3());
  const widthAxis = size.x >= size.z ? 'x' : 'z';
  const depthAxis = widthAxis === 'x' ? 'z' : 'x';
  const fx = widthAxis === 'x' ? widen : thicken;
  const fz = widthAxis === 'z' ? widen : thicken;
  scaleGeometryAboutCenter(mesh, fx, 1, fz);
}
function alignMeshCenterOnBase(target, base){
  if(!target || !base) return;
  target.updateWorldMatrix(true,false); base.updateWorldMatrix(true,false);
  const tb=new THREE.Box3().setFromObject(target), bb=new THREE.Box3().setFromObject(base);
  const bs=bb.getSize(new THREE.Vector3()), tc=tb.getCenter(new THREE.Vector3()), bc=bb.getCenter(new THREE.Vector3());
  const axis = bs.x >= bs.z ? 'x' : 'z'; const delta = bc[axis] - tc[axis];
  target.position[axis] += delta;
}
function scaleInstanceUniform(instanceId, factor=0.9){
  const meshes=allMeshes.filter(m => (m.name||'').includes(`__${instanceId}__`));
  if(!meshes.length) return;
  const box=new THREE.Box3(); meshes.forEach(m => box.expandByObject(m));
  const center=box.getCenter(new THREE.Vector3());
  meshes.forEach(m => {
    const worldPos=new THREE.Vector3(); m.getWorldPosition(worldPos);
    const newWorld=worldPos.sub(center).multiplyScalar(factor).add(center);
    const parent=m.parent; const local=parent ? parent.worldToLocal(newWorld.clone()) : newWorld;
    if(parent) m.position.copy(local); else m.position.copy(newWorld);
    m.scale.multiplyScalar(factor);
  });
}
function makeBlackFabric(){ return new THREE.MeshPhysicalMaterial({color:0x222326, roughness:.97, metalness:0.0, map:makeFabricTexture('#2b2d31','#16181b'), side:THREE.DoubleSide}); }
function makeGrayMarble(){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,256,256); g.addColorStop(0,'#d4d6d8'); g.addColorStop(.5,'#b7babd'); g.addColorStop(1,'#9ea3a7');
  ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
  for(let i=0;i<26;i++){
    ctx.strokeStyle=`rgba(255,255,255,${0.18 + Math.random()*0.14})`; ctx.lineWidth=1+Math.random()*2; ctx.beginPath();
    let x=Math.random()*256, y=Math.random()*256; ctx.moveTo(x,y);
    for(let j=0;j<6;j++){ x += (Math.random()-.5)*80; y += (Math.random()-.5)*40; ctx.lineTo(x,y); }
    ctx.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2);
  return new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:.36, metalness:0.0, map:tex, side:THREE.DoubleSide});
}
function makeMirrorMaterial(){ return new THREE.MeshPhysicalMaterial({color:0xf3f6fa, roughness:.04, metalness:1.0, envMapIntensity:1.6, side:THREE.DoubleSide}); }
function applyCustomOverrides(){
  // living room shelf same texture as kitchen cabinet
  const sourceCabinet = getMesh('first__LivingDiningRoom-116276__169003__cabinet_floor-based_kitchen_cabinet__solid_001');
  const targetShelf = getMesh('first__LivingDiningRoom-116276__172324__shelf_decorative_shelf__solid_001');
  if(sourceCabinet && targetShelf){ const mat = cloneMaterialPreservingTextures(sourceCabinet); if(mat) targetShelf.material = mat; }

  // kitchen cabinets / alignment
  hideByNames(['first__LivingDiningRoom-116276__169003__cabinet_floor-based_kitchen_cabinet__solid_004']);
  ['first__LivingDiningRoom-116276__169004__cabinet_wall-attached_cabinet__solid_002','first__LivingDiningRoom-116276__169004__cabinet_wall-attached_cabinet__solid_003'].forEach(name=>{ const m=getMesh(name); if(m) m.material=makeWhiteUniform(); });
  alignMeshCenterOnBase(getMesh('first__LivingDiningRoom-116276__169003__cabinet_floor-based_kitchen_cabinet__solid_006'), sourceCabinet);

  // white plastic chairs around dining table
  const whiteChairInstances = ['175690','175676','172338','172345','172348','172351','172354','172357'];
  assignMaterial(meshesByPredicate(name => whiteChairInstances.some(id => name.includes(`__${id}__chair_chair__`))), () => makeWhiteUniform());

  // blue plastic chairs complete shells/bases
  const blueInstances = ['165836','165832'];
  assignMaterial(meshesByPredicate(name => blueInstances.some(id => name.includes(`__${id}__chair_chair__`)) && (name.endsWith('__solid_001') || name.endsWith('__solid_002') || name.endsWith('__solid_003'))), () => makePlasticMaterial('#2563eb'));

  // light-blue chair complete shells/bases
  assignMaterial(meshesByPredicate(name => name.includes('__165822__chair_chair__') && (name.endsWith('__solid_001') || name.endsWith('__solid_002') || name.endsWith('__solid_003'))), () => makePlasticMaterial('#7dd3fc'));

  // sofa / media unit
  assignMaterial(meshesByPredicate(name => name === 'first__LivingDiningRoom-116276__165791__sofa_type_L_sofa__solid_002'), () => makeFabricGray());
  const mediaTargets = new Set(['first__LivingDiningRoom-116276__165792__media_unit_floor-based_media_unit__solid_015','first__LivingDiningRoom-116276__165792__media_unit_floor-based_media_unit__solid_016']);
  assignMaterial(meshesByPredicate(name => mediaTargets.has(name)), () => makeWhiteUniform());

  // remove all pocket doors
  meshesByPredicate(name => name.includes('__door_pocket_door__')).forEach(m => m.visible=false);

  // all swing doors stainless satin
  assignMaterial(meshesByPredicate(name => name.includes('__door_entry_single_swing_door__')), () => makeMetalGray());

  // crib white
  const crib = getMesh('first__OtherRoom-109066__175671__bed_crib__glass_001'); if(crib) crib.material = makeWhiteUniform();

  // armchair black fabric
  const armchair = getMesh('first__OtherRoom-109066__159304__chair_armchair__solid_001'); if(armchair) armchair.material = makeBlackFabric();

  // master bathroom floor grayer marble
  const mbFloor = getMesh('first__MasterBathroom-92592__Floor__925921785240859085_092592'); if(mbFloor) mbFloor.material = makeGrayMarble();

  // shower frame steel / walk-in showers
  const masterBathShower = getMesh('first__MasterBathroom-92592__149503__shower_shower_screen__solid_002'); if(masterBathShower) masterBathShower.material = makeMetalGray();
  hideByNames(['first__Bathroom-109096__159307__shower_shower_screen__solid_002','second__Bathroom-37895__59107__shower_shower_screen__solid_002']);

  // mirror wardrobe
  const wardrobeMirror = getMesh('first__MasterBedroom-105249__156064__storage_unit_armoire__solid_001'); if(wardrobeMirror) wardrobeMirror.material = makeMirrorMaterial();

  // equipment room cabinet white parts
  ['second__EquipmentRoom-36717__61164__cabinet_floor-based_cabinet__solid_002','second__EquipmentRoom-36717__61164__cabinet_floor-based_cabinet__solid_003'].forEach(name=>{ const m=getMesh(name); if(m) m.material = makeWhiteUniform(); });

  // terrace outdoor furniture - remove selected pieces and shrink 10%
  hideByNames([
    'first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__glass_001',
    'first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__solid_006',
    'first__Terrace-101880__179008__outdoor_furniture_outdoor_furniture_-_floor-based__solid_005'
  ]);
  scaleInstanceUniform('179008', 0.9);

  // master bathroom shower screen steel
  const mbShowerSteel = getMesh('first__MasterBathroom-92592__149503__shower_shower_screen__solid_002'); if(mbShowerSteel) mbShowerSteel.material = makeMetalGray();

  // windows / openings corrections
  ['second__none__Component__43352ParametricOpening-43352_308_308_143352','second__none__Component__43352ParametricOpening-43352_413_413_143352'].forEach(name=>{ const m=getMesh(name); if(m) widenAndThicken(m,1.06,1.22); });
  ['first__none__ParametricOpening__366281785234406370_036628','first__MasterBedroom-105249__OrdinaryWindow__43351ParametricOpening-43351_122_122_143351'].forEach(name=>{ const m=getMesh(name); if(m) widenAndThicken(m,1.03,2.15); });
  ['second__none__ParametricOpening__366281785234406370_036628','second__Terrace-42789__ParametricOpening__366281785234406370_036628'].forEach(name=>{ const m=getMesh(name); if(m) widenAndThicken(m,1.02,2.25); });
}
canvas.addEventListener("pointerdown",e=>down={x:e.clientX,y:e.clientY});canvas.addEventListener("pointerup",e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5)pick(e);down=null});$("#close").onclick=clear;$("#copy-code").onclick=async()=>{const value=$("#object-code").value;try{await navigator.clipboard.writeText(value);const btn=$("#copy-code");const old=btn.textContent;btn.textContent="Copiato";setTimeout(()=>btn.textContent=old,1200)}catch{}};document.querySelectorAll("[data-floor]").forEach(b=>b.onclick=()=>setFloor(b.dataset.floor));$("#iso").onclick=()=>fit(false);$("#topview").onclick=()=>fit(true);$("#rotate").onclick=e=>{controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.55;e.currentTarget.classList.toggle("active",controls.autoRotate)};$("#reset").onclick=()=>{controls.autoRotate=false;$("#rotate").classList.remove("active");setFloor(current)};$("#full").onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch{}};$("#list-toggle").onclick=()=>{const panel=$("#object-list");const opening=panel.hidden;if(opening){panel.hidden=false;$("#list-toggle").classList.add("active");$("#object-search").focus();applySearchFilter($("#object-search").value||"")}else{closeObjectList()}};$("#close-list").onclick=closeObjectList;document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeObjectList()}});$("#object-search").addEventListener('input',e=>applySearchFilter(e.target.value));
new GLTFLoader().load("./assets/casa_homestyler.glb?v=17",g=>{prepare(g.scene);setFloor("both");loading.classList.add("hidden")},p=>{if(p.total)progress.textContent=`${Math.round(p.loaded/p.total*100)}%`;else progress.textContent="Download modello…"},e=>{console.error("Errore caricamento modello:",e);loading.classList.add("hidden")});
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight,d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.floor(w*d)||canvas.height!==Math.floor(h*d)){renderer.setPixelRatio(d);renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix()}}function loop(){resize();controls.update();renderer.render(scene,camera);requestAnimationFrame(loop)}loop();
