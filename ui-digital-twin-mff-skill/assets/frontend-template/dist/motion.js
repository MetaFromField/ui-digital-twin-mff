// 每个轨道持有独立 AnimationAction，暂停其他轨道不会重置它的相位。
export class MotionController {
 constructor(){this.tracks=[];}
 add(action,device){const track={action,device,running:true,speed:1};action.play();this.tracks.push(track);return track;}
 toggle(track){track.running=!track.running;track.action.paused=!track.running;}
 setAll(running){for(const track of this.tracks){track.running=running;track.action.paused=!running;}}
 reset(track){const running=track.running;track.action.reset().play();track.action.paused=!running;track.action.timeScale=track.speed;}
 seek(track,fraction){track.action.time=Math.max(0,Math.min(.999999,fraction))*track.action.getClip().duration;}
 speed(track,value){track.speed=value;track.action.timeScale=value;}
 get running(){return this.tracks.some(track=>track.running);}
}
export function mountMotionControls(controller,selectDevice){
 const list=document.querySelector('#animation-list');list.replaceChildren();
 for(const [index,track] of controller.tracks.entries()){
  const row=document.createElement('div');row.className='animation-row';row.dataset.device=track.device.id;
  row.innerHTML=`<button class="animation-name"><small>TRACK ${String(index+1).padStart(2,'0')} · ${track.action.getClip().duration.toFixed(2)} SEC</small></button><button class="clip-toggle active" aria-label="暂停${track.device.name}" aria-pressed="true">Ⅱ</button><button class="clip-reset" aria-label="复位${track.device.name}">↺</button><div class="animation-timeline"><input class="clip-progress" type="range" min="0" max="1000" step="1" value="0" aria-label="${track.device.name}动画进度"><span class="clip-time">0.00 s</span><select class="clip-speed" aria-label="${track.device.name}播放速度"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div>`;
  const toggle=row.querySelector('.clip-toggle'),range=row.querySelector('.clip-progress');
  track.ui={row,toggle,range,time:row.querySelector('.clip-time'),dragging:false};
  row.querySelector('.animation-name').onclick=()=>selectDevice(track.device.id,true);
  toggle.onclick=()=>{controller.toggle(track);sync();};
  row.querySelector('.clip-reset').onclick=()=>{controller.reset(track);track.action.getMixer().update(0);tick();};
  range.addEventListener('pointerdown',()=>track.ui.dragging=true);range.addEventListener('pointerup',()=>track.ui.dragging=false);range.addEventListener('blur',()=>track.ui.dragging=false);
  range.oninput=()=>{if(track.running)controller.toggle(track);controller.seek(track,Number(range.value)/1000);track.action.getMixer().update(0);sync();tick();};
  row.querySelector('.clip-speed').onchange=e=>controller.speed(track,Number(e.target.value));list.append(row);
 }
 function sync(){for(const t of controller.tracks){t.ui.toggle.textContent=t.running?'Ⅱ':'▷';t.ui.toggle.classList.toggle('active',t.running);t.ui.toggle.setAttribute('aria-pressed',String(t.running));t.ui.toggle.setAttribute('aria-label',(t.running?'暂停':'播放')+t.device.name);}const running=controller.running;const master=document.querySelector('#animation');master.classList.toggle('active',running);master.setAttribute('aria-pressed',String(running));master.innerHTML=running?'Ⅱ <span>暂停全部</span>':'▷ <span>播放全部</span>';}
 function tick(){for(const t of controller.tracks){if(!t.ui.dragging)t.ui.range.value=String(t.action.time/t.action.getClip().duration*1000);t.ui.time.textContent=t.action.time.toFixed(2)+' s';}}
 document.querySelector('#animation').onclick=()=>{controller.setAll(!controller.running);sync();};document.querySelector('#reset-animations').onclick=()=>{for(const t of controller.tracks)controller.reset(t);controller.tracks[0]?.action.getMixer().update(0);tick();};sync();return tick;
}
