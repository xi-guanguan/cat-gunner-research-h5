/** Source contract: artifacts/evidence/round5-20261001/late-adventure-raid-contract.json.
 * Pure numeric rules; callers apply currency and persistence effects from the source contract.
 */
import { BigValue } from './big-value'
export const RAID_GUN_SLOTS = 3
export const RAID_FREE_ENTRIES = 2
export const RAID_BASE_SECONDS = 60
export const RAID_WEAK_DAMAGE_MULTIPLIER = 10
export type RaidEntryType = 0 | 1 | 2 | 3
export interface RaidEntries { freeUseCount: number; adUsed: boolean; iapUsed: boolean }
export function raidEntryTypeNow(state: RaidEntries): RaidEntryType {
  if (state.freeUseCount < RAID_FREE_ENTRIES) return 1
  if (!state.adUsed) return 2
  if (!state.iapUsed) return 3
  return 0
}
export function raidStarGemPerLevel(level: number): number {
  if (!Number.isInteger(level)) throw new RangeError('level')
  if (level < 1) return 0
  return [25, 20, 10][Math.trunc((level - 1) / 10)] ?? 5
}
export function raidStarGemReward(score: number): number {
  if (!Number.isSafeInteger(score)) throw new RangeError('score')
  if (score < 1) return 0
  return Math.min(score, 10) * 25 + Math.min(Math.max(score - 10, 0), 10) * 20 + Math.min(Math.max(score - 20, 0), 10) * 10 + Math.max(score - 30, 0) * 5
}
export interface RaidSeason { seasonIndex: number; tryCount: number; bestLevel: number }
/** Week index is supplied by the recovered DailyGun/time adapter; origin date remains unresolved. */
export function raidCheckSeason(state: RaidSeason, currentSeason: number): RaidSeason {
  return state.seasonIndex === currentSeason ? { ...state } : { seasonIndex: currentSeason, tryCount: 0, bestLevel: 0 }
}
export function raidStartTimer(plusPackTimeBonus: number): number {
  if (!Number.isFinite(plusPackTimeBonus)) throw new RangeError('plusPackTimeBonus')
  return Math.fround(60 + Math.fround(plusPackTimeBonus))
}
export function raidTimerFrame(remaining: number, active: boolean, deltaSeconds: number): { remaining: number; end: boolean } {
  if (!Number.isFinite(remaining) || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('timer')
  const current = Math.fround(remaining)
  // Coroutine checks completion at the next resume, after the preceding subtraction/yield.
  if (current <= 0) return { remaining: current, end: true }
  if (!active) return { remaining: current, end: false }
  return { remaining: Math.fround(current - Math.fround(deltaSeconds)), end: false }
}

/** Boss_Health_return@0x2b56c34: H0=1e7; each cache step is H3(previous*3),
 * and each returned value is H2(cache). H2 never feeds the next cache step.
 * The finite three-digit coefficient cycle avoids allocating a cache by input size. */
const raidHealthRows: { coefficient: bigint; exponent: number }[] = []
let raidHealthCoefficient = 100n, raidHealthExponent = 5
const raidHealthSeen = new Map<bigint, number>()
while (!raidHealthSeen.has(raidHealthCoefficient)) {
  raidHealthSeen.set(raidHealthCoefficient, raidHealthRows.length)
  raidHealthRows.push({ coefficient: raidHealthCoefficient, exponent: raidHealthExponent })
  raidHealthCoefficient *= 3n
  while (raidHealthCoefficient >= 1000n) { raidHealthCoefficient /= 10n; raidHealthExponent++ }
}
const raidHealthCycleStart = raidHealthSeen.get(raidHealthCoefficient)!
const raidHealthCycleLength = raidHealthRows.length - raidHealthCycleStart
const raidHealthCycleExponent = raidHealthExponent - raidHealthRows[raidHealthCycleStart]!.exponent
export function raidBossHealth(index: number): BigValue {
  if (!Number.isInteger(index) || index < -2147483648 || index > 2147483647) throw new RangeError('native Raid HP index')
  index = Math.max(0, index)
  if (index < raidHealthCycleStart) {
    const row = raidHealthRows[index]!
    return new BigValue(row.coefficient, row.exponent).significant(2)
  }
  const offset = index - raidHealthCycleStart
  const cycles = Math.floor(offset / raidHealthCycleLength)
  const row = raidHealthRows[raidHealthCycleStart + offset % raidHealthCycleLength]!
  // BigValue's explicit exponent limit applies; never overflow into Infinity.
  return new BigValue(row.coefficient, row.exponent + cycles * raidHealthCycleExponent).significant(2)
}
export const RAID_PLUS_PACK_DAYS_TICKS = 7n * 24n * 60n * 60n * 10000000n
/** Is_Active@0x2b9077c; ticks must come from Time_manager.UtcNow and purchase DateTime. */
export function raidPlusPackActive(purchaseTicks: bigint, utcNowTicks: bigint): boolean {
  return purchaseTicks !== 0n && utcNowTicks < purchaseTicks + RAID_PLUS_PACK_DAYS_TICKS
}
export function raidTimeBonus(plusPack0Active: boolean): 0 | 10 { return plusPack0Active ? 10 : 0 }
