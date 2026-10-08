import {sourceRelicTotals,type SourceRelicState} from './r6-relic';
import {type SourceRewardResponse} from './r6-reward-provider';
import {sourceChallengeSettlement,validateSourceChallengeSettlement,sourceChallengePowerFromCats,sourceChallengeSweepAble,sourceChallengeBonusReward,type SourceChallengeAdRequest,type SourceChallengeSettlement} from './r6-challenge';
import {sourceGunDamageStats,sourceGunCooldown} from './rules';
import {freshSourceAdGun,validateSourceAdGun,type SourceAdGunState} from './r6-adgun';
import {freshSourceWeekly,freshSourcePlus,validateSourceWeekly,validateSourcePlus,type SourceWeeklyState,type SourcePlusState} from './r6-weekly';
import {freshSourceDiaPig,validateSourceDiaPig,type SourceDiaPigState} from './r6-diapig';
import {freshSourceStepUp,validateSourceStepUp,type SourceStepUpState} from './r6-stepup';
import {freshSourceGunSafe,validateSourceGunSafe,type SourceGunSafeState} from './r6-gun-storage';
import {freshSourceSkinState,validateSourceSkinState,sourceSkinTotals,type SourceSkinState} from './r6-skin';
import { candidateConfig, type RuleConfig } from "./config";
import { buyUpgrade, createLevel, tick, type State, type Point, type TickInput, type UpgradeKind, type MuzzleResolver, type ShotEvent, numericMirror, walletValue, healthValue } from "./rules";
import { BigValue, type BigValueInput } from "./big-value";
import { makeActor } from "./cat-actors";
import ordinarySource from "./data/ordinary-values.json";
import { ordinaryStageBase, ordinaryLevelLayout, ordinaryCell, type OrdinaryValues } from "./ordinary-data";
import { equipmentRemovalPolicy, contentGate, rebirthPopupGate, rebirthReward, completeRebirth,
  permanentUpgradeQuote, purchasePermanentUpgrade, completeManualFusion, mineSettlement, type MineSettlement, type PermanentUpgradeKind } from "./meta-progression";
import sourceGuns from "./data/guns.json";
import { enterSourceMine, type MineTicketState } from "./mine-source";
import { createMineBattle, tickMineBattle, mineProgress, type MineRun } from "./mine-runtime";
import { localMineTime, type MineTimeAdapter } from "./mine-time";
import { FIELD_SPAWN, FIELD_UNITS_PER_POINT, worldToField } from "./field-space";
import { challengeQuote, sourceDegreeFactors, CHALLENGE_SECONDS, CHALLENGE_REWARD_DIAMONDS, MAX_CHALLENGE_STAGE, type ChallengeQuote } from "./challenge-source";
import {freshSourceEntitlements,sourceRewardEntitlements,sourceEntitlementCombatModifiers,sourceBuffMultiplier,type SourceEntitlements,type SourceBuffTimes} from "./r5-entitlements";
import {sourceFishCombatModifiers,type SourceFishState} from "./r5-fish";
import {gunEntityUID,classifyGunHover,type GunDropRequest} from "./gun-drag";
import {freshSourceBossState,sourceBossTeamPower,type SourceBossState,type SourceBossTeamModifiers} from './r5-boss';
import {enterBossBattle,tickBossBattle,leaveBossBattle,sweepBossBattle,bossTeamPower,type BossMotionState} from './boss-runtime';
import {sourcePetSelectedStats,type SourcePetState} from './r5-pet';
import {sourceFishTotals} from './r5-fish';
import { challengeSlots, CHALLENGE_SPAWN, CHALLENGE_UNITS_PER_POINT } from "./challenge-layout";

import {validateSourceStarState,sourceStarUpgrade,type SourceStarUpgrade} from './r6-star';

export type Mode = "field" | "challenge" | "victory" | "defeat" | "mine" | "mine-result" | "boss" | "boss-result";
export type Overlay = "none" | "daily" | "challenge" | "gun" | "rebirth" | "permanent" | "mine" | "challenge-sweep";
export interface Gun {
  /** Source merge protection; does not pause firing. */
  paused?:boolean;adReward?:boolean;
  id: string;
  uid?: string;
  name: string;
  damage: number;
  intervalSeconds: number;
  pelletCount?: number;
  spreadDegrees?: number;
  sourceType?: number;
  explosionRadius?:number;
  missileExplosionRadius?:number;
  blastSniperExplosionRadius?:number;
  missileSpeed?:number;
  penetratingBulletLifetime?:number;
  damageValue?: BigValue;
}

export const GUN_GACHA_COST = 100;
export const GUN_INVENTORY_CAPACITY = 16;
export const DAY_ONE_DIAMONDS = 70;
const starterGun: Gun = { id: "starter-single-d", name: "Single D", damage: 100, intervalSeconds: Math.fround(0.6), sourceType:0 };
const normalGunPool: readonly Gun[] = [
  { id: "source-gun-0", name: "Starter", damage: 100, intervalSeconds: 0.6 },
  { id: "source-gun-1", name: "Pistol", damage: 80, intervalSeconds: 0.5 },
  { id: "source-gun-2", name: "Light SMG", damage: 50, intervalSeconds: 0.3 },
  { id: "source-gun-3", name: "Short SG", damage: 80, intervalSeconds: 1, pelletCount: 2, spreadDegrees: 10 },
  { id: "source-gun-4", name: "Double SG", damage: 90, intervalSeconds: 1.1, pelletCount: 2, spreadDegrees: 10 }
];
export type GameEvent =
  | ({ type: "shot"; x: number; y: number } & ShotEvent)
  | import("./rules").ProjectileViewLifecycleEvent
  | ({ type:"projectileImpact" } & import("./rules").ProjectileImpactEvent)
  | { type: "hit"; id: number; damage: number; damageValue?: BigValue }
  | { type: "death"; id: number; x: number; y: number }
  | { type: "currencyCollected"; amount: number; amountValue?: BigValue }
  | { type: "upgradeSucceeded"; kind: UpgradeKind; level: number }
  | { type: "stageWon"; stage: number }
  | { type: "stageFailed"; stage: number }
  | { type: "gunUnlocked" }
  | { type: "dailyClaimed"; diamonds: number }
  | { type: "gunDrawn"; gun: Gun }
  | { type: "gunEquipped"; gun: Gun; slot: number };

