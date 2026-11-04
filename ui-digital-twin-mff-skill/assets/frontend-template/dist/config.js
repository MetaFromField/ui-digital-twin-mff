const response=await fetch('./project.config.json');if(!response.ok)throw Error('无法加载 project.config.json');
export const CONFIG=await response.json();
export const metric=key=>CONFIG.metrics.find(m=>m.key===key);
export const format=(value,m)=>Number.isFinite(value)?value.toFixed(m?.precision??1):'—';
export function describeAlarm(sample){const results=[];for(const m of CONFIG.metrics){if(!m.alarm||!Number.isFinite(sample?.[m.key]))continue;const a=m.alarm,v=sample[m.key],fault=a.direction==='low'?v<=a.fault:v>=a.fault,warning=a.direction==='low'?v<=a.warning:v>=a.warning;if(fault||warning)results.push({status:fault?'fault':'warning',message:`${m.label} ${format(v,m)} ${m.unit}`});}return results.find(r=>r.status==='fault')||results[0]||null;}
export function configureUI(){
 const $=s=>document.querySelector(s),text=(s,v)=>{const e=$(s);if(e)e.textContent=v;};const p=CONFIG.project,a=CONFIG.appearance;
 document.title=p.title;document.body.style.background=a.background;$('#viewport').style.background=a.background;document.documentElement.style.setProperty('--accent',a.accent);document.documentElement.style.setProperty('--frost-tint',`${parseInt(a.background.slice(1,3),16)},${parseInt(a.background.slice(3,5),16)},${parseInt(a.background.slice(5,7),16)}`);document.documentElement.style.setProperty('--frost-opacity',a.frostOpacity);document.documentElement.style.setProperty('--frost-blur',a.blurPx+'px');document.documentElement.style.setProperty('--frost-saturation',a.saturation);document.documentElement.style.setProperty('--frost-contrast',a.contrast);
 const brand=p.brand==='DIGITAL TWIN'?p.brand:p.brand+' / DIGITAL TWIN';text('.heading h1',p.title);text('.eyebrow',brand);text('.brand-subtitle',`${p.lineId} / ${p.site} / ${p.subtitle}`);text('#page-title',p.subtitle);text('#page-description','设备状态与模型联动监控');text('#select-line','⌄　'+p.lineId+' '+p.subtitle);text('.section-kicker','PRODUCTION OVERVIEW');
 text('.devices-panel .muted',`${CONFIG.devices.length} 个监测单元`);text('.model-info p',`${CONFIG.model.metadata.meshDefinitions} 网格定义 · ${CONFIG.model.metadata.animationCount} 段动画`);text('.scene-bottom>p',CONFIG.model.sourceName);text('footer>span:last-child',brand);
 const hero=metric(CONFIG.hero.key),secondary=metric(CONFIG.secondary.key),device=CONFIG.devices.find(d=>d.id===CONFIG.hero.deviceId);
 const unit=$('.hero-unit');unit.replaceChildren(document.createTextNode(hero.unit),document.createElement('br'));const b=document.createElement('b');b.textContent=hero.label;unit.append(b);
 const scale=$('.scale-labels');scale.children[1].textContent=device.name;scale.children[2].textContent=CONFIG.hero.max+' '+hero.unit;
 const secondaryArticle=$('#speed').closest('article');secondaryArticle.querySelector('.kpi-label').textContent=secondary.label;secondaryArticle.querySelector('small').textContent=secondary.unit;secondaryArticle.querySelector('.kpi-foot').textContent='监测点 · '+CONFIG.devices.find(d=>d.id===CONFIG.secondary.deviceId).name;
 const metrics=$('.metrics');metrics.replaceChildren();for(const m of CONFIG.metrics.filter(m=>m.detail)){const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b'),u=document.createElement('small');label.textContent=m.label;value.id='detail-'+m.key;value.textContent='—';u.textContent=m.unit;row.append(label,value,u);metrics.append(row);}
 const select=$('#trend-metric');select.replaceChildren();for(const m of CONFIG.metrics.filter(m=>m.trend)){const o=document.createElement('option');o.value=m.key;o.textContent=m.label+' · '+m.unit;select.append(o);}
 text('.threshold-note',CONFIG.metrics.filter(m=>m.alarm).map(m=>`${m.label} ${m.alarm.direction==='low'?'≤':'≥'}${m.alarm.warning}${m.unit} 预警 / ${m.alarm.fault}${m.unit} 故障`).join('；')||'未配置阈值告警');
 if(CONFIG.loadKey){text('.load-label>span',metric(CONFIG.loadKey).label);}else{$('.load-label').hidden=true;$('.load-bar').hidden=true;}
 $('#ws-url').value=CONFIG.data.wsUrl||'';
 text('#settings-dialog .schema-note','遥测消息包含 deviceId、当前毫秒 timestamp 和全部配置指标：'+CONFIG.metrics.map(m=>m.key).join('、')+'。数据超时标记离线；本页面不发送物理设备控制命令。');
}
