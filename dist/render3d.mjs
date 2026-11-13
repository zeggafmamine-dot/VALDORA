import * as T from './vendor/three.module.js';
import {SIZE,BUILDINGS,hash} from './sim.mjs';
import {terrainSample,REGION_SIZE,ALPINE_START_HEIGHT} from './terrain.mjs';
import {stoneVisualScale,stoneStage} from './stone-deposits.mjs';
import {workArea} from './work-areas.mjs';
import {desiredChunks,visibilityTarget,approachOpacity,shouldRetire,chunkDistance,MAX_VISUAL_CHUNKS,CAMERA_DISTANCE,DEFAULT_GRAPHICS_QUALITY,renderDistanceForZoom,AdaptiveHorizon,VISUAL_RADIUS} from './stream-window.mjs';
import {makeMaterials,buildingModel,treeModel,constructionModel,citizenModel,animalModel,cube,beam,mergeByMaterial} from './models3d.mjs';
import {installDetailedMaterials,makeTransport,routePreview,createPostprocessing,makeSky,makeRiver} from './visuals.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function noise(x,z,seed){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return lerp(lerp(hash(a,b,seed),hash(a+1,b,seed),u),lerp(hash(a,b+1,seed),hash(a+1,b+1,seed),u),v);}
const ROCK_STAGE_COLORS=['#958d75','#b3a88d','#c3b69b','#d1c4aa','#ddd3be'].map(hex=>new T.Color(hex));
// Paleta diurna clara: los prados destacan sobre los bosques, las rocas
// son cálidas y el cielo deja de teñir la escena de gris en todas las estaciones.
const seasonColors=[
 {grass:'#9ac664',forest:'#4f8951',pine:'#4c8955',oak:'#83af55',sky:'#b9dbf0',sun:'#fff4d3'},
 {grass:'#aec86d',forest:'#668d4a',pine:'#478354',oak:'#98ac54',sky:'#c5e3f3',sun:'#fff0c4'},
 {grass:'#c3b46f',forest:'#898a4b',pine:'#568058',oak:'#c59e55',sky:'#c9dff0',sun:'#ffebc9'},
 {grass:'#dbe6dc',forest:'#b2c9ba',pine:'#8cad9a',oak:'#c7d1b8',sky:'#d6e8f2',sun:'#fff5e6'}
];

