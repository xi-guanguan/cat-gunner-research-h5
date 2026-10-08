/** Shop_manager Core_* / ApplyCoreReward, 1.1.61 code257.
 * Source reads Time_manager.Now and three independent static DateTime slots.
 * Zero-value defaults are inferred; full source save initialization is NOT closed.
 * The H5 host explicitly uses local UTC milliseconds / null (never server time).
 * Daily is a rolling 24h cooldown; two weekly packs have independent rolling
 * 7d cooldowns, NOT the WeeklyShop Monday boundary. All seven credit core3.
 */
import contract from './data/r6-prism-contract.json';
import {contentGate} from './meta-progression';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export const SOURCE_PRISM=contract;
export interface SourcePrismState {lastPurchasedUTC:(number|null)[];rewardClaims:string[]}
export interface SourcePrismRequest extends SourceRewardRequest {item:number}
export interface SourcePrismResult {status:'granted'|'blocked';reason:string;state:SourcePrismState;cores:number[]}
const date=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&Math.abs(v)<=8640000000000000;
const itemOK=(i:number)=>Number.isInteger(i)&&i>=0&&i<7;
export const freshSourcePrism=():SourcePrismState=>({lastPurchasedUTC:[null,null,null],rewardClaims:[]});
export function decodeSourcePrism(raw:unknown):SourcePrismState {
 const s=raw as SourcePrismState;
 if(!s||!Array.isArray(s.lastPurchasedUTC)||s.lastPurchasedUTC.length!==3||s.lastPurchasedUTC.some(v=>v!==null&&!date(v))||!Array.isArray(s.rewardClaims)||s.rewardClaims.some(v=>typeof v!=='string'||!v)||new Set(s.rewardClaims).size!==s.rewardClaims.length)throw Error('Invalid core purchase extension');
 return {lastPurchasedUTC:[...s.lastPurchasedUTC],rewardClaims:[...s.rewardClaims]};
}
export function sourcePrismRemaining(state:SourcePrismState,item:number,nowUTC:number):number {
 if(!itemOK(item)||!date(nowUTC))throw RangeError('Invalid core shop item/clock');decodeSourcePrism(state);
 const last=item<4?null:state.lastPurchasedUTC[item-4];
 return last===null?0:Math.max(0,contract.cooldownHours[item]*3600000-(nowUTC-last));
}
export function sourcePrismGate(state:SourcePrismState,item:number,nowUTC:number,historicMax:number):string {
 if(!itemOK(item)||!date(nowUTC))return '无效商品或本地日期';
 try{decodeSourcePrism(state);}catch{return '无效核心购买状态；未发奖';}
 if(!Number.isSafeInteger(historicMax)||historicMax<0||!contentGate(historicMax,'adventure').unlocked)return '棱镜核心在第35大关的探索入口开放';
 return sourcePrismRemaining(state,item,nowUTC)>0?'该限购已领取，等待源24小时/7天间隔恢复':'';
}
export function sourcePrismReward(state:SourcePrismState,cores:number[],request:SourcePrismRequest,response:SourceRewardResponse,nowUTC:number,historicMax:number):SourcePrismResult {
 const blocked=(reason:string):SourcePrismResult=>({status:'blocked',reason,state,cores});
 const gate=sourcePrismGate(state,request.item,nowUTC,historicMax);if(gate)return blocked(gate);
 if(!Array.isArray(cores)||cores.length!==4||cores.some(v=>!Number.isSafeInteger(v)||v<0||v>0x7fffffff))return blocked('无效探索核心钱包；未发奖');
 if(!request.id||request.kind!=='purchase'||request.purpose!==contract.products[request.item]||!sourceRewardMatches(request,response))return blocked('交易回调身份不匹配；未发奖');
 if(state.rewardClaims.includes(request.id))return blocked('该本地测试交易已处理；未重复发奖');
 if(response.status!=='success')return blocked(response.status==='cancelled'?'本地测试交易已取消':response.status==='failure'?'本地测试交易失败':'真实商店未连接，本地测试 provider 不可用');
 const amount=contract.amounts[request.item],next=cores[3]+amount;if(!Number.isSafeInteger(next)||next>0x7fffffff)return blocked('棱镜核心余额超出源int32容量；未发奖');
 const lastPurchasedUTC=[...state.lastPurchasedUTC];if(request.item>=4)lastPurchasedUTC[request.item-4]=nowUTC;
 return {status:'granted',reason:`本地测试交易：获得 ${amount} 棱镜核心 · 未真实支付`,state:{lastPurchasedUTC,rewardClaims:[...state.rewardClaims,request.id]},cores:[...cores.slice(0,3),next]};
}
