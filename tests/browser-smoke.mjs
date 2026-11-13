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
 await route.fulfill({status:response.status(),contentType:'text/javascript',body:source+'\nwindow.__valdoraSmoke={world,renderer};'});
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
  const {world,renderer}=window.__valdoraSmoke;
  const {stoneRemaining}=await import('./stone-deposits.mjs');
  const T=await import('./vendor/three.module.js');
  world.resources.wood=200;world.resources.stone=200;let site=null;
  outer:for(let y=8;y<54;y++)for(let x=8;x<54;x++){
   if(world.canPlace('quarry',x,y).ok){site={x,y};break outer;}
  }
  if(!site)throw Error('No existe terreno compatible para la cantera.');
  const placed=world.place('quarry',site.x,site.y);
  if(!placed.ok)throw Error('Fallo al construir cantera: '+placed.reason);
  placed.building.progress=1;placed.building.workers=2;world.assignJobs();
  const rock=world.findQuarryDeposit(placed.building),before=stoneRemaining(rock);
  const chunk=[...renderer.chunkVisuals.values()].find(c=>c.detail&&c.rockTiles.some(t=>t.x===rock.x&&t.y===rock.y));
  if(!chunk)throw Error('No se representó en 3D la roca explotable cercana.');
  const index=chunk.rockTiles.findIndex(t=>t.x===rock.x&&t.y===rock.y);
  const matrix=new T.Matrix4();chunk.rockInstances.getMatrixAt(index,matrix);
  const beforeScale=new T.Vector3();matrix.decompose(new T.Vector3(),new T.Quaternion(),beforeScale);
  const stock=world.resources.stone;
  world.tick();
  renderer.scopeVisualChunk(chunk,()=>renderer.refreshRocks());
  chunk.rockInstances.getMatrixAt(index,matrix);
  const afterScale=new T.Vector3();matrix.decompose(new T.Vector3(),new T.Quaternion(),afterScale);
  renderer.invalidate();
  return {stoneBefore:before,stoneAfter:stoneRemaining(rock),stockBefore:stock,stockAfter:world.resources.stone,
   beforeScale:beforeScale.x,afterScale:afterScale.x,scar:rock.stoneScar,workerCount:placed.building.workers};
 });
 assert.equal(mine.workerCount,2);
 assert.equal(mine.stockAfter-mine.stockBefore,4);
 assert.equal(mine.stoneBefore-mine.stoneAfter,4);
 assert.equal(mine.scar,true);
 assert.ok(mine.afterScale<mine.beforeScale,'La roca 3D debe encogerse al agotarse');
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
