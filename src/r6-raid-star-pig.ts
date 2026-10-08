/** StarGem_Pig 1.1.61. Not DiaPig/PetCoin. Original native constants and hooks:
 * raid-star-pig-contract.json. Only the transport/anti-replay checks are H5
 * local-provider adapters; no real purchase, server time or receipt. */
import source from './data/r6-raid-star-pig-contract.json';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export const SOURCE_RAID_STAR_PIG=source;
export interface SourceRaidStarPigState {lv:number;gem:number;purchaseCount:number;seasonIndex:number;rewardClaims:string[]}
export interface SourceRaidStarPigRequest extends SourceRewardRequest {lv:number;seasonIndex:number}
export const freshSourceRaidStarPig=():SourceRaidStarPigState=>({...source.initial,rewardClaims:[]});
const i32=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=-2147483648&&v<=2147483647;
export function decodeSourceRaidStarPig(raw:unknown):SourceRaidStarPigState {
 const s=raw as SourceRaidStarPigState;
 if(!s||!i32(s.lv)||s.lv<1||s.lv>3||!i32(s.gem)||s.gem<0||!i32(s.purchaseCount)||s.purchaseCount<0||!i32(s.seasonIndex)||!Array.isArray(s.rewardClaims)||s.rewardClaims.some(x=>typeof x!=='string'||!x.trim())||new Set(s.rewardClaims).size!==s.rewardClaims.length)throw Error('Invalid Raid StarGem pig extension');
 return {...s,rewardClaims:[...s.rewardClaims]};
}
const lvIndex=(lv:number)=>Math.max(1,Math.min(3,lv))-1;
export function sourceRaidStarPigView(s:SourceRaidStarPigState){
 const capacity=source.capacity[lvIndex(s.lv)],purchaseMax=source.purchaseMax[lvIndex(s.lv)],soldOut=s.lv>=3&&s.purchaseCount>=purchaseMax,full=s.gem>=capacity;
 return {capacity,purchaseMax,gemNow:Math.max(0,Math.min(s.gem,capacity)),fill:Math.fround(Math.max(0,Math.min(1,Math.fround(Math.fround(s.gem)/Math.fround(capacity))))),soldOut,full,purchasable:full&&!soldOut,product:source.productPrefix+s.lv,defaultPrice:source.defaultPrices[lvIndex(s.lv)],salePercent:source.salePercent[lvIndex(s.lv)]};
}
export function sourceRaidStarPigSeason(s:SourceRaidStarPigState,seasonIndex:number):SourceRaidStarPigState {
 if(!i32(seasonIndex))throw RangeError('Invalid Raid pig season');
 return s.seasonIndex===seasonIndex?s:{...s,lv:1,gem:0,purchaseCount:0,seasonIndex}; // transport ledger survives resets
}
export function sourceRaidStarPigAdd(s:SourceRaidStarPigState,amount:number):SourceRaidStarPigState {
 if(!i32(amount))throw RangeError('Invalid Raid pig fill');
 const view=sourceRaidStarPigView(s);if(amount<1||view.soldOut)return s;
 const gem=Math.min((s.gem+amount)|0,view.capacity);return gem===s.gem?s:{...s,gem};
}
export const sourceRaidStarPigEnter=(s:SourceRaidStarPigState,seasonIndex:number)=>sourceRaidStarPigAdd(sourceRaidStarPigSeason(s,seasonIndex),source.fillPerEntry);
export const sourceRaidStarPigBar=(s:SourceRaidStarPigState)=>sourceRaidStarPigAdd(s,source.fillPerBar);
export function sourceRaidStarPigGate(s:SourceRaidStarPigState,historicMax:number,pending=false):string {
 if(historicMax<390)return '普通第40大关开放突袭星宝石存钱罐';
 if(pending)return '正在等待星宝石存钱罐本地测试交易';
 const v=sourceRaidStarPigView(s);return v.soldOut?'本赛季星宝石存钱罐已售罄':!v.full?'星宝石存钱罐尚未装满；突袭入场与击破血条可积累':'';
}
/** Native ApplyReward always grants Capacity[productLv-1], even a different
 * productLv; only equal current lv consumes/promotes pig. This low-level native
 * consumer is kept separate from the safer local-provider request gate. */
export function sourceRaidStarPigApplyNative(s:SourceRaidStarPigState,productLv:number){
 if(!Number.isInteger(productLv)||productLv<1||productLv>3)throw RangeError('Invalid Raid pig product level');
 let state=s;if(productLv===s.lv){let purchaseCount=(s.purchaseCount+1)|0,lv=s.lv;if(productLv<=2&&purchaseCount>=sourceRaidStarPigView(s).purchaseMax){lv++;purchaseCount=0;}state={...s,lv,gem:0,purchaseCount};}
 return {state,amount:source.capacity[productLv-1]};
}
export function sourceRaidStarPigRequest(s:SourceRaidStarPigState,historicMax:number,id:string,pending=false):SourceRaidStarPigRequest|null {
 if(!id.trim()||sourceRaidStarPigGate(s,historicMax,pending))return null;
 return {id,kind:'purchase',purpose:sourceRaidStarPigView(s).product,lv:s.lv,seasonIndex:s.seasonIndex};
}
/** Caller owns a pending request object and current context generation. Those
 * identities must ALSO match before calling this transaction. Old-season and
 * changed-level responses are rejected explicitly, rather than fabricated as
 * source/online recovery of an actual payment. */
export function sourceRaidStarPigReward(s:SourceRaidStarPigState,starGem:number,request:SourceRaidStarPigRequest,response:SourceRewardResponse,historicMax:number){
 const deny=(reason:string)=>({state:s,starGem,status:'blocked' as const,reason,amount:0});
 if(!request.id?.trim()||request.kind!=='purchase'||!Number.isInteger(request.lv)||request.lv<1||request.lv>3||request.purpose!==source.productPrefix+request.lv||!sourceRewardMatches(request,response))return deny('星宝石存钱罐回调身份不匹配');
 if(s.rewardClaims.includes(request.id))return deny('本地测试交易已处理；未重复发奖');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实商店未连接；本地测试 provider 不可用':response.status==='cancelled'?'本地测试交易已取消；未发奖':'本地测试交易失败；未发奖');
 if(request.seasonIndex!==s.seasonIndex||request.lv!==s.lv)return deny('存钱罐赛季或等级已变化；旧本地回调不发奖');
 const gate=sourceRaidStarPigGate(s,historicMax);if(gate)return deny(gate);
 const reward=sourceRaidStarPigApplyNative(s,request.lv),next=starGem+reward.amount;
 if(!Number.isSafeInteger(starGem)||starGem<0||!Number.isSafeInteger(next)||next>2147483647)return deny('星宝石余额超出源 int32 范围；未发奖');
 return {state:{...reward.state,rewardClaims:[...s.rewardClaims,request.id]},starGem:next,status:'granted' as const,reason:`本地测试交易：获得 ${reward.amount} 星宝石，未真实支付／线上未连接`,amount:reward.amount};
}
