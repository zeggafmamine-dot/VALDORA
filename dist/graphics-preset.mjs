// Este ajuste se aplica siempre al crear una nueva sesión del juego.
// La calidad elegida manualmente afecta solo a la sesión actual.
export const STARTUP_QUALITY='low';
export const QUALITY_NAMES={low:'Ligera',medium:'Equilibrada',high:'Alta'};
export function activateStartupQuality(renderer,root){
 if(!renderer)throw new Error('Renderizador no disponible');
 if(typeof renderer.setQuality==='function')renderer.setQuality(STARTUP_QUALITY);
 else renderer.quality=STARTUP_QUALITY;
 if(root?.dataset)root.dataset.graphicsQuality=STARTUP_QUALITY;
 return STARTUP_QUALITY;
}
export function qualityLabel(quality,has3D=true){
 return has3D?'Gráficos: '+(QUALITY_NAMES[quality]||QUALITY_NAMES.low):'Vista 2D ligera';
}