export interface MineSessionState {
  tickets: MineTicketState;
  bestReward: number;
  run: MineRun | null;
  settlement: MineSettlement | null;
}
export interface Session {
  weeklyShop?:SourceWeeklyState;
  plusPack?:SourcePlusState;
  stepUp?:SourceStepUpState;
  diaPig?:SourceDiaPigState;
  skin?:SourceSkinState;
  mode: Mode;
  boss:SourceBossState;
  bossMotion:BossMotionState|null;
  bossSlotLevels?:number[];
  /** Original Slot_FailCount and StarGem; not diamonds, Ruby or PetCoin. */
  starFailCounts?:number[];
  starGem?:number;
  mine: MineSessionState;
  overlay: Overlay;
  battle: State;
  fieldBattle: State | null;
  challengeStage: number;
  challengeSettlement?:SourceChallengeSettlement|null;
  challengeRunSequence?:number;
  challengeRunID?:string|null;
  challengeRewardClaims?:string[];
  diamonds: number;
  dailyClaimed: boolean;
  gunUnlocked: boolean;
  gunInventory: Gun[];
  equippedGuns: (Gun | null)[];
  gunDraws: number;
  /** Source Gun_Collect catalogue identity; history survives sale/fusion/rebirth. */
  catalogSeen?:number[];
  gunSafe?:SourceGunSafeState;
  adGun?:SourceAdGunState;
  rngState: number;
  challengeSeconds: number;
  events: GameEvent[];
  historicMax: number;
  notice: string;
  ruby: BigValue;
  rebirthCount: number;
  permanentLevels: Record<PermanentUpgradeKind, number>;
}

const fieldConfig = candidateConfig;
const challengeConfig: RuleConfig = {
  ...candidateConfig,
  level: { ...candidateConfig.level, seconds: CHALLENGE_SECONDS, targetCount: 20, targetHealth: 250 }
};
const ordinaryData = ordinarySource as OrdinaryValues;
const decimal = (v: {digits:string;exponent:number}) => new BigValue(BigInt(v.digits),v.exponent);
function fieldRuleConfig(stage: number, level: number): RuleConfig {
  return { ...fieldConfig, arena: { ...fieldConfig.arena, height: 16 * (level + 1) + 21 },
    level: { ...fieldConfig.level, targetCount: ordinaryTargetCount(stage, level) } };
}

export function ordinaryTargetCount(stage: number, level: number): number {
  return Math.min(100, Math.max(30, 30 + stage * 10)) * (level + 1) + (level === 4 ? 1 : 0);
}

export function createFieldLevel(stage = 0, level = 0, coins: BigValueInput = 0, upgrades?: State["upgradeLevels"], seed = 1): State {
  const config = fieldRuleConfig(stage, level);
  const battle = createLevel(stage, level, coins, upgrades, config);
  const base = ordinaryStageBase(ordinaryData, stage);
  const layout = ordinaryLevelLayout(ordinaryData,stage,level);
  let randomState = (seed ^ Math.imul(stage + 1, 0x9e3779b9) ^ Math.imul(level + 1, 0x85ebca6b)) >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  const perGrid = layout.perGrid;
  const gridPositions = Array.from({ length: level + 1 }, (_, grid) => {
    const indices = Array.from({ length: 100 }, (_, index) => index);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, perGrid).map(index => {
      const cell = ordinaryCell(ordinaryData,grid,index,random()*3-1.5,random()*3-1.5);
      const worldX=cell.local.x+cell.treeListAnchor[0],worldZ=cell.local.z+cell.treeListAnchor[2];
      return worldToField(worldX, worldZ);
    });
  });
  const ordinaryCount = perGrid * (level + 1);
  const targets = battle.targets.slice(0, ordinaryCount).map((target, index) => {
    const draw = random() * 100;
    const weights = layout.degreeWeights;
    let cumulative = 0;
    const tier = weights.findIndex(weight => (cumulative += weight) > draw);
    const factors=sourceDegreeFactors(tier);
    const healthValue=decimal(base.health).nativeMultiply(factors.health);
    const coinValue=decimal(base.money).nativeMultiply(factors.money);
    const health=numericMirror(healthValue),coin=numericMirror(coinValue);
    const position = gridPositions[Math.floor(index / perGrid)][index % perGrid];
    return { ...target, position, health, maxHealth: health, coin, healthValue, maxHealthValue:healthValue, coinValue, tier, grid:Math.floor(index/perGrid) };
  });
  if (level === 4) {
    const factors=sourceDegreeFactors(3);
    const healthValue=decimal(base.health).nativeMultiply(factors.health),coinValue=decimal(base.money).nativeMultiply(factors.money);
    targets.push({ id:ordinaryCount+1, position:worldToField(-100,282),health:numericMirror(healthValue),maxHealth:numericMirror(healthValue),
      coin:numericMirror(coinValue),healthValue,maxHealthValue:healthValue,coinValue,tier:3,grid:5,radius:fieldConfig.level.targetRadius*2,boss:true });
  }
  return { ...battle, player: { ...FIELD_SPAWN }, actors:[makeActor(0,FIELD_SPAWN)], targets, targetBatchSize: 0, autoMove: true, autoStopWorldDistance: 10,
    worldUnitsPerPoint: FIELD_UNITS_PER_POINT };
}

function createChallengeLevel(quote: ChallengeQuote, coins: BigValueInput, upgrades: State["upgradeLevels"], seed: number): { battle: State; rngState: number } {
  const config: RuleConfig = { ...challengeConfig,
    level: { ...challengeConfig.level, seconds: quote.seconds, targetCount: quote.targetCount,
      targetHealth: numericMirror(quote.healthByTier[0]) } };
  const battle = createLevel(quote.sourceIndex, 0, coins, upgrades, config);
  let rngState = seed;
  // H5 deterministic RNG adapter for source entry-time jitter and tier draws.
  // The Unity RNG seed/sequence is not claimed to match.
  const random01 = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };
  const slots = challengeSlots(quote.targetCount, random01);
  const targets = battle.targets.map((target, index) => {
    const tier = Math.floor(random01() * quote.healthByTier.length);
    const healthValue = quote.healthByTier[tier], coinValue = quote.coinByTier[tier];
    const health = numericMirror(healthValue), coin = numericMirror(coinValue);
    return { ...target, position: slots[index].position, health, maxHealth: health, healthValue,
      maxHealthValue: healthValue, coin, coinValue, tier };
  });
  return { battle: { ...battle, player: { ...CHALLENGE_SPAWN }, actors: [makeActor(0,CHALLENGE_SPAWN)],
    targets, targetBatchSize: 0,sourceStagePenalty:false, autoMove: true, autoStopWorldDistance: 10,
    worldUnitsPerPoint: { ...CHALLENGE_UNITS_PER_POINT } }, rngState };
}

function restoreField(session: Session): State {
  const field = session.fieldBattle ?? createFieldLevel(0, 0, 0, undefined, session.rngState);
  return { ...field, coins: session.battle.coins, coinsValue:walletValue(session.battle), upgradeLevels: { ...session.battle.upgradeLevels } };
}

export function createSession(seed = crypto.getRandomValues(new Uint32Array(1))[0]): Session {
  return {
    mode: "field",adGun:freshSourceAdGun(),weeklyShop:freshSourceWeekly(),plusPack:freshSourcePlus(),diaPig:freshSourceDiaPig(),stepUp:freshSourceStepUp(),skin:freshSourceSkinState(),boss:freshSourceBossState(),bossMotion:null,bossSlotLevels:[0,0,0],starFailCounts:[0,0,0],starGem:0, overlay: "daily", mine:{tickets:{used:0,storedDate:localMineTime.today()},bestReward:0,run:null,settlement:null}, battle: createFieldLevel(0, 0, 0, undefined, seed), fieldBattle: null, challengeStage: 1, challengeSettlement:null,challengeRunSequence:0,challengeRunID:null,challengeRewardClaims:[],diamonds: 0,
    dailyClaimed: false,
    gunUnlocked: false, gunInventory: [], equippedGuns: [starterGun, null, null], gunDraws: 0,catalogSeen:[0],gunSafe:freshSourceGunSafe(),
    rngState: seed >>> 0,
    challengeSeconds: CHALLENGE_SECONDS, historicMax:0, notice:"", ruby:BigValue.fromInteger(0), rebirthCount:0,
    permanentLevels:{damage:0,money:0,speed:0}, events: []
  };
}

