import {hash} from './sim.mjs';

// The compatibility renderer gets the same surface atlas and richer cached foliage.
export function enhanceCompatibility(renderer){
 const atlas=new Image();atlas.src=new URL('./assets/village-materials-v3.png',import.meta.url).href;renderer.atlas=atlas;
 const texture=(points,type,opacity=1,tx=0,ty=0,span=1)=>{
  if(!atlas.complete||!atlas.naturalWidth)return;
  const c=renderer.ctx,q={wood:[0,0],roof:[1,0],stone:[0,1],grass:[1,1]}[type],s=atlas.naturalWidth/2,sy=atlas.naturalHeight/2;
  c.save();c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();c.globalAlpha*=opacity;
  const a=points[0],b=points[1],d=points[3];c.transform((b.x-a.x)/s,(b.y-a.y)/s,(d.x-a.x)/sy,(d.y-a.y)/sy,a.x,a.y);
  c.drawImage(atlas,q[0]*s+tx*s,q[1]*sy+ty*sy,s*span,sy*span,0,0,s,sy);c.restore();
 };
 renderer.surfaceTexture=texture;
 const trees=new Map();
 renderer.drawTree=function(t,pal){
  const pine=t.variant>.53,v=Math.floor(t.variant*11)%5,key=`${this.world.season}-${pine}-${v}`;let sprite=trees.get(key);
  if(!sprite){sprite=document.createElement('canvas');sprite.width=200;sprite.height=260;const c=sprite.getContext('2d');c.translate(100,240);const winter=this.world.season===3,autumn=this.world.season===2;
   c.strokeStyle='#5b4e37';c.lineWidth=pine?6:9;c.beginPath();c.moveTo(0,0);c.lineTo(-2,-205);c.stroke();c.strokeStyle='#9c8a62';c.lineWidth=1.5;c.beginPath();c.moveTo(-2,0);c.lineTo(-4,-205);c.stroke();
   if(pine){for(let level=0;level<12;level++){const y=-28-level*16,reach=(1-level/13)*70;for(let branch=0;branch<9;branch++){const a=branch/9*Math.PI*2+level*.7+v*.37,xx=Math.cos(a)*reach,yy=y+Math.sin(a)*reach*.25+9;const bright=Math.cos(a)<0;
     c.strokeStyle='#524e32';c.lineWidth=2.1-level*.11;c.beginPath();c.moveTo(0,y-3);c.lineTo(xx,yy);c.stroke();
     for(let needle=0;needle<20;needle++){const u=needle/20,n=hash(needle,level+branch*11,v),px=xx*u+(n-.5)*12,py=y+(yy-y)*u-2+(hash(level,needle+branch)-.5)*10;
      c.strokeStyle=winter&&n>.53?'#c4cdbb':bright?['#536343','#70805a','#849166'][Math.floor(n*3)]:['#293f2d','#3b5338','#506446'][Math.floor(n*3)];c.lineWidth=2.4;c.beginPath();c.moveTo(px-7*(1-u*.4),py-5);c.lineTo(px,py+2);c.lineTo(px+7*(1-u*.4),py-3);c.stroke();
     }
    }}
   }else{
    for(let i=0;i<24;i++){const a=i*2.399,r=36+hash(i,v)*40,x=Math.cos(a)*r,y=-130+Math.sin(a)*r*.8;c.strokeStyle='#62523a';c.lineWidth=3;c.beginPath();c.moveTo(0,-35);c.lineTo(x,y);c.stroke();}
    for(let i=0;i<420;i++){const a=hash(i,3,v)*Math.PI*2,r=Math.sqrt(hash(i,5,v))*79,x=Math.cos(a)*r,y=-130+Math.sin(a)*r*.83,n=hash(i,7,v),shade=Math.floor(n*3);c.fillStyle=winter?['#8d9c87','#b1bea5','#d6deca'][shade]:autumn?['#775b32','#a58140','#c29e55'][shade]:x<0?['#5a6d3b','#7d8b4f','#909a60'][shade]:['#344f32','#4b6339','#687d46'][shade];c.beginPath();c.ellipse(x,y,3+n*6,2+n*4,a,0,Math.PI*2);c.fill();}
   }
   trees.set(key,sprite);
  }
  const p=this.iso(t.x+.45,t.y+.5),scale=.31+t.variant*.08,c=this.ctx;this.ellipse(p.x+13,p.y+5,28,9,'#16281b25');this.ellipse(p.x+5,p.y+2,16,5,'#19261928');c.drawImage(sprite,p.x-100*scale,p.y-240*scale,200*scale,260*scale);
  if(t.marked){c.strokeStyle='#e9c483';c.lineWidth=1.6;c.beginPath();c.moveTo(p.x-3,p.y-15);c.lineTo(p.x+3,p.y-9);c.moveTo(p.x+3,p.y-15);c.lineTo(p.x-3,p.y-9);c.stroke();}
 };
 renderer.drawTile=function(t,pal){
  const {x,y,variant:r}=t,c=this.ctx;
  if(t.type==='water'){
   const edge=[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>this.world.tile(x+dx,y+dy)?.type==='grass');this.diamond(x,y,1.02,1.02,0,edge?'#697f70':'#4f716d');
   for(let i=0;i<3;i++){const p=this.iso(x+hash(i,x),y+hash(i,y)),offset=Math.sin(this.time*.7+x+y+i)*3;this.line([{x:p.x-8+offset,y:p.y},{x:p.x+6+offset,y:p.y}],edge?'#c6cfad3f':'#afc7b539',.65);}
   if(edge){const p=this.iso(x+.5,y+.5);this.ellipse(p.x,p.y,13,4,'#a9b39213');}
   if(t.bridge)this.drawBridge(t);return;
  }
  const n=hash(Math.floor(x/3),Math.floor(y/3),this.world.seedNumber);this.diamond(x,y,1.02,1.02,0,this.world.season===3?'#c8cebb':n>.5?'#78835d':'#79815a');
  const points=[this.iso(x,y),this.iso(x+1.02,y),this.iso(x+1.02,y+1.02),this.iso(x,y+1.02)];texture(points,'grass',this.world.season===3?.22:.48,(x%6)/6,(y%6)/6,1/6);
  if(!t.building&&!t.road&&!t.bridge&&r>.5){const p=this.iso(x+.4,y+.6);for(let i=0;i<4;i++){const xx=p.x+hash(i,x)*16-8,yy=p.y+hash(i,y)*6-3;this.line([{x:xx,y:yy},{x:xx-1,y:yy-3-r*2}],this.world.season===3?'#c7cebb':'#586b3e',.6);}}
  if(t.tree){const p=this.iso(x+.5,y+.5);this.ellipse(p.x+3,p.y+2,20,8,'#24382320');}
  if(t.road){const p=this.iso(x+.5,y+.5);this.ellipse(p.x,p.y,16,8,'#a69b7d');this.ellipse(p.x,p.y,12,6,'#c2b59c');const linked=(dx,dy)=>{const q=this.world.tile(x+dx,y+dy);return q?.road||q?.bridge;};for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(linked(dx,dy)){const px=-dy*.31,py=dx*.31,ex=x+.5+dx*.54,ey=y+.5+dy*.54,pts=[this.iso(x+.5+px,y+.5+py,1),this.iso(x+.5-px,y+.5-py,1),this.iso(ex-px,ey-py,1),this.iso(ex+px,ey+py,1)];this.poly(pts,'#c2b59c');texture(pts,'stone',.52,0,0,.4);}const pts=[this.iso(x+.3,y+.3,1),this.iso(x+.7,y+.3,1),this.iso(x+.7,y+.7,1),this.iso(x+.3,y+.7,1)];texture(pts,'stone',.55,.2,.2,.4);}
  if(t.bridge)this.drawBridge(t);
 };
 renderer.hut=function(x,y,w,h,H=23,roof='#686e5c',wall='#b7aa85',details=true){
  const a=this.iso(x,y),b=this.iso(x+w,y),cc=this.iso(x+w,y+h),d=this.iso(x,y+h),rise=H*.83,c=this.ctx;
  this.poly([d,cc,{x:cc.x+30,y:cc.y+9},{x:d.x+20,y:d.y+8}],'#15251930');this.ellipse(cc.x+5,cc.y,30,10,'#1c261c35');
  const side=[{x:b.x,y:b.y-H},{x:cc.x,y:cc.y-H},cc,b],front=[{x:d.x,y:d.y-H},{x:cc.x,y:cc.y-H},cc,d];this.poly(side,'#8d8066');texture(side,'wood',.62);this.poly(side,'#28352539');this.poly(front,'#c5b99c');texture(front,'wood',.32);
  const ra=this.iso(x+w/2,y,H+rise),rb=this.iso(x+w/2,y+h,H+rise),left=[{x:a.x-3,y:a.y-H},ra,rb,{x:d.x-4,y:d.y-H+2}],right=[ra,{x:b.x+4,y:b.y-H+2},{x:cc.x+4,y:cc.y-H+2},rb];
  this.poly([{x:d.x,y:d.y-H},rb,{x:cc.x,y:cc.y-H}],'#b5a687');this.line([{x:d.x,y:d.y-H},rb,{x:cc.x,y:cc.y-H}],'#5a4a33',2);
  for(const v of [0,.34,.67,1]){this.line([this.iso(x+w*v,y+h,1),this.iso(x+w*v,y+h,H)],'#61513a',1.5);this.line([this.iso(x+w,y+h*v,1),this.iso(x+w,y+h*v,H)],'#5c4b34',1.5);}
  for(const z of [2,H]){this.line([this.iso(x,y+h,z),this.iso(x+w,y+h,z)],'#5b4b35',2);this.line([this.iso(x+w,y,z),this.iso(x+w,y+h,z)],'#4c432f',2);}
  this.poly(left,'#5b5140');texture(left,'roof',.97);this.poly(left,'#1d2e2420');this.poly(right,'#77674b');texture(right,'roof',.9);this.poly(right,'#eedcaf0b');
  if(this.world.season===3){this.poly(left,'#e1e5d7c9');this.poly(right,'#ccd6c6b0');}
  this.line([ra,rb],'#ad9c7d',1.8);this.line([left[3],rb,right[2]],'#4e4936',1.4);
  for(let row=1;row<7;row++){const u=row/7;this.line([{x:ra.x+(right[1].x-ra.x)*u,y:ra.y+(right[1].y-ra.y)*u},{x:rb.x+(right[2].x-rb.x)*u,y:rb.y+(right[2].y-rb.y)*u}],'#2b2c244f',.6);}
  if(details){
   this.faceDoor(x+w*.48,y+h,H);this.faceWindow(x+w*.2,y+h,H*.63);this.faceWindow(x+w*.82,y+h,H*.63);
   for(const wx of [.2,.82]){const p=this.iso(x+w*wx,y+h,H*.63);this.line([{x:p.x-5,y:p.y-2},{x:p.x-5,y:p.y+4}],'#65543b',2);this.line([{x:p.x+5,y:p.y+2},{x:p.x+5,y:p.y+8}],'#65543b',2);this.line([{x:p.x-4,y:p.y+5},{x:p.x+4,y:p.y+9}],'#d3bc8e',1.3);}
   const p=this.iso(x+w,y+h*.35,H*.5);this.poly([{x:p.x-5,y:p.y-3},{x:p.x+1,y:p.y-6},{x:p.x+1,y:p.y+1},{x:p.x-5,y:p.y+4}],'#3f4a36');this.line([{x:p.x-2,y:p.y-4},{x:p.x-2,y:p.y+2}],'#cbb78b',.8);
   const door=this.iso(x+w*.48,y+h);this.poly([{x:door.x-7,y:door.y-1},{x:door.x+7,y:door.y+6},{x:door.x+3,y:door.y+9},{x:door.x-11,y:door.y+2}],'#a8a38c');
   this.box(x+w*.75,y+.3,.2,.2,H+rise*.65,['#9c9a82','#676e5c','#b6b39a']);const smoke=this.iso(x+w*.85,y+.4,H+rise*.65);this.smoke(smoke.x,smoke.y);
   for(let i=0;i<3;i++){const p=this.iso(x+.12,y+h+.08+i*.07,2);this.line([{x:p.x-5,y:p.y-2},{x:p.x+4,y:p.y+2}],'#7e6848',2.2);this.ellipse(p.x+4,p.y+2,1.2,1.2,'#c1a371');}
  }
 };
 renderer.drawBridge=function(t){const x=t.x,y=t.y,axis=t.bridgeAxis||'x',px=axis==='x'?0:.1,py=axis==='x'?.1:0,z=8;const pts=[this.iso(x+px,y+py,z),this.iso(x+1-px,y+py,z),this.iso(x+1-px,y+1-py,z),this.iso(x+px,y+1-py,z)];this.poly(pts,'#a8936e');texture(pts,'wood',.95);for(let i=0;i<8;i++){const u=i/8;this.line(axis==='x'?[this.iso(x+u,y+.1,z),this.iso(x+u,y+.9,z)]:[this.iso(x+.1,y+u,z),this.iso(x+.9,y+u,z)],'#4c4831b0',.7);}for(const side of [.08,.92]){const p=axis==='x'?this.iso(x,y+side):this.iso(x+side,y),end=axis==='x'?this.iso(x+1,y+side):this.iso(x+side,y+1);this.line([{x:p.x,y:p.y+7},{x:p.x,y:p.y-19}],'#5c5139',2);this.line([{x:p.x,y:p.y-18},{x:end.x,y:end.y-18}],'#b19d78',1.7);this.line([{x:p.x,y:p.y-10},{x:end.x,y:end.y-10}],'#7a6c4d',1);}};
}
