import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/sim.mjs';
import {terrainSample,ALPINE_START_HEIGHT,isEconomicTerrain} from '../dist/terrain.mjs';
import {stoneCapacity,stoneRemaining} from '../dist/stone-deposits.mjs';

function alpineSite(world){
 for(let y=-1400;y<=1400;y+=29)for(let x=-1400;x<=1400;x+=29)
  if(terrainSample(x+.5,y+.5,world.seedNumber,world.coordinates).height>=ALPINE_START_HEIGHT+.8)
   return {x,y};
 throw Error('No se encontró una cumbre alpina en el mundo de prueba.');
}
test('los llanos presentan muy pocos árboles y los terrenos elevados pocas rocas',()=>{
 let plains=0,sparse=0,hills=0,alpine=0,sum=0,peak=0;
 for(const seed of [123456,56789])for(let y=-960;y<=960;y+=32)
  for(let x=-960;x<=960;x+=32){
   const t=terrainSample(x+.5,y+.5,seed,{x:0,y:0});
   if(['plain','steppe','meadow'].includes(t.biome)){
    plains++;sum+=t.treeDensity;
    if(t.treeDensity<=.015)sparse++;
   }
   if(t.biome==='hills'||t.biome==='mountain'){
    hills++;
    assert.ok(t.rockDensity<=.074,'Piedras demasiado densas en terreno elevado');
   }
   if(t.biome==='alpine'){
    alpine++;peak=Math.max(peak,t.height);
    assert.equal(t.rockDensity,0);
    assert.equal(t.treeDensity,0);
   }
  }
 assert.ok(plains>50,'Las llanuras deben ocupar una parte significativa del mapa');
 assert.ok(sparse/plains>.80,'Más del 80 % de llanuras y praderas deberían tener muy pocos árboles');
 assert.ok(sum/plains<.025,'Los terrenos llanos no deben parecer bosques');
 assert.ok(hills>50&&alpine>3,'Deben seguir existiendo colinas y cordilleras');
 assert.ok(peak>ALPINE_START_HEIGHT);
});
test('el umbral alpino bloquea construcción, caminos, acceso y recolección',()=>{
 const w=new World('CUMBRES-PROTEGIDAS'),site=alpineSite(w),t=w.tile(site.x,site.y);
 assert.equal(t.biome,'alpine');assert.equal(isEconomicTerrain(t),false);
 assert.ok(t.height>0);
 assert.equal(t.tree,false);assert.equal(t.rock,false);assert.equal(t.stoneLeft,0);
 for(const type of ['house','road','quarry','forester','gatherer','farm','fisher','pasture','woodcutter','warehouse']){
  const result=w.canPlace(type,site.x,site.y);
  assert.equal(result.ok,false,type+' debe estar prohibido');
  assert.match(result.reason,/alta montaña/i);
 }
 t.tree=true;t.rock=true;t.stoneLeft=25;t.bridge=true;w.rememberTile(t);
 assert.equal(w.passable(site.x,site.y),false,'Un puente antiguo tampoco permite explotar la alta montaña');
 assert.equal(w.markGather(site.x,site.y).ok,false,'La recolección manual también está prohibida');
 assert.equal(stoneCapacity(t),0);assert.equal(stoneRemaining(t),0);
});
test('ni una cantera cercana ni una orden antigua pueden aprovechar depósitos alpinos',()=>{
 const w=new World('CUMBRES-SIN-EXPLOTAR'),site=alpineSite(w),t=w.tile(site.x,site.y);
 t.tree=true;t.rock=true;t.stoneLeft=28;t.marked=true;w.rememberTile(t);
 const b={x:site.x-1,y:site.y-1,w:3,h:3,type:'quarry'};
 // Mundo sintético en que la única roca disponible es alpina.
 const alpineOnly={tile(){return t;}};
 assert.equal(World.prototype.findQuarryDeposit.call(alpineOnly,b),null);
 assert.equal(World.prototype.stoneAround.call(alpineOnly,b),0);
 assert.equal(World.prototype.forestAt.call(alpineOnly,b,8),0);
 w.gatherQueue=[{x:site.x,y:site.y,progress:0}];
 const stoneBefore=w.resources.stone,woodBefore=w.resources.wood;
 w.tick();
 assert.equal(w.resources.stone,stoneBefore);
 assert.equal(w.resources.wood,woodBefore);
 assert.equal(w.gatherQueue.length,0,'Las órdenes de extracción antiguas deben descartarse');
 assert.equal(t.marked,false);
 const saved=JSON.parse(JSON.stringify(w.serialize()));
 const restored=new World(saved.seed,saved),rt=restored.tile(site.x,site.y);
 assert.equal(rt.biome,'alpine');
 assert.equal(stoneRemaining(rt),0);
 assert.equal(restored.markGather(site.x,site.y).ok,false);
});
