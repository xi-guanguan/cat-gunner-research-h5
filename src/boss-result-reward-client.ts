/** Native Boss_manager.Bonus_Get / SweepBonus_Get: add2x to the committed base1x,
 * then leave. Only Boss_Stage survives native restore (r5-boss.ts).
 * H5 adaptation: a request captures the immutable live result identity; close/reset
 * invalidates it. Store the complete envelope before publishing wallet or leaving.
 * Failed response recovery is memory-only, never an online receipt claim. */
import {claimBossBonus,type Session} from './session';
import type {SourceBossRun} from './r5-boss';
import type {SourceMetaBundle} from './source-meta-runtime';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export interface SourceBossResultRewardRequest extends SourceRewardRequest {kind:'ad';purpose:'boss:bonus';run:SourceBossRun}
export function sourceBossResultRewardGate(session:Session):string|undefined {
 const run=session.boss.run;
 if(session.mode!=='boss-result'||run?.phase!=='won')return '首领胜利结算已关闭或尚未完成';
 if(run.automaticBonus)return '本次首领已自动领取总计三倍奖励';
 if(run.bonusClaimed)return '首领额外奖励已领取';
 if(!Number.isSafeInteger(run.rewardThisRun)||run.rewardThisRun<=0)return '首领奖励前态无效';
}
export type SourceBossResultReward={status:'granted';bundle:SourceMetaBundle;amount:number}|{status:'blocked';reason:string};
export function sourceBossResultReward(bundle:SourceMetaBundle,request:SourceBossResultRewardRequest,response:SourceRewardResponse,at:string):SourceBossResultReward {
 const blocked=(reason:string):SourceBossResultReward=>({status:'blocked',reason});
 const reason=sourceBossResultRewardGate(bundle.session);if(reason)return blocked(reason);
 if(bundle.session.boss.run!==request.run)return blocked('首领结算已换局；旧广告回调未发奖');
 if(request.kind!=='ad'||request.purpose!=='boss:bonus'||!request.id.trim()||request.id.length>240||!sourceRewardMatches(request,response))return blocked('首领广告回调身份不匹配');
 if(response.status!=='success')return blocked(response.status==='cancelled'?'本地测试广告已取消，未追加奖励':response.status==='unavailable'?'广告服务未连接，未追加奖励':'本地测试广告失败，未追加奖励');
 if(bundle.platform.claims.includes(request.id))return blocked('首领额外奖励回执已入账，不重复发奖');
 const amount=request.run.rewardThisRun*2;
 if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(bundle.session.diamonds)||bundle.session.diamonds<0||!Number.isSafeInteger(bundle.session.diamonds+amount)||!Number.isSafeInteger(bundle.platform.sequence+1)||!Number.isFinite(Date.parse(at)))return blocked('首领奖励余额或回执时钟无效，未部分发奖');
 const session=claimBossBonus(bundle.session,true);
 if(session.mode!=='field'||session.boss.run!==null||session.diamonds!==bundle.session.diamonds+amount)return blocked('首领奖励消费者未完成');
 return {status:'granted',amount,bundle:{...bundle,session,platform:{...bundle.platform,claims:[...bundle.platform.claims,request.id],sequence:bundle.platform.sequence+1,audit:[...bundle.platform.audit,{id:request.id,kind:'ad' as const,amount,at}].slice(-100)}}};
}
interface Ports {
 read:()=>{bundle:SourceMetaBundle;contextID:string;resultVisible:boolean};
 execute:(request:SourceBossResultRewardRequest)=>Promise<SourceRewardResponse>;
 /** Must store complete envelope before publishing. */
 write:(bundle:SourceMetaBundle)=>void;requestID:()=>string;now:()=>string;
 notice:(message:string)=>void;granted?:()=>void;
}
export class SourceBossResultRewardClient {
 pending:SourceBossResultRewardRequest|null=null;saveFailed=false;
 private epoch=0;private recovery:{response:SourceRewardResponse;contextID:string;at:string}|null=null;
 constructor(private ports:Ports){}
 invalidate(){this.epoch++;this.pending=null;this.recovery=null;this.saveFailed=false;}
 async request():Promise<boolean>{
  if(this.pending){this.ports.notice('首领广告处理中；保存失败请重试保存，不重复请求广告');return false;}
  const before=this.ports.read(),reason=sourceBossResultRewardGate(before.bundle.session);
  if(!before.resultVisible||reason){this.ports.notice(reason??'首领结算上下文已关闭');return false;}
  const id=this.ports.requestID();if(!id.trim()||id.length>240||before.bundle.platform.claims.includes(id)){this.ports.notice('首领广告请求身份无效或已入账');return false;}
  const request:SourceBossResultRewardRequest={id,kind:'ad',purpose:'boss:bonus',run:before.bundle.session.boss.run!},epoch=this.epoch;
  this.pending=request;this.ports.notice('本地测试首领广告处理中 · 不播放真实广告，线上未连接');
  let response:SourceRewardResponse;
  try {response=await this.ports.execute(request);}catch(error){if(this.epoch===epoch&&this.pending===request){this.invalidate();this.ports.notice(`本地测试首领广告异常：${String(error)}；未发奖`);}return false;}
  if(this.epoch!==epoch||this.pending!==request)return false;
  return this.commit(response,before.contextID,this.ports.now());
 }
 private commit(response:SourceRewardResponse,contextID:string,at:string):boolean {
  const request=this.pending;if(!request)return false;
  const current=this.ports.read();
  if(current.contextID!==contextID||!current.resultVisible){this.invalidate();this.ports.notice('首领结算或存档身份已改变；旧回调未发奖');return false;}
  let result:SourceBossResultReward;
  try{result=sourceBossResultReward(current.bundle,request,response,at);}catch{this.invalidate();this.ports.notice('首领奖励前态无效；未部分发奖');return false;}
  if(result.status!=='granted'){this.invalidate();this.ports.notice(result.reason);return false;}
  try{this.ports.write(result.bundle);}catch{
   this.saveFailed=true;this.recovery={response,contextID,at};this.ports.notice('首领奖励保存失败；额外奖励未发布，点重试保存，不重复广告');return false;
  }
  this.invalidate();this.ports.notice(`首领额外奖励 +${result.amount}，本轮总计三倍 · 已保存，线上未连接`);
  try{this.ports.granted?.();}catch{/* Persisted reward is final even if presentation fails. */}return true;
 }
 retrySave():boolean {const r=this.recovery;return r?this.commit(r.response,r.contextID,r.at):false;}
}
