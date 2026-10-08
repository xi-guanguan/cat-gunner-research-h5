/** UI5 Cat.Balance_Reload, not ExpectedDamage_Boss_return.
 * Evidence: raid-cat-balance-contract.json; source hashes in that contract.
 * No ordinary power, rebirth damage, ordinary speed or rebirth speed step is
 * even evaluated here: skipping an InfVal operation matters to precision.
 */
import {BigValue,type BigValueInput} from './big-value';
import {sourceBossStarDamagePercent,type SourceBossDamageStats} from './r5-boss';
import {sessionBossModifiers,type Session} from './session';
import type {SourceMetaState} from './source-meta-runtime';
export interface SourceRaidDamageInputs {
 baseDamage:BigValueInput;gunType:number;weakType:number;skinDamagePercent:number;
 fishDamagePercent:number;relicDamagePercent:BigValueInput;damageBuffMultiplier:number;
 starLevel:number;fishCriticalValuePercent:number;relicCriticalDamagePercent:BigValueInput;fishCriticalChancePercent:number;
}
export interface SourceRaidCooldownInputs {baseIntervalSeconds:number;skinSpeedPercent:number;speedBuffMultiplier:number}
const hundred=BigValue.fromInteger(100),f=Math.fround;
function int(n:number,label:string):number {if(!Number.isInteger(n)||n< -2147483648||n>2147483647)throw RangeError(`Invalid Raid ${label}`);return n;}
function type(n:number,label:string):void {int(n,label);if(n<0||n>6)throw RangeError(`Invalid Raid ${label}`);}
const percent=(v:BigValue,p:BigValueInput)=>v.nativeMultiply(p).nativeDivide(hundred);
export function sourceRaidCatDamage(i:SourceRaidDamageInputs):SourceBossDamageStats {
 type(i.gunType,'gun type');type(i.weakType,'weak type');int(i.starLevel,'star level');if(i.starLevel<0||i.starLevel>20)throw RangeError('Invalid Raid star level');
 for(const k of ['skinDamagePercent','fishDamagePercent','damageBuffMultiplier','fishCriticalValuePercent','fishCriticalChancePercent'] as const)int(i[k],k);
 let normal=percent(BigValue.from(i.baseDamage),BigValue.fromInteger(i.skinDamagePercent));
 normal=percent(normal,BigValue.fromInteger((100+i.fishDamagePercent)|0));
 normal=percent(normal,i.relicDamagePercent).truncateInteger();
 normal=normal.nativeMultiply(BigValue.fromInteger(i.damageBuffMultiplier));
 if(i.starLevel>0)normal=percent(normal,sourceBossStarDamagePercent(i.starLevel));
 if(i.gunType===i.weakType)normal=normal.nativeMultiply(BigValue.fromInteger(10));
 let critical=percent(normal,BigValue.fromInteger((125+i.fishCriticalValuePercent)|0));
 critical=percent(critical,i.relicCriticalDamagePercent).truncateInteger();
 const p=Math.max(0,Math.min(100,i.fishCriticalChancePercent));
 return {normalDamage:normal,criticalDamage:critical,shotCriticalProbability:f(f(i.fishCriticalChancePercent)/f(100)),criticalChancePercent:p,
  expectedDamage:normal.nativeMultiply(BigValue.fromInteger(100-p)).nativeAdd(critical.nativeMultiply(BigValue.fromInteger(p))).nativeDivide(hundred)};
}
/** mode5 -> (true,false,true): w25=mode-3=2, w1=(w25<3), w2=(mode==0),
 * w3=(mode==5). CalculateAtkCoolMax's third flag SKIPS Rebirth.Speed_return.
 * Native source clamps percent100..10000 and cooldown.05..2, in float32. */
export function sourceRaidCatCooldown(i:SourceRaidCooldownInputs):number {
 if(!Number.isFinite(i.baseIntervalSeconds)||!Number.isFinite(f(i.baseIntervalSeconds))||i.baseIntervalSeconds<=0)throw RangeError('Invalid Raid interval');
 int(i.skinSpeedPercent,'skin speed');int(i.speedBuffMultiplier,'speed buff');if(i.speedBuffMultiplier<1)throw RangeError('Invalid Raid speed multiplier');
 const p=Math.max(100,Math.min(10000,(i.skinSpeedPercent-100)|0));
 const base=f(f(f(i.baseIntervalSeconds)/f(p))*f(100));
 return f(Math.max(f(.05),Math.min(f(2),f(base/f(i.speedBuffMultiplier)))));
}
/** Uses the already source-bound skin/fish/relic/buff inputs, deliberately
 * projects away both permanent modifiers rather than feeding identity100. */
export function sessionRaidModifiers(session:Session,meta:SourceMetaState):Omit<SourceRaidDamageInputs,'baseDamage'|'gunType'|'weakType'|'starLevel'>&Omit<SourceRaidCooldownInputs,'baseIntervalSeconds'> {
 const {rebirthDamagePercent:_,rebirthSpeedPercent:__,...raid}=sessionBossModifiers(session,meta.entitlements,meta.fish,meta.buffTimes,meta.relic);return raid;
}
