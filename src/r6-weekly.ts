import constants from './data/r6-weekly-constants.json';
import {sourceGun,GUN_INVENTORY_CAPACITY,type Session} from './session';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
import type {SourceEntitlements} from './r5-entitlements';
export const SOURCE_WEEKLY=constants;
export const SOURCE_PLUS_DURATION_MS=constants.plusDays*86400000;
export interface SourceWeeklyState {weekKey:number|null;purchaseCounts:number[];rewardClaims:string[];lastMenu:0|1;vipVisited:boolean}
export interface SourcePlusState {purchasedUTC:(number|null)[];rewardClaims:string[]}
export interface SourceWeeklyRequest extends SourceRewardRequest {item:number}
export const freshSourceWeekly=():SourceWeeklyState=>({weekKey:null,purchaseCounts:[0,0,0],rewardClaims:[],lastMenu:0,vipVisited:false});
export const freshSourcePlus=():SourcePlusState=>({purchasedUTC:[null,null,null],rewardClaims:[]});
const validItem=(i:number)=>Number.isInteger(i)&&i>=0&&i<3;
const validDate=(n:unknown)=>Number.isSafeInteger(n)&&Math.abs(n as number)<=8640000000000000;
const claimsOK=(v:unknown):boolean=>Array.isArray(v)&&v.every(x=>typeof x==='string'&&x.length>0)&&new Set(v).size===v.length;
export function validateSourceWeekly(s:SourceWeeklyState):void {
 if(!s||!(s.weekKey===null||Number.isSafeInteger(s.weekKey))||!Array.isArray(s.purchaseCounts)||s.purchaseCounts.length!==3||s.purchaseCounts.some(n=>!Number.isInteger(n)||n<0||n>2147483647)||!claimsOK(s.rewardClaims)||![0,1].includes(s.lastMenu)||typeof s.vipVisited!=='boolean'||s.weekKey===null&&s.purchaseCounts.some(Boolean))throw Error('Invalid weekly shop save');
}
export function validateSourcePlus(s:SourcePlusState):void {
 if(!s||!Array.isArray(s.purchasedUTC)||s.purchasedUTC.length!==3||s.purchasedUTC.some(n=>n!==null&&(!validDate(n)||n as number>8640000000000000-SOURCE_PLUS_DURATION_MS))||!claimsOK(s.rewardClaims))throw Error('Invalid PlusPack save');
}
/** Time_manager.Now = UtcNow + TimeZoneInfo.Local.GetUtcOffset, SpecifyKind(Local).
 * Use civil milliseconds: native DateTime.Date / subtraction does not apply DST elapsed-time corrections. */
export function sourceWeeklyCivilNow(localDate:Date):number {
 if(!Number.isFinite(localDate.getTime()))throw RangeError('Invalid weekly local date');
 const d=new Date(0);d.setUTCFullYear(localDate.getFullYear(),localDate.getMonth(),localDate.getDate());d.setUTCHours(localDate.getHours(),localDate.getMinutes(),localDate.getSeconds(),localDate.getMilliseconds());return d.getTime();
}
export function sourceWeekStart(localDate:Date):number {
 const civil=sourceWeeklyCivilNow(localDate),d=new Date(civil);d.setUTCHours(0,0,0,0);return d.getTime()-((d.getUTCDay()+6)%7)*86400000;
}
export const sourceWeekIndex=(d:Date)=>Math.trunc(Math.trunc((sourceWeekStart(d)-Date.UTC(2024,0,1))/86400000)/7);
export const sourceWeekOffset=(d:Date)=>((sourceWeekIndex(d)%5)+5)%5;
export const sourceWeeklyGun=(item:number,d:Date)=>validItem(item)?SOURCE_WEEKLY.gunBase[item]+sourceWeekOffset(d):-1;
export const sourceWeeklyRemaining=(d:Date)=>Math.max(0,sourceWeekStart(d)+7*86400000-sourceWeeklyCivilNow(d));
export function sourceWeeklyRefresh(session:Session,d:Date):Session {
 const s=session.weeklyShop??freshSourceWeekly(),weekKey=sourceWeekIndex(d);
 return s.weekKey===weekKey?session:{...session,weeklyShop:{...s,weekKey,purchaseCounts:[0,0,0]}};
}
export const sourceWeeklyVisible=(session:Session)=>(session.catalogSeen??[]).some(i=>i>=SOURCE_WEEKLY.entryDegree*5);
export const sourceWeeklyVIPUnlocked=(session:Session)=>session.historicMax>=SOURCE_WEEKLY.vipHistoricMax;
export function sourceWeeklyDefaultMenu(session:Session):0|1 {const s=session.weeklyShop??freshSourceWeekly();return !sourceWeeklyVIPUnlocked(session)?0:!s.vipVisited?1:s.lastMenu;}
export function sourceWeeklyVisit(session:Session,menu:0|1):Session {
 if(menu===1&&!sourceWeeklyVIPUnlocked(session))return session;
 const s=session.weeklyShop??freshSourceWeekly();return {...session,weeklyShop:{...s,lastMenu:menu,vipVisited:s.vipVisited||menu===1}};
}
export function sourceWeeklyPurchaseGate(session:Session,item:number,d:Date):string|undefined {
 if(!validItem(item))return '无效周枪档位';if(!sourceWeeklyVisible(session))return '获得A级或以上武器后开放周商店';
 const s=sourceWeeklyRefresh(session,d).weeklyShop!;
 if(s.purchaseCounts[item]>=SOURCE_WEEKLY.maximumPurchases[item])return '本周次数已用完，下周一刷新';
 if(session.gunInventory.length>=GUN_INVENTORY_CAPACITY)return '武器库存已满，请先整理';
}
export interface SourceWeeklyResult {status:'granted'|'blocked'|'duplicate';session:Session;petCoin:number;reason:string;gunID?:number}
/** Native ApplyReward refreshes at callback time, awards current-week gun, and does not recheck the cap.
 * H5 pending-request identity + persistent claims prevent duplicate fulfillment across week resets. */
