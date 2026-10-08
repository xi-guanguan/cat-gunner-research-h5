/** Exact native8 mission rules, not online receipt/clock parity. See
 * raid-mission-native.txt and serialized contract; calendar comes from Raid. */
import source from './data/r6-raid-mission-contract.json';
import type {SourceRaidState} from './r6-raid';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export const SOURCE_RAID_MISSION=source;
export interface SourceRaidMissionState {seasonIndex:number;clear:boolean[];rewardGet:boolean[];rewardReGet:boolean[];ticketPurchased:boolean;ticketClaims:string[]}
export const freshSourceRaidMission=():SourceRaidMissionState=>({seasonIndex:-1,clear:Array(8).fill(false),rewardGet:Array(8).fill(false),rewardReGet:Array(8).fill(false),ticketPurchased:false,ticketClaims:[]});
export function decodeSourceRaidMission(raw:unknown):SourceRaidMissionState {
 if(!raw||typeof raw!=='object')throw Error('Invalid Raid Mission save');const s=raw as SourceRaidMissionState;
 const flags=(a:unknown)=>Array.isArray(a)&&a.length===8&&a.every(v=>typeof v==='boolean');
 if(!Number.isInteger(s.seasonIndex)||s.seasonIndex< -2147483648||s.seasonIndex>2147483647||![s.clear,s.rewardGet,s.rewardReGet].every(flags)||typeof s.ticketPurchased!=='boolean'||!Array.isArray(s.ticketClaims)||s.ticketClaims.some(v=>typeof v!=='string'||!v.trim())||new Set(s.ticketClaims).size!==s.ticketClaims.length)throw Error('Invalid Raid Mission save');
 return {...s,clear:[...s.clear],rewardGet:[...s.rewardGet],rewardReGet:[...s.rewardReGet],ticketClaims:[...s.ticketClaims]};
}
/** Season_Check clears native flags/ticket, not H5 request IDs. Refresh_Clear is
 * sticky, including legitimate saved try/best records, without awarding funds. */
export function sourceRaidMissionRefresh(s:SourceRaidMissionState,raid:SourceRaidState):SourceRaidMissionState {
 let next=s;if(s.seasonIndex!==raid.seasonIndex)next={...freshSourceRaidMission(),seasonIndex:raid.seasonIndex,ticketClaims:[...s.ticketClaims]};
 const clear=next.clear.map((v,i)=>v||sourceRaidMissionValue(raid,i)>=source.missions[i].goal);
 return clear.some((v,i)=>v!==next.clear[i])?{...next,clear}:next;
}
function index(i:number){if(!Number.isInteger(i)||i<0||i>=8)throw RangeError('Invalid Raid Mission index');return i;}
export function sourceRaidMissionValue(raid:SourceRaidState,i:number){return source.missions[index(i)].type===0?raid.tryCount:raid.bestLevel;}
export function sourceRaidMissionState(s:SourceRaidMissionState,i:number):0|1|2|3 {index(i);return !s.clear[i]?0:!s.rewardGet[i]?1:!s.rewardReGet[i]?2:3;}
export function sourceRaidMissionProgress(s:SourceRaidMissionState,raid:SourceRaidState,i:number){const goal=Math.max(source.missions[index(i)].goal,1),current=s.clear[i]?goal:Math.max(0,Math.min(goal,sourceRaidMissionValue(raid,i)));return {current,goal,fraction:Math.fround(Math.fround(current)/Math.fround(goal))};}
export function sourceRaidMissionOrder(s:SourceRaidMissionState):number[] {const priorities=s.ticketPurchased?source.sortPriority.owned:source.sortPriority.unowned;return Array.from({length:8},(_,i)=>i).sort((a,b)=>priorities[sourceRaidMissionState(s,a)]-priorities[sourceRaidMissionState(s,b)]||source.missions[a].type-source.missions[b].type||a-b);}
export const sourceRaidMissionHasClaimable=(s:SourceRaidMissionState)=>s.clear.some((_,i)=>{const state=sourceRaidMissionState(s,i);return state===1||state===2&&s.ticketPurchased;});
/** Getter counts all clear & unreclaimed, even BEFORE first claim. */
export const sourceRaidMissionReClaimableReward=(s:SourceRaidMissionState)=>s.clear.reduce((n,v,i)=>n+(v&&!s.rewardReGet[i]?source.missions[i].reward:0),0);
export function sourceRaidMissionClaim(s:SourceRaidMissionState,raid:SourceRaidState,i:number,repeat=false){
 const state=sourceRaidMissionRefresh(s,raid),deny=(reason:string,ticketPopup=false)=>({state,granted:0,status:'blocked' as const,reason,ticketPopup});
 if(!Number.isInteger(i)||i<0||i>=8)return deny('无效突袭任务');const v=sourceRaidMissionState(state,i);
 if(v===0)return deny('突袭任务条件未达成');if(!repeat&&v!==1||repeat&&v!==2)return deny('本次任务奖励已领取或需先领取首次奖励');
 if(repeat&&!state.ticketPurchased)return deny('需要本周任务追加奖励票',true);
 const flag=repeat?'rewardReGet':'rewardGet',values=[...state[flag]];values[i]=true;
 return {state:{...state,[flag]:values},granted:source.missions[i].reward,status:'granted' as const,reason:repeat?'突袭任务再次奖励已领取':'突袭任务首次奖励已领取',ticketPopup:false};
}
/** Original single pass: state1 gets first; state2 with ticket gets repeat;
 * first->second is NOT repeated during the same call. */
