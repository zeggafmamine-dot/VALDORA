import test from 'node:test';
import assert from 'node:assert/strict';
import {World,BUILDINGS,SIZE} from '../dist/sim.mjs';

test('a seed reproduces the terrain and different seeds vary it',()=>{
 const a=new World('bosque');const b=new World('bosque');const c=new World('rio');
 assert.deepEqual(a.tiles,b.tiles);assert.notDeepEqual(a.tiles,c.tiles);
 for(const seed of ['bosque','rio','VALDORA-2048','Marruecos','123456']){
  const w=new World(seed);assert.equal(w.population,8);assert.equal(w.capacity,8);
  for(const building of w.buildings)for(let y=building.y;y<building.y+building.h;y++)for(let x=building.x;x<building.x+building.w;x++)assert.equal(w.tile(x,y).type,'grass');
 }
});

test('placement validates occupied terrain, map edges, water and materials',()=>{
 const w=new World();const starting={...w.resources};
 assert.equal(w.place('house',29,29).ok,false);assert.deepEqual(w.resources,starting);
 assert.equal(w.place('house',SIZE-1,5).ok,false);
 const t=w.tiles.find(t=>t.type==='water');assert.equal(w.place('house',t.x,t.y).ok,false);
 assert.equal(w.place('bridge',t.x,t.y).ok,true);assert.equal(w.resources.wood,starting.wood-6);assert.equal(w.passable(t.x,t.y),true);
 assert.equal(w.place('bridge',t.x,t.y).ok,false);assert.equal(w.place('bridge',31,33).ok,false);
 assert.equal(w.place('fisher',22,30).ok,false);
 w.resources.wood=0;assert.equal(w.place('house',34,26).ok,false);
});

test('construction allocates workers without exceeding population and refunds demolition',()=>{
 const w=new World();const r=w.place('farm',34,35);assert.ok(r.ok);
 for(let i=0;i<5;i++)w.tick();assert.equal(r.building.progress,1);assert.equal(r.building.workers,2);
 assert.equal(w.changeWorkers(r.building.id,1),false);assert.ok(w.changeWorkers(r.building.id,-1));assert.equal(w.workers,1);assert.equal(w.idle,7);
 const wood=w.resources.wood;assert.ok(w.demolish(r.building.id));assert.equal(w.resources.wood,wood+10);assert.equal(w.workers,0);assert.equal(w.tile(34,35).building,null);
 assert.equal(w.demolish(w.buildings.find(b=>b.type==='hall').id),false);
});

test('gathering consumes each natural resource only once',()=>{
 const w=new World(),tree=w.tiles.find(t=>t.tree&&t.type==='grass');const wood=w.resources.wood;
 assert.ok(w.markGather(tree.x,tree.y).ok);assert.equal(w.markGather(tree.x,tree.y).ok,false);
 w.tick();assert.equal(w.resources.wood,wood+12);assert.equal(tree.tree,false);assert.equal(w.gatherQueue.length,0);
 assert.equal(w.markGather(tree.x,tree.y).ok,false);
});

test('a balanced starter settlement survives winter and receives immigrants',()=>{
 const w=new World();
 for(const [type,x,y]of [['farm',34,35],['gatherer',25,29],['forester',24,34],['woodcutter',28,37],['house',34,26]]){
  const r=w.place(type,x,y);assert.ok(r.ok,`${type}: ${r.reason}`);
  for(let i=0;i<8;i++)w.tick();assert.equal(r.building.progress,1);
 }
 for(let i=0;i<90;i++)w.tick();
 assert.ok(w.year>=2);assert.equal(w.gameOver,false);assert.ok(w.population>8);assert.ok(w.resources.food>0);assert.ok(w.resources.firewood>0);
 assert.ok(w.workers<=w.population);assert.ok(w.idle>=1);assert.ok(w.milestones.includes('winter'));
 for(const value of Object.values(w.resources))assert.ok(Number.isFinite(value)&&value>=0&&value<=w.storage);
 const saved=JSON.parse(JSON.stringify(w.serialize())),restored=new World(saved.seed,saved);
 assert.deepEqual(restored.resources,w.resources);assert.deepEqual(restored.buildings,w.buildings);assert.equal(restored.population,w.population);assert.equal(restored.speed,0);
 assert.equal(restored.day,w.day);assert.equal(restored.year,w.year);assert.deepEqual(restored.milestones,w.milestones);
});

test('farm output stops in winter and starvation can end the game',()=>{
 const w=new World();const b=w.addInitial('farm',34,35);b.workers=2;w.assignJobs();
 w.season=3;w.day=5;const food=w.resources.food;w.tick();assert.ok(Math.abs(w.resources.food-(food-8*.45))<1e-8);
 const bare=new World();bare.resources.food=0;bare.resources.firewood=0;
 for(let i=0;i<70;i++)bare.tick();assert.equal(bare.population,0);assert.equal(bare.gameOver,true);assert.equal(bare.speed,0);
});

test('malformed save files are rejected before being installed',()=>{
 const s=new World().serialize();
 for(const bad of [{...s,day:NaN},{...s,resources:{}},{...s,buildings:[{...s.buildings[0],x:-3}]},{...s,events:[{text:'hello',date:'now',type:'invalid'}]}])assert.throws(()=>new World(s.seed,bad));
});

test('paths cross completed bridges and avoid water',()=>{
 const w=new World();const path=w.findPath(31.5,32.5,31,37);assert.ok(path.length>0);
 assert.ok(path.every(p=>w.passable(p.x,p.y)));
 const water=w.tiles.find(t=>t.type==='water');assert.deepEqual(w.findPath(31,32,water.x,water.y),[]);
});
