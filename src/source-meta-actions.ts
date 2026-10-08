/** Native evidence-backed pure meta actions. Callers own UI, save and provider receipts. */
import {enterSourceMine, type MineTicketState} from './mine-source';

export type MetaActionResult<T> = {status:'supported';value:T} | {status:'blocked';reason:string} | {status:'unsupported';reason:string};
const int=(n:number,name:string,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(n)||n<0||n>max)throw new RangeError(`Invalid ${name}`);return n;};
const sum=(a:number,b:number)=>int(a+b,'balance');
export interface SourceSweepSettlement {rewardValue:number;initialReward:number;totalReward:number;automaticBonus:boolean;bonusClaimed:boolean;pending:boolean}
export interface SourceSweepState {diamonds:number;tickets:MineTicketState;bestReward:number;sweep:SourceSweepSettlement|null}
export interface SourceSweepOptions {plusPack2Active:boolean|null;plusPack1Active:boolean|null;minePack:boolean|null;automaticBonus:boolean|null;trustedToday:string|null;canRolloverDaily:boolean|null}
export function sourceMineSweepGate(bestReward:number,plusPack2Active:boolean|null):MetaActionResult<true> {
  int(bestReward,'best reward',2147483647);
  if(plusPack2Active===null)return {status:'unsupported',reason:'plus-pack-2-unknown'};
  if(!plusPack2Active||bestReward===0)return {status:'blocked',reason:!plusPack2Active?'plus-pack-2-required':'best-reward-required'};
  return {status:'supported',value:true};
}
export type SourceSweepResult = {status:'granted'|'blocked';state:SourceSweepState;recordDailyGain:boolean;showMinePackPurchase:boolean;missionEvent:{type:3;amount:1}|null;reason?:string} | {status:'unsupported';reason:string};
/** Gate precedes Ticket_Reload. Only success pays, consumes and emits mission type3. */
export function sourceMineSweep(state:SourceSweepState,options:SourceSweepOptions):SourceSweepResult {
  int(state.diamonds,'diamonds');const gate=sourceMineSweepGate(state.bestReward,options.plusPack2Active);
  if(gate.status==='unsupported')return gate;
  if(gate.status==='blocked')return {status:'blocked',state,reason:gate.reason,recordDailyGain:false,showMinePackPurchase:false,missionEvent:null};
  if(options.plusPack1Active===null||options.automaticBonus===null)return {status:'unsupported',reason:'mine-reward-entitlement-unknown'};
  const base=Math.trunc(Math.fround(Math.fround(state.bestReward)*Math.fround(options.plusPack1Active?1.5:1)));
  if(base>2147483647/4)return {status:'unsupported',reason:'native-int32-reward-overflow-domain'};
  const entry=enterSourceMine(state.tickets,options.minePack,options.trustedToday,options.canRolloverDaily);
  if(entry.status==='unsupported')return entry;
  if(entry.status==='blocked')return {status:'blocked',state:{...state,tickets:entry.state},reason:'tickets-exhausted',recordDailyGain:entry.recordDailyGain,showMinePackPurchase:entry.showMinePackPurchase,missionEvent:null};
  const initial=base*(options.automaticBonus?4:1);
  const sweep:SourceSweepSettlement={rewardValue:base,initialReward:initial,totalReward:initial,automaticBonus:options.automaticBonus,bonusClaimed:options.automaticBonus,pending:true};
  return {status:'granted',state:{...state,tickets:entry.state,diamonds:sum(state.diamonds,initial),sweep},recordDailyGain:entry.recordDailyGain,showMinePackPurchase:false,missionEvent:{type:3,amount:1}};
}
/** Confirmed reward callback only. Adapter idempotency prevents duplicate 3x callbacks. */
export function sourceMineSweepAdBonus(state:SourceSweepState,adConfirmed:boolean):MetaActionResult<SourceSweepState> {
  int(state.diamonds,'diamonds');const s=state.sweep;
  if(!adConfirmed)return {status:'blocked',reason:'ad-unconfirmed'};
  if(!s?.pending||s.bonusClaimed)return {status:'blocked',reason:'sweep-bonus-unavailable'};
  const extra=3*int(s.rewardValue,'sweep reward');
  return {status:'supported',value:{...state,diamonds:sum(state.diamonds,extra),sweep:{...s,totalReward:sum(s.totalReward,extra),bonusClaimed:true,pending:false}}};
}
export function sourceMineSweepClose(state:SourceSweepState):SourceSweepState {return state.sweep?{...state,sweep:{...state.sweep,pending:false}}:state;}

