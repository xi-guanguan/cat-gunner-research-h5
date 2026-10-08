/** Native helper slot/popup Reload projections, exact serialized PPtrs. */
import scene from './data/r6-raid-helper-ui.json';
import raidScene from './data/r6-raid-ui.json';
import guns from './data/guns.json';
import colors from './data/r6-gun-degree-colors.json';
import {BigValue} from './big-value';
import {sourceStarDamage} from './r6-star';
import {SOURCE_RAID_HELPER,sourceRaidHelperActive,sourceRaidHelperGun,sourceRaidHelperStars,sourceRaidHelperGate} from './r6-raid-helper';
import type {SourceRaidState} from './r6-raid';
import type {Session} from './session';
const popup=scene.find(r=>r.kind==='Raid_Helper_Purchase_Popup')!,slot=scene.find(r=>r.kind==='Raid_HelperSlot')!;
const demo=raidScene.find(r=>r.id===popup.data.Gun_Demo!.id)!;
const typeNames=['单发','激光','穿透','散弹','爆破','导弹','爆狙'];
export const sourceRaidHelperPanelBindings=SOURCE_RAID_HELPER.buttons.filter(b=>b.path.startsWith(popup.path+'/')).map(b=>({id:b.id,action:b.method==='OnClick_Purchase'?'raid-helper-purchase':'raid-helper-close'}));
export function sourceRaidHelperSlot(s:SourceRaidState,session:Session,weakType:number){
 const d=slot.data,id=sourceRaidHelperGun(weakType),gun=guns.guns[id],level=sourceRaidHelperStars(session.bossSlotLevels),weak=gun.type===weakType;
 const damage=BigValue.from(`${gun.damage}e${gun.damageExponent}`);
 return {active:{[d.Locked_obj!.id!]:!sourceRaidHelperActive(s),[d.Weak_obj!.id!]:weak,[d.Weak_Icon_obj!.id!]:weak,...Object.fromEntries(d.Degree_objs!.map((p,j)=>[p.id!,j===Math.floor(gun.sourceID/5)]))},
  text:{[d.Type_txt!.id!]:typeNames[gun.type],[d.Speed_txt!.id!]:String(Number(gun.intervalSeconds.toFixed(3))),[d.Damage_txt!.id!]:sourceStarDamage(weak?damage.nativeMultiply(10):damage,level).format(),[d.StarUpgrade_Lv_txt!.id!]:String(level)},
  textures:{[d.Gun_img!.id!]:gun.spriteURL,[d.Shadow_img!.id!]:gun.spriteURL},colors:{[d.Panel_img!.id!]:colors.colors[Math.floor(id/5)]}};
}
export function sourceRaidHelperPopup(s:SourceRaidState,weakType:number,historicMax:number,pending=false){
 const d=popup.data,v=demo.data,id=sourceRaidHelperGun(weakType),gun=guns.guns[id],owned=sourceRaidHelperActive(s);
 return {active:{[d.Purchase_obj!.id!]:owned,[d.Purchase_Btn_obj!.id!]:!owned,...Object.fromEntries(v.Degree_objs!.map((p,j)=>[p.id!,j===Math.floor(gun.sourceID/5)]))},
  text:{[v.Type_txt!.id!]:typeNames[gun.type],'level0:403':SOURCE_RAID_HELPER.defaultPrice},
  textures:{[v.Gun_img!.id!]:gun.spriteURL,[v.Shadow_img!.id!]:gun.spriteURL},colors:{[v.Panel_img!.id!]:colors.colors[Math.floor(id/5)]},reason:sourceRaidHelperGate(s,historicMax,pending)};
}