export function openDaily(session: Session): Session {
  if (session.mode !== "field" || session.overlay !== "none" || session.dailyClaimed) return session;
  return { ...session, overlay: "daily", events: [] };
}

export function claimDaily(session: Session): Session {
  if (session.overlay !== "daily" || session.dailyClaimed) return session;
  return { ...session, diamonds: session.diamonds + DAY_ONE_DIAMONDS, dailyClaimed: true,
    events: [{ type: "dailyClaimed", diamonds: DAY_ONE_DIAMONDS }] };
}

export function openGun(session: Session): Session {
  if (session.mode !== "field" || session.overlay !== "none" || !session.gunUnlocked) return session;
  return { ...session, overlay: "gun", events: [] };
}

export function drawGun(session: Session): Session {
  if (session.mode !== "field" || session.overlay !== "gun" || !session.gunUnlocked ||
      session.diamonds < GUN_GACHA_COST || session.gunInventory.length >= GUN_INVENTORY_CAPACITY) return session;
  // The source pool is known, but the original RNG sequence is not.
  const rngState = (Math.imul(session.rngState, 1664525) + 1013904223) >>> 0;
  const gun = {...sourceGun(Math.floor(rngState / 0x100000000 * normalGunPool.length)),uid:`draw-${rngState}-${session.gunDraws+1}`};
  return {
    ...session, diamonds: session.diamonds - GUN_GACHA_COST,
    gunInventory: [...session.gunInventory, gun], gunDraws: session.gunDraws + 1, rngState,
    events: [{ type: "gunDrawn", gun }]
  };
}

export function equipGun(session: Session, inventoryIndex: number, slot: number): Session {
  if (session.mode !== "field" || session.overlay !== "gun" || !session.gunUnlocked ||
      !Number.isInteger(inventoryIndex) || !Number.isInteger(slot) ||
      inventoryIndex < 0 || inventoryIndex >= session.gunInventory.length ||
      slot < 0 || slot >= session.equippedGuns.length || session.equippedGuns[slot] !== null) return session;
  const gun = session.gunInventory[inventoryIndex];
  if(gun.adReward)return {...session,notice:"临时广告武器需先领取，不能装备"};
  const equippedGuns = [...session.equippedGuns];
  equippedGuns[slot] = gun;
  return {
    ...session, gunInventory: session.gunInventory.filter((_, index) => index !== inventoryIndex),
    equippedGuns, events: [{ type: "gunEquipped", gun, slot }]
  };
}

export function openChallenge(session: Session): Session {
  if (session.mode !== "field" || session.overlay !== "none") return session;
  return { ...session, overlay: "challenge", events: [] };
}

export function closeOverlay(session: Session): Session {
  if(session.overlay==="challenge-sweep")return closeChallengeSweep(session);
  return { ...session, overlay: "none", events: [] };
}

function nextChallengeSequence(session:Session):number {
 const next=(session.challengeRunSequence??0)+1;if(!Number.isSafeInteger(next))throw RangeError("Challenge run identity overflow");return next;
}
function challengeWallet(session:Session,grant:number):number {
 const balance=session.diamonds+grant;if(!Number.isSafeInteger(balance))throw RangeError("Diamond wallet overflow");return balance;
}
export function startChallenge(session: Session): Session {
  if (session.mode !== "field" || session.overlay !== "challenge") return session;
  const quoted = challengeQuote(session.challengeStage);
  if (quoted.status !== "supported") return { ...session, notice: quoted.reason, events: [] };
  const { battle, rngState } = createChallengeLevel(quoted.value, walletValue(session.battle),
    session.battle.upgradeLevels, session.rngState);
  return {
    ...session, mode: "challenge", overlay: "none", notice: "", challengeSeconds: CHALLENGE_SECONDS, fieldBattle: session.battle,
    battle, rngState,challengeSettlement:null,challengeRunSequence:nextChallengeSequence(session),challengeRunID:`challenge:${nextChallengeSequence(session)}:${session.challengeStage}`,
    events: []
  };
}

export function exitChallenge(session: Session): Session {
  if (session.mode !== "challenge") return session;
  return {
    ...session, mode: "field", battle: restoreField(session), fieldBattle: null,challengeRunID:null,challengeSettlement:null,
    events: []
  };
}

export function claimVictory(session: Session): Session {
  if (session.mode !== "victory") return session;
  const gunUnlocked = true;
  return {
    ...session, mode: "field", diamonds: challengeWallet(session,session.challengeSettlement?0:CHALLENGE_REWARD_DIAMONDS), gunUnlocked, challengeStage: session.challengeStage + (session.challengeSettlement?0:1),challengeSettlement:null,challengeRunID:null,
    battle: restoreField(session), fieldBattle: null,
    events: session.gunUnlocked ? [] : [{ type: "gunUnlocked" }]
  };
}