export interface SourcePassProgress {level:number;exp:number;vip:boolean;luxury:boolean;normalClaims:boolean[];epicClaims:boolean[];pendingAdRewardIndex:number}
/** Exp_Get stops at level25; the transition to25 retains the remaining exp. */
export function sourcePassExpGet<T extends SourcePassProgress>(state:T,amount:number):T {
  int(state.level,'pass level',25);int(state.exp,'pass exp',2147483647);int(amount,'exp reward',2147483647);
  if(state.level===25)return state;
  let level=state.level,exp=sum(state.exp,amount);
  while(exp>=100&&level<25){exp-=100;level++;}
  return {...state,level,exp};
}
export interface SourceSeasonPassPurchaseState {diamonds:number;pass:SourcePassProgress;consumedReceipts:string[]}
export type SourceSeasonPassKind='vip'|'luxury'|'luxury-upgrade';
/** Provider confirmation is required. Receipt deduplication is an H5 adapter guarantee. */
export function sourceApplySeasonPass(state:SourceSeasonPassPurchaseState,kind:SourceSeasonPassKind,options:{confirmed:boolean;receiptId:string}):MetaActionResult<SourceSeasonPassPurchaseState> {
  int(state.diamonds,'diamonds');
  if(!options.confirmed)return {status:'blocked',reason:'purchase-unconfirmed'};
  if(!options.receiptId.trim())return {status:'unsupported',reason:'receipt-id-required'};
  if(state.consumedReceipts.includes(options.receiptId))return {status:'blocked',reason:'receipt-already-applied'};
  if(!['vip','luxury','luxury-upgrade'].includes(kind))return {status:'unsupported',reason:'purchase-kind-unknown'};
  const luxury=kind!=='vip';
  const pass=sourcePassExpGet({...state.pass,vip:true,luxury:state.pass.luxury||luxury},luxury?300:0);
  return {status:'supported',value:{diamonds:sum(state.diamonds,luxury?1000:500),pass,consumedReceipts:[...state.consumedReceipts,options.receiptId]}};
}
export type SourcePassTrack=0|1;
export interface SourcePassClaimOptions {adConfirmed:boolean;adRemoved:boolean|null}
/** Sequence is shared across both tracks whenever VIP is active. */
export function sourcePassClaimGate(state:SourcePassProgress,track:SourcePassTrack,index:number,options:SourcePassClaimOptions):MetaActionResult<{requiresAd:boolean}> {
  int(state.level,'pass level',25);
  if((track!==0&&track!==1)||!Number.isInteger(index)||index<0||index>=state.normalClaims.length||index>=state.epicClaims.length)return {status:'blocked',reason:'reward-index-unknown'};
  if(track===1&&!state.vip)return {status:'blocked',reason:'vip-required'};
  if((track===0?state.normalClaims:state.epicClaims)[index])return {status:'blocked',reason:'already-claimed'};
  if(state.level<=index)return {status:'blocked',reason:'level-required'};
  for(let i=0;i<index;i++)if(!state.normalClaims[i]||(state.vip&&!state.epicClaims[i]))return {status:'blocked',reason:'previous-reward-required'};
  const slotRequiresAd=track===0&&index>=3&&index%3===0;
  if(slotRequiresAd&&options.adRemoved===null)return {status:'unsupported',reason:'ad-removal-entitlement-unknown'};
  const requiresAd=slotRequiresAd&&!options.adRemoved;
  if(requiresAd&&!options.adConfirmed)return {status:'blocked',reason:'ad-unconfirmed'};
  return {status:'supported',value:{requiresAd}};
}
/** Pure consumer must return a new wallet/inventory on success, null on failure. Commit both together. */
export function sourceClaimPassReward<W>(pass:SourcePassProgress,wallet:W,track:SourcePassTrack,index:number,options:SourcePassClaimOptions,consume:(wallet:W,track:SourcePassTrack,index:number)=>W|null):MetaActionResult<{pass:SourcePassProgress;wallet:W}> {
  const gate=sourcePassClaimGate(pass,track,index,options);if(gate.status!=='supported')return gate;
  const next=consume(wallet,track,index);if(next===null)return {status:'blocked',reason:'reward-consumer-failed'};
  const key=track===0?'normalClaims':'epicClaims';const claims=[...pass[key]];claims[index]=true;
  return {status:'supported',value:{pass:{...pass,[key]:claims},wallet:next}};
}
export interface SourceMissionClaim {normal:boolean;luxury:boolean}
export interface SourceSeasonState extends SourcePassProgress {seasonNumber:number;seasonStarted:boolean;gunSeason:boolean;seasonEnd:string|null;missionStart:string|null;counters:[number,number,number,number];missionClaims:SourceMissionClaim[]}
const roundEven=(value:number)=>{const low=Math.floor(value),part=value-low;return part<0.5?low:part>0.5?low+1:low%2===0?low:low+1;};
/** Normal reward was already granted. Luxury only grants its own rounded50% exp once. */
export function sourceClaimLuxuryMission(state:SourceSeasonState,index:number,rewardExp:number):MetaActionResult<{state:SourceSeasonState;grantedExp:number}> {
  int(rewardExp,'mission exp',2147483647);const claim=state.missionClaims[index];
  if(!Number.isInteger(index)||index<0||!claim)return {status:'blocked',reason:'mission-index-unknown'};
  if(!claim.normal)return {status:'blocked',reason:'normal-mission-reward-required'};
  if(claim.luxury)return {status:'blocked',reason:'already-claimed'};
  if(!state.luxury)return {status:'blocked',reason:'luxury-required'};
  const grantedExp=roundEven(Math.fround(Math.fround(rewardExp)*Math.fround(0.5)));
  const missionClaims=state.missionClaims.map((c,i)=>i===index?{...c,luxury:true}:c);
  return {status:'supported',value:{state:sourcePassExpGet({...state,missionClaims},grantedExp),grantedExp}};
}
export function sourceMissionReset(state:SourceSeasonState,trustedNow:string|null):MetaActionResult<SourceSeasonState> {
  if(!trustedNow)return {status:'unsupported',reason:'trusted-now-required'};
  return {status:'supported',value:{...state,missionStart:trustedNow,counters:[0,0,0,0],missionClaims:state.missionClaims.map(()=>({normal:false,luxury:false}))}};
}
/** Caller supplies the source time calculation; this module does not guess season length. */
export function sourceSeasonReset(state:SourceSeasonState,options:{incrementSeason:boolean;recordGain:boolean;trustedNow:string|null;nextSeasonEnd:string|null}):MetaActionResult<{state:SourceSeasonState;recordSeasonGain:boolean;reapplyRewardBalance:true}> {
  int(state.seasonNumber,'season number',2147483646);
  if(!options.nextSeasonEnd)return {status:'unsupported',reason:'source-next-season-end-required'};
  const mission=sourceMissionReset(state,options.trustedNow);if(mission.status!=='supported')return mission;
  return {status:'supported',value:{state:{...mission.value,seasonNumber:state.seasonNumber+(options.incrementSeason?1:0),seasonStarted:true,gunSeason:true,seasonEnd:options.nextSeasonEnd,pendingAdRewardIndex:-1,level:0,exp:0,vip:false,luxury:false,normalClaims:state.normalClaims.map(()=>false),epicClaims:state.epicClaims.map(()=>false)},recordSeasonGain:options.recordGain,reapplyRewardBalance:true}};
}

