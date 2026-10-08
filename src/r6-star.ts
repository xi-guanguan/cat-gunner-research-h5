import {BigValue,type BigValueInput} from './big-value';
import {sourceBossStarDamagePercent} from './r5-boss';
/** Source StarUpgrade_manager: one shared array for ordinary/Boss/Hunt/Raid slots. */
export const SOURCE_STAR_SLOT_COUNT=3;
export const SOURCE_STAR_MAX_LEVEL=20;
export const SOURCE_STAR_UNLOCK_STAGE=390;
// Exact 80-byte InitializeArray field, SHA256 AE520349...B1D4BCD. See round6/star-constants.json.
export const SOURCE_STAR_SUCCESS_RATES=[100,90,80,70,60,50,40,30,20,10,10,10,10,10,5,5,5,1,1,1] as const;
export interface SourceStarState {levels:number[];failCounts:number[];starGem:number}
export type SourceStarReason='invalid-slot'|'stage-required'|'max-level'|'insufficient-star-gem';
export interface SourceStarQuote {status:'supported'|'blocked';reason?:SourceStarReason;slot:number;level:number;nextLevel:number;cost:number;successRate:number;currentDamagePercent:BigValue;nextDamagePercent:BigValue}
export function freshSourceStarState():SourceStarState {return {levels:[0,0,0],failCounts:[0,0,0],starGem:0};}
export function validateSourceStarState(s:SourceStarState):void {
 if(!Array.isArray(s.levels)||s.levels.length!==3||s.levels.some(v=>!Number.isInteger(v)||v<0||v>20)||!Array.isArray(s.failCounts)||s.failCounts.length!==3||s.failCounts.some(v=>!Number.isInteger(v)||v<0||v>2147483647)||!Number.isInteger(s.starGem)||s.starGem<0||s.starGem>2147483647)throw new RangeError('Invalid StarUpgrade save state');
}
export const sourceStarUnlocked=(historicMax:number)=>historicMax>=SOURCE_STAR_UNLOCK_STAGE;
export function sourceStarCost(level:number):number {if(!Number.isInteger(level)||level<0||level>20)throw new RangeError('Invalid star level');return level===20?0:50*(level+1);}
export function sourceStarSuccessRate(level:number,failCount:number):number {
 if(!Number.isInteger(level)||level<0||level>20||!Number.isInteger(failCount)||failCount<0||failCount>2147483647)throw new RangeError('Invalid star level/failure count');
 if(level===20)return 0;const base=SOURCE_STAR_SUCCESS_RATES[level];return level+1>=18?Math.min(5,base+failCount):base;
}
export function sourceStarDamage(base:BigValueInput,level:number):BigValue {if(!Number.isInteger(level)||level<0||level>20)throw new RangeError('Invalid star level');const value=BigValue.from(base);return level===0?value:value.nativeMultiply(sourceBossStarDamagePercent(level)).nativeDivide(100);}
export function sourceStarQuote(s:SourceStarState,slot:number,historicMax:number):SourceStarQuote {
 validateSourceStarState(s);const valid=Number.isInteger(slot)&&slot>=0&&slot<3,level=valid?s.levels[slot]:0;
 const reason:SourceStarReason|undefined=!valid?'invalid-slot':!sourceStarUnlocked(historicMax)?'stage-required':level>=20?'max-level':s.starGem<sourceStarCost(level)?'insufficient-star-gem':undefined;
 return {status:reason?'blocked':'supported',reason,slot,level,nextLevel:Math.min(20,level+1),cost:sourceStarCost(level),successRate:valid?sourceStarSuccessRate(level,s.failCounts[slot]):0,currentDamagePercent:sourceBossStarDamagePercent(level),nextDamagePercent:sourceBossStarDamagePercent(Math.min(20,level+1))};
}
export interface SourceStarUpgrade {status:'supported'|'blocked';reason?:SourceStarReason;value:SourceStarState;resultCode:0|1|2|3|4;quote:SourceStarQuote;roll?:number;succeeded?:boolean}
/** Native Upgrade debits before Random.Range(0,100). The integer RNG is an explicit H5 adapter. */
export function sourceStarUpgrade(s:SourceStarState,slot:number,historicMax:number,randomInt:()=>number):SourceStarUpgrade {
 const quote=sourceStarQuote(s,slot,historicMax);
 if(quote.status==='blocked')return {status:'blocked',reason:quote.reason,quote,value:s,resultCode:quote.reason==='max-level'?2:quote.reason==='insufficient-star-gem'?3:4};
 const value={levels:[...s.levels],failCounts:[...s.failCounts],starGem:s.starGem-quote.cost};
 const roll=randomInt();if(!Number.isInteger(roll)||roll<0||roll>=100)throw new RangeError('Star Random.Range adapter must produce integer [0,100)');
 const succeeded=roll<quote.successRate;
 if(succeeded){value.levels[slot]++;value.failCounts[slot]=0;}else value.failCounts[slot]=Math.min(2147483647,value.failCounts[slot]+1);
 return {status:'supported',value,quote,roll,succeeded,resultCode:succeeded?0:1};
}
