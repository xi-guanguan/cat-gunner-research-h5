/** Mine_manager.PlaceOres / Ore.Spawn static reconstruction.
 * Unity Random seed, System.Random sequence, Mathf.PerlinNoise, and equal-noise
 * List.Sort tie order are explicit adapters; H5 output is not a device replay.
 */
export interface MinePosition { x: number; y: number; z: number }
export interface MineGenerationConfig {
  outerRadius: number; innerRadius: number; center: MinePosition;
  noiseScale: number; noiseThreshold: number; poolCapacity: number;
}
export const SOURCE_MINE_CONFIG: Readonly<MineGenerationConfig> = Object.freeze({
  outerRadius: 150, innerRadius: 24.299999237060547,
  center: Object.freeze({ x: -100, y: 0, z: 0 }),
  noiseScale: 0.08500000089406967, noiseThreshold: 0.5170000195503235,
  poolCapacity: 1000,
});
export const SOURCE_MINE_RULES = Object.freeze({
  gridSpacing: 4, specialOreMaximum: 100, randomOffsetMultiplier: 9999,
  unitySeedMinimum: 0, unitySeedMaximumExclusive: 99999,
  normalOre: Object.freeze({ type: 0 as const, hp: 3, score: 1, money: 0 }),
  specialOre: Object.freeze({ type: 1 as const, hp: 5, score: 10, money: 0 }),
});
export interface MineRandomAdapter {
  /** System.Random.NextDouble equivalent input: [0, 1). */
  nextDouble(): number;
  /** System.Random.Next(min, max) equivalent input: [min, max). */
  nextInt(minimumInclusive: number, maximumExclusive: number): number;
  evidence: string;
}
export interface MineCandidate { position: MinePosition; noise: number; gridX: number; gridZ: number }
export interface MineAdapters {
  random: MineRandomAdapter;
  /** Original icall: UnityEngine.Mathf::PerlinNoise(System.Single,System.Single). */
  perlinNoise(x: number, z: number): number;
  noiseEvidence: string;
  /** Optional source-compatible List.Sort; must sort by noise descending.
   * The default uses JS stable sort. Equal-noise tie order is an H5 adapter. */
  sortCandidates?(candidates: MineCandidate[]): void;
}
export interface MineOre extends MineCandidate {
  poolIndex: number; type: 0 | 1; hp: number; score: number; money: 0;
}
export interface MineGeneration {
  ores: MineOre[]; inactivePoolIndices: number[]; acceptedCount: number;
  ringCandidateCount: number; specialCount: number; activeCount: number; sourceInitializedOreCount: number;
  offset: { x: number; z: number };
  adapterEvidence: { random: string; noise: string; ties: string };
}
const f32 = Math.fround;
export function generateSourceMine(
  adapters: MineAdapters, config: MineGenerationConfig = SOURCE_MINE_CONFIG,
): MineGeneration {
  if (!Number.isInteger(config.poolCapacity) || config.poolCapacity < 0)
    throw new RangeError('Mine poolCapacity must be a nonnegative integer');
  if (![config.outerRadius, config.innerRadius, config.center.x, config.center.y,
    config.center.z, config.noiseScale, config.noiseThreshold].every(Number.isFinite)
    || config.outerRadius < 0 || config.innerRadius < 0)
    throw new RangeError('Invalid mine geometry');
  const evidence = { random: adapters.random.evidence, noise: adapters.noiseEvidence,
    ties: adapters.sortCandidates ? 'caller supplied List.Sort adapter' : 'H5 JS stable sort adapter; equal-noise Unity order unverified' };
  // The source exits before seeding an empty pool.
  if (config.poolCapacity === 0) return { ores: [], inactivePoolIndices: [],
    acceptedCount: 0, ringCandidateCount: 0, specialCount: 0, activeCount: 0, sourceInitializedOreCount: 0,
    offset: { x: 0, z: 0 }, adapterEvidence: evidence };
  const drawOffset = () => {
    const value = adapters.random.nextDouble();
    if (!(value >= 0 && value < 1)) throw new RangeError('Random double outside [0, 1)');
    return f32(value * SOURCE_MINE_RULES.randomOffsetMultiplier);
  };
  const offset = { x: drawOffset(), z: drawOffset() };
  const outer = f32(config.outerRadius), inner = f32(config.innerRadius);
  const outerSquared = f32(outer * outer), innerSquared = f32(inner * inner);
  const bound = Math.ceil(f32(outer * 0.25));
  const cx = f32(config.center.x), cy = f32(config.center.y), cz = f32(config.center.z);
  const scale = f32(config.noiseScale), threshold = f32(config.noiseThreshold);
  const candidates: MineCandidate[] = [];
  let ringCandidateCount = 0;
  for (let gridX = -bound; gridX <= bound; gridX++) {
    for (let gridZ = -bound; gridZ <= bound; gridZ++) {
      const x = f32(cx + f32(gridX * 4)), z = f32(cz + f32(gridZ * 4));
      const dx = f32(x - cx), dz = f32(z - cz);
      const squared = f32(f32(dx * dx) + f32(dz * dz));
      if (squared < innerSquared || squared > outerSquared) continue;
      ringCandidateCount++;
      const noise = f32(adapters.perlinNoise(f32(f32(x + offset.x) * scale),
        f32(f32(z + offset.z) * scale)));
      if (!Number.isFinite(noise)) throw new RangeError('Mine noise adapter returned nonfinite value');
      if (noise < threshold) continue;
      candidates.push({ position: { x, y: cy, z }, noise, gridX, gridZ });
    }
  }
  if (adapters.sortCandidates) adapters.sortCandidates(candidates);
  else candidates.sort((a, b) => b.noise - a.noise);
  const activeCount = Math.min(config.poolCapacity, candidates.length);
  const specialCount = Math.min(activeCount, SOURCE_MINE_RULES.specialOreMaximum);
  const indices = Array.from({ length: activeCount }, (_, i) => i);
  const types = new Uint8Array(activeCount);
  // Exactly the first min(count,100) steps of Fisher-Yates, not a full shuffle.
  for (let i = 0; i < specialCount; i++) {
    const j = adapters.random.nextInt(i, activeCount);
    if (!Number.isInteger(j) || j < i || j >= activeCount)
      throw new RangeError('Random integer outside requested mine shuffle range');
    [indices[i], indices[j]] = [indices[j], indices[i]];
    types[indices[i]] = 1;
  }
  const ores = candidates.slice(0, activeCount).map((candidate, poolIndex): MineOre => {
    const ore = types[poolIndex] === 0 ? SOURCE_MINE_RULES.normalOre : SOURCE_MINE_RULES.specialOre;
    return { ...candidate, poolIndex, ...ore };
  });
  return { ores, inactivePoolIndices: Array.from({ length: config.poolCapacity - activeCount }, (_, i) => activeCount + i),
    acceptedCount: candidates.length, ringCandidateCount, specialCount, activeCount, sourceInitializedOreCount: config.poolCapacity, offset, adapterEvidence: evidence };
}
/** Portable deterministic H5 adapter. This is xorshift32, NOT System.Random. */
export function createH5MineRandom(seed: number): MineRandomAdapter {
  let state = (seed | 0) || 0x6d2b79f5;
  const nextDouble = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  return { nextDouble,
    nextInt: (minimum, maximum) => minimum + Math.floor(nextDouble() * (maximum - minimum)),
    evidence: 'H5 adapter: xorshift32; Unity seed source and System.Random sequence not reproduced' };
}

