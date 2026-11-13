// Curva de aparición suave de los sectores del mundo. Sin saltos en los extremos.
export const REVEAL_SECONDS=1.15;
export function revealProgress(elapsed,duration=REVEAL_SECONDS){
 if(!Number.isFinite(elapsed)||!Number.isFinite(duration)||duration<=0)return 1;
 const t=Math.max(0,Math.min(1,elapsed/duration));
 return t*t*(3-2*t);
}
