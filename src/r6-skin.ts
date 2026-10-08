import scene from './data/r6-skin-ui.json';
const manager=scene.find(r=>r.kind==='Skin_manager')!.data;
/** Skin_manager source list identity is its stable array index, not ownership position. */
export const SOURCE_SKIN_COUNT=25;
export interface SourceSkinState {owned:boolean[];selected:number}
export function freshSourceSkinState():SourceSkinState {return {owned:Array.from({length:SOURCE_SKIN_COUNT},(_,i)=>i===0),selected:0};}
export function validateSourceSkinState(s:SourceSkinState):void {
 if(!s||!Array.isArray(s.owned)||s.owned.length!==SOURCE_SKIN_COUNT||s.owned.some(v=>typeof v!=='boolean')||s.owned[0]!==true||!Number.isInteger(s.selected)||s.selected<0||s.selected>=SOURCE_SKIN_COUNT||!s.owned[s.selected])throw Error('Invalid source Skin_Unlock / Selected_num');
}
export function sourceSkinRow(index:number){if(!Number.isInteger(index)||index<0||index>=SOURCE_SKIN_COUNT)throw RangeError('Invalid source skin index');return {index,damage:16*index,speed:10*index,money:5*index,price:100*index};}
/** Serialized arrays match Skin_manager.Balance_Reload; fail loudly on a changed sample. */
if(manager.Skin_list?.length!==SOURCE_SKIN_COUNT||manager.Skin_list.some((r,i)=>r.Damage!==16*i||r.Speed!==10*i||r.Money!==5*i)||manager.Price_Balance?.some((v,i)=>v!==100*i))throw Error('Source skin balance mismatch');
export function sourceSkinTotals(s:SourceSkinState=freshSourceSkinState()) {
 validateSourceSkinState(s);let damage=0,speed=0,money=0;
 s.owned.forEach((owned,i)=>{if(owned){const r=sourceSkinRow(i);damage+=r.damage;speed+=r.speed;money+=r.money;}});
 return {damagePercent:100+damage,speedPercent:100+speed,moneyPercent:100+money};
}
export type SourceSkinResult={status:'granted'|'denied';reason:'purchased'|'selected'|'invalid-index'|'already-owned'|'not-owned'|'already-selected'|'insufficient-diamonds';state:SourceSkinState;diamonds:number};
export function sourceSkinAction(s:SourceSkinState,diamonds:number,index:number,action:'purchase'|'select'):SourceSkinResult {
 validateSourceSkinState(s);if(!Number.isSafeInteger(diamonds)||diamonds<0)throw RangeError('Invalid diamond wallet');
 const deny=(reason:SourceSkinResult['reason']):SourceSkinResult=>({status:'denied',reason,state:s,diamonds});
 if(!Number.isInteger(index)||index<0||index>=SOURCE_SKIN_COUNT)return deny('invalid-index');
 if(action==='purchase'){
  if(s.owned[index])return deny('already-owned');const price=sourceSkinRow(index).price;
  if(diamonds<price)return deny('insufficient-diamonds');const owned=[...s.owned];owned[index]=true;
  return {status:'granted',reason:'purchased',state:{...s,owned},diamonds:diamonds-price};
 }
 if(!s.owned[index])return deny('not-owned');if(s.selected===index)return deny('already-selected');
 return {status:'granted',reason:'selected',state:{...s,selected:index},diamonds};
}
export const sourceSkinReason:Record<SourceSkinResult['reason'],string>={purchased:'已购买；累计属性已生效，尚未切换皮肤',selected:'已选择该皮肤','invalid-index':'无效皮肤','already-owned':'已拥有该皮肤','not-owned':'需先拥有该皮肤','already-selected':'已选择该皮肤','insufficient-diamonds':'钻石不足'};
