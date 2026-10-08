/** Purchase/save owner shared by ordinary and isolated clients. Anti-replay,
 * late-context checks and storage retry are explicit H5 adapters, not native
 * payment or server receipt semantics. write MUST be synchronous and atomic. */
import {sourceRaidStarPigRequest,sourceRaidStarPigReward,sourceRaidStarPigGate,type SourceRaidStarPigState,type SourceRaidStarPigRequest} from './r6-raid-star-pig';
import type {SourceRewardResponse} from './r6-reward-provider';
export interface SourceRaidStarPigClientContext {state:SourceRaidStarPigState;starGem:number;historicMax:number;contextID:string}
export interface SourceRaidStarPigClientPorts {
 read():SourceRaidStarPigClientContext;
 write(state:SourceRaidStarPigState,starGem:number):void;
 execute(request:SourceRaidStarPigRequest):Promise<SourceRewardResponse>;
 requestID():string;
 notice(message:string):void;
}
export class SourceRaidStarPigClient {
 private epoch=0;private request:SourceRaidStarPigRequest|null=null;private recovery:{response:SourceRewardResponse;contextID:string}|null=null;
 constructor(private readonly ports:SourceRaidStarPigClientPorts){}
 get pending(){return this.request!==null;}
 get saveFailed(){return this.recovery!==null;}
 private notice(message:string){try{this.ports.notice(message);}catch{/* Presentation does not own a transaction. */}}
 invalidate(){this.epoch++;this.request=null;this.recovery=null;}
 async purchase():Promise<boolean>{
  const before=this.ports.read(),gate=sourceRaidStarPigGate(before.state,before.historicMax,this.pending);if(gate){this.notice(gate);return false;}
  const request=sourceRaidStarPigRequest(before.state,before.historicMax,this.ports.requestID());if(!request)return false;
  this.request=request;const epoch=this.epoch;this.notice('本地测试交易等待中 · 不真实支付');
  let response:SourceRewardResponse;
  try{response=await this.ports.execute(request);}catch(error){if(this.epoch===epoch&&this.request===request){this.request=null;this.notice(`本地测试交易异常：${String(error)}；未发奖`);}return false;}
  if(this.epoch!==epoch||this.request!==request)return false;
  return this.commit(response,before.contextID);
 }
 private commit(response:SourceRewardResponse,contextID:string):boolean{
  const request=this.request;if(!request)return false;
  const current=this.ports.read();if(current.contextID!==contextID){this.invalidate();this.notice('存档身份已变化；旧本地测试回调未发奖');return false;}
  const result=sourceRaidStarPigReward(current.state,current.starGem,request,response,current.historicMax);
  if(result.status!=='granted'){this.request=null;this.recovery=null;this.notice(result.reason);return false;}
  try{this.ports.write(result.state,result.starGem);}catch(error){this.recovery={response,contextID};this.notice(`存钱罐保存失败：${String(error)}；状态未提交，可重试同一回调，不再次交易`);return false;}
  this.request=null;this.recovery=null;this.notice(result.reason);return true;
 }
 retrySave():boolean {const r=this.recovery;return r?this.commit(r.response,r.contextID):false;}
}
