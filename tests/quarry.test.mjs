import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/sim.mjs';
import {QUARRY_RADIUS,STONE_PER_WORKER,stoneCapacity,stoneRemaining,stoneStage,stoneVisualScale} from '../dist/stone-deposits.mjs';

function rockSite(w){
 const rocks=w.tiles.filter(t=>t.rock&&t.x>=8&&t.x<55&&t.y>=8&&t.y<55);
 for(const t of rocks)for(let dy=-4;dy<=1;dy++)for(let dx=-4;dx<=1;dx++){
  const x=t.x+dx,y=t.y+dy;
  if(w.canPlace('quarry',x,y).ok)return {x,y};
 }
 throw Error('No se encontró un yacimiento apto para probar cantera.');
}
function quarry(w){
 w.resources.wood=200;w.resources.stone=200;
 const pos=rockSite(w);
 const result=w.place('quarry',pos.x,pos.y);assert.equal(result.ok,true,result.reason);
 result.building.progress=1;result.building.workers=2;w.assignJobs();
 assert.equal(result.building.workers,2);
 return result.building;
}
test('cada roca tiene un depósito numérico finito y fases visuales derivadas',()=>{
 const w=new World('YACIMIENTO');
 const t=w.tiles.find(t=>t.rock);
 assert.ok(t);assert.ok(stoneCapacity(t)>=12&&stoneCapacity(t)<=38);
 assert.equal(stoneRemaining(t),stoneCapacity(t));
 assert.equal(stoneStage(t),4);
 assert.equal(stoneVisualScale(t),1);
 const half={...t,stoneLeft:Math.floor(t.stoneLeft/2)};
 assert.ok(stoneStage(half)>=1&&stoneStage(half)<=2);
 assert.ok(stoneVisualScale(half)<1);
 assert.equal(stoneStage({...t,stoneLeft:0,rock:false}),0);
 assert.equal(stoneVisualScale({...t,stoneLeft:0,rock:false}),0);
 assert.equal(QUARRY_RADIUS,9);assert.equal(STONE_PER_WORKER,2);
});
test('la cantera produce solamente consumiendo piedra real y reduce su roca visible',()=>{
 const w=new World('CANTERA-CONSUME'),b=quarry(w),t=w.findQuarryDeposit(b);
 assert.ok(t);const before=t.stoneLeft,stock=w.resources.stone;
 w.tick();
 assert.equal(w.resources.stone-stock,4);
 assert.equal(t.stoneLeft,before-4);
 assert.equal(t.stoneScar,true);
 assert.ok(stoneVisualScale(t)<1);
});
test('una roca agotada no se regenera, aunque se demuela la cantera y se vuelva a jugar',()=>{
 const w=new World('CANTERA-SIN-REGENERACION'),b=quarry(w),first=w.findQuarryDeposit(b);
 const x=first.x,y=first.y,initial=first.stoneLeft;
 let n=0;while(w.tile(x,y).stoneLeft>0&&n++<20){w.resources.stone=0;w.mineQuarry(b,STONE_PER_WORKER*2);}
 assert.ok(n<20);assert.equal(initial>=12,true);
 assert.equal(w.tile(x,y).stoneLeft,0);assert.equal(w.tile(x,y).rock,false);
 assert.equal(w.tile(x,y).stoneScar,true);
 assert.equal(w.demolish(b.id),true);
 for(let i=-30;i<30;i++)w.setViewRegion(i,-i);
 assert.equal(w.tile(x,y).rock,false);
 const save=JSON.parse(JSON.stringify(w.serialize()));
 assert.ok(save.tileChanges.some(row=>row[0]===x&&row[1]===y&&row.length===10&&row[8]===0&&row[9]===1));
 const loaded=new World(save.seed,save);
 assert.equal(loaded.tile(x,y).rock,false);
 assert.equal(loaded.tile(x,y).stoneLeft,0);
 assert.equal(loaded.tile(x,y).stoneScar,true);
});
test('el yacimiento total termina agotándose; una cantera sin roca deja de producir',()=>{
 const w=new World('CANTERA-AGOTADA'),b=quarry(w);
 const total=w.stoneAround(b);assert.ok(total>0);
 let sum=0,iterations=0;
 while(w.stoneAround(b)>0&&iterations++<3000){
  w.resources.stone=0;
  sum+=w.mineQuarry(b,40);
 }
 assert.ok(iterations<3000);
 assert.equal(sum,total);
 assert.equal(w.stoneAround(b),0);
 w.resources.stone=0;assert.equal(w.mineQuarry(b,40),0);
 assert.equal(b.exhausted,true);
 assert.equal(w.findQuarryDeposit(b),null);
 assert.equal(w.canPlace('quarry',b.x,b.y).ok,false);
});
test('dos canteras comparten los mismos depósitos sin duplicar minerales',()=>{
 const w=new World('CANTERAS-EN-COMUN'),b=quarry(w),r=w.findQuarryDeposit(b);
 const other={...b,targetStone:{x:r.x,y:r.y}};
 const remaining=r.stoneLeft,before=w.resources.stone;
 const first=w.mineQuarry(b,4),second=w.mineQuarry(other,4);
 assert.equal(first,4);assert.equal(second,4);
 assert.equal(r.stoneLeft,remaining-8);
 assert.equal(w.resources.stone-before,8);
});
test('almacén lleno no consume piedra del terreno',()=>{
 const w=new World('CANTERA-ALMACEN'),b=quarry(w),t=w.findQuarryDeposit(b);
 const initial=t.stoneLeft;w.resources.stone=w.storage;
 assert.equal(w.mineQuarry(b,50),0);
 assert.equal(t.stoneLeft,initial);
});
test('una roca recogida a mano también se consume una sola vez',()=>{
 const w=new World('PIEDRA-MANUAL');
 const t=w.tiles.find(t=>t.rock&&!t.building&&stoneRemaining(t)>=12);
 assert.ok(t);const initial=stoneRemaining(t),stock=w.resources.stone;
 assert.equal(w.markGather(t.x,t.y).ok,true);
 for(let i=0;i<8&&t.rock;i++)w.tick();
 assert.equal(t.rock,false);
 assert.equal(t.stoneLeft,0);
 assert.equal(t.stoneScar,true);
 assert.equal(w.resources.stone-stock,initial);
 assert.equal(w.markGather(t.x,t.y).ok,false);
});
test('partidas guardadas antiguas de 8 y 9 valores conservan rocas extraídas',()=>{
 const w=new World('GUARDADO-ANTIGUO');
 const t=w.tiles.find(t=>t.rock&&!t.building);const x=t.x,y=t.y;
 t.rock=false;t.stoneLeft=0;w.rememberTile(t);
 const latest=w.serialize();
 for(const length of [8,9]){
  const old={...latest,tileChanges:latest.tileChanges.map(row=>row.slice(0,length))};
  const loaded=new World(old.seed,JSON.parse(JSON.stringify(old)));
  assert.equal(loaded.tile(x,y).rock,false);
  assert.equal(loaded.tile(x,y).stoneLeft,0);
  assert.equal(loaded.tile(x,y).stoneScar,false);
 }
});
