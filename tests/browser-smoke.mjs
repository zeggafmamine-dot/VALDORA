import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push('JavaScript: '+e.message));
page.on('console',m=>{if(m.type()==='error'&&/No se pudo iniciar|Uncaught|Error de shader/.test(m.text()))errors.push('Consola: '+m.text());});
try{
 await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.getElementById('world-loading'),{timeout:60000});
 assert.equal(await page.locator('body.graphics-3d').count(),1,'El renderizador debe iniciarse en WebGL 3D, no en 2D de respaldo');
 await page.locator('#start-game').click();
 await page.waitForTimeout(1800);
 await page.keyboard.down('d');await page.waitForTimeout(1500);await page.keyboard.up('d');
 await page.keyboard.down('s');await page.waitForTimeout(1500);await page.keyboard.up('s');
 await page.waitForTimeout(1100);
 const seed=await page.locator('#seed-label').innerText();
 assert.match(seed,/sector|Región|región/i);
 assert.deepEqual(errors,[],'La renderización y el cambio de región no deben producir excepciones');
 console.log('WebGL2 operativo; controles de cámara y streaming sin errores:',seed);
 await page.screenshot({path:'valdora-webgl-smoke.png'});
}finally{await browser.close();}
