import * as THREE from 'three';
import {EffectComposer} from './vendor/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/postprocessing/UnrealBloomPass.js';

// Only active alarm geometry is visible in the bloom buffer. Normal metal
// reflections and the blue interface never enter this emissive pass.
export class AlarmGlow {
 constructor(renderer,scene,camera,isAlarm){
  this.renderer=renderer;this.scene=scene;this.camera=camera;this.isAlarm=isAlarm;
  this.black=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide});
  this.glow=new EffectComposer(renderer);this.glow.renderToScreen=false;this.glow.setPixelRatio(1);
  this.glow.addPass(new RenderPass(scene,camera));
  this.bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.85,.45,.12);this.glow.addPass(this.bloom);
  this.overlayScene=new THREE.Scene();this.overlayCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.overlayScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
   uniforms:{bloomTexture:{value:this.glow.renderTarget2.texture}},
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'uniform sampler2D bloomTexture;varying vec2 vUv;void main(){vec3 glow=texture2D(bloomTexture,vUv).rgb;gl_FragColor=vec4(glow*.45,1.0);\n#include <colorspace_fragment>\n}',
   toneMapped:false,depthTest:false,depthWrite:false,transparent:true,blending:THREE.AdditiveBlending
  })));
 }
 setSize(w,h){this.glow.setSize(Math.max(1,Math.round(w*.5)),Math.max(1,Math.round(h*.5)));}
 render(){
  const scene=this.scene,camera=this.camera,materials=new Map(),hidden=[];
  let alarms=0;scene.traverse(o=>{if(o.isMesh&&o.visible&&this.isAlarm(o))alarms++;});
  if(!alarms){this.renderer.render(scene,camera);return;}
  const background=scene.background;scene.background=new THREE.Color(0x000000);
  const shadowMap=this.renderer.shadowMap,autoUpdate=shadowMap.autoUpdate;shadowMap.autoUpdate=false;shadowMap.needsUpdate=false;
  try{
   scene.traverse(o=>{if(o.isMesh&&!this.isAlarm(o)){materials.set(o,o.material);o.material=this.black;}else if((o.isLine||o.isPoints||o.isSprite)&&o.visible){hidden.push(o);o.visible=false;}});
   this.glow.render();
  }finally{scene.background=background;for(const [o,m] of materials)o.material=m;for(const o of hidden)o.visible=true;shadowMap.autoUpdate=autoUpdate;}
  this.renderer.setRenderTarget(null);shadowMap.needsUpdate=true;this.renderer.render(scene,camera);
  const autoClear=this.renderer.autoClear;this.renderer.autoClear=false;
  try{this.renderer.render(this.overlayScene,this.overlayCamera);}finally{this.renderer.autoClear=autoClear;}
 }
}
