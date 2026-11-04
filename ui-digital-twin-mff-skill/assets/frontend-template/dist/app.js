import {DRACOLoader} from './vendor/DRACOLoader.js';
import {animatedPartGroups} from './animated-parts.js';
import {PartLabels} from './part-labels.js';
import {createDemoEventHistory} from './demo-events.js';
import {isolateDeviceMeshes} from './device-visibility.js';
import {mountDeviceDetail,syncDeviceDetail,setDetailModel,setInspectedPart,updateDeviceDetail} from './device-detail.js';
import {recordDeviceEvent} from './alarm-events.js';
import {SelectionOutline} from './selection-outline.js';
import {mountMonitorPages,updateMonitorPages,setMonitorPage} from './monitor-pages.js';
import './studio-layout.js';
import {CONFIG,metric,format,describeAlarm} from './config.js';
import * as THREE from 'three';
import {createWorkshopLighting} from './studio-lighting.js';
let alarmOutline;
import {MotionController,mountMotionControls} from './motion.js';
import {setupWorkshop,updateWorkshop,mountWorkshopMotion,selectWorkshopDevice,clipLabel,refreshMotionScope} from './workshop.js';
const motion=new MotionController();let tickMotion=()=>{},shadowLight,studioFloor,showLabels=true;

import {GLTFLoader} from './vendor/GLTFLoader.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {DEVICES,COLORS,STATUS,FIELDS,validateSample,statusOf,demoSample,resetDemoTelemetry} from './telemetry.js';
const $=s=>document.querySelector(s);
const state={page:'overview',selected:DEVICES[0].id,mode:'demo',samples:new Map(),history:new Map(DEVICES.map(d=>[d.id,[]])),events:[],tick:0,animate:true,color:false,wire:false,modelReady:false,sourceState:'模拟数据',invalid:0};
let partLabels;
let lastViewportWidth=0,lastViewportHeight=0,overviewView;const modelNodes=new Map(),animatedGroups=new Map();
let scene,camera,renderer,controls,model,mixer,selection,home,ws,reconnectTimer,connectionGeneration=0,frameTime=performance.now();
const meshes=[],anchors=new Map(),labels=new Map(),deviceMeshes=new Map(DEVICES.map(d=>[d.id,[]]));
const time=t=>new Date(t).toLocaleTimeString('zh-CN',{hour12:false});
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function addEvent(d,s,previous){recordDeviceEvent(state.events,d,s,previous,state.mode);}
function ingest(s){if(!validateSample(s)){state.invalid++;return false;}const old=state.samples.get(s.deviceId);if(old&&s.timestamp<=old.timestamp)return false;const d=DEVICES.find(d=>d.id===s.deviceId);addEvent(d,s,statusOf(old));state.samples.set(s.deviceId,s);const h=state.history.get(s.deviceId);h.push({...s});if(h.length>CONFIG.data.historyLength)h.shift();return true;}
function selectDevice(id,focus=false){state.selected=id;selectWorkshopDevice(id);updateUI();updateSelection();if(focus)focusDevice();}
function buildList(){for(const d of DEVICES){
 const row=document.createElement('button');row.className='device-row';row.dataset.id=d.id;const icon=document.createElement('span');icon.className='node-icon';icon.textContent='◉';const description=document.createElement('span'),name=document.createElement('strong'),code=document.createElement('small'),indicator=document.createElement('i');name.textContent=d.name;code.textContent=d.code+' · '+CONFIG.project.lineId;indicator.className='state';description.append(name,code);row.append(icon,description,indicator);row.onclick=()=>selectDevice(d.id,true);$('#device-list').append(row);
 const label=document.createElement('button');label.className='model-label';label.append(document.createElement('i'),document.createTextNode(d.name));label.onclick=()=>selectDevice(d.id,true);$('#labels').append(label);labels.set(d.id,label);
}}
function updateUI(){const now=Date.now(),d=DEVICES.find(d=>d.id===state.selected),s=state.samples.get(d.id),status=statusOf(s,now),online=status!=='offline';
 for(const item of DEVICES){const st=statusOf(state.samples.get(item.id),now),row=$('.device-row[data-id="'+item.id+'"]');row.classList.toggle('selected',item.id===d.id);row.querySelector('.state').style.background=COLORS[st];row.title=STATUS[st];row.setAttribute('aria-pressed',String(item.id===d.id));const label=labels.get(item.id);label.classList.toggle('selected',item.id===d.id);label.querySelector('i').style.background=COLORS[st];}
 $('#detail-name').textContent=d.name;$('#detail-id').textContent=CONFIG.project.lineId+' / '+d.code;$('#detail-node').textContent=d.node||'模型总成';$('#trend-device').textContent=d.name;$('#detail-status').textContent=STATUS[status];$('#detail-status').dataset.status=status;
 for(const m of CONFIG.metrics.filter(m=>m.detail))$('#detail-'+m.key).textContent=online?format(s[m.key],m):'—';
 $('#updated-at').textContent=s?time(s.timestamp)+(online?' 更新':' 已过期'):'等待采样';
 if(CONFIG.loadKey){const m=metric(CONFIG.loadKey);$('#load-value').textContent=online?format(s[m.key],m)+m.unit:'—';$('#load-bar').style.width=online?Math.max(0,Math.min(100,(s[m.key]-m.min)/(m.max-m.min)*100))+'%':'0';$('#load-bar').style.background=COLORS[status];}
 const statuses=DEVICES.map(d=>statusOf(state.samples.get(d.id),now)),count=statuses.filter(s=>['warning','fault'].includes(s)).length,aggregate=statuses.includes('fault')?'故障':statuses.includes('offline')?'数据不完整':statuses.every(s=>s==='stopped')?'已停机':'运行中';$('#line-status').textContent=aggregate;$('#line-status').style.color=statuses.includes('fault')?COLORS.fault:statuses.includes('offline')?COLORS.offline:COLORS.normal;
 const primary=state.samples.get(CONFIG.hero.deviceId),secondary=state.samples.get(CONFIG.secondary.deviceId),primaryOnline=statusOf(primary,now)!=='offline',secondOnline=statusOf(secondary,now)!=='offline';$('#rpm').textContent=primaryOnline?format(primary[CONFIG.hero.key],metric(CONFIG.hero.key)):'—';$('#rpm-bar').style.width=primaryOnline?Math.max(0,Math.min(100,primary[CONFIG.hero.key]/CONFIG.hero.max*100))+'%':'0';$('#speed').textContent=secondOnline?format(secondary[CONFIG.secondary.key],metric(CONFIG.secondary.key)):'—';$('#alarm-total').textContent=count;$('#nav-alarm').textContent=count;$('#alarm-foot').textContent=count?count+' 个监测单元需要关注':'当前无阈值告警';const onlineCount=statuses.filter(s=>s!=='offline').length;$('#line-foot').textContent=state.mode==='demo'?'模拟数据 · 每 '+CONFIG.data.intervalMs/1000+' 秒刷新':onlineCount+' / '+DEVICES.length+' 个监测单元在线';
 $('#source-badge').textContent='● '+(state.mode==='demo'?'模拟数据':state.sourceState);$('#scene-mode').textContent=state.mode==='demo'?'DEMO':'LIVE';$('#connection-status').textContent=state.mode==='demo'?'演示模式 · 未连接真实设备':state.sourceState+' · '+onlineCount+'/'+DEVICES.length+' 点位在线'+(state.invalid?' · 已拒绝 '+state.invalid+' 条无效消息':'');
 updateWorkshop(state);updateDeviceDetail();updateMonitorPages();drawChart();renderAlarms();applyMaterials();
}
function renderAlarms(){const container=$('#alarm-list');container.replaceChildren();$('#event-count').textContent=state.events.length;const events=state.events.filter(e=>!$('#unack-only').checked||!e.ack);if(!events.length){container.innerHTML='<div class="empty-state">✓　暂无'+($('#unack-only').checked?'未确认':'')+'告警事件</div>';return;}for(const e of events){const row=document.createElement('div');row.className='alarm-row';const a=document.createElement('div');a.textContent=time(e.timestamp);const small=document.createElement('small');small.textContent=e.name;a.append(small);const b=document.createElement('div');b.textContent=(e.status==='fault'?'故障 · ':'预警 · ')+e.message;b.style.color=COLORS[e.status];const c=document.createElement('button');c.textContent=e.ack?'已确认':'确认';c.disabled=e.ack;c.onclick=()=>{e.ack=true;e.ackAt=Date.now();renderAlarms();updateMonitorPages();toast('事件已确认，设备状态仍由遥测数据决定');};a.style.cursor='pointer';a.onclick=()=>selectDevice(e.deviceId,true);row.append(a,b,c);container.append(row);}}
function drawChart(){const canvas=$('#trend-chart'),rect=canvas.getBoundingClientRect();if(!rect.width)return;const ratio=Math.min(devicePixelRatio,2);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);const w=rect.width,h=rect.height,p={l:42,r:15,t:12,b:25},history=state.trendScope==='workshop'?state.workshopHistory:state.history.get(state.selected),key=$('#trend-metric').value;$('#chart-empty').hidden=history.length>0;const values=history.map(s=>s[key]);let min=Math.min(...values),max=Math.max(...values);if(!values.length){min=0;max=100;}const pad=Math.max((max-min)*.3,max*.03,1);min=Math.max(metric(key).min,min-pad);max+=pad;ctx.font='11px Consolas,monospace';ctx.lineWidth=1;for(let i=0;i<4;i++){const y=p.t+(h-p.t-p.b)*i/3;ctx.strokeStyle='#e1e4e6';ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke();ctx.fillStyle='#92999f';ctx.textAlign='right';ctx.fillText((max-(max-min)*i/3).toFixed(metric(key).precision??1),p.l-8,y+3);}if(!history.length)return;const x=i=>p.l+i/Math.max(1,history.length-1)*(w-p.l-p.r),y=v=>p.t+(max-v)/(max-min)*(h-p.t-p.b);const line=()=>{ctx.moveTo(x(0),y(values[0]));values.slice(1).forEach((v,i)=>ctx.lineTo(x(i+1),y(v)));};ctx.beginPath();line();ctx.lineTo(x(values.length-1),h-p.b);ctx.lineTo(x(0),h-p.b);ctx.closePath();const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#2878df20');grad.addColorStop(1,'#2878df00');ctx.fillStyle=grad;ctx.fill();ctx.beginPath();line();ctx.strokeStyle='#2878df';ctx.lineWidth=1.7;ctx.stroke();ctx.beginPath();ctx.arc(x(values.length-1),y(values.at(-1)),3,0,Math.PI*2);ctx.fillStyle='#2878df';ctx.fill();const count=Math.min(5,history.length);for(let i=0;i<count;i++){const index=count===1?0:Math.round(i*(history.length-1)/(count-1));ctx.textAlign=i===0?'left':i===count-1?'right':'center';ctx.fillStyle='#92999f';ctx.fillText(time(history[index].timestamp),x(index),h-5);}}
function materialsOf(mesh){return Array.isArray(mesh.material)?mesh.material:[mesh.material];}
function applyMaterials(){
 if(!state.modelReady)return;
 for(const mesh of meshes){
  const id=mesh.userData.deviceId,status=id?statusOf(state.samples.get(id)):'normal';
  const alarm=!!id&&['warning','fault'].includes(status);mesh.userData.alarmOutline=alarm;
  for(const m of materialsOf(mesh)){
   if(!m.userData.originalSurface)m.userData.originalSurface={metalness:m.metalness,roughness:m.roughness,envMapIntensity:m.envMapIntensity};
   m.wireframe=state.wire;
   if(m.color&&m.userData.originalColor)m.color.copy(m.userData.originalColor);
   if(m.metalness!==undefined){m.metalness=m.userData.originalSurface.metalness;m.roughness=m.userData.originalSurface.roughness;m.envMapIntensity=m.userData.originalSurface.envMapIntensity;}
   if(m.emissive){m.emissive.set(0);m.emissiveIntensity=0;}
   if(alarm){
    if(m.color)m.color.set(0xff0000);
    if(m.emissive){m.emissive.set(0xff0000);m.emissiveIntensity=.18;}
    if(m.metalness!==undefined){m.metalness=.25;m.roughness=.45;m.envMapIntensity=.35;}
   }else if(id&&state.color&&status!=='fault'){if(m.color)m.color.set(COLORS[status]);}
  }
 }
}
function updateSelection(){selection?.setDevice(state.page==='detail'?null:state.selected);}
function setView(position,target){camera.position.copy(position);controls.target.copy(target);controls.update();}
function frameModel(direction){
 if(state.page==='detail'){frameBounds(deviceBounds(state.selected),direction);return;}
 if(!home)return;const viewport=$('#viewport'),mobile=innerWidth<=650,style=getComputedStyle(document.documentElement);
 const safeWidth=mobile?viewport.clientWidth*.88:Math.max(240,viewport.clientWidth-parseFloat(style.getPropertyValue('--left'))-parseFloat(style.getPropertyValue('--right'))-120);
 const safeHeight=mobile?viewport.clientHeight-180:Math.max(260,viewport.clientHeight-300);
 const dir=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize();
 const extent=axis=>Math.abs(axis.x)*home.size.x+Math.abs(axis.y)*home.size.y+Math.abs(axis.z)*home.size.z;
 const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const distance=Math.max(extent(right)/(2*tan*camera.aspect*safeWidth/viewport.clientWidth),extent(up)/(2*tan*safeHeight/viewport.clientHeight))*1.06+extent(dir)*.5;
 setView(home.target.clone().add(dir.multiplyScalar(distance)),home.target);
}
function markCameraView(id){state.cameraView=id;for(const key of ['reset-view','front-view','top-view']){const button=$('#'+key);button.classList.toggle('active',key===id);button.setAttribute('aria-pressed',String(key===id));}}
function resetView(){markCameraView('reset-view');frameModel(new THREE.Vector3(1.05,1.65,1.2));}
function focusDevice(){if(state.page==='detail'){showWholeDevice();return;}const target=anchors.get(state.selected);if(!target)return;target.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(target);const c=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3()).length();const dist=Math.max(4.5,size*1.5);setView(c.clone().add(new THREE.Vector3(.4,.65,1).normalize().multiplyScalar(dist)),c);}
function deviceBounds(id){
 const box=new THREE.Box3();scene?.updateMatrixWorld(true);
 for(const mesh of deviceMeshes.get(id)||[])box.union(new THREE.Box3().setFromObject(mesh));
 return box;
}
function frameBounds(box,direction){
 if(box.isEmpty())return;
 const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const viewport=$('#viewport'),style=getComputedStyle(document.documentElement),width=Math.max(220,viewport.clientWidth-parseFloat(style.getPropertyValue('--left'))-parseFloat(style.getPropertyValue('--right'))-120),height=Math.max(220,viewport.clientHeight-260);
 const dir=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize();
 const extent=axis=>Math.abs(axis.x)*size.x+Math.abs(axis.y)*size.y+Math.abs(axis.z)*size.z;
 const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),distance=Math.max(.45,Math.max(extent(right)/(2*tan*camera.aspect*width/viewport.clientWidth),extent(up)/(2*tan*height/viewport.clientHeight))*1.12+extent(dir)*.5);
 setView(center.clone().add(dir.multiplyScalar(distance)),center);
}
function detailParts(){
 const d=DEVICES.find(d=>d.id===state.selected);
 return (animatedGroups.get(d.id)||[]).map(part=>{
  const objects=part.nodes.filter(index=>d.nodes.includes(index)).map(index=>modelNodes.get(index)).filter(Boolean),members=new Set();
  for(const object of objects)object.traverse(o=>{if(o.isMesh&&o.userData.deviceId===d.id)members.add(o);});
  return {key:String(part.nodes[0]),name:part.name,label:clipLabel(part.name),meshCount:members.size,object:objects[0],objects};
 }).filter(part=>part.meshCount);
}
function updateDetailModel(){
 if(!state.modelReady)return;
 const list=deviceMeshes.get(state.selected)||[],box=deviceBounds(state.selected),size=box.getSize(new THREE.Vector3());
 const triangles=list.reduce((sum,m)=>sum+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
 partLabels.setParts(detailParts());
 setDetailModel({meshCount:list.length,triangles:Math.round(triangles),size:[size.x,size.y,size.z].map(n=>n.toFixed(2))},detailParts());
}
function inspectDevicePart(value,hitPoint){
 const parts=detailParts(),object=typeof value==='string'?parts.find(p=>p.key===value)?.object:value;if(!object)return;
 const belongs=(root,child)=>{for(let p=child;p;p=p.parent)if(p===root)return true;return false;};
 const group=parts.find(p=>p.objects.some(root=>belongs(root,object)));if(!group)return;const name=group.name,count=group.meshCount;
 markCameraView(null);selection.setDevice(state.selected);selection.setObjects(group.objects);const partBox=new THREE.Box3();for(const member of group.objects)partBox.union(new THREE.Box3().setFromObject(member));
 if(hitPoint){const whole=deviceBounds(state.selected).getSize(new THREE.Vector3()),limit=Math.max(.3,Math.max(whole.x,whole.y,whole.z)*.18),localSize=partBox.getSize(new THREE.Vector3()).clampScalar(.15,limit);partBox.setFromCenterAndSize(hitPoint,localSize);}
 frameBounds(partBox,new THREE.Vector3(.6,.5,1));
 const part={key:group?.key||object.uuid,label:group?.label||name,name,meshCount:count};
 partLabels.inspect(part,object,hitPoint);setInspectedPart(part);
}
function showWholeDevice(){partLabels?.inspect(null);selection?.setDevice(state.page==='detail'?null:state.selected);setInspectedPart(null);resetView();}
function openDeviceDetails(id){selectDevice(id);setMonitorPage('detail');}
function onMonitorPage(page,previous){
 syncDeviceDetail(page);refreshMotionScope();if(!state.modelReady)return;
 const detail=page==='detail';
 const labelButton=$('#toggle-labels');labelButton.disabled=detail&&detailParts().length===0;labelButton.textContent=detail?'部件标注':'全部标注';const labelActive=detail?!!state.detailLabels:!!state.labelsAll;labelButton.classList.toggle('active',labelActive);labelButton.setAttribute('aria-pressed',String(labelActive));document.body.dataset.detailLabels=String(!!state.detailLabels);
 if(detail&&previous!=='detail'){overviewView={position:camera.position.clone(),target:controls.target.clone(),cameraView:state.cameraView};document.querySelectorAll('#device-detail-page .inspector-scroll').forEach(node=>node.scrollTop=0);}
 const count=isolateDeviceMeshes(meshes,detail?state.selected:null);studioFloor.visible=detail||!CONFIG.model.hasOwnFloor;
 $('#device-detail-page').dataset.visibleMeshes=detail?count:0;$('#device-detail-page').dataset.isolatedDevice=detail?state.selected:'';
 camera.near=detail?.03:.3;camera.updateProjectionMatrix();controls.minDistance=detail?.25:2;controls.maxPolarAngle=Math.PI*(detail?.9:.48);
 selection?.setDevice(detail?null:state.selected);
 if(detail){updateDetailModel();resetView();}else if(previous==='detail'&&overviewView){setView(overviewView.position,overviewView.target);markCameraView(overviewView.cameraView);}
}

function initScene(){try{
 const viewport=$('#viewport');partLabels=new PartLabels(viewport,inspectDevicePart);scene=new THREE.Scene();scene.background=new THREE.Color(CONFIG.appearance.background);scene.fog=null;camera=new THREE.PerspectiveCamera(32,1,.3,180);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=CONFIG.appearance.exposure;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;viewport.prepend(renderer.domElement);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=2;controls.maxDistance=100;controls.autoRotateSpeed=.45;
 shadowLight=createWorkshopLighting(scene,renderer,CONFIG.appearance);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.ShadowMaterial({color:0x3e464e,opacity:.22}));floor.rotation.x=-Math.PI/2;floor.position.y=0;floor.receiveShadow=true;floor.visible=!CONFIG.model.hasOwnFloor;scene.add(floor);studioFloor=floor;
 selection=new SelectionOutline(renderer,scene,camera,{exclude:mesh=>mesh.userData.alarmOutline===true});alarmOutline=new SelectionOutline(renderer,scene,camera,{isSelected:mesh=>mesh.userData.alarmOutline===true,lineWidth:0,lineColor:0xff0000,glowColor:0xff0000,glowStrength:3.2,glowOpacity:.9,haloRadius:1.8});
 new ResizeObserver(()=>{const r=viewport.getBoundingClientRect();if(!r.width||!r.height||(r.width===lastViewportWidth&&r.height===lastViewportHeight))return;lastViewportWidth=r.width;lastViewportHeight=r.height;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height);selection.setSize(r.width,r.height);alarmOutline.setSize(r.width,r.height);if(home)resetView();drawChart();}).observe(viewport);
 new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(new URL('./vendor/draco/',import.meta.url).href).setWorkerLimit(2)).load(CONFIG.model.path,gltf=>{
 model=gltf.scene;for(const name of CONFIG.model.excludeNodes||[])model.getObjectByName(name)?.removeFromParent();const originalBox=new THREE.Box3().setFromObject(model);const size=originalBox.getSize(new THREE.Vector3());const scale=CONFIG.model.normalizedSize/Math.max(size.x,size.y,size.z);const center=originalBox.getCenter(new THREE.Vector3());const wrapper=new THREE.Group();wrapper.scale.setScalar(scale);wrapper.position.set(-center.x*scale,-CONFIG.model.groundY*scale,-center.z*scale);wrapper.add(model);scene.add(wrapper);wrapper.updateWorldMatrix(true,true);
 animatedGroups.clear();for(const d of DEVICES)animatedGroups.set(d.id,animatedPartGroups(gltf.parser.json.animations,d.animations));
 modelNodes.clear();const nodesByIndex=modelNodes;model.traverse(obj=>{const association=gltf.parser.associations.get(obj);if(association?.nodes!==undefined)nodesByIndex.set(association.nodes,obj);});
 for(const d of DEVICES){const target=d.nodeIndex===null?model:nodesByIndex.get(d.nodeIndex)||model.getObjectByName(d.node);if(target){anchors.set(d.id,target);target.traverse(obj=>{if(obj.isMesh)obj.userData.deviceId=d.id;});for(const index of d.nodes||[])nodesByIndex.get(index)?.traverse(obj=>{if(obj.isMesh)obj.userData.deviceId=d.id;});}else{labels.get(d.id).hidden=true;toast('监测点 '+d.name+' 未找到对应模型节点');}}
 model.traverse(obj=>{if(!obj.isMesh)return;obj.castShadow=true;obj.receiveShadow=true;obj.material=Array.isArray(obj.material)?obj.material.map(m=>m.clone()):obj.material.clone();for(const m of materialsOf(obj)){if(m.metalness!==undefined){
 const rule=CONFIG.materialRules.find(r=>r.exact?m.name.toLowerCase()===r.match.toLowerCase():m.name.toLowerCase().includes(r.match.toLowerCase()));if(rule){if(rule.color)m.color.set(rule.color);if(rule.colorScale!==undefined)m.color.multiplyScalar(rule.colorScale);if(rule.metalness!==undefined)m.metalness=rule.metalness;if(rule.roughness!==undefined)m.roughness=rule.roughness;}
 m.envMapIntensity=rule?.envMapIntensity??1.15;
 }if(m.color)m.userData.originalColor=m.color.clone();m.side=THREE.DoubleSide;
 const isGround=(CONFIG.model.groundMaterials||[]).some(name=>m.name.toLowerCase()===name.toLowerCase());const isGlass=m.transparent&&m.opacity<.98;
 if(isGround){obj.castShadow=false;obj.receiveShadow=true;}
 else if(isGlass){obj.castShadow=false;obj.receiveShadow=false;m.depthWrite=false;}
 m.shadowSide=THREE.BackSide;}meshes.push(obj);if(obj.userData.deviceId)deviceMeshes.get(obj.userData.deviceId).push(obj);});
 mixer=new THREE.AnimationMixer(model);for(const clip of gltf.animations){const device=DEVICES.find(d=>d.animations.includes(clip.name));if(device)motion.add(mixer.clipAction(clip),device);}tickMotion=mountWorkshopMotion(motion,selectDevice);home={position:new THREE.Vector3(18,18,32),target:new THREE.Vector3(0,(originalBox.max.y-CONFIG.model.groundY)*scale*.4,0),size:size.clone().multiplyScalar(scale)};if(['overview','detail'].includes(state.page))resetView();state.modelReady=true;$('#loading').style.display='none';$('#file-ok').textContent='已载入';$('#model-state').textContent=`${meshes.length} 网格 / ${gltf.animations.length} 动画`;updateSelection();applyMaterials();if(state.page==='detail')onMonitorPage('detail','equipment');window.__twin.model={meshCount:meshes.length,animationCount:gltf.animations.length,mappedDevices:anchors.size};
 },e=>{$('#load-progress').textContent=e.total?`加载进度 ${Math.round(e.loaded/e.total*100)}%`:'正在读取 GLB 文件…';},error=>{console.error(error);$('#loading b').textContent='模型加载失败';$('#load-progress').textContent='请通过本地 HTTP 服务打开页面，检查 assets 目录中的 GLB 文件。';$('.loader').style.display='none';$('#file-ok').textContent='失败';});
 const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let down;
 renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||e.button!==0)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const candidates=meshes.filter(m=>m.visible&&(state.page!=='detail'||!(Array.isArray(m.material)?m.material:[m.material]).every(mat=>mat.transparent&&mat.opacity<.5)));const hit=raycaster.intersectObjects(candidates,false)[0];if(hit){if(state.page==='detail'){inspectDevicePart(hit.object,hit.point);return;}if(hit.object.userData.deviceId)selectDevice(hit.object.userData.deviceId);else toast('机架 / 静态结构件：暂无绑定监测点');}else if(state.page==='detail'){selection.setDevice(null);partLabels.inspect(null);setInspectedPart(null);}});
 function animate(now){requestAnimationFrame(animate);const delta=Math.min((now-frameTime)/1000,.05);frameTime=now;controls.update();if(mixer){mixer.update(delta);tickMotion();}if(!['overview','detail'].includes(state.page))return;const w=viewport.clientWidth,h=viewport.clientHeight;for(const [id,label] of labels){const anchor=anchors.get(id);if(!anchor){label.hidden=true;continue;}if(state.page==='detail'){label.hidden=true;continue;}const box=new THREE.Box3().setFromObject(anchor),p=box.getCenter(new THREE.Vector3());p.y=box.max.y+.6;const v=p.project(camera);const x=(v.x+1)*w/2,y=(-v.y+1)*h/2;label.hidden=(!showLabels&&id!==state.selected)||(!state.labelsAll&&id!==state.selected&&!(['warning','fault'].includes(statusOf(state.samples.get(id)))))||v.z>1||v.z<-1||x<20||x>w-20||y<125||y>h-75;label.style.left=x+'px';label.style.top=y+'px';}const style=getComputedStyle(document.body);partLabels.render({visible:state.page==='detail',all:!!state.detailLabels,camera,width:w,height:h,left:parseFloat(style.getPropertyValue('--left')),right:parseFloat(style.getPropertyValue('--right'))});renderer.render(scene,camera);selection.render();alarmOutline.render();}requestAnimationFrame(animate);
 }catch(e){console.error(e);$('#loading b').textContent='三维视图不可用';$('#load-progress').textContent='浏览器无法初始化 WebGL，请开启硬件加速后重试。';$('.loader').style.display='none';}}
