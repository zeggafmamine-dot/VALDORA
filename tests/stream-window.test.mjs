import test from 'node:test';
import assert from 'node:assert/strict';
import {desiredChunks,visibilityTarget,approachOpacity,shouldRetire,CHUNK_WIDTH} from '../dist/stream-window.mjs';

test('los sectores de 64x64 se ordenan según la cámara, no por cambios bruscos de región',()=>{
 assert.equal(CHUNK_WIDTH,64);
 for(const x of [31.5,63.9,64,64.1,79,128,239]){
  const wanted=desiredChunks(x,80);
  assert.equal(wanted.length,25);
  assert.ok(Math.abs(wanted[0].x-Math.floor(x/64))<=1,'El sector más cercano puede estar al otro lado de una frontera');
  assert.ok(wanted.every(v=>Number.isFinite(v.opacity)&&v.opacity>=0&&v.opacity<=1));
 }
});
test('al acercarse a un borde surge progresivamente el sector siguiente',()=>{
 const before=visibilityTarget(2,0,-10,32),far=visibilityTarget(2,0,0,32);
 const near=visibilityTarget(2,0,64,32),inside=visibilityTarget(2,0,128,32);
 assert.ok(before<=far&&far<near&&near<=inside);
 assert.ok(far<1);
 const justBefore=visibilityTarget(2,0,63.99,32);
 const justAfter=visibilityTarget(2,0,64.01,32);
 assert.ok(Math.abs(justBefore-justAfter)<.01,'No debe existir un salto al cruzar 64');
});
test('los sectores detrás de la cámara desaparecen gradualmente',()=>{
 const old=visibilityTarget(-2,0,0,32);
 const moved=visibilityTarget(-2,0,75,32);
 assert.ok(old>moved);
 assert.equal(visibilityTarget(-2,0,150,32),0);
 assert.equal(shouldRetire(-4,0,0,32),true);
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
