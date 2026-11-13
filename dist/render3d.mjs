import * as T from './vendor/three.module.js';
import {SIZE,BUILDINGS,hash} from './sim.mjs';
import {terrainSample,REGION_SIZE} from './terrain.mjs';
import {revealProgress,REVEAL_SECONDS} from './reveal.mjs';
import {makeMaterials,buildingModel,treeModel,constructionModel,citizenModel,animalModel,cube,beam,mergeByMaterial} from './models3d.mjs';
import {installDetailedMaterials,makeTransport,routePreview,createPostprocessing,makeSky,makeRiver} from './visuals.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function noise(x,z,seed){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return lerp(lerp(hash(a,b,seed),hash(a+1,b,seed),u),lerp(hash(a,b+1,seed),hash(a+1,b+1,seed),u),v);}
const seasonColors=[{grass:'#7b8655',forest:'#566339',pine:'#5c6944',oak:'#738247',sky:'#aab5ac',sun:'#ffe4b7'},{grass:'#8b8d5a',forest:'#626a3c',pine:'#59653e',oak:'#7c8543',sky:'#b2bdb2',sun:'#ffe6b9'},{grass:'#8d8358',forest:'#726c46',pine:'#626b43',oak:'#a78543',sky:'#b3b8ad',sun:'#ffe1ad'},{grass:'#c9cfc4',forest:'#a5b1a2',pine:'#97a895',oak:'#b5b8a1',sky:'#bdc9c9',sun:'#ecf2ef'}];

