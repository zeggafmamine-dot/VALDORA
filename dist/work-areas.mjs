import {QUARRY_RADIUS} from './stone-deposits.mjs';

// Un mismo indicador de selección para todos los edificios productivos.
// El radio es real para la cantera; en los otros edificios el texto aclara
// cuándo la zona es orientativa y las existencias proceden del almacén.
export const WORK_AREAS=Object.freeze({
 gatherer:{radius:7,name:'Zona de recolección',kind:'forest'},
 forester:{radius:8,name:'Zona forestal',kind:'forest'},
 quarry:{radius:QUARRY_RADIUS,name:'Yacimiento de piedra',kind:'stone'},
 woodcutter:{radius:6,name:'Entorno del leñador',kind:'storedWood'},
 fisher:{radius:6,name:'Proximidad al río',kind:'water'},
 farm:{radius:2.5,name:'Parcela de cultivo',kind:'field'},
 pasture:{radius:3,name:'Entorno del pastizal',kind:'pasture'}
});
export function workArea(type){return WORK_AREAS[type]||null;}
export function areaMetric(world,building){
 const area=workArea(building?.type);
 if(!area)return null;
 const b=building;
 let label='',value='',amount=null,note='';
 switch(area.kind){
  case 'stone':
   amount=world.stoneAround(b);
   label='PIEDRA DISPONIBLE EN EL ÁREA';
   value=amount.toLocaleString('es')+' unidades';
   note='La cantera extrae únicamente las rocas de este círculo. La piedra agotada no reaparece.';
   break;
  case 'forest':
   amount=Math.round(world.forestAt(b,area.radius)*100);
   label=area.kind==='forest'?'BOSQUE CERCANO':'ÁRBOLES DISPONIBLES';
   value=amount+' %';
   note=b.type==='forester'
    ?'La producción depende de los árboles próximos. Este puesto también replanta el bosque.'
    :'La recolección de alimentos depende de la cantidad de árboles próximos.';
   break;
  case 'storedWood':
   amount=Math.floor(world.resources.wood);
   label='MADERA EN ALMACÉN';
   value=amount.toLocaleString('es')+' unidades';
   note='El leñador transforma madera del almacén en leña; no tala los árboles del círculo. Su área mostrada es orientativa.';
   break;
  case 'water':{
   let count=0;
   const cx=b.x+b.w/2,cy=b.y+b.h/2;
   const r=Math.ceil(area.radius);
   for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)
    for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++)
     if((x+.5-cx)**2+(y+.5-cy)**2<=r*r&&world.tile(x,y)?.type==='water')count++;
   amount=count;label='AGUA CERCANA';value=count.toLocaleString('es')+' casillas';
   note='La proximidad al agua es necesaria para construir la cabaña. La captura de pescado no agota el río.';
   break;
  }
  case 'field':
   label='RENDIMIENTO DEL CAMPO';value=[2,3,4,0][world.season]+' alimentos / trabajador y día';
   note='La cosecha depende de la estación y se realiza en la parcela; el círculo indica su entorno visual.';
   break;
  case 'pasture':
   label='RENDIMIENTO DEL PASTIZAL';value='2,4 alimentos / trabajador y día';
   note='El pastizal produce en su propia parcela; el círculo es una referencia visual.';
   break;
 }
 const status=b.progress<1?'En construcción':
   b.paused?'Pausado':b.workers===0?'Sin trabajadores':
   (area.kind==='stone'&&amount===0)?'Yacimiento agotado':
   (area.kind==='storedWood'&&amount===0)?'Sin madera':
   (area.kind==='forest'&&amount===0)?'Sin árboles':'En funcionamiento';
 return {radius:area.radius,name:area.name,kind:area.kind,label,value,amount,note,status};
}
