/** Serialized orthographic camera and Follow.Update position consumer.
 * Mode5 dynamic zoom is NOT_RUN. H5 reads the current leader at each projection query; this is not a proof
 * of Unity Update order, camera zoom transitions, or its renderer pipeline.
 */
import source from './data/raid-camera-source.json';
const scene=source;const follow=source.follow;
import type {SourceVector3} from './cat-movement-source';
type V=SourceVector3;type Q={x:number;y:number;z:number;w:number};
const vec=(a:number[]):V=>({x:a[0],y:a[1],z:a[2]}),q=(a:number[]):Q=>({x:a[0],y:a[1],z:a[2],w:a[3]});
export function raidRotate(q:Q,v:V):V {
 const tx=2*(q.y*v.z-q.z*v.y),ty=2*(q.z*v.x-q.x*v.z),tz=2*(q.x*v.y-q.y*v.x);
 return {x:v.x+q.w*tx+q.y*tz-q.z*ty,y:v.y+q.w*ty+q.z*tx-q.x*tz,z:v.z+q.w*tz+q.x*ty-q.y*tx};
}
const dot=(a:V,b:V)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const RAID_SCENE_CAMERA_ROTATION=q(scene.camera.chain[1].rotation);
export const RAID_SCENE_CAMERA_FORWARD=raidRotate(RAID_SCENE_CAMERA_ROTATION,{x:0,y:0,z:1});
export const RAID_SCENE_CAMERA_RIGHT=raidRotate(RAID_SCENE_CAMERA_ROTATION,{x:1,y:0,z:0});
export const RAID_SCENE_CAMERA_UP=raidRotate(RAID_SCENE_CAMERA_ROTATION,{x:0,y:1,z:0});
export const SOURCE_RAID_CAMERA_FOLLOW=follow;
const camLocal=vec(scene.camera.chain[1].position),serializedCenter=vec(scene.camera.chain[0].position);
export function sourceRaidCameraFollowPosition(cats:readonly {componentID:number;movement:{position:V}}[]):V {
 const target=cats.find(c=>c.componentID===follow.targetCatComponentID);
 if(!target)throw Error(`Missing source Raid Follow target Cat ${follow.targetCatComponentID} (Transform ${follow.targetTransformID})`);
 const p=target.movement.position;
 if(![p.x,p.y,p.z].every(Number.isFinite))throw RangeError('Invalid Raid Follow target position');
 return {...p}; // Transform.set_position copies a value, not a mutable reference.
}
/** Omitting root is only the serialized snapshot projection, never live Follow. */
export function sourceRaidSceneViewport(p:V,width:number,height:number,cameraRoot:V=serializedCenter):V {
 if(![width,height,p.x,p.y,p.z,cameraRoot.x,cameraRoot.y,cameraRoot.z].every(Number.isFinite)||!(width>0&&height>0))throw RangeError('Invalid Raid scene viewport');
 const d={x:p.x-cameraRoot.x-camLocal.x,y:p.y-cameraRoot.y-camLocal.y,z:p.z-cameraRoot.z-camLocal.z},half=scene.camera.orthographicSize;
 return {x:.5+dot(d,RAID_SCENE_CAMERA_RIGHT)/(half*2*width/height),y:.5+dot(d,RAID_SCENE_CAMERA_UP)/(half*2),z:dot(d,RAID_SCENE_CAMERA_FORWARD)};
}
