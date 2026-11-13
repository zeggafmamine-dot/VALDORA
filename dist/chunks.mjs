// Cache acotada de sectores. El mundo es determinista; solo se guardan las modificaciones del jugador.
export const CHUNK_SIZE=16;
export const CHUNK_LIMIT=80;
export const VIEW_SIZE=64;
const key=(x,y)=>x+','+y;
const valid=n=>Number.isSafeInteger(n)&&Math.abs(n)<Number.MAX_SAFE_INTEGER/4;
export class ChunkStore{
 constructor(createTile){this.createTile=createTile;this.cache=new Map();this.changes=new Map();this.region={x:0,y:0};}
 get chunkCount(){return this.cache.size;}
 get changedCount(){return this.changes.size;}
 isActive(cx,cy){return cx>=this.region.x*4-2&&cx<this.region.x*4+6&&cy>=this.region.y*4-2&&cy<this.region.y*4+6;}
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
  this.changes.set(key(t.x,t.y),{tree:!!t.tree,rock:!!t.rock,road:!!t.road,bridge:!!t.bridge,bridgeAxis:t.bridgeAxis,marked:!!t.marked});
 }
 override(x,y,state){
  if(!valid(x)||!valid(y))throw Error('Casilla no válida');
  const value={tree:!!state.tree,rock:!!state.rock,road:!!state.road,bridge:!!state.bridge,marked:!!state.marked,bridgeAxis:['x','y'].includes(state.bridgeAxis)?state.bridgeAxis:undefined};
  this.changes.set(key(x,y),value);
  const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE),chunk=this.cache.get(key(cx,cy));
  if(chunk)Object.assign(chunk[(y-cy*CHUNK_SIZE)*CHUNK_SIZE+x-cx*CHUNK_SIZE],value);
 }
 setRegion(rx,ry){
  if(!valid(rx)||!valid(ry))return null;
  this.region={x:rx,y:ry};const tiles=[];
  for(let y=ry*VIEW_SIZE;y<(ry+1)*VIEW_SIZE;y++)for(let x=rx*VIEW_SIZE;x<(rx+1)*VIEW_SIZE;x++)tiles.push(this.tile(x,y));
  this.trim();return tiles;
 }
 trim(){
  if(this.cache.size<=CHUNK_LIMIT)return;
  for(const k of [...this.cache.keys()]){
   if(this.cache.size<=CHUNK_LIMIT)break;
   const [cx,cy]=k.split(',').map(Number);
   if(!this.isActive(cx,cy))this.cache.delete(k);
  }
 }
 exportChanges(){return [...this.changes].map(([xy,state])=>{const [x,y]=xy.split(',').map(Number);return [x,y,+state.tree,+state.rock,+state.road,+state.bridge,state.bridgeAxis==='x'?1:state.bridgeAxis==='y'?2:0,+state.marked];});}
 importChanges(records){
  if(!Array.isArray(records)||records.length>500000)throw Error('Cambios no válidos');
  for(const row of records){
   if(!Array.isArray(row)||row.length!==8||!valid(row[0])||!valid(row[1])||!row.slice(2).every(n=>Number.isInteger(n)&&n>=0&&n<=2))throw Error('Cambios no válidos');
   this.override(row[0],row[1],{tree:!!row[2],rock:!!row[3],road:!!row[4],bridge:!!row[5],bridgeAxis:row[6]===1?'x':row[6]===2?'y':undefined,marked:!!row[7]});
  }
 }
}
