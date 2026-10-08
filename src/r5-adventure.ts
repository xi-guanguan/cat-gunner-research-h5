/** Source contract: artifacts/evidence/round5-20261001/late-adventure-raid-contract.json.
 * Pure recovered numeric rules. Pet dispatch, UI transactions and time authority stay with integrator.
 */
export const ADVENTURE_DURATION_HOURS = [1, 2, 4, 8, 16] as const
export const ADVENTURE_UNLOCK_LEVELS = [0, 1, 3, 6, 10] as const
export const ADVENTURE_PET_SLOT_LEVELS = [0, 2, 7] as const
export const ADVENTURE_MAX_LEVEL = 15
export const ADVENTURE_TICKET_MAX = 20
export const ADVENTURE_TICKET_INTERVAL_TICKS = 144_000_000_000n // C# TimeSpan ticks: 4 hours.
export type AdventureMapType = 0 | 1 | 2
function nonnegativeInt(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(label)
}
export function adventureDurationHours(mapIndex: number): number {
  nonnegativeInt(mapIndex, 'mapIndex')
  const value = ADVENTURE_DURATION_HOURS[mapIndex]
  if (value === undefined) throw new RangeError('mapIndex')
  return value
}
export function adventureEffectiveDurationHours(mapIndex: number, plusPackActive: boolean): number {
  return Math.max(adventureDurationHours(mapIndex) - (plusPackActive ? 16 : 0), 0)
}
export function adventureRequiredExp(level: number): number {
  nonnegativeInt(level, 'level')
  if (level >= ADVENTURE_MAX_LEVEL) throw new RangeError('level')
  return 50 + (20 + 3 * level) * level
}
export function adventurePetSlotCount(level: number): number {
  nonnegativeInt(level, 'level')
  return ADVENTURE_PET_SLOT_LEVELS.filter(required => level >= required).length
}
/** C# DayOfWeek: Sunday = 0. Native invalid map types/days return false. */
export function adventureIsOpenDay(mapType: number, dayOfWeek: number): boolean {
  const masks = [0x13, 0x25, 0x49]
  if (!Number.isInteger(mapType) || !Number.isInteger(dayOfWeek) || mapType < 0 || mapType > 2 || dayOfWeek < 0 || dayOfWeek > 6) return false
  return ((masks[mapType]! >> dayOfWeek) & 1) !== 0
}
/** Original rewards use base duration even with a shortened PlusPack duration. */
export function adventureRewardCore(grades: readonly number[] | null, mapIndex: number): number {
  if (!grades?.length) return 0
  let sum = Math.fround(0)
  for (const grade of grades) {
    nonnegativeInt(grade, 'grade')
    const contribution = Math.fround(Math.fround(Math.fround(grade) * Math.fround(0.1)) + 1)
    sum = Math.fround(sum + contribution)
  }
  return Math.trunc(Math.fround(Math.fround(sum * 20) * adventureDurationHours(mapIndex)))
}
export function adventureRewardExp(petCount: number, mapIndex: number): number {
  nonnegativeInt(petCount, 'petCount')
  return adventureDurationHours(mapIndex) * petCount * 10
}
export interface AdventureExperience { level: number; exp: number }
export function adventureGainExp(state: AdventureExperience, amount: number): AdventureExperience {
  nonnegativeInt(state.level, 'level'); nonnegativeInt(state.exp, 'exp'); nonnegativeInt(amount, 'amount')
  if (state.level > ADVENTURE_MAX_LEVEL) throw new RangeError('level')
  if (state.level === ADVENTURE_MAX_LEVEL) return { ...state } // Native early return, even for malformed exp.
  let level = state.level, exp = state.exp + amount
  while (level < ADVENTURE_MAX_LEVEL && exp >= adventureRequiredExp(level)) {
    exp -= adventureRequiredExp(level); level++
  }
  if (level === ADVENTURE_MAX_LEVEL) exp = 0
  return { level, exp }
}
export interface AdventureTickets { tickets: number; lastChargeTicks: bigint | null }
/** nowTicks must come from the project's authoritative time adapter, not an implicit wall clock. */
export function adventureRefreshTickets(state: AdventureTickets, nowTicks: bigint): AdventureTickets {
  nonnegativeInt(state.tickets, 'tickets')
  if (state.tickets >= ADVENTURE_TICKET_MAX) return { ...state }
  if (state.lastChargeTicks === null || state.lastChargeTicks === 0n) return { tickets: state.tickets, lastChargeTicks: nowTicks }
  const elapsed = nowTicks - state.lastChargeTicks
  if (elapsed < ADVENTURE_TICKET_INTERVAL_TICKS) return { ...state }
  const gained = elapsed / ADVENTURE_TICKET_INTERVAL_TICKS
  if (gained >= BigInt(ADVENTURE_TICKET_MAX - state.tickets)) return { tickets: ADVENTURE_TICKET_MAX, lastChargeTicks: nowTicks }
  return { tickets: state.tickets + Number(gained), lastChargeTicks: state.lastChargeTicks + gained * ADVENTURE_TICKET_INTERVAL_TICKS }
}
export function adventureUseTickets(state: AdventureTickets, count: number, nowTicks: bigint): { state: AdventureTickets; used: boolean } {
  nonnegativeInt(count, 'count')
  const refreshed = adventureRefreshTickets(state, nowTicks)
  if (refreshed.tickets < count) return { state: refreshed, used: false }
  return { state: { tickets: refreshed.tickets - count, lastChargeTicks: refreshed.tickets >= ADVENTURE_TICKET_MAX ? nowTicks : refreshed.lastChargeTicks }, used: true }
}
