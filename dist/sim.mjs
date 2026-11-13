import {planLine} from './paths.mjs';
import {terrainSample,validCoordinates,REGION_SIZE} from './terrain.mjs';
import {ChunkStore} from './chunks.mjs';
export const SIZE=64;
export const SEASONS=[{name:'Primavera',short:'Prim.',temperature:14,color:'#a2bf76'},{name:'Verano',short:'Ver.',temperature:24,color:'#e7bd6b'},{name:'Otoño',short:'Oto.',temperature:10,color:'#c98e55'},{name:'Invierno',short:'Inv.',temperature:-5,color:'#b8d0dc'}];
export const RESOURCES={wood:{name:'Madera',icon:'wood',color:'#c5a584'},stone:{name:'Piedra',icon:'stone',color:'#bcc4ca'},food:{name:'Alimentos',icon:'food',color:'#d9bf76'},firewood:{name:'Leña',icon:'fire',color:'#e6a06f'}};
export const BUILDINGS={
 house:{name:'Casa de madera',category:'Poblado',icon:'house',w:2,h:2,cost:{wood:28,stone:10},days:4,maxWorkers:0,capacity:4,description:'Un hogar para 4 habitantes. El refugio y la leña los protegen durante el invierno.',detail:'Capacidad: 4 habitantes',color:'#b88c62'},
 farm:{name:'Campo de cultivo',category:'Alimentos',icon:'wheat',w:3,h:3,cost:{wood:20,stone:5},days:4,maxWorkers:2,description:'Cultiva trigo de primavera a otoño. En invierno el campo descansa.',detail:'Por trabajador: 2 / 3 / 4 / 0 alimentos al día',color:'#d7b96f'},
 gatherer:{name:'Cabaña recolectora',category:'Alimentos',icon:'berry',w:2,h:2,cost:{wood:30,stone:8},days:4,maxWorkers:2,description:'Recoge bayas y setas. Produce todo el año; necesita árboles en un radio de 7 casillas.',detail:'Hasta 3 alimentos por trabajador y día',color:'#bd8e68'},
 fisher:{name:'Cabaña de pesca',category:'Alimentos',icon:'fish',w:2,h:2,cost:{wood:35,stone:10},days:5,maxWorkers:2,nearWater:true,description:'Pesca en el río durante todo el año. Constrúyela a un máximo de 4 casillas del agua.',detail:'2,6 alimentos por trabajador y día',color:'#8baeb1'},
 forester:{name:'Puesto forestal',category:'Recursos',icon:'tree',w:2,h:2,cost:{wood:25,stone:8},days:4,maxWorkers:2,description:'Tala y replanta el bosque cercano. Necesita árboles en un radio de 8 casillas.',detail:'Hasta 3 maderas por trabajador y día',color:'#87a779'},
 woodcutter:{name:'Leñador',category:'Recursos',icon:'axe',w:2,h:2,cost:{wood:20,stone:10},days:3,maxWorkers:1,description:'Convierte 2 unidades de madera en 5 de leña cada día. Esencial para el invierno.',detail:'2 madera → 5 leña por trabajador y día',color:'#ce9b75'},
 quarry:{name:'Cantera',category:'Recursos',icon:'pick',w:3,h:3,cost:{wood:40,stone:10},days:6,maxWorkers:2,description:'Extrae piedra para construir y ampliar tu aldea.',detail:'2 piedras por trabajador y día',color:'#a5b0b4'},
 pasture:{name:'Pastizal de ovejas',category:'Alimentos',icon:'sheep',w:3,h:3,cost:{wood:40,stone:10},days:5,maxWorkers:2,description:'Cría un pequeño rebaño que aporta alimentos durante todo el año.',detail:'2,4 alimentos por trabajador y día',color:'#c7d0aa'},
 well:{name:'Pozo',category:'Poblado',icon:'water',w:1,h:1,cost:{wood:12,stone:20},days:3,maxWorkers:0,description:'El agua limpia mejora la salud de toda la aldea en 10 puntos.',detail:'+10 salud',color:'#95b7c5'},
 market:{name:'Mercado',category:'Poblado',icon:'market',w:2,h:2,cost:{wood:45,stone:25},days:6,maxWorkers:0,description:'Un lugar de encuentro que aumenta la felicidad de los habitantes.',detail:'+12 felicidad',color:'#bf7b67'},
 warehouse:{name:'Almacén',category:'Poblado',icon:'crate',w:2,h:2,cost:{wood:35,stone:20},days:5,maxWorkers:0,description:'Amplía la capacidad de cada recurso en 500 unidades.',detail:'+500 de capacidad por recurso',color:'#c0a17d'},
 road:{name:'Camino de piedra',category:'Caminos',icon:'road',w:1,h:1,cost:{stone:1},days:0,maxWorkers:0,description:'Los aldeanos caminan más deprisa por los caminos. Arrastra del inicio al final: verás el recorrido y su coste antes de construir.',detail:'1 piedra por casilla',color:'#bfb799'},
 bridge:{name:'Puente de madera',category:'Caminos',icon:'bridge',w:1,h:1,cost:{wood:6},days:0,maxWorkers:0,waterOnly:true,description:'Arrastra de una orilla a la otra. Se construirá un puente recto completo, incluidos sus accesos.',detail:'6 maderas por casilla',color:'#b09574'},
 hall:{name:'Casa de los colonos',category:'',icon:'flag',w:2,h:2,cost:{},days:0,maxWorkers:0,description:'El corazón de Valdora. Cada estación pueden llegar nuevos habitantes si hay viviendas y alimentos.',detail:'Punto de llegada de nuevos colonos',color:'#d0b28a'}
};
export function hash(x,y,s=0){let n=Math.imul(x+Math.imul(y,374761393)+s,668265263);n=(n^(n>>>13));return ((Math.imul(n,1274126177)^(n>>>16))>>>0)/4294967295;}
function seedHash(s){let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function smooth(x,y,seed){const a=Math.floor(x),b=Math.floor(y),u=(x-a)**2*(3-2*(x-a)),v=(y-b)**2*(3-2*(y-b));return (hash(a,b,seed)*(1-u)+hash(a+1,b,seed)*u)*(1-v)+(hash(a,b+1,seed)*(1-u)+hash(a+1,b+1,seed)*u)*v;}
const NAMES=['Elena','Mateo','Inés','Bruno','Alba','Nicolás','Clara','Tomás','Vera','Hugo','Lía','Gabriel','Nora','Leo','Sara','Iván','Emma','Adrián','Mara','Lucas','Aina','Amir','Noa','Oliver'];
export class World{
 constructor(seed='VALDORA-2048',restored=null,coordinates={x:0,y:0}){
  this.terrainVersion=restored?(restored.terrainVersion===1?1:3):3;this.coordinates=this.terrainVersion===3?(restored?restored.coordinates:coordinates):{x:0,y:0};
  if(this.terrainVersion===3&&!validCoordinates(this.coordinates))throw Error('Coordenadas no válidas');
  this.seed=String(seed);this.seedNumber=seedHash(seed);this.day=1;this.year=1;this.season=0;this.resources={wood:160,stone:90,food:220,firewood:75};this.health=100;this.happiness=85;this.speed=1;this.lastSpeed=1;this.nextId=1;this.buildings=[];this.citizens=[];this.events=[];this.gatherQueue=[];this.milestones=[];this.history=[];this.starveDays=0;this.coldDays=0;this.gameOver=false;this.won=false;this.totalDays=0;this.tiles=[];this.viewRegion={x:0,y:0};this.buildingCells=new Map();this.production={wood:0,stone:0,food:0,firewood:0};this.generate();
  if(restored){this.restore(restored);return;}
  this.addInitial('hall',29,29);this.addInitial('warehouse',32,29);this.addInitial('house',28,34);this.addInitial('house',32,34);
  for(let x=26;x<=36;x++){const t=this.tile(x,33);t.road=true;this.rememberTile(t);}
  for(let y=28;y<=38;y++){const t=this.tile(31,y);t.road=true;this.rememberTile(t);}
  for(let i=0;i<8;i++)this.addCitizen();
  this.log('Ocho colonos han llegado al valle. Su futuro está en tus manos.','welcome');
  this.log('Empieza con un campo de cultivo y una cabaña recolectora.','info');this.assignJobs();
 }
 generate(){
  if(this.terrainVersion===3){this.chunks=new ChunkStore((x,y)=>this.proceduralTile(x,y));this.setViewRegion(0,0,true);return;}
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const noise=smooth(x/9,y/9,this.seedNumber),r=hash(x,y,this.seedNumber),center=44+Math.sin(y/7+this.seedNumber%6)*2.4+Math.cos(y/15)*2,river=Math.abs(x-center),lake=((x-46)/6)**2+((y-49)/7)**2;
  const water=river<1.8||lake<1,hill=(noise>.59&&x<23&&y<26)||(x<10&&y<14&&noise>.4),clear=Math.hypot(x-31,y-33)<8;
  this.tiles.push({x,y,type:water?'water':hill?'hill':'grass',height:water?0:hill?7+Math.floor(noise*16):Math.floor(noise*3),variant:r,tree:!water&&!hill&&!clear&&r>(noise>.4?.35:.72),rock:!water&&!clear&&(hill?r>.45:r>.96),road:false,bridge:false,building:null,marked:false});
 }}
 // Las casillas usan coordenadas globales; solo el primer asentamiento tiene un claro inicial.
 proceduralTile(x,y){
  const ground=terrainSample(x+.5,y+.5,this.seedNumber,this.coordinates);
  const gx=this.coordinates.x*REGION_SIZE+x,gy=this.coordinates.y*REGION_SIZE+y;
  const r=hash(gx,gy,this.seedNumber),clear=Math.hypot(x-31.5,y-32.5)<9.5;
  const type=ground.water?'water':ground.hill?'hill':'grass';
  const density=(.17+ground.moisture*.64)*(ground.height>1.5?.55:1);
  return {x,y,type,height:ground.water?0:ground.hill?7+Math.floor(ground.height*2):Math.max(0,Math.floor(ground.height*1.3)),variant:r,tree:type==='grass'&&!clear&&r<density,rock:!ground.water&&!clear&&(ground.hill?r>.35:r>.97),road:false,bridge:false,building:this.buildingCells.get(x+','+y)||null,marked:false};
 }
 setViewRegion(x,y,force=false){
  if(this.terrainVersion!==3)return false;
  if(!force&&x===this.viewRegion.x&&y===this.viewRegion.y)return false;
  const tiles=this.chunks.setRegion(x,y);if(!tiles)return false;
  this.tiles=tiles;this.viewRegion={x,y};return true;
 }
 rememberTile(t){if(this.terrainVersion===3)this.chunks.remember(t);}
 get loadedChunks(){return this.terrainVersion===3?this.chunks.chunkCount:1;}
 tile(x,y){
  x=Math.floor(x);y=Math.floor(y);
  if(this.terrainVersion===3)return this.chunks.tile(x,y);
  return x>=0&&y>=0&&x<SIZE&&y<SIZE?this.tiles[y*SIZE+x]:null;
 }
 addInitial(type,x,y){const d=BUILDINGS[type],b={id:this.nextId++,type,x,y,w:d.w,h:d.h,progress:1,workers:0,paused:false};this.buildings.push(b);this.occupy(b);return b;}
 occupy(b){for(let dy=0;dy<b.h;dy++)for(let dx=0;dx<b.w;dx++){let t=this.tile(b.x+dx,b.y+dy);if(t){t.building=b.id;if(this.terrainVersion===3)this.buildingCells.set(t.x+','+t.y,b.id);t.tree=false;t.rock=false;t.road=false;t.marked=false;this.rememberTile(t);}}}
 get population(){return this.citizens.length;}
 get capacity(){return this.buildings.filter(b=>b.type==='house'&&b.progress>=1).length*4;}
 get storage(){return 500+this.buildings.filter(b=>b.type==='warehouse'&&b.progress>=1).length*500;}
 get workers(){return this.buildings.reduce((n,b)=>n+b.workers,0);}
 get idle(){return this.population-this.workers;}
 get builders(){return Math.max(0,Math.min(this.idle,4));}
 get foodDays(){return Math.floor(this.resources.food/Math.max(1,this.population*.45));}
 get temperature(){return SEASONS[this.season].temperature+Math.round(Math.sin(this.day*.7+this.seedNumber)*3);}
 get goals(){return [{id:'food',title:'El sustento del valle',text:'Construye un campo y una cabaña recolectora',done:['farm','gatherer'].every(t=>this.buildings.some(b=>b.type===t&&b.progress>=1))},{id:'wood',title:'Prepararse para el frío',text:'Construye un leñador y reúne 60 de leña',done:this.buildings.some(b=>b.type==='woodcutter'&&b.progress>=1)&&this.resources.firewood>=60},{id:'winter',title:'Nuestro primer invierno',text:'Alcanza el año 2 con al menos 8 habitantes',done:this.year>=2&&this.population>=8},{id:'village',title:'Una aldea que prospera',text:'Llega a 16 habitantes y 200 alimentos',done:this.population>=16&&this.resources.food>=200}];}
 log(text,type='info'){this.events.unshift({id:Date.now()+Math.random(),text,type,date:`${SEASONS[this.season].short} ${this.day}, año ${this.year}`});this.events=this.events.slice(0,60);}
 canAfford(cost){return Object.entries(cost).every(([r,n])=>this.resources[r]>=n);}
 nearWater(x,y,w,h){for(let yy=y-4;yy<y+h+4;yy++)for(let xx=x-4;xx<x+w+4;xx++)if(this.tile(xx,yy)?.type==='water'&&Math.hypot(xx-x,yy-y)<6)return true;return false;}
 canPlace(type,x,y){const d=BUILDINGS[type];if(!d||type==='hall')return {ok:false,reason:'Selecciona un edificio.'};if(!Number.isInteger(x)||!Number.isInteger(y))return {ok:false,reason:'Fuera del mapa.'};
  for(let dy=0;dy<d.h;dy++)for(let dx=0;dx<d.w;dx++){
   const t=this.tile(x+dx,y+dy);if(!t)return {ok:false,reason:'Fuera del mapa.'};
   if(t.building)return {ok:false,reason:'Este terreno ya está ocupado.'};
   if(d.waterOnly){if(t.type!=='water'||t.bridge)return {ok:false,reason:'Coloca el puente sobre el agua.'};}
   else if(t.type!=='grass'||t.bridge)return {ok:false,reason:'Necesitas terreno llano y seco.'};
   if(type==='road'&&t.road)return {ok:false,reason:'Ya existe un camino aquí.'};
  }
  if(d.nearWater&&!this.nearWater(x,y,d.w,d.h))return {ok:false,reason:'La cabaña debe estar a 4 casillas del río.'};
  if(!this.canAfford(d.cost))return {ok:false,reason:'No hay suficientes recursos.'};
  return {ok:true,reason:d.days?'Clic para construir · Esc para cancelar':'Mantén pulsado para trazar'};
 }
 place(type,x,y){const result=this.canPlace(type,x,y);if(!result.ok)return result;const d=BUILDINGS[type];for(const [r,n]of Object.entries(d.cost))this.resources[r]-=n;
  if(type==='road'||type==='bridge'){const t=this.tile(x,y);t[type]=true;t.tree=false;t.rock=false;this.rememberTile(t);return {ok:true};}
  const b={id:this.nextId++,type,x,y,w:d.w,h:d.h,progress:0,workers:0,paused:false};this.buildings.push(b);this.occupy(b);this.log(`Comienza la construcción: ${d.name.toLowerCase()}.`);return {ok:true,building:b};
 }
 previewLine(type,start,end){return planLine(this,type,start,end);}
 placeLine(type,start,end){const plan=this.previewLine(type,start,end);if(!plan.ok)return plan;if(this.gameOver)return {...plan,ok:false,reason:'La partida ha terminado.'};for(const [key,n]of Object.entries(plan.cost))this.resources[key]-=n;const cleared=new Set();for(const p of plan.cells){if(!p.action)continue;const t=this.tile(p.x,p.y);t[p.action]=true;if(type==='bridge'){t.bridgeAxis=plan.axis;t.road=false;}t.tree=false;t.rock=false;t.marked=false;cleared.add(p.x+','+p.y);this.rememberTile(t);}this.gatherQueue=this.gatherQueue.filter(q=>!cleared.has(q.x+','+q.y));if(plan.count)this.log(`${type==='road'?'Camino':'Puente'} completado: ${plan.count} tramos.`, 'success');return plan;}
 markGather(x,y){const t=this.tile(x,y);if(!t||(!t.tree&&!t.rock))return {ok:false,reason:'Selecciona un árbol o una roca.'};if(t.marked)return {ok:false,reason:'Ya está marcado para recoger.'};t.marked=true;this.rememberTile(t);this.gatherQueue.push({x:t.x,y:t.y,progress:0});return {ok:true};}
 demolish(id){const b=this.buildings.find(b=>b.id===id);if(!b||b.type==='hall')return false;const d=BUILDINGS[b.type];for(const [r,n]of Object.entries(d.cost))this.resources[r]=Math.min(this.storage,this.resources[r]+Math.floor(n*.5));for(let dy=0;dy<b.h;dy++)for(let dx=0;dx<b.w;dx++){const t=this.tile(b.x+dx,b.y+dy);if(t){t.building=null;if(this.terrainVersion===3)this.buildingCells.delete(t.x+','+t.y);this.rememberTile(t);}}this.buildings=this.buildings.filter(v=>v.id!==id);this.assignJobs();this.log(`${d.name}: recuperado el 50 % de los materiales.`);return true;}
 addCitizen(){const i=this.nextId++;this.citizens.push({id:i,name:NAMES[(i-6)%NAMES.length]||'Colono',age:18+Math.floor(hash(i,3,this.seedNumber)*32),x:30.5+hash(i,1),y:32+hash(i,2),job:null,path:[],wait:0,color:['#c3a76d','#9cab98','#ad7361','#d0bd94','#8cabb5','#9e909f'][i%6]});}
 assignJobs(){let free=this.citizens.slice();for(const c of free)c.job=null;for(const b of this.buildings){if(b.progress<1)b.workers=0;const want=Math.min(b.workers,free.length,BUILDINGS[b.type].maxWorkers);b.workers=want;for(let n=0;n<want;n++)free.shift().job=b.id;}}
 changeWorkers(id,amount){const b=this.buildings.find(v=>v.id===id);if(!b||b.progress<1)return false;const cap=BUILDINGS[b.type].maxWorkers;if(amount>0&&(this.idle<=0||b.workers>=cap))return false;if(amount<0&&b.workers<=0)return false;b.workers=Math.max(0,Math.min(cap,b.workers+amount));this.assignJobs();return true;}
 forestAt(b,radius=7){let trees=0;for(let y=b.y-radius;y<b.y+radius;y++)for(let x=b.x-radius;x<b.x+radius;x++)if(this.tile(x,y)?.tree)trees++;return Math.min(1,trees/18);}
 tick(){if(this.gameOver)return;this.totalDays++;this.day++;if(this.day>30){this.day=1;this.season++;if(this.season>3){this.season=0;this.year++;}this.newSeason();}
  const before={...this.resources};
  const unfinished=this.buildings.filter(b=>b.progress<1),builders=this.builders;
  if(unfinished.length&&builders>0){let effort=builders/2;for(const b of unfinished){const d=BUILDINGS[b.type],needed=(1-b.progress)*d.days,use=Math.min(effort,needed);b.progress=Math.min(1,b.progress+use/d.days);effort-=use;if(b.progress>=.99999){b.progress=1;b.workers=Math.min(d.maxWorkers,Math.max(0,this.idle-1));this.assignJobs();this.log(`${d.name}: construcción terminada.`,'success');}if(effort<=0)break;}}
  if(builders>0&&this.gatherQueue.length){const q=this.gatherQueue[0];q.progress+=builders*.5;if(q.progress>=1){const t=this.tile(q.x,q.y);if(t?.tree){this.resources.wood+=12;t.tree=false;}if(t?.rock){this.resources.stone+=10;t.rock=false;}if(t){t.marked=false;this.rememberTile(t);}this.gatherQueue.shift();}}
  for(const b of this.buildings){if(b.progress<1||b.paused||!b.workers)continue;const w=b.workers;
   if(b.type==='farm')this.resources.food+=[2,3,4,0][this.season]*w;
   if(b.type==='gatherer')this.resources.food+=3*w*this.forestAt(b)*(this.season===3?.6:1);
   if(b.type==='fisher')this.resources.food+=2.6*w;
   if(b.type==='pasture')this.resources.food+=2.4*w;
   if(b.type==='quarry')this.resources.stone+=2*w;
   if(b.type==='forester'){this.resources.wood+=3*w*this.forestAt(b,8);if(this.totalDays%3===0){for(let tries=0;tries<12;tries++){let x=b.x+Math.floor(hash(this.totalDays+tries,1,this.seedNumber)*16)-8,y=b.y+Math.floor(hash(1,this.totalDays+tries,this.seedNumber)*16)-8,t=this.tile(x,y);if(t&&t.type==='grass'&&!t.building&&!t.road&&!t.rock&&!t.tree){t.tree=true;this.rememberTile(t);break;}}}}
   if(b.type==='woodcutter'){const input=Math.min(this.resources.wood,2*w);this.resources.wood-=input;this.resources.firewood+=input*2.5;}
  }
  const foodNeed=this.population*.45,heatNeed=this.population*(this.season===3?.2:.025);
  const starving=this.resources.food<foodNeed,cold=this.season===3&&(this.resources.firewood<heatNeed||this.capacity<this.population);
  this.resources.food=Math.max(0,this.resources.food-foodNeed);this.resources.firewood=Math.max(0,this.resources.firewood-heatNeed);
  const well=this.buildings.some(b=>b.type==='well'&&b.progress>=1),market=this.buildings.some(b=>b.type==='market'&&b.progress>=1);
  this.health=Math.max(0,Math.min(well?100:90,this.health+(starving?-5:cold?-3:1)));
  const target=75+(market?12:0)+(this.resources.food>100?8:0)-(this.capacity<this.population?20:0)-(starving?40:0)-(cold?25:0);
  this.happiness=Math.max(0,Math.min(100,this.happiness+(target-this.happiness)*.12));
  this.starveDays=starving?this.starveDays+1:0;this.coldDays=cold?this.coldDays+1:0;
  if(this.starveDays===1)this.log('Las reservas de alimentos se han agotado. ¡Hay hambre en la aldea!','danger');
  if(this.coldDays===1)this.log('Los habitantes pasan frío. Necesitan viviendas y leña.','danger');
  if(this.starveDays>=8||this.coldDays>=12){const c=this.citizens.pop();if(c){this.log(`${c.name} ha fallecido por ${this.starveDays>=8?'hambre':'el frío'}.`,'danger');this.assignJobs();}this.starveDays=Math.max(0,this.starveDays-4);this.coldDays=Math.max(0,this.coldDays-6);}
  if(!this.population){this.gameOver=true;this.speed=0;this.log('La aldea ha quedado deshabitada. Puedes comenzar de nuevo con otra semilla.','danger');}
  for(const key of Object.keys(this.resources)){this.resources[key]=Math.max(0,Math.min(this.storage,this.resources[key]));this.production[key]=this.resources[key]-before[key];}
  if(this.totalDays%5===0){this.history.push({day:this.totalDays,pop:this.population,food:this.resources.food,wood:this.resources.wood});this.history=this.history.slice(-60);}
  for(const goal of this.goals)if(goal.done&&!this.milestones.includes(goal.id)){this.milestones.push(goal.id);this.log(`Objetivo completado: ${goal.title}.`,'milestone');}
  if(this.milestones.length===4&&!this.won){this.won=true;this.log('¡Valdora prospera! Has cumplido todos los objetivos. Puedes seguir ampliando tu aldea.','milestone');}
 }
 newSeason(){const s=SEASONS[this.season];this.log(`${s.name}, año ${this.year}. ${this.season===3?'Los campos descansan. Las reservas de leña son esenciales.':this.season===0?'El valle vuelve a despertar.':this.season===2?'Es tiempo de cosechar y preparar el invierno.':'Los campos están en su mejor momento.'}`,'season');
  if(this.capacity>this.population&&this.resources.food>this.population*6&&this.happiness>=50){const n=Math.min(2,this.capacity-this.population);for(let i=0;i<n;i++)this.addCitizen();this.log(`${n} nuevos colonos se han unido a la aldea.`,'success');this.assignJobs();}
  else if(this.capacity<=this.population)this.log('No hay viviendas libres para recibir nuevos colonos.');
 }
 passable(x,y){const t=this.tile(x,y);return !!t&&(t.type==='grass'||t.bridge)&&!t.building;}
 findPath(sx,sy,tx,ty){
  sx=Math.floor(sx);sy=Math.floor(sy);tx=Math.floor(tx);ty=Math.floor(ty);
  if(!this.passable(tx,ty)||Math.abs(sx-tx)+Math.abs(sy-ty)>90)return [];
  const key=(x,y)=>x+','+y,start=key(sx,sy),goal=key(tx,ty),queue=[[sx,sy]],prev=new Map([[start,null]]);
  let found=false;
  for(let i=0;i<queue.length&&i<1800;i++){
   const [x,y]=queue[i],k=key(x,y);if(k===goal){found=true;break;}
   for(const [dx,dy]of [[0,1],[1,0],[0,-1],[-1,0]]){const xx=x+dx,yy=y+dy,n=key(xx,yy);if(!prev.has(n)&&this.passable(xx,yy)){prev.set(n,k);queue.push([xx,yy]);}}
  }
  if(!found)return [];const path=[];let k=goal;
  while(k!==start){const [x,y]=k.split(',').map(Number);path.push({x:x+.5,y:y+.5});k=prev.get(k);}return path.reverse();
 }
 animate(dt,time){if(!this.speed||this.gameOver)return;for(const c of this.citizens){if(!this.passable(c.x,c.y)){for(let r=1;r<5;r++){let done=false;for(const [dx,dy]of [[r,0],[-r,0],[0,r],[0,-r]])if(this.passable(Math.floor(c.x)+dx,Math.floor(c.y)+dy)){c.x=Math.floor(c.x)+dx+.5;c.y=Math.floor(c.y)+dy+.5;c.path=[];done=true;break;}if(done)break;}}
   if(c.path.length){const t=c.path[0],dx=t.x-c.x,dy=t.y-c.y,dist=Math.hypot(dx,dy),step=dt*Math.min(this.speed,3)*1.25*(this.tile(c.x,c.y)?.road?1.5:1);if(dist<=step){c.x=t.x;c.y=t.y;c.path.shift();c.wait=1+hash(c.id,this.totalDays)*3;}else{c.x+=dx/dist*step;c.y+=dy/dist*step;}continue;}
   c.wait-=dt*this.speed;if(c.wait>0)continue;const b=this.buildings.find(b=>b.id===c.job)||this.buildings.find(b=>b.progress<1);let tx,ty;
   if(b&&hash(c.id,Math.floor(time/4))>.3){tx=b.x+b.w;ty=b.y+b.h-1;}else{const r=hash(c.id+Math.floor(time/3),this.totalDays,this.seedNumber);tx=26+Math.floor(r*12);ty=28+Math.floor(hash(c.id,Math.floor(time/2))*11);}
   c.path=this.findPath(c.x,c.y,tx,ty);c.wait=c.path.length?0:2;
  }}
 serialize(){return {version:1,terrainVersion:this.terrainVersion,coordinates:this.coordinates,seed:this.seed,day:this.day,year:this.year,season:this.season,resources:this.resources,health:this.health,happiness:this.happiness,nextId:this.nextId,buildings:this.buildings,citizens:this.citizens.map(c=>({...c,path:[]})),events:this.events,gatherQueue:this.gatherQueue,milestones:this.milestones,history:this.history,totalDays:this.totalDays,starveDays:this.starveDays,coldDays:this.coldDays,gameOver:this.gameOver,won:this.won,tiles:this.tiles.map(t=>({tree:t.tree,rock:t.rock,road:t.road,bridge:t.bridge,bridgeAxis:t.bridgeAxis,marked:t.marked}))};}
 restore(data){const validInt=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
  if(data.version!==1||![undefined,1,2].includes(data.terrainVersion)||(data.terrainVersion===2&&!validCoordinates(data.coordinates))||data.tiles?.length!==SIZE*SIZE||!Array.isArray(data.buildings)||data.buildings.length>SIZE*SIZE||!Array.isArray(data.citizens)||data.citizens.length>500||!data.resources||!Object.keys(RESOURCES).every(k=>Number.isFinite(data.resources[k])&&data.resources[k]>=0)||!validInt(data.day,1,30)||!validInt(data.year,1,100000)||!validInt(data.season,0,3)||!validInt(data.nextId,1,10000000)||!validInt(data.totalDays,0,12000000)||![data.health,data.happiness].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('Partida no válida');
  const ids=new Set();for(const b of data.buildings){const d=BUILDINGS[b.type];if(!d||!validInt(b.id,1,10000000)||ids.has(b.id)||b.w!==d.w||b.h!==d.h||!validInt(b.x,0,SIZE-b.w)||!validInt(b.y,0,SIZE-b.h)||!Number.isFinite(b.progress)||b.progress<0||b.progress>1||!validInt(b.workers,0,d.maxWorkers))throw Error('Edificio no válido');ids.add(b.id);}
  if(!data.citizens.every(c=>validInt(c.id,1,10000000)&&typeof c.name==='string'&&c.name.length<80&&validInt(c.age,0,150)&&Number.isFinite(c.x)&&Number.isFinite(c.y)&&c.x>=0&&c.x<SIZE&&c.y>=0&&c.y<SIZE&&/^#[0-9a-f]{6}$/i.test(c.color)))throw Error('Habitante no válido');
  if(!Array.isArray(data.events)||!data.events.every(e=>typeof e.text==='string'&&e.text.length<1000&&typeof e.date==='string'&&['info','welcome','success','danger','season','milestone'].includes(e.type))||!Array.isArray(data.gatherQueue)||!data.gatherQueue.every(q=>validInt(q.x,0,SIZE-1)&&validInt(q.y,0,SIZE-1)&&Number.isFinite(q.progress))||!Array.isArray(data.milestones)||!data.milestones.every(g=>['food','wood','winter','village'].includes(g))||!Array.isArray(data.history))throw Error('Partida no válida');
  for(const k of ['day','year','season','resources','health','happiness','nextId','buildings','citizens','events','gatherQueue','milestones','history','totalDays','starveDays','coldDays','gameOver','won'])if(data[k]!==undefined)this[k]=data[k];
  this.tiles.forEach((t,i)=>{for(const k of ['tree','rock','road','bridge','marked'])t[k]=data.tiles[i][k]===true;t.bridgeAxis=['x','y'].includes(data.tiles[i].bridgeAxis)?data.tiles[i].bridgeAxis:undefined;});for(const b of this.buildings)this.occupy(b);for(const c of this.citizens){c.path=[];c.wait=0;}this.assignJobs();this.speed=0;
 }
}
