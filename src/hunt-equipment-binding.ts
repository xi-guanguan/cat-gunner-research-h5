/** Cat_manager.Balance_Reload@0x2b43744 compacts equipped IDs (skips -1)
 * then assigns Gun_list to Cat_list order. SlotNum is that Cat index, not the
 * H5 source equipment position. Helper is a separate, currently unbound branch.
 */
import guns from './data/guns.json';
import socketMap from './data/hunt-socket-map-source.json';
import {SOURCE_HUNT_CAT_CONFIG} from './hunt-cat-runtime';
import {sourceGunID,type Session} from './session';
import type {SourceHuntBattleCatInput} from './hunt-battle-runtime';
export interface SourceHuntEquipmentBinding extends SourceHuntBattleCatInput {readonly equipmentSlot:number;readonly equipmentUID:string|undefined}
export function bindSourceHuntEquipment(session:Pick<Session,'equippedGuns'|'bossSlotLevels'>):SourceHuntEquipmentBinding[] {
 const levels=session.bossSlotLevels??[0,0,0];
 if(session.equippedGuns.length!==3||levels.length!==3)throw RangeError('Hunt requires three source equipment/star slots');
 for(const level of levels)if(!Number.isInteger(level)||level<0||level>20)throw RangeError('Invalid source slot star level');
 const compact=session.equippedGuns.flatMap((gun,equipmentSlot)=>gun?[{gun,equipmentSlot}]:[]);
 if(!compact.length)throw RangeError('Hunt requires an equipped gun');
 return compact.map(({gun,equipmentSlot},slotNum)=>{
  const componentID=SOURCE_HUNT_CAT_CONFIG.manager.Cat_list[slotNum].pathID,cat=SOURCE_HUNT_CAT_CONFIG.cats.find(c=>c.componentID===componentID)!;
  const gunNum=sourceGunID(gun),raw=guns.guns[gunNum];if(!raw)throw RangeError('Unknown source Hunt gun');
  const root=cat.rayTransform.chain[1].position;
  return {componentID,active:true,slotNum,equipmentSlot,equipmentUID:gun.uid,position:{x:-100+root.x,y:root.y,z:root.z},
   gun:{gunNum,baseDamage:gun.damageValue??gun.damage,baseIntervalSeconds:raw.intervalSeconds,starLevel:levels[slotNum],missileSpeed:raw.missileSpeed,
    generation:{type:raw.type,pelletCount:raw.pelletCount,spreadDegrees:raw.spreadDegrees,explosionRadius:raw.explosionRadius,missileExplosionRadius:raw.missileExplosionRadius,blastSniperExplosionRadius:raw.blastSniperExplosionRadius,penetratingBulletLifetime:raw.penetratingBulletLifetime}}};
 });
}
/** Original IDs must be mapped explicitly; no socket index or sprite-center fallback. */
export function sourceHuntCanonicalTransform(catID:number,transformID:number):number {
 const cat=socketMap.cats.find(c=>c.catComponentID===catID),id=cat&&(cat.transforms as unknown as Record<string,number>)[String(transformID)];
 if(id===undefined)throw RangeError(`Unbound Hunt Transform ${catID}:${transformID}`);return id;
}
export const SOURCE_HUNT_RIG_NODE_OVERRIDES=socketMap.cats;
