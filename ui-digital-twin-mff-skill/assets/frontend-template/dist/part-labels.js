import * as THREE from 'three';
const labelOffsets=[];
for(let dy=-12;dy<=12;dy++)for(let dx=-3;dx<=3;dx++)labelOffsets.push({dx:dx*135,dy:dy*38});
labelOffsets.sort((a,b)=>a.dx*a.dx+a.dy*a.dy-b.dx*b.dx-b.dy*b.dy);

// Labels follow exported component groups; a picked point follows its mesh animation.
export class PartLabels {
 constructor(viewport,onInspect){
  this.container=document.createElement('div');this.container.id='part-labels';
  viewport.append(this.container);this.onInspect=onInspect;this.entries=[];this.active=null;
 }
 setParts(parts){
  this.container.replaceChildren();this.active=null;
  this.lines=document.createElementNS('http://www.w3.org/2000/svg','svg');this.lines.classList.add('part-label-lines');this.container.append(this.lines);
  this.entries=parts.map(part=>{
   const label=document.createElement('button');label.className='model-label part-label';
   label.dataset.part=part.key;label.textContent=part.label;label.title=part.name;label.hidden=true;
   const line=document.createElementNS('http://www.w3.org/2000/svg','line');this.lines.append(line);
   label.onclick=()=>this.onInspect(part.key);this.container.append(label);return {...part,element:label,line};
  });
 }
 inspect(part,object,point){
  this.active=part?{...part,object,point:point?object.worldToLocal(point.clone()):null}:null;
  // Meshes outside an exported semantic group still receive their own picked label.
  for(const entry of this.entries.filter(e=>e.temporary)){entry.element.remove();entry.line.remove();}
  this.entries=this.entries.filter(e=>!e.temporary);
  if(part&&!this.entries.some(e=>e.key===part.key)){
   const element=document.createElement('button');element.className='model-label part-label';
   element.dataset.part=part.key;element.textContent=part.label;this.container.append(element);
   const line=document.createElementNS('http://www.w3.org/2000/svg','line');this.lines.append(line);
   this.entries.push({...part,object,element,line,temporary:true});
  }
 }
 render({visible,all,camera,width,height,left,right}){
  this.container.hidden=!visible;if(!visible)return;
  const positioned=[];
  for(const entry of [...this.entries].sort((a,b)=>Number(b.key===this.active?.key)-Number(a.key===this.active?.key))){
   const selected=this.active?.key===entry.key,label=entry.element;
   label.classList.toggle('selected',selected);
   entry.line.style.display='none';
   if(!all&&!selected){label.hidden=true;continue;}
   const picked=selected&&this.active.point;
   const box=new THREE.Box3();for(const object of picked?[this.active.object]:(entry.objects||[entry.object]))box.union(new THREE.Box3().setFromObject(object));
   const point=picked?this.active.object.localToWorld(this.active.point.clone()):box.getCenter(new THREE.Vector3());
   if(!picked)point.y=box.max.y+.08;
   point.project(camera);label.hidden=point.z>1||point.z< -1;
   if(label.hidden)continue;
   const half=Math.max(40,label.offsetWidth/2),minX=left+half+40,maxX=Math.max(minX,width-right-half-40);
   const anchorX=(point.x+1)*width/2,anchorY=(1-point.y)*height/2;
   let x=THREE.MathUtils.clamp(anchorX,minX,maxX),y=THREE.MathUtils.clamp(anchorY-14,160,height-100);
   for(const offset of labelOffsets){const cx=x+offset.dx,cy=y+offset.dy;
    if(cx<minX||cx>maxX||cy<150||cy>height-80)continue;
    if(!positioned.some(p=>Math.abs(p.x-cx)<p.half+half+8&&Math.abs(p.y-cy)<36)){x=cx;y=cy;break;}
   }
   positioned.push({x,y,half});label.style.left=x+'px';label.style.top=y+'px';
   entry.line.style.display='';entry.line.setAttribute('x1',anchorX);entry.line.setAttribute('y1',anchorY);entry.line.setAttribute('x2',x);entry.line.setAttribute('y2',y);entry.line.classList.toggle('selected',selected);
  }
 }
}
