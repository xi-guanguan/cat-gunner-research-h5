import constants from './data/r6-diapig-constants.json';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
import type {SourceEntitlements} from './r5-entitlements';
export const SOURCE_DIAPIG=constants;
export interface SourceDiaPigState {diamonds:number;lastTickUTC:number|null}
/** Mono anchor is process-local, never restored from a different browser process. */
export interface SourceDiaPigRuntime {lastTickMono:number}
export interface SourceDiaPigClock {nowUTC:number;monoSeconds:number;canGrantTimedReward:boolean;pendingCount:number}
export function freshSourceDiaPig():SourceDiaPigState{return {diamonds:0,lastTickUTC:null};}
export function validateSourceDiaPig(s:SourceDiaPigState):void {
 if(!s||!Number.isSafeInteger(s.diamonds)||s.diamonds<0||s.diamonds>SOURCE_DIAPIG.maximum||!(s.lastTickUTC===null||Number.isSafeInteger(s.lastTickUTC)&&Math.abs(s.lastTickUTC)<=8640000000000000))throw Error('Invalid DiaPig save');
}
function validateClock(c:SourceDiaPigClock):void {if(!Number.isSafeInteger(c.nowUTC)||Math.abs(c.nowUTC)>8640000000000000||!Number.isFinite(c.monoSeconds)||c.monoSeconds<0||typeof c.canGrantTimedReward!=='boolean'||!Number.isSafeInteger(c.pendingCount)||c.pendingCount<0)throw RangeError('Invalid DiaPig clock');}
export const sourceDiaPigTickAmount=(e:Pick<SourceEntitlements,'removeAdsForced'|'removeAdsAll'>)=>Number(e.removeAdsForced)+Number(e.removeAdsAll);
export const sourceDiaPigUnlocked=(e:Pick<SourceEntitlements,'removeAdsForced'|'removeAdsAll'>)=>sourceDiaPigTickAmount(e)>0;
export interface SourceDiaPigTickResult {state:SourceDiaPigState;runtime:SourceDiaPigRuntime;recordedCatchUp:boolean}
export function sourceDiaPigAccumulate(s:SourceDiaPigState,r:SourceDiaPigRuntime,e:SourceEntitlements,c:SourceDiaPigClock):SourceDiaPigTickResult {
 validateSourceDiaPig(s);validateClock(c);if(!Number.isFinite(r.lastTickMono))throw RangeError('Invalid DiaPig mono anchor');
 const unchanged={state:s,runtime:r,recordedCatchUp:false};
 // Native Update does not advance/reset while locked. Init handles the first locked anchor.
 if(!sourceDiaPigUnlocked(e)||s.diamonds>=SOURCE_DIAPIG.maximum)return unchanged;
 if(s.lastTickUTC===null||s.lastTickUTC>c.nowUTC)return {state:{...s,lastTickUTC:c.nowUTC},runtime:{lastTickMono:c.monoSeconds},recordedCatchUp:false};
 const utc=(c.nowUTC-s.lastTickUTC)/1000,mono=Math.max(0,c.monoSeconds-r.lastTickMono),catchUp=utc-mono>SOURCE_DIAPIG.catchUpToleranceSeconds;
 const recordedCatchUp=catchUp&&c.canGrantTimedReward&&c.pendingCount<=SOURCE_DIAPIG.catchUpPendingMaximum;
 const elapsed=catchUp?(recordedCatchUp?utc:mono):Math.min(utc,mono),ticks=Math.trunc(elapsed/SOURCE_DIAPIG.tickSeconds);
 if(ticks<1)return {...unchanged,recordedCatchUp};
 const advanced=ticks*SOURCE_DIAPIG.tickSeconds;
 return {state:{diamonds:Math.min(SOURCE_DIAPIG.maximum,s.diamonds+ticks*sourceDiaPigTickAmount(e)),lastTickUTC:s.lastTickUTC+advanced*1000},runtime:{lastTickMono:c.monoSeconds-(elapsed-advanced)},recordedCatchUp};
}
/** Source Init anchors mono at now, clamps future date, then accumulates only when unlocked. */
export function sourceDiaPigInit(s:SourceDiaPigState,e:SourceEntitlements,c:SourceDiaPigClock):SourceDiaPigTickResult {
 validateSourceDiaPig(s);validateClock(c);const state=s.lastTickUTC===null||s.lastTickUTC>c.nowUTC?{...s,lastTickUTC:c.nowUTC}:s,runtime={lastTickMono:c.monoSeconds};
 return sourceDiaPigUnlocked(e)?sourceDiaPigAccumulate(state,runtime,e,c):{state:{...state,lastTickUTC:c.nowUTC},runtime,recordedCatchUp:false};
}
export function sourceDiaPigSeconds(s:SourceDiaPigState,r:SourceDiaPigRuntime,e:SourceEntitlements,c:SourceDiaPigClock):number {
 if(!sourceDiaPigUnlocked(e)||s.diamonds>=SOURCE_DIAPIG.maximum)return 0;
 return Math.max(0,60-Math.trunc(c.monoSeconds-r.lastTickMono)%60);
}
export function sourceDiaPigCollect(s:SourceDiaPigState,r:SourceDiaPigRuntime,e:SourceEntitlements,c:SourceDiaPigClock,balance:number):SourceDiaPigTickResult&{balance:number;granted:number;reason:string} {
 validateSourceDiaPig(s);validateClock(c);if(!Number.isSafeInteger(balance)||balance<0)throw RangeError('Invalid diamond balance');
 const deny=(reason:string)=>({state:s,runtime:r,recordedCatchUp:false,balance,granted:0,reason});
 if(!sourceDiaPigUnlocked(e))return deny('拥有移除强制广告或全部广告权益后开始累计');if(s.diamonds<1)return deny('存钱罐尚无钻石');
 if(!Number.isSafeInteger(balance+s.diamonds))return deny('钻石余额超出安全范围，未领取');
 const full=s.diamonds>=SOURCE_DIAPIG.maximum;
 return {state:{diamonds:0,lastTickUTC:full?c.nowUTC:s.lastTickUTC},runtime:full?{lastTickMono:c.monoSeconds}:r,recordedCatchUp:false,balance:balance+s.diamonds,granted:s.diamonds,reason:`已领取 ${s.diamonds} 钻石`};
}
export type SourceRemoveAdsProduct='remove_forced_ads'|'remove_all_ads';
export interface SourceRemoveAdsPurchaseState {pig:SourceDiaPigState;runtime:SourceDiaPigRuntime;entitlements:SourceEntitlements;claims:string[]}
export function sourceRemoveAdsPurchase(s:SourceRemoveAdsPurchaseState,request:SourceRewardRequest,response:SourceRewardResponse,c:SourceDiaPigClock):{state:SourceRemoveAdsPurchaseState;status:'granted'|'blocked'|'duplicate';reason:string} {
 const offer=SOURCE_DIAPIG.products.find(p=>p.product===request.purpose),deny=(reason:string)=>({state:s,status:'blocked' as const,reason});
 if(!offer||request.kind!=='purchase'||!request.id.trim()||!sourceRewardMatches(request,response))return deny('交易回调身份不匹配');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实商店未连接；未改变权益':`本地测试交易${response.status==='cancelled'?'已取消':'失败'}；未改变权益`);
 const flag=offer.flag as 'removeAdsForced'|'removeAdsAll';
 if(s.claims.includes(request.id))return {state:s,status:'duplicate',reason:'已处理交易，不重复发奖'};
 // Native purchase calls Init BEFORE first entitlement becomes active, preventing locked time backfill.
 const first=!sourceDiaPigUnlocked(s.entitlements),init=first?sourceDiaPigInit(s.pig,s.entitlements,c):{state:s.pig,runtime:s.runtime};
 return {status:'granted',state:{pig:init.state,runtime:init.runtime,entitlements:{...s.entitlements,[flag]:true},claims:[...s.claims,request.id]},reason:s.entitlements[flag]?'已拥有权益；本地恢复，不赠送钻石':'本地测试权益已记录 · 不真实支付 · 无即时钻石赠送'};
}
