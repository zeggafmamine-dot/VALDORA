import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/sim.mjs';
import {traceLine} from '../dist/paths.mjs';

test('long and diagonal drags produce gap-free connected paths in every direction',()=>{
 for(const end of [{x:20,y:13},{x:0,y:3},{x:2,y:22},{x:20,y:0},{x:10,y:10}]){const line=traceLine({x:10,y:10},end);assert.deepEqual(line[0],{x:10,y:10});assert.deepEqual(line.at(-1),end);assert.equal(new Set(line.map(c=>`${c.x},${c.y}`)).size,line.length);for(let i=1;i<line.length;i++)assert.equal(Math.abs(line[i].x-line[i-1].x)+Math.abs(line[i].y-line[i-1].y),1);}
 assert.deepEqual(traceLine({x:4,y:4},{x:20,y:6},true).at(-1),{x:20,y:4});
});
test('preview is free and one commit builds the whole road with exact cost',()=>{
 const w=new World(),before={...w.resources},start={x:25,y:38},end={x:36,y:38};
 const preview=w.previewLine('road',start,end);assert.ok(preview.ok);assert.deepEqual(w.resources,before);assert.equal(w.tile(25,38).road,false);
 const result=w.placeLine('road',start,end);assert.equal(result.count,11);assert.equal(w.resources.stone,before.stone-11);assert.ok(result.cells.every(c=>w.tile(c.x,c.y).road));
 const retry=w.placeLine('road',start,end);assert.equal(retry.count,0);assert.equal(w.resources.stone,before.stone-11);
});
test('blocked or unaffordable lines do not build partial paths or deduct resources',()=>{
 const w=new World(),before=structuredClone(w.serialize());let result=w.placeLine('road',{x:27,y:35},{x:36,y:35});assert.equal(result.ok,false);assert.deepEqual(w.resources,before.resources);assert.equal(w.tile(27,35).road,false);
 w.resources.stone=2;result=w.placeLine('road',{x:25,y:38},{x:36,y:38});assert.equal(result.ok,false);assert.equal(w.resources.stone,2);assert.equal(w.tile(25,38).road,false);
});
test('a whole bridge spans the river, includes approaches and survives saving',()=>{
 const w=new World(),y=32,water=w.tiles.filter(t=>t.y===y&&t.type==='water'),start={x:water[0].x-1,y},end={x:water.at(-1).x+1,y};
 const old=w.resources.wood,plan=w.previewLine('bridge',start,end);assert.ok(plan.ok,plan.reason);assert.equal(w.previewLine('bridge',start,{x:water[0].x,y}).ok,false);
 const result=w.placeLine('bridge',start,end);assert.ok(result.ok);assert.equal(w.resources.wood,old-result.count*6);assert.ok(result.cells.every(c=>w.tile(c.x,c.y).bridge));assert.ok(w.findPath(start.x,start.y,end.x,end.y).length>0);
 const data=JSON.parse(JSON.stringify(w.serialize())),restored=new World(data.seed,data);assert.ok(result.cells.every(c=>restored.tile(c.x,c.y).bridgeAxis==='x'));assert.ok(restored.findPath(start.x,start.y,end.x,end.y).length>0);
});
test('roads do not create bridges implicitly and invalid drags are rejected',()=>{
 const w=new World(),water=w.tiles.find(t=>t.y===32&&t.type==='water');assert.equal(w.previewLine('road',{x:water.x-2,y:32},{x:water.x+3,y:32}).ok,false);
 assert.equal(w.previewLine('bridge',{x:25,y:38},{x:36,y:38}).ok,false);assert.equal(w.previewLine('road',{x:-1,y:0},{x:3,y:0}).ok,false);
 assert.deepEqual(traceLine({x:1,y:1},{x:2.2,y:3}),[]);
});