/** Source entitlement is Shop_manager.Is_Mine_Pack; new saves default false. */
export const SOURCE_MINE_PLAYER_RULES = Object.freeze({
  damagePerHit: 1, criticalPercent: 0, attackLength: 40, rayCount: 36,
  baseDurationSeconds: 60, plusTimeMultiplier: Math.fround(1.3),
  dailyRolloverCategory: 3, freshSaveIsMinePack: false,
});
export interface MineTicketState { used: number; storedDate: string }
export type MineUnsupported = { status: 'unsupported'; reason: string };
export function sourceMineTicketMaximum(isMinePack: boolean | null):
  { status: 'supported'; maximum: 2 | 6 } | MineUnsupported {
  if (isMinePack === null) return { status: 'unsupported', reason: 'Shop_manager.Is_Mine_Pack entitlement is unknown' };
  return { status: 'supported', maximum: isMinePack ? 6 : 2 };
}
export interface MineDailyRefresh {
  status: 'supported'; state: MineTicketState; recordDailyGain: boolean;
  rolloverCategory: 3;
}
/** Caller supplies Time_manager.get_Today and CanRolloverDaily(3).
 * recordDailyGain requires Time_manager.RecordGain before persisting the reset. */
export function refreshSourceMineTickets(
  state: MineTicketState, trustedToday: string | null, canRolloverDaily: boolean | null,
): MineDailyRefresh | MineUnsupported {
  if (!Number.isInteger(state.used) || state.used < 0)
    throw new RangeError('Mine used tickets must be a nonnegative integer');
  if (!trustedToday) return { status: 'unsupported', reason: 'Time_manager trusted today adapter is unavailable' };
  if (state.storedDate === trustedToday) return { status: 'supported', state: { ...state }, recordDailyGain: false, rolloverCategory: 3 };
  if (canRolloverDaily === null) return { status: 'unsupported', reason: 'Time_manager.CanRolloverDaily(3) adapter is unavailable' };
  return { status: 'supported',
    state: canRolloverDaily ? { used: 0, storedDate: trustedToday } : { ...state },
    recordDailyGain: canRolloverDaily, rolloverCategory: 3 };
}
export type MineEntryResult = MineUnsupported | {
  status: 'ready' | 'blocked'; state: MineTicketState; maximum: 2 | 6;
  remaining: number; recordDailyGain: boolean; showMinePackPurchase: boolean;
  consumed: boolean;
};
/** Successful source Game_Enter consumes one ticket before map loading. */
export function enterSourceMine(
  state: MineTicketState, isMinePack: boolean | null,
  trustedToday: string | null, canRolloverDaily: boolean | null,
): MineEntryResult {
  const refresh = refreshSourceMineTickets(state, trustedToday, canRolloverDaily);
  if (refresh.status === 'unsupported') return refresh;
  const entitlement = sourceMineTicketMaximum(isMinePack);
  if (entitlement.status === 'unsupported') return entitlement;
  const blocked = refresh.state.used >= entitlement.maximum;
  const next = { ...refresh.state, used: refresh.state.used + (blocked ? 0 : 1) };
  return { status: blocked ? 'blocked' : 'ready', state: next, maximum: entitlement.maximum,
    remaining: Math.max(0, entitlement.maximum - next.used), recordDailyGain: refresh.recordDailyGain,
    showMinePackPurchase: blocked && isMinePack === false, consumed: !blocked };
}
export interface MineAttackSpeedInputs {
  gunBaseInterval: number | null; ordinarySpeedPercent: number | null;
  permanentSpeedPercent: number | null; skinSpeedPercent: number | null;
  /** Pass 1 only when no BuffManager exists or verified GetMult(2) is 1. */
  speedBuffMultiplier: number | null;
}
/** Mine mode uses normal selected equipment and ordinary/permanent/skin speed;
 * field damage and stage attack speed penalty are absent in this branch. */
