/** Adventure host transactions, recovered manager ordering. H5 time/atomic persistence
 * adapters are explicit; this is not .NET date parsing or trusted-server time parity. */
import {ADVENTURE_UNLOCK_LEVELS,ADVENTURE_MAX_LEVEL,adventureEffectiveDurationHours,adventureGainExp,adventurePetSlotCount,adventureRefreshTickets,adventureRewardCore,adventureRewardExp,adventureUseTickets} from './r5-adventure';
import {sourcePetCanDispatch,sourcePetLock,sourcePetUnlockGroup,sourcePetWithIdentities,type SourcePetState} from './r5-pet';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export const ADVENTURE_TICKS_PER_SECOND=10_000_000n;
const HOUR=36_000_000_000n,DATE_MAX=3_155_378_975_999_999_999n,EPOCH=621_355_968_000_000_000n;
export interface SourceAdventureClock {nowTicks:bigint;dayOfWeek:number;dayKey:string;adapter:'h5-local-calendar'}
/** DateTime Now-equivalent civil coordinate, millisecond resolution; no implicit Date.parse. */
export function sourceAdventureLocalClock(date=new Date()):SourceAdventureClock {
 if(!Number.isFinite(date.getTime()))throw new RangeError('Invalid adventure local time');
 const nowTicks=BigInt(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate(),date.getHours(),date.getMinutes(),date.getSeconds(),date.getMilliseconds()))*10_000n+EPOCH;
 return {nowTicks,dayOfWeek:date.getDay(),dayKey:`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`,adapter:'h5-local-calendar'};
}
export interface SourceAdventureMap {entered:boolean;enteredTicks:bigint}
export interface SourceAdventureState {level:number;exp:number;cores:number[];tickets:number;lastChargeTicks:bigint|null;maps:SourceAdventureMap[][];adDayKey:string;adUseCount:number;rewardClaims:string[]}
export interface SourceDispatchPet {source:'owned'|'selected';index:number;/** Optional H5 stale selection guard; not an original save field. */uid?:string}
export interface SourceAdventureReward {type:number;index:number;core:number;exp:number;beforeLevel:number;beforeExp:number;afterLevel:number;afterExp:number}
export interface SourceAdventureResult {state:SourceAdventureState;pet:SourcePetState;status:'granted'|'blocked';reason:string;reward?:SourceAdventureReward;/** Original cancel/clear have no direct Save. H5 still persists its host envelope. */sourceDirectSave:boolean}
export const freshSourceAdventureState=():SourceAdventureState=>({level:0,exp:0,cores:[0,0,0,0],tickets:20,lastChargeTicks:null,maps:Array.from({length:3},()=>Array.from({length:5},()=>({entered:false,enteredTicks:0n}))),adDayKey:'',adUseCount:0,rewardClaims:[]});
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=2147483647;
const tick=(v:unknown):bigint=>{if(typeof v==='string'&&!/^(0|[1-9]\d*)$/.test(v)||!['string','bigint'].includes(typeof v))throw new TypeError('Invalid adventure ticks');const n=BigInt(v as string|bigint);if(n<0n||n>DATE_MAX)throw new RangeError('Invalid adventure ticks');return n;};
export function encodeSourceAdventureState(s:SourceAdventureState):unknown {return {...s,lastChargeTicks:s.lastChargeTicks?.toString()??null,maps:s.maps.map(g=>g.map(m=>({...m,enteredTicks:m.enteredTicks.toString()})))};}
export function decodeSourceAdventureState(value:unknown):SourceAdventureState {
 if(value===undefined)return freshSourceAdventureState();
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid adventure save');
 const s=value as SourceAdventureState;
 if(!integer(s.level)||s.level>15||!integer(s.exp)||!Array.isArray(s.cores)||s.cores.length!==4||!s.cores.every(integer)||!integer(s.tickets)||s.tickets>20||!Array.isArray(s.maps)||s.maps.length!==3||s.maps.some(g=>!Array.isArray(g)||g.length!==5)||typeof s.adDayKey!=='string'||s.adDayKey!==''&&!/^\d{8}$/.test(s.adDayKey)||!integer(s.adUseCount)||s.adUseCount>2||!Array.isArray(s.rewardClaims)||s.rewardClaims.some(id=>typeof id!=='string'||!id)||new Set(s.rewardClaims).size!==s.rewardClaims.length)throw new TypeError('Invalid adventure save');
 return {...s,cores:[...s.cores],rewardClaims:[...s.rewardClaims],lastChargeTicks:s.lastChargeTicks===null?null:tick(s.lastChargeTicks),maps:s.maps.map(g=>g.map(m=>{if(!m||typeof m.entered!=='boolean')throw new TypeError('Invalid adventure map');return {entered:m.entered,enteredTicks:tick(m.enteredTicks)};}))};
}
function mapAt(s:SourceAdventureState,type:number,index:number):SourceAdventureMap {if(!Number.isInteger(type)||type<0||type>2||!Number.isInteger(index)||index<0||index>4)throw new RangeError('Invalid adventure map');return s.maps[type][index];}
function withMap(s:SourceAdventureState,type:number,index:number,m:SourceAdventureMap):SourceAdventureState {return {...s,maps:s.maps.map((g,t)=>t===type?g.map((v,i)=>i===index?m:v):g)};}
export function sourceAdventureGroup(type:number,index:number):number {mapAt(freshSourceAdventureState(),type,index);return type*100+index;}
export function sourceAdventureGrades(p:SourcePetState,type:number,index:number):number[] {const group=sourceAdventureGroup(type,index);return [...p.owned.filter((g,i)=>g>=0&&p.ownedLocks[i]===group),...p.selected.filter((g,i)=>g>=0&&p.selectedLocks[i]===group)];}
export function sourceAdventureRemaining(s:SourceAdventureState,type:number,index:number,nowTicks:bigint,plus2:boolean):bigint {return mapAt(s,type,index).enteredTicks+BigInt(adventureEffectiveDurationHours(index,plus2))*HOUR-nowTicks;}
export function sourceAdventureMapStatus(s:SourceAdventureState,type:number,index:number,nowTicks:bigint,plus2:boolean):'locked'|'available'|'running'|'finished' {const m=mapAt(s,type,index);if(m.entered)return sourceAdventureRemaining(s,type,index,nowTicks,plus2)<=0n?'finished':'running';return s.level<ADVENTURE_UNLOCK_LEVELS[index]?'locked':'available';}
export function sourceAdventureRefresh(s:SourceAdventureState,nowTicks:bigint):SourceAdventureState {const t=adventureRefreshTickets(s,nowTicks);return t.tickets===s.tickets&&t.lastChargeTicks===s.lastChargeTicks?s:{...s,...t};}
const result=(state:SourceAdventureState,pet:SourcePetState,status:'granted'|'blocked',reason:string,sourceDirectSave=false):SourceAdventureResult=>({state,pet,status,reason,sourceDirectSave});
/** Entry popup pays selected count BEFORE manager unlock/entered/filter checks.
 * Day visibility is a UI gate, not fabricated as an independent manager guard. */
