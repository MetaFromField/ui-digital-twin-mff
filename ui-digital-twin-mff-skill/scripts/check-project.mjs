import {inspectModel} from './inspect-model.mjs';
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
try{const root=path.resolve(process.argv[2]||'.'),config=JSON.parse(fs.readFileSync(path.join(root,'dist/project.config.json'),'utf8'));const ids=new Set();for(const d of config.devices){if(!/^[a-zA-Z0-9_-]+$/.test(d.id)||ids.has(d.id))throw Error('Device IDs must be unique selector-safe identifiers.');ids.add(d.id);}if(!ids.size)throw Error('No monitored devices.');const keys=new Set();for(const m of config.metrics){if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(m.key)||keys.has(m.key)||!Number.isFinite(m.min)||!Number.isFinite(m.max)||m.min>=m.max)throw Error('Invalid or duplicate metric '+m.key);keys.add(m.key);}if(!config.metrics.some(m=>m.detail)||!config.metrics.some(m=>m.trend))throw Error('At least one detail and trend metric is required.');for(const point of [config.hero,config.secondary])if(!ids.has(point.deviceId)||!keys.has(point.key))throw Error('Invalid KPI binding.');if(config.loadKey&&!keys.has(config.loadKey))throw Error('Invalid load metric.');
 const model=path.resolve(root,'dist',config.model.path);if(!model.startsWith(path.resolve(root,'dist')+path.sep)||!fs.existsSync(model))throw Error('Missing / unsafe model path.');
 const inspected=inspectModel(model);if(inspected.extensionsRequired.includes('KHR_draco_mesh_compression'))for(const name of ['DRACOLoader.js','draco/draco_decoder.wasm','draco/draco_wasm_wrapper.js'])if(!fs.existsSync(path.join(root,'dist/vendor',name)))throw Error('Missing local Draco decoder '+name);
 const inventory=inspected,clips=new Map(inventory.animations.map(a=>[a.name,a])),assigned=new Set();
 for(const d of config.devices){if(!Array.isArray(d.nodes)||!Array.isArray(d.animations)||!Number.isFinite(d.nominalPower)||d.nominalPower<=0)throw Error('Missing device bindings / demo power for '+d.id);
  if(d.nodes.some(i=>!inventory.nodes[i]))throw Error('Unknown node in '+d.id);
  const owned=new Set(d.nodes);const add=i=>{owned.add(i);for(const child of inventory.nodes[i]?.children||[])add(child);};for(const i of d.nodes)add(i);
  for(const name of d.animations){if(!clips.has(name)||assigned.has(name))throw Error('Unknown or duplicate animation '+name);assigned.add(name);if(clips.get(name).nodes.some(i=>!owned.has(i)))throw Error('Animation target missing from '+d.id);}
 }
 if(assigned.size!==clips.size)throw Error('Some original animations are not assigned to a device');
 for(const id of [config.workshop.warningDevice,config.workshop.faultDevice,...config.workshop.idleDevices])if(id&&!ids.has(id))throw Error('Scenario references unknown device '+id);
 for(const file of fs.readdirSync(path.join(root,'dist')).filter(x=>x.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',path.join(root,'dist',file)],{encoding:'utf8'});if(r.status!==0)throw Error(file+': '+r.stderr);}
 for(const file of fs.readdirSync(path.join(root,'dist')).filter(x=>x.endsWith('.css'))){const css=fs.readFileSync(path.join(root,'dist',file),'utf8');for(const match of css.matchAll(/font-size:\s*([\d.]+)px/g))if(+match[1]<11)throw Error(file+' has a font below 11px');}
 const source=fs.readFileSync(path.join(root,'dist/app.js'),'utf8');if(/ctx\.font=['"](?:[0-9]|10)px/.test(source))throw Error('Canvas text below 11px.');
 console.log(JSON.stringify({ok:true,devices:ids.size,metrics:keys.size,mode:config.data.initialMode,note:'Browser verification at both target resolutions is still required.'}));
}catch(e){console.error(e.message);process.exitCode=1;}
