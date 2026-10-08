import {sourcePetDailyUnlocked,sourcePetDailyReward} from './r5-pet';
import type {SourceMetaBundle} from './source-meta-runtime';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export interface SourcePetDailyRequest extends SourceRewardRequest {kind:'ad';purpose:'pet:daily:11';adType:11}
interface Ports {
 read():{bundle:SourceMetaBundle;contextID:string};
 /** Persist the complete candidate envelope BEFORE publishing it to live state. */
 write(bundle:SourceMetaBundle):void;
 todayKey():string;requestID():string;execute(request:SourcePetDailyRequest):Promise<SourceRewardResponse>;
 notice(message:string):void;granted?(grade:number,slot:number):void;
}
const reasons:Record<string,string>={'pet-inventory-full':'宠物库存已满','pet-daily-ad-used':'今日宠物奖励已领取','pet-daily-date-unavailable':'本地日期不可用；未消耗领取机会'};
/** Source AD_Draw_Btn_Click → ShowRewardAd(11) → AD_Daily_Pet_RewardGet.
 * Local identity/persist-first/context guards are H5 adapters, not online receipts.
 * Closing a panel does not discard this manager-owned callback; replacing a save does. */
export class SourcePetDailyClient {
 pending:SourcePetDailyRequest|null=null;saveFailed=false;
 private epoch=0;private recovery:{response:SourceRewardResponse;contextID:string}|null=null;
 constructor(private ports:Ports){}
 invalidate(){this.epoch++;this.pending=null;this.recovery=null;this.saveFailed=false;}
 async request():Promise<boolean>{
  if(this.pending){this.ports.notice('宠物广告请求处理中；保存失败时点领取重试保存');return false;}
  const before=this.ports.read(),b=before.bundle,day=this.ports.todayKey();
  const reason=b.session.mode!=='field'?'请返回普通场景领取宠物':b.session.historicMax<110?'宠物在第12大关开放':!sourcePetDailyUnlocked(b.meta.hunt.wave,b.meta.hunt.level)?'先完成一关狩猎':!day?reasons['pet-daily-date-unavailable']:b.meta.pet.dailyLastDate===day?reasons['pet-daily-ad-used']:!b.meta.pet.owned.includes(-1)?reasons['pet-inventory-full']:'';
  if(reason){this.ports.notice(reason);return false;}
  const id=this.ports.requestID();if(!id||id.length>128||!id.trim()){this.ports.notice('无效宠物广告请求身份');return false;}
  const q:SourcePetDailyRequest={id,purpose:'pet:daily:11',kind:'ad',adType:11};const epoch=this.epoch;
  this.pending=q;this.saveFailed=false;this.ports.notice('本地测试广告处理中 · type11 · 不播放真实广告，线上未连接');
  let response:SourceRewardResponse;
  try{response=await this.ports.execute(q);}catch(error){if(this.epoch===epoch&&this.pending===q){this.pending=null;this.ports.notice(`本地测试广告异常：${String(error)}；未发宠物`);}return false;}
  if(epoch!==this.epoch||this.pending!==q)return false;return this.commit(response,before.contextID);
 }
 private commit(response:SourceRewardResponse,contextID:string):boolean{
  const q=this.pending;if(!q)return false;const current=this.ports.read();
  if(current.contextID!==contextID){this.invalidate();this.ports.notice('存档身份已变化；旧宠物广告回调未发奖');return false;}
  if(!sourceRewardMatches(q,response)||response.status!=='success'){
   this.pending=null;this.recovery=null;this.saveFailed=false;
   const status={failure:'失败',cancelled:'取消',unavailable:'不可用',success:'成功'}[response.status];
   this.ports.notice(!sourceRewardMatches(q,response)?'宠物广告回调身份不匹配；未发奖':`本地测试广告${status}；未发宠物，线上未连接`);return false;
  }
  const b=current.bundle,receipt=`meta:pet-daily-provider:${q.id}`;
  if(b.platform.claims.includes(receipt)){this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice('该宠物广告已入账；不重复发奖');return false;}
  // Native callback uses callback-time date, not ad-start date. A full inventory
  // at callback time leaves both the day and receipt unconsumed.
  const r=sourcePetDailyReward(b.meta.pet,this.ports.todayKey());
  if(r.status!=='supported'){this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice(reasons[r.reason]??r.reason);return false;}
  const next:SourceMetaBundle={...b,meta:{...b.meta,pet:r.value},platform:{...b.platform,claims:[...b.platform.claims,receipt],sequence:b.platform.sequence+1,audit:[...b.platform.audit,{id:receipt,kind:'ad' as const,amount:0,at:this.ports.todayKey()}].slice(-100)}};
  try{this.ports.write(next);}catch(error){this.saveFailed=true;this.recovery={response,contextID};this.ports.notice('宠物奖励存档失败；未发布奖励，点领取重试保存，不重看广告');return false;}
  this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice('本地测试广告奖励：C级宠物 ×1 · 已保存，线上未连接');
  try{this.ports.granted?.(r.newGrade!,r.slot!);}catch{/* Presentation cannot undo a persisted grant. */}return true;
 }
 retrySave(){const r=this.recovery;return r?this.commit(r.response,r.contextID):false;}
}
