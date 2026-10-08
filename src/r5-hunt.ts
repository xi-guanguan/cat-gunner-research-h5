/** Monster_manager native contract. Evidence: pet-hunt-source-contract.md.
 * Pure transactions; caller supplies actual source combat events/entitlements and applies coin grants once. */
import {BigValue,type BigValueInput} from './big-value';
import {sourceBossCooldown,sourceBossDamageStats,type SourceBossTeamCat,type SourceBossTeamModifiers} from './r5-boss';
export const SOURCE_HUNT_UNLOCK_DISPLAY_STAGE=12;
export const SOURCE_HUNT_LEVEL_COUNT=5;
export const SOURCE_HUNT_MONSTER_COUNTS=[90,120,160,200,240] as const;
export const SOURCE_HUNT_SPAWN_INTERVALS=[.35,.20,.17,.12,.08].map(Math.fround);
export const SOURCE_HUNT_INITIAL_HP=1;
export const SOURCE_HUNT_CLEAR_REWARD=30;
export const SOURCE_HUNT_SWEEP_MAX_LEVELS=100;
export interface SourceHuntEntitlements {plusPack1Active:boolean;plusPack2Active:boolean;automaticBonus:boolean}
const none:SourceHuntEntitlements={plusPack1Active:false,plusPack2Active:false,automaticBonus:false};
export interface SourceHuntRun {mode:'fight'|'sweep';phase:'playing'|'ended';hp:number;accumulatedPetCoin:number;automaticBonus:boolean;resultSent:boolean;bonusClaimed:boolean;clearedLevels:number}
export interface SourceHuntState {wave:number;level:number;run:SourceHuntRun|null}
export type SourceHuntResult={status:'supported';value:SourceHuntState;petCoinGrant:number;resultCode?:1|2;resultStage?:number;rankScore?:number}|{status:'blocked'|'unsupported';reason:string};
function nativeWave(n:number):number {if(!Number.isInteger(n)||n<0||n>2147483647)throw new RangeError('Invalid native Hunt wave');return n;}
function nativeLevel(n:number):number {if(!Number.isInteger(n)||n<0||n>=5)throw new RangeError('Invalid native Hunt level');return n;}
function checked(s:SourceHuntState):void {nativeWave(s.wave);nativeLevel(s.level);}
function checkedEntitlements(e:SourceHuntEntitlements):SourceHuntEntitlements {if(Object.values(e).some(v=>typeof v!=='boolean'))throw new TypeError('Invalid Hunt entitlements');return e;}
export const freshSourceHuntState=():SourceHuntState=>({wave:0,level:0,run:null});
/** SaveData copies ONLY Wave_Now/Lv_Now; runtime panels and accumulators are not persisted. */
export function serializeSourceHuntState(s:SourceHuntState):string {checked(s);return JSON.stringify({Wave_Now:s.wave,Lv_Now:s.level});}
export function decodeSourceHuntState(value:unknown):SourceHuntState {
 const v=typeof value==='string'?JSON.parse(value):value;if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('Invalid Hunt save');
 return {wave:nativeWave(v.Wave_Now),level:nativeLevel(v.Lv_Now),run:null};
}
export function sourceHuntEntryUnlocked(maxDisplayStage:number):boolean{return Number.isInteger(maxDisplayStage)&&maxDisplayStage>=12;}
// H2(previous * 3), starting500. The coefficient recurrence has a prefix16 and cycle17.
const healthRows:{coefficient:bigint;exponent:number}[]=[];let hc=50n,he=1;
while(!healthRows.some(r=>r.coefficient===hc)){healthRows.push({coefficient:hc,exponent:he});hc*=3n;while(hc>=100n){hc/=10n;he++;}}
const healthCycleStart=healthRows.findIndex(r=>r.coefficient===hc),healthCycleLength=healthRows.length-healthCycleStart,healthCycleExponent=he-healthRows[healthCycleStart].exponent;
export function sourceHuntWaveHealth(wave:number):BigValue {
 nativeWave(wave);if(wave===0)return BigValue.fromInteger(500);if(wave<healthCycleStart){const r=healthRows[wave];return new BigValue(r.coefficient,r.exponent);}
 const offset=wave-healthCycleStart,cycles=Math.floor(offset/healthCycleLength),r=healthRows[healthCycleStart+offset%healthCycleLength];
 return new BigValue(r.coefficient,r.exponent+cycles*healthCycleExponent);
}
/** Native wave health scales by100+40*level with multiply/divide; no H2 after scaling. */
export function sourceHuntLevelHealth(wave:number,level:number):BigValue {nativeLevel(level);return sourceHuntWaveHealth(wave).nativeMultiply(BigValue.fromInteger(100+level*40)).nativeDivide(BigValue.fromInteger(100));}
/** SweepRequiredPower_return@0x2b4ec08: H5(levelHP * 150 / trunc(float32(interval*100))). */
export function sourceHuntSweepRequiredPower(wave:number,level:number):BigValue {
 nativeLevel(level);const interval=Math.trunc(Math.fround(SOURCE_HUNT_SPAWN_INTERVALS[level]*Math.fround(100)));
 return sourceHuntLevelHealth(wave,level).nativeMultiply(BigValue.fromInteger(150)).nativeDivide(BigValue.fromInteger(interval)).significant(5);
}
export function sourceHuntSweepAble(s:SourceHuntState,power:BigValueInput,e:SourceHuntEntitlements=none):boolean {checked(s);return checkedEntitlements(e).plusPack2Active&&BigValue.from(power).gt(sourceHuntSweepRequiredPower(s.wave,s.level));}
export function sourceHuntSweepEfficiency(wave:number,level:number,power:BigValueInput):number {
 const threshold=sourceHuntSweepRequiredPower(wave,level);if(threshold.lte(0))return 100;
 const ratio=BigValue.from(power).nativeMultiply(BigValue.fromInteger(100)).nativeDivide(threshold);if(ratio.gte(100))return 100;if(ratio.lt(0))return 0;return Math.floor(Math.fround(ratio.toNumber()));
}
function advanced(wave:number,level:number):{wave:number;level:number} {return level===4?{wave:nativeWave(wave+1),level:0}:{wave,level:level+1};}
/** SweepTarget itself scans power, independently from Plus2 gate; Game_Sweep applies that gate. */
export function sourceHuntSweepTarget(wave:number,level:number,power:BigValueInput):{wave:number;level:number;count:number} {
 nativeWave(wave);nativeLevel(level);const p=BigValue.from(power);let count=0;
 while(count<100&&p.gt(sourceHuntSweepRequiredPower(wave,level))){({wave,level}=advanced(wave,level));count++;}return {wave,level,count};
}
export function sourceHuntReward(e:SourceHuntEntitlements=none):number {return 30*(checkedEntitlements(e).plusPack1Active?2:1);}
function runCreated(mode:'fight'|'sweep',e:SourceHuntEntitlements):SourceHuntRun {return {mode,phase:mode==='fight'?'playing':'ended',hp:1,accumulatedPetCoin:0,automaticBonus:e.automaticBonus,resultSent:false,bonusClaimed:false,clearedLevels:0};}
export function sourceHuntEnter(s:SourceHuntState,e:SourceHuntEntitlements=none):SourceHuntResult {
 checked(s);checkedEntitlements(e);if(s.run)return {status:'blocked',reason:'hunt-run-open'};
 return {status:'supported',value:{...s,run:runCreated('fight',e)},petCoinGrant:0};
}
/** LevelClear pays immediately, records undiscounted base, then advances0..4/next wave.
 * Caller invokes only once for an actual cleared level (not once per enemy death). */
