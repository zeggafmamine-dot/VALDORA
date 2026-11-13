import test from 'node:test';
import assert from 'node:assert/strict';
import {World,SIZE} from '../dist/sim.mjs';
import {terrainSample} from '../dist/terrain.mjs';

function snapshot(t){return [t.x,t.y,t.type,t.height,t.variant,t.tree,t.rock,t.road,t.bridge,t.bridgeAxis,t.marked,t.building];}
test('world streams positive and negative regions without keeping all visited terrain',()=>{
 const world=new World('INFINITO',null,{x:3,y:-7});
 const original=snapshot(world.tile(-17,141));
 for(let i=-90;i<90;i++)world.setViewRegion(i,Math.floor(i/2));
 assert.ok(world.loadedChunks<=24,'Se ha superado la caché acotada');
 world.setViewRegion(-1,2);
 assert.deepEqual(snapshot(world.tile(-17,141)),original);
 assert.equal(world.tiles.length,SIZE*SIZE);
 assert.deepEqual(world.viewRegion,{x:-1,y:2});
});
test('world generation is deterministic over borders and away from the village',()=>{
 const a=new World('INFINITO'),b=new World('INFINITO');
 for(const [x,y] of [[63,63],[64,63],[65,64],[-1,-1],[-100,500],[100012,-200031]]){
  assert.deepEqual(snapshot(a.tile(x,y)),snapshot(b.tile(x,y)));
 }
 const s=a.seedNumber,c=a.coordinates;
 const left=terrainSample(63.999,90,s,c).height,right=terrainSample(64.001,90,s,c).height;
 assert.ok(Math.abs(left-right)<.01,'Un salto de relieve atraviesa el borde de un sector');
});
test('modified roads and gathered resources survive eviction, saves, and load',()=>{
 const w=new World('PERSISTENCIA');
 const road=w.tile(-37,141),tree=w.tile(133,141);
 assert.equal(road.building,null);road.road=true;road.tree=false;w.rememberTile(road);
 tree.tree=false;tree.rock=false;tree.marked=false;w.rememberTile(tree);
 for(let x=0;x<125;x++)w.setViewRegion(x,-x);
 assert.equal(w.tile(-37,141).road,true);
 assert.equal(w.tile(133,141).tree,false);
 const saved=JSON.parse(JSON.stringify(w.serialize()));
 assert.equal(saved.version,2);
 assert.ok(saved.tileChanges.length<200,'El guardado almacena terreno sin modificar');
 const restored=new World(saved.seed,saved);
 assert.equal(restored.tile(-37,141).road,true);
 assert.equal(restored.tile(133,141).tree,false);
 assert.ok(restored.loadedChunks<=24);
});
test('remote construction persists and has correct collision after streaming',()=>{
 const w=new World('CONSTRUCCION');let pos=null;
 for(let y=135;y<180&&!pos;y++)for(let x=-120;x<-60&&!pos;x++){
  const good=[w.tile(x,y),w.tile(x+1,y),w.tile(x,y+1),w.tile(x+1,y+1)].every(t=>t.type==='grass'&&!t.building);
  if(good)pos={x,y};
 }
 assert.ok(pos,'Hay que encontrar una parcela apta para construir');
 const result=w.place('house',pos.x,pos.y);assert.ok(result.ok,result.reason);
 w.setViewRegion(2,2);w.setViewRegion(-2,2);assert.equal(w.tile(pos.x,pos.y).building,result.building.id);
 const save=JSON.parse(JSON.stringify(w.serialize())),loaded=new World(save.seed,save);
 assert.equal(loaded.buildings.find(b=>b.id===result.building.id).x,pos.x);
 assert.equal(loaded.tile(pos.x,pos.y).building,result.building.id);
 assert.equal(loaded.canPlace('house',pos.x,pos.y).ok,false);
});
test('camera region in a save is restored without retaining explored terrain',()=>{
 const w=new World('CAMARA');w.setViewRegion(-4,3);
 w.cameraPosition={x:-222.4,y:201.2};
 const restored=new World(w.seed,JSON.parse(JSON.stringify(w.serialize())));
 assert.deepEqual(restored.viewRegion,{x:-4,y:3});
 assert.deepEqual(restored.cameraPosition,{x:-222.4,y:201.2});
 assert.ok(restored.loadedChunks<=24);
});
