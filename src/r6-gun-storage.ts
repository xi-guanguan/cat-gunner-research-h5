import type {Session,Gun} from './session';
import {gunEntityUID} from './gun-drag';
/** Safe_manager native constants, not the serialized zero-filled array before Awake/InitArray. */
export const SOURCE_SAFE_SLOTS=16,SOURCE_SAFE_FREE_SLOTS=6,SOURCE_SAFE_UNLOCK_STAGE=390;
export interface SourceGunSafeState {purchased:number;guns:(Gun|null)[]}
export type SourceGunDetailRef={kind:'catalogue';sourceID:number}|{kind:'inventory'|'equipment'|'safe';index:number;uid:string;sourceID:number};
export const freshSourceGunSafe=():SourceGunSafeState=>({purchased:0,guns:Array(SOURCE_SAFE_SLOTS).fill(null)});
export const sourceGunSafeUnlocked=(historicMax:number)=>historicMax>=SOURCE_SAFE_UNLOCK_STAGE;
export const sourceGunSafeOpenSlots=(s:SourceGunSafeState)=>SOURCE_SAFE_FREE_SLOTS+s.purchased;
export const sourceGunSafeNextPrice=(s:SourceGunSafeState)=>50+50*s.purchased;
export function validateSourceGunSafe(raw:unknown):asserts raw is SourceGunSafeState {
 const s=raw as SourceGunSafeState;
 if(!s||!Number.isSafeInteger(s.purchased)||s.purchased<0||s.purchased>10||!Array.isArray(s.guns)||s.guns.length!==16||s.guns.some((g,i)=>i>=6+s.purchased&&g!==null))throw new Error('Invalid gun safe state');
}
export function sourceGunDetailRef(session:Session,kind:'inventory'|'equipment'|'safe',index:number):SourceGunDetailRef|undefined {
 const gun=(kind==='inventory'?session.gunInventory:kind==='equipment'?session.equippedGuns:session.gunSafe?.guns??[])[index];
 if(gun)return {kind,index,uid:gunEntityUID(gun),sourceID:Number(gun.id.match(/^source-gun-(\d+)$/)?.[1]??0)};
}
export function sourceGunDetailCurrent(session:Session,ref:SourceGunDetailRef):Gun|undefined {
 if(ref.kind==='catalogue')return;
 const gun=(ref.kind==='inventory'?session.gunInventory:ref.kind==='equipment'?session.equippedGuns:session.gunSafe?.guns??[])[ref.index];
 return gun&&gunEntityUID(gun)===ref.uid&&Number(gun.id.match(/^source-gun-(\d+)$/)?.[1]??0)===ref.sourceID?gun:undefined;
}
export interface SourceGunStorageResult {status:'granted'|'blocked';session:Session;reason:string;slot?:number}
const denied=(session:Session,reason:string):SourceGunStorageResult=>({status:'blocked',session,reason});
/** Gun_Info_UI checks mode/index again. H5 additionally checks stable identity to reject stale panels. */
export function sourceGunProtection(session:Session,ref:SourceGunDetailRef,paused:boolean):SourceGunStorageResult {
 if(paused&&!sourceGunSafeUnlocked(session.historicMax))return denied(session,'保护功能在第40大关开放');
 const gun=sourceGunDetailCurrent(session,ref);
 if(!gun||ref.kind==='catalogue'||ref.kind==='safe')return denied(session,'武器位置已变化或不支持保护操作');
 if(gun.adReward)return denied(session,'广告临时武器不可修改保护状态');
 if((gun.paused===true)===paused)return denied(session,paused?'已受保护':'已解除保护');
 const guns=[...(ref.kind==='inventory'?session.gunInventory:session.equippedGuns)];guns[ref.index]={...gun,uid:gunEntityUID(gun),paused};
 return {status:'granted',session:{...session,...(ref.kind==='inventory'?{gunInventory:guns as Gun[]}:{equippedGuns:guns})},reason:paused?'已保护：手动与自动合成不会消耗此武器':'已解除合成保护'};
}
export function sourceGunSafePurchase(session:Session,index:number):SourceGunStorageResult {
 if(!sourceGunSafeUnlocked(session.historicMax))return denied(session,'保险库在第40大关开放');
 const safe=session.gunSafe??freshSourceGunSafe(),price=sourceGunSafeNextPrice(safe);
 if(!Number.isInteger(index)||index!==sourceGunSafeOpenSlots(safe)||index>=16)return denied(session,'只能按顺序购买下一个保险库槽位');
 if(session.diamonds<price)return denied(session,'钻石不足');
 return {status:'granted',session:{...session,diamonds:session.diamonds-price,gunSafe:{...safe,purchased:safe.purchased+1}},reason:'保险库扩容成功',slot:index};
}
/** Native Put_From_Inventory: first free open safe slot; ad reward weapon is ineligible. */
export function sourceGunSafeDeposit(session:Session,ref:SourceGunDetailRef):SourceGunStorageResult {
 if(!sourceGunSafeUnlocked(session.historicMax))return denied(session,'保险库在第40大关开放');
 const gun=sourceGunDetailCurrent(session,ref);if(ref.kind!=='inventory'||!gun)return denied(session,'只可存入当前库存武器');
 if(gun.adReward)return denied(session,'广告临时武器需先取得正式奖励');
 const safe=session.gunSafe??freshSourceGunSafe(),slot=safe.guns.findIndex((g,i)=>g===null&&i<sourceGunSafeOpenSlots(safe));
 if(slot<0)return denied(session,'保险库已满');
 const guns=[...safe.guns];guns[slot]={...gun,uid:gunEntityUID(gun),paused:false};const inventory=[...session.gunInventory];inventory.splice(ref.index,1);
 return {status:'granted',session:{...session,gunInventory:inventory,gunSafe:{...safe,guns}},reason:'已存入保险库',slot};
}
/** Native Take_Out inserts in first owned vacancy AND explicitly sets Owned_Pause=true. */
export function sourceGunSafeTakeOut(session:Session,ref:SourceGunDetailRef):SourceGunStorageResult {
 if(!sourceGunSafeUnlocked(session.historicMax))return denied(session,'保险库在第40大关开放');
 const gun=sourceGunDetailCurrent(session,ref);if(ref.kind!=='safe'||!gun)return denied(session,'保险库武器位置已变化');
 if(session.gunInventory.length>=16)return denied(session,'武器库存已满');
 const safe=session.gunSafe??freshSourceGunSafe(),guns=[...safe.guns];guns[ref.index]=null;
 return {status:'granted',session:{...session,gunInventory:[...session.gunInventory,{...gun,uid:gunEntityUID(gun),paused:true}],gunSafe:{...safe,guns}},reason:'已取出并默认保护，解除保护后方可合成'};
}
