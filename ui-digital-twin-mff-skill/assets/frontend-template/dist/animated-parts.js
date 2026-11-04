// Use glTF animation channel targets rather than naming conventions.
export function animatedNodeIndices(animations,clipNames){
 const enabled=new Set(clipNames),nodes=new Set();
 for(const clip of animations||[])if(enabled.has(clip.name))for(const channel of clip.channels||[]){
  if(Number.isInteger(channel.target?.node))nodes.add(channel.target.node);
 }
 return nodes;
}
export function animatedPartGroups(animations,clipNames){
 const clips=new Map((animations||[]).map(clip=>[clip.name,clip]));
 return clipNames.map(name=>({name,nodes:[...animatedNodeIndices(clips.has(name)?[clips.get(name)]:[],[name])]})).filter(part=>part.nodes.length);
}
