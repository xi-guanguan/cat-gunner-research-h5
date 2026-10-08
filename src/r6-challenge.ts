/** SpeedRun_manager contract, ARM64 source audit in artifacts/evidence/round6-20261002/challenge-source-contract.md.
 * One-based H5 stage wraps the native zero-based Stage_Now. No online or native parity claim. */
import {BigValue,type BigValueInput} from './big-value';
import {challengeQuote,CHALLENGE_REWARD_DIAMONDS,MAX_CHALLENGE_STAGE} from './challenge-source';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export interface SourceChallengeSettlement {
 runID:string;completedStage:number;kind:'fight'|'sweep';initialReward:number;totalReward:number;
 automaticBonus:boolean;bonusClaimed:boolean;
}
export interface SourceChallengeAdRequest extends SourceRewardRequest {runID:string}
export function sourceChallengeSettlement(runID:string,completedStage:number,kind:'fight'|'sweep',automaticBonus:boolean):SourceChallengeSettlement {
 const value={runID,completedStage,kind,automaticBonus,bonusClaimed:automaticBonus,initialReward:CHALLENGE_REWARD_DIAMONDS*(automaticBonus?4:1),totalReward:CHALLENGE_REWARD_DIAMONDS*(automaticBonus?4:1)};
 validateSourceChallengeSettlement(value);return value;
}
export function validateSourceChallengeSettlement(s:SourceChallengeSettlement|null|undefined):asserts s is SourceChallengeSettlement {
 if(!s||typeof s.runID!=='string'||!s.runID.trim()||s.runID.length>240||!s.runID.startsWith('challenge:')||!Number.isSafeInteger(s.completedStage)||s.completedStage<1||s.completedStage>MAX_CHALLENGE_STAGE
  ||!['fight','sweep'].includes(s.kind)||typeof s.automaticBonus!=='boolean'||typeof s.bonusClaimed!=='boolean'
  ||s.initialReward!==CHALLENGE_REWARD_DIAMONDS*(s.automaticBonus?4:1)
  ||s.totalReward!==(s.bonusClaimed?CHALLENGE_REWARD_DIAMONDS*4:s.initialReward)||s.automaticBonus&&!s.bonusClaimed)throw Error('Invalid challenge settlement');
}
export function sourceChallengeBonusReward(settlement:SourceChallengeSettlement|null,pending:SourceChallengeAdRequest|null,response:SourceRewardResponse,claims:readonly string[]):{status:'granted'|'duplicate'|'blocked';settlement:SourceChallengeSettlement|null;claims:string[];diamondGrant:number} {
 const reject=(status:'blocked'|'duplicate')=>({status,settlement,claims:[...claims],diamondGrant:0});
 if(!pending||typeof pending.id!=='string'||!pending.id.trim()||pending.id.length>240||!sourceRewardMatches(pending,response)||pending.kind!=='ad'||pending.purpose!=='challenge:bonus'||response.status!=='success')return reject('blocked');
 if(claims.includes(pending.id))return reject('duplicate');
 if(!settlement||pending.runID!==settlement.runID||settlement.bonusClaimed||settlement.automaticBonus)return reject('blocked');
 validateSourceChallengeSettlement(settlement);
 return {status:'granted',settlement:{...settlement,bonusClaimed:true,totalReward:CHALLENGE_REWARD_DIAMONDS*4},claims:[...claims,pending.id],diamondGrant:CHALLENGE_REWARD_DIAMONDS*3};
}
/** SweepRequiredPower_return: H5(GetStageHealth(i) * count *193 /100 /24).
 * Keep native multiply/divide order. Tier0 is precisely GetStageHealth, not an average tree. */
