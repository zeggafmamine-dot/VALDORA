// Horizonte procedural adaptable. Los sectores siguen midiendo 64 × 64.
// La banda donde aparecen/desaparecen NO crece cuando se amplía el mapa.
export const CHUNK_WIDTH=64;
export const CAMERA_DISTANCE=112; // La cámara muestra cuatro veces el ancho inicial original (28).
export const DEFAULT_GRAPHICS_QUALITY='low';
export const VISUAL_RADIUS=11;
export const MAX_VISUAL_CHUNKS=420;
export const RETIRE_RADIUS=12;
export const FULL_DETAIL_DISTANCE=566;
export const FADE_OUT_DISTANCE=640;
export const FADE_BAND=FADE_OUT_DISTANCE-FULL_DETAIL_DISTANCE; // 74 casillas, sin cambios.
export const MIN_HORIZON=320;
export const INITIAL_HORIZON=420;
export const MAX_HORIZON=640;
export const FADE_SECONDS=.9;
export const id=(x,y)=>x+','+y;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function chunkDistance(cx,cy,x,y){
 return Math.max(Math.abs(cx*CHUNK_WIDTH+CHUNK_WIDTH/2-x),Math.abs(cy*CHUNK_WIDTH+CHUNK_WIDTH/2-y));
}
// La distancia efectiva depende de los FPS y del zoom. La banda de 74 casillas
// siempre termina EXACTAMENTE en esa distancia, sin recorte brusco de sectores.
export function renderDistanceForZoom(zoom,performanceHorizon=MAX_HORIZON){
 if(!Number.isFinite(zoom)||zoom<=0)zoom=1;
 const budget=Number.isFinite(performanceHorizon)?clamp(performanceHorizon,MIN_HORIZON,MAX_HORIZON):INITIAL_HORIZON;
 return Math.min(budget,Math.max(MIN_HORIZON,CAMERA_DISTANCE/zoom*3.9+FADE_BAND));
}
export function visibilityTarget(cx,cy,x,y,horizon=MAX_HORIZON){
 const d=chunkDistance(cx,cy,x,y);
 const limit=Number.isFinite(horizon)?Math.max(FADE_BAND,horizon):MAX_HORIZON;
 const start=limit-FADE_BAND;
 const p=clamp((d-start)/FADE_BAND,0,1);
 return 1-p*p*(3-2*p);
}
export function approachOpacity(current,target,dt){
 if(!Number.isFinite(current)||!Number.isFinite(target)||!Number.isFinite(dt))return 0;
 const t=clamp(dt/FADE_SECONDS,0,1);
 return clamp(current+(target-current)*t,0,1);
}
export function desiredChunks(x,y,radius=VISUAL_RADIUS,horizon=MAX_HORIZON){
 const cx=Math.floor(x/CHUNK_WIDTH),cy=Math.floor(y/CHUNK_WIDTH),list=[];
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const ix=cx+dx,iy=cy+dy;
  const distance=chunkDistance(ix,iy,x,y);
  list.push({x:ix,y:iy,key:id(ix,iy),distance,opacity:visibilityTarget(ix,iy,x,y,horizon)});
 }
 list.sort((a,b)=>a.distance-b.distance);return list;
}
export function shouldRetire(cx,cy,x,y){
 return Math.max(Math.abs(cx-Math.floor(x/CHUNK_WIDTH)),Math.abs(cy-Math.floor(y/CHUNK_WIDTH)))>RETIRE_RADIUS;
}
// No hay un tamaño fijo que garantice los FPS en todos los ordenadores.
// Se amplía lentamente cuando hay margen y se reduce pronto al detectar lentitud.
export class AdaptiveHorizon {
 constructor(){
  this.distance=INITIAL_HORIZON;
  this.avgFrame=1/60;
  this.goodSeconds=0;
  this.badSeconds=0;
 }
 observe(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>.7)return this.distance;
  const sample=Math.min(dt,.25);
  this.avgFrame=this.avgFrame*.92+sample*.08;
  if(this.avgFrame>1/32){
   this.badSeconds+=sample;this.goodSeconds=0;
   if(this.badSeconds>=1.3){
    this.distance=Math.max(MIN_HORIZON,this.distance-64);
    this.badSeconds=0;
   }
  }else if(this.avgFrame<1/52){
   this.goodSeconds+=sample;this.badSeconds=0;
   if(this.goodSeconds>=6){
    this.distance=Math.min(MAX_HORIZON,this.distance+32);
    this.goodSeconds=0;
   }
  }else {
   this.goodSeconds=0;this.badSeconds=0;
  }
  return this.distance;
 }
}
