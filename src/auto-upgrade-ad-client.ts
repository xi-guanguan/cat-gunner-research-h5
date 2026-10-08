import {sourceAutoAdRequestGate,sourceAutoAdReward} from './r6-auto-upgrade-ad';
import type {SourceMetaBundle} from './source-meta-runtime';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export interface SourceAutoUpgradeAdRequest extends SourceRewardRequest {kind:'ad';purpose:'auto-upgrade:12';adType:12}
interface Ports {
 read():{bundle:SourceMetaBundle;contextID:string};
 /** Persist the complete envelope before publishing live state. */
 write(bundle:SourceMetaBundle):void;
 todayKey():string;requestID():string;execute(request:SourceAutoUpgradeAdRequest):Promise<SourceRewardResponse>;
 notice(message:string):void;granted?():void;
}
/** Upgrade_manager owns the callback: closing its panel does not cancel it; replacing a save does. */
export class SourceAutoUpgradeAdClient {
 pending:SourceAutoUpgradeAdRequest|null=null;saveFailed=false;adShowing=false;
 private epoch=0;private recovery:{response:SourceRewardResponse;contextID:string}|null=null;
 constructor(private ports:Ports){}
 invalidate(){this.epoch++;this.adShowing=false;this.pending=null;this.recovery=null;this.saveFailed=false;}
 async request():Promise<boolean>{
  if(this.pending){this.ports.notice('自动强化广告请求处理中；保存失败时点领取重试保存');return false;}
  const before=this.ports.read(),reason=sourceAutoAdRequestGate(before.bundle,this.ports.todayKey());
  if(reason){this.ports.notice(reason);return false;}
  const id=this.ports.requestID();if(!id.trim()||id.length>128){this.ports.notice('无效自动强化广告请求身份');return false;}
  const q:SourceAutoUpgradeAdRequest={id,purpose:'auto-upgrade:12',kind:'ad',adType:12},epoch=this.epoch;
  this.pending=q;this.saveFailed=false;this.adShowing=true;this.ports.notice('本地测试广告处理中 · type12 · 不播放真实广告，线上未连接');
  let response:SourceRewardResponse;
  try{response=await this.ports.execute(q);}catch(error){if(epoch===this.epoch&&this.pending===q){this.adShowing=false;this.pending=null;this.ports.notice(`本地测试广告异常：${String(error)}；未发增益`);}return false;}
  if(epoch!==this.epoch||this.pending!==q)return false;this.adShowing=false;return this.commit(response,before.contextID);
 }
 private commit(response:SourceRewardResponse,contextID:string):boolean {
  const q=this.pending;if(!q)return false;const current=this.ports.read();
  if(current.contextID!==contextID){this.invalidate();this.ports.notice('存档身份已变化；旧自动强化广告回调未发奖');return false;}
  if(!sourceRewardMatches(q,response)||response.status!=='success'){
   this.pending=null;this.recovery=null;this.saveFailed=false;
   const status={failure:'失败',cancelled:'取消',unavailable:'不可用',success:'成功'}[response.status];
   this.ports.notice(!sourceRewardMatches(q,response)?'自动强化广告回调身份不匹配；未发奖':`本地测试广告${status}；未发增益，线上未连接`);return false;
  }
  const r=sourceAutoAdReward(current.bundle,this.ports.todayKey(),q.id);
  if(r.status!=='granted'){this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice(r.reason);return false;}
  try{this.ports.write(r.bundle);}catch{
   this.saveFailed=true;this.recovery={response,contextID};this.ports.notice('自动强化广告存档失败；未发布奖励，点领取重试保存，不重看广告');return false;
  }
  this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice('本地测试每日自动强化广告已保存 · 线上未连接');
  try{this.ports.granted?.();}catch{/* Presentation failure does not undo persisted reward. */}return true;
 }
 retrySave(){const r=this.recovery;return r?this.commit(r.response,r.contextID):false;}
}
