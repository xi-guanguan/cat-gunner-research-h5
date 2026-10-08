/** Shared first/reclaim/ticket boundary: current wallet, atomic save, epoch guard. */
import {freshSourceRaidMission,sourceRaidMissionRefresh,sourceRaidMissionClaim,sourceRaidMissionClaimAll,sourceRaidMissionTicketGate,sourceRaidMissionTicketRequest,sourceRaidMissionTicketReward,type SourceRaidMissionState,type SourceRaidMissionTicketRequest} from './r6-raid-mission';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceRewardResponse} from './r6-reward-provider';
export interface SourceRaidMissionClientPorts {read():{bundle:SourceMetaBundle;contextID:string};write(bundle:SourceMetaBundle):void;execute(request:SourceRaidMissionTicketRequest):Promise<SourceRewardResponse>;requestID():string;notice(text:string):void;ticketPopup?():void}
export class SourceRaidMissionClient {
 private epoch=0;private request:SourceRaidMissionTicketRequest|null=null;private recovery:{response:SourceRewardResponse;contextID:string}|null=null;
 constructor(private readonly ports:SourceRaidMissionClientPorts){}
 get pending(){return this.request!==null;}get saveFailed(){return this.recovery!==null;}
 private notice(text:string){try{this.ports.notice(text);}catch{/* UI cannot revoke commit. */}}
 invalidate(){this.epoch++;this.request=null;this.recovery=null;}
 private write(bundle:SourceMetaBundle,state:SourceRaidMissionState,granted=0):boolean {const balance=(bundle.session.starGem??0)+granted;if(!Number.isSafeInteger(balance)||balance<0){this.notice('任务余额超过存档范围；未部分发奖');return false;}try{this.ports.write({...bundle,session:{...bundle.session,starGem:balance},meta:{...bundle.meta,raidMission:state}});return true;}catch(error){this.notice(`突袭任务保存失败：${String(error)}；未提交，可重试，未重复发奖`);return false;}}
 claim(i:number,repeat=false):boolean {
  const {bundle}=this.ports.read();if(bundle.session.historicMax<390){this.notice('普通第40大关开放突袭任务');return false;}
  const r=sourceRaidMissionClaim(bundle.meta.raidMission??freshSourceRaidMission(),bundle.meta.raid,i,repeat);
  if(r.status!=='granted'){this.notice(r.reason);if(r.ticketPopup)this.ports.ticketPopup?.();return false;}
  if(!this.write(bundle,r.state,r.granted))return false;this.notice(r.reason);return true;
 }
 claimAll():boolean {const {bundle}=this.ports.read();if(bundle.session.historicMax<390){this.notice('普通第40大关开放突袭任务');return false;}const r=sourceRaidMissionClaimAll(bundle.meta.raidMission??freshSourceRaidMission(),bundle.meta.raid);if(!r.count){this.notice('没有可领取的突袭任务奖励');return false;}if(!this.write(bundle,r.state,r.granted))return false;this.notice(`已领取${r.count}项突袭任务奖励`);return true;}
 async purchase():Promise<boolean>{const before=this.ports.read(),s=before.bundle.meta.raidMission??freshSourceRaidMission(),raid=before.bundle.meta.raid;
  const gate=sourceRaidMissionTicketGate(s,raid,before.bundle.session.historicMax,this.pending);if(gate){this.notice(gate);return false;}
  const request=sourceRaidMissionTicketRequest(s,raid,before.bundle.session.historicMax,this.ports.requestID());if(!request)return false;const epoch=this.epoch;this.request=request;this.notice('本地测试任务票交易等待中 · 不真实支付');let response:SourceRewardResponse;
  try{response=await this.ports.execute(request);}catch(error){if(epoch===this.epoch&&this.request===request){this.request=null;this.notice(`本地测试交易异常：${String(error)}；未授予任务票`);}return false;}
  if(epoch!==this.epoch||this.request!==request)return false;return this.commit(response,before.contextID);
 }
 private commit(response:SourceRewardResponse,contextID:string):boolean {if(!this.request)return false;const {bundle,contextID:current}=this.ports.read();if(current!==contextID){this.invalidate();this.notice('存档身份已变化；旧任务票回调未授予');return false;}
  const r=sourceRaidMissionTicketReward(bundle.meta.raidMission??freshSourceRaidMission(),bundle.meta.raid,this.request,response,bundle.session.historicMax);
  if(r.status!=='granted'){this.request=null;this.recovery=null;this.notice(r.reason);return false;}
  if(!this.write(bundle,r.state)){this.recovery={response,contextID};return false;}
  this.request=null;this.recovery=null;this.notice(r.reason);return true;
 }
 retrySave(){const r=this.recovery;return r?this.commit(r.response,r.contextID):false;}
}
