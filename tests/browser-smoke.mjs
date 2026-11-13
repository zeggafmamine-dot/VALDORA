import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push('JavaScript: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('Consola: '+m.text());});
// Instrumentación disponible solo en este navegador de pruebas.
// No se añaden variables de depuración al código del juego publicado.
await page.route('**/game.mjs',async route=>{
 const response=await route.fetch();
 const source=await response.text();
 await route.fulfill({status:response.status(),contentType:'text/javascript',body:source+'\nwindow.__valdoraSmoke={world,renderer,chooseBuilding,actAt,updateUI,closeSelection,selectBuilding};'});
});
try{
 await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.getElementById('world-loading'),{timeout:60000});
 const is3d=await page.locator('body.graphics-3d').count();
 if(!is3d){const status=await page.locator('#graphics-status').innerText();console.error('Fallo WebGL:',status,'Errores:',errors);throw Error('El renderizador no inició WebGL 3D: '+status+' | '+errors.join(' | '));}
 await page.locator('#start-game').click();
 // El primer arranque debe seleccionar calidad Ligera.
 await page.locator('#settings-btn').click();
 assert.equal(await page.locator('[data-quality="low"].active').count(),1,'El juego debe iniciar en calidad Ligera');
 assert.equal((await page.locator('#quality-indicator').innerText()).trim(),'Gráficos: Ligera');
 assert.equal(await page.locator('body').getAttribute('data-graphics-quality'),'low');
 // Comprobación de arranque real; evitamos recargar en SwiftShader, que puede bloquear la navegación en CI.
 await page.locator('#menu-resume').click();
 // Probar la cantera y su representación real dentro del renderizador WebGL.
 const mine=await page.evaluate(async()=>{
  const {world,renderer,chooseBuilding,actAt,updateUI}=window.__valdoraSmoke;
  const {stoneRemaining}=await import('./stone-deposits.mjs');
  const T=await import('./vendor/three.module.js');
  world.resources.wood=200;world.resources.stone=200;let site=null;
  outer:for(let y=8;y<54;y++)for(let x=8;x<54;x++){
   if(world.canPlace('quarry',x,y).ok){site={x,y};break outer;}
  }
  if(!site)throw Error('No existe terreno compatible para la cantera.');
  chooseBuilding('quarry');
  const originalPick=renderer.pick;
  renderer.pick=()=>site;
  try{actAt({x:0,y:0});}finally{renderer.pick=originalPick;}
  const placed={building:world.buildings.find(b=>b.type==='quarry'&&b.x===site.x&&b.y===site.y)};
  if(!placed.building)throw Error('La cantera no se construyó desde la interfaz.');
  const panel=document.querySelector('#selection-panel');
  if(panel.hidden||!panel.querySelector('[data-quarry-reserve]'))
   throw Error('La cantera recién colocada debe abrir su panel con unidades disponibles.');
  if(renderer.buildMode!==null)throw Error('No salió del modo construcción para mostrar la cantera.');
  const reserveDuringConstruction=panel.querySelector('[data-quarry-reserve]').textContent.trim();
  const constructionStatus=panel.querySelector('[data-quarry-status]').textContent.trim();
  const reserveBefore=world.stoneAround(placed.building);
  placed.building.progress=1;placed.building.workers=2;world.assignJobs();updateUI();
  const productionStatus=panel.querySelector('[data-quarry-status]').textContent.trim();
  const rock=world.findQuarryDeposit(placed.building),before=stoneRemaining(rock);
  const chunk=[...renderer.chunkVisuals.values()].find(c=>c.detail&&c.rockTiles.some(t=>t.x===rock.x&&t.y===rock.y));
  if(!chunk)throw Error('No se representó en 3D la roca explotable cercana.');
  const index=chunk.rockTiles.findIndex(t=>t.x===rock.x&&t.y===rock.y);
  const matrix=new T.Matrix4();chunk.rockInstances.getMatrixAt(index,matrix);
  const beforeScale=new T.Vector3();matrix.decompose(new T.Vector3(),new T.Quaternion(),beforeScale);
  const stock=world.resources.stone;
  world.tick();updateUI();
  const reserveAfter=world.stoneAround(placed.building);
  const reserveShown=panel.querySelector('[data-quarry-reserve]').textContent.trim();
  renderer.scopeVisualChunk(chunk,()=>renderer.refreshRocks());
  chunk.rockInstances.getMatrixAt(index,matrix);
  const afterScale=new T.Vector3();matrix.decompose(new T.Vector3(),new T.Quaternion(),afterScale);
  renderer.invalidate();
  return {stoneBefore:before,stoneAfter:stoneRemaining(rock),stockBefore:stock,stockAfter:world.resources.stone,
   beforeScale:beforeScale.x,afterScale:afterScale.x,scar:rock.stoneScar,workerCount:placed.building.workers,
   reserveBefore,reserveAfter,reserveShown,reserveDuringConstruction,constructionStatus,productionStatus};
 });
 assert.equal(mine.workerCount,2);
 assert.equal(mine.constructionStatus,'En construcción');
 assert.equal(mine.productionStatus,'En explotación');
 assert.equal(mine.reserveDuringConstruction,mine.reserveBefore.toLocaleString('es')+' unidades');
 assert.equal(mine.reserveBefore-mine.reserveAfter,4);
 assert.equal(mine.reserveShown,mine.reserveAfter.toLocaleString('es')+' unidades');
 assert.equal(mine.stockAfter-mine.stockBefore,4);
 assert.equal(mine.stoneBefore-mine.stoneAfter,4);
 assert.equal(mine.scar,true);
 assert.ok(mine.afterScale<mine.beforeScale,'La roca 3D debe encogerse al agotarse');
 // La prueba anterior invocaba actAt directamente. Ahora hacemos un clic
 // FÍSICO de Playwright sobre la cantera para reproducir la acción del jugador.
 const target=await page.evaluate(async()=>{
  const {world,renderer,closeSelection}=window.__valdoraSmoke;
  const T=await import('./vendor/three.module.js');
  const b=world.buildings.find(b=>b.type==='quarry');
  renderer.focus(b.x+b.w/2,b.y+b.h/2);
  renderer.syncBuildings();closeSelection();
  const center=new T.Vector3(b.x+b.w/2,renderer.heightAt(b.x+b.w/2,b.y+b.h/2)+.7,b.y+b.h/2);
  const projected=center.project(renderer.viewCamera);
  const rect=renderer.canvas.getBoundingClientRect();
  const sx=(projected.x+1)*rect.width/2,sy=(1-projected.y)*rect.height/2;
  for(let dy=-10;dy<=10;dy+=2)for(let dx=-10;dx<=10;dx+=2){
   const x=sx+dx,y=sy+dy;
   if(renderer.pickBuilding(x,y)!==b.id)continue;
   const absoluteX=x+rect.left,absoluteY=y+rect.top;
   if(document.elementFromPoint(absoluteX,absoluteY)===renderer.canvas)
    return {x:absoluteX,y:absoluteY,id:b.id};
  }
  throw Error('No se puede pulsar la cantera sobre el mapa a la distancia normal de cámara.');
 });
 await page.mouse.click(target.x,target.y);
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#selection-panel').isVisible(),true,'El clic debe abrir la ficha visible');
 assert.equal(await page.locator('#quarry-inspector').isVisible(),true,'La reserva también debe mostrarse en el mapa');
 assert.match(await page.locator('[data-quarry-primary]').innerText(),/unidades/);
 assert.match(await page.locator('#quarry-inspector').innerText(),/piedras disponibles/);
 const visual=await page.evaluate(()=>{
  const {renderer}=window.__valdoraSmoke;
  const panel=document.querySelector('#selection-panel');
  const circle=renderer.quarryArea;
  return {
   visible:circle.visible,
   fillVertices:renderer.quarryFill.geometry.getAttribute('position')?.count||0,
   borderVertices:renderer.quarryBorder.geometry.getAttribute('position')?.count||0,
   panelBox:panel.getBoundingClientRect().toJSON(),
   panelDisplay:getComputedStyle(panel).display,
   circleColor:renderer.quarryBorder.material.color.getHexString()
  };
 });
 assert.equal(visual.visible,true,'El círculo de influencia debe ser visible al seleccionar');
 assert.ok(visual.fillVertices>=200,'El círculo debe tener un relleno geométrico real');
 assert.ok(visual.borderVertices>=400,'El borde del círculo debe ser grueso');
 assert.notEqual(visual.panelDisplay,'none','La ficha debe ser visible por CSS');
 assert.ok(visual.panelBox.width>190&&visual.panelBox.height>100);

 // La cabaña recolectora deja de ser la única que expone su zona:
 // comprobar 3D real, panel de recursos y ancho de círculo en el resto.
 const workers=await page.evaluate(async()=>{
  const {world,renderer,selectBuilding}=window.__valdoraSmoke;
  const {BUILDINGS}=await import('./sim.mjs');
  const {workArea}=await import('./work-areas.mjs');
  const report=[];
  world.resources.wood=450;world.resources.stone=450;
  const kinds=['gatherer','forester','woodcutter','farm','pasture','fisher'];
  for(const type of kinds){
   const d=BUILDINGS[type];let site=null;
   outer:for(let y=6;y<68;y++)for(let x=6;x<68;x++){
    if(world.canPlace(type,x,y).ok){site={x,y};break outer;}
   }
   if(!site)throw Error('No hay parcela adecuada para '+type);
   const result=world.place(type,site.x,site.y);
   if(!result.ok||!result.building)throw Error('Error de construcción: '+type);
   result.building.progress=1;result.building.workers=1;
   world.assignJobs();
   selectBuilding(result.building.id);
   const panel=document.getElementById('selection-panel');
   const hud=document.getElementById('quarry-inspector');
   const info=panel.querySelector('[data-work-area]');
   const circle=renderer.quarryArea;
   report.push({
    type,selected:renderer.selected===result.building.id,panelVisible:!panel.hidden&&getComputedStyle(panel).display!=='none',
    hudVisible:!hud.hidden&&getComputedStyle(hud).display!=='none',
    kind:info?.dataset.workType,metric:info?.querySelector('[data-work-area-value]')?.textContent,
    note:info?.querySelector('.work-area-note')?.textContent,
    circle:circle.visible,key:renderer.quarryAreaKey,expectedRadius:workArea(type).radius,
    geometry:renderer.quarryBorder.geometry.getAttribute('position')?.count||0,
    hudText:hud.textContent
   });
  }
  return report;
 });
 for(const item of workers){
  assert.equal(item.selected,true,item.type+' no quedó seleccionado');
  assert.equal(item.panelVisible,true,item.type+' no muestra ficha');
  assert.equal(item.hudVisible,true,item.type+' no muestra datos en el mapa');
  assert.equal(item.kind,item.type,item.type+' confunde sus métricas');
  assert.ok(item.metric.length>=2,item.type+' no muestra recursos o producción');
  assert.equal(item.circle,true,item.type+' no muestra su círculo');
  assert.ok(item.geometry>=400,item.type+' no dibuja contorno suficientemente grueso');
  assert.ok(item.key.includes(':'+item.expectedRadius+':'),item.type+' usa radio equivocado '+item.key);
  assert.ok(item.hudText.includes('Radio '+item.expectedRadius));
 }
 assert.match(workers.find(item=>item.type==='woodcutter').note,/no tala/);

 // Regresión del coste: en calidad Ligera no se construyen instancias
 // de hierba invisibles ni se vuelve a consultar un sector sin cambios.
 const performance=await page.evaluate(()=>{
  const {world,renderer}=window.__valdoraSmoke;
  const detailed=[...renderer.chunkVisuals.values()].find(c=>c.detail);
  if(!detailed)throw Error('Falta algún sector con vegetación para el test de rendimiento.');
  renderer.refreshVisualChunk(detailed);
  const active=renderer.chunkVisuals.get(detailed.key);
  if(!active?.detail)throw Error('El sector detallado no se mantuvo activo.');
  const original=world.chunks.getChunk;
  let reads=0;
  world.chunks.getChunk=function(...args){reads++;return original.apply(this,args);};
  try{renderer.refreshVisualChunk(active);}
  finally{world.chunks.getChunk=original;}
  const bed=renderer.water.material.uniforms.uBed.value;
  return {
   quality:renderer.quality,pixelRatio:renderer.gl.getPixelRatio(),grassCreated:!!active.grassInst,
   terrainSegments:active.terrain.geometry.parameters.widthSegments,
   waterSize:bed.image.width,waterSpan:renderer.water.geometry.parameters.width,
   lowWaterShader:renderer.water.material.uniforms.uLow.value,
   unnecessaryChunkReads:reads
  };
 });
 assert.equal(performance.quality,'low');
 assert.equal(performance.pixelRatio,.8,'La calidad Ligera debe dibujar menos píxeles en la GPU');
 assert.equal(performance.grassCreated,false,'No generar hierba invisible en calidad Ligera');
 assert.equal(performance.terrainSegments,20,'El terreno distante debe emplear mallas más ligeras');
 assert.equal(performance.waterSize,80,'Reducir cuatro veces los muestreos del agua');
 assert.equal(performance.waterSpan,768);
 assert.equal(performance.lowWaterShader,1,'La calidad Ligera debe utilizar el shader simplificado del agua');
 assert.equal(performance.unnecessaryChunkReads,0,'No regenerar sectores intactos entre días');

 // La geometría de las copas se debe construir UNA sola vez, incluso si
 // aparecen varias regiones en la cámara.
 const geometryReuse=await page.evaluate(async()=>{
  const {renderer}=window.__valdoraSmoke;
  const T=await import('./vendor/three.module.js');
  const first=renderer.treeTemplate(0),second=renderer.treeTemplate(0);
  const oak=renderer.treeTemplate(2);
  const rock=renderer.rockTemplate(),sameRock=renderer.rockTemplate();
  const active=[...renderer.chunkVisuals.values()].find(chunk=>chunk.detail&&chunk.treeInstances.length);
  if(!active)throw Error('Falta vegetación detallada para probar geometría compartida.');
  const known=[...first,...renderer.treeTemplate(1),...oak].map(x=>x.geometry);
  const linked=active.treeInstances.every(inst=>known.includes(inst.geometry));
  const disposable=new T.Group();
  disposable.add(new T.InstancedMesh(first[0].geometry,first[0].material,1));
  const original=first[0].geometry.dispose;
  let disposed=0;
  first[0].geometry.dispose=function(){disposed++;};
  try{renderer.disposeGroup(disposable);}
  finally{first[0].geometry.dispose=original;}
  return {
   reused:first===second,rockReused:rock===sameRock,
   linked,knownCount:renderer.sharedChunkGeometries.size,
   preserved:disposed===0,
   sharedRock:renderer.sharedChunkGeometries.has(rock),
   firstColor:renderer.materials.needles.color.getHexString()
  };
 });
 assert.equal(geometryReuse.reused,true,'Los modelos de árboles deben reutilizarse entre sectores');
 assert.equal(geometryReuse.rockReused,true,'Las rocas deben compartir geometría');
 assert.equal(geometryReuse.linked,true,'Los árboles renderizados deben usar las geometrías comunes');
 assert.equal(geometryReuse.preserved,true,'Eliminar un sector no debe destruir geometría compartida');
 assert.equal(geometryReuse.sharedRock,true);
 assert.ok(geometryReuse.knownCount>=5,'Debe existir una caché pequeña de geometrías');
 const stationary=await page.evaluate(()=>{
  const {renderer}=window.__valdoraSmoke;
  renderer.syncPeople(renderer.time);
  const original=renderer.heightAt;
  let terrainSamples=0;
  renderer.heightAt=function(...args){terrainSamples++;return original.apply(this,args);};
  try{renderer.syncPeople(renderer.time+.016);}
  finally{renderer.heightAt=original;}
  return {terrainSamples,citizens:renderer.people.size};
 });
 assert.ok(stationary.citizens>0,'Debe haber habitantes en la partida de prueba');
 assert.equal(stationary.terrainSamples,0,'Los aldeanos quietos no deben recalcular su altura');

 // Verificar el defecto real: antes incluso las hojas opacas y el suelo al
 // 100 % seguían sin escribir profundidad y se superponían según el ángulo.
 const foliage=await page.evaluate(async()=>{
  const {renderer}=window.__valdoraSmoke;
  const T=await import('./vendor/three.module.js');
  const {treeModel}=await import('./models3d.mjs');
  const before={};
  const g=new T.Group(),leaf=new T.Mesh(new T.PlaneGeometry(1,1),renderer.materials.leaves);
  const terrain=new T.Mesh(new T.PlaneGeometry(1,1),renderer.materials.ground);
  g.add(leaf,terrain);
  const fade=renderer.fadeObjects([g],.45);
  before.partial=fade.states.map(x=>({transparent:x.material.transparent,depthWrite:x.material.depthWrite,alphaTest:x.material.alphaTest}));
  renderer.applyFadeOpacity(fade,1);
  before.full=fade.states.map(x=>({transparent:x.material.transparent,depthWrite:x.material.depthWrite,alphaTest:x.material.alphaTest}));
  renderer.applyFadeOpacity(fade,.5);
  before.receding=fade.states.map(x=>({transparent:x.material.transparent,depthWrite:x.material.depthWrite}));
  renderer.applyFadeOpacity(fade,1);
  before.restored=fade.states.every(x=>x.material.depthWrite&&!x.material.transparent);
  for(const material of fade.materials)material.dispose();
  leaf.geometry.dispose();terrain.geometry.dispose();

  // Los árboles necesitan una copa tridimensional incluso cuando las hojas
  // de textura se ven de canto desde arriba o al rotar la cámara.
  const crowns=[];
  for(const variant of [0,1,2]){
   const model=treeModel(renderer.materials,variant);
   const volume=model.children.find(x=>x.material===renderer.materials.canopy);
   if(!volume)throw Error('Sin copa volumétrica para árbol '+variant);
   volume.geometry.computeBoundingBox();
   const dims=new T.Vector3();volume.geometry.boundingBox.getSize(dims);
   crowns.push({variant,x:dims.x,y:dims.y,z:dims.z,triangles:volume.geometry.getAttribute('position').count/3});
   model.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();});
  }

  const detail=[...renderer.chunkVisuals.values()].find(c=>c.detail&&c.treeInstances.length);
  if(!detail)throw Error('No hay árboles visibles en el sector detallado');
  const position=detail.terrain.geometry.getAttribute('position');
  const first=position.getY(0);
  const height=renderer.scopeVisualChunk(detail,()=>renderer.visualGroundHeightAt(detail.cx*64,detail.cy*64));
  const angle=renderer.azimuth;
  for(const direction of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   renderer.azimuth=direction;
   renderer.updateCamera();
   renderer.gl.render(renderer.scene,renderer.viewCamera);
  }
  renderer.azimuth=angle;renderer.updateCamera();
  return {before,crowns,groundVertex:first,treeGround:height};
 });
 for(const state of foliage.before.partial)assert.equal(state.depthWrite,false);
 for(const state of foliage.before.full){
  assert.equal(state.transparent,false,'El follaje y el terreno completos no deben mezclarse por transparencia');
  assert.equal(state.depthWrite,true,'Árboles y suelo deben ocultarse correctamente por profundidad');
 }
 for(const state of foliage.before.receding)assert.equal(state.depthWrite,false);
 assert.equal(foliage.before.restored,true,'El fundido no debe dejar los árboles permanentemente transparentes');
 assert.ok(foliage.before.full[0].alphaTest>.3,'Preservar la textura recortada original de las hojas');
 assert.equal(foliage.crowns.length,3);
 for(const crown of foliage.crowns){
  assert.ok(crown.x>0.5&&crown.y>0.5&&crown.z>0.5,'Copa 3D con volumen en todos los ejes '+crown.variant);
  assert.ok(crown.triangles>10,'La copa debe tener superficies reales, no solo láminas');
 }
 assert.ok(Math.abs(foliage.groundVertex-foliage.treeGround)<.0001,'La vegetación debe apoyarse en la malla visible de terreno');

 await page.waitForTimeout(1200);
 await page.keyboard.down('d');await page.waitForTimeout(1500);await page.keyboard.up('d');
 await page.keyboard.down('s');await page.waitForTimeout(1500);await page.keyboard.up('s');
 await page.waitForTimeout(1100);
 const seed=await page.locator('#seed-label').innerText();
 assert.match(seed,/sector|Región|región/i);
 assert.deepEqual(errors,[],'La renderización y el cambio de región no deben producir excepciones');
 console.log('WebGL2 operativo; controles de cámara y streaming sin errores:',seed);
 // No capturamos pantalla: las GPU software de CI ralentizan las capturas WebGL.
}finally{await browser.close();}