export class Renderer{
 constructor(canvas,mini,world){
  this.canvas=canvas;this.mini=mini;this.mc=mini.getContext('2d');this.world=world;this.camera={x:31,y:32};this.zoom=1;this.azimuth=.83;this.elevation=.79;this.hover=null;this.selected=null;this.buildMode=null;this.gatherMode=false;this.width=1;this.height=1;this.lastDay=-1;this.lastSeason=-1;this.lastVisualKey='';this.miniKey='';this.time=0;this.buildingMeshes=new Map();this.people=new Map();this.animalMeshes=[];this.dummy=new T.Object3D();this.raycaster=new T.Raycaster();this.mouse=new T.Vector2();this.quality='high';
  this.gl=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.gl.setPixelRatio(Math.min(devicePixelRatio||1,2));this.gl.shadowMap.enabled=true;this.gl.shadowMap.type=T.PCFSoftShadowMap;this.gl.shadowMap.autoUpdate=false;this.gl.outputColorSpace=T.SRGBColorSpace;this.gl.toneMapping=T.NoToneMapping;this.gl.toneMappingExposure=1.02;this.gl.debug.onShaderError=(gl,program,vertex,fragment)=>{console.error('Error de shader:',gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment));throw new Error('No se han podido compilar los efectos gráficos.');};
  this.scene=new T.Scene();this.scene.background=new T.Color('#aab5ac');this.scene.fog=new T.FogExp2('#aab5ac',.008);
  this.viewCamera=new T.PerspectiveCamera(42,1,.15,210);
  this.sun=new T.DirectionalLight('#ffe4b7',2.5);this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);this.sun.shadow.camera.left=-26;this.sun.shadow.camera.right=26;this.sun.shadow.camera.top=26;this.sun.shadow.camera.bottom=-26;this.sun.shadow.camera.near=.1;this.sun.shadow.camera.far=130;this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.035;this.sun.shadow.radius=2;this.scene.add(this.sun,this.sun.target);
  this.hemi=new T.HemisphereLight('#dce4ed','#696849',1.25);this.scene.add(this.hemi);
  this.materials=makeMaterials();this.detail=installDetailedMaterials(this.materials,()=>{this.gl.shadowMap.needsUpdate=true;});this.post=createPostprocessing(this.gl,1,1);this.sky=makeSky();this.scene.add(this.sky);this.staticGroup=new T.Group();this.scene.add(this.staticGroup);this.buildingsGroup=new T.Group();this.scene.add(this.buildingsGroup);this.villagersGroup=new T.Group();this.scene.add(this.villagersGroup);this.treeInstances=[];this.rockInstances=null;this.regionReveal=null;this.lastPrefetch=0;
  this.selectionMat=new T.MeshBasicMaterial({color:'#e6cf8e',transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide});this.placementMat=this.selectionMat.clone();this.placement=new T.Mesh(new T.PlaneGeometry(1,1),this.placementMat);this.placement.rotation.x=-Math.PI/2;this.placement.renderOrder=10;this.placement.visible=false;this.scene.add(this.placement);this.selection=this.placement.clone();this.selection.material=this.selectionMat;this.scene.add(this.selection);
  this.ghost=null;this.ghostType=null;this.selectedRing=new T.LineLoop(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#e9d5a3',transparent:true,opacity:.8}));this.scene.add(this.selectedRing);
  this.smokeGeo=new T.BufferGeometry();this.smokePos=new Float32Array(500*3);this.smokeGeo.setAttribute('position',new T.BufferAttribute(this.smokePos,3));this.smokeGeo.setDrawRange(0,0);this.smoke=new T.Points(this.smokeGeo,this.materials.smoke);this.smoke.frustumCulled=false;this.scene.add(this.smoke);
  this.makeTerrain();this.makeWater();this.makeVegetation();this.makeRocks();this.makeRoads();this.makeAnimals();this.syncBuildings();this.resize();if(world.cameraPosition)this.focus(world.cameraPosition.x,world.cameraPosition.y);else this.center();this.updateSeason();this.installContextHandlers();this.gl.compile(this.scene,this.viewCamera);this.gl.compile(this.post.scene,this.post.camera);
 }
 installContextHandlers(){this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;let el=document.getElementById('graphics-status');if(el){el.hidden=false;el.textContent='Se ha perdido la conexión con la tarjeta gráfica. Recarga la página para recuperarla.';}});}
 heightAt(x,z){if(this.world.terrainVersion>=2)return terrainSample(x,z,this.world.seedNumber,this.world.coordinates).height;const seed=this.world.seedNumber,river=44+Math.sin(z/7+seed%6)*2.4+Math.cos(z/15)*2,rd=Math.abs(x-river)-1.8,ld=(Math.sqrt(((x-46)/6)**2+((z-49)/7)**2)-1)*6,shore=Math.min(rd,ld),base=.52+(noise(x*.14,z*.14,seed)-.5)*.55+(noise(x*.43,z*.43,seed+3)-.5)*.13;
  const camp=Math.hypot(x-31,z-32),flat=smooth(7,15,camp);let h=.58+(base-.58)*flat;
  const nw=smooth(25,8,x)*smooth(28,9,z),edge=Math.max(smooth(6,-15,x),smooth(58,83,x),smooth(6,-15,z),smooth(58,83,z));
  h+=nw*(2.2+noise(x*.1,z*.1,seed+13)*6.5)+edge*(2.5+noise(x*.075,z*.075,seed+8)*9);
  h+=(noise(x*.3,z*.3,seed+50)-.5)*nw*.6;
  if(shore<1.2)h=lerp(-.75,h,smooth(-1,1.2,shore));
  return h;
 }
 makeTerrain(){const res=224,span=224,ox=this.world.terrainVersion===3?this.world.viewRegion.x*SIZE:0,oz=this.world.terrainVersion===3?this.world.viewRegion.y*SIZE:0;const geo=new T.PlaneGeometry(span,span,res,res);geo.rotateX(-Math.PI/2);const p=geo.getAttribute('position'),colors=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i)+ox+32,z=p.getZ(i)+oz+32;p.setXYZ(i,x,this.heightAt(x,z),z);}geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.computeVertexNormals();this.terrain=new T.Mesh(geo,this.materials.ground);this.terrain.receiveShadow=true;this.terrain.castShadow=false;this.scene.add(this.terrain);this.colorTerrain();}
 colorTerrain(){const p=this.terrain.geometry.getAttribute('position'),colors=this.terrain.geometry.getAttribute('color'),pal=seasonColors[this.world.season],grass=new T.Color(pal.grass),forest=new T.Color(pal.forest),bank=new T.Color(this.world.season===3?'#b6bdb2':'#a39c7c'),rock=new T.Color(this.world.season===3?'#c0c5bc':'#92958a'),color=new T.Color();for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=p.getY(i),n=noise((x+(this.world.coordinates?.x||0)*(this.world.terrainVersion>=2?REGION_SIZE:0))*.22,(z+(this.world.coordinates?.y||0)*(this.world.terrainVersion===2?REGION_SIZE:0))*.22,this.world.seedNumber),fine=noise((x+(this.world.coordinates?.x||0)*(this.world.terrainVersion===2?REGION_SIZE:0))*.85,(z+(this.world.coordinates?.y||0)*(this.world.terrainVersion===2?REGION_SIZE:0))*.85,this.world.seedNumber+28);color.copy(grass).lerp(forest,n*.65).multiplyScalar(.92+fine*.2);if(h<.4)color.lerp(bank,clamp((.42-h)*1.9,0,1));if(h>2)color.lerp(rock,clamp((h-2)/4,0,.9));colors.setXYZ(i,color.r,color.g,color.b);}colors.needsUpdate=true;}
 makeWater(){this.river=makeRiver(this.gl,this.scene,this.heightAt.bind(this));this.water=this.river.mesh;}
 createTreeMeshes(){for(const inst of this.treeInstances){this.staticGroup.remove(inst);inst.geometry.dispose();}this.treeInstances=[];const all=(this.world.renderTiles||this.world.tiles).filter(t=>t.tree&&this.heightAt(t.x+.5,t.y+.5)>.2);this.knownTrees=new Set((this.world.renderTiles||this.world.tiles).filter(t=>t.tree));const lists=[[],[],[]];for(const t of all)lists[t.variant>.55?0:t.variant>.4?1:2].push(t);this.treeTiles=all;
  for(let v=0;v<3;v++){const model=treeModel(this.materials,v),tiles=lists[v];if(!tiles.length)continue;for(const source of model.children){const inst=new T.InstancedMesh(source.geometry,source.material,tiles.length);inst.castShadow=true;inst.receiveShadow=true;inst.instanceMatrix.setUsage(T.DynamicDrawUsage);inst.userData={variant:v,tiles,foliage:source.material!==this.materials.bark};this.staticGroup.add(inst);this.treeInstances.push(inst);}}
 }
 makeVegetation(){this.createTreeMeshes();
  const grassGeo=new T.PlaneGeometry(.28,.36);grassGeo.translate(0,.18,0);this.grassTiles=(this.world.renderTiles||this.world.tiles).filter(t=>t.type==='grass'&&!t.building&&!t.road&&!t.tree&&t.variant>.45);const grassCount=this.grassTiles.length*4;this.grassInst=new T.InstancedMesh(grassGeo,this.materials.grass,Math.max(1,grassCount));this.grassInst.receiveShadow=true;this.grassInst.visible=this.quality==='high';this.staticGroup.add(this.grassInst);let gi=0;for(const t of this.grassTiles)for(let i=0;i<4;i++){const x=t.x+hash(i,t.x),z=t.y+hash(i,t.y,4);this.dummy.position.set(x,this.heightAt(x,z),z);this.dummy.rotation.set(0,hash(i,t.x+t.y)*Math.PI*2,0);this.dummy.scale.setScalar(.55+hash(i,4)*.65);this.dummy.updateMatrix();this.grassInst.setMatrixAt(gi++,this.dummy.matrix);}this.grassInst.instanceMatrix.needsUpdate=true;this.refreshTrees();
 }
 refreshTrees(){if((this.world.renderTiles||this.world.tiles).some(t=>t.tree&&!this.knownTrees.has(t)))this.createTreeMeshes();const pal=seasonColors[this.world.season];for(const inst of this.treeInstances){const {tiles,variant,foliage}=inst.userData;for(let i=0;i<tiles.length;i++){const t=tiles[i],r=hash(t.x,t.y,this.world.seedNumber+65),x=t.x+.25+r*.5,z=t.y+.25+hash(t.y,t.x)*.5,size=.62+r*.5;this.dummy.position.set(x,this.heightAt(x,z),z);this.dummy.rotation.set(0,r*Math.PI*2,0);this.dummy.scale.set(size*(t.tree?1:0),size*(.9+hash(t.x,t.y)*.2)*(t.tree?1:0),size*(t.tree?1:0));this.dummy.updateMatrix();inst.setMatrixAt(i,this.dummy.matrix);const color=new T.Color(foliage?(variant===2?pal.oak:pal.pine):'#d8cfb9');color.multiplyScalar(.78+r*.3);if(t.marked)color.lerp(new T.Color('#d7b261'),.4);inst.setColorAt(i,color);}inst.instanceMatrix.needsUpdate=true;if(inst.instanceColor)inst.instanceColor.needsUpdate=true;inst.computeBoundingSphere();}this.gl.shadowMap.needsUpdate=true;}
 makeRocks(){const tiles=(this.world.renderTiles||this.world.tiles).filter(t=>t.rock);const geom=new T.DodecahedronGeometry(1,1),p=geom.getAttribute('position');for(let i=0;i<p.count;i++){const r=hash(Math.round(p.getX(i)*10),Math.round(p.getY(i)*10),75);p.setXYZ(i,p.getX(i)*(.85+r*.3),p.getY(i)*(.7+r*.5),p.getZ(i)*(.85+r*.3));}geom.computeVertexNormals();this.rockTiles=tiles;this.rockInstances=new T.InstancedMesh(geom,this.materials.rock,Math.max(1,tiles.length));this.rockInstances.castShadow=this.rockInstances.receiveShadow=true;this.staticGroup.add(this.rockInstances);this.refreshRocks();
  // Smaller stones soften the riverbank without changing gameplay terrain.
  const pebbles=(this.world.renderTiles||this.world.tiles).filter(t=>t.type==='grass'&&this.heightAt(t.x+.5,t.y+.5)<.43&&t.variant>.5);const rocks=new T.InstancedMesh(geom,this.materials.rock,Math.max(1,pebbles.length));for(let i=0;i<pebbles.length;i++){const t=pebbles[i],r=t.variant;this.dummy.position.set(t.x+.5,this.heightAt(t.x+.5,t.y+.5),t.y+.5);this.dummy.scale.set(.15+r*.12,.08+r*.09,.13+r*.12);this.dummy.rotation.set(r,r*6,r);this.dummy.updateMatrix();rocks.setMatrixAt(i,this.dummy.matrix);}rocks.receiveShadow=true;this.staticGroup.add(rocks);}
 refreshGrass(){let i=0;for(const t of this.grassTiles)for(let j=0;j<4;j++){const x=t.x+hash(j,t.x),z=t.y+hash(j,t.y,4);this.dummy.position.set(x,this.heightAt(x,z),z);this.dummy.rotation.set(0,hash(j,t.x+t.y)*Math.PI*2,0);this.dummy.scale.setScalar(t.building||t.road||t.tree?0:.55+hash(j,4)*.65);this.dummy.updateMatrix();this.grassInst.setMatrixAt(i++,this.dummy.matrix);}this.grassInst.instanceMatrix.needsUpdate=true;}
 refreshRocks(){for(let i=0;i<this.rockTiles.length;i++){const t=this.rockTiles[i],r=t.variant,size=(t.type==='hill'?.45:.22)+r*.3;this.dummy.position.set(t.x+.5,this.heightAt(t.x+.5,t.y+.5),t.y+.5);this.dummy.rotation.set(r*.4,r*8,r*.2);this.dummy.scale.set(size*(t.rock?1:0),size*(t.rock?.75:0),size*(t.rock?1.1:0));this.dummy.updateMatrix();this.rockInstances.setMatrixAt(i,this.dummy.matrix);}this.rockInstances.instanceMatrix.needsUpdate=true;}
 makeRoads(){if(this.roadsGroup){this.staticGroup.remove(this.roadsGroup);this.disposeGroup(this.roadsGroup);}this.roadsGroup=makeTransport(this.world,this.materials,this.heightAt.bind(this));this.bridgeHeights=this.roadsGroup.userData.bridgeHeights;this.staticGroup.add(this.roadsGroup);this.gl.shadowMap.needsUpdate=true;}
 makeAnimals(){const ox=this.world.terrainVersion===3?this.world.viewRegion.x*SIZE:0,oz=this.world.terrainVersion===3?this.world.viewRegion.y*SIZE:0;for(let i=0;i<7;i++){const g=animalModel(this.materials,'deer');g.userData={x:ox+23+hash(i,45+ox,this.world.seedNumber)*12,z:oz+20+hash(i,8+oz,this.world.seedNumber)*6,phase:i};this.scene.add(g);this.animalMeshes.push(g);}}
 syncBuildings(){let changed=false;const local=this.world.terrainVersion===3?this.world.buildings.filter(b=>b.x+b.w>=this.world.viewRegion.x*SIZE-64&&b.x<this.world.viewRegion.x*SIZE+SIZE+64&&b.y+b.h>=this.world.viewRegion.y*SIZE-64&&b.y<this.world.viewRegion.y*SIZE+SIZE+64):this.world.buildings;for(const [id,obj]of this.buildingMeshes)if(!local.some(b=>b.id===id)){this.buildingsGroup.remove(obj);this.disposeGroup(obj);this.buildingMeshes.delete(id);changed=true;}
  for(const b of local){let o=this.buildingMeshes.get(b.id);const signature=`${b.progress>=1}-${b.type==='farm'?this.world.season:0}`;if(o&&o.userData.signature===signature)continue;if(o){this.buildingsGroup.remove(o);this.disposeGroup(o);}o=b.progress<1?constructionModel(b,this.materials):buildingModel(b.type,this.materials,this.world.season,b.id);const smoke=o.userData.smoke;o.userData={buildingId:b.id,signature,smoke};o.position.set(b.x+b.w/2,this.heightAt(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);
   const base=new T.Mesh(new T.PlaneGeometry(b.w+1,b.h+1),this.materials.soft);base.rotation.x=-Math.PI/2;base.position.y=.008;base.renderOrder=1;o.add(base);this.buildingsGroup.add(o);this.buildingMeshes.set(b.id,o);changed=true;}
  if(changed)this.gl.shadowMap.needsUpdate=true;
 }
 syncPeople(time){const local=this.world.terrainVersion===3?this.world.citizens.filter(c=>Math.abs(c.x-this.camera.x)<55&&Math.abs(c.y-this.camera.y)<55):this.world.citizens;for(const [id,obj]of this.people)if(!local.some(c=>c.id===id)){this.villagersGroup.remove(obj);this.disposeGroup(obj);this.people.delete(id);}for(const c of local){let obj=this.people.get(c.id);if(!obj){obj=citizenModel(this.materials,c.color);this.people.set(c.id,obj);this.villagersGroup.add(obj);}const t=this.world.tile(c.x,c.y),height=t?.bridge ? this.bridgeHeights.get(t.y*SIZE+t.x)??.65 : this.heightAt(c.x,c.y);obj.position.set(c.x,height+.015,c.y);if(c.path.length){obj.rotation.y=Math.atan2(c.path[0].x-c.x,c.path[0].y-c.y);const p=this.world.speed?Math.sin(time*9+c.id)*.5:0;obj.userData.limbs.forEach((l,i)=>l.rotation.x=i%2?p:-p);}else obj.userData.limbs.forEach(l=>l.rotation.x=0);}}
 resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.gl.setSize(r.width,r.height,false);this.post?.resize(Math.max(1,Math.round(r.width*this.gl.getPixelRatio())),Math.max(1,Math.round(r.height*this.gl.getPixelRatio())));this.viewCamera.aspect=r.width/Math.max(1,r.height);this.viewCamera.updateProjectionMatrix();this.updateCamera();}
 center(){this.camera={x:31.5,y:32.5};this.zoom=1;this.azimuth=.83;this.elevation=.79;this.updateCamera();}
 iso(x,y){return {x,y};}
 focus(x,y){this.camera={x,y};this.clampCamera();this.updateCamera();}
 updateCamera(){this.streamRegion();const target=new T.Vector3(this.camera.x,this.heightAt(this.camera.x,this.camera.y)+.3,this.camera.y),distance=28/this.zoom,horizontal=Math.cos(this.elevation)*distance;this.viewCamera.position.set(target.x+Math.sin(this.azimuth)*horizontal,target.y+Math.sin(this.elevation)*distance,target.z+Math.cos(this.azimuth)*horizontal);this.viewCamera.lookAt(target);this.viewCamera.updateMatrixWorld();this.sky.position.set(target.x,0,target.z);this.sun.position.set(target.x-22,35,target.z+14);this.sun.target.position.copy(target);this.sun.target.updateMatrixWorld();this.gl.shadowMap.needsUpdate=true;}
 setZoom(z,sx=this.width/2,sy=this.height/2){const before=this.unproject(sx,sy);this.zoom=clamp(z,.38,3.4);this.updateCamera();const after=this.unproject(sx,sy);if(Number.isFinite(before.x)&&Number.isFinite(after.x)){this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;this.clampCamera();this.updateCamera();}}
 rotate(dx,dy=0){this.azimuth-=dx*.007;this.elevation=clamp(this.elevation+dy*.004,.27,1.32);this.updateCamera();}
 pan(dx,dy){const scale=(28/this.zoom)*.75/Math.max(1,this.height),a=this.azimuth;this.camera.x-=Math.cos(a)*dx*scale+Math.sin(a)*dy*scale/Math.sin(this.elevation);this.camera.y-=(-Math.sin(a))*dx*scale+Math.cos(a)*dy*scale/Math.sin(this.elevation);this.clampCamera();this.updateCamera();}
 clampCamera(){if(this.world.terrainVersion!==3){this.camera.x=clamp(this.camera.x,3,SIZE-3);this.camera.y=clamp(this.camera.y,3,SIZE-3);}else{const limit=100000000;this.camera.x=clamp(this.camera.x,-limit,limit);this.camera.y=clamp(this.camera.y,-limit,limit);}}
 // Cada transición conserva el relieve anterior y mezcla lentamente la zona nueva.
 fadeObjects(roots,opacity){
  const originals=[],clones=new Map();
  for(const root of roots){
   root.traverse(obj=>{
    if(!obj.material)return;
    const original=obj.material,fade=material=>{
     if(!clones.has(material)){
      const copy=material.clone();copy.transparent=true;copy.depthWrite=false;copy.opacity=opacity;copy.needsUpdate=true;
      clones.set(material,copy);
     }
     return clones.get(material);
    };
    obj.material=Array.isArray(original)?original.map(fade):fade(original);
    originals.push({obj,original});
   });
  }
  return {originals,materials:[...clones.values()]};
 }
 finishRegionReveal(){
  const reveal=this.regionReveal;if(!reveal)return;
  for(const {obj,original} of reveal.incoming.originals)obj.material=original;
  for(const mat of reveal.incoming.materials)mat.dispose();
  this.scene.remove(reveal.oldGroup,reveal.oldTerrain);
  this.disposeGroup(reveal.oldGroup);reveal.oldTerrain.geometry.dispose();
  for(const mat of reveal.outgoing.materials)mat.dispose();
  this.regionReveal=null;this.gl.shadowMap.needsUpdate=true;
 }
 updateRegionReveal(time){
  if(!this.regionReveal)return;
  const fraction=revealProgress(time-this.regionReveal.started);
  for(const mat of this.regionReveal.incoming.materials)mat.opacity=fraction;
  for(const mat of this.regionReveal.outgoing.materials)mat.opacity=1-fraction;
  if(fraction>=1)this.finishRegionReveal();
 }
 // Los sectores vecinos se precargan de uno en uno entre fotogramas.
 streamRegion(){
  if(this.world.terrainVersion!==3)return;
  const rx=Math.floor(this.camera.x/SIZE),ry=Math.floor(this.camera.y/SIZE);
  if(!this.world.setViewRegion(rx,ry))return;
  this.finishRegionReveal();
  const oldGroup=this.staticGroup,oldTerrain=this.terrain;
  this.staticGroup=new T.Group();this.scene.add(this.staticGroup);
  this.treeInstances=[];this.grassInst=null;this.rockInstances=null;this.roadsGroup=null;
  this.terrain=null;
  for(const o of this.animalMeshes){this.scene.remove(o);this.disposeGroup(o);}this.animalMeshes=[];
  this.makeTerrain();this.makeVegetation();this.makeRocks();this.makeRoads();this.makeAnimals();
  this.syncBuildings();this.river.refreshBed(this.heightAt.bind(this),{x:rx*SIZE+32,y:ry*SIZE+32});
  this.regionReveal={
   started:this.time,
   oldGroup,oldTerrain,
   outgoing:this.fadeObjects([oldGroup,oldTerrain],1),
   incoming:this.fadeObjects([this.staticGroup,this.terrain],0)
  };
  this.linePreview=null;this.linePreviewKey='';this.lastVisualKey='';this.lastDay=-1;this.miniKey='';
 }
 ray(sx,sy){this.mouse.set(sx/this.width*2-1,1-sy/this.height*2);this.raycaster.setFromCamera(this.mouse,this.viewCamera);return this.raycaster;}
 unproject(sx,sy){const ray=this.ray(sx,sy),point=new T.Vector3();const plane=new T.Plane(new T.Vector3(0,1,0),-.58);if(!ray.ray.intersectPlane(plane,point))return {x:this.camera.x,y:this.camera.y};return {x:point.x,y:point.z};}
 pick(sx,sy){const hits=this.ray(sx,sy).intersectObject(this.terrain,false);if(hits.length){const p=hits[0].point;return {x:Math.floor(p.x),y:Math.floor(p.z)};}return {x:-1,y:-1};}
 pickBuilding(sx,sy){const hits=this.ray(sx,sy).intersectObjects([...this.buildingMeshes.values()],true);for(const hit of hits){let o=hit.object;while(o&&!o.userData.buildingId)o=o.parent;if(o?.userData.buildingId)return o.userData.buildingId;}const t=this.pick(sx,sy);return this.world.tile(t.x,t.y)?.building||null;}
 updateSelection(){
  const plan=this.linePreview,key=plan?`${plan.type}:${plan.start.x},${plan.start.y}:${plan.end.x},${plan.end.y}:${plan.ok}:${plan.count}`:'';
  if(key!==this.linePreviewKey){if(this.routeGroup){this.scene.remove(this.routeGroup);this.disposeGroup(this.routeGroup,true);this.routeGroup=null;}if(plan){this.routeGroup=routePreview(plan,this.heightAt.bind(this),this.bridgeHeights);this.scene.add(this.routeGroup);}this.linePreviewKey=key;}
  const b=this.world.buildings.find(b=>b.id===this.selected);this.selection.visible=!!b;if(b){this.selection.position.set(b.x+b.w/2,this.heightAt(b.x+b.w/2,b.y+b.h/2)+.024,b.y+b.h/2);this.selection.scale.set(b.w+.12,b.h+.12,1);}
  const t=this.hover;this.placement.visible=!plan&&!!t&&(!!this.buildMode||this.gatherMode)&&!!this.world.tile(t.x,t.y);if(this.placement.visible){const d=this.buildMode?BUILDINGS[this.buildMode]:{w:1,h:1};const ok=this.buildMode?this.world.canPlace(this.buildMode,t.x,t.y).ok:(this.world.tile(t.x,t.y)?.tree||this.world.tile(t.x,t.y)?.rock);this.placementMat.color.set(ok?'#c0d48c':'#db8465');this.placement.scale.set(d.w,d.h,1);this.placement.position.set(t.x+d.w/2,Math.max(.06,this.heightAt(t.x+d.w/2,t.y+d.h/2)+.04),t.y+d.h/2);
   if(this.buildMode&&BUILDINGS[this.buildMode].days){if(this.ghostType!==this.buildMode){if(this.ghost){this.scene.remove(this.ghost);this.disposeGroup(this.ghost,true);}this.ghost=buildingModel(this.buildMode,this.materials,this.world.season);this.ghost.traverse(o=>{if(o.isMesh){o.material=new T.MeshBasicMaterial({color:'#bed296',transparent:true,opacity:.33,depthWrite:false,side:T.DoubleSide});o.castShadow=false;}});this.ghostType=this.buildMode;this.scene.add(this.ghost);}this.ghost.visible=true;this.ghost.position.copy(this.placement.position);this.ghost.traverse(o=>{if(o.isMesh)o.material.color.set(ok?'#c3d9a2':'#df987e');});}else if(this.ghost)this.ghost.visible=false;
  }else if(this.ghost)this.ghost.visible=false;
  this.selectedRing.visible=!!b&&['gatherer','forester'].includes(b.type);if(this.selectedRing.visible){const points=[];for(let i=0;i<65;i++){const a=i/64*Math.PI*2,x=b.x+b.w/2+Math.cos(a)*7,z=b.y+b.h/2+Math.sin(a)*7;points.push(new T.Vector3(x,this.heightAt(x,z)+.04,z));}this.selectedRing.geometry.dispose();this.selectedRing.geometry=new T.BufferGeometry().setFromPoints(points);}
 }
 updateSeason(){const s=this.world.season,p=seasonColors[s];this.lastSeason=s;this.scene.background.set(p.sky);this.scene.fog.color.set(p.sky);this.sun.color.set(p.sun);this.sun.intensity=s===3?1.8:2.5;this.water.material.uniforms.uCold.value=s===3?1:0;this.water.material.uniforms.uSky.value.set(p.sky);this.materials.grass.color.set(s===3?'#c3c9b8':s===2?'#9c8c58':'#8a965d');this.materials.roof.color.set(s===3?'#f1f0e7':'#d5cabb');this.sky.material.uniforms.uHorizon.value.set(p.sky);this.sky.material.uniforms.uCold.value=s===3?1:0;this.materials.thatch.color.set(s===3?'#d6d8c8':'#c5b382');this.colorTerrain();this.refreshTrees();this.syncBuildings();this.miniKey='';}
 invalidate(){this.lastDay=-1;this.lastVisualKey='';this.miniKey='';}
 setQuality(q){this.quality=q;this.gl.setPixelRatio(q==='high'?Math.min(devicePixelRatio||1,2):1);this.gl.shadowMap.enabled=q!=='low';const shadowSize=q==='high'?4096:q==='medium'?2048:1024;if(this.sun.shadow.mapSize.x!==shadowSize){this.sun.shadow.mapSize.set(shadowSize,shadowSize);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}this.grassInst.visible=q==='high';this.post.uniforms.uAO.value=q==='low'?0:q==='high'?1:.65;this.river.quality=q;this.resize();this.gl.shadowMap.needsUpdate=true;}
 draw(time){if(this.contextLost)return;this.time=time;this.updateRegionReveal(time);if(this.world.terrainVersion===3&&time-this.lastPrefetch>.10){this.world.chunks.prefetchNext(1);this.lastPrefetch=time;}if(this.lastSeason!==this.world.season)this.updateSeason();if(this.lastDay!==this.world.totalDays||!this.lastVisualKey){const key=this.world.buildings.map(b=>b.id+':'+(b.progress>=1)).join(',')+'-'+(this.world.renderTiles||this.world.tiles).filter(t=>t.road||t.bridge).length;this.syncBuildings();this.refreshTrees();this.refreshRocks();this.refreshGrass();if(key!==this.lastVisualKey){this.makeRoads();this.lastVisualKey=key;}this.lastDay=this.world.totalDays;}
  this.syncPeople(time);this.updateSelection();this.detail.wind.value=time;this.sky.material.uniforms.uTime.value=time;this.water.material.uniforms.uTime.value=time;this.water.material.uniforms.uEye.value.copy(this.viewCamera.position);
  let si=0;for(const o of this.buildingMeshes.values()){const smoke=o.userData.smoke;if(!smoke)continue;for(let i=0;i<7&&si<500;i++){const age=(time*.15+i/7)%1;this.smokePos[si*3]=o.position.x+smoke[0]+age*.55+Math.sin(age*6)*.12;this.smokePos[si*3+1]=o.position.y+smoke[1]+age*1.8;this.smokePos[si*3+2]=o.position.z+smoke[2]+age*.2;si++;}}this.smokeGeo.getAttribute('position').needsUpdate=true;this.smokeGeo.setDrawRange(0,si);
  for(const obj of this.animalMeshes){const d=obj.userData,x=d.x+Math.sin(time*.07+d.phase)*.7,z=d.z+Math.cos(time*.05+d.phase)*.5;obj.position.set(x,this.heightAt(x,z),z);obj.rotation.y=Math.sin(time*.02+d.phase)*2;}
  this.river.update(this.viewCamera,time);this.post.render(this.scene,this.viewCamera);if(time-(this.lastMini||0)>.25){this.drawMini();this.lastMini=time;}
 }
 drawMini(){
  const c=this.mc,w=this.world,p=seasonColors[w.season],rx=w.terrainVersion===3?w.viewRegion.x*SIZE:0,ry=w.terrainVersion===3?w.viewRegion.y*SIZE:0;
  const key=`${w.season}-${rx},${ry}-${w.buildings.length}-${w.totalDays}-${this.lastVisualKey}`;
  if(key!==this.miniKey){
   const ca=document.createElement('canvas');ca.width=SIZE;ca.height=SIZE;const ctx=ca.getContext('2d');
   for(const t of w.tiles){ctx.fillStyle=t.building?'#d3c19a':t.bridge?'#baab83':t.type==='water'?'#668f91':t.type==='hill'?'#939889':t.road?'#b2a889':t.tree?p.forest:p.grass;ctx.fillRect(t.x-rx,t.y-ry,1,1);}
   this.miniCache=ca;this.miniKey=key;
  }
  c.imageSmoothingEnabled=false;c.drawImage(this.miniCache,0,0,160,160);
  const corners=[this.unproject(0,0),this.unproject(this.width,0),this.unproject(this.width,this.height),this.unproject(0,this.height)];
  c.beginPath();corners.forEach((point,i)=>i?c.lineTo((point.x-rx)*2.5,(point.y-ry)*2.5):c.moveTo((point.x-rx)*2.5,(point.y-ry)*2.5));
  c.closePath();c.fillStyle='#f3edd911';c.fill();c.strokeStyle='#e8dfb5b0';c.lineWidth=1;c.stroke();
  c.fillStyle='#f3ddaa';c.beginPath();c.arc((this.camera.x-rx)*2.5,(this.camera.y-ry)*2.5,2,0,7);c.fill();
 }
 disposeGroup(group,materials=false){group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(materials&&o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
 setWorld(w){this.finishRegionReveal();for(const o of [...this.staticGroup.children]){this.disposeGroup(o);this.staticGroup.remove(o);}for(const o of [...this.buildingsGroup.children]){this.disposeGroup(o);this.buildingsGroup.remove(o);}for(const o of [...this.villagersGroup.children]){this.disposeGroup(o);this.villagersGroup.remove(o);}for(const o of this.animalMeshes){this.scene.remove(o);this.disposeGroup(o);}this.animalMeshes=[];this.buildingMeshes.clear();this.people.clear();this.treeInstances=[];this.scene.remove(this.terrain);this.terrain.geometry.dispose();this.world=w;this.linePreview=null;this.river.refreshBed(this.heightAt.bind(this),{x:w.terrainVersion===3?w.viewRegion.x*SIZE+32:32,y:w.terrainVersion===3?w.viewRegion.y*SIZE+32:32});this.selected=null;this.buildMode=null;this.gatherMode=false;this.lastDay=-1;this.lastSeason=-1;this.lastVisualKey='';this.makeTerrain();this.makeVegetation();this.makeRocks();this.makeRoads();this.makeAnimals();this.syncBuildings();this.updateSeason();if(w.cameraPosition)this.focus(w.cameraPosition.x,w.cameraPosition.y);else this.center();this.invalidate();}
}
