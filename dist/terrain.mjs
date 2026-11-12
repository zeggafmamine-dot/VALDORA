// Coordenadas globales: cada región visible abarca 64 × 64 unidades.
// La función es pura, continua en los bordes de regiones y determinista por semilla.
export const REGION_SIZE=64;
export const COORD_LIMIT=1000000;
export function validCoordinates(coords){return !!coords&&Number.isInteger(coords.x)&&Number.isInteger(coords.y)&&Math.abs(coords.x)<=COORD_LIMIT&&Math.abs(coords.y)<=COORD_LIMIT;}
function hash(x,y,seed){let n=Math.imul(x+Math.imul(y,374761393)+seed,668265263);n^=n>>>13;return ((Math.imul(n,1274126177)^(n>>>16))>>>0)/4294967295;}
function noise(x,y,seed){const ax=Math.floor(x),ay=Math.floor(y),dx=x-ax,dy=y-ay,u=dx*dx*(3-2*dx),v=dy*dy*(3-2*dy);return (hash(ax,ay,seed)*(1-u)+hash(ax+1,ay,seed)*u)*(1-v)+(hash(ax,ay+1,seed)*(1-u)+hash(ax+1,ay+1,seed)*u)*v;}
const clamp01=x=>Math.max(0,Math.min(1,x));
const fade=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};

// x/y pueden ser fraccionarios para el relieve 3D y valores enteros para las casillas.
export function terrainSample(x,y,seed,coordinates){
 const gx=coordinates.x*REGION_SIZE+x,gy=coordinates.y*REGION_SIZE+y;
 const warpX=(noise(gx/90,gy/90,seed+91)-.5)*36;
 const warpY=(noise(gx/90,gy/90,seed+113)-.5)*36;
 const nx=gx+warpX,ny=gy+warpY;
 const continental=noise(nx/98,ny/98,seed+17);
 const foothills=noise(nx/29,ny/29,seed+29);
 const detail=noise(nx/9,ny/9,seed+43);
 const moisture=noise(nx/77,ny/77,seed+71);
 // Ríos que serpentean en vez de aparecer siempre en la misma columna.
 const stream=Math.abs(noise(nx/54,ny/54,seed+157)-.5);
 const bed=(1-fade(.016,.07,stream))*1.35;
 let height=.78+(continental-.5)*6.4+(foothills-.5)*2.6+(detail-.5)*.38-bed;
 // El centro mantiene espacio para el ayuntamiento, las viviendas y las vías iniciales.
 const clearing=fade(9,20,Math.hypot(x-31.5,y-32.5));
 height=.62+(height-.62)*clearing;
 const water=clearing>.65&&height<.035;
 height=water?Math.min(-.08,height):Math.max(.10,height);
 const hill=clearing>.92&&height>2.3;
 return {height,water,hill,moisture};
}