export function sourceMineAttackInterval(inputs: MineAttackSpeedInputs):
  { status: 'supported'; seconds: number; speedPercent: number } | MineUnsupported {
  const values = [inputs.gunBaseInterval, inputs.ordinarySpeedPercent,
    inputs.permanentSpeedPercent, inputs.skinSpeedPercent, inputs.speedBuffMultiplier];
  if (values.some(value => value === null))
    return { status: 'unsupported', reason: 'Selected gun, speed upgrades, skin, or Buff.GetMult(2) input is unknown' };
  if (!values.every(value => Number.isFinite(value)) || inputs.gunBaseInterval! <= 0 || inputs.speedBuffMultiplier! <= 0)
    throw new RangeError('Invalid mine attack speed input');
  const percent = Math.min(10000, Math.max(100,
    inputs.skinSpeedPercent! + inputs.permanentSpeedPercent! - 200 + inputs.ordinarySpeedPercent!));
  const interval = f32(f32(f32(f32(inputs.gunBaseInterval!) / f32(percent)) * 100) / f32(inputs.speedBuffMultiplier!));
  return { status: 'supported', seconds: Math.min(2, Math.max(f32(0.05), interval)), speedPercent: percent };
}
/** No Cat_Mine class or dedicated tool animation contract is in the source map. */
export function sourceMineToolFrames(): MineUnsupported {
  return { status: 'unsupported', reason: 'Dedicated miner tool frames and their timing are not recovered; mine uses Cat selected equipment' };
}
