import { BigValue, type BigValueInput } from './big-value';

/** Bounded static-source contracts. These helpers do not imply original runtime verification. */
export type MetaResult<T> = { status: "supported"; value: T; evidence: string }
  | { status: "blocked"; reason: string; evidence: string }
  | { status: "unsupported"; reason: string; evidence: string };
export const metaEvidence = {
  unlock: "UNLOCK-AND-BALANCE-RECEIPT.md#static-content-gates",
  rebirth: "artifacts/evidence/meta-20260930/META-RECEIPT.md#rebirth",
  mine: "artifacts/evidence/meta-20260930/META-RECEIPT.md#mine",
  fusion: "artifacts/evidence/meta-20260930/META-RECEIPT.md#fusion",
  equipment: "user-requested minimum-one-equipped policy; native restriction UNVERIFIED"
} as const;
const unsupported = (reason: string, evidence: string): MetaResult<never> => ({status:"unsupported",reason,evidence});
function nonnegative(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be nonnegative safe integer`);
}
export const contentThresholds = { rebirth:3, mine:4, fish:6, boss:10, pet:12, monster:12, adventure:35, raid:40 } as const;
export function contentGate(historicMax: number | null, content: keyof typeof contentThresholds) {
  if (historicMax !== null) nonnegative(historicMax,"historicMax");
  const displayStage = historicMax === null ? 0 : Math.floor(historicMax / 10) + 1;
  return { unlocked: displayStage >= contentThresholds[content], displayStage, required: contentThresholds[content], evidence: metaEvidence.unlock };
}
export function rebirthPopupGate(historicMax: number, currentStage: number): MetaResult<true> {
  nonnegative(currentStage,"currentStage");
  if (!contentGate(historicMax,"rebirth").unlocked || currentStage <= 1)
    return {status:"blocked",reason:"Historic displayed Stage 3 and current internal Stage > 1 are required",evidence:metaEvidence.rebirth};
  return {status:"supported",value:true,evidence:metaEvidence.rebirth};
}
/** Legacy stage patch. completeRebirth also applies the recovered currency and ordinary-level reset. */
export function knownRebirthResetPatch(current: {stage:number; level:number; historicMax:number; rebirthCount:number}) {
  for (const [k,v] of Object.entries(current)) nonnegative(v,k);
  if (!Number.isSafeInteger(current.rebirthCount + 1)) throw new RangeError("rebirth count overflow");
  return { patch: { stage:0, level:0, historicMax:current.historicMax, rebirthCount:current.rebirthCount+1 },
    confirmedResetFields:["stage","level"], confirmedRetainedFields:["historicMax"],
    confirmedResetOutsidePatch:["coins","coinsAccum","ordinaryUpgradeLevels"], confirmedRetainedOutsidePatch:["permanentUpgradeLevels","weapons"], unknownFields:[], evidence:metaEvidence.rebirth };
}
const supported = <T>(value:T,evidence:string): MetaResult<T> => ({status:"supported",value,evidence});
const blocked = (reason:string,evidence:string): MetaResult<never> => ({status:"blocked",reason,evidence});
const nativeInt = (value:number) => BigValue.fromInteger(value);
function checkedCurrency(value:BigValueInput,name:string):BigValue {
  const result=BigValue.from(value);
  if(result.sign<0) throw new RangeError(`${name} must be nonnegative`);
  return result;
}
/** IL2CPP Pow at 0x455ef6c: integer exponent, squaring with native truncation, then H(input.precision). */
function nativePower(base:BigValue,exponent:number):BigValue {
  nonnegative(exponent,"exponent");
  if(exponent===0) return BigValue.ONE.significant(base.precision);
  if(base.isZero || base.eq(1)) return base;
  let result=BigValue.ONE, factor=base, remaining=exponent;
  while(remaining>0) {
    if(remaining%2===1) result=result.nativeMultiply(factor);
    factor=factor.nativeMultiply(factor);
    remaining=Math.floor(remaining/2);
  }
  return result.significant(base.precision);
}
export interface RebirthRewardInput { stage:number; level:number; relicRebirthPercent?:number }
/** Raw internal stage/level, NOT displayed stage. Relic_Value type 11 augments the default 100 percent. */
export function rebirthReward(input:RebirthRewardInput):MetaResult<BigValue> {
  nonnegative(input.stage,"stage");nonnegative(input.level,"level");
  const relic=input.relicRebirthPercent ?? 100; nonnegative(relic,"relic rebirth percent");
  if(input.stage<=1) return supported(nativeInt(0),metaEvidence.rebirth);
  const n=5*input.stage+input.level;nonnegative(n,"rebirth input");
  const square=nativePower(new BigValue(BigInt(n)),2);
  const reward=square.nativeMultiply(BigValue.fromNumber(Math.sqrt(n)))
    .nativeMultiply(nativeInt(relic)).nativeDivide(nativeInt(100)).significant(5);
  return supported(reward,metaEvidence.rebirth);
}
export interface EnhancedRebirthState {
  storedDate:string; adUses:number; iapUses:number; isEnhanced:boolean; fromIap:boolean;
}
/** Caller supplies Today_str_return's date. Native day check resets both counts on a changed date. */
export function reloadEnhancedRebirth(state:EnhancedRebirthState,today:string):EnhancedRebirthState {
  nonnegative(state.adUses,"enhanced ad uses");nonnegative(state.iapUses,"enhanced iap uses");
  return state.storedDate===today ? {...state} : {...state,storedDate:today,adUses:0,iapUses:0};
}
/** Grant callback only: the adapter must confirm the earned ad/IAP grant before calling this transition. */
export function prepareEnhancedRebirth(state:EnhancedRebirthState,source:"ad"|"iap",today:string,
  grantConfirmed:boolean,iapUnlocked:boolean|null=null):MetaResult<EnhancedRebirthState> {
  if(!grantConfirmed) return blocked("Enhanced rebirth grant has not completed",metaEvidence.rebirth);
  const refreshed=reloadEnhancedRebirth(state,today);
  if(source==="iap") {
    if(iapUnlocked===null) return unsupported("IAP unlock predicate must be supplied by the provider adapter",metaEvidence.rebirth);
    if(!iapUnlocked || refreshed.iapUses>=1) return blocked("Enhanced IAP rebirth unavailable",metaEvidence.rebirth);
    return supported({...refreshed,iapUses:refreshed.iapUses+1,isEnhanced:true,fromIap:true},metaEvidence.rebirth);
  }
  if(refreshed.adUses>=1) return blocked("Enhanced ad rebirth daily use exhausted",metaEvidence.rebirth);
  return supported({...refreshed,isEnhanced:true,fromIap:false},metaEvidence.rebirth);
}
export interface RebirthState {
  stage:number;level:number;historicMax:number;rebirthCount:number;
  coins:BigValueInput;coinsAccum?:BigValueInput;ruby:BigValueInput;
  ordinaryUpgradeLevels:readonly number[];
  permanentUpgradeLevels:readonly number[];weapons:readonly number[];
  enhancement?:EnhancedRebirthState;
}
/** Pure payout/reset after confirmation/FX completion; the returned state preserves every unrelated field. */
export function completeRebirth<S extends RebirthState>(state:S,
  options:{relicRebirthPercent?:number;today?:string}={}):MetaResult<{
    state:Omit<S,"coins"|"coinsAccum"|"ruby"|"ordinaryUpgradeLevels"|"enhancement"> & {
      coins:BigValue;coinsAccum:BigValue;ruby:BigValue;ordinaryUpgradeLevels:number[];enhancement?:EnhancedRebirthState
    }; reward:BigValue;missionEvent:{type:2;amount:1}
  }> {
  const gate=rebirthPopupGate(state.historicMax,state.stage);if(gate.status!=="supported")return gate;
  nonnegative(state.rebirthCount,"rebirth count");nonnegative(state.rebirthCount+1,"next rebirth count");
  state.ordinaryUpgradeLevels.forEach(v=>nonnegative(v,"ordinary upgrade level"));
  const quoted=rebirthReward({stage:state.stage,level:state.level,relicRebirthPercent:options.relicRebirthPercent});
  if(quoted.status!=="supported")return quoted;
  let reward=quoted.value, enhancement=state.enhancement ? {...state.enhancement} : undefined;
  if(enhancement?.isEnhanced) {
    reward=reward.nativeMultiply(nativeInt(3));
    if(!enhancement.fromIap) {
      if(options.today===undefined) return unsupported("Enhanced ad completion needs the native Today_str_return date",metaEvidence.rebirth);
      nonnegative(enhancement.adUses+1,"next enhanced ad use");
      enhancement.adUses++;enhancement.storedDate=options.today;
    }
  }
  if(enhancement) { enhancement.isEnhanced=false;enhancement.fromIap=false; }
  return supported({state:{...state,stage:0,level:0,rebirthCount:state.rebirthCount+1,
    coins:nativeInt(0),coinsAccum:nativeInt(0),ruby:checkedCurrency(state.ruby,"ruby").nativeAdd(reward),
    ordinaryUpgradeLevels:state.ordinaryUpgradeLevels.map(()=>0),enhancement},reward,
    missionEvent:{type:2,amount:1}},metaEvidence.rebirth);
}

export type PermanentUpgradeKind = "damage"|"speed"|"money";
export const PERMANENT_UPGRADE_MAX_LEVEL=20000;
const permanentPrices:BigValue[]=[];
let latePriceFactor=nativeInt(1);
/** Native table generated lazily without skipping the stateful late-price factor updates. */
function permanentPrice(level:number):BigValue {
  for(let i=permanentPrices.length;i<=level;i++) {
    let price=BigValue.fromNumber(3*Math.pow(i+1,1.6));
    if(i>=15001) {
      latePriceFactor=latePriceFactor.nativeMultiply(BigValue.fromNumber(1.002)).significant(4);
      price=price.nativeMultiply(latePriceFactor);
    }
    permanentPrices.push(price.truncateInteger().significant(3));
  }
  return permanentPrices[level]!;
}
function permanentBonus(kind:PermanentUpgradeKind,level:number):BigValue {
  if(kind==="speed")return nativeInt(5*level);
  return nativePower(BigValue.fromNumber(1.05),level).nativeMultiply(nativeInt(100))
    .nativeSubtract(nativeInt(100)).truncateInteger().significant(3);
}
export interface PermanentUpgradeQuote {
  kind:PermanentUpgradeKind;level:number;maxLevel:number;price:BigValue;
  currentBonusPercent:BigValue;nextBonusPercent:BigValue;
  currentPercent:BigValue;nextPercent:BigValue;atMaximum:boolean;canPurchase:boolean|null;
}
/** Effects are percent values; divide by 100 in the balance consumer. Price index equals CURRENT level. */
export function permanentUpgradeQuote(kind:PermanentUpgradeKind,level:number,ruby?:BigValueInput):MetaResult<PermanentUpgradeQuote> {
  if(!["damage","speed","money"].includes(kind))throw new RangeError("Unknown permanent upgrade kind");
  nonnegative(level,"permanent level");
  if(level>PERMANENT_UPGRADE_MAX_LEVEL)return blocked("Permanent level exceeds native maximum",metaEvidence.rebirth);
  const next=Math.min(level+1,PERMANENT_UPGRADE_MAX_LEVEL),price=permanentPrice(level);
  const currentBonusPercent=permanentBonus(kind,level),nextBonusPercent=permanentBonus(kind,next);
  return supported({kind,level,maxLevel:PERMANENT_UPGRADE_MAX_LEVEL,price,currentBonusPercent,nextBonusPercent,
    currentPercent:currentBonusPercent.nativeAdd(nativeInt(100)),nextPercent:nextBonusPercent.nativeAdd(nativeInt(100)),
    atMaximum:level===PERMANENT_UPGRADE_MAX_LEVEL,
    canPurchase:ruby===undefined ? null : level<PERMANENT_UPGRADE_MAX_LEVEL && checkedCurrency(ruby,"ruby").gte(price)},metaEvidence.rebirth);
}
export interface PermanentUpgradeState {ruby:BigValueInput;levels:Readonly<Record<PermanentUpgradeKind,number>>}
export function purchasePermanentUpgrade<S extends PermanentUpgradeState>(state:S,kind:PermanentUpgradeKind):MetaResult<{
  state:Omit<S,"ruby"|"levels"> & {ruby:BigValue;levels:Record<PermanentUpgradeKind,number>};quote:PermanentUpgradeQuote
}> {
  const quoted=permanentUpgradeQuote(kind,state.levels[kind],state.ruby);if(quoted.status!=="supported")return quoted;
  if(quoted.value.atMaximum)return blocked("Permanent upgrade already at maximum",metaEvidence.rebirth);
  if(!quoted.value.canPurchase)return blocked("Insufficient ruby",metaEvidence.rebirth);
  return supported({state:{...state,ruby:checkedCurrency(state.ruby,"ruby").nativeSubtract(quoted.value.price),
    levels:{...state.levels,[kind]:state.levels[kind]+1}},quote:quoted.value},metaEvidence.rebirth);
}
export interface MineTicketState { used:number; storedDate:string }
/** Caller supplies the original time service predicate; never assumes a local-midnight reset. */
export function reloadMineTickets(state:MineTicketState,today:string,canRolloverDaily:boolean|null): MetaResult<MineTicketState> {
  nonnegative(state.used,"ticket use count");
  if (state.storedDate === today) return {status:"supported",value:{...state},evidence:metaEvidence.mine};
  if (canRolloverDaily === null) return unsupported("Original CanRolloverDaily(3) predicate must be resolved",metaEvidence.mine);
  return {status:"supported",value:canRolloverDaily ? {used:0,storedDate:today} : {...state},evidence:metaEvidence.mine};
}
/** globalByte is the literal native +0xd byte; its business meaning is unknown. */
export function mineTicketMaximum(globalByte:number|null): MetaResult<number> {
  if (globalByte === null) return unsupported("Global +0xd byte value/meaning is unresolved",metaEvidence.mine);
  if (!Number.isInteger(globalByte) || globalByte < 0 || globalByte > 255) throw new RangeError("byte outside 0..255");
  return {status:"supported",value:globalByte === 0 ? 2 : 6,evidence:metaEvidence.mine};
}
export function consumeMineTicket(state:MineTicketState,globalByte:number|null): MetaResult<MineTicketState> {
  nonnegative(state.used,"ticket use count");
  const maximum=mineTicketMaximum(globalByte); if(maximum.status!=="supported") return maximum;
  if(state.used>=maximum.value) return {status:"blocked",reason:"Mine tickets exhausted",evidence:metaEvidence.mine};
  return {status:"supported",value:{...state,used:state.used+1},evidence:metaEvidence.mine};
}
/** Constructor default. A serialized scene/prefab override must be supplied by the asset adapter. */
export function mineGameDuration(plusPack0Active=false,baseSeconds=60):number {
  if(!Number.isFinite(baseSeconds)||baseSeconds<=0)throw new RangeError("Invalid mine base duration");
  return plusPack0Active ? Math.fround(Math.fround(baseSeconds)*Math.fround(1.3)) : Math.fround(baseSeconds);
}
/** DiaValue HUD unit is one diamond per ten score, independent of settlement truncation.
 * Integer tenths avoid binary artifacts (e.g. 0.30000000000000004). Source font/locale pending. */
export function mineHudValue(score:number):string {
  nonnegative(score,"mine score");
  if(!Number.isSafeInteger(score))throw new RangeError("mine score");
  return `${Math.trunc(score/10)}.${score%10}`;
}
export function mineOreScore(oreType:number):number {nonnegative(oreType,"ore type");return oreType===0?1:10;}
export interface MineSettlementInput {
  diaScore:number;bestReward:number;plusPack1Active?:boolean;automaticBonus?:boolean;adBonusClaimed?:boolean;
}
export interface MineSettlement {
  baseReward:number;rewardValue:number;initialReward:number;adExtraReward:number;totalReward:number;
  newBestReward:number;automaticBonus:boolean;bonusClaimed:boolean;clearedThisRun:true;
}
/** Best_Reward stores score/10 BEFORE PlusPack. Timeout also reaches native Game_End's cleared flag. */
export function mineSettlement(input:MineSettlementInput):MetaResult<MineSettlement> {
  nonnegative(input.diaScore,"mine score");nonnegative(input.bestReward,"best mine reward");
  const baseReward=Math.trunc(input.diaScore/10);
  const rewardValue=Math.trunc(Math.fround(Math.fround(baseReward)*(input.plusPack1Active?1.5:1)));
  const automaticBonus=input.automaticBonus??false;
  const initialReward=rewardValue*(automaticBonus?4:1);
  const adExtraReward=!automaticBonus && input.adBonusClaimed ? rewardValue*3 : 0;
  const totalReward=initialReward+adExtraReward;nonnegative(totalReward,"mine payout");
  return supported({baseReward,rewardValue,initialReward,adExtraReward,totalReward,
    newBestReward:Math.max(input.bestReward,baseReward),automaticBonus,
    bonusClaimed:automaticBonus||!!input.adBonusClaimed,clearedThisRun:true},metaEvidence.mine);
}
/** Ads pay the extra 3x once. Automatic 4x rewards cannot receive another 3x. */
export function claimMineAdBonus(state:MineSettlement,grantConfirmed:boolean):MetaResult<MineSettlement> {
  if(!grantConfirmed)return blocked("Mine ad grant has not completed",metaEvidence.mine);
  if(state.bonusClaimed)return blocked("Mine bonus already claimed",metaEvidence.mine);
  const adExtraReward=3*state.rewardValue,totalReward=state.initialReward+adExtraReward;
  nonnegative(totalReward,"mine payout");
  return supported({...state,adExtraReward,totalReward,bonusClaimed:true},metaEvidence.mine);
}
/** Sweep uses the stored unmultiplied best, then the same PlusPack and automatic-4x chain. */
export function mineSweepReward(bestReward:number,plusPack1Active=false,automaticBonus=false):MetaResult<number> {
  nonnegative(bestReward,"best mine reward");
  const base=Math.trunc(Math.fround(Math.fround(bestReward)*(plusPack1Active?1.5:1)));
  const reward=base*(automaticBonus?4:1);nonnegative(reward,"sweep payout");
  return supported(reward,metaEvidence.mine);
}
/** Next-group candidate range only, not proof that two arbitrary items are compatible. */
export function manualFusionRange(sourceGunID:number,gunCount:number): MetaResult<{minimum:number; maximumExclusive:number}> {
  nonnegative(sourceGunID,"gun ID");nonnegative(gunCount,"gun count");
  if(sourceGunID>=gunCount) return {status:"blocked",reason:"Invalid source gun",evidence:metaEvidence.fusion};
  const minimum=5*(Math.floor(sourceGunID/5)+1);
  if(minimum>=gunCount) return {status:"blocked",reason:"No next gun group",evidence:metaEvidence.fusion};
  return {status:"supported",value:{minimum,maximumExclusive:Math.min(minimum+5,gunCount)},evidence:metaEvidence.fusion};
}
export interface FusionItem {slot:number;gunID:number;active:boolean;isAdReward?:boolean;isAutoMerging?:boolean}
export interface ManualFusionInput {
  owned:readonly number[];paused:readonly boolean[];source:FusionItem;target:FusionItem;gunCount:number;
  /** Integer result in [minimum,maximumExclusive); supplied RNG preserves reproducible adapter tests. */
  randomInt:(minimum:number,maximumExclusive:number)=>number;
  fusionInProgress?:boolean;autoMergePins?:readonly number[];
}
export interface ManualFusionResult {
  owned:number[];paused:boolean[];sourceSlot:number;targetSlot:number;resultGunID:number;
  autoMergePins:number[];fusionInProgress:false;
}
/** Drag path requires the SAME group (gunID/5), not the same weapon ID; result replaces target slot. */
export function completeManualFusion(input:ManualFusionInput):MetaResult<ManualFusionResult> {
  const {source,target}=input;
  if(source.isAdReward||target.isAdReward)return blocked("Ad reward item routes to AdRewardGun_TryWatch without fusion",metaEvidence.fusion);
  if(input.fusionInProgress)return blocked("Fusion already in progress",metaEvidence.fusion);
  for(const item of [source,target]) {
    if(!item.active||!Number.isSafeInteger(item.slot)||item.slot<0||item.slot>=input.owned.length
      ||!Number.isSafeInteger(item.gunID)||item.gunID<0||item.gunID>=input.gunCount||input.owned[item.slot]!==item.gunID)
      return blocked("Inactive or stale fusion item",metaEvidence.fusion);
    if(input.paused[item.slot]||item.isAutoMerging)return blocked("Paused or auto merging item cannot be manually fused",metaEvidence.fusion);
  }
  if(source.slot===target.slot)return blocked("Fusion needs distinct owned slots",metaEvidence.fusion);
  if(Math.floor(source.gunID/5)!==Math.floor(target.gunID/5))return blocked("Different gun groups select swap instead of fusion",metaEvidence.fusion);
  const range=manualFusionRange(source.gunID,input.gunCount);if(range.status!=="supported")return range;
  const resultGunID=input.randomInt(range.value.minimum,range.value.maximumExclusive);
  if(!Number.isSafeInteger(resultGunID)||resultGunID<range.value.minimum||resultGunID>=range.value.maximumExclusive)
    throw new RangeError("Fusion RNG returned a value outside its exclusive range");
  const owned=[...input.owned],paused=[...input.paused];
  owned[source.slot]=-1;owned[target.slot]=resultGunID;paused[source.slot]=false;paused[target.slot]=false;
  const pins=[...(input.autoMergePins??[])];
  const autoMergePins=pins.includes(source.slot)||pins.includes(target.slot)?pins.map(()=>-1):pins;
  return supported({owned,paused,sourceSlot:source.slot,targetSlot:target.slot,resultGunID,autoMergePins,
    fusionInProgress:false},metaEvidence.fusion);
}
/** Explicit H5 policy requested by user; do not label as source-confirmed. */
export function equipmentRemovalPolicy(equipped:(number|null)[],slot:number): MetaResult<(number|null)[]> {
  nonnegative(slot,"equipment slot"); if(slot>=equipped.length) throw new RangeError("equipment slot out of range");
  if(equipped[slot]!==null && equipped.filter(v=>v!==null).length<=1)
    return {status:"blocked",reason:"Keep at least one equipped gun",evidence:metaEvidence.equipment};
  const value=[...equipped];value[slot]=null;return {status:"supported",value,evidence:metaEvidence.equipment};
}
