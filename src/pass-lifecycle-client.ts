/** Atomic local pass client. No real store/ad receipt or server clock is fabricated. */
import {sourcePassRefresh,sourcePassStartNext,sourcePassProgress,sourcePassSeasonIdentity,sourcePassAllRewards,sourcePutPass,type SourcePassClock} from './r6-pass-lifecycle';
import {sourcePassClaimGate,sourceApplySeasonPass,type SourceSeasonPassKind,type SourcePassTrack} from './source-meta-actions';
import {runtimeSourcePassClaim,runtimeSourceMissionClaim,type SourceMetaBundle} from './source-meta-runtime';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export interface SourcePassRequest extends SourceRewardRequest {seasonID:string;target:{track:SourcePassTrack;index:number}|{product:SourceSeasonPassKind}}
export interface SourcePassClientPorts {read():{bundle:SourceMetaBundle;contextID:string};write(bundle:SourceMetaBundle):void;clock():SourcePassClock;execute(request:SourcePassRequest):Promise<SourceRewardResponse>;requestID():string;notice(text:string):void;allRewardsClaimed?(bundle:SourceMetaBundle):void}
export class SourcePassClient {
 private refreshing=false;private epoch=0;private request:SourcePassRequest|null=null;private recovery:{response:SourceRewardResponse;contextID:string}|null=null;
 constructor(private readonly ports:SourcePassClientPorts){}
 get pending(){return this.request!==null;}get saveFailed(){return this.recovery!==null;}
 invalidate(){this.epoch++;this.request=null;this.recovery=null;}
 private notice(text:string){try{this.ports.notice(text);}catch{/* The presentation cannot revoke a commit. */}}
 // Source Reward_Grant -> Check_All_Reward_Get: event after a real grant,
 // never a periodic all-claims predicate or an entitlement purchase/reload.
 private rewardCommitted(bundle:SourceMetaBundle){if(sourcePassAllRewards(bundle))try{this.ports.allRewardsClaimed?.(bundle);}catch{/* UI failure cannot revoke a persisted reward. */}}
 private write(bundle:SourceMetaBundle):boolean {try{this.ports.write(bundle);return true;}catch(error){this.notice(`通行证保存失败：${String(error)}；未提交，可重试，未重复发奖`);return false;}}
 refresh():boolean {if(this.refreshing)return false;this.refreshing=true;try{const {bundle}=this.ports.read(),r=sourcePassRefresh(bundle,this.ports.clock());return !r.changed||this.write(r.bundle);}finally{this.refreshing=false;}}
 mission(id:string,luxury=false):boolean {if(!this.refresh())return false;const r=runtimeSourceMissionClaim(this.ports.read().bundle,id,luxury);if(r.status!=='granted'){this.notice(r.message);return false;}if(!this.write(r))return false;this.notice(r.message);return true;}
 next():boolean {if(this.pending){this.notice('通行证回调或保存待处理；请先完成或关闭当前请求');return false;}if(!this.refresh())return false;const r=sourcePassStartNext(this.ports.read().bundle,this.ports.clock());if(!r.changed){this.notice(r.message);return false;}if(!this.write(r.bundle))return false;this.notice(r.message);return true;}
 async claim(track:SourcePassTrack,index:number):Promise<boolean> {
  if(this.pending){this.notice('通行证请求处理中；保存失败时请重试保存');return false;}if(!this.refresh())return false;
  const before=this.ports.read(),b=before.bundle,gate=sourcePassClaimGate(sourcePassProgress(b),track,index,{adConfirmed:true,adRemoved:b.meta.entitlements.adRemoved||b.meta.entitlements.removeAdsAll});
  if(gate.status!=='supported'){this.notice(runtimeSourcePassClaim(b,track,index,{adConfirmed:false}).message);return false;}
  if(!gate.value.requiresAd)return this.claimNow(b,track,index,false);
  const q:SourcePassRequest={id:this.ports.requestID(),kind:'ad',purpose:`pass:${sourcePassSeasonIdentity(b)}:${track}:${index}`,seasonID:sourcePassSeasonIdentity(b),target:{track,index}};
  return this.run(q,before.contextID);
 }
 private claimNow(b:SourceMetaBundle,track:SourcePassTrack,index:number,adConfirmed:boolean,requestID?:string):boolean {
  try{const r=runtimeSourcePassClaim(b,track,index,{adConfirmed,requestID});if(r.status!=='granted'){this.notice(r.message);return false;}if(!this.write(r))return false;this.notice(r.message);this.rewardCommitted(r);return true;}catch(error){this.notice(`通行证奖励无法完整消费：${String(error)}；未部分发奖`);return false;}
 }
 async purchase(product:SourceSeasonPassKind):Promise<boolean> {
  if(this.pending){this.notice('通行证请求处理中；保存失败时请重试保存');return false;}if(!this.refresh())return false;
  const before=this.ports.read(),reason=purchaseGate(before.bundle,product);if(reason){this.notice(reason);return false;}
  return this.run({id:this.ports.requestID(),kind:'purchase',purpose:`pass:${sourcePassSeasonIdentity(before.bundle)}:${product}`,seasonID:sourcePassSeasonIdentity(before.bundle),target:{product}},before.contextID);
 }
 private async run(request:SourcePassRequest,contextID:string):Promise<boolean> {
  const epoch=this.epoch;this.request=request;this.notice('本地测试 provider 等待中 · 不真实支付、不播放真实广告');let response:SourceRewardResponse;
  try{response=await this.ports.execute(request);}catch(error){if(this.epoch===epoch&&this.request===request){this.request=null;this.notice(`本地测试 provider 异常：${String(error)}；未发奖`);}return false;}
  if(this.epoch!==epoch||this.request!==request)return false;return this.commit(response,contextID);
 }
 private commit(response:SourceRewardResponse,contextID:string):boolean {
  const request=this.request;if(!request)return false;
  const before=this.ports.read();if(before.contextID!==contextID){this.invalidate();this.notice('存档身份已变化；旧通行证回调未授予');return false;}
  if(!sourceRewardMatches(request,response)||response.status!=='success'){this.request=null;this.recovery=null;this.notice(!sourceRewardMatches(request,response)?'通行证回调身份不匹配；未授予':`本地测试 provider ${response.status}；未授予，线上未连接`);return false;}
  // Refresh first: a late response cannot buy or grant into a newly reset season.
  if(!this.refresh()){this.recovery={response,contextID};return false;}
  const {bundle:b}=this.ports.read();if(sourcePassSeasonIdentity(b)!==request.seasonID){this.request=null;this.recovery=null;this.notice('赛季已变化；旧通行证回调未授予');return false;}
  const receipt=`meta:local-pass:${request.id}`;if(b.platform.claims.includes(receipt)){this.request=null;this.recovery=null;this.notice('该通行证请求已入账；不重复发奖');return false;}
  let next:SourceMetaBundle;let message:string;
  try {
   if('track'in request.target){const r=runtimeSourcePassClaim(b,request.target.track,request.target.index,{adConfirmed:true,requestID:request.id});if(r.status!=='granted'){this.request=null;this.recovery=null;this.notice(r.message);return false;}next=r;message=r.message;}
   else {
    const reason=purchaseGate(b,request.target.product);if(reason){this.request=null;this.recovery=null;this.notice(reason);return false;}
    const r=sourceApplySeasonPass({diamonds:b.session.diamonds,pass:sourcePassProgress(b),consumedReceipts:b.platform.claims},request.target.product,{confirmed:true,receiptId:receipt});if(r.status!=='supported'){this.request=null;this.recovery=null;this.notice(r.reason);return false;}
    const amount=request.target.product==='vip'?500:1000;
    next=sourcePutPass({...b,session:{...b.session,diamonds:r.value.diamonds,events:[],notice:''},platform:{...b.platform,sequence:b.platform.sequence+1,claims:r.value.consumedReceipts,audit:[...b.platform.audit,{id:receipt,kind:'purchase' as const,amount,at:this.ports.clock().now??''}].slice(-100)}},r.value.pass);
    message=`本地测试通行证已入账：${request.target.product==='vip'?'VIP，钻石 +500':'豪华，钻石 +1000、经验 +300'}；线上未连接`;
   }
  }catch(error){this.request=null;this.recovery=null;this.notice(`通行证奖励无法完整消费：${String(error)}；未部分发奖`);return false;}
  if(!this.write(next)){this.recovery={response,contextID};return false;}
  this.request=null;this.recovery=null;this.notice(message);if('track'in request.target)this.rewardCommitted(next);return true;
 }
 retrySave(){const r=this.recovery;return r?this.commit(r.response,r.contextID):false;}
}
function purchaseGate(b:SourceMetaBundle,product:SourceSeasonPassKind):string {
 if(!['vip','luxury','luxury-upgrade'].includes(product))return '未知通行证商品';
 if(b.session.mode!=='field')return '请返回普通场景购买通行证';
 if(b.meta.luxury||product==='vip'&&b.meta.vip)return '该通行证当季已开通';
 if(product==='luxury-upgrade'&&!b.meta.vip)return '豪华升级需要先开通 VIP';
 return '';
}
