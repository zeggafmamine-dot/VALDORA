// A connected supercover line: diagonal drags remain walkable by four-way agents.
export function traceLine(start,end,axisLock=false){
 if(!start||!end||![start.x,start.y,end.x,end.y].every(Number.isInteger))return [];
 let x=start.x,y=start.y,tx=end.x,ty=end.y;
 if(axisLock){if(Math.abs(tx-x)>=Math.abs(ty-y))ty=y;else tx=x;}
 const dx=Math.abs(tx-x),dy=Math.abs(ty-y),sx=Math.sign(tx-x),sy=Math.sign(ty-y);
 if(dx+dy>256)return [];
 const cells=[{x,y}];let ix=0,iy=0;
 while(ix<dx||iy<dy){const a=(1+2*ix)*dy,b=(1+2*iy)*dx;if(ix<dx&&(iy>=dy||a<=b)){x+=sx;ix++;}else{y+=sy;iy++;}cells.push({x,y});}
 return cells;
}

export function planLine(world,type,start,end){
 const result={type,start,end,cells:[],cost:{},count:0,ok:false,reason:''};
 if(!['road','bridge'].includes(type)){result.reason='Elige un camino o un puente.';return result;}
 if(!start||!end||!world.tile(start.x,start.y)||!world.tile(end.x,end.y)){result.reason='Mantén el trazado dentro del valle.';return result;}
 const points=traceLine(start,end,type==='bridge');if(!points.length){result.reason='Trazado no válido.';return result;}
 result.end=points.at(-1);result.axis=points[0].x===result.end.x?'y':'x';
 let issue='';
 for(const p of points){const t=world.tile(p.x,p.y),existing=type==='road'?(t.road||t.bridge):t.bridge;
  let valid=!t.building&&t.type!=='hill';
  if(type==='road'&&t.type==='water'&&!t.bridge){valid=false;issue='El camino cruza agua. Usa un puente para unir las orillas.';}
  if(t.building)issue='Hay un edificio en el recorrido. Cambia el extremo del trazado.';
  if(t.type==='hill')issue='El recorrido atraviesa una montaña.';
  const cell={...p,valid,existing:!!existing,action:existing?null:type};result.cells.push(cell);
  if(!existing){const resource=type==='road'?'stone':'wood',cost=type==='road'?1:6;result.cost[resource]=(result.cost[resource]||0)+cost;result.count++;}
 }
 if(type==='bridge'){
  const water=points.map((p,i)=>world.tile(p.x,p.y).type==='water'?i:-1).filter(i=>i>=0);
  if(!water.length)issue='Arrastra desde una orilla hasta la otra, atravesando el agua.';
  else if(world.tile(points[0].x,points[0].y).type==='water'||world.tile(result.end.x,result.end.y).type==='water')issue='El puente debe empezar y terminar en tierra.';
  else if(water[0]>3||points.length-1-water.at(-1)>3)issue='Acerca los extremos del puente a las orillas.';
 }
 if(issue){result.reason=issue;return result;}
 if(!world.canAfford(result.cost)){result.reason='No hay recursos para todo el tramo. Acorta la línea.';return result;}
 result.ok=true;result.reason=result.count?'Suelta para construir todo el tramo · Esc para cancelar':'Este tramo ya está construido.';
 return result;
}