export function sourceRaidMissionClaimAll(s:SourceRaidMissionState,raid:SourceRaidState){let state=sourceRaidMissionRefresh(s,raid),granted=0,count=0;for(let i=0;i<8;i++){const v=sourceRaidMissionState(state,i);if(v===1||v===2&&state.ticketPurchased){const r=sourceRaidMissionClaim(state,raid,i,v===2);state=r.state;granted+=r.granted;if(r.status==='granted')count++;}}return {state,granted,count};}
export interface SourceRaidMissionTicketRequest extends SourceRewardRequest {kind:'purchase';seasonIndex:number}
export function sourceRaidMissionTicketGate(s:SourceRaidMissionState,raid:SourceRaidState,historicMax:number,pending=false):string {return historicMax<390?'普通第40大关开放突袭任务':pending?'正在等待任务票本地测试交易':raid.seasonIndex===-1?'本地赛季时钟尚未初始化':sourceRaidMissionRefresh(s,raid).ticketPurchased?'本周任务票已购买':'';}
export function sourceRaidMissionTicketRequest(s:SourceRaidMissionState,raid:SourceRaidState,historicMax:number,id:string):SourceRaidMissionTicketRequest|null {return !id.trim()||sourceRaidMissionTicketGate(s,raid,historicMax)?null:{id,kind:'purchase',purpose:source.product,seasonIndex:raid.seasonIndex};}
export function sourceRaidMissionTicketReward(s:SourceRaidMissionState,raid:SourceRaidState,r:SourceRaidMissionTicketRequest,response:SourceRewardResponse,historicMax:number){
 const state=sourceRaidMissionRefresh(s,raid),deny=(reason:string)=>({state,status:'blocked' as const,reason});
 if(!r.id?.trim()||r.kind!=='purchase'||r.purpose!==source.product||!sourceRewardMatches(r,response))return deny('任务票回调身份不匹配；未授予权益');
 if(state.ticketClaims.includes(r.id))return deny('本地任务票交易已处理；未重复授予');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实商店未连接；本地测试 provider 不可用':response.status==='cancelled'?'本地测试交易已取消；未授予任务票':'本地测试交易失败；未授予任务票');
 if(r.seasonIndex!==raid.seasonIndex)return deny('赛季已变化；旧本地回调不授予任务票（H5适配）');const gate=sourceRaidMissionTicketGate(state,raid,historicMax);if(gate)return deny(gate);
 return {state:{...state,ticketPurchased:true,ticketClaims:[...state.ticketClaims,r.id]},status:'granted' as const,reason:'本地测试交易：本周任务票已获得；未真实支付／线上未连接；奖励需手动领取'};
}