export interface SourceDailyGunState<G> {lastDailyGunKey:string|null;inventory:(G|null)[]}
export interface SourceDailyGunOptions {serverWeapon01AdOn:boolean|null;historicStage:number;trustedTodayKey:string|null;adConfirmed:boolean;roll:number}
export function sourceDailyGunGate(lastDailyGunKey:string|null,options:Pick<SourceDailyGunOptions,'serverWeapon01AdOn'|'historicStage'|'trustedTodayKey'>):MetaActionResult<true> {
  int(options.historicStage,'historic stage');
  if(options.serverWeapon01AdOn===null)return {status:'unsupported',reason:'weapon01-ad-server-config-unknown'};
  if(!options.serverWeapon01AdOn)return {status:'blocked',reason:'weapon01-ad-disabled'};
  if(options.historicStage<30)return {status:'blocked',reason:'historic-stage30-required'};
  if(!options.trustedTodayKey)return {status:'unsupported',reason:'trusted-daily-gun-key-required'};
  if(lastDailyGunKey===options.trustedTodayKey)return {status:'blocked',reason:'daily-gun-already-claimed'};
  return {status:'supported',value:true};
}
/** DrawRandomGun(1): first empty slot, gunId5..9, then date commit. Duplicate gunIds remain entities. */
export function sourceClaimDailyGun<G>(state:SourceDailyGunState<G>,options:SourceDailyGunOptions,createGun:(gunId:number,slot:number)=>G):MetaActionResult<{state:SourceDailyGunState<G>;gunId:number;slot:number}> {
  const gate=sourceDailyGunGate(state.lastDailyGunKey,options);if(gate.status!=='supported')return gate;
  if(!options.adConfirmed)return {status:'blocked',reason:'ad-unconfirmed'};
  const slot=state.inventory.findIndex(g=>g===null);if(slot<0)return {status:'blocked',reason:'inventory-full'};
  if(!Number.isFinite(options.roll)||options.roll<0||options.roll>=1)throw new RangeError('Invalid daily gun roll');
  const gunId=5+Math.floor(options.roll*5),inventory=[...state.inventory];inventory[slot]=createGun(gunId,slot);
  return {status:'supported',value:{state:{lastDailyGunKey:options.trustedTodayKey,inventory},gunId,slot}};
}
/** Eligibility only. Native pair selection, animation coroutine and pins remain evidence contracts. */
export function sourceAutoMergeGate(plusPack2Active:boolean|null,enabled:boolean,configuredLimit:number,maxCollectedDegree:number):MetaActionResult<{active:boolean;limitDegree:number}> {
  int(configuredLimit,'auto merge configured limit');int(maxCollectedDegree,'max collected degree');
  if(plusPack2Active===null)return {status:'unsupported',reason:'plus-pack-2-unknown'};
  if(!plusPack2Active)return {status:'blocked',reason:'plus-pack-2-required'};
  return {status:'supported',value:{active:enabled,limitDegree:Math.min(configuredLimit,maxCollectedDegree-1,6)}};
}

