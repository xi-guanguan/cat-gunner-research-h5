import constants from './data/r6-stepup-constants.json';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
import {sourceGun,GUN_INVENTORY_CAPACITY,type Session} from './session';
export const SOURCE_STEPUP=constants;
export const SOURCE_STEPUP_DURATION_MS=7*86400000;
export interface SourceStepUpState {purchased:boolean[];startedUTC:number|null;rewardClaims:string[]}
export interface SourceStepUpRequest extends SourceRewardRequest {step:number;startedUTC:number}
export function freshSourceStepUp():SourceStepUpState{return {purchased:Array(5).fill(false),startedUTC:null,rewardClaims:[]};}
export function validateSourceStepUp(s:SourceStepUpState):void {
 if(!s||!Array.isArray(s.purchased)||s.purchased.length!==5||s.purchased.some(v=>typeof v!=='boolean')||!(s.startedUTC===null||Number.isSafeInteger(s.startedUTC)&&Math.abs(s.startedUTC)<=8640000000000000)||!Array.isArray(s.rewardClaims)||s.rewardClaims.some(v=>typeof v!=='string'||!v)||new Set(s.rewardClaims).size!==s.rewardClaims.length||s.startedUTC===null&&(s.purchased.some(Boolean)||s.rewardClaims.length>0))throw Error('Invalid StepUp save');
}
const validStep=(i:number)=>Number.isInteger(i)&&i>=0&&i<5;
/** Native Is_Purchasable deliberately checks ownership/order only, not the timer. */
export const sourceStepUpPurchasable=(s:SourceStepUpState,i:number)=>validStep(i)&&!s.purchased[i]&&(i===0||s.purchased[i-1]);
export const sourceStepUpCurrent=(s:SourceStepUpState)=>s.purchased.findIndex((_,i)=>sourceStepUpPurchasable(s,i));
export function sourceStepUpRemaining(s:SourceStepUpState,nowUTC:number):number {return s.startedUTC===null?0:Math.max(0,s.startedUTC+SOURCE_STEPUP_DURATION_MS-nowUTC);}
export const sourceStepUpExpired=(s:SourceStepUpState,nowUTC:number)=>s.startedUTC!==null&&sourceStepUpRemaining(s,nowUTC)===0;
/** Gun_manager.Has_Degree_Or_Higher scans Gun_Collect from index 2*5, not the current inventory. */
export function sourceStepUpVisible(session:Session,nowUTC:number):boolean {
 const s=session.stepUp??freshSourceStepUp();return !s.purchased.every(Boolean)&&!sourceStepUpExpired(s,nowUTC)&&(session.catalogSeen??[]).some(i=>i>=10);
}
export function sourceStepUpStart(s:SourceStepUpState,nowUTC:number):SourceStepUpState {
 if(!Number.isSafeInteger(nowUTC)||Math.abs(nowUTC)>8640000000000000)throw RangeError('Invalid UTC time');
 return s.startedUTC===null?{...s,startedUTC:nowUTC}:s;
}
export function sourceStepUpReload(session:Session,nowUTC:number):Session {
 if(!sourceStepUpVisible(session,nowUTC))return session;
 const s=session.stepUp??freshSourceStepUp(),next=sourceStepUpStart(s,nowUTC);return s===next?session:{...session,stepUp:next};
}
export function sourceStepUpTimeText(s:SourceStepUpState,nowUTC:number):string {
 if(s.startedUTC===null)return '尚未开始';const ms=sourceStepUpRemaining(s,nowUTC);if(ms===0)return '已结束';const sec=Math.floor(ms/1000),days=Math.floor(sec/86400),hours=Math.floor(sec/3600)%24,minutes=Math.floor(sec/60)%60;
 return days>0?`${days}天 ${hours}小时`:sec>=3600?`${hours}小时 ${minutes}分`:`${minutes}分 ${sec%60}秒`;
}
export function sourceStepUpPurchaseGate(session:Session,step:number,nowUTC:number):string|undefined {
 const s=session.stepUp??freshSourceStepUp();
 if(!validStep(step))return '无效阶梯';if(s.purchased[step])return '已购买，不会重复发奖';
 // Entrance visibility checks expiry; a popup already open keeps native Is_Purchasable semantics.
 if(!(session.catalogSeen??[]).some(i=>i>=10))return '获得B级或以上武器后开放阶梯活动';
 if(s.startedUTC===null)return '活动尚未开始';if(!sourceStepUpPurchasable(s,step))return '先购买前一档';
 if(session.gunInventory.length>=GUN_INVENTORY_CAPACITY)return '武器库存已满，请先整理';
}
export interface SourceStepUpResult {status:'granted'|'blocked'|'duplicate';session:Session;reason:string;gunID?:number}
/** Source ApplyStepUpReward accepts an in-flight receipt after expiry; it does not re-check timer/order.
 * H5 additionally verifies the pending request identity and activity generation before committing atomically. */
export function sourceStepUpReward(session:Session,request:SourceStepUpRequest,response:SourceRewardResponse):SourceStepUpResult {
 const s=session.stepUp??freshSourceStepUp(),deny=(reason:string):SourceStepUpResult=>({status:'blocked',session,reason});
 if(!validStep(request.step)||request.kind!=='purchase'||request.purpose!==SOURCE_STEPUP.products[request.step]||!sourceRewardMatches(request,response)||s.startedUTC!==request.startedUTC)return deny('交易回调身份不匹配');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实商店未连接；未发奖励':`本地测试交易${response.status==='cancelled'?'已取消':'失败'}；未发奖励`);
 if(s.purchased[request.step]||s.rewardClaims.includes(request.id))return {status:'duplicate',session,reason:'已购买，不会重复发奖'};
 if(session.gunInventory.length>=GUN_INVENTORY_CAPACITY)return deny('武器库存已满；未发武器、钻石或登记购买');
 const gunID=SOURCE_STEPUP.gunRewards[request.step],gun={...sourceGun(gunID),uid:`stepup:${request.id}`},purchased=[...s.purchased];purchased[request.step]=true;
 return {status:'granted',gunID,reason:'本地测试交易奖励已发放；未发生真实支付',session:{...session,stepUp:{...s,purchased,rewardClaims:[...s.rewardClaims,request.id]},gunInventory:[...session.gunInventory,gun],diamonds:session.diamonds+SOURCE_STEPUP.diaRewards[request.step],catalogSeen:[...new Set([...(session.catalogSeen??[]),gunID])].sort((a,b)=>a-b),events:[{type:'gunDrawn',gun}]}};
}