export function sourceAdventureStart(s:SourceAdventureState,p:SourcePetState,type:number,index:number,selected:readonly SourceDispatchPet[],clock:SourceAdventureClock):SourceAdventureResult {
 const m=mapAt(s,type,index);if(!selected.length)return result(s,p,'blocked','请先选择派遣宠物');
 const paid=adventureUseTickets(s,selected.length,clock.nowTicks);s={...s,...paid.state};
 if(!paid.used)return result(s,p,'blocked','探索票不足');
 if(m.entered)return result(s,p,'blocked','该地图已在探索；按源顺序已扣票');
 if(s.level<ADVENTURE_UNLOCK_LEVELS[index])return result(s,p,'blocked',`需要探索等级 ${ADVENTURE_UNLOCK_LEVELS[index]}；按源顺序已扣票`);
 p=sourcePetWithIdentities(p);const valid:SourceDispatchPet[]=[],seen=new Set<string>();
 for(const ref of selected){if(!ref||!['owned','selected'].includes(ref.source))continue;const key=`${ref.source}:${ref.index}`;if(seen.has(key))continue;seen.add(key);if(!sourcePetCanDispatch(p,ref.source,ref.index))continue;const id=(ref.source==='owned'?p.ownedIDs:p.selectedIDs)[ref.index];if(ref.uid!==undefined&&ref.uid!==id)continue;valid.push(ref);if(valid.length===3)break;}
 if(!valid.length)return result(s,p,'blocked','所选宠物已失效或被派遣锁定；按源顺序已扣票，不退还');
 for(const ref of valid){const r=sourcePetLock(p,ref.source,ref.index,sourceAdventureGroup(type,index));if(r.status==='supported')p=r.value;}
 return result(withMap(s,type,index,{entered:true,enteredTicks:clock.nowTicks}),p,'granted','宠物已派遣，探索开始',true);
}
export function sourceAdventureClaim(s:SourceAdventureState,p:SourcePetState,type:number,index:number,clock:SourceAdventureClock,plus2:boolean):SourceAdventureResult {
 const m=mapAt(s,type,index);if(!m.entered)return result(s,p,'blocked','尚未派遣或奖励已领取');if(sourceAdventureRemaining(s,type,index,clock.nowTicks,plus2)>0n)return result(s,p,'blocked','探索尚未结束');
 const grades=sourceAdventureGrades(p,type,index),core=adventureRewardCore(grades,index),exp=adventureRewardExp(grades.length,index),beforeLevel=s.level,beforeExp=s.exp;
 if(!integer(s.cores[type]+core))return result(s,p,'blocked','核心余额超出可保存范围');
 const gained=adventureGainExp(s,exp),cores=[...s.cores];cores[type]+=core;s=withMap({...s,...gained,cores},type,index,{...m,entered:false});const unlocked=sourcePetUnlockGroup(p,sourceAdventureGroup(type,index));if(unlocked.status==='supported')p=unlocked.value;
 return {...result(s,p,'granted',`探索完成：地区核心 +${core}，探索经验 +${exp}`,true),reward:{type,index,core,exp,beforeLevel,beforeExp,afterLevel:s.level,afterExp:s.exp}};
}
export function sourceAdventureCancel(s:SourceAdventureState,p:SourcePetState,type:number,index:number):SourceAdventureResult {const m=mapAt(s,type,index);if(!m.entered)return result(s,p,'blocked','该地图未在探索');const unlocked=sourcePetUnlockGroup(p,sourceAdventureGroup(type,index));return result(withMap(s,type,index,{...m,entered:false}),unlocked.status==='supported'?unlocked.value:p,'granted','已取消并解锁宠物；探索票不退还');}
/** ForceFinish: helper0x472f990 scale3,600,000ms; helper0x473004c scale1000ms.
 * Now - effective hours - ONE SECOND. No direct reward; separate claim required. */
