/** Original mode5 sprite identities/full leaf-to-root TRS. H5 affine quads are
 * not Unity tight-mesh/material/Animator parity. Map/selected skin activation is
 * explicit; never render all five serialized skin alternatives simultaneously. */
import source from './data/raid-scene-source.json';
import {raidRotate} from './raid-camera-follow';
import type {SourceVector3} from './cat-movement-source';
export const SOURCE_RAID_SCENE=source;
export type SourceRaidTransformChain=typeof source.objects[number]['transformChain'];
export function sourceRaidChainPoint(chain:SourceRaidTransformChain,point:SourceVector3):SourceVector3 {
 let p={...point};
 for(const t of chain){const [x,y,z,w]=t.rotation;p=raidRotate({x,y,z,w},{x:p.x*t.scale[0],y:p.y*t.scale[1],z:p.z*t.scale[2]});p={x:p.x+t.position[0],y:p.y+t.position[1],z:p.z+t.position[2]};}
 return p;
}
export function sourceRaidScenePieces(skinIndex:number){
 if(!Number.isInteger(skinIndex)||skinIndex<0||skinIndex>=source.boss.skinObjectIDs.length)throw RangeError('Invalid source Raid skin index');
 return source.objects.flatMap(object=>object.renderers.filter(r=>r.enabled).map(renderer=>({object,renderer})))
  .filter(({object})=>object.path==='/Raid_manager/Map_obj/Ground (1)'||object.path.startsWith(`/Raid_manager/Map_obj/RaidBoss/Bounce/${skinIndex}/`))
  .sort((a,b)=>a.renderer.sortingOrder-b.renderer.sortingOrder);
}
