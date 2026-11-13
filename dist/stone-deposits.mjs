// Reservas minerales deterministas por casilla: no hay regeneración automática.
// El relieve no cambia de tipo; solo varía el estado del depósito que contiene.
export const QUARRY_RADIUS=9;
export const STONE_PER_WORKER=2;
export const MAX_STONE_PER_TILE=40;

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
