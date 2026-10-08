/** Source Boss_manager contract. Native addresses and exact scene bytes: boss-source-contract.md.
 * Entry represents Enter_Cor finishing its loading transition; rendering/combat remain caller adapters. */
import {BigValue,type BigValueInput} from './big-value';
export const SOURCE_BOSS_BASE_REWARD_DIAMONDS=150; // .cctor 0x2b47900
export const SOURCE_BOSS_BASE_TIME_SECONDS=60; // .ctor 0x2b478e0
export const SOURCE_BOSS_SKIN_COUNT=9; // level0:124699, three arrays each9
export interface SourceBossEntitlements {plusPack0Active:boolean;plusPack1Active:boolean;automaticBonus:boolean}
const none:SourceBossEntitlements={plusPack0Active:false,plusPack1Active:false,automaticBonus:false};
export interface SourceBossRun {playedStage:number;mode:'fight'|'sweep';phase:'playing'|'won'|'failed';remainingSec:number;rewardThisRun:number;bonusClaimed:boolean;automaticBonus:boolean;resultSent:boolean}
export interface SourceBossState {stage:number;run:SourceBossRun|null}
export type SourceBossResult={status:'supported';value:SourceBossState;diamondGrant:number;resultCode?:1|2|3}|{status:'blocked'|'unsupported';reason:string};
function stageChecked(stage:number):number {if(!Number.isInteger(stage)||stage<0||stage>2147483647)throw new RangeError('Invalid native Boss_Stage');return stage;}
function entitlementsChecked(e:SourceBossEntitlements):SourceBossEntitlements {if(['plusPack0Active','plusPack1Active','automaticBonus'].some(k=>typeof e[k as keyof SourceBossEntitlements]!=='boolean'))throw new TypeError('Invalid Boss entitlements');return e;}
export const freshSourceBossState=():SourceBossState=>({stage:0,run:null});
/** SaveData.CreateFromCurrentState@0x2b15a84..8c; ContinueLoad@0x2b13dac..b4.
 * Native persistence carries ONLY stage; H5 deliberately discards unfinished/reward panels on restore. */
