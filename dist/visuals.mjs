import * as T from './vendor/three.module.js';
import {hash} from './sim.mjs';
import {cube,beam,mergeByMaterial} from './models3d.mjs';

export function installDetailedMaterials(m,ready=()=>{}){
 m.wood.color.set('#ddd2be');m.stone.color.set('#e5e3d7');m.roof.color.set('#d5cabb');m.rock.color.set('#c4c6bc');
 const atlasState={texture:{value:m.wood.map},loaded:{value:0}},wind={value:0};
 m.road=m.stone.clone();m.road.color.set('#b9b2a0');m.road.roughness=1;
 const tiles=[[m.wood,0,.5],[m.darkWood,0,.5],[m.roof,.5,.5],[m.stone,0,0],[m.rock,0,0],[m.road,0,0]];
 for(const [material,x,y]of tiles){material.onBeforeCompile=shader=>{shader.uniforms.uSurfaceAtlas=atlasState.texture;shader.uniforms.uAtlasLoaded=atlasState.loaded;shader.uniforms.uSurfaceOffset={value:new T.Vector2(x,y)};shader.fragmentShader='uniform sampler2D uSurfaceAtlas; uniform float uAtlasLoaded; uniform vec2 uSurfaceOffset;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    vec4 detailTexel=texture2D(map,vMapUv);
    vec2 detailUv=uSurfaceOffset+vec2(.003)+fract(vMapUv)*.494;
    detailTexel=mix(detailTexel,texture2D(uSurfaceAtlas,detailUv),uAtlasLoaded);
    diffuseColor*=detailTexel;
   #endif`);
   let bump=T.ShaderChunk.bumpmap_pars_fragment;for(const uv of ['vBumpMapUv + dSTdx','vBumpMapUv + dSTdy','vBumpMapUv'])bump=bump.replace(`texture2D( bumpMap, ${uv} ).x`,`mix(texture2D(bumpMap, ${uv}).x,texture2D(uSurfaceAtlas,uSurfaceOffset+vec2(.003)+fract(${uv})*.494).x,uAtlasLoaded)`);shader.fragmentShader=shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',bump);};material.customProgramCacheKey=()=>`valdora-surface-v3-${x}-${y}`;material.needsUpdate=true;}
 m.ground.onBeforeCompile=shader=>{shader.uniforms.uSurfaceAtlas=atlasState.texture;shader.uniforms.uAtlasLoaded=atlasState.loaded;shader.vertexShader='varying vec3 vTerrainWorld; varying vec3 vTerrainNormal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainWorld=(modelMatrix*vec4(position,1.0)).xyz; vTerrainNormal=normalize(mat3(modelMatrix)*normal);');shader.fragmentShader='uniform sampler2D uSurfaceAtlas; uniform float uAtlasLoaded; varying vec3 vTerrainWorld; varying vec3 vTerrainNormal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
   vec2 groundUv=vTerrainWorld.xz*.38;
   vec3 meadow=texture2D(uSurfaceAtlas,vec2(.503,.003)+fract(groundUv)*.494).rgb*3.6;
   vec3 meadow2=texture2D(uSurfaceAtlas,vec2(.503,.003)+fract(groundUv*.43+vec2(.31,.73))*.494).rgb*3.6;
   vec3 stone=texture2D(uSurfaceAtlas,vec2(.003)+fract(vTerrainWorld.xz*.55+vTerrainWorld.yy*.2)*.494).rgb*1.9;
   float steep=smoothstep(.09,.36,1.-abs(normalize(vTerrainNormal).y))*smoothstep(1.,3.,vTerrainWorld.y);
   vec3 detailedGround=mix(mix(meadow,meadow2,.3),stone,steep);
   vec3 originalGround=texture2D(map,vMapUv).rgb;
   diffuseColor.rgb*=mix(originalGround,detailedGround,uAtlasLoaded);
  #endif`);};m.ground.customProgramCacheKey=()=> 'valdora-terrain-v3';m.ground.needsUpdate=true;
 for(const material of [m.needles,m.leaves,m.grass,m.bush]){material.onBeforeCompile=shader=>{shader.uniforms.uWindTime=wind;shader.vertexShader='uniform float uWindTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 windOrigin=vec3(0.);
   #ifdef USE_INSTANCING
    windOrigin=instanceMatrix[3].xyz;
   #endif
   float windWeight=smoothstep(0.,3.5,position.y);
   transformed.x+=sin(uWindTime*1.05+windOrigin.x*.65+windOrigin.z*.33+position.y*.9)*.065*windWeight;
   transformed.z+=cos(uWindTime*.75+windOrigin.z*.71+position.y)*.035*windWeight;
  `);};material.customProgramCacheKey=()=> 'valdora-wind-v3';material.needsUpdate=true;}
 const loader=new T.TextureLoader();loader.load(new URL('./assets/village-materials-v3.png',import.meta.url).href,texture=>{texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=12;texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;atlasState.texture.value=texture;atlasState.loaded.value=1;ready();},undefined,()=>{console.warn('Se utilizan las texturas procedurales de respaldo.');});
 return {wind,atlasState};
}

function patchSurface(group,mat,points,height,uvScale=1){const p=[],uv=[];for(const [x,z]of points){p.push(x,height(x,z),z);uv.push(x*uvScale,z*uvScale);}const indices=[];for(let i=1;i<points.length-1;i++)indices.push(0,i+1,i);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new T.Mesh(geo,mat);mesh.receiveShadow=true;group.add(mesh);return mesh;}
export function makeTransport(world,m,heightAt){const group=new T.Group(),bridgeHeights=new Map();
 const linked=(x,z)=>{const t=world.tile(x,z);return !!(t?.road||t?.bridge);};
 for(const t of world.tiles){if(!t.road)continue;const x=t.x+.5,z=t.y+.5,r=.345,halo=.48,circle=[],earth=[];for(let i=0;i<16;i++){const a=i/16*Math.PI*2;circle.push([x+Math.cos(a)*r,z+Math.sin(a)*r]);earth.push([x+Math.cos(a)*halo,z+Math.sin(a)*halo]);}patchSurface(group,m.dirt,earth,(a,b)=>heightAt(a,b)+.013,1);patchSurface(group,m.road,circle,(a,b)=>heightAt(a,b)+.025,1.4);
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){if(!linked(t.x+dx,t.y+dz))continue;const px=-dz*r,pz=dx*r,ex=x+dx*.52,ez=z+dz*.52;patchSurface(group,m.road,[[x+px,z+pz],[x-px,z-pz],[ex-px,ez-pz],[ex+px,ez+pz]],(a,b)=>heightAt(a,b)+.026,1.4);}
 }
 const visited=new Set();for(const t of world.tiles){if(!t.bridge||visited.has(t.y*64+t.x))continue;const axis=t.bridgeAxis||(world.tile(t.x+1,t.y)?.bridge||world.tile(t.x-1,t.y)?.bridge?'x':'y'),dx=axis==='x'?1:0,dz=axis==='y'?1:0;let start=t,end=t;while(world.tile(start.x-dx,start.y-dz)?.bridge)start=world.tile(start.x-dx,start.y-dz);while(world.tile(end.x+dx,end.y+dz)?.bridge)end=world.tile(end.x+dx,end.y+dz);
  const len=Math.abs(end.x-start.x)+Math.abs(end.y-start.y)+1,base=Math.max(.36,heightAt(start.x+.5,start.y+.5),heightAt(end.x+.5,end.y+.5))+.10;
  for(let i=0;i<len;i++){const tx=start.x+dx*i,tz=start.y+dz*i,key=tz*64+tx;visited.add(key);const arch=Math.sin((i+.5)/len*Math.PI)*Math.min(.18,len*.018),h=base+arch;bridgeHeights.set(key,h+.025);const g=new T.Group();
   for(let plank=0;plank<8;plank++)cube(g,m.wood,-.4375+plank*.125,h,0,.115,.065,.9);
   for(const side of [-1,1]){cube(g,m.darkWood,0,h-.1,side*.33,1.02,.12,.08);cube(g,m.wood,0,h+.4,side*.45,1.02,.045,.045);cube(g,m.darkWood,0,h+.2,side*.45,1.02,.025,.025);if(i%2===0||i===len-1){cube(g,m.darkWood,-.43,h/2-.15,side*.39,.09,h+.3,.09);cube(g,m.wood,-.43,h+.24,side*.45,.065,.52,.065);beam(g,m.darkWood,[-.43,h+.05,side*.45],[.46,h+.38,side*.45],.018);}}
   if(i===0||i===len-1){cube(g,m.stone,i===0?-.4:.4,h-.12,0,.2,.2,1.02);for(const side of [-1,1])cube(g,m.stone,i===0?-.4:.4,h+.13,side*.46,.14,.5,.14);}
   if(axis==='y')g.rotation.y=-Math.PI/2;g.position.set(tx+.5,0,tz+.5);group.add(g);
  }
 }
 const result=mergeByMaterial(group);result.userData.bridgeHeights=bridgeHeights;return result;
}

export function routePreview(plan,heightAt,bridgeHeights){const g=new T.Group(),mat=new T.MeshBasicMaterial({color:plan.ok?'#d1e69e':'#f0a087',transparent:true,opacity:.48,depthWrite:false,side:T.DoubleSide});const path=[];for(const t of plan.cells){const x=t.x+.5,z=t.y+.5,h=plan.type==='bridge'?Math.max(.65,heightAt(x,z)+.06):heightAt(x,z)+.055;path.push(new T.Vector3(x,h+.035,z));const mesh=new T.Mesh(new T.PlaneGeometry(.8,.8),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,h,z);g.add(mesh);}
 if(path.length>1){const line=new T.Line(new T.BufferGeometry().setFromPoints(path),new T.LineBasicMaterial({color:plan.ok?'#f5efb8':'#ffb799',depthTest:false}));line.renderOrder=15;g.add(line);}
 for(const p of [path[0],path.at(-1)].filter(Boolean)){const post=new T.Mesh(new T.CylinderGeometry(.035,.035,.6,8),mat);post.position.copy(p);post.position.y+=.3;g.add(post);const flag=new T.Mesh(new T.SphereGeometry(.1,10,6),new T.MeshBasicMaterial({color:plan.ok?'#f0e2a6':'#eb9a78'}));flag.position.copy(p);flag.position.y+=.62;g.add(flag);}return g;}

export function createPostprocessing(gl,width,height){const target=new T.WebGLRenderTarget(width,height,{type:gl.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType,depthBuffer:true,samples:2});target.depthTexture=new T.DepthTexture(width,height,T.UnsignedIntType);target.texture.colorSpace=T.LinearSRGBColorSpace;
 const uniforms={tColor:{value:target.texture},tDepth:{value:target.depthTexture},uResolution:{value:new T.Vector2(width,height)},uProjectionInverse:{value:new T.Matrix4()},uAO:{value:1},uExposure:{value:1.06}};
 const mat=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float; varying vec2 vUv;uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 uResolution;uniform mat4 uProjectionInverse;uniform float uAO;uniform float uExposure;
  vec3 viewPos(vec2 uv,float d){vec4 p=uProjectionInverse*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
  vec3 film(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
  void main(){vec2 px=1./uResolution;float depth=texture2D(tDepth,vUv).r;vec3 base=texture2D(tColor,vUv).rgb;vec3 n0=texture2D(tColor,vUv+vec2(px.x,0.)).rgb;vec3 n1=texture2D(tColor,vUv-vec2(px.x,0.)).rgb;vec3 n2=texture2D(tColor,vUv+vec2(0.,px.y)).rgb;vec3 n3=texture2D(tColor,vUv-vec2(0.,px.y)).rgb;
   vec3 color=max(vec3(0.),base+(base-(n0+n1+n2+n3)*.25)*.12);
   if(depth<.9999&&uAO>.01){vec3 p=viewPos(vUv,depth);vec3 crossNormal=cross(dFdx(p),dFdy(p));vec3 normal=crossNormal/max(length(crossNormal),.00001);float occlusion=0.;float radius=clamp(480./max(5.,-p.z),5.,24.);for(int i=0;i<10;i++){float a=float(i)*2.399963;vec2 offset=vec2(cos(a),sin(a))*radius*sqrt((float(i)+.5)/10.)*px;vec2 uv=clamp(vUv+offset,vec2(.001),vec2(.999));float d=texture2D(tDepth,uv).r;vec3 q=viewPos(uv,d);vec3 delta=q-p;float len=length(delta);float occ=max(0.,dot(normal,delta/max(len,.0001))-.12);occlusion+=occ*(1.-smoothstep(.05,1.25,len))*step(d,.9999);}color*=1.-min(.38,occlusion*.13*uAO);}
   vec3 bloom=(max(vec3(0.),n0-vec3(1.7))+max(vec3(0.),n1-vec3(1.7))+max(vec3(0.),n2-vec3(1.7))+max(vec3(0.),n3-vec3(1.7)))*.015;color+=bloom;
   color=film(color*uExposure);float vignette=1.-.14*pow(length((vUv-.5)*vec2(1.,.85))*1.3,2.);color*=vignette;gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(1./2.2)),1.);
  }`});const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);scene.add(new T.Mesh(new T.PlaneGeometry(2,2),mat));
 return {target,uniforms,scene,camera,resize(w,h){target.setSize(w,h);uniforms.uResolution.value.set(w,h);},render(main,camera){uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);gl.setRenderTarget(target);gl.render(main,camera);gl.setRenderTarget(null);gl.render(scene,this.camera);}};
}

