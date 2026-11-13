import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push('JavaScript: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('Consola: '+m.text());});
try{
 await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.getElementById('world-loading'),{timeout:60000});
 const is3d=await page.locator('body.graphics-3d').count();
 if(!is3d){const status=await page.locator('#graphics-status').innerText();console.error('Fallo WebGL:',status,'Errores:',errors);throw Error('El renderizador no inició WebGL 3D: '+status+' | '+errors.join(' | '));}
 await page.locator('#start-game').click();
 // El primer arranque debe seleccionar calidad Ligera.
 await page.locator('#settings-btn').click();
 assert.equal(await page.locator('[data-quality="low"].active').count(),1,'El juego debe iniciar en calidad Ligera');
 // El renderizado software de CI utiliza solo calidad Ligera; una segunda carga
 // confirma que el ajuste predeterminado sigue aplicándose tras recuperar una partida.
 await page.reload({waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>!document.getElementById('world-loading'),{timeout:60000});
 assert.equal(await page.locator('body.graphics-3d').count(),1,'La recarga debe conservar WebGL');
 await page.locator('#settings-btn').click();
 assert.equal(await page.locator('[data-quality="low"].active').count(),1,'Cada inicio debe restaurar calidad Ligera');
 await page.locator('#menu-resume').click();
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
