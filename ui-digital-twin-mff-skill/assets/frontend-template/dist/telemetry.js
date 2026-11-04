import {CONFIG,describeAlarm} from './config.js';
export const DEVICES=CONFIG.devices,FIELDS=CONFIG.metrics.map(m=>m.key);
export const COLORS={normal:'#397e67',warning:'#b97c27',fault:'#2878df',offline:'#89949d',stopped:'#677d8d'};
export const STATUS={normal:'运行正常',warning:'预警',fault:'故障',offline:'离线',stopped:'待机'};
let scenario=CONFIG.demo.initialScenario||'normal';const energy=new Map(),lastTimes=new Map(),days=new Map();
export function setScenario(next){scenario=next;}
export function getScenario(){return scenario;}
export function validateSample(s,now=Date.now()){return !!s&&DEVICES.some(d=>d.id===s.deviceId)&&Number.isFinite(s.timestamp)&&s.timestamp>=now-60000&&s.timestamp<=now+5000&&CONFIG.metrics.every(m=>Number.isFinite(s[m.key])&&s[m.key]>=m.min&&s[m.key]<=m.max);}
export function statusOf(s,now=Date.now()){if(!s||now-s.timestamp>CONFIG.data.staleMs)return 'offline';return describeAlarm(s)?.status||(s.rpm===0?'stopped':'normal');}
export function currentForPower(power){const {lineVoltage,powerFactor}=CONFIG.demo.electrical;return power*1000/(Math.sqrt(3)*lineVoltage*powerFactor);}
const midnight=now=>new Date(new Date(now).setHours(0,0,0,0)).getTime();
export function resetDemoTelemetry(){energy.clear();lastTimes.clear();days.clear();}
// Pure snapshots also generate historical exercises without changing live meter integration.
export function demoSnapshot(d,index,tick,now=Date.now(),mode=scenario){
 const scenario=mode;
 const groupIndex=Math.max(0,CONFIG.workshop.groups.findIndex(g=>g.id===d.group)),wave=Math.sin(tick*.11+index*.8),slow=Math.sin(tick*.035+groupIndex),idle=CONFIG.workshop.idleDevices.includes(d.id),fault=scenario==='alarm'&&d.id===CONFIG.workshop.faultDevice,warning=scenario==='alarm'&&d.id===CONFIG.workshop.warningDevice,saving=scenario==='saving';
 const running=!idle&&!fault,load=running?(saving?48:67)+wave*5:0,power=running?d.nominalPower*(.3+load/100*.7):d.nominalPower*.045;
 const zoneTemp=25.5+groupIndex*.7+slow*.75+(scenario==='alarm'&&d.group==='cage'?2.2:0),humidity=52+groupIndex*2.1+Math.sin(tick*.027+groupIndex)*2.4+(scenario==='alarm'&&d.group==='cage'?9:0);
 const initialEnergy=d.nominalPower*(idle?.2:.55)*(now-midnight(now))/3600000;
 const sample={deviceId:d.id,timestamp:now,rpm:running?Math.round((d.demoRpm??CONFIG.demo.rpm??120)*(saving?.8:1)+wave*4):0,motorTemp:+(fault?83.4+wave*.5:warning?67.5+wave*.5:running?43+groupIndex*3.2+load*.07+wave:33+wave*.5).toFixed(1),current:+currentForPower(power).toFixed(1),power:+power.toFixed(2),vibration:+(fault?.18:warning?4.8:running?1.1+Math.abs(wave)*.5:0).toFixed(2),energy:+initialEnergy.toFixed(4),load:+load.toFixed(1),ambientTemp:+zoneTemp.toFixed(1),humidity:+humidity.toFixed(1)};
 for(const m of CONFIG.metrics)if(!(m.key in sample))sample[m.key]=+Math.max(m.min,Math.min(m.max,(m.baseline??(m.min+m.max)/2)+wave*(m.amplitude??0))).toFixed(m.precision??1);return sample;
}
export function demoSample(d,index,tick,now=Date.now()){
 const sample=demoSnapshot(d,index,tick,now),day=midnight(now),previous=lastTimes.get(d.id);
 if(!energy.has(d.id))energy.set(d.id,sample.energy);
 else if(days.get(d.id)!==day)energy.set(d.id,sample.power*Math.max(0,now-day)/3600000);
 else energy.set(d.id,energy.get(d.id)+sample.power*Math.max(0,now-(previous??now))/3600000);
 days.set(d.id,day);lastTimes.set(d.id,now);sample.energy=+energy.get(d.id).toFixed(4);return sample;
}
