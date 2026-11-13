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
 await route.fulfill({status:response.status(),contentType:'text/javascript',body:source+'\nwindow.__valdoraSmoke={world,renderer,chooseBuilding,actAt,updateUI,closeSelection};'});
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
