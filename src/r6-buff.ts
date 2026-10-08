/** Buff_manager.AddBuff/GetMult/BuffTickCoroutine; frame time, never offline wall time. */
import {type SourceBuffKind,type SourceBuffTimes} from './r5-entitlements';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export const SOURCE_BUFF_KINDS:readonly SourceBuffKind[]=['money','power','speed'];
export const SOURCE_BUFF_AD_TYPES={money:0,power:1,speed:14} as const;
export const freshSourceBuffTimes=():SourceBuffTimes=>({money:0,power:0,speed:0});
export function decodeSourceBuffTimes(value:unknown):SourceBuffTimes {
 if(value===undefined)return freshSourceBuffTimes();
 if(!value||typeof value!=='object'||SOURCE_BUFF_KINDS.some(k=>typeof (value as SourceBuffTimes)[k]!=='number'||!Number.isFinite((value as SourceBuffTimes)[k])))throw new Error('Invalid buff times');
 const v=value as SourceBuffTimes;return Object.fromEntries(SOURCE_BUFF_KINDS.map(k=>[k,Math.fround(Math.min(900,Math.max(0,v[k])))])) as unknown as SourceBuffTimes;
}
export function sourceAddBuff(times:SourceBuffTimes,kind:SourceBuffKind):SourceBuffTimes {
 if(!SOURCE_BUFF_KINDS.includes(kind))throw new RangeError('Invalid buff type');
 return {...times,[kind]:Math.min(900,Math.fround(times[kind]+300))};
}
export function sourceTickBuffTimes(times:SourceBuffTimes,delta:number,permanent:boolean):SourceBuffTimes {
 if(!Number.isFinite(delta)||delta<0)throw new RangeError('Invalid buff delta');
 if(permanent||delta===0||!SOURCE_BUFF_KINDS.some(k=>times[k]>0))return times;
 return Object.fromEntries(SOURCE_BUFF_KINDS.map(k=>[k,Math.max(0,Math.fround(times[k]-Math.fround(delta)))])) as unknown as SourceBuffTimes;
}
/** Source truncates minutes and fmodf(time,60) seconds. Permanent is localized here. */
export function sourceBuffTimeText(time:number):string {if(time<0)return '永久';return `${Math.floor(Math.fround(time/60))}:${String(Math.trunc(Math.fround(time)%60)).padStart(2,'0')}`;}
export interface SourceBuffRewardState {times:SourceBuffTimes;claimedRequestIDs:string[]}
export function sourceClaimBuffReward(state:SourceBuffRewardState,pending:SourceRewardRequest|null,response:SourceRewardResponse,kind:SourceBuffKind):{state:SourceBuffRewardState;status:'granted'|'duplicate'|'rejected'} {
 if(!pending||pending.kind!=='ad'||pending.purpose!==`buff:${kind}`||!sourceRewardMatches(pending,response)||response.status!=='success')return {state,status:'rejected'};
 if(state.claimedRequestIDs.includes(response.id))return {state,status:'duplicate'};
 return {state:{times:sourceAddBuff(state.times,kind),claimedRequestIDs:[...state.claimedRequestIDs,response.id]},status:'granted'};
}
