import {CONFIG,describeAlarm} from './config.js';
import {STATUS,statusOf} from './telemetry.js';

export function recordDeviceEvent(events,device,sample,previous,source){
 const status=statusOf(sample,sample.timestamp),alarming=['warning','fault'].includes(status);
 for(const event of events){
  if(event.deviceId!==device.id||event.resolvedAt||event.endedAt||status===event.status)continue;
  if(alarming)event.endedAt=sample.timestamp;
  else event.resolvedAt=sample.timestamp;
 }
 if(!alarming||status===previous||events.some(e=>e.deviceId===device.id&&e.status===status&&!e.resolvedAt&&!e.endedAt))return;
 const alarm=describeAlarm(sample);
 const triggers=CONFIG.metrics.filter(m=>m.alarm).filter(m=>m.alarm.direction==='low'?sample[m.key]<=m.alarm.warning:sample[m.key]>=m.alarm.warning).map(m=>({key:m.key,label:m.label,value:sample[m.key],unit:m.unit,warning:m.alarm.warning,fault:m.alarm.fault,direction:m.alarm.direction}));
 events.unshift({id:crypto.randomUUID(),deviceId:device.id,name:device.name,timestamp:sample.timestamp,status,message:alarm?.message||STATUS[status],ack:false,ackAt:null,resolvedAt:null,endedAt:null,source,snapshot:{...sample},triggers});
 events.length=Math.min(CONFIG.data.maxEvents,events.length);
}