export function sourceAdventureForceFinish(s:SourceAdventureState,p:SourcePetState,type:number,index:number,clock:SourceAdventureClock,plus2:boolean):SourceAdventureResult {const m=mapAt(s,type,index);if(!m.entered)return result(s,p,'blocked','该地图未在探索');return result(withMap(s,type,index,{...m,enteredTicks:clock.nowTicks-BigInt(adventureEffectiveDurationHours(index,plus2))*HOUR-ADVENTURE_TICKS_PER_SECOND}),p,'granted','探索已结束，请再领取奖励');}
export function sourceAdventureAutoSelect(s:SourceAdventureState,p:SourcePetState):SourceDispatchPet[] {
 p=sourcePetWithIdentities(p);const refs:SourceDispatchPet[]=[];
 for(const source of ['selected','owned'] as const)for(let index=0;index<(source==='owned'?16:3);index++)if(sourcePetCanDispatch(p,source,index))refs.push({source,index,uid:(source==='owned'?p.ownedIDs:p.selectedIDs)[index]!});
 refs.sort((a,b)=>(b.source==='owned'?p.owned:p.selected)[b.index]-(a.source==='owned'?p.owned:p.selected)[a.index]);
 return refs.slice(0,adventurePetSlotCount(s.level));
}
export function sourceAdventureDayCheck(s:SourceAdventureState,clock:SourceAdventureClock):SourceAdventureState {return s.adDayKey===clock.dayKey?s:{...s,adDayKey:clock.dayKey,adUseCount:0};}
export function sourceAdventureAdAble(s:SourceAdventureState,type:number,index:number,clock:SourceAdventureClock,plus2:boolean):boolean {const max=ADVENTURE_UNLOCK_LEVELS.filter(l=>l<=s.level).length-1;return !plus2&&index===max&&sourceAdventureMapStatus(s,type,index,clock.nowTicks,plus2)==='running'&&sourceAdventureDayCheck(s,clock).adUseCount<2;}
export interface SourceAdventureAdRequest extends SourceRewardRequest {type:number;index:number;enteredTicks:bigint}
/** Source callback clears pending BEFORE rechecking. Host also guards cancel/restart identity. */
export function sourceAdventureAdReward(s:SourceAdventureState,p:SourcePetState,req:SourceAdventureAdRequest,res:SourceRewardResponse,clock:SourceAdventureClock):SourceAdventureResult {
 if(!sourceRewardMatches(req,res)||req.kind!=='ad'||req.purpose!==`adventure:13:${req.type}:${req.index}`||res.status!=='success')return result(s,p,'blocked',`本地广告回调 ${res.status}，未减时`);
 if(s.rewardClaims.includes(req.id))return result(s,p,'blocked','广告回调已处理');const m=mapAt(s,req.type,req.index);
 if(!m.entered||m.enteredTicks!==req.enteredTicks)return result(s,p,'blocked','探索已取消、重启或时间已改变；旧广告回调作废');
 s=sourceAdventureDayCheck(s,clock);if(s.adUseCount>=2)return result(s,p,'blocked','今日广告减时次数已用完');
 return result(withMap({...s,adUseCount:s.adUseCount+1,rewardClaims:[...s.rewardClaims,req.id]},req.type,req.index,{...m,enteredTicks:m.enteredTicks-HOUR/2n}),p,'granted','本地测试广告：探索减时30分钟',true);
}