function clearTelemetry(){if(state.workshopHistory)state.workshopHistory=[];state.samples.clear();state.history=new Map(DEVICES.map(d=>[d.id,[]]));state.events=[];state.demoEventsSeeded=false;state.invalid=0;}
function connectLive(url,generation){if(generation!==connectionGeneration)return;state.sourceState='正在连接';updateUI();try{ws=new WebSocket(url);}catch{state.sourceState='连接失败';updateUI();return;}ws.onopen=()=>{if(generation!==connectionGeneration)return;state.sourceState='网关已连接';updateUI();};ws.onmessage=e=>{if(generation!==connectionGeneration)return;try{const payload=JSON.parse(e.data);for(const sample of Array.isArray(payload)?payload:[payload])ingest(sample);}catch{state.invalid++;}updateUI();};ws.onerror=()=>{if(generation===connectionGeneration){state.sourceState='连接异常';updateUI();}};ws.onclose=()=>{if(generation!==connectionGeneration)return;state.sourceState='连接断开 · 5 秒后重试';updateUI();reconnectTimer=setTimeout(()=>connectLive(url,generation),5000);};}
function switchSource(mode,url){connectionGeneration++;clearTimeout(reconnectTimer);if(ws){ws.onclose=null;ws.close();ws=null;}state.mode=mode;clearTelemetry();if(mode==='live')connectLive(url,connectionGeneration);else{resetDemoTelemetry();demoTick();}updateUI();}
function demoTick(){if(state.mode!=='demo')return;if(!state.demoEventsSeeded){state.events.push(...createDemoEventHistory());state.demoEventsSeeded=true;}state.tick++;for(const [i,d] of DEVICES.entries())ingest(demoSample(d,i,state.tick));updateUI();}
function bindEvents(){ $('#device-search').oninput=e=>{const q=e.target.value.trim().toLowerCase();for(const d of DEVICES){const row=$(`.device-row[data-id="${d.id}"]`);const hidden=!`${d.name} ${d.code} ${d.node}`.toLowerCase().includes(q);row.hidden=hidden;const unit=row.closest('.unit-row');if(unit)unit.hidden=hidden;}};
 $('#select-line').onclick=resetView;$('#reset-view').onclick=()=>state.page==='detail'?showWholeDevice():resetView();$('#focus-device').onclick=focusDevice;$('#top-view').onclick=()=>{markCameraView('top-view');frameModel(new THREE.Vector3(0,1,.001));};$('#rotate-view').onclick=e=>{if(!controls)return;controls.autoRotate=!controls.autoRotate;const b=e.currentTarget;b.classList.toggle('active',controls.autoRotate);b.setAttribute('aria-pressed',String(controls.autoRotate));};
 for(const [id,key] of [['color-mode','color'],['wireframe','wire']])$('#'+id).onclick=e=>{state[key]=!state[key];const b=e.currentTarget;b.classList.toggle('active',state[key]);b.setAttribute('aria-pressed',String(state[key]));if(key==='animate')b.innerHTML=state.animate?'Ⅱ <span>暂停动画</span>':'▷ <span>播放动画</span>';applyMaterials();};
 $('#front-view').onclick=()=>{markCameraView('front-view');frameModel(new THREE.Vector3(0,.09,1));};
 $('#toggle-labels').classList.remove('active');$('#toggle-labels').setAttribute('aria-pressed','false');$('#toggle-labels').textContent='全部标注';$('#toggle-labels').onclick=e=>{if(state.page==='detail'){state.detailLabels=!state.detailLabels;document.body.dataset.detailLabels=String(state.detailLabels);e.currentTarget.classList.toggle('active',state.detailLabels);e.currentTarget.setAttribute('aria-pressed',String(state.detailLabels));return;}state.labelsAll=!state.labelsAll;showLabels=true;e.currentTarget.classList.toggle('active',state.labelsAll);e.currentTarget.setAttribute('aria-pressed',String(state.labelsAll));};
 $('#toggle-shadows').onclick=e=>{if(!shadowLight)return;shadowLight.castShadow=!shadowLight.castShadow;renderer.shadowMap.needsUpdate=true;e.currentTarget.classList.toggle('active',shadowLight.castShadow);e.currentTarget.setAttribute('aria-pressed',String(shadowLight.castShadow));};
 $('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器不支持全屏显示');}};$('#trend-metric').onchange=drawChart;$('#unack-only').onchange=renderAlarms;
 $('#settings').onclick=()=>{$('#data-mode').value=state.mode;$('#settings-error').textContent='';$('#settings-dialog').showModal();};$('#close-settings').onclick=()=>$('#settings-dialog').close();$('#settings-form').onsubmit=e=>{e.preventDefault();const mode=$('#data-mode').value,url=$('#ws-url').value.trim();if(mode==='live'){try{const u=new URL(url);if(!['ws:','wss:'].includes(u.protocol))throw Error();if(location.protocol==='https:'&&u.protocol!=='wss:')throw Error();}catch{$('#settings-error').textContent='请输入有效的 ws:// 或 wss:// 地址，HTTPS 页面必须使用 wss://。';return;}}switchSource(mode,url);$('#settings-dialog').close();toast(mode==='demo'?'已切换至模拟数据':'已切换至真实模式，等待网关数据');};
 $('#export').onclick=()=>{const rows=[['source','deviceId','name','timestamp',...FIELDS,'status']];for(const d of DEVICES)for(const s of state.history.get(d.id))rows.push([state.mode,d.id,d.name,new Date(s.timestamp).toISOString(),...FIELDS.map(k=>s[k]),statusOf(s,s.timestamp)]);if(rows.length===1){toast('暂无可导出的采样数据');return;}const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=CONFIG.project.filenamePrefix+'-'+state.mode+'-'+Date.now()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('已导出当前会话最近 '+CONFIG.data.historyLength+' 次采样数据');};}
window.__twin={state,ingest,statusOf,selectDevice,switchSource,motion};buildList();bindEvents();setupWorkshop(state,selectDevice,()=>{demoTick();});mountDeviceDetail(state,{back:()=>setMonitorPage('equipment'),part:inspectDevicePart,whole:showWholeDevice});mountMonitorPages(state,(id)=>selectDevice(id,true),openDeviceDetails,onMonitorPage);if(CONFIG.data.initialMode==='live')switchSource('live',CONFIG.data.wsUrl);else demoTick();initScene();setInterval(demoTick,CONFIG.data.intervalMs);setInterval(()=>{$('#clock').textContent=new Date().toLocaleString('zh-CN',{hour12:false});if(state.mode==='live')updateUI();},1000);window.addEventListener('resize',drawChart);window.addEventListener('beforeunload',()=>{connectionGeneration++;clearTimeout(reconnectTimer);ws?.close();});
