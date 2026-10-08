import {GUN_INVENTORY_CAPACITY,sourceGun,sourceGunID,type Session} from './session';
import {gunEntityUID} from './gun-drag';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
/** Weapon02, NOT daily Weapon01. Native fields: AD_Gun_* / Has_Merged / AD_Gun_Event_Given. */
export const SOURCE_AD_GUN={eventGunID:14,eventSeconds:Math.fround(1800),pollSeconds:Math.fround(.25),adType:9} as const;
export interface SourceAdGunState {hasMerged:boolean;eventGiven:boolean;temporary:{uid:string;sourceID:number;endUTC:number}|null;rewardClaims:string[]}
export interface SourceAdGunRequest extends SourceRewardRequest {uid:string;sourceID:number;endUTC:number}
export const freshSourceAdGun=():SourceAdGunState=>({hasMerged:false,eventGiven:false,temporary:null,rewardClaims:[]});
export function validateSourceAdGun(s:SourceAdGunState):void {
 if(!s||typeof s.hasMerged!=='boolean'||typeof s.eventGiven!=='boolean'||!Array.isArray(s.rewardClaims)||s.rewardClaims.some(v=>typeof v!=='string'||!v.trim())||new Set(s.rewardClaims).size!==s.rewardClaims.length)throw Error('Invalid temporary advertising gun save');
 const t=s.temporary;if(t!==null&&(!t||typeof t.uid!=='string'||!t.uid.trim()||!Number.isInteger(t.sourceID)||t.sourceID<0||t.sourceID>64||!Number.isSafeInteger(t.endUTC)||Math.abs(t.endUTC)>8640000000000000))throw Error('Invalid temporary advertising gun identity');
}
const state=(s:Session)=>s.adGun??freshSourceAdGun();
export function sourceAdGunSlot(s:Session):number {const t=state(s).temporary;return t?s.gunInventory.findIndex(g=>gunEntityUID(g)===t.uid&&sourceGunID(g)===t.sourceID):-1;}
export function sourceAdGunRemaining(s:Session,nowUTC:number):number {const t=state(s).temporary;return t?(t.endUTC-nowUTC)/1000:0;}
export function sourceAdGunTimeText(s:Session,nowUTC:number):string {const sec=Math.ceil(Math.max(0,sourceAdGunRemaining(s,nowUTC)));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}
/** Source fixed slots become compact H5 arrays: UID locates the original object across unrelated compaction. */
export function sourceAdGunClear(s:Session,remove:boolean):Session {
 const a=state(s),t=a.temporary;if(!t)return s;const slot=sourceAdGunSlot(s);
 const gunInventory=slot<0?s.gunInventory:remove?s.gunInventory.filter((_,i)=>i!==slot):s.gunInventory.map((g,i)=>i===slot?{...g,adReward:false}:g);
 return {...s,gunInventory,adGun:{...a,temporary:null}};
}
export function sourceAddAdRewardGun(s:Session,id:number,seconds:number,nowUTC:number,uid:string):Session {
 if(state(s).temporary||s.gunInventory.length>=GUN_INVENTORY_CAPACITY)return s;
 if(!Number.isInteger(id)||id<0||id>64||!Number.isFinite(seconds)||seconds<=0||!Number.isSafeInteger(nowUTC)||!uid.trim()||s.gunInventory.some(g=>gunEntityUID(g)===uid))throw RangeError('Invalid advertising gun spawn');
 const endUTC=nowUTC+Math.trunc(Math.fround(seconds)*1000);if(!Number.isSafeInteger(endUTC)||Math.abs(endUTC)>8640000000000000)throw RangeError('Invalid advertising gun expiry');
 return {...s,gunInventory:[...s.gunInventory,{...sourceGun(id),uid,paused:false,adReward:true}],adGun:{...state(s),temporary:{uid,sourceID:id,endUTC}},events:[]};
}
/** Only FuseItems calls CheckAdGunEvent; catalog history, not inventory degree. Full bag does not consume event. */
export function sourceAdGunCheckEvent(s:Session,serverWeapon02AdOn:boolean,nowUTC:number,uid:string):Session {
 const a=state(s);if(a.eventGiven||!serverWeapon02AdOn)return s;
 if((s.catalogSeen??[]).some(id=>id>=10))return {...s,adGun:{...a,eventGiven:true}};
 if(!a.hasMerged||a.temporary)return s;
 const next=sourceAddAdRewardGun(s,SOURCE_AD_GUN.eventGunID,SOURCE_AD_GUN.eventSeconds,nowUTC,uid);
 return next===s?s:{...next,adGun:{...next.adGun!,eventGiven:true}};
}
/** LoadData also infers Has_Merged from degree >=1, but never spawns the event at load. */
export function sourceAdGunOnLoaded(s:Session,nowUTC:number):Session {
 let next=s,a=state(s);if(!a.hasMerged&&(s.catalogSeen??[]).some(id=>id>=5)){a={...a,hasMerged:true};next={...s,adGun:a};}
 if(!a.temporary)return next;
 if(sourceAdGunSlot(next)<0)return sourceAdGunClear(next,false);
 if(sourceAdGunRemaining(next,nowUTC)<=0)return sourceAdGunClear(next,true);
 const slot=sourceAdGunSlot(next);if(!next.gunInventory[slot].adReward)next={...next,gunInventory:next.gunInventory.map((g,i)=>i===slot?{...g,adReward:true}:g)};
 return next;
}
/** Native Update: float32 .25s poll, then skips expiry while the reward ad is busy. */
export function sourceAdGunTick(s:Session,timer:number,dt:number,nowUTC:number,adBusy:boolean):{session:Session;timer:number} {
 if(!Number.isFinite(timer)||timer<0||!Number.isFinite(dt)||dt<0)throw RangeError('Invalid advertising gun clock');
 if(!state(s).temporary)return {session:s,timer};
 const next=Math.fround(Math.fround(timer)+Math.fround(dt));if(next<SOURCE_AD_GUN.pollSeconds)return {session:s,timer:next};
 return {session:!adBusy&&sourceAdGunRemaining(s,nowUTC)<=0?sourceAdGunClear(s,true):s,timer:0};
}
export function sourceAdGunWatchGate(s:Session,nowUTC:number):string|undefined {
 if(!state(s).temporary||sourceAdGunSlot(s)<0)return '没有可领取的临时广告武器';
 if(sourceAdGunRemaining(s,nowUTC)<=0)return '临时武器已到期';
}
export function sourceAdGunReward(s:Session,request:SourceAdGunRequest,response:SourceRewardResponse):{session:Session;status:'granted'|'blocked'|'duplicate';reason:string;gunID?:number} {
 const a=state(s),deny=(reason:string)=>({session:s,status:'blocked' as const,reason});
 if(typeof request.id!=='string'||!request.id.trim()||request.kind!=='ad'||request.purpose!=='temporary-gun:9'||!sourceRewardMatches(request,response))return deny('广告回调身份不匹配');
 if(a.rewardClaims.includes(request.id))return {session:s,status:'duplicate',reason:'此广告奖励已处理，不重复发奖'};
 const t=a.temporary;if(!t||request.uid!==t.uid||request.sourceID!==t.sourceID||request.endUTC!==t.endUTC||sourceAdGunSlot(s)<0)return deny('临时武器已改变，拒绝陈旧回调');
 if(response.status!=='success')return deny(response.status==='unavailable'?'广告服务未连接；本地测试未启用，未取得武器':`本地测试广告${response.status==='cancelled'?'已取消':'失败'}；未取得武器`);
 // Native Acquire deliberately does not recheck end time; Update suspends expiration while busy.
 const next=sourceAdGunClear(s,false),gun=next.gunInventory.find(g=>gunEntityUID(g)===t.uid)!;
 return {status:'granted',gunID:t.sourceID,reason:'本地测试广告奖励已领取 · 非真实广告',session:{...next,adGun:{...next.adGun!,rewardClaims:[...a.rewardClaims,request.id]},catalogSeen:[...new Set([...(s.catalogSeen??[]),t.sourceID])].sort((x,y)=>x-y),events:[{type:'gunDrawn',gun}]}};
}
