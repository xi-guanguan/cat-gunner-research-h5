/** Monster_manager.Bonus_Get/SweepBonus_Get: additional base1x then exit/close.
 * Async ownership/ledger are explicit H5 adaptations, not online ad receipts. */
import {sourceHuntBonus,type SourceHuntState,type SourceHuntRun} from './r5-hunt';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export interface SourceHuntResultRewardState {hunt:SourceHuntState;petCoin:number;claims:string[]}
export interface SourceHuntResultRewardRequest extends SourceRewardRequest {kind:'ad';run:SourceHuntRun}
export function sourceHuntResultReward(s:SourceHuntResultRewardState,r:SourceHuntResultRewardRequest,response:SourceRewardResponse){
 const deny=(reason:string)=>({state:s,status:'blocked' as const,amount:0,reason});
 if(r.kind!=='ad'||r.purpose!=='hunt:bonus'||!r.id.trim()||!sourceRewardMatches(r,response))return deny('狩猎奖励回调身份不匹配；未发奖');
 if(s.claims.includes(r.id))return {state:s,status:'duplicate' as const,amount:0,reason:'本次狩猎奖励已领取'};
 if(response.status!=='success')return deny(response.status==='unavailable'?'广告服务未连接；未发宠物币':`本地测试广告${response.status==='cancelled'?'已取消':'失败'}；未发宠物币`);
 if(s.hunt.run!==r.run||r.run.phase!=='ended')return deny('狩猎结算已关闭或改变；未发宠物币');
 const bonus=sourceHuntBonus(s.hunt,true);
 if(bonus.status!=='supported')return deny('奖励已领取或自动加成已生效');
 const petCoin=s.petCoin+bonus.petCoinGrant;
 if(!Number.isSafeInteger(s.petCoin)||s.petCoin<0||!Number.isSafeInteger(bonus.petCoinGrant)||bonus.petCoinGrant<0||!Number.isSafeInteger(petCoin))throw RangeError('Hunt reward pet coin overflow');
 return {state:{hunt:bonus.value,petCoin,claims:[...s.claims,r.id]},status:'granted' as const,amount:bonus.petCoinGrant,reason:`本地测试广告奖励 · 追加 ${bonus.petCoinGrant} 宠物币`};
}
