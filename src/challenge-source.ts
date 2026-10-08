import { BigValue } from "./big-value";
import ordinarySource from "./data/ordinary-values.json";
import type { OrdinaryDecimal, OrdinaryValues } from "./ordinary-data";

export const CHALLENGE_SECONDS = 60;
export const CHALLENGE_REWARD_DIAMONDS = 30;
/** H5 decimal-exponent bound, not an original content limit. */
export const MAX_CHALLENGE_STAGE = 1_000_000;
export const challengeEvidence = "artifacts/evidence/round3-20261001/challenge-RECEIPT.md";
export interface ChallengeQuote {
  stage: number;
  sourceIndex: number;
  targetCount: number;
  seconds: number;
  rewardDiamonds: number;
  healthByTier: readonly BigValue[];
  coinByTier: readonly BigValue[];
  valueOrigin: "serialized-table" | "native-extrapolation";
}
export type ChallengeQuoteResult =
  | { status: "supported"; value: ChallengeQuote; evidence: string }
  | { status: "unsupported"; reason: string; evidence: string };
const data = ordinarySource as OrdinaryValues;
const decimal = (value: OrdinaryDecimal) => new BigValue(BigInt(value.digits), value.exponent);
// Tree_manager..cctor: integer constructor H5 for 1/3; double constructor H17
// for 1.8. The simplified factor decimals in ordinary-values omit this precision.
const healthDegreeFactors = [BigValue.fromInteger(1), BigValue.fromNumber(1.8), BigValue.fromInteger(3), BigValue.fromInteger(35)] as const;
const moneyDegreeFactors = [...healthDegreeFactors.slice(0, 3), BigValue.fromInteger(100)] as const;
/** Ordinary Tree_Batch and challenge Map_Batch consume the same native arrays. */
export function sourceDegreeFactors(tier: number): { health: BigValue; money: BigValue } {
  if (!Number.isInteger(tier) || tier < 0 || tier >= healthDegreeFactors.length)
    throw new RangeError("Source degree tier out of range");
  return { health: healthDegreeFactors[tier], money: moneyDegreeFactors[tier] };
}

/** Tree_manager.PowOfThree 0x2bace94: square-and-multiply, H2 after every product. */
function sourcePowerOfThree(exponent: number): BigValue {
  let result = BigValue.fromInteger(1), factor = BigValue.fromInteger(3), remaining = exponent;
  while (remaining > 0) {
    if (remaining % 2 === 1) result = result.nativeMultiply(factor).significant(2);
    factor = factor.nativeMultiply(factor).significant(2);
    remaining = Math.floor(remaining / 2);
  }
  return result;
}
function stageBase(table: OrdinaryDecimal[], index: number): BigValue {
  if (index < table.length) return decimal(table[index]);
  const last = table.length - 1;
  return decimal(table[last]).nativeMultiply(sourcePowerOfThree(index - last)).significant(2);
}

/** Input is the displayed, one-based challenge stage; Unity stores stage - 1. */
export function challengeQuote(stage: number): ChallengeQuoteResult {
  if (!Number.isSafeInteger(stage) || stage < 1 || stage > MAX_CHALLENGE_STAGE) {
    return { status: "unsupported", reason: "挑战阶段超出已验证的数值范围，已保留进度和货币，可返回普通关卡。", evidence: challengeEvidence };
  }
  const sourceIndex = stage - 1;
  const health = stageBase(data.stage_health, sourceIndex), coin = stageBase(data.stage_money, sourceIndex);
  return { status: "supported", evidence: challengeEvidence, value: {
    stage, sourceIndex, targetCount: Math.max(20, Math.min(190, 15 * sourceIndex + 20)),
    seconds: CHALLENGE_SECONDS, rewardDiamonds: CHALLENGE_REWARD_DIAMONDS,
    healthByTier: healthDegreeFactors.slice(0, 3).map(factor => health.nativeMultiply(factor)),
    coinByTier: moneyDegreeFactors.slice(0, 3).map(factor => coin.nativeMultiply(factor)),
    valueOrigin: sourceIndex < Math.min(data.stage_health.length, data.stage_money.length) ? "serialized-table" : "native-extrapolation"
  } };
}
