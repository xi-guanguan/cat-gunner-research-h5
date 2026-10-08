/** Single-owner live Hunt wallet/save boundary. This bridge owns its host's
 * drain, applies ordered native settlements to the CURRENT bundle and leaves
 * all other systems untouched. No caller-supplied damage/results are accepted.
 * Save persists wave/level + receipts; source runtime run/pool is never saved.
 */
import {SourceHuntBattleRuntime,type SourceHuntBattleEvent} from './hunt-battle-runtime';
import {bindSourceHuntEquipment} from './hunt-equipment-binding';
import {sessionBossModifiers} from './session';
import {sourceRewardEntitlements} from './r5-entitlements';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
import type {SourceRawMovementStatSlots} from './cat-movement-source';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceHuntState} from './r5-hunt';
const snapshot=(s:SourceHuntState)=>JSON.stringify(s);
export interface SourceHuntBridgeCommit {bundle:SourceMetaBundle;events:SourceHuntBattleEvent[];granted:number;status:'applied'|'blocked';reason:string}
export interface SourceHuntBonusTicket {readonly request:SourceRewardRequest;readonly runID:string;readonly stateIdentity:string}
export class SourceHuntSessionBridge {
 readonly host:SourceHuntBattleRuntime;
 private expected:string;private valid=true;private bonusSequence=0;
 private pending:SourceHuntBonusTicket|null=null;
 private consumed=new Set<string>();
 constructor(readonly runID:string,b:SourceMetaBundle,movementStats:SourceRawMovementStatSlots){
  if(!runID.trim())throw RangeError('Missing Hunt run identity');
  if(b.session.mode!=='field'||b.session.historicMax<110)throw Error('狩猎在第12大关开放，请返回普通场景');
  if(b.meta.hunt.run)throw Error('请先关闭上次狩猎结算');
  this.expected=snapshot(b.meta.hunt);
  this.host=new SourceHuntBattleRuntime(runID,b.meta.hunt,bindSourceHuntEquipment(b.session),sourceRewardEntitlements(b.meta.entitlements),sessionBossModifiers(b.session,b.meta.entitlements,b.meta.fish,b.meta.buffTimes,b.meta.relic),movementStats);
 }
 /** Ordered, one-shot consumption. A stale/reset/loaded bundle cannot receive
  * a previous world's coins. Caller must atomically save returned envelope. */
 commit(b:SourceMetaBundle):SourceHuntBridgeCommit {
  const events=this.host.drainEvents();let current=b,granted=0;
  const block=(reason:string):SourceHuntBridgeCommit=>{this.cancel();return {bundle:b,events,granted:0,status:'blocked',reason};};
  if(!this.valid||snapshot(b.meta.hunt)!==this.expected)return block('狩猎运行身份已失效；不写入其他存档');
  for(const event of events){if(event.kind!=='settlement')continue;
   if(this.consumed.has(event.requestID)||(current.meta.huntSettlementClaims??[]).includes(event.requestID))return block('重复狩猎结算身份；未重复发奖');
   const amount=event.result.petCoinGrant,next=current.meta.petCoin+amount;
   if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(next)||next<0)throw RangeError('Hunt wallet overflow');
   current={...current,meta:{...current.meta,hunt:event.result.value,petCoin:next,huntSettlementClaims:[...(current.meta.huntSettlementClaims??[]),event.requestID]}};granted+=amount;
  }
  // Mutate internal receipt state only after the whole ordered batch validates.
  for(const event of events)if(event.kind==='settlement')this.consumed.add(event.requestID);
  this.expected=snapshot(current.meta.hunt);
  return {bundle:current,events,granted,status:'applied',reason:''};
 }
 beginBonus():SourceHuntBonusTicket|null {
  const state=this.host.state;
  if(!this.valid||this.pending||this.host.phase!=='ended'||!state.run||state.run.automaticBonus||state.run.bonusClaimed)return null;
  return this.pending={request:{id:`${this.runID}:ad:${++this.bonusSequence}`,kind:'ad',purpose:'hunt:bonus'},runID:this.runID,stateIdentity:snapshot(state)};
 }
 finishBonus(ticket:SourceHuntBonusTicket,response:SourceRewardResponse):{status:'applied'|'blocked';reason:string} {
  if(!this.valid||this.pending!==ticket||ticket.runID!==this.runID)return {status:'blocked',reason:'狩猎广告请求已过期或已处理；未发奖'};
  this.pending=null;
  if(!sourceRewardMatches(ticket.request,response))return {status:'blocked',reason:'狩猎广告回调身份不匹配；未发奖'};
  if(response.status!=='success')return {status:'blocked',reason:response.status==='unavailable'?'广告服务未连接；未发奖':`本地测试广告${response.status==='cancelled'?'已取消':'失败'}；未发奖`};
  if(this.host.phase!=='ended'||snapshot(this.host.state)!==ticket.stateIdentity)return {status:'blocked',reason:'狩猎结算已改变；旧广告不发奖'};
  const result=this.host.bonus(true);return result.status==='supported'?{status:'applied',reason:'本地测试广告奖励；非线上回执'}:{status:'blocked',reason:result.reason};
 }
 cancel():void {this.valid=false;this.pending=null;}
}