/** Game_Win grants and advances BEFORE displaying the result. Legacy victories have no ledger. */
export function settleChallengeVictory(session:Session,e:SourceEntitlements=freshSourceEntitlements()):Session {
 if(session.mode!=='challenge'||session.challengeSettlement)return session;
 const sequence=session.challengeRunID?session.challengeRunSequence??0:nextChallengeSequence(session);
 const runID=session.challengeRunID??`challenge:${sequence}:${session.challengeStage}`;
 const result=sourceChallengeSettlement(runID,session.challengeStage,'fight',sourceRewardEntitlements(e).automaticBonus);
 return {...session,mode:'victory',challengeRunID:runID,challengeRunSequence:sequence,challengeStage:session.challengeStage+1,diamonds:challengeWallet(session,result.initialReward),challengeSettlement:result};
}
export function sessionChallengePower(session:Session,e:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState):BigValue {
 const mods=sessionCombatModifiers(session,e,fish,undefined,buffTimes,relic),levels=(session.fieldBattle??session.battle).upgradeLevels;
 return sourceChallengePowerFromCats(session.equippedGuns.map((gun,slot)=>{
  if(!gun&&slot!==0)return {active:false,cooldownSeconds:0,normalDamage:0,criticalDamage:0,criticalProbability:0,type:0,pelletCount:1};
  const g=gun??starterGun,stats=sourceGunDamageStats(g,levels.power,mods,slot);
  return {active:true,...stats,cooldownSeconds:sourceGunCooldown(g,levels.speed,mods),type:g.sourceType??0,pelletCount:g.pelletCount??1};
 }));
}
export function sweepChallenge(session:Session,e:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState):Session {
 if(session.mode!=='field'||session.overlay!=='challenge'||session.challengeSettlement)return session;
 if(!e.plusPack2Active)return {...session,notice:'挑战扫荡需要Plus2自动权益'};
 const q=challengeQuote(session.challengeStage);if(q.status!=='supported')return {...session,notice:q.reason};
 if(!sourceChallengeSweepAble(session.challengeStage,sessionChallengePower(session,e,fish,buffTimes,relic)))return {...session,notice:'挑战战力必须严格大于扫荡要求；相等也不能扫荡'};
 const sequence=nextChallengeSequence(session),runID=`challenge:${sequence}:${session.challengeStage}`;
 const result=sourceChallengeSettlement(runID,session.challengeStage,'sweep',sourceRewardEntitlements(e).automaticBonus);
 return {...session,overlay:'challenge-sweep',challengeRunID:runID,challengeRunSequence:sequence,challengeStage:session.challengeStage+1,challengeSettlement:result,diamonds:challengeWallet(session,result.initialReward),notice:'',events:[]};
}
/** Callback consumer: result context and request/run identity are rechecked at commit. */
export function claimChallengeBonus(session:Session,pending:SourceChallengeAdRequest|null,response:SourceRewardResponse):{session:Session;status:'granted'|'duplicate'|'blocked'} {
 const result=session.challengeSettlement;
 if(!result||session.challengeRunID!==result.runID||result.kind==='fight'&&session.mode!=='victory'||result.kind==='sweep'&&(session.mode!=='field'||session.overlay!=='challenge-sweep'))return {session,status:'blocked'};
 const claim=sourceChallengeBonusReward(result,pending,response,session.challengeRewardClaims??[]);
 if(claim.status!=='granted')return {session,status:claim.status};
 return {status:'granted',session:{...session,diamonds:challengeWallet(session,claim.diamondGrant),challengeSettlement:claim.settlement,challengeRewardClaims:claim.claims}};
}
export function closeChallengeSweep(session:Session):Session {
 return session.mode==='field'&&session.overlay==='challenge-sweep'&&session.challengeSettlement?.kind==='sweep'?{...session,overlay:'challenge',challengeRunID:null,challengeSettlement:null,notice:'',events:[]}:session;
}
export function acknowledgeDefeat(session: Session): Session {
  if (session.mode !== "defeat") return session;
  return { ...session, mode: "field", battle: restoreField(session), fieldBattle: null, challengeRunID:null,challengeSettlement:null,events: [] };
}

export function purchase(session: Session, kind: UpgradeKind): Session {
  if (session.overlay !== "none" || session.mode === "victory" || session.mode === "defeat" || session.mode === "mine-result") return session;
  const battle = buyUpgrade(session.battle, kind, fieldConfig);
  return { ...session, battle, events: battle === session.battle ? [] : [{ type: "upgradeSucceeded", kind, level: battle.upgradeLevels[kind] }] };
}

export function step(session: Session, dt: number, input: TickInput = {}, resolveMuzzle?: MuzzleResolver,entitlements:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,pet?:SourcePetState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState): Session {
  if(session.mode==="boss")return tickBossBattle({...session,battle:{...session.battle,combatModifiers:sessionCombatModifiers(session,entitlements,fish,pet,buffTimes,relic)}},dt,input,resolveMuzzle,sourceRewardEntitlements(entitlements),sessionBossModifiers(session,entitlements,fish,buffTimes,relic));
  if(session.mode==="mine") return stepMine(session,dt,input,resolveMuzzle,entitlements,fish,pet,buffTimes,relic);
  if ((session.overlay !== "none" && session.overlay !== "gun") || (session.mode !== "field" && session.mode !== "challenge")) return { ...session, events: [] };
  const old = session.battle;
  const primary=session.equippedGuns[0] ?? starterGun;
  const battle=tick({...old,targetBatchSize:session.mode==="challenge"?0:old.targetBatchSize,combatModifiers:sessionCombatModifiers(session,entitlements,fish,pet,buffTimes,relic),primaryGun:{...primary,slot:0}},dt,input,session.mode==="challenge"?challengeConfig:fieldRuleConfig(old.stage,old.level),
    session.equippedGuns.slice(1).flatMap((gun,index)=>gun?[{...gun,slot:index+1}]:[]),resolveMuzzle);
  const events:GameEvent[]=(battle.shotEvents??[]).map(event=>({...event,type:"shot",x:event.muzzle.x,y:event.muzzle.y}));
  events.push(...(battle.projectileLifecycleEvents??[]));
  events.push(...(battle.impactEvents??[]).map(event=>({...event,type:"projectileImpact" as const})));
  for (const tree of battle.targets) {
    const before = old.targets.find(t => t.id === tree.id);
    if (!before || healthValue(tree).gte(healthValue(before))) continue;
    const damageValue=healthValue(before).sub(healthValue(tree));
    events.push({ type:"hit",id:tree.id,damage:numericMirror(damageValue),damageValue });
    if (tree.health === 0) events.push({ type: "death", id: tree.id, x: tree.position.x, y: tree.position.y });
  }
  if(walletValue(battle).gt(walletValue(old))) {
    const amountValue=walletValue(battle).sub(walletValue(old));events.push({type:"currencyCollected",amount:numericMirror(amountValue),amountValue});
  }
  if (battle.phase === "won") {
    if (session.mode === "challenge") {
      events.push({ type: "stageWon", stage: battle.stage });
      return settleChallengeVictory({...session,battle,events,challengeSeconds:Math.max(0,CHALLENGE_SECONDS-battle.elapsed)},entitlements);
    }
    events.push({ type: "stageWon", stage: battle.stage });
    const nextLevel = battle.level + 1;
    const stage = battle.stage + Math.floor(nextLevel / fieldConfig.stage.levelsPerStage);
    const level = nextLevel % fieldConfig.stage.levelsPerStage;
    return { ...session, battle: createFieldLevel(stage, level, walletValue(battle), battle.upgradeLevels, session.rngState), historicMax:Math.max(session.historicMax,stage*10+level), events };
  }
  if (battle.phase === "lost") {
    events.push({ type: "stageFailed", stage: battle.stage });
    return { ...session, mode: "defeat", battle, challengeSeconds: 0, events };
  }
  return { ...session, battle, challengeSeconds: session.mode === "challenge" ? Math.max(0, CHALLENGE_SECONDS - battle.elapsed) : CHALLENGE_SECONDS, events };
}

