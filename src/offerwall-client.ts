import {SOURCE_OFFERWALL,offerWallMatches,sourceOfferWallGrant,type SourceOfferWallState,type OfferWallRequest,type OfferWallResponse,type OfferWallOperation} from './r6-offerwall';
interface Hooks {
 read():{state:SourceOfferWallState;diamonds:number;contextID:string;saveLoaded:boolean};
 write(state:SourceOfferWallState,diamonds:number):void;
 execute(q:OfferWallRequest,contextID:string):Promise<OfferWallResponse>;
 requestID():string;notice(n:string):void;now():number;
}
/** Source client sequence with explicit local SDK surface, persistent debit identity,
 * deadline/epoch rejection, one queued recheck, and persist-first wallet publication. */
export class SourceOfferWallClient {
 open=false;connected=false;contentReady=false;place='qa';pending:OfferWallRequest|null=null;claiming=false;saveFailed=false;
 private epoch=0;private initialized=false;private again=false;private timeoutAt=0;private delayedAt=0;
 constructor(private h:Hooks){}
 reset(){this.epoch++;this.open=false;this.connected=false;this.contentReady=false;this.pending=null;this.claiming=false;this.saveFailed=false;this.initialized=false;this.again=false;this.timeoutAt=0;this.delayedAt=0;}
 private async call(operation:OfferWallOperation,amount=0,id?:string){
  const contextID=this.h.read().contextID,epoch=this.epoch,q:OfferWallRequest={id:id??this.h.requestID(),operation,place:this.place,amount};this.pending=q;
  let r:OfferWallResponse;try{r=await this.h.execute(q,contextID);}catch{
   if(this.pending===q&&this.epoch===epoch&&this.h.read().contextID!==contextID){this.reset();return null;}
   if(this.pending===q&&this.epoch===epoch){this.pending=null;this.h.notice('本地 provider 请求或存档失败；可重试');}return null;
  }
  if(this.pending!==q||epoch!==this.epoch)return null;
  if(this.h.read().contextID!==contextID){this.reset();return null;}
  this.pending=null;
  if(!offerWallMatches(q,r)){this.h.notice('OfferWall 回调身份不匹配，已拒绝');return null;}
  if(r.status!=='success'){this.h.notice(r.status==='unavailable'?'OfferWall 线上 SDK 未连接；未发奖':r.status==='cancelled'?'本地测试服务已取消；未发奖':'本地测试服务失败，可重试');return r;}
  return r;
 }
 async initialize(configured:boolean){
  if(!configured||this.initialized||this.pending||this.claiming)return;this.initialized=true;
  const epoch=this.epoch;const r=await this.call('connect');if(r?.status!=='success'||epoch!==this.epoch)return;
  this.connected=true;const content=await this.call('content');if(epoch!==this.epoch)return;this.contentReady=content?.status==='success'&&content.contentReady;
  await this.claim();
 }
 async show(place:string){
  if(!['qa','shop','hud','banner_reward'].includes(place))throw Error('Invalid OfferWall place');
  if(this.pending||this.claiming){this.h.notice('OfferWall 请求处理中');return;}
  const epoch=this.epoch;this.place=place;this.open=true;
  if(!this.connected){this.initialized=false;await this.initialize(true);}
  if(epoch!==this.epoch||!this.open||!this.connected||this.pending)return;
  if(!this.contentReady){const c=await this.call('content');if(epoch!==this.epoch)return;this.contentReady=c?.status==='success'&&c.contentReady;}
  if(!this.contentReady){this.h.notice('当前没有可用任务（本地测试）；未发奖');return;}
  const shown=await this.call('show');if(epoch===this.epoch&&shown?.status==='success')this.h.notice('OfferWall 本地测试页面 · 不连接 Tapjoy、不执行真实任务');
 }
 dismiss(){this.open=false;this.contentReady=false;void this.claim();this.delayedAt=this.h.now()+SOURCE_OFFERWALL.dismissDelaySec*1000;}
 resume(){void this.claim();this.delayedAt=this.h.now()+SOURCE_OFFERWALL.resumeDelaySec*1000;}
 tick(){
  const now=this.h.now();
  if(this.claiming&&this.timeoutAt&&now>=this.timeoutAt){this.epoch++;this.pending=null;this.claiming=false;this.timeoutAt=0;this.again=false;this.h.notice('OfferWall 领取超过源20秒时限；迟到回调拒绝，待扣记录保留以恢复');}
  if(this.delayedAt&&now>=this.delayedAt){this.delayedAt=0;void this.claim();}
 }
 private commit(){
  const c=this.h.read();if(!c.saveLoaded){this.h.notice('待存档加载后恢复领取');return false;}
  let g:ReturnType<typeof sourceOfferWallGrant>;
  try{g=sourceOfferWallGrant(c.state,c.diamonds);}catch{this.saveFailed=true;this.h.notice('钻石余额超出安全范围；已确认扣款保留，未发奖');return false;}
  if(!g.granted)return false;
  try{this.h.write(g.state,g.diamonds);}catch{this.saveFailed=true;this.h.notice('扣款已确认，但钻石存档失败；重试不会重复扣款或发奖');return false;}
  this.saveFailed=false;this.h.notice(`本地测试钻石 +${g.diamonds-c.diamonds} 已保存 · 非线上收益`);return true;
 }
 async claim():Promise<boolean>{
  if(this.claiming){this.again=true;return false;}
  if(this.pending||!this.connected)return false;
  this.claiming=true;this.again=false;this.timeoutAt=this.h.now()+SOURCE_OFFERWALL.claimTimeoutSec*1000;
  const epoch=this.epoch,context=this.h.read().contextID;
  try{
   let c=this.h.read();
   // Durable confirmed local debit recovers before querying new currency, like RecoverPendingGem.
   if(c.state.pending&&c.state.localDebits.some(d=>d.id===c.state.pending!.id))return this.commit();
   let reservation=c.state.pending;
   if(!reservation){
    const b=await this.call('balance');if(b?.status!=='success'||epoch!==this.epoch||context!==this.h.read().contextID)return false;
    if(b.balance<=0){this.h.notice('本地测试任务余额为0；没有可领取钻石');return false;}
    c=this.h.read();reservation={id:this.h.requestID(),amount:b.balance,place:this.place};
    try{this.h.write({...c.state,pending:reservation},c.diamonds);}catch{this.saveFailed=true;this.h.notice('待扣记录保存失败；尚未扣款或发奖');return false;}
   }
   // Recovery reuses the saved request identity + original placement, never a fresh debit ID.
   const currentPlace=this.place;this.place=reservation.place;
   const r=await this.call('spend',reservation.amount,reservation.id);if(epoch!==this.epoch||context!==this.h.read().contextID)return false;this.place=currentPlace;
   if(r?.status!=='success'){
    // Source spend-failure clears PlayerPrefs; ambiguous transport failures keep the H5 reservation.
    if(r){c=this.h.read();if(!c.state.localDebits.some(d=>d.id===reservation!.id)){try{this.h.write({...c.state,pending:null},c.diamonds);}catch{this.saveFailed=true;}}}
    return false;
   }
   if(r.balance>0)this.again=true;
   return this.commit();
  }finally{
   if(epoch===this.epoch&&context===this.h.read().contextID){this.claiming=false;this.timeoutAt=0;const again=this.again;this.again=false;if(again&&!this.saveFailed)void this.claim();}
  }
 }
}
