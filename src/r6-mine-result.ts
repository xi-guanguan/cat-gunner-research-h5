/** Source bonus arithmetic with explicit local provider and request-ledger validation. */
import {claimMineAdBonus,type MineSettlement} from './meta-progression';
import {sourceMineSweepAdBonus,type SourceSweepSettlement} from './source-meta-actions';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export interface SourceMineResultRewardState {diamonds:number;settlement:MineSettlement|null;sweep:SourceSweepSettlement|null;sweepSequence:number;claims:string[]}
export interface SourceMineResultRewardRequest extends SourceRewardRequest {kind:'ad';resultKind:'mine'|'sweep';sweepSequence:number}
export function sourceMineResultReward(s:SourceMineResultRewardState,r:SourceMineResultRewardRequest,response:SourceRewardResponse){
 const deny=(reason:string)=>({state:s,status:'blocked' as const,amount:0,reason});
 const purpose=r.resultKind==='mine'?'mine:bonus':'mine-sweep:bonus';
 if(r.purpose!==purpose||r.kind!=='ad'||!sourceRewardMatches(r,response))return deny('奖励回调身份不匹配；未发奖');
 if(s.claims.includes(r.id))return {state:s,status:'duplicate' as const,amount:0,reason:'本次奖励已领取'};
 if(response.status!=='success')return deny(response.status==='unavailable'?'广告服务未连接；未发奖':`本地测试广告${response.status==='cancelled'?'已取消':'失败'}；未发奖`);
 let diamonds=s.diamonds,settlement=s.settlement,sweep=s.sweep;
 if(r.resultKind==='mine'){
  if(!settlement)return deny('矿场尚未结算');
  const bonus=claimMineAdBonus(settlement,true);if(bonus.status!=='supported')return deny('本次奖励已领取');settlement=bonus.value;diamonds+=bonus.value.adExtraReward;
 }else{
  if(r.sweepSequence!==s.sweepSequence)return deny('扫荡批次已改变；未发奖');
  const bonus=sourceMineSweepAdBonus({diamonds,tickets:{used:0,storedDate:'1970-01-01'},bestReward:0,sweep},true);
  if(bonus.status!=='supported')return deny('本次扫荡奖励已领取或结算已关闭');diamonds=bonus.value.diamonds;sweep=bonus.value.sweep;
 }
 if(!Number.isSafeInteger(diamonds)||diamonds<0)throw RangeError('Mine reward diamond overflow');
 return {state:{...s,diamonds,settlement,sweep,claims:[...s.claims,r.id]},status:'granted' as const,amount:diamonds-s.diamonds,reason:`本地测试广告奖励 · 追加 ${diamonds-s.diamonds} 钻石`};
}