/** Equipment restriction is an explicit H5 policy; the video is corroborating evidence only. */
export function unequipGun(session:Session,slot:number):Session {
  if(session.mode!=="field"||session.overlay!=="gun"||!Number.isInteger(slot)||slot<0||slot>=3||!session.equippedGuns[slot])return session;
  if(session.gunInventory.length>=GUN_INVENTORY_CAPACITY)return {...session,notice:"背包已满"};
  const result=equipmentRemovalPolicy(session.equippedGuns.map((g,i)=>g?i:null),slot);
  if(result.status!=="supported")return {...session,notice:"无法卸下，至少需要装备1件"};
  const equippedGuns=[...session.equippedGuns],gun=equippedGuns[slot]!;equippedGuns[slot]=null;
  // Keep the player actor mapped to one equipped weapon in this H5 adapter.
  if(slot===0){const replacement=equippedGuns.findIndex(g=>g!==null);equippedGuns[0]=equippedGuns[replacement];equippedGuns[replacement]=null;}
  return {...session,equippedGuns,gunInventory:[...session.gunInventory,gun],notice:"",events:[]};
}
/** H5 checkpoint storage; not a claim about the original game's complete persistence schema. */
export function serializeSession(session:Session):string {const persisted=["boss","boss-result"].includes(session.mode)?{...session,mode:"field",battle:session.fieldBattle??session.battle,fieldBattle:null,bossMotion:null,boss:{stage:session.boss.stage,run:null}}:session;return JSON.stringify({schema:2,session:{...persisted,gunSafe:session.gunSafe?{...session.gunSafe,guns:session.gunSafe.guns.map(g=>g?({...g,uid:gunEntityUID(g)}):null)}:undefined,gunInventory:session.gunInventory.map(g=>({...g,uid:gunEntityUID(g)})),equippedGuns:session.equippedGuns.map(g=>g?({...g,uid:gunEntityUID(g)}):null),events:[]}});}
export function deserializeSession(text:string):Session {
  const data=JSON.parse(text,(_key,value)=>value&&typeof value==="object"&&typeof value.coefficient==="string"&&Number.isInteger(value.exponent)
    ?BigValue.fromJSON(value):value);
  if(data.schema!==2||!data.session||!Array.isArray(data.session.equippedGuns)||data.session.equippedGuns.length!==3)throw new Error("Invalid Cat Gunner save");
  const saved=data.session as Session;
  saved.ruby=BigValue.from(saved.ruby??BigValue.fromInteger(0));saved.rebirthCount??=0;
  saved.permanentLevels??={damage:0,money:0,speed:0};
  if(!Object.prototype.hasOwnProperty.call(saved,'diaPig'))saved.diaPig=freshSourceDiaPig();validateSourceDiaPig(saved.diaPig!);
  if(!Object.prototype.hasOwnProperty.call(saved,'weeklyShop'))saved.weeklyShop=freshSourceWeekly();validateSourceWeekly(saved.weeklyShop!);
  if(!Object.prototype.hasOwnProperty.call(saved,'plusPack'))saved.plusPack=freshSourcePlus();validateSourcePlus(saved.plusPack!);
  saved.stepUp??=freshSourceStepUp();validateSourceStepUp(saved.stepUp);
  if(!Object.prototype.hasOwnProperty.call(saved,'adGun'))saved.adGun=freshSourceAdGun();validateSourceAdGun(saved.adGun!);
  saved.skin??=freshSourceSkinState();validateSourceSkinState(saved.skin);
  saved.boss??=freshSourceBossState();saved.bossMotion=null;saved.bossSlotLevels??=[0,0,0];saved.starFailCounts??=[0,0,0];saved.starGem??=0;
  validateSourceStarState({levels:saved.bossSlotLevels,failCounts:saved.starFailCounts,starGem:saved.starGem});
  if(!Number.isInteger(saved.boss.stage)||saved.boss.stage<0||saved.boss.stage>2147483647||saved.boss.run!==null||!Array.isArray(saved.bossSlotLevels)||saved.bossSlotLevels.length!==3||saved.bossSlotLevels.some(v=>!Number.isInteger(v)||v<0||v>20))throw new Error("Invalid Boss save state");
  saved.mine??={tickets:{used:0,storedDate:localMineTime.today()},bestReward:0,run:null,settlement:null};
  const validInteger=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
  for(const [key,value] of Object.entries({challengeSettlement:null,challengeRunSequence:0,challengeRunID:null,challengeRewardClaims:[]}))if(!Object.prototype.hasOwnProperty.call(saved,key))(saved as any)[key]=value;
  if(!validInteger(saved.challengeRunSequence,0,Number.MAX_SAFE_INTEGER)||saved.challengeRunID!==null&&typeof saved.challengeRunID!=='string'||!Array.isArray(saved.challengeRewardClaims)||saved.challengeRewardClaims.some(id=>typeof id!=='string'||!id)||new Set(saved.challengeRewardClaims).size!==saved.challengeRewardClaims.length)throw Error('Invalid challenge reward ledger');
  if(saved.challengeSettlement!==null){
   validateSourceChallengeSettlement(saved.challengeSettlement);
   const r=saved.challengeSettlement;
   if(saved.challengeStage!==r.completedStage+1||saved.challengeRunID!==r.runID||r.kind==='fight'&&saved.mode!=='victory'||r.kind==='sweep'&&(saved.mode!=='field'||saved.overlay!=='challenge-sweep'))throw Error('Invalid challenge settlement context');
  }else if(saved.overlay==='challenge-sweep')throw Error('Missing challenge sweep settlement');
  const activeChallenge = ["challenge","victory","defeat"].includes(saved.mode) && !!saved.fieldBattle;
  const modes=["field","challenge","victory","defeat","mine","mine-result"];
  const overlays=["none","daily","challenge","gun","rebirth","permanent","mine","challenge-sweep"];
  if(!saved.battle || !modes.includes(saved.mode)||!overlays.includes(saved.overlay)
    ||!validInteger(saved.challengeStage,1,MAX_CHALLENGE_STAGE+1)
    ||!validInteger(saved.battle.stage,0,activeChallenge?MAX_CHALLENGE_STAGE-1:4999)||!validInteger(saved.battle.level,0,4)
    ||(activeChallenge&&(saved.battle.stage!==(saved.challengeSettlement?.completedStage??saved.challengeStage)-1||saved.battle.level!==0))
    ||(["challenge","victory"].includes(saved.mode)&&!activeChallenge)
    ||!validInteger(saved.rebirthCount,0,Number.MAX_SAFE_INTEGER)||saved.ruby.lt(0)
    ||!validInteger(saved.diamonds,0,Number.MAX_SAFE_INTEGER)
    ||!validInteger(saved.historicMax,0,49994)
    ||!saved.mine.tickets||!validInteger(saved.mine.tickets.used,0,6)||typeof saved.mine.tickets.storedDate!=="string"
    ||!validInteger(saved.mine.bestReward,0,Number.MAX_SAFE_INTEGER)
    ||(["mine","mine-result"].includes(saved.mode)&&(!saved.mine.run||!saved.fieldBattle))
    ||(saved.mine.run&&(!validInteger(saved.mine.run.score,0,Number.MAX_SAFE_INTEGER)
      ||!Number.isFinite(saved.mine.run.elapsed)||saved.mine.run.elapsed<0||saved.mine.run.elapsed>saved.mine.run.durationSeconds))
    ||!Object.values(saved.permanentLevels).every(level=>validInteger(level,0,20000))
    ||!["damage","money","speed"].every(kind=>kind in saved.permanentLevels)
    ||!Object.values(saved.battle.upgradeLevels).every(level=>validInteger(level,0,10000))
    ||!Array.isArray(saved.gunInventory)||saved.gunInventory.length>GUN_INVENTORY_CAPACITY
    ||!saved.equippedGuns.some(g=>g)||!saved.equippedGuns[0]||walletValue(saved.battle).lt(0))throw new Error("Invalid saved state");
  if(saved.mine.run) {
    const run=saved.mine.run;
    const finitePoint=(p:Point)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
    const resultMode=saved.mode==="mine-result";
    if(!["mine","mine-result"].includes(saved.mode)||!Number.isFinite(run.durationSeconds)||run.durationSeconds<=0
      ||typeof run.settled!=="boolean"||run.settled!==resultMode
      ||!validInteger(run.sourceOreCountNow,0,1000)||!run.bounds
      ||!finitePoint(run.bounds.minimum)||!finitePoint(run.bounds.maximum)
      ||run.bounds.minimum.x>=run.bounds.maximum.x||run.bounds.minimum.y>=run.bounds.maximum.y
      ||!run.generation||!validInteger(run.generation.activeCount,0,1000)
      ||!Array.isArray(saved.battle.targets)||saved.battle.targets.length!==run.generation.activeCount
      ||!finitePoint(saved.battle.player)||!saved.fieldBattle
      ||(resultMode&&(!saved.mine.settlement||!validInteger(saved.mine.settlement.initialReward,0,Number.MAX_SAFE_INTEGER)))
      ||(!resultMode&&saved.mine.settlement!==null))throw new Error("Invalid mine save state");
  }
  const restoreGun=(gun:Gun|null):Gun|null=>{
    if(gun===null)return null;
    if(gun.uid!==undefined&&(typeof gun.uid!=="string"||!gun.uid.trim()||gun.uid.length>160))throw new Error("Invalid gun identity");
    if(gun.paused!==undefined&&typeof gun.paused!=="boolean"||gun.adReward!==undefined&&typeof gun.adReward!=="boolean")throw new Error("Invalid gun protection flags");
    if(gun.id==="starter-single-d")return {...starterGun,uid:gun.uid,paused:gun.paused,adReward:gun.adReward};
    if(!/^source-gun-\d+$/.test(gun.id))throw new Error("Invalid saved gun");
    return {...sourceGun(sourceGunID(gun)),uid:gun.uid,paused:gun.paused,adReward:gun.adReward};
  };
  saved.equippedGuns=saved.equippedGuns.map(restoreGun);
  saved.gunInventory=saved.gunInventory.map(g=>restoreGun(g)!);
  if(saved.gunSafe===undefined)saved.gunSafe=freshSourceGunSafe();
  validateSourceGunSafe(saved.gunSafe);saved.gunSafe={...saved.gunSafe,guns:saved.gunSafe.guns.map(restoreGun)};
  const identities=[...saved.gunSafe.guns.filter((g):g is Gun=>!!g),...saved.gunInventory,...saved.equippedGuns.filter((g):g is Gun=>!!g)].map(g=>g.uid).filter((id):id is string=>id!==undefined);
  if(new Set(identities).size!==identities.length)throw new Error("Duplicate saved gun identity");
  if(saved.catalogSeen===undefined)saved.catalogSeen=[...new Set([...saved.gunInventory,...saved.equippedGuns.filter((g):g is Gun=>!!g)].map(sourceGunID))];
  else if(!Array.isArray(saved.catalogSeen)||saved.catalogSeen.some(id=>!validInteger(id,0,64))||new Set(saved.catalogSeen).size!==saved.catalogSeen.length)throw new Error("Invalid gun catalogue history");
  if(activeChallenge)saved.battle={...saved.battle,sourceStagePenalty:false};
  if(saved.mine.run) saved.mine.run={...saved.mine.run,battle:saved.battle as MineRun["battle"],events:[]};
  return {...saved,events:[],notice:""};
}

