import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectModel} from './inspect-model.mjs';
const args=process.argv.slice(2),get=key=>{const i=args.indexOf(key);return i>=0?args[i+1]:undefined;};
function merge(a,b){for(const [k,v] of Object.entries(b))a[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(a[k]&&typeof a[k]==='object'?a[k]:{},v):v;return a;}
try{
 if(!get('--model')||!get('--out'))throw Error('Usage: node scaffold.mjs --model path.glb --out new-directory [--title name] [--config overrides.json]');
 const model=path.resolve(get('--model')),out=path.resolve(get('--out')),inventory=inspectModel(model);
 if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Output directory must be empty; existing projects are edited in place.');
 if(inventory.externalResources.length)throw Error('GLB has external resources. Package its textures/buffers explicitly before scaffolding.');
 const unsupported=inventory.extensionsRequired.filter(x=>!['KHR_draco_mesh_compression','KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_specular','KHR_materials_sheen','KHR_materials_unlit','KHR_materials_emissive_strength','KHR_texture_transform','KHR_lights_punctual','KHR_mesh_quantization'].includes(x));if(unsupported.length)throw Error('Required extensions need an explicit decoder / compatibility review: '+unsupported.join(', '));
 const template=fileURLToPath(new URL('../assets/frontend-template/',import.meta.url));
 const devices=[{id:'unit-01',name:'监测总成 01',code:'UNIT-01',group:'main',node:'',nodeIndex:null,nodes:inventory.nodes.map(n=>n.index),animation:inventory.animations[0]?.name||null,animations:inventory.animations.map(a=>a.name),nominalPower:22,demoRpm:120}];
 let config=JSON.parse(fs.readFileSync(path.join(template,'dist/project.config.json'),'utf8'));
 config.model.excludeNodes=inventory.nodes.filter(n=>/^skybox$/i.test(n.name)).map(n=>n.name);
 config.project.title=get('--title')||'设备数字孪生';config.devices=devices;
 config.hero={deviceId:'unit-01',key:'energy',max:1000};config.secondary={deviceId:'unit-01',key:'humidity'};
 config.workshop.warningDevice='unit-01';
 if(inventory.extensionsRequired.includes('KHR_draco_mesh_compression'))for(const name of ['DRACOLoader.js','draco/draco_decoder.wasm','draco/draco_wasm_wrapper.js'])if(!fs.existsSync(path.join(template,'dist/vendor',name)))throw Error('Missing bundled Draco decoder: '+name);
 if(get('--config'))config=merge(config,JSON.parse(fs.readFileSync(path.resolve(get('--config')),'utf8')));
 config.runMetric=config.runMetric===undefined?(config.metrics.some(m=>m.key==='rpm')?'rpm':null):config.runMetric;
 config.model.path='./assets/model.glb';config.model.sourceName=inventory.source;config.model.metadata={meshDefinitions:inventory.meshDefinitions,animationCount:inventory.animations.length};
 fs.mkdirSync(out,{recursive:true});fs.cpSync(template,out,{recursive:true,errorOnExist:true});fs.mkdirSync(path.join(out,'dist/assets'),{recursive:true});fs.copyFileSync(model,path.join(out,'dist/assets/model.glb'));fs.writeFileSync(path.join(out,'dist/project.config.json'),JSON.stringify(config,null,2));fs.writeFileSync(path.join(out,'model-inventory.json'),JSON.stringify(inventory,null,2));
 fs.writeFileSync(path.join(out,'PROJECT.md'),'# '+config.project.title+'\n\n启动：`node server.mjs`，打开 http://127.0.0.1:4173 。配置：`dist/project.config.json`。默认模拟数据，设备名称和绑定需要按项目确认。运行数据仅保存在当前会话；模型运动控制不发送物理设备控制指令。\n');
 console.log(JSON.stringify({output:out,config:path.join(out,'dist/project.config.json'),devices:config.devices.length,animations:inventory.animations.length,requiresBindingReview:true,provisionalBinding:"Single complete assembly; split devices only after inspecting hierarchy and animation channels"}));
}catch(e){console.error(e.message);process.exitCode=1;}
