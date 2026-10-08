/** Pure source Reload projection; popup/HUD IDs are serialized PPtrs, not
 * guessed assets. Native percent uses floor(float32(fill*100)). */
import scene from './data/r6-raid-star-pig-ui.json';
import {SOURCE_RAID_STAR_PIG,sourceRaidStarPigView,sourceRaidStarPigGate,type SourceRaidStarPigState} from './r6-raid-star-pig';
const popup=scene.find(r=>r.kind==='StarGem_Pig_UI')!,hud=scene.find(r=>r.kind==='StarGem_Pig_HUD')!;
const format=(value:string,...args:(number|string)[])=>value.replace(/\{(\d+)\}/g,(_,i)=>String(args[Number(i)]));
export const sourceRaidStarPigPanelBindings=[{id:'level0:2176',action:'raid-star-pig-close'},{id:'level0:1883',action:'raid-star-pig-close'},{id:'level0:1220',action:'raid-star-pig-purchase'}] as const;
export function sourceRaidStarPigHUD(s:SourceRaidStarPigState){
 const v=sourceRaidStarPigView(s),d=hud.data;
 return {text:{[d.Percent_txt!.id!]:format(SOURCE_RAID_STAR_PIG.textFormats.percent,Math.floor(Math.fround(v.fill*100)))},fills:{[d.Gem_Fill!.id!]:v.fill},active:{[d.Glow_obj!.id!]:v.purchasable}};
}
export function sourceRaidStarPigPopup(s:SourceRaidStarPigState,historicMax:number,pending=false){
 const v=sourceRaidStarPigView(s),d=popup.data;
 return {text:{[d.Lv_txt!.id!]:format(SOURCE_RAID_STAR_PIG.textFormats.level,s.lv),[d.GemCount_txt!.id!]:format(SOURCE_RAID_STAR_PIG.textFormats.count,v.gemNow,v.capacity),[d.Price_txt!.id!]:v.defaultPrice,[d.Sale_Value_txt!.id!]:format(SOURCE_RAID_STAR_PIG.textFormats.sale,v.salePercent)},fills:{[d.Gem_Fill!.id!]:v.fill},active:{[d.Purchase_Btn_obj!.id!]:!v.soldOut,[d.SoldOut_obj!.id!]:v.soldOut,[d.Sale_obj!.id!]:v.purchasable,[d.Locked_obj!.id!]:!v.purchasable},reason:sourceRaidStarPigGate(s,historicMax,pending)};
}
