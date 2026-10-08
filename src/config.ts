export type EvidenceTier = "native-confirmed" | "metadata-only" | "candidate";

export interface RuleConfig {
  provenance: "candidate-prototype";
  arena: { width: number; height: number };
  player: { speed: number; radius: number; attackRange: number; baseDamage: number; shotsPerSecond: number; projectileSpeed: number };
  level: { seconds: number; targetCount: number; targetHealth: number; targetCoin: number; targetRadius: number };
  upgrades: { maxLevel: number; priceBase: number; priceGrowthBefore5000: number; priceGrowthAfter5000: number; powerGrowth: number; moneyGrowth: number; speedBase: number; speedPerLevel: number };
  stage: { levelsPerStage: number };
}

// Only price/table structure and factors have native evidence. Spatial, combat,
// reward, and timing values below are explicit prototype inputs.
export const candidateConfig: RuleConfig = {
  provenance: "candidate-prototype",
  arena: { width: 9, height: 16 },
  player: { speed: 4, radius: 0.3, attackRange: 18, baseDamage: 100, shotsPerSecond: 1.67, projectileSpeed: 15 },
  level: { seconds: 1_000_000, targetCount: 5, targetHealth: 800, targetCoin: 35, targetRadius: 0.65 },
  upgrades: { maxLevel: 10000, priceBase: 50, priceGrowthBefore5000: 1.38, priceGrowthAfter5000: 2, powerGrowth: 1.08, moneyGrowth: 1.08, speedBase: 100, speedPerLevel: 8 },
  stage: { levelsPerStage: 5 }
};

export function validateConfig(c: RuleConfig): void {
  const values = [c.arena.width, c.arena.height, ...Object.values(c.player), ...Object.values(c.level), ...Object.values(c.upgrades), c.stage.levelsPerStage];
  if (c.provenance !== "candidate-prototype" || values.some(v => !Number.isFinite(v) || v <= 0)) throw new Error("invalid candidate config");
  if (!Number.isInteger(c.level.targetCount) || !Number.isInteger(c.stage.levelsPerStage) || !Number.isInteger(c.upgrades.maxLevel)) throw new Error("integer count required");
}