export function sourceHuntLevelClear(s:SourceHuntState,e:SourceHuntEntitlements=none):SourceHuntResult {
 checked(s);if(s.run?.phase!=='playing')return {status:'blocked',reason:'hunt-not-playing'};
 const base=sourceHuntReward(e),next=advanced(s.wave,s.level);return {status:'supported',value:{...s,...next,run:{...s.run,accumulatedPetCoin:s.run.accumulatedPetCoin+base,automaticBonus:e.automaticBonus,clearedLevels:s.run.clearedLevels+1}},petCoinGrant:base*(e.automaticBonus?2:1)};
}
function ending(s:SourceHuntState,code:1|2):SourceHuntResult {
 if(s.run?.phase!=='playing')return {status:'blocked',reason:'hunt-not-playing'};
 return {status:'supported',value:{...s,run:{...s.run,phase:'ended',resultSent:true}},petCoinGrant:0,...(!s.run.resultSent?{resultCode:code,resultStage:s.wave*10+s.level+11}:{}),rankScore:s.wave*10+s.level};
}
/** Failure sends1; GiveUp sends2. Already paid levels remain progressed; no second base payout. */
export function sourceHuntFail(s:SourceHuntState):SourceHuntResult {return ending(s,1);}
export function sourceHuntGiveUp(s:SourceHuntState):SourceHuntResult {return ending(s,2);}
export function sourceHuntInvade(s:SourceHuntState):SourceHuntResult {
 if(s.run?.phase!=='playing')return {status:'blocked',reason:'hunt-not-playing'};const next={...s,run:{...s.run,hp:s.run.hp-1}};
 return next.run.hp<=0?sourceHuntFail(next):{status:'supported',value:next,petCoinGrant:0};
}
export function sourceHuntSweep(s:SourceHuntState,power:BigValueInput,e:SourceHuntEntitlements=none):SourceHuntResult {
 checked(s);checkedEntitlements(e);if(s.run)return {status:'blocked',reason:'hunt-run-open'};
 try {
  if(!e.plusPack2Active)return {status:'blocked',reason:'hunt-sweep-plus2-required'};
  const target=sourceHuntSweepTarget(s.wave,s.level,power);if(target.count===0)return {status:'blocked',reason:'hunt-sweep-power-insufficient'};
  const accumulated=sourceHuntReward(e)*target.count;
  return {status:'supported',value:{wave:target.wave,level:target.level,run:{...runCreated('sweep',e),accumulatedPetCoin:accumulated,clearedLevels:target.count,resultSent:true}},petCoinGrant:accumulated*(e.automaticBonus?2:1),resultCode:1,resultStage:target.wave*10+target.level+11,rankScore:target.wave*10+target.level};
 } catch(error) {if(error instanceof RangeError&&error.message.includes('BigValue exponent'))return {status:'unsupported',reason:'hunt-health-exponent-out-of-range'};throw error;}
}
/** Native confirmed Bonus_Get/SweepBonus_Get adds exactly accumulated1x, then closes.
 * Confirmation/replay guards are H5 adapter requirements. */
