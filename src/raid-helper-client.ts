/** One pending request, atomic synchronous save, no second provider on save retry. */
import {sourceRaidHelperGate,sourceRaidHelperRequest,sourceRaidHelperReward,type SourceRaidHelperRequest} from './r6-raid-helper';
import type {SourceRaidState} from './r6-raid';
import type {SourceRewardResponse} from './r6-reward-provider';
export interface SourceRaidHelperClientContext {state:SourceRaidState;historicMax:number;contextID:string}
export interface SourceRaidHelperClientPorts {
 read():SourceRaidHelperClientContext;write(state:SourceRaidState):void;
 execute(request:SourceRaidHelperRequest):Promise<SourceRewardResponse>;
 requestID():string;notice(message:string):void;
}
export class SourceRaidHelperClient {
 private epoch=0;private request:SourceRaidHelperRequest|null=null;private recovery:{response:SourceRewardResponse;contextID:string}|null=null;
 constructor(private readonly ports:SourceRaidHelperClientPorts){}
 get pending(){return this.request!==null;}get saveFailed(){return this.recovery!==null;}
 private notice(s:string){try{this.ports.notice(s);}catch{/* UI does not own commit. */}}
 invalidate(){this.epoch++;this.request=null;this.recovery=null;}
 async purchase():Promise<boolean>{
  const before=this.ports.read(),gate=sourceRaidHelperGate(before.state,before.historicMax,this.pending);if(gate){this.notice(gate);return false;}
  const request=sourceRaidHelperRequest(before.state,before.historicMax,this.ports.requestID());if(!request)return false;
  this.request=request;const epoch=this.epoch;this.notice('本地测试助手交易等待中 · 不真实支付');let response:SourceRewardResponse;
  try{response=await this.ports.execute(request);}catch(error){if(this.epoch===epoch&&this.request===request){this.request=null;this.notice(`本地测试交易异常：${String(error)}；未授予助手`);}return false;}
  if(this.epoch!==epoch||this.request!==request)return false;return this.commit(response,before.contextID);
 }
 private commit(response:SourceRewardResponse,contextID:string):boolean {
  const request=this.request;if(!request)return false;const current=this.ports.read();
  if(current.contextID!==contextID){this.invalidate();this.notice('存档身份已变化；旧助手回调未授予');return false;}
  const r=sourceRaidHelperReward(current.state,request,response,current.historicMax);
  if(r.status!=='granted'){this.request=null;this.recovery=null;this.notice(r.reason);return false;}
  try{this.ports.write(r.state);}catch(error){this.recovery={response,contextID};this.notice(`助手保存失败：${String(error)}；未提交，可重试保存，不再次交易`);return false;}
  this.request=null;this.recovery=null;this.notice(r.reason);return true;
 }
 retrySave(){const r=this.recovery;return r?this.commit(r.response,r.contextID):false;}
}
