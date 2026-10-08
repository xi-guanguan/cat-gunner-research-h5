import {freshSourceFreeCash,sourceFreeCashGrant,freeCashMatches,type SourceFreeCashState,type FreeCashSDKStatus,type FreeCashRequest,type FreeCashResponse,type FreeCashOperation} from './r6-freecash';
import type {SourceEntitlements} from './r5-entitlements';
interface Hooks {
 read():{state:SourceFreeCashState;entitlements:SourceEntitlements;contextID:string;saveLoaded:boolean};
 write(state:SourceFreeCashState,entitlements:SourceEntitlements):void;
 requestID():string;execute(q:FreeCashRequest):Promise<FreeCashResponse>;notice(message:string):void;
}
/** Persist-first, re-read current balances/rights at commit. Delayed save-load rewards
 * are held only in runtime; reset/context replacement invalidates old callbacks. */
export class SourceFreeCashClient {
 sdkStatus:FreeCashSDKStatus='unavailable';pending:FreeCashRequest|null=null;saveFailed=false;open=false;place='qa';
 private epoch=0;private initAttempted=false;private receipt:{q:FreeCashRequest;r:FreeCashResponse;contextID:string;epoch:number}|null=null;
 constructor(private hooks:Hooks){}
 reset(){this.epoch++;this.initAttempted=false;this.pending=null;this.receipt=null;this.saveFailed=false;this.sdkStatus='unavailable';this.open=false;}
 close(){this.open=false;}
 /** Configured local provider bootstraps without requiring a currently-hidden banner.
  * One attempt per context; unavailable/failure never becomes a per-frame retry loop. */
 ensureInitialized(configured:boolean):Promise<boolean>|null {
  if(!configured||this.initAttempted||this.pending||this.sdkStatus!=='unavailable')return null;
  this.initAttempted=true;return this.request('init');
 }
 async show(place:string){if(!['hud','shop','banner','banner_reward','qa'].includes(place))throw Error('Unknown source FreeCash Place_str');this.place=place;this.open=true;if(this.sdkStatus==='unavailable'&&!this.pending)await this.request('init');}
 async request(operation:FreeCashOperation):Promise<boolean>{
  if(this.pending){this.hooks.notice(this.saveFailed?'存档失败：请重试保存，不会重复链接':'链接请求处理中');return false;}
  const current=this.hooks.read();
  if(operation==='link'&&this.sdkStatus==='unavailable'){this.hooks.notice('SDK 未就绪，请先检查链接；不会伪造成功');return false;}
  if(operation==='link'&&current.state.isLinkRewardReceived){this.hooks.notice('链接权益已领取');return false;}
  const q:FreeCashRequest={id:this.hooks.requestID(),operation,place:this.place},epoch=this.epoch,contextID=current.contextID;this.pending=q;
  this.hooks.notice('FreeCash 本地测试请求处理中 · 不连接真实账户、不支付真钱');
  let r:FreeCashResponse;try{r=await this.hooks.execute(q);}catch{if(epoch===this.epoch&&this.pending===q){this.pending=null;this.hooks.notice('本地 provider 失败，可重试');}return false;}
  if(epoch!==this.epoch||this.pending!==q||this.hooks.read().contextID!==contextID){if(this.pending===q)this.pending=null;return false;}
  if(!freeCashMatches(q,r)){this.pending=null;this.hooks.notice('链接回调身份不匹配，已拒绝');return false;}
  if(r.status!=='success'){this.pending=null;this.hooks.notice(r.status==='unavailable'?'FreeCash 线上 SDK 未连接；不会发放权益':r.status==='cancelled'?'本地测试链接已取消':'本地测试链接失败，可重试');return false;}
  this.sdkStatus=r.sdkStatus;
  if(r.sdkStatus!=='linked'){this.pending=null;this.hooks.notice(r.sdkStatus==='linkable'?'本地测试 SDK 就绪，账户尚未链接':'SDK 尚不可用');return false;}
  this.receipt={q,r,contextID,epoch};return this.retrySave();
 }
 retrySave():boolean {
  const receipt=this.receipt,current=this.hooks.read();
  if(!receipt)return false;
  if(receipt.epoch!==this.epoch||receipt.contextID!==current.contextID){this.receipt=null;this.pending=null;this.saveFailed=false;return false;}
  if(!current.saveLoaded){this.hooks.notice('等待存档加载后再应用链接权益');return false;}
  const result=sourceFreeCashGrant(current.state??freshSourceFreeCash(),current.entitlements,receipt.q,receipt.r);
  if(!result.granted){this.receipt=null;this.pending=null;this.saveFailed=false;this.hooks.notice(result.reason);return false;}
  try{this.hooks.write(result.state,result.entitlements);}catch{this.saveFailed=true;this.hooks.notice('链接完成但本地存档写入失败；点击检查重试保存（不重复发奖）');return false;}
  this.receipt=null;this.pending=null;this.saveFailed=false;this.open=false;this.hooks.notice(result.reason);return true;
 }
}
