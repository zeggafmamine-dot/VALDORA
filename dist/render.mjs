import {SIZE,BUILDINGS,hash} from './sim.mjs';
import {enhanceCompatibility} from './detail2d.mjs';
import {stoneVisualScale,stoneStage} from './stone-deposits.mjs';
import {workArea} from './work-areas.mjs';
const TW=54,TH=27;
const palettes=[{grass:['#8b9c6c','#92a273','#879969','#8e9e70','#95a575','#8a9d70'],soil:'#73855d',water:['#688e8b','#6b9390','#709995','#769e98'],pine:['#476b49','#527650','#61835a'],deciduous:['#78935b','#8b9f62','#94a865']},{grass:['#929b65','#98a16a','#8e985f','#9ca774','#96a26b','#8b9964'],soil:'#788151',water:['#658f8c','#6a9591','#729e98','#7aa39a'],pine:['#42684b','#4e7452','#63835a'],deciduous:['#7e9456','#90a15c','#9ba864']},{grass:['#9a9b6e','#a3a178','#919567','#a49f72','#a8a679','#9d9c70'],soil:'#80805d',water:['#6a8d8c','#739592','#799e99','#80a49a'],pine:['#536d50','#637b55','#748a60'],deciduous:['#ae8350','#c49757','#c8a65d']},{grass:['#c1cec3','#cad4c9','#bac9bf','#c5d1c7','#d1d7ca','#c4d0c6'],soil:'#a6b9ad',water:['#809e9e','#89aaa9','#90b2b1','#98b8b4'],pine:['#778e7e','#8a9f8b','#a3b4a0'],deciduous:['#9cae98','#b1bdab','#c0c9b4']}];
export class Renderer{
 constructor(canvas,mini,world){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.mini=mini;this.mc=mini.getContext('2d');this.world=world;this.zoom=1;this.camera={x:0,y:0};this.hover=null;this.selected=null;this.buildMode=null;this.gatherMode=false;this.width=0;this.height=0;this.time=0;this.resize();this.center();if(world.cameraPosition){const p=this.iso(world.cameraPosition.x,world.cameraPosition.y);this.camera={x:p.x,y:p.y};}this.miniCache=null;this.miniKey='';enhanceCompatibility(this);}
 setWorld(w){this.world=w;this.selected=null;this.buildMode=null;this.gatherMode=false;this.center();if(w.cameraPosition){const p=this.iso(w.cameraPosition.x,w.cameraPosition.y);this.camera={x:p.x,y:p.y};}this.invalidate();}
 invalidate(){this.miniKey='';}
 resize(){let r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.dpr=Math.min(window.devicePixelRatio||1,1.7);this.canvas.width=Math.round(r.width*this.dpr);this.canvas.height=Math.round(r.height*this.dpr);}
 center(){const p=this.iso(31,32);this.camera={x:p.x+50,y:p.y-20};this.zoom=1/3;}
 iso(x,y,z=0){return {x:(x-y)*TW/2,y:(x+y)*TH/2-z};}
 project(x,y,z=0){const p=this.iso(x,y,z);return {x:(p.x-this.camera.x)*this.zoom+this.width/2,y:(p.y-this.camera.y)*this.zoom+this.height/2};}
 unproject(sx,sy){const a=(sx-this.width/2)/this.zoom+this.camera.x,b=(sy-this.height/2)/this.zoom+this.camera.y;return {x:(a/(TW/2)+b/(TH/2))/2,y:(b/(TH/2)-a/(TW/2))/2};}
 pick(sx,sy){const p=this.unproject(sx,sy);return {x:Math.floor(p.x),y:Math.floor(p.y)};}
 pickBuilding(sx,sy){const ground=this.pick(sx,sy),tile=this.world.tile(ground.x,ground.y);if(tile?.building)return tile.building;
  const point={x:(sx-this.width/2)/this.zoom+this.camera.x,y:(sy-this.height/2)/this.zoom+this.camera.y};
  const inside=poly=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
  const sorted=this.world.buildings.slice().sort((a,b)=>(b.x+b.y+b.w+b.h)-(a.x+a.y+a.w+a.h));
  for(const b of sorted){if(['farm','pasture','quarry'].includes(b.type)||b.progress<1)continue;const h=b.type==='hall'?48:b.type==='well'?36:40;const poly=[this.iso(b.x+b.w/2,b.y,h),this.iso(b.x+b.w,b.y,22),this.iso(b.x+b.w,b.y+b.h),this.iso(b.x,b.y+b.h),this.iso(b.x,b.y,22)];if(inside(poly))return b.id;}return null;
 }
 setZoom(z,sx=this.width/2,sy=this.height/2){const before=this.unproject(sx,sy);this.zoom=Math.max(.18,Math.min(2.2,z));const after=this.unproject(sx,sy);const delta=this.iso(before.x-after.x,before.y-after.y);this.camera.x+=delta.x;this.camera.y+=delta.y;}
 pan(dx,dy){this.camera.x-=dx/this.zoom;this.camera.y-=dy/this.zoom;this.clampCamera();}
 clampCamera(){if(this.world.terrainVersion===3){this.camera.x=Math.max(-1e9,Math.min(1e9,this.camera.x));this.camera.y=Math.max(-1e9,Math.min(1e9,this.camera.y));return;}this.camera.x=Math.max(-SIZE*TW*.38,Math.min(SIZE*TW*.38,this.camera.x));this.camera.y=Math.max(200,Math.min(SIZE*TH-200,this.camera.y));}
 poly(points,color,stroke){const c=this.ctx;c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.6;c.stroke();}}
 line(points,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 ellipse(x,y,rx,ry,color){const c=this.ctx;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
 diamond(x,y,w=1,h=1,z=0,color,stroke){this.poly([this.iso(x,y,z),this.iso(x+w,y,z),this.iso(x+w,y+h,z),this.iso(x,y+h,z)],color,stroke);}
 // Un contorno circular real en coordenadas del mundo, con relleno
 // translúcido y borde grueso para verse también con el zoom alejado.
 drawQuarryArea(b,valid=true){
  const area=workArea(b.type);if(!area)return;
  const c=this.ctx,cx=b.x+b.w/2,cy=b.y+b.h/2,steps=80;
  c.save();
  c.beginPath();
  for(let i=0;i<=steps;i++){
   const a=i/steps*Math.PI*2,p=this.iso(cx+Math.cos(a)*area.radius,cy+Math.sin(a)*area.radius,2);
   if(!i)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);
  }
  c.closePath();
  c.fillStyle=valid?'#b6dba028':'#d8847638';
  c.fill();
  c.strokeStyle=valid?'#f9db84':'#f39d77';
  c.lineWidth=2.7/Math.max(.2,this.zoom);
  c.shadowColor=valid?'#d3eaa3':'#ed9981';
  c.shadowBlur=5/Math.max(.25,this.zoom);
  c.stroke();
  c.restore();
 }
 draw(time){this.time=time;const c=this.ctx,w=this.world,pal=palettes[w.season],z=this.zoom;if(w.terrainVersion===3&&time-(this.lastPrefetch||0)>.1){w.chunks.prefetchNext(1);this.lastPrefetch=time;}if(w.terrainVersion===3){const mid=this.unproject(this.width/2,this.height/2);w.setViewRegion(Math.floor(mid.x/SIZE),Math.floor(mid.y/SIZE));}
  c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle=pal.grass[0];c.fillRect(0,0,this.width,this.height);
  c.translate(this.width/2-this.camera.x*z,this.height/2-this.camera.y*z);c.scale(z,z);
  const corners=[this.unproject(-150,-200),this.unproject(this.width+150,-200),this.unproject(this.width+150,this.height+150),this.unproject(-150,this.height+150)];
  const lo=w.terrainVersion===3?-100000000:0,hi=w.terrainVersion===3?100000000:SIZE-1;const minX=Math.max(lo,Math.floor(Math.min(...corners.map(p=>p.x)))-2),maxX=Math.min(hi,Math.ceil(Math.max(...corners.map(p=>p.x)))+2),minY=Math.max(lo,Math.floor(Math.min(...corners.map(p=>p.y)))-2),maxY=Math.min(hi,Math.ceil(Math.max(...corners.map(p=>p.y)))+2);
  const objects=[];
  for(let sum=minX+minY;sum<=maxX+maxY;sum++)for(let x=minX;x<=maxX;x++){const y=sum-x;if(y<minY||y>maxY)continue;const t=w.tile(x,y);this.drawTile(t,pal);if(t.tree)objects.push({depth:x+y+1,type:'tree',t});if(t.rock)objects.push({depth:x+y+1.1,type:'rock',t});if(t.type==='hill'&&t.x%5===0&&t.y%5===0)objects.push({depth:x+y+.8,type:'hill',t});}
  for(const b of w.buildings)if(b.x>=minX-4&&b.x<=maxX&&b.y>=minY-4&&b.y<=maxY){this.drawGround(b);objects.push({depth:b.x+b.y+b.w+b.h-1,type:'building',b});}
  for(const v of w.citizens)if(v.x>=minX-2&&v.x<=maxX+2&&v.y>=minY-2&&v.y<=maxY+2)objects.push({depth:v.x+v.y+.08,type:'person',v});
  for(let i=0;i<9;i++){const x=21+hash(i,45,w.seedNumber)*14+Math.sin(time*.09+i)*.7,y=19+hash(i,8,w.seedNumber)*8+Math.cos(time*.07+i)*.6;if(w.tile(x,y)?.type==='grass'&&!w.tile(x,y)?.building)objects.push({depth:x+y+.1,type:'deer',x,y,i});}
  objects.sort((a,b)=>a.depth-b.depth);for(const o of objects){if(o.type==='tree')this.drawTree(o.t,pal);else if(o.type==='rock')this.drawRock(o.t);else if(o.type==='hill')this.drawHill(o.t,pal);else if(o.type==='building')this.drawBuilding(o.b);else if(o.type==='person')this.drawPerson(o.v);else this.drawDeer(o.x,o.y,o.i);}
  if(this.selected){const b=w.buildings.find(b=>b.id===this.selected);if(b){this.diamond(b.x,b.y,b.w,b.h,1,'#e8d9a41d','#e8d5a3');if(workArea(b.type))this.drawQuarryArea(b);}}
  if(this.linePreview){const p=this.linePreview;for(const t of p.cells)this.diamond(t.x,t.y,1,1,3,t.existing?'#ddc78933':p.ok?'#bddb815e':'#e28f7566',p.ok?'#e9eabb':'#eca78e');if(p.cells.length>1)this.line(p.cells.map(t=>this.iso(t.x+.5,t.y+.5,5)),p.ok?'#f2e5b4':'#f2b29b',2.5);}
  if(this.hover&&!this.linePreview){const {x,y}=this.hover;if(this.buildMode){const d=BUILDINGS[this.buildMode],ok=w.canPlace(this.buildMode,x,y).ok;if(workArea(this.buildMode))this.drawQuarryArea({type:this.buildMode,x,y,w:d.w,h:d.h},ok);for(let yy=0;yy<d.h;yy++)for(let xx=0;xx<d.w;xx++)this.diamond(x+xx,y+yy,1,1,2,ok?'#d4e6b357':'#db8e755c',ok?'#ecf4c7':'#efaf94');c.save();c.globalAlpha=.65;if(d.days)this.drawBuilding({type:this.buildMode,x,y,w:d.w,h:d.h,progress:1,workers:0,id:-1},true);c.restore();}else if(this.gatherMode){const t=w.tile(x,y);if(t)this.diamond(x,y,1,1,2,t.tree||t.rock?'#e4cf8550':'#e0997b40','#e5d1a0');}else{const t=w.tile(x,y);if(t?.building){const b=w.buildings.find(b=>b.id===t.building);if(b)this.diamond(b.x,b.y,b.w,b.h,1,'#eff0c812','#e2e6c475');}}}
  this.drawAtmosphere(time);
  c.setTransform(this.dpr,0,0,this.dpr,0,0);
  const vignette=c.createRadialGradient(this.width*.5,this.height*.45,this.height*.2,this.width*.5,this.height*.5,Math.max(this.width,this.height)*.75);vignette.addColorStop(0,'#182c1900');vignette.addColorStop(1,'#233b263c');c.fillStyle=vignette;c.fillRect(0,0,this.width,this.height);
  this.drawMini();
 }
 drawTile(t,pal){const {x,y,variant:r}=t,c=this.ctx;
  if(t.type==='water'){
   const edge=[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>this.world.tile(x+dx,y+dy)?.type==='grass');this.diamond(x,y,1.015,1.015,0,pal.water[edge?3:Math.floor(r*3)]);
   if(r>.42){const p=this.iso(x+.5,y+.5),s=Math.sin(this.time*.6+x+y);this.line([{x:p.x-9+s*2,y:p.y},{x:p.x+7+s*2,y:p.y}],edge?'#bed2ad55':'#bad3c133',.8);}
   if(t.bridge)this.drawBridge(t);return;
  }
  const biomeColor=t.biome&&t.biome!=='water'?{
    steppe:this.world.season===3?'#c0cbc0':'#b4ae73',
    plain:this.world.season===3?'#c9d2c6':'#9ca97b',
    meadow:this.world.season===3?'#c0d1bc':'#8faa6c',
    woodland:this.world.season===3?'#aabfae':'#78935e',
    forest:this.world.season===3?'#9fae9d':'#5a754b',
    hills:this.world.season===3?'#adb9ae':'#81927c',
    mountain:this.world.season===3?'#b9c5c0':'#999e93',
    alpine:this.world.season===3?'#e7eee9':'#d1d8d0'
   }[t.biome]:null;
   const color=biomeColor||pal.grass[Math.min(5,Math.floor(r*6))];
   this.diamond(x,y,1.015,1.015,0,color);
   if(t.biome==='alpine'){
    // Trazos de grietas y nieve, diferentes de la textura vegetal o
    // de los depósitos extraíbles de roca de las laderas más bajas.
    const frost=hash(x,y,this.world.seedNumber+492);
    if(frost>.26){
     const p=this.iso(x+.2,y+.52);
     this.line([{x:p.x-3,y:p.y+1},{x:p.x+4+frost*3,y:p.y-3}],
      frost>.65?'#f4f5ef':'#81969f',1);
    }
   }
   if(t.stoneScar&&!t.building&&!t.road){this.diamond(x+.13,y+.13,.74,.74,.15,this.world.season===3?'#aaa99f':'#847e6d','#a39b8566');}
  if(t.type==='grass'&&r>.77&&!t.building&&!t.road){const p=this.iso(x+.4,y+.6);this.line([{x:p.x-3,y:p.y},{x:p.x-4,y:p.y-3}],pal.soil,.7);this.line([{x:p.x,y:p.y},{x:p.x+1,y:p.y-4}],pal.soil,.7);if(r>.94&&this.world.season!==3){this.ellipse(p.x+9,p.y-2,1.3,.9,'#d9d5a0');this.ellipse(p.x+5,p.y,1,.8,'#d9d5a0');}}
  if(t.road){this.diamond(x+.05,y+.05,.9,.9,1,this.world.season===3?'#b2bab0':'#b8af8c','#c1b99955');const p=this.iso(x+.5,y+.5);this.line([{x:p.x-8,y:p.y},{x:p.x+9,y:p.y-1}],'#8e937048',.6);}
 }
 drawTree(t,pal){const r=t.variant,p=this.iso(t.x+.45,t.y+.5),height=28+r*29,wide=12+r*6,c=this.ctx;
  this.ellipse(p.x+8,p.y+2,wide*1.2,wide*.38,'#334a3025');c.fillStyle='#70664d';c.fillRect(p.x-1.4,p.y-height*.35,2.8,height*.35);
  if(r>.53){for(let l=0;l<3;l++){const h=height*(.56+l*.21),bottom=p.y-height*l*.19,w=wide*(1-l*.22);this.poly([{x:p.x,y:bottom-h*.58},{x:p.x-w,y:bottom-4},{x:p.x+w,y:bottom-4}],pal.pine[1]);this.poly([{x:p.x,y:bottom-h*.58},{x:p.x-w,y:bottom-4},{x:p.x,y:bottom-2}],pal.pine[0]);this.poly([{x:p.x,y:bottom-h*.58},{x:p.x+1,y:bottom-2},{x:p.x+w,y:bottom-4}],pal.pine[2]);if(this.world.season===3)this.poly([{x:p.x,y:bottom-h*.58},{x:p.x-w*.64,y:bottom-11},{x:p.x+w*.62,y:bottom-10}], '#d3d9cc');}}
  else{const top=p.y-height*.68;this.poly([{x:p.x-2,y:top-height*.32},{x:p.x+wide*.75,y:top-height*.18},{x:p.x+wide,y:top+8},{x:p.x+3,y:top+height*.3},{x:p.x-wide*.7,y:top+height*.2},{x:p.x-wide,y:top-4}],pal.deciduous[1]);this.poly([{x:p.x-2,y:top-height*.32},{x:p.x-wide,y:top-4},{x:p.x-wide*.7,y:top+height*.2},{x:p.x,y:top+5}],pal.deciduous[0]);this.poly([{x:p.x-2,y:top-height*.32},{x:p.x+wide*.75,y:top-height*.18},{x:p.x+wide,y:top+8},{x:p.x,y:top+5}],pal.deciduous[2]);}
  if(t.marked){c.strokeStyle='#ebd193';c.lineWidth=1.6;c.beginPath();c.moveTo(p.x-3,p.y-15);c.lineTo(p.x+3,p.y-9);c.moveTo(p.x+3,p.y-15);c.lineTo(p.x-3,p.y-9);c.stroke();}
 }
 drawRock(t){const p=this.iso(t.x+.5,t.y+.5),r=t.variant,scale=t.stoneLeft===undefined?1:stoneVisualScale(t),size=(8+r*8)*scale;if(scale<=0)return;this.ellipse(p.x+4,p.y+2,size,4,'#314a3228');this.poly([{x:p.x-size,y:p.y},{x:p.x-size*.6,y:p.y-size*.65},{x:p.x+size*.15,y:p.y-size},{x:p.x+size*.8,y:p.y-size*.5},{x:p.x+size,y:p.y+1},{x:p.x,y:p.y+5}],this.world.season===3?'#b6c1b8':['#847d71','#968f81','#a19e8d','#a9ad9c','#9a9f8c'][stoneStage(t)||4]);this.poly([{x:p.x-size*.6,y:p.y-size*.65},{x:p.x+size*.15,y:p.y-size},{x:p.x+size*.8,y:p.y-size*.5},{x:p.x,y:p.y-1}],this.world.season===3?'#d3d8cb':'#b7b8a1');if(t.marked)this.ellipse(p.x,p.y-4,2,2,'#e8ce91');}
 drawHill(t,pal){if(t.variant<.3)return;const alpine=t.biome==='alpine';const p=this.iso(t.x+.5,t.y+.5),h=20+t.height+t.variant*28,w=23+t.variant*8;this.poly([{x:p.x-w,y:p.y},{x:p.x-5,y:p.y-h},{x:p.x+w,y:p.y+1},{x:p.x+3,y:p.y+10}],alpine?'#aebfc5':this.world.season===3?'#b8c3bb':'#879581');this.poly([{x:p.x-5,y:p.y-h},{x:p.x+w,y:p.y+1},{x:p.x+3,y:p.y+10}],alpine?'#8498a4':this.world.season===3?'#9fafaa':'#738576');this.poly([{x:p.x-5,y:p.y-h},{x:p.x-14,y:p.y-h*.62},{x:p.x-7,y:p.y-h*.68},{x:p.x,y:p.y-h*.53},{x:p.x+5,y:p.y-h*.57}],alpine?'#eaf2ef':this.world.season===3?'#e0e3d7':'#b4bbaa');}
 drawGround(b){const x=b.x,y=b.y;
  if(b.type==='farm'){this.diamond(x+.06,y+.06,b.w-.12,b.h-.12,1,this.world.season===3?'#adb8a5':'#8c7e56','#a6a179');for(let row=.28;row<b.w;row+=.3)this.line([this.iso(x+row,y+.16,2),this.iso(x+row,y+b.h-.16,2)],this.world.season===3?'#8e9d89':'#706c48',1.7);}
  else if(b.type==='pasture'){this.diamond(x+.04,y+.04,b.w-.08,b.h-.08,1,this.world.season===3?'#bfcbbc':'#a6ad7a');}
  else this.diamond(x-.05,y-.05,b.w+.1,b.h+.1,1,this.world.season===3?'#b6beb1':'#a6a180');
 }
 box(x,y,w,h,height,colors=['#bdb192','#a39272','#cec2a2']){const a=this.iso(x,y),b=this.iso(x+w,y),cc=this.iso(x+w,y+h),d=this.iso(x,y+h);this.poly([b,cc,{x:cc.x,y:cc.y-height},{x:b.x,y:b.y-height}],colors[1]);this.poly([d,cc,{x:cc.x,y:cc.y-height},{x:d.x,y:d.y-height}],colors[0]);this.poly([{x:a.x,y:a.y-height},{x:b.x,y:b.y-height},{x:cc.x,y:cc.y-height},{x:d.x,y:d.y-height}],colors[2]);}
 hut(x,y,w,h,H=23,roof='#686e5c',wall='#b7aa85',details=true){const a=this.iso(x,y),b=this.iso(x+w,y),cc=this.iso(x+w,y+h),d=this.iso(x,y+h),rise=H*.8;
  this.ellipse(cc.x+5,cc.y,30,8,'#30433323');this.box(x,y,w,h,H,[wall,'#93886b','#c6b891']);
  const ra=this.iso(x+w/2,y,H+rise),rb=this.iso(x+w/2,y+h,H+rise);this.poly([{x:d.x,y:d.y-H},rb,{x:cc.x,y:cc.y-H}],wall);
  this.poly([{x:a.x-3,y:a.y-H},ra,rb,{x:d.x-4,y:d.y-H+2}],roof);
  this.poly([ra,{x:b.x+4,y:b.y-H+2},{x:cc.x+4,y:cc.y-H+2},rb],this.world.season===3?'#c3cbbd':'#84816b');
  if(this.world.season===3)this.poly([{x:a.x-3,y:a.y-H},ra,rb,{x:d.x-3,y:d.y-H}], '#d7dccf');
  for(let v=.15;v<h;v+=.22){const p=this.iso(x+w/2,y+v,H+rise),q=this.iso(x+w,y+v,H);this.line([p,q],this.world.season===3?'#b7c2b0':'#545e5040',.65);}
  this.line([ra,rb],'#a6a184',1.7);
  if(details){this.faceDoor(x+w*.48,y+h,H);this.faceWindow(x+w*.2,y+h,H*.6);this.faceWindow(x+w*.82,y+h,H*.6);const p=this.iso(x+w,y+h*.35,H*.5);this.poly([{x:p.x-5,y:p.y-3},{x:p.x+1,y:p.y-6},{x:p.x+1,y:p.y+1},{x:p.x-5,y:p.y+4}],'#515c4a');this.line([{x:p.x-2,y:p.y-4},{x:p.x-2,y:p.y+2}],'#cbb78b',.8);
  this.box(x+w*.75,y+.3,.2,.2, H+rise*.65,['#9c9c84','#787e6b','#b6b39a']);const smoke=this.iso(x+w*.85,y+.4,H+rise*.65);this.smoke(smoke.x,smoke.y);}
 }
 faceDoor(x,y,H){const p=this.iso(x,y);this.poly([{x:p.x-4,y:p.y-2},{x:p.x+4,y:p.y+2},{x:p.x+4,y:p.y-H*.65+2},{x:p.x-4,y:p.y-H*.65-2}],'#696c51');this.line([{x:p.x,y:p.y},{x:p.x,y:p.y-H*.6}],'#4d5947',.8);}
 faceWindow(x,y,H){const p=this.iso(x,y,H);this.poly([{x:p.x-3.5,y:p.y-2},{x:p.x+3.5,y:p.y+1.5},{x:p.x+3.5,y:p.y+7.5},{x:p.x-3.5,y:p.y+4}],'#dbca93');this.line([{x:p.x,y:p.y},{x:p.x,y:p.y+6}],'#787b5e',1);}
 smoke(x,y){for(let i=0;i<3;i++){const v=(this.time*.18+i*.33)%1;this.ellipse(x+Math.sin(v*3)*5,y-v*26,2+v*4,3+v*3,`rgba(225,228,206,${(1-v)*.18})`);}}
 drawBuilding(b,ghost=false){const {x,y,w,h,type}=b,c=this.ctx;
  if(b.progress<1&&!ghost){this.drawConstruction(b);return;}
  if(type==='farm'){this.drawFence(x,y,w,h);if(this.world.season!==3){const density=this.world.season===0?.45:1,colors=this.world.season===0?['#839349','#9ba356']:this.world.season===1?['#c7b468','#d8c27a']:['#b99a55','#d1b369'];for(let a=.3;a<w-.1;a+=.28)for(let bb=.3;bb<h-.1;bb+=.32){const p=this.iso(x+a,y+bb),v=hash(Math.floor(a*10),Math.floor(bb*10)),height=(6+v*5)*density;this.line([{x:p.x,y:p.y},{x:p.x+1,y:p.y-height}],colors[0],1);this.ellipse(p.x+1,p.y-height,1.6,2.5,colors[1]);}}else{for(let a=.3;a<w-.1;a+=.5)this.line([this.iso(x+a,y+.2,2),this.iso(x+a,y+h-.2,2)],'#c9d0c0',1);}return;}
  if(type==='pasture'){this.drawFence(x,y,w,h);for(let i=0;i<5;i++){const a=x+.5+hash(i,2)*1.8+Math.sin(this.time*.1+i)*.1,bb=y+.5+hash(i,4)*1.8+Math.cos(this.time*.15+i)*.1;this.drawSheep(a,bb);}this.hut(x+.1,y+.1,.75,.6,10,'#7b7b61','#b1a17d',false);return;}
  if(type==='quarry'){this.diamond(x+.2,y+.2,w-.4,h-.4,1,'#7c8876','#929a80');this.diamond(x+.55,y+.55,w-1.1,h-1.1,1,'#667a6b','#a0a48e');for(let i=0;i<7;i++)this.drawRock({x:x+.3+hash(i,1)*1.8,y:y+.4+hash(i,2)*1.7,variant:hash(i,4)});this.hut(x+.1,y+.1,.8,.7,14,'#7e7861','#ad9d7c',false);const a=this.iso(x+2.5,y+2.5,0);this.line([{x:a.x,y:a.y},{x:a.x,y:a.y-45},{x:a.x-28,y:a.y-54}],'#756a4f',3);this.line([{x:a.x-28,y:a.y-54},{x:a.x-28,y:a.y-16}],'#a9a17c',1);return;}
  if(type==='well'){this.box(x+.2,y+.2,.6,.6,10,['#a4a78e','#858f7a','#bdbea3']);this.diamond(x+.3,y+.3,.4,.4,10,'#536d65');const a=this.iso(x+.2,y+.5),bb=this.iso(x+.8,y+.5);this.line([a,{x:a.x,y:a.y-26},{x:bb.x,y:bb.y-26},bb],'#8a7f5f',2);this.hut(x+.05,y+.1,.9,.8,26,'#7d8163','#aa9f7d',false);return;}
  if(type==='market'){for(let i=0;i<2;i++){this.box(x+.2+i*.85,y+.5,.65,1.1,10,['#b6a079','#8d8261','#c9b68c']);const a=this.iso(x+.15+i*.85,y+.3,25),bb=this.iso(x+.85+i*.85,y+.3,25),cc=this.iso(x+.85+i*.85,y+1.7,23),d=this.iso(x+.15+i*.85,y+1.7,23);this.poly([a,bb,cc,d],i?'#cbb88d':'#a36e58');this.line([a,{x:a.x,y:a.y+25}],'#786e52',1.7);this.line([cc,{x:cc.x,y:cc.y+23}],'#786e52',1.7);for(let j=0;j<4;j++){const p=this.iso(x+.4+i*.85,y+.6+j*.22,12);this.ellipse(p.x,p.y,2,1.5,['#bdb868','#b47e5d'][i]);}}return;}
  if(type==='hall'){this.hut(x+.13,y+.1,w-.26,h-.2,30,'#6e7666','#c1b694');const p=this.iso(x+.3,y+.2,20);this.line([{x:p.x,y:p.y},{x:p.x,y:p.y-50}],'#796f4f',1.7);this.poly([{x:p.x,y:p.y-50},{x:p.x+15,y:p.y-47+Math.sin(this.time*2)},{x:p.x+13,y:p.y-36},{x:p.x,y:p.y-39}],'#c5b57a');return;}
  if(type==='warehouse'){this.hut(x+.1,y+.1,w-.2,h-.2,22,'#766d57','#b3a782',false);this.faceDoor(x+w*.5,y+h-.1,27);for(let i=0;i<3;i++)this.box(x+w-.5,y+h-.2+i*.16,.32,.3,6,['#bba77c','#947f59','#c6b38a']);return;}
  if(type==='forester'||type==='gatherer'){this.hut(x+.2,y+.1,1.35,1.4,20,type==='forester'?'#586a50':'#867c58','#b8a77d');if(type==='forester'){for(let i=0;i<4;i++){const p=this.iso(x+.6+i*.2,y+1.8,4);this.line([{x:p.x-7,y:p.y-3},{x:p.x+7,y:p.y+3}],'#a38c62',4);this.ellipse(p.x+7,p.y+3,2,2,'#c3a77b');}}else{for(let i=0;i<3;i++){const p=this.iso(x+1.65,y+.9+i*.3,2);this.ellipse(p.x,p.y,4,2.8,'#a9986a');this.ellipse(p.x,p.y-1,3,1.5,'#8b674d');}}return;}
  if(type==='woodcutter'){this.hut(x+.15,y+.15,1.1,1.3,20,'#7b775b','#b3a17b');for(let i=0;i<5;i++)this.box(x+1.4,y+.3+i*.26,.45,.18,7,['#b4996d','#8d7857','#c0a377']);const p=this.iso(x+1.45,y+1.8);this.ellipse(p.x,p.y-3,5,3,'#b8a378');this.line([{x:p.x,y:p.y-3},{x:p.x+5,y:p.y-15}],'#716e52',1.6);return;}
  if(type==='fisher'){this.hut(x+.1,y+.1,1.4,1.4,20,'#657f73','#adab89');this.box(x+.6,y+1.5,1.3,.4,3,['#9d906c','#847a58','#b9a47b']);const p=this.iso(x+1.7,y+1.5);this.line([{x:p.x,y:p.y},{x:p.x+10,y:p.y-22},{x:p.x+23,y:p.y-12}],'#666b51',1);return;}
  this.hut(x+.18,y+.15,w-.36,h-.3,22,'#7d7760','#c0af87');
  if(type==='house'){const p=this.iso(x+.05,y+h-.2,3);this.ellipse(p.x,p.y,3,2,'#8b674e');this.ellipse(p.x,p.y-3,4,2.5,this.world.season===3?'#b6c2ae':'#a5b172');}
 }
 drawConstruction(b){const {x,y,w,h}=b;this.diamond(x+.1,y+.1,w-.2,h-.2,2,'#b5ab85','#c1b590');const H=10+b.progress*24;for(const [a,bb]of [[.1,.1],[w-.1,.1],[w-.1,h-.1],[.1,h-.1]]){const p=this.iso(x+a,y+bb);this.line([p,{x:p.x,y:p.y-H}],'#a09065',2);}for(const y1 of [.1,h-.1])this.line([this.iso(x+.1,y+y1,H),this.iso(x+w-.1,y+y1,H)],'#bca273',2);for(let i=0;i<4;i++)this.line([this.iso(x+.3,y+.4+i*.24,5),this.iso(x+w-.3,y+.4+i*.24,5)],'#b29d70',3);const p=this.iso(x+w/2,y+h/2,55),c=this.ctx;c.fillStyle='#28392dcc';c.fillRect(p.x-18,p.y,36,4);c.fillStyle='#e1c78d';c.fillRect(p.x-18,p.y,36*b.progress,4);}
 drawFence(x,y,w,h){for(const a of [0,h]){for(let b=0;b<=w;b+=.5){const p=this.iso(x+b,y+a);this.line([p,{x:p.x,y:p.y-7}],'#a89971',1.6);}for(const H of [3,6])this.line([this.iso(x,y+a,H),this.iso(x+w,y+a,H)],'#c6b78d',1.3);}for(const a of [0,w]){for(let b=0;b<=h;b+=.5){const p=this.iso(x+a,y+b);this.line([p,{x:p.x,y:p.y-7}],'#9a9069',1.5);}for(const H of [3,6])this.line([this.iso(x+a,y,H),this.iso(x+a,y+h,H)],'#b4a77d',1.3);}}
 drawBridge(t){const {x,y}=t;this.diamond(x,y,1,1,3,'#ac9b72','#847b5a');for(let a=.1;a<1;a+=.18)this.line([this.iso(x+a,y,4),this.iso(x+a,y+1,4)],'#6d705450',.9);}
 drawPerson(v){const p=this.iso(v.x,v.y,this.world.tile(v.x,v.y)?.bridge?8:0),c=this.ctx,walk=v.path.length&&this.world.speed?Math.sin(this.time*8+v.id)*1.2:0;this.ellipse(p.x+2,p.y+1,3.5,1.5,'#354d3435');this.line([{x:p.x-1,y:p.y-3},{x:p.x-1-walk,y:p.y}],'#635e48',1.5);this.line([{x:p.x+1,y:p.y-3},{x:p.x+1+walk,y:p.y}],'#635e48',1.5);this.poly([{x:p.x-2,y:p.y-8},{x:p.x+2,y:p.y-8},{x:p.x+2.5,y:p.y-3},{x:p.x-2.5,y:p.y-3}],v.color);this.ellipse(p.x,p.y-9,1.8,2,'#d5be94');this.ellipse(p.x,p.y-10.5,2.3,1,'#b6a17a');}
 drawSheep(x,y){const p=this.iso(x,y);this.ellipse(p.x+2,p.y+1,6,2,'#47604725');this.line([{x:p.x-3,y:p.y-4},{x:p.x-3,y:p.y+1}],'#6f725b',1);this.line([{x:p.x+3,y:p.y-4},{x:p.x+3,y:p.y+1}],'#6f725b',1);this.ellipse(p.x,p.y-5,5,3,'#e1dfc3');this.ellipse(p.x+5,p.y-5,2,2,'#9b9e83');}
 drawDeer(x,y,i){const p=this.iso(x,y);this.ellipse(p.x,p.y-5,5.5,2.5,'#a89870');for(const n of [-3,3])this.line([{x:p.x+n,y:p.y-5},{x:p.x+n+Math.sin(this.time+i)*.7,y:p.y+1}],'#7d8060',1);this.line([{x:p.x+4,y:p.y-4},{x:p.x+6,y:p.y-10}],'#ac9a70',2.5);this.ellipse(p.x+7,p.y-10,2.5,1.3,'#b2a17a');if(i%2===0)this.line([{x:p.x+5,y:p.y-10},{x:p.x+4,y:p.y-15},{x:p.x+2,y:p.y-16}],'#827e5c',.8);}
 drawAtmosphere(time){const c=this.ctx;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);
  if(this.world.season===3){for(let i=0;i<75;i++){const x=(hash(i,1)*this.width+time*(6+hash(i,5)*5))%this.width,y=(hash(i,2)*this.height+time*(10+hash(i,4)*10))%this.height;this.ellipse(x,y,1+hash(i,3),1+hash(i,3),'#f2f0df70');}}
  else{for(let i=0;i<7;i++){const x=(hash(i,2)*this.width+time*9)%this.width,y=hash(i,5)*this.height*.65+Math.sin(time*.6+i)*7;const flap=Math.sin(time*4+i)*2;c.strokeStyle='#3f52476b';c.lineWidth=.8;c.beginPath();c.moveTo(x-4,y+flap);c.lineTo(x,y);c.lineTo(x+4,y+flap);c.stroke();}}
  c.restore();}
 drawMini(){
  const w=this.world,c=this.mc,p=palettes[w.season],ox=w.terrainVersion===3?w.viewRegion.x*SIZE:0,oy=w.terrainVersion===3?w.viewRegion.y*SIZE:0;
  const key=`${w.season}-${ox},${oy}-${w.buildings.length}-${w.totalDays}-${this.buildMode}`;
  if(key!==this.miniKey){
   const ca=document.createElement('canvas');ca.width=SIZE;ca.height=SIZE;const ctx=ca.getContext('2d');
   for(const t of w.tiles){ctx.fillStyle=t.building?'#d9c49b':t.bridge?'#baab83':t.type==='water'?'#7aabac':t.type==='hill'?(t.biome==='alpine'?'#e0e7df':t.biome==='mountain'?'#999e99':'#a5afa2'):t.road?'#bcb18a':t.tree?p.pine[1]:t.biome==='steppe'?'#b7ae79':t.biome==='plain'?'#a2af84':t.biome==='meadow'?'#95a977':t.biome==='forest'?'#607a51':p.grass[1];ctx.fillRect(t.x-ox,t.y-oy,1,1);}
   this.miniCache=ca;this.miniKey=key;
  }
  c.imageSmoothingEnabled=false;c.drawImage(this.miniCache,0,0,160,160);
  const corners=[this.unproject(0,0),this.unproject(this.width,0),this.unproject(this.width,this.height),this.unproject(0,this.height)];
  c.beginPath();corners.forEach((point,i)=>i?c.lineTo((point.x-ox)*2.5,(point.y-oy)*2.5):c.moveTo((point.x-ox)*2.5,(point.y-oy)*2.5));
  c.closePath();c.fillStyle='#f3edd911';c.fill();c.strokeStyle='#e8dfb5b0';c.lineWidth=1;c.stroke();
 }

}
