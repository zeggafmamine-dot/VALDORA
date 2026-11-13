import {stoneCapacity,stoneRemaining,MAX_STONE_PER_TILE} from './stone-deposits.mjs';
// Cache acotada de sectores. El mundo es determinista; solo se guardan las modificaciones del jugador.
export const CHUNK_SIZE=64;
export const CHUNK_LIMIT=20;
export const VIEW_SIZE=64;
const key=(x,y)=>x+','+y;
const valid=n=>Number.isSafeInteger(n)&&Math.abs(n)<Number.MAX_SAFE_INTEGER/4;
export class ChunkStore{
 constructor(createTile){this.createTile=createTile;this.cache=new Map();this.changes=new Map();this.region={x:0,y:0};}
 get chunkCount(){return this.cache.size;}
 get changedCount(){return this.changes.size;}
 // La región de juego y cada sector comparten el mismo tamaño: 64 × 64.
 isActive(cx,cy){return Math.abs(cx-this.region.x)<=1&&Math.abs(cy-this.region.y)<=1;}
 getChunk(cx,cy){
  const k=key(cx,cy);
  if(this.cache.has(k)){const value=this.cache.get(k);this.cache.delete(k);this.cache.set(k,value);return value;}
  const tiles=new Array(CHUNK_SIZE*CHUNK_SIZE);
  for(let iy=0;iy<CHUNK_SIZE;iy++)for(let ix=0;ix<CHUNK_SIZE;ix++){
   const x=cx*CHUNK_SIZE+ix,y=cy*CHUNK_SIZE+iy,t=this.createTile(x,y),delta=this.changes.get(key(x,y));
   if(delta)Object.assign(t,delta);tiles[iy*CHUNK_SIZE+ix]=t;
  }
  this.cache.set(k,tiles);this.trim();return tiles;
 }
 tile(x,y){
  x=Math.floor(x);y=Math.floor(y);if(!valid(x)||!valid(y))return null;
  const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);
  return this.getChunk(cx,cy)[(y-cy*CHUNK_SIZE)*CHUNK_SIZE+x-cx*CHUNK_SIZE];
 }
 remember(t){
  if(!t)return;
  this.changes.set(key(t.x,t.y),{tree:!!t.tree,rock:!!t.rock,road:!!t.road,bridge:!!t.bridge,bridgeAxis:t.bridgeAxis,marked:!!t.marked,stoneLeft:stoneRemaining(t),stoneScar:!!t.stoneScar});
 }
 override(x,y,state){
  if(!valid(x)||!valid(y))throw Error('Casilla no válida');
  const old=this.cache.get(key(Math.floor(x/CHUNK_SIZE),Math.floor(y/CHUNK_SIZE)))?.[(y%CHUNK_SIZE+CHUNK_SIZE)%CHUNK_SIZE*CHUNK_SIZE+(x%CHUNK_SIZE+CHUNK_SIZE)%CHUNK_SIZE];
  const base=old||this.createTile(x,y);
  const stoneLeft=state.stoneLeft===undefined?(state.rock?stoneCapacity(base):0):state.stoneLeft;
  if(!Number.isInteger(stoneLeft)||stoneLeft<0||stoneLeft>MAX_STONE_PER_TILE)throw Error('Piedra no válida');
  const value={tree:!!state.tree,rock:!!state.rock&&stoneLeft>0,road:!!state.road,bridge:!!state.bridge,marked:!!state.marked,bridgeAxis:['x','y'].includes(state.bridgeAxis)?state.bridgeAxis:undefined,stoneLeft,stoneScar:!!state.stoneScar};
  this.changes.set(key(x,y),value);
  const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE),chunk=this.cache.get(key(cx,cy));
  if(chunk)Object.assign(chunk[(y-cy*CHUNK_SIZE)*CHUNK_SIZE+x-cx*CHUNK_SIZE],value);
 }
 setRegion(rx,ry){
  if(!valid(rx)||!valid(ry))return null;
  this.region={x:rx,y:ry};const tiles=[];
  for(let y=ry*VIEW_SIZE;y<(ry+1)*VIEW_SIZE;y++)for(let x=rx*VIEW_SIZE;x<(rx+1)*VIEW_SIZE;x++)tiles.push(this.tile(x,y));
  this.queueNearby();this.trim();return tiles;
 }
 // Solo se precarga el primer anillo de vecinos; no se genera el segundo anillo innecesariamente.
 queueNearby(){
  this.pending=[];this.pendingKeys=new Set();
  for(let radius=1;radius<=1;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
   const cx=this.region.x+dx,cy=this.region.y+dy,k=key(cx,cy);
   if(!this.cache.has(k)&&!this.pendingKeys.has(k)){this.pending.push({cx,cy});this.pendingKeys.add(k);}
  }
 }
 prefetchNext(maxChunks=1){
  if(!Number.isInteger(maxChunks)||maxChunks<1)return 0;
  let done=0;
  while(done<maxChunks&&this.pending?.length){
   const {cx,cy}=this.pending.shift();this.pendingKeys.delete(key(cx,cy));
   if(Math.abs(cx-this.region.x)>1||Math.abs(cy-this.region.y)>1||this.cache.has(key(cx,cy)))continue;
   this.getChunk(cx,cy);done++;
  }
  return done;
 }
 trim(){
  if(this.cache.size<=CHUNK_LIMIT)return;
  // Primero descartar sectores lejanos, manteniendo lo visible (radio 1).
  for(const k of [...this.cache.keys()]){
   if(this.cache.size<=CHUNK_LIMIT)break;
   const [cx,cy]=k.split(',').map(Number);
   if(!this.isActive(cx,cy))this.cache.delete(k);
  }
  // Las consultas de simulación fuera del encuadre no deben hacer crecer la caché.
  while(this.cache.size>CHUNK_LIMIT)this.cache.delete(this.cache.keys().next().value);
 }
 exportChanges(){return [...this.changes].map(([xy,state])=>{const [x,y]=xy.split(',').map(Number);return [x,y,+state.tree,+state.rock,+state.road,+state.bridge,state.bridgeAxis==='x'?1:state.bridgeAxis==='y'?2:0,+state.marked,state.stoneLeft,+state.stoneScar];});}
 importChanges(records){
  if(!Array.isArray(records)||records.length>500000)throw Error('Cambios no válidos');
  for(const row of records){
   if(!Array.isArray(row)||![8,9,10].includes(row.length)||!valid(row[0])||!valid(row[1])||!row.slice(2,8).every(n=>Number.isInteger(n)&&n>=0&&n<=2)||(row.length>=9&&(!Number.isInteger(row[8])||row[8]<0||row[8]>MAX_STONE_PER_TILE))||(row.length===10&&![0,1].includes(row[9])))throw Error('Cambios no válidos');
   this.override(row[0],row[1],{tree:!!row[2],rock:!!row[3],road:!!row[4],bridge:!!row[5],bridgeAxis:row[6]===1?'x':row[6]===2?'y':undefined,marked:!!row[7],stoneLeft:row.length>=9?row[8]:undefined,stoneScar:row.length===10?!!row[9]:false});
  }
 }
}
