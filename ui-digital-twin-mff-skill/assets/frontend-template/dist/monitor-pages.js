import {mountMasonry} from './masonry.js';
import {CONFIG,format} from './config.js';
import {DEVICES,STATUS,statusOf} from './telemetry.js';
const $=s=>document.querySelector(s),cards=new Map(),events=new Map();
let masonry;
let state,locate,viewDevice,onPage,group='all',query='',severity='all',ack='all',alarmQuery='';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const put=(n,text)=>{if(n.textContent!==String(text))n.textContent=text;};
const stamp=t=>t?new Date(t).toLocaleString('zh-CN',{hour12:false}):'—';
const groupName=d=>CONFIG.workshop.groups.find(g=>g.id===d?.group)?.name||'未分类';
const thresholds=()=>CONFIG.metrics.filter(m=>m.alarm).map(m=>`${m.label} ${m.alarm.direction==='low'?'≤':'≥'}${m.alarm.warning}${m.unit} 预警 / ${m.alarm.fault}${m.unit} 故障`).join('；');
export function setMonitorPage(page){
 if(!state)return;const previous=state.page;state.page=page;document.body.dataset.page=page;
 document.body.classList.remove('equipment-mode','alarms-mode');
 $('.overlay-layout').hidden=page!=='overview';$('.scene-panel').hidden=!['overview','detail'].includes(page);
 $('#equipment-page').hidden=page!=='equipment';$('#alarm-center-page').hidden=page!=='alarms';
 document.querySelectorAll('[data-nav]').forEach(b=>{const selected=b.dataset.nav===page;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});
 onPage?.(page,previous);updateMonitorPages();window.dispatchEvent(new Event('resize'));
}
function focus(id){setMonitorPage('overview');locate(id);}
export function mountMonitorPages(context,onLocate,onView,onPageChange){
 state=context;locate=onLocate;viewDevice=onView;onPage=onPageChange;$('.tabs [data-nav=equipment]').textContent='设备监控';
 const equipment=el('section','app-page equipment-page');equipment.id='equipment-page';equipment.hidden=true;equipment.setAttribute('aria-label','设备监控');
 equipment.innerHTML=`<aside class="category-sidebar"><nav id="category-nav" aria-label="设备类型选择"></nav><p>设备参数每 ${CONFIG.data.intervalMs/1000} 秒更新<br>分组依据当前模型配置</p></aside><div class="equipment-main"><div class="fullpage-heading"><div><p id="equipment-page-count"></p></div><label class="page-search">⌕ <input id="card-search" type="search" placeholder="搜索设备名称、编号或节点" aria-label="搜索全部设备"></label></div><div id="equipment-card-grid" class="equipment-card-grid"></div><div id="equipment-card-empty" class="page-empty" hidden>没有符合条件的设备，请更换分类或搜索关键词。</div></div>`;
 document.body.append(equipment);
 for(const g of [{id:'all',name:'全部'},...CONFIG.workshop.groups]){const b=el('button','category-button');b.dataset.category=g.id;b.append(el('span','',g.name),el('b','category-count','0'));b.onclick=()=>{group=g.id;updateMonitorPages();$('#equipment-card-grid').scrollTop=0;};$('#category-nav').append(b);}
 $('#card-search').oninput=e=>{query=e.target.value.trim().toLowerCase();updateMonitorPages();$('#equipment-card-grid').scrollTop=0;};
 for(const d of DEVICES){
  const card=el('article','equipment-card');card.dataset.device=d.id;
  const head=el('header','equipment-card-header'),title=el('div');title.append(el('small','',groupName(d)+' · '+d.code),el('h3','',d.name));const status=el('span','card-status');head.append(title,status);
  const meta=el('div','card-meta');meta.append(el('span','',CONFIG.project.lineId+' / '+d.code),el('span','',d.node||'模型总成'));
  const metrics=el('dl','card-metrics'),values=new Map();
  for(const m of CONFIG.metrics.filter(m=>m.detail)){const cell=el('div'),value=el('b','','—');cell.append(el('dt','',m.label));const line=el('dd');line.append(value,el('small','',m.unit));cell.append(line);metrics.append(cell);values.set(m.key,value);}
  const load=el('div','card-load'),loadValue=el('b','','—'),loadTrack=el('i');const loadLabel=el('div');loadLabel.append(el('span','',CONFIG.metrics.find(m=>m.key===CONFIG.loadKey)?.label||'设备负载率'),loadValue);const track=el('div','card-load-track');track.append(loadTrack);load.append(loadLabel,track);
  const foot=el('div','card-footer'),updated=el('span'),button=el('button','card-view-button','查看设备');button.onclick=()=>viewDevice(d.id);foot.append(updated,button);
  card.append(head,meta,metrics,load,el('p','card-threshold',thresholds()),foot);$('#equipment-card-grid').append(card);cards.set(d.id,{card,status,values,loadValue,loadTrack,updated});
 }
 const alarm=el('section','app-page alarm-center-page');alarm.id='alarm-center-page';alarm.hidden=true;alarm.setAttribute('aria-label','告警中心');
 alarm.innerHTML=`<div class="fullpage-heading"><div><p>查看触发快照、阈值与事件处理记录 · 当前会话最多保留 ${CONFIG.data.maxEvents} 条</p></div><div class="alarm-statistics"><span>全部事件 <b id="center-total">0</b></span><span>未确认 <b id="center-pending">0</b></span><span>持续中 <b id="center-active">0</b></span><span>已恢复 <b id="center-recovered">0</b></span></div></div><div class="alarm-page-filters"><label>事件级别 <select id="center-severity"><option value="all">全部级别</option><option value="warning">预警</option><option value="fault">故障</option></select></label><label>处理状态 <select id="center-ack"><option value="all">全部状态</option><option value="pending">未确认</option><option value="ack">已确认</option><option value="active">持续中</option><option value="recovered">已恢复</option></select></label><label class="page-search">⌕ <input id="alarm-search" type="search" placeholder="搜索设备、编号或告警内容" aria-label="搜索告警事件"></label><span id="center-filter-count"></span></div><div id="center-event-list" class="center-event-list"></div><div id="center-event-empty" class="page-empty"><span class="empty-symbol">✓</span><h3>暂无告警事件</h3><p>常规生产下没有触发阈值告警。可在右上角切换“异常演示”查看事件详情。</p></div>`;
 document.body.append(alarm);masonry=mountMasonry($('#center-event-list'));
 $('#center-severity').onchange=e=>{severity=e.target.value;updateMonitorPages();};$('#center-ack').onchange=e=>{ack=e.target.value;updateMonitorPages();};$('#alarm-search').oninput=e=>{alarmQuery=e.target.value.trim().toLowerCase();updateMonitorPages();};
 document.querySelectorAll('[data-nav]').forEach(b=>{b.onclick=()=>setMonitorPage(b.dataset.nav);b.setAttribute('role','tab');});$('.tabs').setAttribute('role','tablist');setMonitorPage('overview');
}
function createEvent(event){
 const d=DEVICES.find(d=>d.id===event.deviceId),row=el('article','center-event');row.dataset.event=event.id;
 const header=el('div','event-heading'),level=el('span','event-severity '+event.status,STATUS[event.status]);const title=el('div','event-title');title.append(el('h3','',event.name+' · '+(d?.code||event.deviceId)),el('p','',groupName(d)+' / '+CONFIG.project.lineId+' · '+stamp(event.timestamp)));
 const progress=el('span','event-progress'),ackButton=el('button','event-ack','确认事件'),locateButton=el('button','page-link','三维定位 ↗');
 ackButton.onclick=()=>{event.ack=true;event.ackAt=Date.now();updateMonitorPages();$('#unack-only').dispatchEvent(new Event('change'));};locateButton.onclick=()=>focus(event.deviceId);header.append(level,title,progress,ackButton,locateButton);
 const details=el('details','event-details');details.open=true;details.append(el('summary','','告警详情与触发参数'));
 const triggers=el('div','event-triggers');for(const t of event.triggers||[]){const mark=t.direction==='low'?'≤':'≥',m=CONFIG.metrics.find(m=>m.key===t.key);triggers.append(el('p','',`${t.label}：触发值 ${format(t.value,m)} ${t.unit} · 预警阈值 ${mark}${t.warning} ${t.unit} · 故障阈值 ${mark}${t.fault} ${t.unit}`));}if(!triggers.childNodes.length)triggers.append(el('p','',event.message));
 if(event.exercise){triggers.prepend(el('p','event-exercise','模拟历史演练 · '+event.description));triggers.append(el('p','',event.action));const r=event.recoverySnapshot;triggers.append(el('p','',`恢复采样：${stamp(r.timestamp)} · 转速 ${r.rpm} rpm · 温度 ${r.motorTemp} °C · 振动 ${r.vibration} mm/s`));}
 const snapshot=el('div','event-snapshot');for(const m of CONFIG.metrics.filter(m=>m.detail||m.key===CONFIG.loadKey)){const field=el('span');field.append(el('small','',m.label),el('b','',format(event.snapshot?.[m.key],m)+' '+m.unit));snapshot.append(field);}
 const record=el('div','event-record');record.append(el('span','','事件 ID：'+event.id),el('span','','数据来源：'+(event.source==='live'?'真实遥测':event.exercise?'模拟历史演练':'动态模拟')));const ackAt=el('span'),resolvedAt=el('span');record.append(ackAt,resolvedAt);details.append(triggers,snapshot,record);row.append(header,details);return {row,progress,ackButton,ackAt,resolvedAt};
}
export function updateMonitorPages(){
 if(!state)return;
 let visible=0;
 for(const d of DEVICES){const item=cards.get(d.id),sample=state.samples.get(d.id),status=statusOf(sample),online=status!=='offline';
  item.card.dataset.status=status;put(item.status,STATUS[status]);
  for(const [key,node]of item.values)put(node,online?format(sample[key],CONFIG.metrics.find(m=>m.key===key)):'—');
  const load=CONFIG.metrics.find(m=>m.key===CONFIG.loadKey);put(item.loadValue,online?format(sample?.[CONFIG.loadKey],load)+(load?.unit||''):'—');item.loadTrack.style.width=online?Math.max(0,Math.min(100,sample?.[CONFIG.loadKey]||0))+'%':'0%';
  put(item.updated,sample?new Date(sample.timestamp).toLocaleTimeString('zh-CN',{hour12:false})+(online?' 更新':' · 数据已过期'):'等待采样');
  const match=(group==='all'||group===d.group)&&(!query||`${d.name} ${d.code} ${d.node}`.toLowerCase().includes(query));item.card.hidden=!match;if(match)visible++;
 }

 put($('#equipment-page-count'),`${visible} 台设备 · 参数与运行总览同步 · ${state.mode==='demo'?'动态模拟数据':'真实遥测数据'}`);$('#equipment-card-empty').hidden=visible>0;
 document.querySelectorAll('[data-category]').forEach(b=>{const id=b.dataset.category,selected=id===group;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));put(b.querySelector('b'),id==='all'?DEVICES.length:DEVICES.filter(d=>d.group===id).length);});
 const ids=new Set(state.events.map(e=>e.id));for(const [id,item]of events)if(!ids.has(id)){masonry.forget(item.row);item.row.remove();events.delete(id);}
 let matches=0;
 // Reverse creation order and prepend preserves newest-first without replacing live controls.
 for(const event of [...state.events].reverse()){
  if(!events.has(event.id)){const item=createEvent(event);events.set(event.id,item);$('#center-event-list').prepend(item.row);masonry.observe(item.row);}
  const item=events.get(event.id),d=DEVICES.find(d=>d.id===event.deviceId),current=statusOf(state.samples.get(event.deviceId));
  const active=!event.resolvedAt&&!event.endedAt&&current!=='offline';put(item.progress,event.resolvedAt?'已恢复':event.endedAt?'级别已变化':current==='offline'?'通信离线 · 待核实':'持续中');
  item.progress.dataset.active=String(active);item.ackButton.disabled=event.ack;put(item.ackButton,event.ack?'已确认':'确认事件');put(item.ackAt,'确认时间：'+(event.ack?stamp(event.ackAt):'尚未确认'));put(item.resolvedAt,event.endedAt?'级别变化时间：'+stamp(event.endedAt):'恢复时间：'+(event.resolvedAt?stamp(event.resolvedAt):'尚未恢复'));
  const match=(severity==='all'||event.status===severity)&&(ack==='all'||ack==='ack'&&event.ack||ack==='pending'&&!event.ack||ack==='active'&&active||ack==='recovered'&&!!event.resolvedAt)&&(!alarmQuery||`${event.name} ${d?.code} ${event.message} ${(event.triggers||[]).map(t=>t.label).join(' ')}`.toLowerCase().includes(alarmQuery));item.row.hidden=!match;if(match)matches++;
 }
 put($('#center-total'),state.events.length);put($('#center-pending'),state.events.filter(e=>!e.ack).length);put($('#center-active'),state.events.filter(e=>!e.resolvedAt&&!e.endedAt&&statusOf(state.samples.get(e.deviceId))!=='offline').length);put($('#center-recovered'),state.events.filter(e=>e.resolvedAt).length);put($('#center-filter-count'),`显示 ${matches} / ${state.events.length} 条事件`);$('#center-event-empty').hidden=matches>0;$('#center-event-list').hidden=matches===0;if(state.page==='alarms')masonry.schedule();
 const empty=$('#center-event-empty');empty.querySelector('h3').textContent=state.events.length?'没有符合筛选条件的事件':'暂无告警事件';empty.querySelector('p').textContent=state.events.length?'请调整级别、处理状态或搜索关键词。':'常规生产下没有触发阈值告警。可在右上角切换“异常演示”查看事件详情。';
}