export function makeSky(){
 const mat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uTime:{value:0},uCold:{value:0},uHorizon:{value:new T.Color('#aab5ac')}},vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 varying vec3 vDirection;uniform float uTime;uniform float uCold;uniform vec3 uHorizon;
 float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float skyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(skyHash(i),skyHash(i+vec2(1.,0.)),f.x),mix(skyHash(i+vec2(0.,1.)),skyHash(i+vec2(1.)),f.x),f.y);}
 void main(){vec3 dir=normalize(vDirection);float up=max(0.,dir.y);vec3 blue=mix(vec3(.24,.38,.48),vec3(.35,.42,.46),uCold);vec3 color=mix(uHorizon,blue,smoothstep(0.,.65,up));vec2 p=dir.xz/(up+.24)*2.4+vec2(uTime*.002,0.);float clouds=skyNoise(p)*.52+skyNoise(p*2.03)*.27+skyNoise(p*4.07)*.14+skyNoise(p*8.13)*.07;float cloud=smoothstep(.48,.70,clouds)*smoothstep(.025,.20,up);color=mix(color,vec3(.82,.83,.77),cloud*.62);float sun=max(dot(dir,normalize(vec3(-22.,34.,14.))),0.);color+=vec3(1.,.76,.43)*pow(sun,48.)*.22;gl_FragColor=vec4(color,1.);}`});
 const sky=new T.Mesh(new T.SphereGeometry(145,32,20),mat);sky.position.set(32,0,32);sky.renderOrder=-100;sky.frustumCulled=false;return sky;
}

export function makeRiver(gl,scene,heightAt){
 const reflection=new T.WebGLRenderTarget(768,768,{type:gl.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType,depthBuffer:true});reflection.texture.colorSpace=T.LinearSRGBColorSpace;
 const bedSize=160,bed=new T.DataTexture(new Uint8Array(bedSize*bedSize*4),bedSize,bedSize,T.RGBAFormat);bed.minFilter=bed.magFilter=T.LinearFilter;
 const bedOrigin=new T.Vector2(-24,-24);let mesh=null;
  function refreshBed(height,center={x:32,y:32}){const ox=center.x-56,oz=center.y-56;bedOrigin.set(ox,oz);if(mesh)mesh.position.set(center.x,.035,center.y);const data=bed.image.data;for(let z=0;z<bedSize;z++)for(let x=0;x<bedSize;x++){const h=height(ox+x/(bedSize-1)*112,oz+z/(bedSize-1)*112),i=(z*bedSize+x)*4;data[i]=Math.round(Math.max(0,Math.min(1,(h+1)/2))*255);data[i+1]=data[i+2]=0;data[i+3]=255;}bed.needsUpdate=true;}refreshBed(heightAt);
 const uniforms={uTime:{value:0},uCold:{value:0},uEye:{value:new T.Vector3()},uSky:{value:new T.Color('#adbab2')},uReflection:{value:reflection.texture},uReflectionMatrix:{value:new T.Matrix4()},uBed:{value:bed},uBedOrigin:{value:bedOrigin},uReflect:{value:1}};
 const mat=new T.ShaderMaterial({uniforms,vertexShader:`varying vec3 vWorld;varying vec4 vReflect;uniform mat4 uReflectionMatrix;void main(){vec4 wp=modelMatrix*vec4(position,1.);vWorld=wp.xyz;vReflect=uReflectionMatrix*wp;gl_Position=projectionMatrix*viewMatrix*wp;}`,fragmentShader:`
 uniform float uTime;uniform float uCold;uniform vec3 uEye;uniform vec3 uSky;uniform sampler2D uReflection;uniform sampler2D uBed;uniform vec2 uBedOrigin;uniform float uReflect;varying vec3 vWorld;varying vec4 vReflect;
 float waves(vec2 p){return sin(p.x*7.7+p.y*3.3+uTime*.85)*.11+sin(p.y*12.1-p.x*4.2-uTime*1.1)*.065+sin(p.x*31.+p.y*19.+uTime*1.45)*.02;}
 void main(){vec2 p=vWorld.xz;float w=waves(p);float dx=(waves(p+vec2(.025,0.))-w)/.025;float dz=(waves(p+vec2(0.,.025))-w)/.025;vec3 normal=normalize(vec3(-dx*.04,1.,-dz*.04));vec3 eye=normalize(uEye-vWorld);vec3 sun=normalize(vec3(-22.,34.,14.));float fres=pow(1.-max(dot(eye,normal),0.),3.);float spec=pow(max(dot(reflect(-sun,normal),eye),0.),240.);float depth=max(.01,.035-(texture2D(uBed,(p-uBedOrigin)/112.).r*2.-1.));
 vec3 color=mix(vec3(.18,.24,.15),vec3(.055,.13,.115),smoothstep(0.,.9,depth));float caustic=pow(.5+.5*sin(p.x*19.+w*5.+uTime)*sin(p.y*22.-uTime*.65),5.);color+=vec3(.14,.17,.09)*caustic*(1.-smoothstep(.1,.65,depth));
 vec2 reflectUV=vReflect.xy/max(vReflect.w,.0001)+normal.xz*.016;vec3 reflection=texture2D(uReflection,clamp(reflectUV,vec2(.002),vec2(.998))).rgb;color=mix(color,mix(uSky*.6,reflection,uReflect),.22+fres*.56);
 float shore=1.-smoothstep(.025,.22,depth);float foam=smoothstep(.45,.78,sin(p.y*28.+p.x*15.+uTime)*.25+sin(p.y*12.-uTime*.4)*.25+.5)*shore;color=mix(color,vec3(.55,.57,.45),foam*.2);color+=vec3(1.,.87,.57)*spec*1.2;color=mix(color,vec3(.48,.58,.57)+w*.03,uCold*.6);float fog=1.-exp(-pow(length(uEye-vWorld)*.008,2.));color=mix(color,uSky,fog);gl_FragColor=vec4(color,1.);
 }`});
 const geo=new T.PlaneGeometry(112,112);geo.rotateX(-Math.PI/2);mesh=new T.Mesh(geo,mat);mesh.position.set(32,.035,32);scene.add(mesh);
 const camera=new T.PerspectiveCamera(),direction=new T.Vector3(),look=new T.Vector3(),clip=new T.Plane(new T.Vector3(0,1,0),-.04),bias=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
 let previous=-10;return {mesh,reflection,quality:'high',refreshBed,update(main,time){uniforms.uReflect.value=this.quality==='low'?0:1;if(this.quality==='low'||time-previous<1/(this.quality==='high'?20:10))return;previous=time;camera.copy(main);camera.position.y=.07-main.position.y;main.getWorldDirection(direction);look.copy(main.position).add(direction);look.y=.07-look.y;camera.up.set(0,-1,0);camera.lookAt(look);camera.updateMatrixWorld();uniforms.uReflectionMatrix.value.copy(bias).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
  const oldClip=gl.clippingPlanes,oldShadow=gl.shadowMap.needsUpdate;mesh.visible=false;gl.clippingPlanes=[clip];gl.shadowMap.needsUpdate=false;gl.setRenderTarget(reflection);gl.render(scene,camera);gl.setRenderTarget(null);gl.clippingPlanes=oldClip;gl.shadowMap.needsUpdate=oldShadow;mesh.visible=true;
 }};
}
