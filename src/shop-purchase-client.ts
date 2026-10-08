/** Local-test purchase adapter. Source grants live in r6-shop; no store SDK/online receipt. */
import {SOURCE_PACKAGE_OFFERS,type SourcePackageID} from './r5-entitlements';
import {sourceShopPurchase} from './r6-shop';
import contract from './data/round3-ui-contract.json';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceRewardRequest,SourceRewardResponse} from './r6-reward-provider';
interface Ports {
 read():{bundle:SourceMetaBundle;contextID:string};
 /** Serialize/persist the complete candidate before publishing it to runtime. */
 write(bundle:SourceMetaBundle):void;
 requestID():string;now():string;execute(request:SourceRewardRequest):Promise<SourceRewardResponse>;
 notice(message:string):void;granted?():void;
}
export function sourceShopPurchaseRequestGate(b:SourceMetaBundle,product:string):string|null {
 if(b.session.mode!=='field')return '请返回普通场景购买';
 if(Object.prototype.hasOwnProperty.call(SOURCE_PACKAGE_OFFERS,product)){
  const offer=SOURCE_PACKAGE_OFFERS[product as SourcePackageID];
  return b.meta.entitlements[offer.entitlement]?'已拥有此权益；未重复购买':null;
 }
 return contract.shop.offerings.some(o=>o.id===product)?null:'商品不存在；未请求交易';
}
/** Manager-owned: closing shop does not cancel a receipt; replacing a save invalidates it.
 * Retry rebases onto current balances/first-buy/rights; never publishes a stale wallet snapshot. */
export class SourceShopPurchaseClient {
 pending:SourceRewardRequest|null=null;saveFailed=false;
 private epoch=0;private recovery:{response:SourceRewardResponse;contextID:string;at:string}|null=null;
 constructor(private ports:Ports){}
 invalidate(){this.epoch++;this.pending=null;this.saveFailed=false;this.recovery=null;}
 async request(product:string):Promise<boolean>{
  if(this.pending){this.ports.notice('交易处理中；保存失败时点原商品重试保存');return false;}
  const before=this.ports.read(),reason=sourceShopPurchaseRequestGate(before.bundle,product);
  if(reason){this.ports.notice(reason);return false;}
  const id=this.ports.requestID();if(!id.trim()||id.length>240){this.ports.notice('无效交易请求身份；未请求交易');return false;}
  const q:SourceRewardRequest={id,purpose:product,kind:'purchase'},epoch=this.epoch;
  this.pending=q;this.saveFailed=false;this.ports.notice('本地测试交易处理中 · 不真实支付，线上未连接');
  let response:SourceRewardResponse;
  try{response=await this.ports.execute(q);}catch(error){if(epoch===this.epoch&&this.pending===q){this.pending=null;this.ports.notice(`本地测试交易异常：${String(error)}；未发奖`);}return false;}
  if(epoch!==this.epoch||this.pending!==q)return false;
  return this.commit(response,before.contextID,this.ports.now());
 }
 private commit(response:SourceRewardResponse,contextID:string,at:string):boolean{
  const q=this.pending;if(!q)return false;
  const current=this.ports.read();if(current.contextID!==contextID){this.invalidate();this.ports.notice('存档身份已变化；旧交易回调未发奖');return false;}
  const b=current.bundle;
  let result:ReturnType<typeof sourceShopPurchase>;
  try{result=sourceShopPurchase({diamonds:b.session.diamonds,entitlements:b.meta.entitlements,claims:b.platform.claims,shopFirstBuy:b.meta.shopFirstBuy},q,response);}catch{
   this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice('交易候选状态无效或余额溢出；未发奖');return false;
  }
  if(result.status!=='granted'){this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice(result.reason);return false;}
  const candidate:SourceMetaBundle={...b,session:{...b.session,diamonds:result.state.diamonds},meta:{...b.meta,entitlements:result.state.entitlements,shopFirstBuy:result.state.shopFirstBuy},platform:{...b.platform,claims:result.state.claims,sequence:b.platform.sequence+1,audit:[...b.platform.audit,{id:q.id,kind:'purchase' as const,amount:result.amount,at}].slice(-100)}};
  try{this.ports.write(candidate);}catch{
   this.saveFailed=true;this.recovery={response,contextID,at};this.ports.notice('交易存档失败；权益与奖励未发布，点原商品重试保存，不重复交易');return false;
  }
  this.pending=null;this.recovery=null;this.saveFailed=false;this.ports.notice(`${result.reason} · 已保存，线上未连接`);
  try{this.ports.granted?.();}catch{/* A presentation failure cannot undo a persisted receipt. */}return true;
 }
 retrySave(product:string):boolean{
  const r=this.recovery;if(!r)return false;
  if(this.pending?.purpose!==product){this.ports.notice('请点原商品重试保存；未发起新交易');return false;}
  return this.commit(r.response,r.contextID,r.at);
 }
}
