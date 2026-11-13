// Terreno global y determinista: las regiones de 64×64 encajan sin costuras.
// La cubierta vegetal, la geología y el relieve varían de manera continua;
// no se elige un bosque o una montaña independientemente en cada casilla.
export const REGION_SIZE=64;
export const COORD_LIMIT=1000000;
// A esta altura empieza la alta montaña protegida, no explotable.
export const ALPINE_START_HEIGHT=14;
export const isEconomicTerrain=tile=>!!tile&&tile.biome!=='alpine';
export function validCoordinates(coords){return !!coords&&Number.isInteger(coords.x)&&Number.isInteger(coords.y)&&Math.abs(coords.x)<=COORD_LIMIT&&Math.abs(coords.y)<=COORD_LIMIT;}
function hash(x,y,seed){let n=Math.imul(x+Math.imul(y,374761393)+seed,668265263);n^=n>>>13;return ((Math.imul(n,1274126177)^(n>>>16))>>>0)/4294967295;}
function noise(x,y,seed){const ax=Math.floor(x),ay=Math.floor(y),dx=x-ax,dy=y-ay,u=dx*dx*(3-2*dx),v=dy*dy*(3-2*dy);return (hash(ax,ay,seed)*(1-u)+hash(ax+1,ay,seed)*u)*(1-v)+(hash(ax,ay+1,seed)*(1-u)+hash(ax+1,ay+1,seed)*u)*v;}
const clamp01=x=>Math.max(0,Math.min(1,x));
const fade=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};

export const LANDSCAPE_BIOMES=Object.freeze(['steppe','plain','meadow','woodland','forest','hills','mountain','alpine','water']);

// Se muestrea tanto en centros de casilla como en vértices de malla 3D.
// Dos coordenadas cercanas siempre reciben un relieve cercano (sin escalones).
export function terrainSample(x,y,seed,coordinates){
 const gx=coordinates.x*REGION_SIZE+x,gy=coordinates.y*REGION_SIZE+y;
 const warpX=(noise(gx/90,gy/90,seed+91)-.5)*36;
 const warpY=(noise(gx/90,gy/90,seed+113)-.5)*36;
 const nx=gx+warpX,ny=gy+warpY;
 const continental=noise(nx/98,ny/98,seed+17);
 const foothills=noise(nx/29,ny/29,seed+29);
 const detail=noise(nx/9,ny/9,seed+43);
 const moisture=noise(nx/77,ny/77,seed+71);
 const river=Math.abs(noise(nx/54,ny/54,seed+157)-.5);
 const bed=(1-fade(.016,.07,river))*1.35;

 // Cordilleras extensas (escala ~175), surcadas por crestas secundarias
 // (~42). El contorno de montaña se desvanece suavemente hacia colinas.
 const mountains=noise(nx/175,ny/175,seed+211);
 const mountainStrength=fade(.48,.70,mountains);
 const ridges=noise(nx/42,ny/42,seed+231);
 let height=.78+(continental-.5)*6.4+(foothills-.5)*2.6+(detail-.5)*.38-bed;
 height+=mountainStrength*(5+18*fade(.24,.80,ridges));

 // La zona inicial sigue siendo llana para conservar las viviendas y vías.
 const clearing=fade(9,20,Math.hypot(x-31.5,y-32.5));
 height=.62+(height-.62)*clearing;
 const water=clearing>.65&&height<.035;
 height=water?Math.min(-.08,height):Math.max(.10,height);
 const hill=clearing>.92&&height>3.3;

 // El arbolado tiene manchas grandes y graduales: estepas casi desnudas,
 // llanuras abiertas, praderas, arboledas y bosques. No es una tirada
 // uniforme de 40-50 % en cada casilla como en el generador anterior.
 const woodland=noise(nx/132,ny/132,seed+307);
 // Las llanuras y praderas son ABIERTAS (normalmente 0-2 % árboles);
 // los bosques sólo aparecen en manchas climáticas excepcionales.
 // La tercera potencia deja amplias transiciones con arboledas dispersas.
 const treePotential=fade(.56,.80,woodland);
 const treeDensity=water||hill?0:Math.min(.38,
  (.002+.40*treePotential*treePotential*treePotential)*(.55+.60*moisture)*
  (height>1.7?.72:1));
 const rockBand=noise(nx/55,ny/55,seed+359);
 // Las laderas altas ya tienen textura mineral y no necesitan estar
 // cubiertas de miles de piedras instanciadas. Pocos afloramientos, incluso
 // en la montaña, y NINGÚN depósito aprovechable en la franja alpina.
 const rockDensity=water?0:Math.min(.073,
  .012+.044*fade(2.8,11.5,height)+.012*fade(.67,.86,rockBand))*
  (1-fade(10.8,ALPINE_START_HEIGHT,height));
 let biome;
 if(water)biome='water';
 else if(height>=ALPINE_START_HEIGHT)biome='alpine';
 else if(height>=9)biome='mountain';
 else if(height>=3.3)biome='hills';
 else if(woodland<.34&&moisture<.48)biome='steppe';
 else if(woodland<.46)biome='plain';
 else if(woodland<.59)biome='meadow';
 else if(woodland<.72)biome='woodland';
 else biome='forest';
 return {height,water,hill,moisture,woodland,treeDensity,rockDensity,biome,mountainStrength};
}