/** Serialized gun catalogue; group-zero UI aliases retain the earlier observed names. */
export function sourceGun(id:number):Gun {
  if(!Number.isInteger(id)||id<0||id>=sourceGuns.guns.length)throw new RangeError("Invalid source gun");
  const raw=sourceGuns.guns[id],damageValue=BigValue.from(`${raw.damage}e${raw.damageExponent}`);
  return {id:`source-gun-${id}`,name:id<5?normalGunPool[id].name:raw.name,damage:numericMirror(damageValue),damageValue,
    intervalSeconds:raw.intervalSeconds,sourceType:raw.type,explosionRadius:raw.explosionRadius,
    missileExplosionRadius:raw.missileExplosionRadius,blastSniperExplosionRadius:raw.blastSniperExplosionRadius,missileSpeed:raw.missileSpeed,penetratingBulletLifetime:raw.penetratingBulletLifetime,
    ...(raw.type===3 ? {pelletCount:raw.pelletCount,spreadDegrees:raw.spreadDegrees}: {})};
}
export function sourceGunID(gun:Gun):number {return Number(gun.id.match(/^source-gun-(\d+)$/)?.[1]??0);}
export function sessionCombatModifiers(session:Session,entitlements:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,pet?:SourcePetState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState) {
  const damage=permanentUpgradeQuote("damage",session.permanentLevels.damage),
    money=permanentUpgradeQuote("money",session.permanentLevels.money);
  if(damage.status!=="supported"||money.status!=="supported")throw new RangeError("Invalid permanent upgrade state");
  const skin=sourceSkinTotals(session.skin);
  const base=sourceEntitlementCombatModifiers({permanentDamagePercent:damage.value.currentPercent,permanentMoneyPercent:money.value.currentPercent,
    permanentSpeedPercent:100+5*session.permanentLevels.speed,skinSpeedPercent:skin.speedPercent,attackSpeedBuff:1},entitlements,buffTimes);
  const petStats=pet?sourcePetSelectedStats(pet):undefined,rel=sourceRelicTotals(relic);
  const all={...base,skinDamagePercent:skin.damagePercent,skinMoneyPercent:skin.moneyPercent,slotStarLevels:session.bossSlotLevels??[0,0,0],sourceMoneyRebirthPercent:money.value.currentPercent,sourceMoneyBuffPercent:sourceBuffMultiplier(entitlements,"money",buffTimes)*100,petMoneyPercent:petStats?.moneyMultiplierPercent??BigValue.fromInteger(100),petMoveSpeedPercent:petStats?.moveSpeedMultiplierPercent??100,relicMoveSpeedValue:rel.moveSpeedValue,relicDamagePercent:rel.damagePercent,relicMoneyPercent:rel.moneyPercent,relicCriticalPercent:rel.criticalPercent};
  return fish?sourceFishCombatModifiers(all,fish):all;
}
/** Source Boss mode skips ordinary power/speed upgrades;
 * skins accumulate ownership, independent of the visual selection. */