export function serializeSourceBossState(state:SourceBossState):string {return JSON.stringify({Boss_Stage:stageChecked(state.stage)});}
export function decodeSourceBossState(value:unknown):SourceBossState {
 const v=typeof value==='string'?JSON.parse(value):value;
 if(!v||typeof v!=='object'||Array.isArray(v)||typeof v.Boss_Stage!=='number')throw new TypeError('Invalid Boss save');
 return {stage:stageChecked(v.Boss_Stage),run:null};
}
// Balance_Reload@0x2b45ef4 and Health_return@0x2b46e10: H2(previous * InfVal(5)).
// Detect the finite coefficient cycle once; this is exactly the recurrence, avoiding O(stage) work.
const hpCycle:{coefficient:bigint;exponent:number}[]=[];let coefficient=50n,exponent=3;
while(!hpCycle.some(v=>v.coefficient===coefficient)) {
 hpCycle.push({coefficient,exponent});coefficient*=5n;
 while(coefficient>=100n){coefficient/=10n;exponent++;}
}
const hpCycleExponent=exponent-hpCycle[0].exponent;
export function sourceBossHealth(stage:number):BigValue {
 stageChecked(stage);const cycles=Math.floor(stage/hpCycle.length),row=hpCycle[stage%hpCycle.length];
 return new BigValue(row.coefficient,row.exponent+cycles*hpCycleExponent);
}
/** SkinNum_return@0x2b47888; display level is Stage_Now+1 in Boss_Start_UI.Reload. */
export function sourceBossSkin(stage:number):number {return stageChecked(stage)%SOURCE_BOSS_SKIN_COUNT;}
export function sourceBossTimeMax(e:SourceBossEntitlements=none):number {return SOURCE_BOSS_BASE_TIME_SECONDS*(entitlementsChecked(e).plusPack0Active?2:1);}
/** PlusPack.Reward_Mult_Boss@0x2b908b0 checks Plus1, independently from Plus0 time. */
export function sourceBossReward(e:SourceBossEntitlements=none):number {return SOURCE_BOSS_BASE_REWARD_DIAMONDS*(entitlementsChecked(e).plusPack1Active?2:1);}
/** SweepRequiredPower_return@0x2b46c8c: H5(HP / InfVal(max(RoundToEven(time*70/100),1))). */
export function sourceBossSweepRequiredPower(stage:number,e:SourceBossEntitlements=none):BigValue {
 const seconds=Math.fround(Math.fround(sourceBossTimeMax(e)*70)/100); //42 or84; no fractional tie in current source config
 return sourceBossHealth(stage).nativeDivide(BigValue.fromInteger(Math.max(1,Math.round(seconds)))).significant(5);
}
/** is_SweepAble@0x2b46ef8 -> numeric strict GT@0x4554530. Caller supplies native Boss power. */
export function sourceBossSweepAble(stage:number,power:BigValueInput,e:SourceBossEntitlements=none):boolean {return BigValue.from(power).gt(sourceBossSweepRequiredPower(stage,e));}
/** SweepValue_return@0x2b46f94: native arithmetic then float32 floor, capped0..100. UI percentage only. */
export function sourceBossSweepEfficiency(stage:number,power:BigValueInput,e:SourceBossEntitlements=none):number {
 const ratio=BigValue.from(power).nativeMultiply(BigValue.fromInteger(100)).nativeDivide(sourceBossSweepRequiredPower(stage,e));
 if(ratio.gte(100))return 100;if(ratio.lt(0))return 0;return Math.floor(Math.fround(ratio.toNumber()));
}
function activePanel(state:SourceBossState):boolean {return state.run!==null;}
/** Game_Enter@0x2b45fdc has no ticket/diamond debit. H5 blocks replacing an open run/panel. */
export function sourceBossEnter(state:SourceBossState,e:SourceBossEntitlements=none):SourceBossResult {
 stageChecked(state.stage);entitlementsChecked(e);if(activePanel(state))return {status:'blocked',reason:'boss-run-open'};
 try{sourceBossHealth(state.stage);}catch{return {status:'unsupported',reason:'boss-health-outside-h5-range'};}
 return {status:'supported',diamondGrant:0,value:{...state,run:{playedStage:state.stage,mode:'fight',phase:'playing',remainingSec:sourceBossTimeMax(e),rewardThisRun:0,bonusClaimed:false,automaticBonus:e.automaticBonus,resultSent:false}}};
}
function cleared(state:SourceBossState,e:SourceBossEntitlements,mode:'fight'|'sweep'):SourceBossResult {
 if(state.stage===2147483647)return {status:'unsupported',reason:'boss-stage-int32-overflow'};
 const reward=sourceBossReward(e),run=state.run!;
 return {status:'supported',diamondGrant:reward*(e.automaticBonus?3:1),resultCode:1,value:{stage:state.stage+1,run:{...run,mode,phase:'won',rewardThisRun:reward,automaticBonus:e.automaticBonus,resultSent:true}}};
}
/** Game_Win@0x2b46618: active guard, stage+1, base grant or automatic total3x, result1. */
export function sourceBossWin(state:SourceBossState,e:SourceBossEntitlements=none):SourceBossResult {
 if(state.run?.phase!=='playing')return {status:'blocked',reason:'boss-not-playing'};return cleared(state,entitlementsChecked(e),'fight');
}
/** Game_Fail@0x2b469c0: no stage change/no grant, result3. */
export function sourceBossFail(state:SourceBossState):SourceBossResult {
 if(state.run?.phase!=='playing')return {status:'blocked',reason:'boss-not-playing'};
 return {status:'supported',diamondGrant:0,resultCode:3,value:{...state,run:{...state.run,phase:'failed',resultSent:true}}};
}
/** Game_Cor.MoveNext@0x2b47d58 checks <=0 BEFORE subtracting this frame's deltaTime. */
export function sourceBossTick(state:SourceBossState,deltaSec:number):SourceBossResult {
 if(!Number.isFinite(deltaSec)||deltaSec<0)throw new RangeError('Invalid Boss delta');
 if(state.run?.phase!=='playing')return {status:'blocked',reason:'boss-not-playing'};
 if(state.run.remainingSec<=0)return sourceBossFail(state);
 return {status:'supported',diamondGrant:0,value:{...state,run:{...state.run,remainingSec:Math.fround(Math.fround(state.run.remainingSec)-Math.fround(deltaSec))}}};
}
/** Game_Sweep@0x2b47180 uses same base reward/stage increment and strict power gate. */
export function sourceBossSweep(state:SourceBossState,power:BigValueInput,e:SourceBossEntitlements=none):SourceBossResult {
 if(activePanel(state))return {status:'blocked',reason:'boss-run-open'};
 if(!sourceBossSweepAble(state.stage,power,e))return {status:'blocked',reason:'boss-sweep-power-insufficient'};
 const entered=sourceBossEnter(state,e);if(entered.status!=='supported')return entered;return cleared(entered.value,e,'sweep');
}
/** Bonus_Get@0x2b46b9c / SweepBonus_Get@0x2b46c20 grants ADDITIONAL2x and closes.
 * Confirmation and replay guard are H5 adapter checks; native callback itself has no replay guard. */
