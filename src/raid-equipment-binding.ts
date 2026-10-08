/** Stable source Raid selection -> compact Cat_list. No ordinary weapon power,
 * saved numeric mirrors or implicit equipment slot may enter UI5 balance.
 * Source constants/addresses: data/raid-equipment-source.json. Helper separate.
 */
import {sourceRaidHelperActive,sourceRaidHelperGun,sourceRaidHelperStars,SOURCE_RAID_HELPER} from './r6-raid-helper';
import guns from './data/guns.json';
import source from './data/raid-equipment-source.json';
import {BigValue} from './big-value';
import {SOURCE_HUNT_CAT_CONFIG} from './hunt-cat-runtime';
import {sourceFormationOffset} from './cat-movement-source';
import {sourceRaidSelectionRefresh,type SourceRaidSelection,type SourceRaidGunRef} from './r6-raid';
import {sessionRaidModifiers,sourceRaidCatDamage,sourceRaidCatCooldown} from './raid-cat-balance';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceHuntBattleCatInput} from './hunt-battle-runtime';
export const SOURCE_RAID_EQUIPMENT=source;
export interface SourceRaidEquipmentBinding extends SourceHuntBattleCatInput {
 readonly role:'selected'|'helper';readonly selectionSlot:number|null;readonly selected:SourceRaidGunRef|null;readonly isAI:boolean;
 readonly formationOffset:{x:number;y:number;z:number};
 readonly damage:ReturnType<typeof sourceRaidCatDamage>;readonly cooldownSeconds:number;
}
export function bindSourceRaidEquipment(bundle:SourceMetaBundle,selection:SourceRaidSelection,weakType:number):SourceRaidEquipmentBinding[] {
 if(selection.length!==3)throw RangeError('Raid requires three source selection slots');
 if(!Number.isInteger(weakType)||weakType<0||weakType>6)throw RangeError('Invalid Raid weak type');
 const levels=bundle.session.bossSlotLevels??[0,0,0];
 if(levels.length!==3||levels.some(v=>!Number.isInteger(v)||v<0||v>20))throw RangeError('Invalid Raid star slots');
 const refreshed=sourceRaidSelectionRefresh(bundle.session,selection);
 for(let i=0;i<3;i++)if(selection[i]&&!refreshed[i])throw RangeError(`Raid gun identity no longer exists at selection ${i}`);
 const compact=refreshed.flatMap((selected,selectionSlot)=>selected?[{selected,selectionSlot}]:[]);
 if(!compact.length)throw RangeError('Raid requires a selected gun');
 if(new Set(compact.map(x=>x.selected.uid)).size!==compact.length)throw RangeError('Raid requires distinct stable gun identities');
 const modifiers=sessionRaidModifiers(bundle.session,bundle.meta);
 const bindings:SourceRaidEquipmentBinding[]=compact.map(({selected,selectionSlot},slotNum)=>{
  const componentID=SOURCE_HUNT_CAT_CONFIG.manager.Cat_list[slotNum].pathID;
  const cat=SOURCE_HUNT_CAT_CONFIG.cats.find(c=>c.componentID===componentID);if(!cat)throw RangeError('Unbound source Raid Cat');
  const raw=guns.guns[selected.gunID];if(!raw)throw RangeError('Unknown source Raid gun');
  const baseDamage=BigValue.from(`${raw.damage}e${raw.damageExponent}`),starLevel=levels[slotNum];
  const offset=slotNum===0?[0,0,0]:source.warpOffsets[slotNum-1];
  if(!offset)throw RangeError('Unbound source Warp offset');
  const [x,y,z]=source.catSpawnPos;
  return {role:'selected',componentID,active:true,slotNum,selectionSlot,selected:{...selected},isAI:cat.isAI,
   position:{x:Math.fround(x+offset[0]),y:Math.fround(y+offset[1]),z:Math.fround(z+offset[2])},
   formationOffset:slotNum===0?{x:0,y:0,z:0}:sourceFormationOffset(slotNum-1,2,SOURCE_HUNT_CAT_CONFIG.manager.FormationRadius),
   damage:sourceRaidCatDamage({...modifiers,baseDamage,gunType:raw.type,weakType,starLevel}),
   cooldownSeconds:sourceRaidCatCooldown({...modifiers,baseIntervalSeconds:raw.intervalSeconds}),
   gun:{gunNum:selected.gunID,baseDamage,baseIntervalSeconds:raw.intervalSeconds,starLevel,missileSpeed:raw.missileSpeed,
    generation:{type:raw.type,pelletCount:raw.pelletCount,spreadDegrees:raw.spreadDegrees,explosionRadius:raw.explosionRadius,missileExplosionRadius:raw.missileExplosionRadius,blastSniperExplosionRadius:raw.blastSniperExplosionRadius,penetratingBulletLifetime:raw.penetratingBulletLifetime}}};
 });
 if(sourceRaidHelperActive(bundle.meta.raid)){
  const gunNum=sourceRaidHelperGun(weakType),raw=guns.guns[gunNum];if(!raw)throw RangeError('Missing source helper gun');
  const componentID=SOURCE_RAID_HELPER.helperComponentID,cat=SOURCE_HUNT_CAT_CONFIG.cats.find(c=>c.componentID===componentID);
  if(!cat?.isAI)throw RangeError('Unbound source helper Cat');
  const baseDamage=BigValue.from(`${raw.damage}e${raw.damageExponent}`),starLevel=sourceRaidHelperStars(levels),[x,y,z]=source.catSpawnPos;
  const offset=SOURCE_HUNT_CAT_CONFIG.manager.Helper_FormationOffset,stored=SOURCE_RAID_HELPER.storedFormationOffset;
  // Battle is post-Warp. Do not conflate Helper_Reload's stored Cat offset with
  // manager Warp's explicit [7,0,-7] position. Follow uses Cat stored default0.
  bindings.push({role:'helper',componentID,active:true,slotNum:cat.slotNum,selectionSlot:null,selected:null,isAI:cat.isAI,
   position:{x:Math.fround(x+offset[0]),y:Math.fround(y+offset[1]),z:Math.fround(z+offset[2])},formationOffset:{x:stored[0],y:stored[1],z:stored[2]},
   damage:sourceRaidCatDamage({...modifiers,baseDamage,gunType:raw.type,weakType,starLevel}),
   cooldownSeconds:sourceRaidCatCooldown({...modifiers,baseIntervalSeconds:raw.intervalSeconds}),
   gun:{gunNum,baseDamage,baseIntervalSeconds:raw.intervalSeconds,starLevel,missileSpeed:raw.missileSpeed,
    generation:{type:raw.type,pelletCount:raw.pelletCount,spreadDegrees:raw.spreadDegrees,explosionRadius:raw.explosionRadius,missileExplosionRadius:raw.missileExplosionRadius,blastSniperExplosionRadius:raw.blastSniperExplosionRadius,penetratingBulletLifetime:raw.penetratingBulletLifetime}}});
 }
 return bindings;
}
