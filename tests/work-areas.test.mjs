import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/sim.mjs';
import {workArea,areaMetric} from '../dist/work-areas.mjs';
import {QUARRY_RADIUS} from '../dist/stone-deposits.mjs';

const radii={gatherer:7,forester:8,quarry:QUARRY_RADIUS,woodcutter:6,fisher:6,farm:2.5,pasture:3};
test('todos los edificios productivos muestran una zona sin inventar círculos en viviendas y caminos',()=>{
 for(const [type,radius] of Object.entries(radii))assert.equal(workArea(type)?.radius,radius,type);
 for(const type of ['house','hall','well','market','warehouse','road','bridge'])
  assert.equal(workArea(type),null,type);
});
test('la ficha utiliza datos reales, unidades y estados en el mismo panel',()=>{
 const w=new World('zonas-unificadas');
 for(const type of Object.keys(radii)){
  const dim=type==='farm'||type==='pasture'||type==='quarry'?3:2;
  const b={type,x:15,y:15,w:dim,h:dim,progress:1,workers:1,paused:false};
  const info=areaMetric(w,b);
  assert.ok(info, 'sin información para '+type);
  assert.ok(info.label.length>3&&info.value.length>1&&info.note.length>10);
  assert.equal(info.radius,workArea(type).radius);
  assert.equal(info.status,'En funcionamiento');
 }
});
test('el leñador muestra madera real del almacén, sin fingir tala alrededor',()=>{
 const w=new World('leñador-real');
 const b={type:'woodcutter',x:14,y:14,w:2,h:2,progress:1,workers:1,paused:false};
 w.resources.wood=71.8;
 const info=areaMetric(w,b);
 assert.equal(info.value,'71 unidades');
 assert.match(info.note,/no tala/);
 assert.match(info.note,/orientativa/);
 w.resources.wood=0;
 assert.equal(areaMetric(w,b).status,'Sin madera');
});
test('los círculos del recolector y forestal corresponden exactamente a los árboles que producen',()=>{
 const b={type:'gatherer',x:10,y:10,w:2,h:2};
 const inside={tile(x,y){return {tree:x===17&&y===10};}};
 const outside={tile(x,y){return {tree:x===18&&y===10};}};
 assert.equal(World.prototype.forestAt.call(inside,b,7),1/18);
 assert.equal(World.prototype.forestAt.call(outside,b,7),0);
});
test('la cantera informa la misma reserva finita que consume la simulación',()=>{
 const w=new World('cantera-info-circulo');
 w.resources.wood=200;w.resources.stone=200;
 let b=null;
 for(let y=5;y<60&&!b;y++)for(let x=5;x<60&&!b;x++){
  const result=w.canPlace('quarry',x,y);if(result.ok)b={x,y,type:'quarry',w:3,h:3,progress:1,workers:2,paused:false};
 }
 assert.ok(b,'sin sitio para cantera');
 const info=areaMetric(w,b);
 assert.equal(info.amount,w.stoneAround(b));
 assert.ok(info.amount>0);
 assert.equal(info.radius,QUARRY_RADIUS);
 assert.match(info.note,/no reaparece/);
});
test('estados del área: construcción, sin trabajadores y pausa',()=>{
 const w=new World('estados-zona');
 const b={type:'gatherer',x:20,y:20,w:2,h:2,progress:.25,workers:0,paused:false};
 assert.equal(areaMetric(w,b).status,'En construcción');
 b.progress=1;
 assert.equal(areaMetric(w,b).status,'Sin trabajadores');
 b.paused=true;
 assert.equal(areaMetric(w,b).status,'Pausado');
});