const calendarDays=(year:number,month:number)=>month===2?(year%4===0&&(year%100!==0||year%400===0)?29:28):[4,6,9,11].includes(month)?30:31;
function calendarDate(value:string):{year:number;month:number;day:number}|null {
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!m)return null;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  return year>=1&&year<=9999&&month>=1&&month<=12&&day>=1&&day<=calendarDays(year,month)?{year,month,day}:null;
}
/** DateTime.AddMonths(1): retain clock text/kind, clamp the day at month end. */
export function sourceNextSeasonEnd(trustedNow:string|null):MetaActionResult<string> {
  if(!trustedNow)return {status:'unsupported',reason:'trusted-now-required'};
  const match=/^(\d{4}-\d{2}-\d{2})(T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)$/.exec(trustedNow),date=match?calendarDate(match[1]):null;
  if(!match||!date)return {status:'unsupported',reason:'trusted-datetime-format-unknown'};
  const year=date.year+(date.month===12?1:0),month=date.month%12+1;if(year>9999)return {status:'unsupported',reason:'native-datetime-overflow'};
  const day=Math.min(date.day,calendarDays(year,month));
  return {status:'supported',value:`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}${match[2]}`};
}
/** is_Season_Closed: first run closes immediately; rollback/pending gains defer a reset. */
export function sourceSeasonClosed(options:{seasonStarted:boolean;canGrantTimedReward:boolean|null;pendingCount:number|null;trustedToday:string|null;seasonEndDate:string|null}):MetaActionResult<boolean> {
  if(!options.seasonStarted)return {status:'supported',value:true};
  if(options.canGrantTimedReward===null)return {status:'unsupported',reason:'timed-reward-gate-unknown'};
  if(!options.canGrantTimedReward)return {status:'supported',value:false};
  if(options.pendingCount===null)return {status:'unsupported',reason:'pending-time-gain-count-unknown'};
  int(options.pendingCount,'pending time gains');if(options.pendingCount>0)return {status:'supported',value:false};
  if(!options.trustedToday||!options.seasonEndDate||!calendarDate(options.trustedToday)||!calendarDate(options.seasonEndDate))return {status:'unsupported',reason:'trusted-season-dates-required'};
  return {status:'supported',value:options.trustedToday>=options.seasonEndDate};
}
