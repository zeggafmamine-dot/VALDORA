// Reservas minerales deterministas por casilla: no hay regeneración automática.
// El relieve no cambia de tipo; solo varía el estado del depósito que contiene.
export const QUARRY_RADIUS=9;
export const STONE_PER_WORKER=2;
export const MAX_STONE_PER_TILE=40;

// La zona de una cantera es un CUADRADO alineado a las casillas.
// Radio 9 significa 9 casillas en las cuatro direcciones desde la celda central:
// con una cantera 3×3 se obtiene una zona de 19×19 casillas.
export function quarryBounds(building){
 if(!building||!Number.isFinite(building.x)||!Number.isFinite(building.y)||
    !Number.isFinite(building.w)||!Number.isFinite(building.h))throw Error('Cantera no válida');
 const centerX=building.x+building.w/2-.5,centerY=building.y+building.h/2-.5;
 return {
  minX:Math.ceil(centerX-QUARRY_RADIUS),
  maxX:Math.floor(centerX+QUARRY_RADIUS),
  minY:Math.ceil(centerY-QUARRY_RADIUS),
  maxY:Math.floor(centerY+QUARRY_RADIUS)
 };
}
export function quarryContains(building,x,y){
 const bounds=quarryBounds(building);
 return Number.isInteger(x)&&Number.isInteger(y)&&
  x>=bounds.minX&&x<=bounds.maxX&&y>=bounds.minY&&y<=bounds.maxY;
}


export function stoneCapacity(tile){
 if(!tile||tile.type==='water')return 0;
 const v=Number.isFinite(tile.variant)?Math.max(0,Math.min(1,tile.variant)):0;
 return tile.type==='hill'?22+Math.floor(v*16):12+Math.floor(v*12);
}
export function stoneRemaining(tile){
 if(!tile)return 0;
 if(Number.isInteger(tile.stoneLeft))return Math.max(0,Math.min(MAX_STONE_PER_TILE,tile.stoneLeft));
 // Compatibilidad de partidas previas, que solo guardaban rock: true/false.
 return tile.rock?stoneCapacity(tile):0;
}
export function stoneRatio(tile){
 const capacity=stoneCapacity(tile);
 return capacity?Math.max(0,Math.min(1,stoneRemaining(tile)/capacity)):0;
}
// Niveles derivados de un recurso continuo, no nuevos tipos de terreno.
// 4: intacta; 3: grande; 2: mediana; 1: pequeña; 0: agotada.
export function stoneStage(tile){
 const fraction=stoneRatio(tile);
 return fraction===0?0:fraction>.75?4:fraction>.5?3:fraction>.25?2:1;
}
export function stoneVisualScale(tile){
 const ratio=stoneRatio(tile);
 return ratio<=0?0:.16+.84*Math.sqrt(ratio);
}
