import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function inspectModel(file){
 const bytes=fs.readFileSync(file);
 if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Expected a complete glTF 2 GLB file.');
 let document;for(let offset=12;offset+8<=bytes.length;){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);if(offset+8+length>bytes.length)throw Error('Truncated GLB chunk.');if(type===0x4e4f534a)document=JSON.parse(bytes.toString('utf8',offset+8,offset+8+length).replace(/\0+$/,''));offset+=8+length;}
 if(!document)throw Error('Missing GLB JSON chunk.');
 const nodes=document.nodes||[],animations=(document.animations||[]).map((clip,index)=>({index,name:clip.name||`animation_${index}`,nodes:[...new Set(clip.channels.map(channel=>channel.target.node).filter(Number.isInteger))],targets:[...new Set(clip.channels.map(channel=>nodes[channel.target.node]?.name||`node_${channel.target.node}`))]}));
 return {source:path.basename(file),asset:document.asset,sceneRoots:document.scenes?.[document.scene||0]?.nodes||[],nodes:nodes.map((n,index)=>({index,name:n.name||`node_${index}`,mesh:n.mesh,children:n.children||[],translation:n.translation,rotation:n.rotation,scale:n.scale})),animations,meshDefinitions:document.meshes?.length||0,materials:(document.materials||[]).map((m,index)=>({index,name:m.name||`material_${index}`,pbr:m.pbrMetallicRoughness,alphaMode:m.alphaMode})),extensionsUsed:document.extensionsUsed||[],extensionsRequired:document.extensionsRequired||[],externalResources:[...(document.buffers||[]),...(document.images||[])].map(x=>x.uri).filter(u=>u&&!u.startsWith('data:'))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const at=process.argv.indexOf('--model');if(at<0||!process.argv[at+1])throw Error('Usage: node inspect-model.mjs --model path.glb');console.log(JSON.stringify(inspectModel(path.resolve(process.argv[at+1])),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
