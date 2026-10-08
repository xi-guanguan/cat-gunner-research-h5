/** Source remove-ads purchase callbacks, explicit local-test provider only.
 * Rule/Init ordering remains in r6-diapig; persistence must precede runtime publication. */
import {freshSourceDiaPig,sourceDiaPigInit,sourceRemoveAdsPurchase,type SourceDiaPigClock,type SourceDiaPigRuntime} from './r6-diapig';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceRewardRequest,SourceRewardResponse} from './r6-reward-provider';
interface Ports {
 read():{bundle:SourceMetaBundle;runtime:SourceDiaPigRuntime|null;contextID:string};
 write(bundle:SourceMetaBundle,runtime:SourceDiaPigRuntime):void;
 clock():SourceDiaPigClock;
 /** Opaque result ownership captured at request time, not the current UI panel. */
 captureScope():()=>boolean;
 requestID():string;now():string;execute(request:SourceRewardRequest):Promise<SourceRewardResponse>;
 notice(message:string):void;granted?():void;
}
export class SourceRemoveAdsPurchaseClient {
 pending:SourceRewardRequest|null=null;saveFailed=false;
 private epoch=0;
 private recovery:{response:SourceRewardResponse;contextID:string;scope:()=>boolean;at:string}|null=null;
 constructor(private ports:Ports){}
 invalidate(){this.epoch++;this.pending=null;this.saveFailed=false;this.recovery=null;}
 async request(product:string):Promise<boolean>{
  if(this.pending){this.ports.notice('交易处理中；保存失败时点原商品重试保存');return false;}
  if(product!=='remove_forced_ads'&&product!=='remove_all_ads'){this.ports.notice('商品不存在；未请求交易');return false;}
  const before=this.ports.read(),flag=product==='remove_forced_ads'?'removeAdsForced':'removeAdsAll';
  if(before.bundle.meta.entitlements[flag]){this.ports.notice('已拥有此权益；未重复购买');return false;}
  const scope=this.ports.captureScope();if(!scope()){this.ports.notice('请返回普通场景或有效结算页购买');return false;}
  const id=this.ports.requestID();if(!id.trim()||id.length>240){this.ports.notice('无效交易请求身份；未请求交易');return false;}
  const q:SourceRewardRequest={id,purpose:product,kind:'purchase'},epoch=this.epoch;
  this.pending=q;this.saveFailed=false;this.ports.notice('本地测试交易处理中 · 不真实支付，线上未连接');
  let response:SourceRewardResponse;
  try{response=await this.ports.execute(q);}catch(error){if(epoch===this.epoch&&this.pending===q){this.pending=null;this.ports.notice(`本地测试交易异常：${String(error)}；未改变权益`);}return false;}
  if(epoch!==this.epoch||this.pending!==q)return false;
  return this.commit(response,before.contextID,scope,this.ports.now());
 }
 private commit(response:SourceRewardResponse,contextID:string,scope:()=>boolean,at:string):boolean{
  const q=this.pending;if(!q)return false;
  const current=this.ports.read();
  if(current.contextID!==contextID){this.invalidate();this.ports.notice('存档身份已变化；旧交易回调未改变权益');return false;}
  if(!scope()){this.invalidate();this.ports.notice('结算已关闭，未提交交易权益');return false;}
  const b=current.bundle;
  let result:ReturnType<typeof sourceRemoveAdsPurchase>;
  try{
   const clock=this.ports.clock(),pig=b.session.diaPig??freshSourceDiaPig();
   const runtime=current.runtime??sourceDiaPigInit(pig,b.meta.entitlements,clock).runtime;
   result=sourceRemoveAdsPurchase({pig,runtime,entitlements:b.meta.entitlements,claims:b.platform.claims},q,response,clock);
  }catch{this.invalidate();this.ports.notice('交易候选状态无效；未改变权益');return false;}
  if(result.status!=='granted'){this.invalidate();this.ports.notice(result.reason);return false;}
  const candidate:SourceMetaBundle={...b,session:{...b.session,diaPig:result.state.pig},meta:{...b.meta,entitlements:result.state.entitlements},platform:{...b.platform,claims:result.state.claims,sequence:b.platform.sequence+1,audit:[...b.platform.audit,{id:q.id,kind:'purchase' as const,amount:0,at}].slice(-100)}};
  try{this.ports.write(candidate,result.state.runtime);}catch{
   this.saveFailed=true;this.recovery={response,contextID,scope,at};this.ports.notice('交易存档失败；权益与存钱罐未发布，点原商品重试保存，不重复交易');return false;
  }
  this.invalidate();this.ports.notice(`${result.reason} · 已保存，线上未连接`);
  try{this.ports.granted?.();}catch{/* The persisted receipt is final even when presentation fails. */}return true;
 }
 retrySave(product:string):boolean{
  const r=this.recovery;if(!r)return false;
  if(this.pending?.purpose!==product){this.ports.notice('请点原商品重试保存；未发起新交易');return false;}
  return this.commit(r.response,r.contextID,r.scope,r.at);
 }
}
