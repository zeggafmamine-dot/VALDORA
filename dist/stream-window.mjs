// Planificador puro para un horizonte móvil alrededor de la cámara.
// Horizonte tres veces mayor (170 → 510 unidades), sin ampliar los sectores de 64x64.
// La banda de aparición permanece en 74 unidades, igual que en el mapa anterior.
export const VISUAL_RADIUS=8;
export const MAX_VISUAL_CHUNKS=300;
export const RETIRE_RADIUS=9;
export const FULL_DETAIL_DISTANCE=436;
export const FADE_OUT_DISTANCE=510;
export const FADE_SECONDS=.9;
export const CHUNK_WIDTH=64;
export const id=(x,y)=>x+','+y;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function chunkDistance(cx,cy,x,y){
 return Math.max(Math.abs(cx*CHUNK_WIDTH+CHUNK_WIDTH/2-x),Math.abs(cy*CHUNK_WIDTH+CHUNK_WIDTH/2-y));
}
export function visibilityTarget(cx,cy,x,y){
 const d=chunkDistance(cx,cy,x,y);
 const p=clamp((d-FULL_DETAIL_DISTANCE)/(FADE_OUT_DISTANCE-FULL_DETAIL_DISTANCE),0,1);
 return 1-p*p*(3-2*p);
}
export function approachOpacity(current,target,dt){
 if(!Number.isFinite(current)||!Number.isFinite(target)||!Number.isFinite(dt))return 0;
 const t=clamp(dt/FADE_SECONDS,0,1);
 return clamp(current+(target-current)*t,0,1);
}
export function desiredChunks(x,y,radius=VISUAL_RADIUS){
 const cx=Math.floor(x/CHUNK_WIDTH),cy=Math.floor(y/CHUNK_WIDTH),list=[];
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const ix=cx+dx,iy=cy+dy;
  const distance=chunkDistance(ix,iy,x,y);
  list.push({x:ix,y:iy,key:id(ix,iy),distance,opacity:visibilityTarget(ix,iy,x,y)});
 }
 list.sort((a,b)=>a.distance-b.distance);return list;
}
export function shouldRetire(cx,cy,x,y){
 return Math.max(Math.abs(cx-Math.floor(x/CHUNK_WIDTH)),Math.abs(cy-Math.floor(y/CHUNK_WIDTH)))>RETIRE_RADIUS;
}