export function sourceWeeklyReward(session:Session,petCoin:number,request:SourceWeeklyRequest,response:SourceRewardResponse,d:Date):SourceWeeklyResult {
 const s=session.weeklyShop??freshSourceWeekly(),deny=(reason:string):SourceWeeklyResult=>({status:'blocked',session,petCoin,reason});
 if((typeof request.id!=='string'||!request.id.trim())||!validItem(request.item)||request.kind!=='purchase'||request.purpose!==SOURCE_WEEKLY.products[request.item]||!sourceRewardMatches(request,response))return deny('周枪交易回调身份不匹配');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实商店未连接；未发奖励':`本地测试交易${response.status==='cancelled'?'已取消':'失败'}；未发奖励`);
 if(s.rewardClaims.includes(request.id))return {status:'duplicate',session,petCoin,reason:'重复回调；未重复发奖'};
 if(!Number.isSafeInteger(petCoin)||petCoin<0||!Number.isSafeInteger(petCoin+SOURCE_WEEKLY.petCoinRewards[request.item]))return deny('宠物币余额无效');
 const refreshed=sourceWeeklyRefresh(session,d),next=refreshed.weeklyShop!;
 if(session.gunInventory.length>=GUN_INVENTORY_CAPACITY)return {...deny('武器库存已满；未发枪、宠物币或登记购买'),session:refreshed};
 const gunID=sourceWeeklyGun(request.item,d),gun={...sourceGun(gunID),uid:`weekly:${request.id}`},counts=[...next.purchaseCounts];counts[request.item]++;
 return {status:'granted',gunID,petCoin:petCoin+SOURCE_WEEKLY.petCoinRewards[request.item],reason:'本地测试周枪与宠物币已发放；未发生真实支付',session:{...refreshed,weeklyShop:{...next,purchaseCounts:counts,rewardClaims:[...next.rewardClaims,request.id]},gunInventory:[...session.gunInventory,gun],catalogSeen:[...new Set([...(session.catalogSeen??[]),gunID])].sort((a,b)=>a-b),events:[{type:'gunDrawn',gun}]}};
}
const plusFlags=['plusPack0Active','plusPack1Active','plusPack2Active'] as const;
export function sourcePlusActive(s:SourcePlusState,item:number,nowUTC:number):boolean {const t=s.purchasedUTC[item];return validItem(item)&&t!==null&&t!==undefined&&nowUTC<t+SOURCE_PLUS_DURATION_MS;}
/** Missing purchase dates in an old save remain absent; never invent or shorten legacy entitlements. */
export function sourcePlusEntitlements(s:SourcePlusState,e:SourceEntitlements,nowUTC:number):SourceEntitlements {
 if(!validDate(nowUTC))throw RangeError('Invalid PlusPack clock');let next=e;
 plusFlags.forEach((key,i)=>{if(s.purchasedUTC[i]!==null){const active=sourcePlusActive(s,i,nowUTC);if(next[key]!==active)next={...next,[key]:active};}});return next;
}
export function sourcePlusPurchaseGate(session:Session,e:SourceEntitlements,item:number,nowUTC:number):string|undefined {
 if(!validItem(item))return '无效Plus档位';if(!sourceWeeklyVIPUnlocked(session))return '到达20大关后开放Plus页';
 if(sourcePlusEntitlements(session.plusPack??freshSourcePlus(),e,nowUTC)[plusFlags[item]])return '此Plus权益仍在有效期内';
}
export function sourcePlusReward(session:Session,e:SourceEntitlements,request:SourceWeeklyRequest,response:SourceRewardResponse,nowUTC:number):{status:'granted'|'blocked'|'duplicate';session:Session;entitlements:SourceEntitlements;reason:string} {
 const s=session.plusPack??freshSourcePlus(),deny=(reason:string)=>({status:'blocked' as const,session,entitlements:e,reason});
 if((typeof request.id!=='string'||!request.id.trim())||!validItem(request.item)||request.kind!=='purchase'||request.purpose!==SOURCE_WEEKLY.plusProducts[request.item]||!sourceRewardMatches(request,response)||!validDate(nowUTC)||nowUTC>8640000000000000-SOURCE_PLUS_DURATION_MS)return deny('Plus交易回调身份或时钟不匹配');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实商店未连接；未开通Plus':`本地测试交易${response.status==='cancelled'?'已取消':'失败'}；未开通Plus`);
 if(s.rewardClaims.includes(request.id))return {status:'duplicate',session,entitlements:e,reason:'重复回调；未延长Plus'};
 const purchasedUTC=[...s.purchasedUTC];purchasedUTC[request.item]=nowUTC;const plusPack={purchasedUTC,rewardClaims:[...s.rewardClaims,request.id]};
 return {status:'granted',session:{...session,plusPack},entitlements:sourcePlusEntitlements(plusPack,e,nowUTC),reason:'本地测试Plus已开通7天；无自动续费、无真实支付'};
}
