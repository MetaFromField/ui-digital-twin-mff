import {CONFIG} from './config.js';
import {DEVICES,demoSnapshot,currentForPower} from './telemetry.js';
import {recordDeviceEvent} from './alarm-events.js';

// Six explicit historical exercises. They never change current telemetry or its status.
export function createDemoEventHistory(now=Date.now()){
 const events=[];
 for(const fixture of CONFIG.demo.historyEvents){
  const device=DEVICES.find(d=>d.id===fixture.deviceId),index=DEVICES.indexOf(device);
  const start=now-fixture.minutesAgo*60000,end=start+fixture.durationMinutes*60000;
  const snapshot={...demoSnapshot(device,index,index,start,'normal'),...fixture.values};
  snapshot.power=+(snapshot.rpm===0?device.nominalPower*.045:device.nominalPower*(.3+snapshot.load/100*.7)).toFixed(2);
  snapshot.current=+currentForPower(snapshot.power).toFixed(1);
  recordDeviceEvent(events,device,snapshot,'normal','demo');
  const event=events[0];
  const recovery={...demoSnapshot(device,index,index,end,'normal'),...fixture.recovery};
  recovery.power=+(recovery.rpm===0?device.nominalPower*.045:device.nominalPower*(.3+recovery.load/100*.7)).toFixed(2);
  recovery.current=+currentForPower(recovery.power).toFixed(1);
  recovery.energy=+(snapshot.energy+(snapshot.power+recovery.power)/2*(end-start)/3600000).toFixed(4);
  recordDeviceEvent(events,device,recovery,event.status,'demo');
  Object.assign(event,{exercise:true,description:fixture.description,action:fixture.action,ack:true,ackAt:start+60000,recoverySnapshot:recovery});
 }
 return events.sort((a,b)=>b.timestamp-a.timestamp);
}
