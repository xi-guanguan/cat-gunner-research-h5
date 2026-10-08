/** Manager-owned weekly/Plus/StepUp local-test receipts. Source gates/grants stay in
 * r6-weekly/r6-stepup; serialization/storage must finish before runtime publication. */
import {SOURCE_WEEKLY,sourceWeeklyPurchaseGate,sourcePlusPurchaseGate,sourceWeeklyReward,sourcePlusReward,type SourceWeeklyRequest} from './r6-weekly';
import {SOURCE_STEPUP,sourceStepUpPurchaseGate,sourceStepUpReward,type SourceStepUpRequest} from './r6-stepup';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {Gun} from './session';
import type {SourceRewardRequest,SourceRewardResponse} from './r6-reward-provider';
export type SourceActivityPurchaseFamily='weekly'|'plus'|'stepup';
export type SourceActivityPurchasePending={family:'weekly'|'plus';item:number;request:SourceWeeklyRequest}|{family:'stepup';item:number;request:SourceStepUpRequest};
interface Ports {
 read():{bundle:SourceMetaBundle;contextID:string};
 write(bundle:SourceMetaBundle):void;
 clock():number;requestID():string;execute(request:SourceRewardRequest):Promise<SourceRewardResponse>;
 notice(message:string):void;granted?(gun?:Gun):void;
}
export function sourceActivityPurchaseGate(b:SourceMetaBundle,family:SourceActivityPurchaseFamily,item:number,nowUTC:number):string|null {
 if(b.session.mode!=='field')return '请返回普通场景购买';
 if(!Number.isSafeInteger(nowUTC)||Math.abs(nowUTC)>8640000000000000)return '活动本地时钟无效；未请求交易';
 if(family==='weekly')return sourceWeeklyPurchaseGate(b.session,item,new Date(nowUTC))??null;
 if(family==='plus')return sourcePlusPurchaseGate(b.session,b.meta.entitlements,item,nowUTC)??null;
 if(family==='stepup')return sourceStepUpPurchaseGate(b.session,item,nowUTC)??null;
 return '未知活动商品；未请求交易';
}
export class SourceActivityPurchaseClient {
 pending:SourceActivityPurchasePending|null=null;saveFailed=false;
 private epoch=0;private recovery:{response:SourceRewardResponse;contextID:string}|null=null;
 constructor(private ports:Ports){}
 invalidate(){this.epoch++;this.pending=null;this.saveFailed=false;this.recovery=null;}
 async request(family:SourceActivityPurchaseFamily,item:number):Promise<boolean>{
  if(this.pending){this.ports.notice('活动交易处理中；保存失败时点原商品重试保存');return false;}
  const before=this.ports.read();let reason:string|null;
  try{reason=sourceActivityPurchaseGate(before.bundle,family,item,this.ports.clock());}catch{reason='活动前态或时钟无效；未请求交易';}
  if(reason){this.ports.notice(reason);return false;}
  const id=this.ports.requestID();if(!id.trim()||id.length>240){this.ports.notice('无效活动交易请求身份；未请求交易');return false;}
  if(before.bundle.platform.claims.includes(id)){this.ports.notice('交易身份已入账；未请求重复交易');return false;}
  const pending:SourceActivityPurchasePending=family==='stepup'?{family,item,request:{id,kind:'purchase',purpose:SOURCE_STEPUP.products[item],step:item,startedUTC:before.bundle.session.stepUp!.startedUTC!}}:{family,item,request:{id,kind:'purchase',purpose:(family==='plus'?SOURCE_WEEKLY.plusProducts:SOURCE_WEEKLY.products)[item],item}};
  const epoch=this.epoch;this.pending=pending;this.saveFailed=false;this.ports.notice('本地测试活动交易处理中 · 不真实支付，线上未连接');
  let response:SourceRewardResponse;
  try{response=await this.ports.execute(pending.request);}catch(error){if(epoch===this.epoch&&this.pending===pending){this.invalidate();this.ports.notice(`本地测试活动交易异常：${String(error)}；未改变奖励`);}return false;}
  if(epoch!==this.epoch||this.pending!==pending)return false;
  return this.commit(response,before.contextID);
 }
 private commit(response:SourceRewardResponse,contextID:string):boolean{
  const pending=this.pending;if(!pending)return false;
  const current=this.ports.read();if(current.contextID!==contextID){this.invalidate();this.ports.notice('存档身份已变化；旧活动交易回调未发奖');return false;}
  const b=current.bundle,q=pending.request;
  if(b.platform.claims.includes(q.id)){this.invalidate();this.ports.notice('活动交易已入账；不重复发奖');return false;}
  let candidate:SourceMetaBundle,reason:string,gun:Gun|undefined;
  try{
   // Each retry is a delayed source fulfillment: evaluate its callback clock now,
   // not a stale snapshot. H5 storage-recovery adaptation, not native timing proof.
   const nowUTC=this.ports.clock();if(!Number.isSafeInteger(nowUTC)||Math.abs(nowUTC)>8640000000000000)throw Error('invalid clock');
   if(pending.family==='stepup'){
    const r=sourceStepUpReward(b.session,pending.request,response);if(r.status!=='granted'){this.invalidate();this.ports.notice(r.reason);return false;}
    candidate={...b,session:r.session};reason=r.reason;gun=r.session.gunInventory.at(-1);
   }else if(pending.family==='weekly'){
    const r=sourceWeeklyReward(b.session,b.meta.petCoin,pending.request,response,new Date(nowUTC));if(r.status!=='granted'){this.invalidate();this.ports.notice(r.reason);return false;}
    candidate={...b,session:r.session,meta:{...b.meta,petCoin:r.petCoin}};reason=r.reason;gun=r.session.gunInventory.at(-1);
   }else{
    const r=sourcePlusReward(b.session,b.meta.entitlements,pending.request,response,nowUTC);if(r.status!=='granted'){this.invalidate();this.ports.notice(r.reason);return false;}
    candidate={...b,session:r.session,meta:{...b.meta,entitlements:r.entitlements}};reason=r.reason;
   }
   if(!Number.isSafeInteger(candidate.session.diamonds)||candidate.session.diamonds<0||!Number.isSafeInteger(b.platform.sequence+1))throw Error('overflow');
   candidate={...candidate,platform:{...b.platform,claims:[...b.platform.claims,q.id],sequence:b.platform.sequence+1,audit:[...b.platform.audit,{id:q.id,kind:'purchase' as const,amount:candidate.session.diamonds-b.session.diamonds,at:new Date(nowUTC).toISOString()}].slice(-100)}};
  }catch{this.invalidate();this.ports.notice('活动候选状态无效或余额溢出；未部分发奖');return false;}
  try{this.ports.write(candidate);}catch{
   this.saveFailed=true;this.recovery={response,contextID};this.ports.notice('活动交易存档失败；奖励与权益未发布，点原商品重试保存，不重复交易');return false;
  }
  this.invalidate();this.ports.notice(`${reason} · 已保存，线上未连接`);
  try{this.ports.granted?.(gun);}catch{/* Persisted receipt is final; presentation cannot repeat it. */}return true;
 }
 retrySave(family:SourceActivityPurchaseFamily,item:number):boolean{
  const r=this.recovery;if(!r)return false;
  if(this.pending?.family!==family||this.pending.item!==item){this.ports.notice('请点原活动商品重试保存；未发起新交易');return false;}
  return this.commit(r.response,r.contextID);
 }
}
