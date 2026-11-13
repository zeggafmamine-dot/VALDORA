import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainSample,LANDSCAPE_BIOMES} from '../dist/terrain.mjs';
import {World} from '../dist/sim.mjs';

test('los biomas se forman en regiones coherentes y no de forma aleatoria por casilla',()=>{
 const seed=123456,c={x:0,y:0};
 for(const [x,y] of [[63.999,17],[-64.001,-19],[222.5,-319.4],[688,441]]){
  const a=terrainSample(x,y,seed,c),b=terrainSample(x+.002,y+.002,seed,c);
  assert.ok(Math.abs(a.height-b.height)<.05,'El relieve debe ser continuo en los bordes');
  assert.ok(Math.abs(a.treeDensity-b.treeDensity)<.025,'La vegetación debe variar gradualmente');
  assert.ok(Math.abs(a.rockDensity-b.rockDensity)<.025,'La piedra no debe saltar entre sectores');
 }
 for(const b of LANDSCAPE_BIOMES)assert.equal(typeof b,'string');
 assert.ok(LANDSCAPE_BIOMES.includes('mountain')&&LANDSCAPE_BIOMES.includes('alpine'));
});
test('existen llanuras despejadas, arboledas dispersas, bosques, colinas y grandes montañas',()=>{
 const biomes=new Set(),densities=[],heights=[];
 // Muestreo de un territorio mayor que un sector para detectar bandas reales.
 for(const seed of [123456,56789])for(let y=-980;y<=980;y+=33)
  for(let x=-980;x<=980;x+=33){
   const v=terrainSample(x+.5,y+.5,seed,{x:0,y:0});
   biomes.add(v.biome);
   if(v.biome!=='water')densities.push(v.treeDensity);
   heights.push(v.height);
   assert.ok(v.treeDensity>=0&&v.treeDensity<=.68);
   assert.ok(v.rockDensity>=0&&v.rockDensity<=.58);
  }
 for(const biome of ['plain','meadow','woodland','forest','hills','mountain'])
  assert.ok(biomes.has(biome),'Falta un tipo de terreno: '+biome);
 assert.ok(densities.some(v=>v<=.018),'Deben existir áreas prácticamente sin árboles');
 assert.ok(densities.some(v=>v>.20),'Deben existir también bosques aprovechables');
 const avg=densities.reduce((a,b)=>a+b,0)/densities.length;
 assert.ok(avg<.31,'El mundo no debe volver a ser casi todo bosque (media '+avg+')');
 assert.ok(Math.max(...heights)>16,'La cordillera debe superar las colinas normales');
});
test('los árboles y las rocas se distribuyen según el bioma, sin solaparse',()=>{
 const w=new World('BIOMES-PRADERAS');
 const initial=w.tiles.filter(t=>t.type==='grass'&&!t.building);
 assert.ok(initial.length>200,'Debe quedar espacio para construir en el valle inicial');
 for(const [x,y] of [[128,128],[-256,192],[490,-450],[1024,1000],[25,25]]){
  const t=w.tile(x,y),v=terrainSample(x+.5,y+.5,w.seedNumber,w.coordinates);
  assert.equal(t.biome,v.biome);
  assert.equal(t.type,v.water?'water':v.hill?'hill':'grass');
  assert.ok(!(t.tree&&t.rock),'Una roca no puede aparecer dentro de un árbol');
  assert.ok(!t.tree||t.type==='grass');
  assert.ok(!t.rock||t.stoneLeft>0);
 }
});
test('los recursos extraídos y construcciones existentes conservan su estado al guardar',()=>{
 const w=new World('REGIONES-MONTAÑA');
 const original=w.tile(180,-95),biome=original.biome;
 original.tree=false;original.rock=false;original.stoneLeft=0;original.stoneScar=true;
 w.rememberTile(original);
 for(let i=0;i<25;i++)w.setViewRegion(i,-i);
 const loaded=new World(w.seed,JSON.parse(JSON.stringify(w.serialize())));
 const tile=loaded.tile(180,-95);
 assert.equal(tile.biome,biome);
 assert.equal(tile.tree,false);
 assert.equal(tile.rock,false);
 assert.equal(tile.stoneLeft,0);
 assert.equal(tile.stoneScar,true);
});
