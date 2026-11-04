// Retain authored visibility so returning to the workshop restores the exact model.
export function isolateDeviceMeshes(meshes,deviceId){
 let visible=0;
 for(const mesh of meshes){
  if(mesh.userData.workshopVisible===undefined)mesh.userData.workshopVisible=mesh.visible;
  mesh.visible=mesh.userData.workshopVisible&&(deviceId===null||mesh.userData.deviceId===deviceId);
  if(mesh.visible)visible++;
 }
 return visible;
}