export function sourceBossBonus(state:SourceBossState,confirmed:boolean):SourceBossResult {
 const run=state.run;if(!confirmed)return {status:'blocked',reason:'boss-ad-unconfirmed'};
 if(run?.phase!=='won'||run.bonusClaimed||run.automaticBonus)return {status:'blocked',reason:'boss-bonus-unavailable'};
 return {status:'supported',diamondGrant:run.rewardThisRun*2,value:{...state,run:null}};
}
/** Game_Exit@0x2b46450 attempts result2; SendDgResult suppresses another result after win/fail. */
export function sourceBossExit(state:SourceBossState):SourceBossResult {
 if(!state.run)return {status:'blocked',reason:'boss-no-open-run'};
 return {status:'supported',diamondGrant:0,...(!state.run.resultSent?{resultCode:2 as const}:{}),value:{...state,run:null}};
}

/** Boss combat audit: boss-battle-source-contract.md. Percent inputs are source consumers,
 * not ordinary Upgrade_manager power/speed or an estimated UI team score. */
export interface SourceBossDamageInputs {
 baseDamage:BigValueInput;rebirthDamagePercent:BigValueInput;skinDamagePercent:number;
 fishDamagePercent:number;relicDamagePercent:BigValueInput;damageBuffMultiplier:number;
 starLevel:number;fishCriticalValuePercent:number;relicCriticalDamagePercent:BigValueInput;
 fishCriticalChancePercent:number;
}
export interface SourceBossDamageStats {normalDamage:BigValue;criticalDamage:BigValue;expectedDamage:BigValue;criticalChancePercent:number;shotCriticalProbability:number}
const hundred=BigValue.fromInteger(100);
function nativeInt(value:number,label:string):number {if(!Number.isInteger(value)||value< -2147483648||value>2147483647)throw new RangeError(`Invalid ${label}`);return value;}
function sourceIntAdd(a:number,b:number):number{return (a+b)|0;}
function applyPercent(value:BigValue,percent:BigValueInput):BigValue{return value.nativeMultiply(percent).nativeDivide(hundred);}
/** StarUpgrade_manager.EnsureTables@0x2b6d36c builds levels0..20.
 * Recurrent DOUBLE total *= 1.5 * pow(1.07,level-1); bonus=H2((total-1)*100).
 * Damage_Apply@0x2b6da2c uses native multiply/divide, no G afterwards. */
const sourceBossStarTable:BigValue[]=[hundred];let sourceBossStarTotal=1;
for(let i=0;i<20;i++){
 sourceBossStarTotal*=1.5*Math.pow(1.07,i);
 sourceBossStarTable.push(BigValue.fromNumber((sourceBossStarTotal-1)*100).significant(2).nativeAdd(hundred));
}
export function sourceBossStarDamagePercent(level:number):BigValue {nativeInt(level,'star level');return sourceBossStarTable[Math.max(0,Math.min(20,level))];}
/** Cat.ExpectedDamage_Boss_return@0x2b39c30; both G truncations are intentional.
 * Normal/critical results also match Cat.Balance_Reload in mode3 (no helper/Raid buff). */