export function sourceHuntBonus(s:SourceHuntState,confirmed:boolean):SourceHuntResult {
 if(!confirmed)return {status:'blocked',reason:'hunt-ad-unconfirmed'};
 if(s.run?.phase!=='ended'||s.run.bonusClaimed||s.run.automaticBonus)return {status:'blocked',reason:'hunt-bonus-unavailable'};
 return {status:'supported',value:{...s,run:null},petCoinGrant:s.run.accumulatedPetCoin,rankScore:s.wave*10+s.level};
}
export function sourceHuntExit(s:SourceHuntState):SourceHuntResult {
 if(!s.run)return {status:'blocked',reason:'hunt-no-open-run'};
 return {status:'supported',value:{...s,run:null},petCoinGrant:0,...(!s.run.resultSent?{resultCode:2 as const,resultStage:s.wave*10+s.level+11}:{}),rankScore:s.wave*10+s.level};
}
export interface SourceHuntPowerCat {active:boolean;cooldownSeconds:number;expectedDamage:BigValueInput;gunType:number;shotgunPelletCount:number}
export function sourceHuntTypeMultiplier(gunType:number,shotgunPelletCount:number):number {
 if(!Number.isInteger(gunType)||!Number.isInteger(shotgunPelletCount))throw new RangeError('Invalid source Hunt Gun_Info');
 switch(gunType){case 1:return 7;case 2:case 4:case 5:return 5;case 3:return Math.max(1,shotgunPelletCount);case 6:return 10;default:return 1;}
}
/** Native Power_Monster_return: active hierarchy, Boss cooldown/damage, per-type multiplier, H5 sum. */
export function sourceHuntPowerFromCats(cats:readonly SourceHuntPowerCat[]):BigValue {
 let power=BigValue.ZERO;for(const c of cats){if(!c.active)continue;const cooldown=Math.fround(c.cooldownSeconds);if(!Number.isFinite(cooldown))throw new RangeError('Invalid Hunt cooldown');if(cooldown<=Math.fround(.001))continue;
 const mult=Math.trunc(Math.fround(Math.fround(sourceHuntTypeMultiplier(c.gunType,c.shotgunPelletCount))*Math.fround(100))),interval=Math.trunc(Math.fround(cooldown*Math.fround(100)));
 if(interval<=0)throw new RangeError('Invalid Hunt cooldown integer denominator');power=power.nativeAdd(BigValue.from(c.expectedDamage).nativeMultiply(BigValue.fromInteger(mult)).nativeDivide(BigValue.fromInteger(interval)));}return power.significant(5);
}
export interface SourceHuntTeamCat extends SourceBossTeamCat {gunType:number;shotgunPelletCount:number}
export function sourceHuntTeamPower(cats:readonly SourceHuntTeamCat[],modifiers:SourceBossTeamModifiers):BigValue {
 return sourceHuntPowerFromCats(cats.map(c=>({...c,cooldownSeconds:c.active?sourceBossCooldown({...modifiers,...c}):0,expectedDamage:c.active?sourceBossDamageStats({...modifiers,...c}).expectedDamage:0})));
}
