import {CONFIG,format} from './config.js';
import {DEVICES,STATUS,statusOf} from './telemetry.js';
const $=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const put=(node,value)=>{if(node.textContent!==String(value))node.textContent=value;};
let state,api,animation,camera,animationSlot,cameraSlot,partNodes=[],facts={},activePart=null;
const values=new Map(),statistics=new Map();
export function mountDeviceDetail(context,actions){
 state=context;api=actions;
 const page=el('section','device-detail-page');page.id='device-detail-page';page.hidden=true;page.setAttribute('aria-label','设备详情');
 page.innerHTML=`<aside class="detail-inspector detail-controls"><div class="inspector-scroll"><div class="inspector-identity"><span class="page-eyebrow">DEVICE INSPECTOR</span><h2 id="inspector-name"></h2><p id="inspector-code"></p></div><div id="detail-motion-slot"></div><section class="part-panel"><div class="inspector-section-title"><h3>设备部件</h3><button id="detail-whole" class="page-link">查看整机</button></div><p class="detail-hint">仅列出带原生动画的部件，点击近距离查看。</p><div id="detail-parts"></div><div class="part-information"><span>当前查看</span><b id="inspected-part">整台设备</b><p id="inspected-part-meta">可旋转、缩放查看设备结构</p></div></section></div></aside><div class="detail-model-hint"><span>单设备视图</span><p>拖动旋转 · 滚轮缩放 · 点击部件近看</p></div><aside class="detail-inspector detail-information"><div class="inspector-scroll"><div class="inspector-section-title"><h2>设备详情</h2><span id="inspector-status" class="card-status"></span></div><dl id="inspector-identification" class="inspector-properties"></dl><section><div class="inspector-section-title"><h3>实时运行参数</h3><span id="inspector-updated"></span></div><dl id="inspector-metrics" class="inspector-metrics"></dl></section><section><div class="inspector-section-title"><h3>最近采样统计</h3><span id="inspector-history-count"></span></div><div class="statistics-table"><div class="statistics-header"><span>指标</span><span>最低</span><span>平均</span><span>最高</span></div><div id="inspector-statistics"></div></div><p class="detail-hint">统计使用当前会话有效采样，不代表班次报表。</p></section><section><h3>阈值与当前判定</h3><div id="inspector-thresholds"></div></section><section><div class="inspector-section-title"><h3>相关告警事件</h3><span id="inspector-event-count"></span></div><div id="inspector-events"></div></section><section><h3>模型与数据接入</h3><dl id="inspector-model-info" class="inspector-properties"></dl></section></div><div id="detail-camera-slot" class="detail-camera-dock"></div></aside>`;
 document.body.append(page);
 const back=el('button','back-equipment','← 返回设备列表');back.id='back-equipment';back.onclick=actions.back;$('.topnav').append(back);
 animation=$('.animation-panel');camera=$('.camera-panel');animationSlot=document.createComment('overview-motion');cameraSlot=document.createComment('overview-camera');animation.before(animationSlot);camera.before(cameraSlot);
 for(const m of CONFIG.metrics){const cell=el('div'),value=el('b','','—');cell.dataset.metric=m.key;cell.append(el('dt','',m.label));const data=el('dd');data.append(value,el('small','',m.unit));cell.append(data);$('#inspector-metrics').append(cell);values.set(m.key,value);}
 for(const key of ['rpm','motorTemp','power','vibration']){const metric=CONFIG.metrics.find(m=>m.key===key);if(!metric)continue;const row=el('div','statistics-row');row.append(el('span','',metric.label+' / '+metric.unit));const cells=[el('b'),el('b'),el('b')];row.append(...cells);$('#inspector-statistics').append(row);statistics.set(key,cells);}
 $('#detail-whole').onclick=()=>api.whole();
}
export function syncDeviceDetail(page){
 const detail=page==='detail';$('#device-detail-page').hidden=!detail;
 $('.tabs').hidden=detail;$('#back-equipment').hidden=!detail;
 if(detail){$('#detail-motion-slot').append(animation);$('#detail-camera-slot').append(camera);}
 else{animationSlot.after(animation);cameraSlot.after(camera);}
 updateDeviceDetail();
}
function properties(target,entries){const list=$(target);list.replaceChildren();for(const [label,value]of entries){const item=el('div');item.append(el('dt','',label),el('dd','',String(value)));list.append(item);}}
export function setDetailModel(nextFacts,parts){
 facts=nextFacts;partNodes=parts;activePart=null;$('#detail-parts').replaceChildren();
 for(const part of parts){const button=el('button','detail-part');button.dataset.part=part.key;button.append(el('span','',part.label),el('small','',part.meshCount+' 网格'));button.title=part.name;button.onclick=()=>api.part(part.key);$('#detail-parts').append(button);}
 if(!parts.length)$('#detail-parts').append(el('p','detail-hint','本设备没有内置动画部件。'));
 setInspectedPart(null);updateDeviceDetail();
}
export function setInspectedPart(part){activePart=part;put($('#inspected-part'),part?.label||'整台设备');put($('#inspected-part-meta'),part?`${part.name} · ${part.meshCount} 个网格 · 可继续旋转或缩放`:'可旋转、缩放查看设备结构');document.querySelectorAll('.detail-part').forEach(b=>{const selected=part?.key===b.dataset.part;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}
export function updateDeviceDetail(){
 if(!state||state.page!=='detail')return;
 const d=DEVICES.find(d=>d.id===state.selected),sample=state.samples.get(d.id),status=statusOf(sample),online=status!=='offline',history=state.history.get(d.id)||[],valid=history.filter(s=>Number.isFinite(s.timestamp));
 put($('#inspector-name'),d.name);put($('#inspector-code'),`${d.code} · ${CONFIG.workshop.groups.find(g=>g.id===d.group)?.name||d.group}`);put($('#inspector-status'),STATUS[status]);$('#device-detail-page').dataset.status=status;
 properties('#inspector-identification',[['设备编号',d.code],['所属车间',CONFIG.project.site+' / '+CONFIG.project.lineId],['设备类别',CONFIG.workshop.groups.find(g=>g.id===d.group)?.name||d.group],['监测单元 ID',d.id],['数据来源',state.mode==='demo'?'动态模拟数据':state.sourceState],['采样周期',CONFIG.data.intervalMs/1000+' 秒'],['数据时效',sample?(online?'有效 · ':'已过期 · ')+Math.max(0,Math.floor((Date.now()-sample.timestamp)/1000))+' 秒前采样':'等待采样']]);
 put($('#inspector-updated'),sample?new Date(sample.timestamp).toLocaleTimeString('zh-CN',{hour12:false})+' 更新':'等待采样');
 for(const m of CONFIG.metrics)put(values.get(m.key),online?format(sample[m.key],m):'—');
 put($('#inspector-history-count'),valid.length+' / '+CONFIG.data.historyLength+' 次');
 for(const [key,cells]of statistics){const m=CONFIG.metrics.find(m=>m.key===key),numbers=valid.map(s=>s[key]).filter(Number.isFinite);const result=numbers.length?[Math.min(...numbers),numbers.reduce((a,b)=>a+b,0)/numbers.length,Math.max(...numbers)]:[NaN,NaN,NaN];cells.forEach((cell,i)=>put(cell,format(result[i],m)));}
 const thresholds=$('#inspector-thresholds');thresholds.replaceChildren();for(const m of CONFIG.metrics.filter(m=>m.alarm)){const box=el('div','inspector-threshold');box.append(el('b','',m.label));const sign=m.alarm.direction==='low'?'≤':'≥';box.append(el('p','',`预警 ${sign}${m.alarm.warning} ${m.unit} · 故障 ${sign}${m.alarm.fault} ${m.unit}`));const v=sample?.[m.key],fault=m.alarm.direction==='low'?v<=m.alarm.fault:v>=m.alarm.fault,warn=m.alarm.direction==='low'?v<=m.alarm.warning:v>=m.alarm.warning;box.append(el('small','',!online?'无有效数据':`当前 ${format(v,m)} ${m.unit} · ${fault?'故障越限':warn?'预警越限':'未越限'}`));thresholds.append(box);}
 const related=state.events.filter(e=>e.deviceId===d.id);put($('#inspector-event-count'),related.length+' 条');const eventBox=$('#inspector-events');eventBox.replaceChildren();for(const event of related){const item=el('div','inspector-event');item.append(el('b','',event.message),el('p','',new Date(event.timestamp).toLocaleString('zh-CN',{hour12:false})+' · '+(event.resolvedAt?'已恢复':event.endedAt?'级别已变化':'持续中')+' · '+(event.ack?'已确认':'未确认')));eventBox.append(item);}if(!related.length)eventBox.append(el('p','detail-hint','本设备当前会话暂无告警事件。'));
 properties('#inspector-model-info',[['模型节点',d.node||'—'],['源模型',CONFIG.model.sourceName],['绑定节点',d.nodes.length+' 个'],['本机渲染网格',facts.meshCount??'加载中'],['三角面',facts.triangles?.toLocaleString()??'加载中'],['原生动画',d.animations.length+' 段'],['动画部件',partNodes.length+' 组'],['包围尺寸 / 场景单位',facts.size?.join(' × ')||'加载中'],['设备额定功率 / 演示配置',d.nominalPower+' kW'],['当前有效样本',valid.length+' 条'],['离线判定',CONFIG.data.staleMs/1000+' 秒无新数据'],['操作说明','动画与部件查看为本地演示，不下发设备指令']]);
}