export function sourceBossDamageStats(i:SourceBossDamageInputs):SourceBossDamageStats {
 for(const k of ['skinDamagePercent','fishDamagePercent','damageBuffMultiplier','fishCriticalValuePercent','fishCriticalChancePercent'] as const)nativeInt(i[k],k);
 let normal=applyPercent(BigValue.from(i.baseDamage),i.rebirthDamagePercent);
 normal=applyPercent(normal,BigValue.fromInteger(i.skinDamagePercent));
 normal=applyPercent(normal,BigValue.fromInteger(sourceIntAdd(100,i.fishDamagePercent)));
 normal=applyPercent(normal,i.relicDamagePercent).truncateInteger();
 normal=normal.nativeMultiply(BigValue.fromInteger(i.damageBuffMultiplier));
 if(i.starLevel>0)normal=applyPercent(normal,sourceBossStarDamagePercent(i.starLevel));else nativeInt(i.starLevel,'star level');
 let critical=applyPercent(normal,BigValue.fromInteger(sourceIntAdd(125,i.fishCriticalValuePercent)));
 critical=applyPercent(critical,i.relicCriticalDamagePercent).truncateInteger();
 const p=Math.max(0,Math.min(100,i.fishCriticalChancePercent));
 const expected=normal.nativeMultiply(BigValue.fromInteger(100-p)).nativeAdd(critical.nativeMultiply(BigValue.fromInteger(p))).nativeDivide(hundred);
 return {normalDamage:normal,criticalDamage:critical,expectedDamage:expected,criticalChancePercent:p,shotCriticalProbability:Math.fround(Math.fround(i.fishCriticalChancePercent)/Math.fround(100))};
}
/** Cat.Attack@0x2b3d54c..578 rolls once for the entire attack (including all pellets).
 * Actual chance comes from Balance_Reload float32 raw fishPercent/100, whereas E uses clamp0..100. */
export function sourceBossShotDamage(stats:SourceBossDamageStats,randomValue:number):{damage:BigValue;isCritical:boolean} {
 if(!Number.isFinite(randomValue)||randomValue<0||randomValue>1)throw new RangeError('Invalid Unity Random.value sample');
 const isCritical=Math.fround(randomValue)<stats.shotCriticalProbability;
 return {damage:isCritical?stats.criticalDamage:stats.normalDamage,isCritical};
}
export interface SourceBossCooldownInputs {baseIntervalSeconds:number;skinSpeedPercent:number;rebirthSpeedPercent:number;speedBuffMultiplier:number}
/** AtkCool_Boss_return passes (true,false,false) to CalculateAtkCoolMax@0x2b399cc.
 * Ordinary speed upgrade and normal stage penalty never enter this function. */
export function sourceBossCooldown(i:SourceBossCooldownInputs):number {
 if(!Number.isFinite(i.baseIntervalSeconds))throw new RangeError('Invalid Boss gun interval');
 nativeInt(i.skinSpeedPercent,'skin speed');nativeInt(i.rebirthSpeedPercent,'rebirth speed');nativeInt(i.speedBuffMultiplier,'speed buff');
 const percent=Math.max(100,Math.min(10000,sourceIntAdd(sourceIntAdd(i.skinSpeedPercent,i.rebirthSpeedPercent),-200)));
 const base=Math.fround(Math.fround(Math.fround(i.baseIntervalSeconds)/Math.fround(percent))*Math.fround(100));
 const boosted=Math.fround(base/Math.fround(i.speedBuffMultiplier));
 return Math.fround(Math.max(Math.fround(.05),Math.min(Math.fround(2),boosted)));
}
/** active is GameObject.activeInHierarchy (Unity wrapper0x56e00b4), not merely unlocked/activeSelf. */
export interface SourceBossPowerCat {active:boolean;cooldownSeconds:number;expectedDamage:BigValueInput}
/** Gamemanager.Power_Boss_return@0x2a80d74. Each enabled Cat contributes E*100 /
 * int32(float32(cooldown*100)); native add, then H5. No pellet/type multiplier. */
