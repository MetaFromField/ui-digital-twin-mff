import * as THREE from 'three';

// A visible-surface mask produces a configurable CSS pixel silhouette, independent
// of object scale, camera distance and device pixel ratio. No bounding box lines.
export class SelectionOutline{
 constructor(renderer,scene,camera,options={}){
  Object.assign(this,{renderer,scene,camera,deviceId:null});
  this.isSelected=options.isSelected;this.exclude=options.exclude;this.haloRadius=options.haloRadius??2.25;
  this.target=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
  this.target.samples=Math.min(4,renderer.capabilities.maxSamples);
  this.glowA=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
  this.glowB=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
  this.white=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false});
  this.black=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide,toneMapped:false});
  this.overlay=new THREE.Scene();this.ortho=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.blurMaterial=new THREE.ShaderMaterial({
   uniforms:{source:{value:this.target.texture},direction:{value:new THREE.Vector2()}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`uniform sampler2D source;uniform vec2 direction;varying vec2 vUv;
    void main(){float a=texture2D(source,vUv).r*.227027;
     a+=(texture2D(source,vUv+direction*1.384615).r+texture2D(source,vUv-direction*1.384615).r)*.316216;
     a+=(texture2D(source,vUv+direction*3.230769).r+texture2D(source,vUv-direction*3.230769).r)*.070270;
     gl_FragColor=vec4(a,a,a,1.);}`,
   depthTest:false,depthWrite:false,toneMapped:false
  });
  this.blurScene=new THREE.Scene();this.blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.blurMaterial));
  this.material=new THREE.ShaderMaterial({
   uniforms:{lineWidth:{value:options.lineWidth??3},mask:{value:this.target.texture},halo:{value:this.glowB.texture},stepSize:{value:new THREE.Vector2(1,1)},lineColor:{value:new THREE.Color(options.lineColor??0xffffff)},glowColor:{value:options.glowColor===undefined?new THREE.Color().setRGB(.42,.76,1):new THREE.Color(options.glowColor)},glowStrength:{value:options.glowStrength??1.4},glowOpacity:{value:options.glowOpacity??.65}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`uniform sampler2D mask;uniform sampler2D halo;uniform vec2 stepSize;uniform float lineWidth;uniform vec3 lineColor;uniform vec3 glowColor;uniform float glowStrength;uniform float glowOpacity;varying vec2 vUv;
    void main(){float center=texture2D(mask,vUv).r;float edge=center;
     for(int i=0;i<24;i++){float a=float(i)*6.28318530718/24.;vec2 dir=vec2(cos(a),sin(a));
      for(int j=1;j<=3;j++){if(float(j)<=lineWidth)edge=max(edge,texture2D(mask,vUv+dir*stepSize*float(j)).r);}}
     float line=clamp(edge-center,0.,1.);
     float glow=clamp(texture2D(halo,vUv).r*(1.-center)*glowStrength,0.,glowOpacity);
     float alpha=line+glow*(1.-line);if(alpha<.005)discard;
     vec3 color=mix(glowColor,lineColor,line/max(alpha,.001));
     gl_FragColor=vec4(color,alpha);}`,
   transparent:true,depthTest:false,depthWrite:false,toneMapped:false
  });
  this.overlay.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material));
 }
 setDevice(id){this.deviceId=id;this.partMeshes=null;}
 setObject(object){this.partMeshes=object?new Set():null;object?.traverse(o=>{if(o.isMesh)this.partMeshes.add(o);});}
 setObjects(objects){this.partMeshes=new Set();for(const object of objects)object.traverse(o=>{if(o.isMesh)this.partMeshes.add(o);});}
 matches(mesh){return !(this.exclude?.(mesh))&&(this.isSelected?this.isSelected(mesh):mesh.userData.deviceId===this.deviceId&&(!this.partMeshes||this.partMeshes.has(mesh)));}
 setSize(width,height){const dpr=this.renderer.getPixelRatio();this.width=width;this.height=height;this.target.setSize(Math.round(width*dpr),Math.round(height*dpr));this.glowA.setSize(Math.max(1,Math.round(width*dpr*.5)),Math.max(1,Math.round(height*dpr*.5)));this.glowB.setSize(this.glowA.width,this.glowA.height);this.material.uniforms.stepSize.value.set(1/width,1/height);}
 render(){
  if(!this.isSelected&&!this.deviceId)return;
  let hasVisible=false;this.scene.traverseVisible(o=>{if(o.isMesh&&this.matches(o))hasVisible=true;});if(!hasVisible)return;
  const {renderer,scene,camera}=this,materials=new Map(),hidden=[];
  const background=scene.background,auto=renderer.autoClear,priorTarget=renderer.getRenderTarget();
  const shadowAuto=renderer.shadowMap.autoUpdate,shadowNeeds=renderer.shadowMap.needsUpdate;
  try{
   scene.background=new THREE.Color(0);renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
   scene.traverse(o=>{
    if(o.isMesh){const selected=this.matches(o);
     if(!selected&&(Array.isArray(o.material)?o.material:[o.material]).every(m=>m.transparent&&m.opacity<1)){if(o.visible){hidden.push(o);o.visible=false;}}
     else{materials.set(o,o.material);o.material=selected?this.white:this.black;}
    }else if((o.isLine||o.isPoints||o.isSprite)&&o.visible){hidden.push(o);o.visible=false;}
   });
   renderer.autoClear=true;renderer.setRenderTarget(this.target);renderer.render(scene,camera);
  }finally{
   scene.background=background;for(const [o,m]of materials)o.material=m;for(const o of hidden)o.visible=true;
   renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowNeeds;renderer.setRenderTarget(priorTarget);renderer.autoClear=auto;
  }
  try{
   renderer.autoClear=true;this.blurMaterial.uniforms.source.value=this.target.texture;
   this.blurMaterial.uniforms.direction.value.set(this.haloRadius/this.width,0);renderer.setRenderTarget(this.glowA);renderer.render(this.blurScene,this.ortho);
   this.blurMaterial.uniforms.source.value=this.glowA.texture;
   this.blurMaterial.uniforms.direction.value.set(0,this.haloRadius/this.height);renderer.setRenderTarget(this.glowB);renderer.render(this.blurScene,this.ortho);
   renderer.setRenderTarget(priorTarget);renderer.autoClear=false;renderer.render(this.overlay,this.ortho);
  }finally{renderer.setRenderTarget(priorTarget);renderer.autoClear=auto;}
 }
}
