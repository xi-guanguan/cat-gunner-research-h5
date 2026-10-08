/** Mine_Start_UI.AD_SpeedBuff_Watch -> Admob(type14) -> AddBuff(2) -> Game_Start.
 * H5 keeps its existing pre-entry selection: commit the buff and one ticket together.
 * Source animation/ticket-before-panel order still requires native same-state evidence. */
import {startMine,type Session} from './session';
import {contentGate} from './meta-progression';
import {localMineTime,type MineTimeAdapter} from './mine-time';
import {refreshSourceMineTickets} from './mine-source';
import {sourceBuffMultiplier,type SourceEntitlements,type SourceBuffTimes} from './r5-entitlements';
import {sourceClaimBuffReward,type SourceBuffRewardState} from './r6-buff';
import type {SourceRewardRequest,SourceRewardResponse} from './r6-reward-provider';
import type {SourceFishState} from './r5-fish';
import type {SourcePetState} from './r5-pet';
export function sourceMineSpeedEntryGate(session:Session,e:SourceEntitlements,times:SourceBuffTimes,time:MineTimeAdapter=localMineTime):string|undefined {
 if(session.mode!=='field'||session.overlay!=='mine')return '矿场入口已关闭；未开采';
 if(!contentGate(session.historicMax,'mine').unlocked)return '普通第4大关开放矿场';
 const today=time.today(),r=refreshSourceMineTickets(session.mine.tickets,today,time.canRolloverDaily(3,session.mine.tickets.storedDate,today));
 if(r.status!=='supported')return '矿场日期暂不可用';
 if(r.state.used>=(e.minePack?6:2))return '今日矿场次数已用完';
 if(sourceBuffMultiplier(e,'speed',times)>1)return '速度增益已生效，请直接进入矿场';
}
export function sourceMinePlusBannerVisible(historicMax:number,e:SourceEntitlements):boolean {
 // MinePack popup must be inactive; Shop_manager.MinePack flag, PlusPack.Is_Banner_Stage_OK (>189), inactive Reward pack.
 return e.minePack&&historicMax>=190&&!e.plusPack1Active;
}
export interface SourceMineSpeedState {session:Session;reward:SourceBuffRewardState}
export function sourceMineSpeedEntryReward(state:SourceMineSpeedState,e:SourceEntitlements,pending:SourceRewardRequest|null,response:SourceRewardResponse,time:MineTimeAdapter=localMineTime,fish?:SourceFishState,pet?:SourcePetState):{status:'granted'|'duplicate'|'blocked';state:SourceMineSpeedState;reason:string} {
 const claim=sourceClaimBuffReward(state.reward,pending,response,'speed');
 if(claim.status==='duplicate')return {status:'duplicate',state,reason:'重复矿场广告回调；未重复开采或发增益'};
 if(claim.status!=='granted')return {status:'blocked',state,reason:response.status==='unavailable'?'真实广告服务未连接；未扣次数或发增益':`广告回调 ${response.status} 或身份不匹配；未扣次数或发增益`};
 const reason=sourceMineSpeedEntryGate(state.session,e,state.reward.times,time);if(reason)return {status:'blocked',state,reason};
 const session=startMine(state.session,time,e.minePack,e,fish,pet,claim.state.times);
 if(session.mode!=='mine')return {status:'blocked',state,reason:session.notice||'矿场入场未提交；未发增益'};
 return {status:'granted',state:{session,reward:claim.state},reason:'本地测试广告奖励：速度增益已生效，矿场开采已提交'};
}