export function sourceBossPowerFromCats(cats:readonly SourceBossPowerCat[]):BigValue {
 let power=BigValue.ZERO;
 for(const cat of cats){
  if(!cat.active)continue;const cd=Math.fround(cat.cooldownSeconds);
  if(!Number.isFinite(cd))throw new RangeError('Invalid Boss cooldown');
  if(cd<=Math.fround(.001))continue;
  const scaled=Math.fround(cd*100),divisor=Math.trunc(scaled);
  if(divisor<1||divisor>2147483647)throw new RangeError('Boss cooldown outside native combat range');
  power=power.nativeAdd(BigValue.from(cat.expectedDamage).nativeMultiply(hundred).nativeDivide(BigValue.fromInteger(divisor)));
 }
 return power.significant(5);
}
export interface SourceBossTeamCat {active:boolean;baseDamage:BigValueInput;baseIntervalSeconds:number;starLevel:number}
export interface SourceBossTeamModifiers extends Omit<SourceBossDamageInputs,'baseDamage'|'starLevel'>,Omit<SourceBossCooldownInputs,'baseIntervalSeconds'> {}
/** Recompute from actual equipped guns and corresponding Slot_Lv. */
export function sourceBossTeamPower(cats:readonly SourceBossTeamCat[],modifiers:SourceBossTeamModifiers):BigValue {
 return sourceBossPowerFromCats(cats.map(cat=>cat.active?{active:true,cooldownSeconds:sourceBossCooldown({...modifiers,...cat}),expectedDamage:sourceBossDamageStats({...modifiers,...cat}).expectedDamage}:{active:false,cooldownSeconds:0,expectedDamage:0}));
}
export interface SourceBossEnemyState {healthMax:BigValue;healthNow:BigValue;isDead:boolean}
/** Boss.Spawn -> Enemy.Spawn(hp,0), no kill money grant. */
export function sourceBossEnemySpawn(stage:number):SourceBossEnemyState {const hp=sourceBossHealth(stage);return {healthMax:hp,healthNow:hp,isDead:false};}
/** Enemy.Damaged@0x2b5ca8c -> Die -> Die_Reload -> Boss.Die_Reload -> Boss_Destroyed.
 * HP==0 stays alive. Consumer calls sourceBossWin only on diedThisHit, atomically. */
export function sourceBossEnemyDamage(state:SourceBossEnemyState,damage:BigValueInput,isGaming:boolean):{value:SourceBossEnemyState;diedThisHit:boolean;moneyGrant:0} {
 if(state.isDead||!isGaming)return {value:state,diedThisHit:false,moneyGrant:0};
 const healthNow=state.healthNow.nativeSubtract(damage),isDead=healthNow.lt(0);
 return {value:{...state,healthNow,isDead},diedThisHit:isDead,moneyGrant:0};
}
export interface SourceBossVector3 {x:number;y:number;z:number}
export interface SourceBossVector2 {x:number;y:number}
/** Serialized Boss@level0:125471 and its Transform chain (39344 ->39310 ->39322). */
export const SOURCE_BOSS_MOVEMENT=Object.freeze({moveSpeed:15,arrivalThreshold:.5,minWaitSeconds:1,maxWaitSeconds:3,catAvoidRadius:4,maxPointRetries:10,mapRadius:60,mapCenter:Object.freeze({x:-100,y:0,z:0}),spawnWorld:Object.freeze({x:-115,y:0,z:15}),catSpawnWorld:Object.freeze({x:-100,y:0,z:0})});
const f=Math.fround;
function vec(v:SourceBossVector3):SourceBossVector3 {if(![v.x,v.y,v.z].every(Number.isFinite))throw new RangeError('Invalid Boss world vector');return {x:f(v.x),y:f(v.y),z:f(v.z)};}
function subtractVector(a:SourceBossVector3,b:SourceBossVector3):SourceBossVector3{return {x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)};}
function lengthSquared(v:SourceBossVector3):number{return f(f(f(v.x*v.x)+f(v.y*v.y))+f(v.z*v.z));}
/** Boss.PathCrossesCat@0x2b453a8 uses closest point on a 3D segment.
 * Origin cat is treated as absent; radius boundary uses strict <. */