export class Renderer{
 constructor(canvas,mini,world){
  this.canvas=canvas;this.mini=mini;this.mc=mini.getContext('2d');this.world=world;this.camera={x:31,y:32};this.zoom=1;this.azimuth=.83;this.elevation=.79;this.hover=null;this.selected=null;this.buildMode=null;this.gatherMode=false;this.width=1;this.height=1;this.lastDay=-1;this.lastSeason=-1;this.lastVisualKey='';this.miniKey='';this.time=0;this.buildingMeshes=new Map();this.people=new Map();this.animalMeshes=[];this.dummy=new T.Object3D();this.raycaster=new T.Raycaster();this.mouse=new T.Vector2();this.quality=DEFAULT_GRAPHICS_QUALITY;
  this.gl=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});this.gl.setPixelRatio(1);this.gl.shadowMap.enabled=false;this.gl.shadowMap.type=T.PCFSoftShadowMap;this.gl.shadowMap.autoUpdate=false;this.gl.outputColorSpace=T.SRGBColorSpace;this.gl.toneMapping=T.NoToneMapping;this.gl.toneMappingExposure=1.02;this.gl.debug.onShaderError=(gl,program,vertex,fragment)=>{console.error('Error de shader:',gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment));throw new Error('No se han podido compilar los efectos gráficos.');};
  this.scene=new T.Scene();this.scene.background=new T.Color('#b9dbf0');this.scene.fog=new T.FogExp2('#b9dbf0',.0012);
  this.viewCamera=new T.PerspectiveCamera(42,1,.15,1200);
  this.sun=new T.DirectionalLight('#fff4d3',2.65);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-26;this.sun.shadow.camera.right=26;this.sun.shadow.camera.top=26;this.sun.shadow.camera.bottom=-26;this.sun.shadow.camera.near=.1;this.sun.shadow.camera.far=130;this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.035;this.sun.shadow.radius=2;this.scene.add(this.sun,this.sun.target);
  this.hemi=new T.HemisphereLight('#f1f9ff','#81966e',1.45);this.scene.add(this.hemi);
  this.materials=makeMaterials();this.detail=installDetailedMaterials(this.materials,()=>{this.gl.shadowMap.needsUpdate=true;});this.post=null;this.sky=makeSky();this.scene.add(this.sky);this.staticGroup=new T.Group();this.scene.add(this.staticGroup);this.buildingsGroup=new T.Group();this.scene.add(this.buildingsGroup);this.villagersGroup=new T.Group();this.scene.add(this.villagersGroup);this.treeInstances=[];this.treeTemplates=new Map();this.sharedChunkGeometries=new Set();this.rockGeometry=null;this.rockScarGeometry=null;this.rockInstances=null;this.chunkVisuals=null;this.waterBedCenter={x:32,y:32};this.lastVisualBuild=-100;this.lastDetailBuild=-100;this.lastVisualTime=0;this.lastPrefetch=0;this.adaptiveHorizon=new AdaptiveHorizon();this.visualHorizon=renderDistanceForZoom(this.zoom,this.adaptiveHorizon.distance);
  this.selectionMat=new T.MeshBasicMaterial({color:'#e6cf8e',transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide});this.placementMat=this.selectionMat.clone();this.placement=new T.Mesh(new T.PlaneGeometry(1,1),this.placementMat);this.placement.rotation.x=-Math.PI/2;this.placement.renderOrder=10;this.placement.visible=false;this.scene.add(this.placement);this.selection=this.placement.clone();this.selection.material=this.selectionMat;this.scene.add(this.selection);
  this.pickMaterial=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false,depthTest:false,side:T.DoubleSide});
  this.ghost=null;this.ghostType=null;this.selectedRing=new T.LineLoop(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#e9d5a3',transparent:true,opacity:.8}));this.scene.add(this.selectedRing);
  // Contorno visible, ancho y con relleno: el LineLoop anterior era demasiado fino.
  // Un solo grupo 3D se actualiza al cambiar de cantera (no en cada fotograma).
  this.quarryArea=new T.Group();this.quarryArea.visible=false;this.quarryAreaKey='';
  this.quarryFill=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({
   color:'#abd59a',transparent:true,opacity:.18,depthTest:false,depthWrite:false,side:T.DoubleSide
  }));
  this.quarryBorder=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({
   color:'#ffdf83',transparent:true,opacity:.92,depthTest:false,depthWrite:false,side:T.DoubleSide
  }));
  this.quarryFill.renderOrder=20;this.quarryBorder.renderOrder=21;
  this.quarryArea.add(this.quarryFill,this.quarryBorder);this.scene.add(this.quarryArea);

  this.smokeGeo=new T.BufferGeometry();this.smokePos=new Float32Array(500*3);this.smokeGeo.setAttribute('position',new T.BufferAttribute(this.smokePos,3));this.smokeGeo.setDrawRange(0,0);this.smoke=new T.Points(this.smokeGeo,this.materials.smoke);this.smoke.frustumCulled=false;this.scene.add(this.smoke);
  if(world.terrainVersion===3){this.chunkVisuals=new Map();this.makeWater();this.makeAnimals();this.syncBuildings();this.makeVisualChunk(0,0,1);}else{this.makeTerrain();this.makeWater();this.makeVegetation();this.makeRocks();this.makeRoads();this.makeAnimals();this.syncBuildings();}this.resize();if(world.cameraPosition)this.focus(world.cameraPosition.x,world.cameraPosition.y);else this.center();this.updateSeason();this.setQuality(DEFAULT_GRAPHICS_QUALITY);this.installContextHandlers();this.gl.compile(this.scene,this.viewCamera);if(this.post)this.gl.compile(this.post.scene,this.post.camera);
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
 makeTerrain(cx=null,cy=null){
  const chunk=Number.isInteger(cx)&&Number.isInteger(cy),res=chunk?20:224,span=chunk?64:224;
  const ox=chunk?cx*SIZE:this.world.terrainVersion===3?this.world.viewRegion.x*SIZE:0;
  const oz=chunk?cy*SIZE:this.world.terrainVersion===3?this.world.viewRegion.y*SIZE:0;
  const geo=new T.PlaneGeometry(span,span,res,res);
  geo.rotateX(-Math.PI/2);
  const p=geo.getAttribute('position'),colors=new Float32Array(p.count*3);
  const landscape=this.world.terrainVersion===3?{woodland:new Float32Array(p.count),moisture:new Float32Array(p.count)}:null;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i)+ox+32,z=p.getZ(i)+oz+32;
   let height;
   if(landscape){
    const sample=terrainSample(x,z,this.world.seedNumber,this.world.coordinates);
    height=sample.height;
    landscape.woodland[i]=sample.woodland;
    landscape.moisture[i]=sample.moisture;
   }else height=this.heightAt(x,z);
   p.setXYZ(i,x,height,z);
  }
  geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.computeVertexNormals();
  this.terrain=new T.Mesh(geo,this.materials.ground);
  if(chunk)this.terrain.userData.groundChunk={x:cx*SIZE,z:cy*SIZE,segments:res};
  if(landscape)this.terrain.userData.landscape=landscape;
  this.terrain.receiveShadow=true;this.terrain.castShadow=false;
  (chunk?this.staticGroup:this.scene).add(this.terrain);
  this.colorTerrain();
 }
 // La altura de las plantas debe coincidir con los TRIÁNGULOS visibles,
 // no con la función ideal de relieve. Al bajar de 32 a 20 divisiones,
 // apoyarlas en heightAt() provocaba árboles flotantes desde ciertos ángulos.
 visualGroundHeightAt(x,z){
  const mesh=this.terrain,chunk=mesh?.userData.groundChunk;
  if(!chunk)return this.heightAt(x,z);
  const position=mesh.geometry.getAttribute('position'),segments=chunk.segments,stride=segments+1;
  const u=Math.max(0,Math.min(segments-1e-7,(x-chunk.x)*segments/SIZE));
  const v=Math.max(0,Math.min(segments-1e-7,(z-chunk.z)*segments/SIZE));
  const col=Math.floor(u),row=Math.floor(v),fx=u-col,fz=v-row;
  const i=row*stride+col;
  const h00=position.getY(i),h10=position.getY(i+1);
  const h01=position.getY(i+stride),h11=position.getY(i+stride+1);
  // PlaneGeometry triangula cada celda por la diagonal (0,1) → (1,0).
  return fx+fz<=1
   ?h00+(h10-h00)*fx+(h01-h00)*fz
   :h11+(h01-h11)*(1-fx)+(h10-h11)*(1-fz);
 }
 colorTerrain(){
  const p=this.terrain.geometry.getAttribute('position'),colors=this.terrain.geometry.getAttribute('color');
  const pal=seasonColors[this.world.season],landscape=this.terrain.userData.landscape;
  const grass=new T.Color(pal.grass),forest=new T.Color(pal.forest);
  const bank=new T.Color(this.world.season===3?'#cddbd5':'#c3b48c');
  const rock=new T.Color(this.world.season===3?'#d2d9d4':'#b9b19c');
  const dry=new T.Color(this.world.season===3?'#d6e3d6':'#d0bc7d');
  const summit=new T.Color(this.world.season===3?'#f8faf2':'#e5e8df');
  const color=new T.Color(),seed=this.world.seedNumber;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),h=p.getY(i);
   const gx=x+(this.world.coordinates?.x||0)*(this.world.terrainVersion>=2?REGION_SIZE:0);
   const gz=z+(this.world.coordinates?.y||0)*(this.world.terrainVersion===2?REGION_SIZE:0);
   const cover=landscape?landscape.woodland[i]:noise(gx*.22,gz*.22,seed);
   const wet=landscape?landscape.moisture[i]:.5;
   const fine=noise(gx*.85,gz*.85,seed+28);
   // Grandes regiones abiertas son ocres y luminosas; los bosques son
   // oscuros. Las montañas pasan a roca y nieve sin usar texturas nuevas.
   const dark=clamp((cover-.37)*2.1,0,1);
   const dryness=landscape?clamp((.48-cover)*2.5,0,1)*clamp((.69-wet)*2.2,0,1):0;
   color.copy(grass).lerp(forest,dark*.78).multiplyScalar(.98+fine*.14);
   if(dryness>0)color.lerp(dry,dryness*.82);
   if(h<.4)color.lerp(bank,clamp((.42-h)*1.9,0,1));
   if(h>3.2)color.lerp(rock,clamp((h-3.2)/14,0,.85));
   if(h>ALPINE_START_HEIGHT-.5)color.lerp(summit,clamp((h-ALPINE_START_HEIGHT+.5)/7,0,this.world.season===3?1:.88));
   colors.setXYZ(i,color.r,color.g,color.b);
  }
  colors.needsUpdate=true;
 }
 makeWater(){this.river=makeRiver(this.gl,this.scene,this.heightAt.bind(this));this.water=this.river.mesh;}
 // La construcción procedural de un árbol es costosa. Los 3 modelos se
 // preparan una sola vez por renderizador y su geometría se comparte entre
 // todos los sectores instanciados, sin generar ni compilar mallas duplicadas.
 treeTemplate(variant){
  let template=this.treeTemplates.get(variant);
  if(template)return template;
  template=treeModel(this.materials,variant).children.map(source=>{
   this.sharedChunkGeometries.add(source.geometry);
   return {geometry:source.geometry,material:source.material};
  });
  this.treeTemplates.set(variant,template);
  return template;
 }
 createTreeMeshes(){
  for(const inst of this.treeInstances){
   this.staticGroup.remove(inst);
   inst.dispose?.(); // Libera los buffers propios sin destruir la geometría compartida.
  }
  this.treeInstances=[];
  const data=this.world.renderTiles||this.world.tiles;
  const all=data.filter(t=>t.tree&&this.heightAt(t.x+.5,t.y+.5)>.2);
  this.knownTrees=new Set(data.filter(t=>t.tree));
  const lists=[[],[],[]];
  for(const t of all)lists[t.variant>.55?0:t.variant>.4?1:2].push(t);
  this.treeTiles=all;
  for(let v=0;v<3;v++){
   const tiles=lists[v];if(!tiles.length)continue;
   for(const source of this.treeTemplate(v)){
    const inst=new T.InstancedMesh(source.geometry,source.material,tiles.length);
    inst.castShadow=true;inst.receiveShadow=true;
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
    inst.userData={variant:v,tiles,foliage:source.material!==this.materials.bark};
    this.staticGroup.add(inst);this.treeInstances.push(inst);
   }
  }
 }
 makeVegetation(){
  this.createTreeMeshes();
  // La hierba 3D se oculta en Ligera/Equilibrada. No crear miles de
  // instancias ni calcular su relieve cuando el usuario no puede verlas.
  this.grassTiles=(this.world.renderTiles||this.world.tiles).filter(t=>t.type==='grass'&&!t.building&&!t.road&&!t.tree&&t.variant>.45);
  this.grassInst=null;
  if(this.quality==='high')this.createGrassInstances();
  this.refreshTrees();
 }
 createGrassInstances(){
  if(this.grassInst)return;
  const grassGeo=new T.PlaneGeometry(.28,.36);grassGeo.translate(0,.18,0);
  const tiles=this.grassTiles||[],grassCount=tiles.length*4;
  this.grassInst=new T.InstancedMesh(grassGeo,this.materials.grass,Math.max(1,grassCount));
  this.grassInst.receiveShadow=true;this.grassInst.visible=true;this.staticGroup.add(this.grassInst);
  if(!grassCount){this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.grassInst.setMatrixAt(0,this.dummy.matrix);}
  let gi=0;
  for(const t of tiles)for(let i=0;i<4;i++){
   const x=t.x+hash(i,t.x),z=t.y+hash(i,t.y,4);
   this.dummy.position.set(x,this.visualGroundHeightAt(x,z),z);
   this.dummy.rotation.set(0,hash(i,t.x+t.y)*Math.PI*2,0);
   this.dummy.scale.setScalar(.55+hash(i,4)*.65);this.dummy.updateMatrix();
   this.grassInst.setMatrixAt(gi++,this.dummy.matrix);
  }
  this.grassInst.instanceMatrix.needsUpdate=true;
 }
 refreshTrees(){
  if((this.world.renderTiles||this.world.tiles).some(t=>t.tree&&!this.knownTrees.has(t)))this.createTreeMeshes();
  const pal=seasonColors[this.world.season];
  const sourceMatrices=new Map(),color=new T.Color(),marked=new T.Color('#d7b261');
  const bark=new T.Color('#d8cfb9'),pine=new T.Color(pal.pine),oak=new T.Color(pal.oak);
  for(const inst of this.treeInstances){
   const {tiles,variant,foliage}=inst.userData;
   const previous=sourceMatrices.get(tiles);
   if(previous){
    // Tronco, ramas y hojas comparten la misma transformación. Antes se
    // calculaba heightAt() otra vez por cada pieza del mismo árbol.
    inst.instanceMatrix.array.set(previous.instanceMatrix.array);
   }else{
    for(let i=0;i<tiles.length;i++){
     const t=tiles[i],r=hash(t.x,t.y,this.world.seedNumber+65);
     const x=t.x+.25+r*.5,z=t.y+.25+hash(t.y,t.x)*.5,size=.62+r*.5;
     this.dummy.position.set(x,this.visualGroundHeightAt(x,z),z);
     this.dummy.rotation.set(0,r*Math.PI*2,0);
     this.dummy.scale.set(size*(t.tree?1:0),size*(.9+hash(t.x,t.y)*.2)*(t.tree?1:0),size*(t.tree?1:0));
     this.dummy.updateMatrix();inst.setMatrixAt(i,this.dummy.matrix);
    }
    sourceMatrices.set(tiles,inst);
   }
   const base=foliage?(variant===2?oak:pine):bark;
   for(let i=0;i<tiles.length;i++){
    const t=tiles[i],r=hash(t.x,t.y,this.world.seedNumber+65);
    color.copy(base).multiplyScalar(.78+r*.3);
    if(t.marked)color.lerp(marked,.4);
    inst.setColorAt(i,color);
   }
   inst.instanceMatrix.needsUpdate=true;
   if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
   inst.computeBoundingSphere();
  }
  this.gl.shadowMap.needsUpdate=true;
 }
 // Compartir rocas y marcas de extracción también evita volver a subir sus
 // vértices a la GPU al mover la cámara a través de sectores.
 rockTemplate(){
  if(this.rockGeometry)return this.rockGeometry;
  const geom=new T.DodecahedronGeometry(1,1),p=geom.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const r=hash(Math.round(p.getX(i)*10),Math.round(p.getY(i)*10),75);
   p.setXYZ(i,p.getX(i)*(.85+r*.3),p.getY(i)*(.7+r*.5),p.getZ(i)*(.85+r*.3));
  }
  geom.computeVertexNormals();
  this.rockGeometry=geom;this.sharedChunkGeometries.add(geom);
  return geom;
 }
 makeRocks(){
  const tiles=(this.world.renderTiles||this.world.tiles).filter(t=>t.rock||t.stoneScar);
  const geom=this.rockTemplate();
  this.rockTiles=tiles;
  this.rockInstances=new T.InstancedMesh(geom,this.materials.rock,Math.max(1,tiles.length));
  this.rockInstances.castShadow=this.rockInstances.receiveShadow=true;this.staticGroup.add(this.rockInstances);
  if(!this.rockScarGeometry){
   this.rockScarGeometry=new T.PlaneGeometry(1,1);
   this.rockScarGeometry.rotateX(-Math.PI/2);
   this.sharedChunkGeometries.add(this.rockScarGeometry);
  }
  this.rockScarInstances=new T.InstancedMesh(this.rockScarGeometry,this.materials.dirt,Math.max(1,tiles.length));
  this.rockScarInstances.receiveShadow=true;this.staticGroup.add(this.rockScarInstances);
  if(!tiles.length){
   this.dummy.scale.setScalar(0);this.dummy.updateMatrix();
   this.rockInstances.setMatrixAt(0,this.dummy.matrix);
   this.rockScarInstances.setMatrixAt(0,this.dummy.matrix);
  }
  this.refreshRocks();
  // La costa conserva sus pequeñas rocas decorativas. Evitamos calcular
  // alturas de las casillas que jamás podrían contenerlas.
  const pebbles=(this.world.renderTiles||this.world.tiles).filter(t=>t.type==='grass'&&t.variant>.5&&this.heightAt(t.x+.5,t.y+.5)<.43);
  if(!pebbles.length)return;
  const rocks=new T.InstancedMesh(geom,this.materials.rock,pebbles.length);
  for(let i=0;i<pebbles.length;i++){
   const t=pebbles[i],r=t.variant;
   this.dummy.position.set(t.x+.5,this.heightAt(t.x+.5,t.y+.5),t.y+.5);
   this.dummy.scale.set(.15+r*.12,.08+r*.09,.13+r*.12);
   this.dummy.rotation.set(r,r*6,r);this.dummy.updateMatrix();
   rocks.setMatrixAt(i,this.dummy.matrix);
  }
  rocks.receiveShadow=true;this.staticGroup.add(rocks);
 }
 refreshGrass(){if(!this.grassInst)return;let i=0;for(const t of this.grassTiles)for(let j=0;j<4;j++){const x=t.x+hash(j,t.x),z=t.y+hash(j,t.y,4);this.dummy.position.set(x,this.visualGroundHeightAt(x,z),z);this.dummy.rotation.set(0,hash(j,t.x+t.y)*Math.PI*2,0);this.dummy.scale.setScalar(t.building||t.road||t.tree?0:.55+hash(j,4)*.65);this.dummy.updateMatrix();this.grassInst.setMatrixAt(i++,this.dummy.matrix);}this.grassInst.instanceMatrix.needsUpdate=true;}
 refreshRocks(){
  for(let i=0;i<this.rockTiles.length;i++){
   const t=this.rockTiles[i],r=t.variant,size=(t.type==='hill'?.45:.22)+r*.3;
   const scale=t.rock?stoneVisualScale(t):0,stage=stoneStage(t);
   const x=t.x+.5,y=this.heightAt(x,t.y+.5),z=t.y+.5;
   this.dummy.position.set(x,y,z);this.dummy.rotation.set(r*.4,r*8,r*.2);
   this.dummy.scale.set(size*scale,size*.75*scale,size*1.1*scale);this.dummy.updateMatrix();
   this.rockInstances.setMatrixAt(i,this.dummy.matrix);
   this.rockInstances.setColorAt(i,ROCK_STAGE_COLORS[stage]);
   if(this.rockScarInstances){
    const scarSize=t.stoneScar?(.42+.48*(1-scale)):0;
    this.dummy.position.set(x,y+.035,z);this.dummy.rotation.set(0,r*6,0);
    this.dummy.scale.set(scarSize,1,scarSize);this.dummy.updateMatrix();
    this.rockScarInstances.setMatrixAt(i,this.dummy.matrix);
   }
  }
  this.rockInstances.instanceMatrix.needsUpdate=true;
  if(this.rockInstances.instanceColor)this.rockInstances.instanceColor.needsUpdate=true;
  if(this.rockScarInstances)this.rockScarInstances.instanceMatrix.needsUpdate=true;
}
 makeRoads(){if(this.roadsGroup){this.staticGroup.remove(this.roadsGroup);this.disposeGroup(this.roadsGroup);}this.roadsGroup=makeTransport(this.world,this.materials,this.heightAt.bind(this));this.bridgeHeights=this.roadsGroup.userData.bridgeHeights;this.staticGroup.add(this.roadsGroup);this.gl.shadowMap.needsUpdate=true;}
 makeAnimals(){const ox=this.world.terrainVersion===3?this.world.viewRegion.x*SIZE:0,oz=this.world.terrainVersion===3?this.world.viewRegion.y*SIZE:0;for(let i=0;i<7;i++){const g=animalModel(this.materials,'deer');g.userData={x:ox+23+hash(i,45+ox,this.world.seedNumber)*12,z:oz+20+hash(i,8+oz,this.world.seedNumber)*6,phase:i};this.scene.add(g);this.animalMeshes.push(g);}}
 syncBuildings(){let changed=false;const local=this.world.terrainVersion===3?this.world.buildings.filter(b=>b.x+b.w>=this.camera.x-380&&b.x<this.camera.x+380&&b.y+b.h>=this.camera.y-380&&b.y<this.camera.y+380):this.world.buildings;for(const [id,obj]of this.buildingMeshes)if(!local.some(b=>b.id===id)){this.buildingsGroup.remove(obj);this.disposeGroup(obj);this.buildingMeshes.delete(id);changed=true;}
  for(const b of local){let o=this.buildingMeshes.get(b.id);const signature=`${b.progress>=1}-${b.type==='farm'?this.world.season:0}`;if(o&&o.userData.signature===signature)continue;if(o){this.buildingsGroup.remove(o);this.disposeGroup(o);}o=b.progress<1?constructionModel(b,this.materials):buildingModel(b.type,this.materials,this.world.season,b.id);const smoke=o.userData.smoke;o.userData={buildingId:b.id,signature,smoke};o.position.set(b.x+b.w/2,this.heightAt(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);
   const base=new T.Mesh(new T.PlaneGeometry(b.w+1,b.h+1),this.materials.soft);base.rotation.x=-Math.PI/2;base.position.y=.008;base.renderOrder=1;o.add(base);
   // Invisible para la vista, pero con una superficie amplia para que un clic
   // seleccione la cantera incluso con el mapa muy alejado.
   const hitbox=new T.Mesh(new T.BoxGeometry(b.w+.7,1.1,b.h+.7),this.pickMaterial);
   hitbox.name='building-selection-area';hitbox.position.y=.65;o.add(hitbox);
   this.buildingsGroup.add(o);this.buildingMeshes.set(b.id,o);changed=true;}
  if(changed)this.gl.shadowMap.needsUpdate=true;
 }
 syncPeople(time){
  const local=this.world.terrainVersion===3
   ?this.world.citizens.filter(c=>Math.abs(c.x-this.camera.x)<180&&Math.abs(c.y-this.camera.y)<180)
   :this.world.citizens;
  const localIds=new Set(local.map(c=>c.id));
  for(const [id,obj] of this.people){
   if(localIds.has(id))continue;
   this.villagersGroup.remove(obj);this.disposeGroup(obj);
   this.people.delete(id);
  }
  for(const c of local){
   let obj=this.people.get(c.id);
   if(!obj){
    obj=citizenModel(this.materials,c.color);
    this.people.set(c.id,obj);this.villagersGroup.add(obj);
   }
   const bridgeY=this.bridgeHeights?.get(Math.floor(c.x)+','+Math.floor(c.y));
   // Un colono quieto no necesita muestrear de nuevo la altura procedural
   // del terreno 60 veces por segundo. Solo recalcular al moverse o al
   // construirse/desaparecer el puente sobre el que se encuentra.
   const state=obj.userData;
   if(state.lastX!==c.x||state.lastY!==c.y||state.lastBridgeY!==bridgeY){
    const height=bridgeY===undefined?this.heightAt(c.x,c.y):bridgeY;
    obj.position.set(c.x,height+.015,c.y);
    state.lastX=c.x;state.lastY=c.y;state.lastBridgeY=bridgeY;
   }
   if(c.path.length){
    obj.rotation.y=Math.atan2(c.path[0].x-c.x,c.path[0].y-c.y);
    const p=this.world.speed?Math.sin(time*9+c.id)*.5:0;
    state.limbs.forEach((l,i)=>l.rotation.x=i%2?p:-p);
   }else state.limbs.forEach(l=>l.rotation.x=0);
  }
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.gl.setSize(r.width,r.height,false);this.post?.resize(Math.max(1,Math.round(r.width*this.gl.getPixelRatio())),Math.max(1,Math.round(r.height*this.gl.getPixelRatio())));this.viewCamera.aspect=r.width/Math.max(1,r.height);this.viewCamera.updateProjectionMatrix();this.updateCamera();}
 center(){this.camera={x:31.5,y:32.5};this.zoom=1;this.azimuth=.83;this.elevation=.79;this.updateCamera();}
 iso(x,y){return {x,y};}
 focus(x,y){this.camera={x,y};this.clampCamera();this.updateCamera();}
 updateCamera(){this.streamRegion();const target=new T.Vector3(this.camera.x,this.heightAt(this.camera.x,this.camera.y)+.3,this.camera.y),distance=CAMERA_DISTANCE/this.zoom,horizontal=Math.cos(this.elevation)*distance;this.viewCamera.position.set(target.x+Math.sin(this.azimuth)*horizontal,target.y+Math.sin(this.elevation)*distance,target.z+Math.cos(this.azimuth)*horizontal);this.viewCamera.lookAt(target);this.viewCamera.updateMatrixWorld();this.sky.position.set(target.x,0,target.z);this.sun.position.set(target.x-22,35,target.z+14);this.sun.target.position.copy(target);this.sun.target.updateMatrixWorld();this.gl.shadowMap.needsUpdate=true;}
 setZoom(z,sx=this.width/2,sy=this.height/2){const before=this.unproject(sx,sy);this.zoom=clamp(z,.38,3.4);this.updateCamera();const after=this.unproject(sx,sy);if(Number.isFinite(before.x)&&Number.isFinite(after.x)){this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;this.clampCamera();this.updateCamera();}}
 rotate(dx,dy=0){this.azimuth-=dx*.007;this.elevation=clamp(this.elevation+dy*.004,.27,1.32);this.updateCamera();}
 pan(dx,dy){const scale=(CAMERA_DISTANCE/this.zoom)*.75/Math.max(1,this.height),a=this.azimuth;this.camera.x-=Math.cos(a)*dx*scale+Math.sin(a)*dy*scale/Math.sin(this.elevation);this.camera.y-=(-Math.sin(a))*dx*scale+Math.cos(a)*dy*scale/Math.sin(this.elevation);this.clampCamera();this.updateCamera();}
 clampCamera(){if(this.world.terrainVersion!==3){this.camera.x=clamp(this.camera.x,3,SIZE-3);this.camera.y=clamp(this.camera.y,3,SIZE-3);}else{const limit=100000000;this.camera.x=clamp(this.camera.x,-limit,limit);this.camera.y=clamp(this.camera.y,-limit,limit);}}
 // Cada transición conserva el relieve anterior y mezcla lentamente la zona nueva.
 // Un sector tiene su propia geometría, vegetación, rocas y caminos.
 // Las geometrías no se regeneran al desplazarse al sector contiguo.
 scopeVisualChunk(chunk,work){
  const names=['staticGroup','terrain','treeInstances','knownTrees','grassTiles','grassInst','rockTiles','rockInstances','rockScarInstances','roadsGroup','bridgeHeights'];
  const before=Object.fromEntries(names.map(name=>[name,this[name]]));
  const prevTiles=this.world.renderTiles;
  for(const name of names)this[name]=name==='staticGroup'?(chunk.currentGroup||chunk.group):chunk[name];
  this.world.renderTiles=chunk.tiles;
  try{return work();}
  finally{
   for(const name of names){if(name!=='staticGroup')chunk[name]=this[name];this[name]=before[name];}
   this.world.renderTiles=prevTiles;
  }
 }
 visualSignature(tiles){
  let sum=0,count=0;
  for(const t of tiles){
   if(t.tree){count++;sum=(sum+Math.imul(t.x+7,t.y+13)+11)|0;}
   if(t.road)sum=(sum+Math.imul(t.x+113,t.y+7)+107)|0;
   if(t.bridge)sum=(sum+Math.imul(t.x+17,t.y+59)+67)|0;
  }
  return count+':'+sum;
 }
 makeVisualChunk(cx,cy,alpha=0){
  const key=cx+','+cy;if(this.chunkVisuals.has(key))return;
  const root=new T.Group();root.name='sector '+key;this.scene.add(root);
  const chunk={cx,cy,key,group:root,tiles:[],terrain:null,treeInstances:[],
   knownTrees:new Set(),grassTiles:[],grassInst:null,rockTiles:[],rockInstances:null,rockScarInstances:null,
   roadsGroup:null,bridgeHeights:new Map(),opacity:alpha,fade:null,signature:'',revision:-1,detail:false,detailGroup:null,detailFade:null,detailOpacity:0,currentGroup:null};
  try{
   this.scopeVisualChunk(chunk,()=>this.makeTerrain(cx,cy));
   chunk.signature='';
   chunk.fade=this.fadeObjects([root],alpha);
   this.chunkVisuals.set(key,chunk);
   // La vegetación se prepara de forma escalonada en updateVisualChunks,
   // no durante la construcción de varios sectores de terreno en un fotograma.
   if(alpha>=.99&&chunkDistance(cx,cy,this.camera.x,this.camera.y)<80)this.addVisualDetail(chunk);
   this.rebuildBridgeHeights();return chunk;
  }catch(error){
   this.scene.remove(root);this.disposeGroup(root);
   throw error;
  }
 }
 // Los sectores lejanos muestran el relieve primero; su vegetación aparece
 // progresivamente al acercarse, evitando procesar bosques fuera de vista.
 addVisualDetail(chunk){
  if(chunk.detail)return;
  // Solo el entorno próximo necesita 4.096 objetos de casilla por sector.
  // El relieve lejano es determinista y no llena la caché del juego.
  chunk.tiles=this.world.chunks.getChunk(chunk.cx,chunk.cy);
  chunk.signature=this.visualSignature(chunk.tiles);
  chunk.revision=this.world.chunks.revision(chunk.cx,chunk.cy);
  const group=new T.Group();group.name='vegetacion y caminos';chunk.group.add(group);
  chunk.currentGroup=group;
  try{
   this.scopeVisualChunk(chunk,()=>{
    this.makeVegetation();this.makeRocks();this.makeRoads();
   });
   chunk.detail=true;chunk.detailGroup=group;chunk.detailOpacity=0;
   chunk.detailFade=this.fadeObjects([group],0);
   this.rebuildBridgeHeights();
  }finally{chunk.currentGroup=null;}
 }
 removeVisualDetail(chunk){
  if(!chunk.detail)return;
  chunk.group.remove(chunk.detailGroup);this.disposeGroup(chunk.detailGroup);
  for(const material of chunk.detailFade.materials)material.dispose();
  chunk.detail=false;chunk.detailGroup=null;chunk.detailFade=null;chunk.detailOpacity=0;
  chunk.tiles=[];chunk.signature='';
  chunk.treeInstances=[];chunk.knownTrees=new Set();chunk.grassTiles=[];chunk.grassInst=null;
  chunk.rockTiles=[];chunk.rockInstances=null;chunk.rockScarInstances=null;chunk.roadsGroup=null;chunk.bridgeHeights=new Map();
  this.rebuildBridgeHeights();
 }
 fadeObjects(roots,opacity){
  const originals=[],clones=new Map(),states=[];
  for(const root of roots)root.traverse(obj=>{
   if(!obj.material)return;
   const original=obj.material,fade=material=>{
    if(!clones.has(material)){
     const copy=material.clone();
     // Durante la aparición se mezcla la geometría; al terminar debe
     // recuperarse el depth buffer, especialmente para hojas alphaTest.
     states.push({material:copy,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});
     clones.set(material,copy);
    }
    return clones.get(material);
   };
   obj.material=Array.isArray(original)?original.map(fade):fade(original);
   originals.push({obj,original});
  });
  const result={originals,materials:[...clones.values()],states};
  this.applyFadeOpacity(result,opacity);
  return result;
 }
 applyFadeOpacity(fade,opacity){
  if(!fade)return;
  const fullyVisible=opacity>=.98;
  for(const state of fade.states){
   const mat=state.material,transparent=fullyVisible?state.transparent:true;
   const depthWrite=fullyVisible?state.depthWrite:false;
   // No recompilar en cada fotograma: solo al entrar/salir del modo opaco.
   if(mat.transparent!==transparent||mat.depthWrite!==depthWrite){
    mat.transparent=transparent;mat.depthWrite=depthWrite;mat.needsUpdate=true;
   }
   mat.opacity=state.opacity*(fullyVisible?1:opacity);
  }
 }
 rebuildBridgeHeights(){
  if(!this.chunkVisuals)return;
  const heights=new Map();
  for(const chunk of this.chunkVisuals.values())
   for(const [cell,height] of chunk.bridgeHeights)heights.set(cell,height);
  this.bridgeHeights=heights;
 }
 dropVisualChunk(chunk){
  if(!this.chunkVisuals.has(chunk.key))return;
  this.chunkVisuals.delete(chunk.key);
  this.scene.remove(chunk.group);
  this.disposeGroup(chunk.group);
  for(const material of chunk.fade.materials)material.dispose();
  if(chunk.detailFade)for(const material of chunk.detailFade.materials)material.dispose();
  this.rebuildBridgeHeights();
 }
 clearVisualChunks(){
  if(!this.chunkVisuals)return;
  for(const chunk of [...this.chunkVisuals.values()])this.dropVisualChunk(chunk);
 }
 refreshVisualChunk(chunk){
  if(!chunk.detail)return;
  const revision=this.world.chunks.revision(chunk.cx,chunk.cy);
  if(revision===chunk.revision)return;
  const activeTiles=this.world.chunks.getChunk(chunk.cx,chunk.cy);
  if(activeTiles!==chunk.tiles||this.visualSignature(chunk.tiles)!==chunk.signature){
   const {cx,cy,opacity}=chunk;
   this.dropVisualChunk(chunk);this.makeVisualChunk(cx,cy,opacity);
   return;
  }
  if(chunk.detail)this.scopeVisualChunk(chunk,()=>{
   this.refreshTrees();this.refreshRocks();this.refreshGrass();
  });
  chunk.revision=revision;
 }
 // Un horizonte de 5×5 sectores sigue a la cámara continuamente.
 // Cada fotograma aproxima su visibilidad; se construye como máximo un sector por pasada.
 updateVisualChunks(time){
  if(!this.chunkVisuals)return;
  const rawDt=this.lastVisualTime?Math.max(0,time-this.lastVisualTime):1/60;
  const dt=Math.min(.1,rawDt);
  this.lastVisualTime=time;
  this.adaptiveHorizon.observe(rawDt);
  const renderDistance=renderDistanceForZoom(this.zoom,this.adaptiveHorizon.distance);
  this.visualHorizon=renderDistance;
  const wanted=desiredChunks(this.camera.x,this.camera.y,VISUAL_RADIUS,renderDistance);
  // Horizonte ampliado por tandas: dos sectores de relieve sencillo
  // por fotograma si hay margen; solo uno cuando bajan los FPS.
  if(time-this.lastVisualBuild>.028){
   // Máximo un sector de relieve por pasada para evitar picos de CPU.
   let budget=1;
   for(const next of wanted){
    if(!budget)break;
    if(next.opacity<=.005||this.chunkVisuals.has(next.key))continue;
    this.makeVisualChunk(next.x,next.y,0);
    budget--;
   }
   this.lastVisualBuild=time;
  }
  for(const chunk of [...this.chunkVisuals.values()]){
   const target=shouldRetire(chunk.cx,chunk.cy,this.camera.x,this.camera.y)?0:
    visibilityTarget(chunk.cx,chunk.cy,this.camera.x,this.camera.y,renderDistance);
   chunk.opacity=approachOpacity(chunk.opacity,target,dt);
   if(Math.abs(chunk.opacity-target)<.001)chunk.opacity=target;
   this.applyFadeOpacity(chunk.fade,chunk.opacity);
   const distance=chunkDistance(chunk.cx,chunk.cy,this.camera.x,this.camera.y);
   if(!chunk.detail&&distance<120&&time-this.lastDetailBuild>.18){
    this.addVisualDetail(chunk);this.lastDetailBuild=time;
   }
   if(chunk.detail){
    const targetDetail=Math.max(0,Math.min(1,(122-distance)/42));
    chunk.detailOpacity=approachOpacity(chunk.detailOpacity,targetDetail,dt);
    if(Math.abs(chunk.detailOpacity-targetDetail)<.001)chunk.detailOpacity=targetDetail;
    this.applyFadeOpacity(chunk.detailFade,chunk.opacity*chunk.detailOpacity);
    if(distance>152&&chunk.detailOpacity<.003)this.removeVisualDetail(chunk);
   }
   if(target===0&&chunk.opacity<.003)this.dropVisualChunk(chunk);
  }
  // En desplazamientos extremadamente rápidos, la memoria gráfica sigue acotada.
  if(this.chunkVisuals.size>MAX_VISUAL_CHUNKS){
   const farthest=[...this.chunkVisuals.values()].sort((a,b)=>chunkDistance(b.cx,b.cy,this.camera.x,this.camera.y)-chunkDistance(a.cx,a.cy,this.camera.x,this.camera.y));
   while(this.chunkVisuals.size>MAX_VISUAL_CHUNKS)this.dropVisualChunk(farthest.shift());
  }
 }
 streamRegion(){
  if(!this.chunkVisuals)return;
  const rx=Math.floor(this.camera.x/SIZE),ry=Math.floor(this.camera.y/SIZE);
  if(!this.world.setViewRegion(rx,ry))return;
  // La textura de agua cubre varias regiones: actualizarla solo cuando la
  // cámara se aleja lo suficiente, no en cada frontera de 64 casillas.
  if(Math.max(Math.abs(this.camera.x-this.waterBedCenter.x),Math.abs(this.camera.y-this.waterBedCenter.y))>112){
   this.waterBedCenter={x:this.camera.x,y:this.camera.y};
   this.river.refreshBed(this.heightAt.bind(this),this.waterBedCenter);
  }
  this.lastVisualKey='';this.miniKey='';
  this.syncBuildings();
 }
 ray(sx,sy){this.mouse.set(sx/this.width*2-1,1-sy/this.height*2);this.raycaster.setFromCamera(this.mouse,this.viewCamera);return this.raycaster;}
 unproject(sx,sy){const ray=this.ray(sx,sy),point=new T.Vector3();const plane=new T.Plane(new T.Vector3(0,1,0),-.58);if(!ray.ray.intersectPlane(plane,point))return {x:this.camera.x,y:this.camera.y};return {x:point.x,y:point.z};}
 pick(sx,sy){const surfaces=this.chunkVisuals?[...this.chunkVisuals.values()].filter(v=>v.opacity>.08).map(v=>v.terrain):[this.terrain];const hits=this.ray(sx,sy).intersectObjects(surfaces,false);if(hits.length){const p=hits[0].point;return {x:Math.floor(p.x),y:Math.floor(p.z)};}return {x:-1,y:-1};}
 pickBuilding(sx,sy){const hits=this.ray(sx,sy).intersectObjects([...this.buildingMeshes.values()],true);for(const hit of hits){let o=hit.object;while(o&&!o.userData.buildingId)o=o.parent;if(o?.userData.buildingId)return o.userData.buildingId;}const t=this.pick(sx,sy);return this.world.tile(t.x,t.y)?.building||null;}
 // El área coincide con el radio de extracción que utiliza la simulación.
 updateQuarryArea(building,isValid=true){
  const area=building&&workArea(building.type);
  if(!area){this.quarryArea.visible=false;this.quarryAreaKey='';return;}
  this.quarryArea.visible=true;
  const cx=building.x+building.w/2,cy=building.y+building.h/2;
  const cacheKey=[building.type,cx,cy,area.radius,isValid?1:0].join(':');
  if(cacheKey===this.quarryAreaKey)return;
  this.quarryAreaKey=cacheKey;
  const fill=[],border=[],count=96,r=area.radius,half=.26;
  const vertex=(arr,x,y,z)=>arr.push(x,this.heightAt(x,z)+y,z);
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2,b=(i+1)/count*Math.PI*2;
   const x0=cx+Math.cos(a)*r,z0=cy+Math.sin(a)*r;
   const x1=cx+Math.cos(b)*r,z1=cy+Math.sin(b)*r;
   // Suelo ligeramente tintado en toda la zona (sin ocultar la cantera).
   vertex(fill,cx,.13,cy);vertex(fill,x0,.13,z0);vertex(fill,x1,.13,z1);
   const ix0=cx+Math.cos(a)*(r-half),iz0=cy+Math.sin(a)*(r-half);
   const ix1=cx+Math.cos(b)*(r-half),iz1=cy+Math.sin(b)*(r-half);
   const ox0=cx+Math.cos(a)*(r+half),oz0=cy+Math.sin(a)*(r+half);
   const ox1=cx+Math.cos(b)*(r+half),oz1=cy+Math.sin(b)*(r+half);
   vertex(border,ix0,.24,iz0);vertex(border,ox0,.24,oz0);vertex(border,ix1,.24,iz1);
   vertex(border,ox0,.24,oz0);vertex(border,ox1,.24,oz1);vertex(border,ix1,.24,iz1);
  }
  const geo=values=>{
   const g=new T.BufferGeometry();
   g.setAttribute('position',new T.Float32BufferAttribute(values,3));
   g.computeVertexNormals();return g;
  };
  this.quarryFill.geometry.dispose();this.quarryBorder.geometry.dispose();
  this.quarryFill.geometry=geo(fill);this.quarryBorder.geometry=geo(border);
  this.quarryFill.material.color.set(isValid?'#abd59a':'#e59c82');
  this.quarryBorder.material.color.set(isValid?'#ffdf83':'#ff9b73');
 }
 updateSelection(){
  const plan=this.linePreview,key=plan?`${plan.type}:${plan.start.x},${plan.start.y}:${plan.end.x},${plan.end.y}:${plan.ok}:${plan.count}`:'';
  if(key!==this.linePreviewKey){if(this.routeGroup){this.scene.remove(this.routeGroup);this.disposeGroup(this.routeGroup,true);this.routeGroup=null;}if(plan){this.routeGroup=routePreview(plan,this.heightAt.bind(this),this.bridgeHeights);this.scene.add(this.routeGroup);}this.linePreviewKey=key;}
  const b=this.world.buildings.find(b=>b.id===this.selected);this.selection.visible=!!b;if(b){this.selection.position.set(b.x+b.w/2,this.heightAt(b.x+b.w/2,b.y+b.h/2)+.024,b.y+b.h/2);this.selection.scale.set(b.w+.12,b.h+.12,1);}
  const t=this.hover;this.placement.visible=!plan&&!!t&&(!!this.buildMode||this.gatherMode)&&!!this.world.tile(t.x,t.y);if(this.placement.visible){const d=this.buildMode?BUILDINGS[this.buildMode]:{w:1,h:1};const ok=this.buildMode?this.world.canPlace(this.buildMode,t.x,t.y).ok:(this.world.tile(t.x,t.y)?.tree||this.world.tile(t.x,t.y)?.rock);this.placementMat.color.set(ok?'#c0d48c':'#db8465');this.placement.scale.set(d.w,d.h,1);this.placement.position.set(t.x+d.w/2,Math.max(.06,this.heightAt(t.x+d.w/2,t.y+d.h/2)+.04),t.y+d.h/2);
   if(this.buildMode&&BUILDINGS[this.buildMode].days){if(this.ghostType!==this.buildMode){if(this.ghost){this.scene.remove(this.ghost);this.disposeGroup(this.ghost,true);}this.ghost=buildingModel(this.buildMode,this.materials,this.world.season);this.ghost.traverse(o=>{if(o.isMesh){o.material=new T.MeshBasicMaterial({color:'#bed296',transparent:true,opacity:.33,depthWrite:false,side:T.DoubleSide});o.castShadow=false;}});this.ghostType=this.buildMode;this.scene.add(this.ghost);}this.ghost.visible=true;this.ghost.position.copy(this.placement.position);this.ghost.traverse(o=>{if(o.isMesh)o.material.color.set(ok?'#c3d9a2':'#df987e');});}else if(this.ghost)this.ghost.visible=false;
  }else if(this.ghost)this.ghost.visible=false;
  const preview=this.buildMode&&workArea(this.buildMode)&&t&&this.world.tile(t.x,t.y)?
   {type:this.buildMode,x:t.x,y:t.y,w:BUILDINGS[this.buildMode].w,h:BUILDINGS[this.buildMode].h}:null;
  const active=preview||(b&&workArea(b.type)?b:null);
  this.updateQuarryArea(active,preview?this.world.canPlace(preview.type,preview.x,preview.y).ok:true);
  // El círculo general sustituye al antiguo anillo tenue y evita reconstruirlo cada fotograma.
  this.selectedRing.visible=false;
 }
 updateSeason(){const s=this.world.season,p=seasonColors[s];this.lastSeason=s;this.scene.background.set(p.sky);this.scene.fog.color.set(p.sky);this.sun.color.set(p.sun);this.sun.intensity=s===3?2.05:2.65;this.hemi.intensity=s===3?1.35:1.45;this.water.material.uniforms.uCold.value=s===3?1:0;this.water.material.uniforms.uSky.value.set(p.sky);this.materials.grass.color.set(s===3?'#d4e4d0':s===2?'#b6a866':s===1?'#abc66d':'#97c46b');this.materials.roof.color.set(s===3?'#f6f6ed':'#e5d4b9');this.sky.material.uniforms.uHorizon.value.set(p.sky);this.sky.material.uniforms.uCold.value=s===3?1:0;this.materials.thatch.color.set(s===3?'#e3eadb':'#d9c38b');if(this.chunkVisuals){for(const chunk of this.chunkVisuals.values())this.scopeVisualChunk(chunk,()=>{this.colorTerrain();if(chunk.detail)this.refreshTrees();});}else{this.colorTerrain();this.refreshTrees();}this.syncBuildings();this.miniKey='';}
 invalidate(){this.lastDay=-1;this.lastVisualKey='';this.miniKey='';this.selectionStateKey='';}
 setQuality(q){if(!['low','medium','high'].includes(q))q='low';this.quality=q;if(q!=='low'&&!this.post)this.post=createPostprocessing(this.gl,this.width,this.height);this.gl.setPixelRatio(q==='high'?Math.min(devicePixelRatio||1,2):q==='low'?.8:1);this.gl.shadowMap.enabled=q!=='low';const shadowSize=q==='high'?4096:q==='medium'?2048:1024;if(this.sun.shadow.mapSize.x!==shadowSize){this.sun.shadow.mapSize.set(shadowSize,shadowSize);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}if(this.chunkVisuals){
   for(const chunk of this.chunkVisuals.values())if(chunk.detail){
    if(q==='high'&&!chunk.grassInst)this.scopeVisualChunk(chunk,()=>this.createGrassInstances());
    if(chunk.grassInst)chunk.grassInst.visible=q==='high';
   }
  }else{
   if(q==='high'&&!this.grassInst)this.createGrassInstances();
   if(this.grassInst)this.grassInst.visible=q==='high';
  }if(this.post)this.post.uniforms.uAO.value=q==='low'?0:q==='high'?1:.65;this.river.quality=q;this.water.material.uniforms.uLow.value=q==='low'?1:0;this.resize();this.gl.shadowMap.needsUpdate=true;}
 draw(time){
  if(this.contextLost)return;this.time=time;
  if(this.lastSeason!==this.world.season)this.updateSeason();
  if(this.chunkVisuals){
   this.updateVisualChunks(time);
   if(time-this.lastPrefetch>.11){this.world.chunks.prefetchNext(1);this.lastPrefetch=time;}
   if(this.lastDay!==this.world.totalDays||!this.lastVisualKey){
    this.syncBuildings();
    for(const chunk of [...this.chunkVisuals.values()])this.refreshVisualChunk(chunk);
    this.lastDay=this.world.totalDays;this.lastVisualKey='infinite';
   }
  }else if(this.lastDay!==this.world.totalDays||!this.lastVisualKey){
   const key=this.world.buildings.map(b=>b.id+':'+(b.progress>=1)).join(',')+'-'+(this.world.renderTiles||this.world.tiles).filter(t=>t.road||t.bridge).length;
   this.syncBuildings();this.refreshTrees();this.refreshRocks();this.refreshGrass();
   if(key!==this.lastVisualKey){this.makeRoads();this.lastVisualKey=key;}
   this.lastDay=this.world.totalDays;
  }
  // La validación de construcciones (canteras incluidas) y sus previsualizaciones
   // solo necesita actualizarse cuando cambia la casilla, modo, recursos o día.
   const h=this.hover,p=this.linePreview;
   const selectionKey=[this.selected??'',this.buildMode??'',+this.gatherMode,
    h?.x??'',h?.y??'',p?.type??'',p?.start?.x??'',p?.start?.y??'',
    p?.end?.x??'',p?.end?.y??'',p?.ok??'',p?.count??'',
    this.world.totalDays,this.world.resources.wood,this.world.resources.stone].join(':');
   if(selectionKey!==this.selectionStateKey){
    this.updateSelection();this.selectionStateKey=selectionKey;
   }
   // En calidad Ligera la animación de ciudadanos se limita a 30 Hz; la
   // cámara y el agua siguen renderizando en cada fotograma disponible.
   if(this.quality!=='low'||time-(this.lastPeopleUpdate||-1)>1/30){
    this.syncPeople(time);this.lastPeopleUpdate=time;
   }
   this.detail.wind.value=time;this.sky.material.uniforms.uTime.value=time;this.water.material.uniforms.uTime.value=time;this.water.material.uniforms.uEye.value.copy(this.viewCamera.position);
  let si=0;for(const o of this.buildingMeshes.values()){const smoke=o.userData.smoke;if(!smoke)continue;for(let i=0;i<7&&si<500;i++){const age=(time*.15+i/7)%1;this.smokePos[si*3]=o.position.x+smoke[0]+age*.55+Math.sin(age*6)*.12;this.smokePos[si*3+1]=o.position.y+smoke[1]+age*1.8;this.smokePos[si*3+2]=o.position.z+smoke[2]+age*.2;si++;}}this.smokeGeo.getAttribute('position').needsUpdate=true;this.smokeGeo.setDrawRange(0,si);
  for(const obj of this.animalMeshes){const d=obj.userData,x=d.x+Math.sin(time*.07+d.phase)*.7,z=d.z+Math.cos(time*.05+d.phase)*.5;obj.position.set(x,this.heightAt(x,z),z);obj.rotation.y=Math.sin(time*.02+d.phase)*2;}
  this.river.update(this.viewCamera,time);
  if(this.quality==='low')this.gl.render(this.scene,this.viewCamera);
  else this.post.render(this.scene,this.viewCamera);
  if(time-(this.lastMini||0)>.25){this.drawMini();this.lastMini=time;}
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
 disposeGroup(group,materials=false){group.traverse(o=>{if(o.isInstancedMesh)o.dispose?.();if(o.geometry&&!this.sharedChunkGeometries.has(o.geometry))o.geometry.dispose();if(materials&&o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
 setWorld(w){
  this.clearVisualChunks();
  for(const o of [...this.staticGroup.children]){this.disposeGroup(o);this.staticGroup.remove(o);}
  for(const o of [...this.buildingsGroup.children]){this.disposeGroup(o);this.buildingsGroup.remove(o);}
  for(const o of [...this.villagersGroup.children]){this.disposeGroup(o);this.villagersGroup.remove(o);}
  for(const o of this.animalMeshes){this.scene.remove(o);this.disposeGroup(o);}
  this.animalMeshes=[];this.buildingMeshes.clear();this.people.clear();this.treeInstances=[];this.selectionStateKey='';this.lastPeopleUpdate=-1;
  if(this.terrain){this.scene.remove(this.terrain);this.terrain.geometry.dispose();this.terrain=null;}
  this.world=w;this.chunkVisuals=w.terrainVersion===3?new Map():null;
  this.linePreview=null;this.selected=null;this.buildMode=null;this.gatherMode=false;this.quarryArea.visible=false;this.quarryAreaKey='';
  this.lastDay=-1;this.lastSeason=-1;this.lastVisualKey='';this.lastVisualTime=0;this.lastVisualBuild=-100;this.lastDetailBuild=-100;this.adaptiveHorizon=new AdaptiveHorizon();
  this.waterBedCenter={x:w.terrainVersion===3?w.viewRegion.x*SIZE+32:32,y:w.terrainVersion===3?w.viewRegion.y*SIZE+32:32};
  this.river.refreshBed(this.heightAt.bind(this),this.waterBedCenter);
  if(this.chunkVisuals)this.makeVisualChunk(w.viewRegion.x,w.viewRegion.y,1);
  else{this.makeTerrain();this.makeVegetation();this.makeRocks();this.makeRoads();}
  this.makeAnimals();this.syncBuildings();this.updateSeason();
  if(w.cameraPosition)this.focus(w.cameraPosition.x,w.cameraPosition.y);
  else this.center();
  this.invalidate();
 }

}
