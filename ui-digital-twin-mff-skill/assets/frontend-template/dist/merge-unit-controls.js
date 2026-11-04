import {CONFIG} from './config.js';
// Device identity and motion controls share one row to keep all seven units on screen.
export function mergeUnitControls(controller){
 const devices=document.querySelector('.devices-panel'),animations=document.querySelector('.animation-panel');
 const list=document.querySelector('#device-list');
 devices.querySelector('h3').textContent='设备监测 / 独立动画';
 devices.insertBefore(animations.querySelector('.animation-master'),list);
 for(const track of controller.tracks){
  const device=list.querySelector(`.device-row[data-id="${track.device.id}"]`);
  const unit=document.createElement('div');unit.className='unit-row';unit.dataset.unit=track.device.id;unit.hidden=device.hidden;
  list.insertBefore(unit,device);unit.append(device,track.ui.row);
  const name=track.ui.row.querySelector('.animation-name');
  for(const n of [...name.childNodes])if(n.nodeType===Node.TEXT_NODE)n.remove();
  name.setAttribute('aria-label','定位'+track.device.name+'动画');
 }
 devices.append(animations.querySelector('.mapping-note'));animations.remove();
 for(const d of CONFIG.devices){const button=list.querySelector('.device-row[data-id="'+d.id+'"]');if(button.closest('.unit-row'))continue;const unit=document.createElement('div');unit.className='unit-row';unit.hidden=button.hidden;list.insertBefore(unit,button);const note=document.createElement('span');note.className='motion-empty';note.textContent='静态部件 · 无内置动画';unit.append(button,note);}
 if(!controller.tracks.length)devices.querySelector('.animation-master').hidden=true;
 devices.querySelector('.muted').textContent=CONFIG.devices.length+' 个监测单元';
}
