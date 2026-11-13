import test from 'node:test';
import assert from 'node:assert/strict';
import {activateStartupQuality,qualityLabel,STARTUP_QUALITY} from '../dist/graphics-preset.mjs';

test('cada inicio, incluso tras cambiar a Alta, vuelve a Ligera',()=>{
 const body={dataset:{}};
 const calls=[];
 const renderer={quality:'high',setQuality(q){calls.push(q);this.quality=q;}};
 assert.equal(activateStartupQuality(renderer,body),'low');
 assert.equal(renderer.quality,'low');
 renderer.setQuality('medium');
 assert.equal(renderer.quality,'medium');
 activateStartupQuality(renderer,body);
 assert.equal(renderer.quality,STARTUP_QUALITY);
 assert.equal(body.dataset.graphicsQuality,'low');
 assert.deepEqual(calls,['low','medium','low']);
});
test('modo 2D compatible también abre con perfil ligero',()=>{
 const renderer={zoom:1};
 activateStartupQuality(renderer,{dataset:{}});
 assert.equal(renderer.quality,'low');
 assert.equal(qualityLabel(renderer.quality,false),'Vista 2D ligera');
});
test('etiquetas de calidad reflejan la configuración activa',()=>{
 assert.equal(qualityLabel('low'),'Gráficos: Ligera');
 assert.equal(qualityLabel('medium'),'Gráficos: Equilibrada');
 assert.equal(qualityLabel('high'),'Gráficos: Alta');
});