export function sessionBossModifiers(session:Session,e:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState):SourceBossTeamModifiers {
 const mods=sessionCombatModifiers(session,e,fish,undefined,buffTimes,relic),totals=fish?sourceFishTotals(fish):{damagePercent:0,criticalChancePercent:0,criticalDamagePercent:0};
 return {rebirthDamagePercent:mods.permanentDamagePercent,skinDamagePercent:mods.skinDamagePercent,fishDamagePercent:totals.damagePercent,relicDamagePercent:mods.relicDamagePercent,damageBuffMultiplier:mods.damageBuffMultiplier,
  fishCriticalValuePercent:totals.criticalDamagePercent,relicCriticalDamagePercent:mods.relicCriticalPercent,fishCriticalChancePercent:totals.criticalChancePercent,skinSpeedPercent:mods.skinSpeedPercent,rebirthSpeedPercent:mods.permanentSpeedPercent,speedBuffMultiplier:mods.attackSpeedBuff};
}
export function sessionBossPower(session:Session,e:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState):BigValue {return bossTeamPower(session,sessionBossModifiers(session,e,fish,buffTimes,relic));}
export function startBoss(session:Session,e:SourceEntitlements=freshSourceEntitlements()):Session {return contentGate(session.historicMax,'boss').unlocked?enterBossBattle(session,e):{...session,notice:'首领在第10大关开放'};}
export function exitBoss(session:Session):Session {return leaveBossBattle(session);}
export function claimBossBonus(session:Session,confirmed:boolean):Session {return confirmed?leaveBossBattle(session,true):{...session,notice:'广告服务尚未确认'};}
export function sweepBoss(session:Session,e:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,pet?:SourcePetState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState):Session {return contentGate(session.historicMax,'boss').unlocked?sweepBossBattle(session,sourceRewardEntitlements(e),sessionBossPower(session,e,fish,buffTimes,relic),e.plusPack2Active):{...session,notice:'首领在第10大关开放'};}
export function openRebirth(session:Session):Session {
  if(session.mode!=="field"||session.overlay!=="none")return session;
  const gate=rebirthPopupGate(session.historicMax,session.battle.stage);
  return gate.status==="supported" ? {...session,overlay:"rebirth",notice:"",events:[]} : {...session,notice:"转生在第3大关开放"};
}
export function openPermanent(session:Session):Session {
  if(session.mode!=="field"||!["none","rebirth"].includes(session.overlay))return session;
  if(!contentGate(session.historicMax,"rebirth").unlocked)return {...session,notice:"永久强化在第3大关开放"};
  return {...session,overlay:"permanent",notice:"",events:[]};
}
export function sessionRebirthReward(session:Session,relic?:SourceRelicState):BigValue {
  const result=rebirthReward({stage:session.battle.stage,level:session.battle.level,relicRebirthPercent:sourceRelicTotals(relic).rebirthPercent});
  return result.status==="supported"?result.value:BigValue.ZERO;
}
/** Confirmed base rebirth only; platform enhanced grants use a separate provider interface. */
export function confirmRebirth(session:Session,relic?:SourceRelicState):Session {
  if(session.mode!=="field"||session.overlay!=="rebirth")return session;
  const result=completeRebirth({stage:session.battle.stage,level:session.battle.level,historicMax:session.historicMax,
    rebirthCount:session.rebirthCount,coins:walletValue(session.battle),coinsAccum:session.battle.earnedValue??session.battle.earned,
    ruby:session.ruby,ordinaryUpgradeLevels:Object.values(session.battle.upgradeLevels),
    permanentUpgradeLevels:[session.permanentLevels.damage,session.permanentLevels.speed,session.permanentLevels.money],weapons:session.equippedGuns.filter((g):g is Gun=>!!g).map(sourceGunID)},{relicRebirthPercent:sourceRelicTotals(relic).rebirthPercent});
  if(result.status!=="supported")return {...session,notice:result.reason};
  return {...session,overlay:"none",battle:createFieldLevel(0,0,0,undefined,session.rngState),fieldBattle:null,
    ruby:result.value.state.ruby,rebirthCount:result.value.state.rebirthCount,notice:"",events:[]};
}
export function purchasePermanent(session:Session,kind:PermanentUpgradeKind):Session {
  if(session.mode!=="field"||session.overlay!=="permanent")return session;
  const result=purchasePermanentUpgrade({ruby:session.ruby,levels:session.permanentLevels},kind);
  if(result.status!=="supported")return {...session,notice:result.status==="blocked"?"红宝石不足或已满级":result.reason};
  return {...session,ruby:result.value.state.ruby,permanentLevels:result.value.state.levels,notice:"",events:[]};
}
export function fuseInventory(session:Session,from:number,to:number):Session {
  if(session.mode!=="field"||session.overlay!=="gun"||!session.gunUnlocked||!Number.isInteger(from)||!Number.isInteger(to)
    ||from<0||to<0||from>=session.gunInventory.length||to>=session.gunInventory.length)return session;
  if(session.gunInventory[from].adReward||session.gunInventory[to].adReward)return {...session,notice:"临时广告武器需先领取，不能合成"};
  const owned=session.gunInventory.map(sourceGunID);
  let rngState=session.rngState;
  const result=completeManualFusion({owned,paused:session.gunInventory.map(g=>g.paused===true),
    source:{slot:from,gunID:owned[from],active:true},target:{slot:to,gunID:owned[to],active:true},gunCount:65,
    randomInt:(min,max)=>{rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return min+Math.floor(rngState/0x100000000*(max-min));}});
  if(result.status!=="supported")return {...session,notice:Math.floor(owned[from]/5) === Math.floor(owned[to]/5) ? "该组已无法继续合成" : "仅同组武器可合成"};
  return {...session,adGun:{...(session.adGun??freshSourceAdGun()),hasMerged:true},gunInventory:result.value.owned.map((id,i)=>id<0?null:id===owned[i]?session.gunInventory[i]:{...sourceGun(id),uid:`fuse-${rngState}-${session.gunDraws}-${i}`}).filter((gun):gun is Gun=>gun!==null),rngState,notice:"",events:[]};
}

