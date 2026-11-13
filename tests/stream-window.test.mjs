import test from 'node:test';
import assert from 'node:assert/strict';
import {desiredChunks,visibilityTarget,approachOpacity,shouldRetire,CHUNK_WIDTH,VISUAL_RADIUS,MAX_VISUAL_CHUNKS,FULL_DETAIL_DISTANCE,FADE_OUT_DISTANCE,CAMERA_DISTANCE,DEFAULT_GRAPHICS_QUALITY} from '../dist/stream-window.mjs';

test('los sectores de 64x64 se ordenan según la cámara, no por cambios bruscos de región',()=>{
 assert.equal(CHUNK_WIDTH,64);
 assert.equal(VISUAL_RADIUS,8);
 assert.equal(MAX_VISUAL_CHUNKS,300);
 assert.equal(FADE_OUT_DISTANCE,170*3);
 assert.equal(CAMERA_DISTANCE,28*3);
 assert.equal(DEFAULT_GRAPHICS_QUALITY,'low');
 assert.equal(FADE_OUT_DISTANCE-FULL_DETAIL_DISTANCE,74,'La transición mantiene el mismo ancho');
 for(const x of [31.5,63.9,64,64.1,79,128,239]){
  const wanted=desiredChunks(x,80);
  assert.equal(wanted.length,289);
  assert.ok(Math.abs(wanted[0].x-Math.floor(x/64))<=1,'El sector más cercano puede estar al otro lado de una frontera');
  assert.ok(wanted.every(v=>Number.isFinite(v.opacity)&&v.opacity>=0&&v.opacity<=1));
 }
});
test('al acercarse a un borde surge progresivamente el sector siguiente',()=>{
 const far=visibilityTarget(8,0,0,32),approaching=visibilityTarget(8,0,50,32);
 const near=visibilityTarget(8,0,100,32),inside=visibilityTarget(8,0,140,32);
 assert.ok(far<approaching&&approaching<near&&near<=inside);
 assert.equal(far,0);
 const justBefore=visibilityTarget(8,0,63.99,32);
 const justAfter=visibilityTarget(8,0,64.01,32);
 assert.ok(Math.abs(justBefore-justAfter)<.01,'No debe existir un salto al cruzar 64');
});
test('los sectores detrás de la cámara desaparecen gradualmente',()=>{
 const old=visibilityTarget(-8,0,0,32);
 const moved=visibilityTarget(-8,0,75,32);
 assert.ok(old>moved);
 assert.equal(visibilityTarget(-8,0,150,32),0);
 assert.equal(shouldRetire(-11,0,0,32),true);
 assert.equal(shouldRetire(1,0,0,32),false);
});
test('la opacidad cambia gradualmente entre fotogramas, sin saltar de 0 a 1',()=>{
 let alpha=0;
 const values=[];
 for(let i=0;i<24;i++){alpha=approachOpacity(alpha,1,.016);values.push(alpha);}
 assert.ok(values[0]>0&&values[0]<.2);
 assert.ok(values.every((v,i)=>i===0||v>values[i-1]));
 assert.ok(values.at(-1)<1);
 const down=approachOpacity(alpha,0,.016);
 assert.ok(down<alpha&&down>0);
});
