import test from 'node:test';
import assert from 'node:assert/strict';
import {desiredChunks,visibilityTarget,approachOpacity,shouldRetire,CHUNK_WIDTH,
 VISUAL_RADIUS,MAX_VISUAL_CHUNKS,FULL_DETAIL_DISTANCE,FADE_OUT_DISTANCE,FADE_BAND,
 CAMERA_DISTANCE,DEFAULT_GRAPHICS_QUALITY,renderDistanceForZoom,AdaptiveHorizon,
 INITIAL_HORIZON,MAX_HORIZON,MIN_HORIZON} from '../dist/stream-window.mjs';

test('sectores de 64×64 y horizonte amplio sin agrandar la zona de transición',()=>{
 assert.equal(CHUNK_WIDTH,64);
 assert.equal(VISUAL_RADIUS,4);
 assert.equal(MAX_VISUAL_CHUNKS,70);
 assert.equal(CAMERA_DISTANCE,112);
 assert.equal(DEFAULT_GRAPHICS_QUALITY,'low');
 assert.equal(FADE_BAND,74);
 assert.equal(FADE_OUT_DISTANCE-FULL_DETAIL_DISTANCE,74);
 assert.equal(MAX_HORIZON,224);
 assert.equal(INITIAL_HORIZON,180);
 assert.equal(MIN_HORIZON,160);
 assert.equal(FADE_OUT_DISTANCE,224);
 assert.equal(FULL_DETAIL_DISTANCE,150);
 // Aproximadamente la mitad de superficie, NO la mitad de distancia (que recortaría demasiado).
 for(const [before,after] of [[224,MIN_HORIZON],[256,INITIAL_HORIZON],[320,MAX_HORIZON]]){
  const fraction=(after/before)**2;
  assert.ok(fraction>=.48&&fraction<=.52,'La superficie cargada debe ser cerca del 50%');
 }
 assert.equal(CAMERA_DISTANCE,112,'El zoom de la cámara no debe cambiar');
 // La vista mantiene exactamente la misma cámara (112) y banda de fundido (74).
 assert.ok(MAX_VISUAL_CHUNKS<420/2);
 assert.equal(desiredChunks(0,0).length,81);
 const active=desiredChunks(0,0,VISUAL_RADIUS,MAX_HORIZON).filter(c=>c.opacity>.005);
 assert.ok(active.length<=70,'El horizonte normal no debe requerir más mallas que el límite de GPU');
 for(const x of [31.5,63.9,64,64.1,79,128,239]){
  const wanted=desiredChunks(x,80);
  assert.equal(wanted.length,81);
  assert.ok(Math.abs(wanted[0].x-Math.floor(x/64))<=1);
  assert.ok(wanted.every(v=>Number.isFinite(v.opacity)&&v.opacity>=0&&v.opacity<=1));
 }
});
test('el borde de aparición sigue a la cámara: sin salto al cruzar casillas 64×64',()=>{
 const before=visibilityTarget(3,0,-10,32);
 const far=visibilityTarget(3,0,0,32);
 const approaching=visibilityTarget(3,0,20,32);
 const near=visibilityTarget(3,0,50,32);
 const inside=visibilityTarget(3,0,100,32);
 assert.equal(before,0);assert.equal(far,0);
 assert.ok(far<approaching&&approaching<near&&near<=inside);
 assert.equal(inside,1);
 const justBefore=visibilityTarget(3,0,63.99,32);
 const justAfter=visibilityTarget(3,0,64.01,32);
 assert.ok(Math.abs(justBefore-justAfter)<.01);
});
test('al ajustar el horizonte por rendimiento el fundido sigue teniendo 74 casillas',()=>{
 for(const horizon of [MIN_HORIZON,180,208,MAX_HORIZON]){
  const sector=Math.floor(horizon/64);
  const cx=sector,cy=0;
  const d=Math.abs(cx*64+32);
  const xBefore=d-horizon-1,xAfter=d-(horizon-FADE_BAND)+1;
  assert.equal(visibilityTarget(cx,cy,xBefore,32,horizon),0);
  assert.equal(visibilityTarget(cx,cy,xAfter,32,horizon),1);
  const halfway=d-(horizon-FADE_BAND/2);
  assert.ok(Math.abs(visibilityTarget(cx,cy,halfway,32,horizon)-.5)<.00001);
 }
});
test('el zoom limita la carga de sectores invisibles, sin recortar la transición',()=>{
 assert.equal(renderDistanceForZoom(1,INITIAL_HORIZON),INITIAL_HORIZON);
 assert.equal(renderDistanceForZoom(.38,MAX_HORIZON),MAX_HORIZON);
 assert.equal(renderDistanceForZoom(10,MAX_HORIZON),MIN_HORIZON);
 assert.ok(renderDistanceForZoom(1,MAX_HORIZON)<=MAX_HORIZON);
 assert.equal(shouldRetire(-6,0,0,32),true);
 assert.equal(shouldRetire(-4,0,0,32),false);
});
test('la opacidad cambia gradualmente entre fotogramas',()=>{
 let alpha=0;const values=[];
 for(let i=0;i<24;i++){alpha=approachOpacity(alpha,1,.016);values.push(alpha);}
 assert.ok(values[0]>0&&values[0]<.2);
 assert.ok(values.every((v,i)=>i===0||v>values[i-1]));
 assert.ok(values.at(-1)<1);
 const down=approachOpacity(alpha,0,.016);
 assert.ok(down<alpha&&down>0);
});
test('el mapa se amplía de forma autónoma cuando sobran FPS',()=>{
 const horizon=new AdaptiveHorizon();
 assert.equal(horizon.distance,INITIAL_HORIZON);
 for(let i=0;i<1000;i++)horizon.observe(1/60);
 assert.ok(horizon.distance>INITIAL_HORIZON);
 assert.ok(horizon.distance<=MAX_HORIZON);
 for(let i=0;i<4000;i++)horizon.observe(1/60);
 assert.equal(horizon.distance,MAX_HORIZON);
});
test('el mapa se reduce ante bajo rendimiento, manteniendo el mínimo necesario',()=>{
 const horizon=new AdaptiveHorizon();
 for(let i=0;i<1000;i++)horizon.observe(1/16);
 assert.equal(horizon.distance,MIN_HORIZON);
 assert.equal(horizon.observe(3),MIN_HORIZON,'Al cambiar de pestaña no altera el presupuesto');
 for(let i=0;i<1000;i++)horizon.observe(1/16);
 assert.equal(horizon.distance,MIN_HORIZON);
});