/** Mine unlock/source ticket/settlement contracts; date and runtime adapters are recorded separately. */
export function openMine(session:Session):Session {
  if(session.mode!=="field"||session.overlay!=="none")return session;
  if(!contentGate(session.historicMax,"mine").unlocked)return {...session,notice:"矿场在第4大关开放"};
  return {...session,overlay:"mine",notice:"",events:[]};
}
/** Optional confirmed MinePack entitlement; omitted callers retain the ordinary two-ticket limit. */
export function startMine(session:Session,time:MineTimeAdapter=localMineTime,minePack=false,entitlements:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,pet?:SourcePetState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState):Session {
  if(session.mode!=="field"||session.overlay!=="mine"||!contentGate(session.historicMax,"mine").unlocked)return session;
  const today=time.today(),entry=enterSourceMine(session.mine.tickets,minePack,today,
    time.canRolloverDaily(3,session.mine.tickets.storedDate,today));
  if(entry.status==="unsupported")return {...session,notice:"矿场日期暂不可用"};
  if(entry.status==="blocked")return {...session,mine:{...session.mine,tickets:entry.state},notice:"今日矿场次数已用完"};
  const run=createMineBattle(session.battle,session.rngState,{guns:session.equippedGuns.map((g,slot)=>g?{...g,slot}:null),
    combatModifiers:sessionCombatModifiers(session,entitlements,fish,pet,buffTimes,relic),plusTimePackActive:entitlements.plusPack0Active});
  return {...session,mode:"mine",overlay:"none",fieldBattle:session.battle,battle:run.battle,
    mine:{...session.mine,tickets:entry.state,run,settlement:null},challengeSeconds:run.durationSeconds,notice:"",events:[]};
}
function stepMine(session:Session,dt:number,input:TickInput,resolveMuzzle?:MuzzleResolver,entitlements:SourceEntitlements=freshSourceEntitlements(),fish?:SourceFishState,pet?:SourcePetState,buffTimes?:SourceBuffTimes,relic?:SourceRelicState):Session {
  if(session.overlay!=="none"||!session.mine.run)return {...session,events:[]};
  const run=tickMineBattle({...session.mine.run,battle:session.battle as MineRun["battle"]},dt,input,resolveMuzzle,
    session.equippedGuns.map((g,slot)=>g?{...g,slot}:null),sessionCombatModifiers(session,entitlements,fish,pet,buffTimes,relic));
  const next={...session,battle:run.battle,mine:{...session.mine,run},challengeSeconds:mineProgress(run).remainingSeconds,events:run.events};
  if(!run.settled)return next;
  const result=mineSettlement({diaScore:run.score,bestReward:session.mine.bestReward,plusPack1Active:entitlements.plusPack1Active,automaticBonus:sourceRewardEntitlements(entitlements).automaticBonus});
  if(result.status!=="supported")return {...next,notice:result.reason};
  const diamonds=session.diamonds+result.value.initialReward;
  if(!Number.isSafeInteger(diamonds))throw new RangeError("Diamond wallet overflow");
  return {...next,mode:"mine-result",diamonds,mine:{...next.mine,settlement:result.value,bestReward:result.value.newBestReward}};
}
/** Early exit spends the entry ticket; only completed runs grant a settlement. */
export function exitMine(session:Session):Session {
  if(session.mode!=="mine"&&session.mode!=="mine-result")return session;
  return {...session,mode:"field",overlay:"none",battle:restoreField(session),fieldBattle:null,
    mine:{...session.mine,run:null,settlement:null},challengeSeconds:60,notice:"",events:[]};
}

/** Source CheckOverlap/FuseItems semantics plus explicit H5 equipment ownership.
 * All rejection paths preserve resources; catalogue ids are not entity ids. */
export function applyGunDrop(session:Session,request:GunDropRequest):{session:Session;accepted:boolean;notice:string;fused:boolean} {
  const reject=(notice:string)=>({session,accepted:false,notice,fused:false});
  if(session.mode!=="field"||session.overlay!=="gun"||!session.gunUnlocked)return reject("当前无法移动武器");
  const {from,to}=request;
  const legal=(kind:string,index:number)=>Number.isInteger(index)&&index>=0&&index<(kind==="inventory"?session.gunInventory.length:session.equippedGuns.length);
  if(!["inventory","equipment"].includes(from.kind)||!["inventory","equipment"].includes(to.kind)||!legal(from.kind,from.index)||!Number.isInteger(to.index)||to.index<0||to.index>=(to.kind==="inventory"?GUN_INVENTORY_CAPACITY:3))return reject("无效武器位置");
  const current=(kind:string,index:number)=>kind==="inventory"?session.gunInventory[index]:session.equippedGuns[index];
  const a=current(from.kind,from.index),b=current(to.kind,to.index);
  if(!a||gunEntityUID(a)!==from.uid||sourceGunID(a)!==from.sourceID)return reject("武器位置已变化，请重新拖动");
  if((to.uid!==undefined&&(!b||gunEntityUID(b)!==to.uid))||(to.sourceID!==undefined&&(!b||sourceGunID(b)!==to.sourceID)))return reject("目标武器已变化");
  if(a.adReward||b?.adReward)return reject("临时广告武器需先领取，不能装备、交换或合成");
  const hover=classifyGunHover({...from,paused:a.paused},{...to,paused:b?.paused,adReward:b?.adReward,uid:b?gunEntityUID(b):undefined,sourceID:b?sourceGunID(b):undefined});
  if(hover.type==="reject")return reject(hover.reason??"无法移动武器");
  if(hover.type!==request.intent)return reject("拖放目标已变化");
  if(request.intent==="fuse"){
    if(a.paused||b?.paused||a.adReward||b?.adReward)return reject("受保护或广告临时武器不可合成");
    const next=fuseInventory(session,from.index,to.index);
    if(next.gunInventory.length===session.gunInventory.length)return reject(next.notice||"无法合成");
    return {session:next,accepted:true,notice:"合成成功",fused:true};
  }
  const inventory=[...session.gunInventory],equipment=[...session.equippedGuns];
  if(from.kind==="inventory"&&to.kind==="inventory"){
    if(b){inventory[from.index]=b;inventory[to.index]=a;}
    else {inventory.splice(from.index,1);inventory.splice(Math.min(to.index,inventory.length),0,a);}
  }else if(from.kind==="inventory"&&to.kind==="equipment"){
    equipment[to.index]=a;if(b)inventory[from.index]=b;else inventory.splice(from.index,1);
  }else if(from.kind==="equipment"&&to.kind==="inventory"){
    if(!b&&inventory.length>=GUN_INVENTORY_CAPACITY)return reject("库存已满");
    if(!b&&equipment.filter(Boolean).length<=1)return reject("至少需要装备1件武器");
    equipment[from.index]=b??null;if(b)inventory[to.index]=a;else inventory.splice(Math.min(to.index,inventory.length),0,a);
  }else {equipment[from.index]=b??null;equipment[to.index]=a;}
  if(!equipment.some(Boolean))return reject("至少需要装备1件武器");
  if(!equipment[0]){const i=equipment.findIndex(Boolean);equipment[0]=equipment[i];equipment[i]=null;}
  return {session:{...session,gunInventory:inventory,equippedGuns:equipment,notice:"",events:[]},accepted:true,notice:"",fused:false};
}

/** Upgrade stays on the slot when guns are equipped, swapped, removed or fused. */
export function upgradeSessionStar(session:Session,slot:number):{session:Session;result:SourceStarUpgrade} {
 let rngState=session.rngState;
 const result=sourceStarUpgrade({levels:session.bossSlotLevels??[0,0,0],failCounts:session.starFailCounts??[0,0,0],starGem:session.starGem??0},slot,session.historicMax,()=>{rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return Math.floor(rngState/0x100000000*100);});
 const reasons={'invalid-slot':'无效枪槽','stage-required':'星级强化在普通第40大关开放','max-level':'该枪槽已达20星','insufficient-star-gem':'星之宝石不足'};
 const notice=result.status==='blocked'?reasons[result.reason!]:result.succeeded?`枪槽${slot+1}强化成功：${result.value.levels[slot]}星`:`强化失败：星级不下降，已消耗${result.quote.cost}星之宝石`;
 return {result,session:{...session,...(result.status==='supported'?{rngState,bossSlotLevels:result.value.levels,starFailCounts:result.value.failCounts,starGem:result.value.starGem}:{}),notice}};
}