export function sourceChallengeSweepRequiredPower(stage:number):BigValue {
 const quote=challengeQuote(stage);if(quote.status!=='supported')throw RangeError(quote.reason);
 return quote.value.healthByTier[0].nativeMultiply(quote.value.targetCount).nativeMultiply(193).nativeDivide(100).nativeDivide(24).significant(5);
}
export function sourceChallengeSweepAble(stage:number,power:BigValueInput):boolean {return BigValue.from(power).gt(sourceChallengeSweepRequiredPower(stage));}
export function sourceChallengeSweepEfficiency(stage:number,power:BigValueInput):number {
 const ratio=BigValue.from(power).nativeMultiply(100).nativeDivide(sourceChallengeSweepRequiredPower(stage));
 if(ratio.gte(100))return 100;if(ratio.lt(0))return 0;return Math.floor(Math.fround(ratio.toNumber()));
}
export interface SourceChallengePowerCat {active:boolean;cooldownSeconds:number;normalDamage:BigValueInput;criticalDamage:BigValueInput;criticalProbability:number;type:number;pelletCount:number}
export function sourceChallengeTypeMultiplier(type:number,pellets:number):number {
 return type===1?7:[2,4,5].includes(type)?5:type===3?Math.max(pellets,1):type===6?10:1;
}
function roundEven(x:number):number {const f=Math.floor(x),part=x-f;return part===.5?(f%2===0?f:f+1):Math.round(x);}
/** Power_SpeedRun_return reads live Cat.Damage/CriDmg/CriPer; it is NOT Boss expected power.
 * Unity float32 chance*100 -> RoundToEven -> clamp; float32 multiplier/cooldown*100 -> trunc. */
export function sourceChallengePowerFromCats(cats:readonly SourceChallengePowerCat[]):BigValue {
 let power=BigValue.ZERO;
 for(const c of cats){
  if(!c.active)continue;const cd=Math.fround(c.cooldownSeconds);if(!Number.isFinite(cd)||!Number.isFinite(c.criticalProbability)||!Number.isInteger(c.type)||!Number.isInteger(c.pelletCount))throw RangeError('Invalid challenge power Cat');
  if(cd<=Math.fround(.001))continue;
  const divisor=Math.trunc(Math.fround(cd*100));if(divisor<1||divisor>2147483647)throw RangeError('Invalid challenge power cooldown');
  const p=Math.max(0,Math.min(100,roundEven(Math.fround(Math.fround(c.criticalProbability)*100))));
  const expected=BigValue.from(c.normalDamage).nativeMultiply(100-p).nativeAdd(BigValue.from(c.criticalDamage).nativeMultiply(p)).nativeDivide(100);
  power=power.nativeAdd(expected.nativeMultiply(Math.trunc(Math.fround(sourceChallengeTypeMultiplier(c.type,c.pelletCount)*100))).nativeDivide(divisor));
 }
 return power.significant(5);
}
/** Banner_Reload: PlusPack.Is_Banner_Stage_OK is independent of reward and sweep entitlements. */
export function sourceChallengePlusBannerVisible(historicMax:number,plus2:boolean):boolean {return historicMax>=190&&!plus2;}

/** RemoveAds_Purchase_BannerReward.Reload@0x2ba63ec + FreeCash_manager.Banner_ShouldShow@0x2aa23e0.
 * The two serialized banners occupy the same rectangle and are mutually exclusive.
 * Source remote feature/exposure flags are runtime inputs, never purchase receipts.
 * Unconnected provider supplies false by default; QA may visibly project the other branch. */
export function sourceChallengeRewardBanner(purchasedAllAds:boolean,freeCash:{featureEnabled:boolean;exposureTarget:boolean}={featureEnabled:false,exposureTarget:false}):{purchase:boolean;freeCash:boolean} {
 const service=freeCash.featureEnabled&&freeCash.exposureTarget;
 return {purchase:!purchasedAllAds&&!service,freeCash:!purchasedAllAds&&service};
}

/** Reward-banner purchases are legal on all three source result pages, not during live combat. */
export function sourceChallengeResultRun(mode:string,overlay:string,runID:string|null|undefined):string|null {
 return runID && (mode==='victory'||mode==='defeat'||mode==='field'&&overlay==='challenge-sweep')?runID:null;
}
