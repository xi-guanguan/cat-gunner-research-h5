/** Source: FreeCash_manager TryGiveLinkReward@2aa2160 / LoadFromSaveData@2aa20f4.
 * SDK status is runtime-only. Local receipts are H5 idempotency identities, not online proofs. */
import type {SourceEntitlements} from './r5-entitlements';
import type {SourceProviderStatus} from './r6-reward-provider';
export interface SourceFreeCashState {isLinkRewardReceived:boolean;isRewardAdRemoved:boolean;isPopLogSent:boolean;localReceipts:string[]}
export type FreeCashSDKStatus='unavailable'|'linkable'|'linked';
export type FreeCashOperation='init'|'check'|'link';
export interface FreeCashRequest {id:string;operation:FreeCashOperation;place:string}
export interface FreeCashResponse extends FreeCashRequest {status:SourceProviderStatus;provider:'local-test';onlineVerified:false;sdkStatus:FreeCashSDKStatus}
export interface FreeCashProvider {execute(request:FreeCashRequest):Promise<FreeCashResponse>}
export const freshSourceFreeCash=():SourceFreeCashState=>({isLinkRewardReceived:false,isRewardAdRemoved:false,isPopLogSent:false,localReceipts:[]});
export function decodeSourceFreeCash(value:unknown):SourceFreeCashState {
 if(value===undefined)return freshSourceFreeCash();
 const s=value as SourceFreeCashState;
 if(!s||['isLinkRewardReceived','isRewardAdRemoved','isPopLogSent'].some(k=>typeof s[k as keyof SourceFreeCashState]!=='boolean')||!Array.isArray(s.localReceipts)||s.localReceipts.some(id=>typeof id!=='string'||!id)||new Set(s.localReceipts).size!==s.localReceipts.length||s.isLinkRewardReceived&&!s.isRewardAdRemoved)throw Error('Invalid FreeCash extension');
 return {...s,localReceipts:[...s.localReceipts]};
}
export function freeCashMatches(q:FreeCashRequest,r:FreeCashResponse):boolean {
 return q.id===r.id&&q.operation===r.operation&&q.place===r.place&&r.provider==='local-test'&&r.onlineVerified===false&&['success','failure','cancelled','unavailable'].includes(r.status)&&['unavailable','linkable','linked'].includes(r.sdkStatus);
}
/** Explicit local SDK simulator. No SDK/network/real-money/account link is performed. */
export function createLocalFreeCashProvider(available:boolean,outcome:Exclude<SourceProviderStatus,'unavailable'>='success',initial:FreeCashSDKStatus='linkable'):FreeCashProvider {
 let sdkStatus:FreeCashSDKStatus=available?initial:'unavailable';
 const requests=new Map<string,{key:string;promise:Promise<FreeCashResponse>}>();
 return {execute(q){
  if(!q.id||!['init','check','link'].includes(q.operation)||!['hud','shop','banner','banner_reward','qa'].includes(q.place))throw Error('Invalid FreeCash request');
  const key=JSON.stringify([q.operation,q.place]),old=requests.get(q.id);
  if(old){if(old.key!==key)throw Error('FreeCash request identity conflict');return old.promise;}
  const status=available?outcome:'unavailable';
  if(status==='success'&&q.operation==='link')sdkStatus='linked';
  const promise=Promise.resolve<FreeCashResponse>({...q,status,provider:'local-test',onlineVerified:false,sdkStatus});requests.set(q.id,{key,promise});return promise;
 }};
}
export interface FreeCashExposure {featureEnabled:boolean;exposureTarget:boolean;hud:boolean;reason:string}
export function sourceFreeCashExposure(s:SourceFreeCashState,sdk:FreeCashSDKStatus,historicMax:number,config:{minDisplayStage:number;maxHudDisplayStage:number}|null,saveLoaded=true):FreeCashExposure {
 const featureEnabled=!!config,display=Math.trunc(historicMax/10)+1;
 const exposureTarget=saveLoaded&&!s.isLinkRewardReceived&&sdk!=='unavailable'&&!!config&&display>=config.minDisplayStage;
 return {featureEnabled,exposureTarget,hud:exposureTarget&&display<=config!.maxHudDisplayStage,reason:!saveLoaded?'存档尚未加载':s.isLinkRewardReceived?'链接权益已领取':!config?'线上曝光配置未连接':sdk==='unavailable'?'SDK 不可用':display<config.minDisplayStage?`需达到显示关卡 ${config.minDisplayStage}`:display>config.maxHudDisplayStage?'超过 HUD 曝光上限（横幅仍可达）':'可达'};
}
export function sourceFreeCashGrant(s:SourceFreeCashState,e:SourceEntitlements,q:FreeCashRequest,r:FreeCashResponse){
 if(!freeCashMatches(q,r)||r.status!=='success'||r.sdkStatus!=='linked')return {state:s,entitlements:e,granted:false,reason:'链接回调不匹配或尚未链接'};
 if(s.isLinkRewardReceived||s.localReceipts.includes(q.id))return {state:s,entitlements:e,granted:false,reason:'链接权益已领取'};
 return {state:{...s,isLinkRewardReceived:true,isRewardAdRemoved:true,localReceipts:[...s.localReceipts,q.id]},entitlements:{...e,adRemoved:true},granted:true,reason:'本地测试链接权益已保存：移除激励广告（非真实线上链接）'};
}