export function sourceBossPathCrossesCat(startInput:SourceBossVector3,endInput:SourceBossVector3,catInput:SourceBossVector3,radius=SOURCE_BOSS_MOVEMENT.catAvoidRadius):boolean {
 const start=vec(startInput),end=vec(endInput),cat=vec(catInput);if(!Number.isFinite(radius)||radius<0)throw new RangeError('Invalid Boss avoid radius');
 if(lengthSquared(cat)<f(1e-10))return false;
 const segment=subtractVector(end,start),length=f(Math.sqrt(lengthSquared(segment)));if(length<f(.001))return false;
 const dir={x:f(segment.x/length),y:f(segment.y/length),z:f(segment.z/length)},delta=subtractVector(cat,start);
 const dot=f(f(f(delta.x*dir.x)+f(delta.y*dir.y))+f(delta.z*dir.z)),along=f(Math.max(0,Math.min(length,dot)));
 const closest={x:f(start.x+f(dir.x*along)),y:f(start.y+f(dir.y*along)),z:f(start.z+f(dir.z*along))};
 return f(Math.sqrt(lengthSquared(subtractVector(cat,closest))))<f(radius);
}
/** Unity Random.insideUnitCircle sample is caller supplied; never substitute a square.
 * Boss.RandomPointInMap@0x2b452ec preserves current world Y. */
export function sourceBossRandomPointInMap(currentY:number,insideCircle:SourceBossVector2):SourceBossVector3 {
 if(![currentY,insideCircle.x,insideCircle.y].every(Number.isFinite))throw new RangeError('Invalid Boss circle sample');
 return {x:f(SOURCE_BOSS_MOVEMENT.mapCenter.x+f(f(insideCircle.x)*60)),y:f(currentY),z:f(f(insideCircle.y)*60)};
}
/** After ten rejected samples, source picks a fresh eleventh and accepts it unconditionally. */
export function sourceBossPickWanderPoint(start:SourceBossVector3,mainCat:SourceBossVector3,sampleInsideCircle:()=>SourceBossVector2):{point:SourceBossVector3;samples:number;fallback:boolean} {
 for(let n=1;n<=SOURCE_BOSS_MOVEMENT.maxPointRetries;n++){
  const point=sourceBossRandomPointInMap(start.y,sampleInsideCircle());
  if(!sourceBossPathCrossesCat(start,point,mainCat))return {point,samples:n,fallback:false};
 }
 return {point:sourceBossRandomPointInMap(start.y,sampleInsideCircle()),samples:11,fallback:true};
}
/** MoveToPoint.MoveNext@0x2b456b4 drives Rigidbody velocity, not teleport/Lerp.
 * Facing is a direction signal; consumer applies the selected native skin transform facing. */
export function sourceBossMoveVelocity(positionInput:SourceBossVector3,targetInput:SourceBossVector3,isGaming:boolean):{velocity:SourceBossVector3;arrived:boolean;isMoving:boolean;facing:'left'|'right'|null} {
 const position=vec(positionInput),target=vec(targetInput),delta=subtractVector(target,position);
 const distance=f(Math.sqrt(f(f(delta.x*delta.x)+f(delta.z*delta.z)))),arrived=distance<=f(SOURCE_BOSS_MOVEMENT.arrivalThreshold);
 if(!isGaming||arrived)return {velocity:{x:0,y:0,z:0},arrived,isMoving:false,facing:null};
 const dx=distance>f(1e-5)?f(delta.x/distance):0,dz=distance>f(1e-5)?f(delta.z/distance):0;
 return {velocity:{x:f(dx*SOURCE_BOSS_MOVEMENT.moveSpeed),y:0,z:f(dz*SOURCE_BOSS_MOVEMENT.moveSpeed)},arrived:false,isMoving:true,facing:delta.x>0?'right':delta.x<0?'left':null};
}
