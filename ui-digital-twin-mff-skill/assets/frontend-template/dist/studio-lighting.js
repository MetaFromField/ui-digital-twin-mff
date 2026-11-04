import * as THREE from 'three';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';

// Keep directional shading distinct from the broad reflections on metal.
export function createWorkshopLighting(scene,renderer,appearance){
 const light=appearance.lighting;
 const studio=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
 scene.environment=pmrem.fromScene(studio,.055).texture;
 scene.environmentIntensity=appearance.environmentIntensity;
 studio.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xeaf2ff,0x555c67,light.hemisphere));
 const key=new THREE.DirectionalLight(0xfff3e5,light.key);
 key.position.set(-11,19,12);key.castShadow=true;
 const mapSize=Math.min(light.shadowMapSize,renderer.capabilities.maxTextureSize);
 key.shadow.mapSize.set(mapSize,mapSize);
 Object.assign(key.shadow.camera,{left:-22,right:22,top:17,bottom:-17,near:.5,far:70});
 // Preserve the stable zero-height floor and acne suppression from the previous fix.
 key.shadow.bias=-.00008;key.shadow.normalBias=.008;
 key.shadow.camera.updateProjectionMatrix();scene.add(key);
 const fill=new THREE.DirectionalLight(0xdce8ff,light.fill);
 fill.position.set(12,7,-10);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xeaf1ff,light.rim);
 rim.position.set(-14,9,-8);scene.add(rim);
 return key;
}
