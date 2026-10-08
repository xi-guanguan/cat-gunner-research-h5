import {sourceGunDailyRequestGate,sourceGunDailyReward} from './r6-gun-daily';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {Gun} from './session';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export interface SourceGunDailyRequest extends SourceRewardRequest {kind:'ad';purpose:'gun:daily:10';adType:10}
interface Ports {
 read():{bundle:SourceMetaBundle;contextID:string};
 /** Persist the complete envelope before publishing live state. */
 write(bundle:SourceMetaBundle):void;
 todayKey():string;requestID():string;execute(request:SourceGunDailyRequest):Promise<SourceRewardResponse>;
 notice(message:string):void;granted?(gun:Gun,slot:number):void;
}
/** Gun_manager owns the callback: closing inventory does not cancel it, replacing a save does. */
export class SourceGunDailyClient {
 pending:SourceGunDailyRequest|null=null;saveFailed=false;
 private epoch=0;private recovery:{response:SourceRewardResponse;contextID:string}|null=null;
 constructor(private ports:Ports){}
 invalidate(){this.epoch++;this.pending=null;this.recovery=null;this.saveFailed=false;}
 async request():Promise<boolean>{
  if(this.pending){this.ports.notice('广告枪请求处理中；保存失败时点领取重试保存');return false;}
  const before=this.ports.read(),reason=sourceGunDailyRequestGate(before.bundle,this.ports.todayKey());
  if(reason){this.ports.notice(reason);return false;}
  const id=this.ports.requestID();if(!id.trim()||id.length>128){this.ports.notice('无效广告枪请求身份');return false;}
  const q:SourceGunDailyRequest={id,purpose:'gun:daily:10',kind:'ad',adType:10},epoch=this.epoch;
  this.pending=q;this.saveFailed=false;this.ports.notice('本地测试广告处理中 · type10 · 不播放真实广告，线上未连接');
  let response:SourceRewardResponse;
  try{response=await this.ports.execute(q);}catch(error){if(epoch===this.epoch&&this.pending===q){this.pending=null;this.ports.notice(`本地测试广告异常：${String(error)}；未发武器`);}return false;}
  if(epoch!==this.epoch||this.pending!==q)return false;return this.commit(response,before.contextID);
 }
 private commit(response:SourceRewardResponse,contextID:string):boolean {
  const q=this.pending;if(!q)return false;const current=this.ports.read();
  if(current.contextID!==contextID){this.invalidate();this.ports.notice('存档身份已变化；旧广告枪回调未发奖');return false;}
  if(!sourceRewardMatches(q,response)||response.status!=='success'){
   this.pending=null;this.recovery=null;this.saveFailed=false;
   const status={failure:'失败',cancelled:'取消',unavailable:'不可用',success:'成功'}[response.status];
   this.ports.notice(!sourceRewardMatches(q,response)?'广告枪回调身份不匹配；未发奖':`本地测试广告${status}；未发武器，线上未连接`);return false;
  }
  const r=sourceGunDailyReward(current.bundle,this.ports.todayKey(),q.id);
  if(r.status!=='granted'){this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice(r.reason);return false;}
  try{this.ports.write(r.bundle);}catch{
   this.saveFailed=true;this.recovery={response,contextID};this.ports.notice('广告枪存档失败；未发布奖励，点领取重试保存，不重看广告');return false;
  }
  this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice('本地测试每日广告枪已保存 · 线上未连接');
  try{this.ports.granted?.(r.gun,r.slot);}catch{/* Presentation failure does not undo persisted reward. */}return true;
 }
 retrySave(){const r=this.recovery;return r?this.commit(r.response,r.contextID):false;}
}
