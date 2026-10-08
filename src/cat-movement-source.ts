/** Static native contracts from libil2cpp.so SHA256 80eb8bcb…583.
 * Coordinates are native Unity x/y/z; no H5 projection is assumed.
 * See artifacts/evidence/movement-20260930/API.md for partial-method boundaries.
 */
export interface SourceVector3 { readonly x: number; readonly y: number; readonly z: number }
const f = Math.fround;
const zero = (): SourceVector3 => ({ x: 0, y: 0, z: 0 });
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const squared = (v: SourceVector3): number => f(f(f(v.x * v.x) + f(v.y * v.y)) + f(v.z * v.z));
const distanceXZ = (a: SourceVector3, b: SourceVector3): number => {
  const x = f(a.x - b.x), z = f(a.z - b.z);
  return f(Math.sqrt(f(f(x * x) + f(z * z))));
};
export const SOURCE_MOVEMENT_CONSTANTS = Object.freeze({
  screenPitchSin: f(0.5773502588272095), // literal 0x106c1b8
  screenK: f(1.2), // .cctor 0x2b432a0
  screenMagnitudeEpsilon: f(0.0001), // literal 0x106c200
  autoSmoothSpeed: 8, // HandleAutoMove / AutoSmoothStop instruction immediate
  autoStopSquaredSpeed: f(0.01), // literal 0x106c088; square, not magnitude
  autoDirectionDistanceEpsilon: f(0.3), // literal 0x106c190
  autoMinimumSpeedRatio: f(0.2), // literal 0x106c060; NOT AutoZWeight=.4
  autoOffsetStopRadiusRatio: f(0.9), // literal 0x106bea0
  gridZSpan: 45, // FindNearestTreeByGrid immediate 0x42340000
  breadcrumbRecordDistance: 0.5, // RecordBreadcrumb immediate
});
export const SOURCE_ORDINARY_AUTO_DEFAULTS = Object.freeze({
  stopDistance: 16, zOffsetMax: -8, zOffsetMinDist: 3, zOffsetFullDist: 20,
  decelerationRange: 2, nearbyRadius: 8, zWeight: f(0.4),
});

/** Cat.ScreenSpeedMultiplier 0x2b38be8, AFTER CamCorrection*direction.
 * Caller supplies the corrected vector to avoid inventing camera/quaternion state.
 */
export function sourceScreenSpeedMultiplierFromCorrectedDirection(v: SourceVector3): number {
  const zz = f(v.z * v.z), xx = f(v.x * v.x);
  const projected = f(Math.sqrt(f(xx + f(f(zz * SOURCE_MOVEMENT_CONSTANTS.screenPitchSin) * SOURCE_MOVEMENT_CONSTANTS.screenPitchSin))));
  return projected < SOURCE_MOVEMENT_CONSTANTS.screenMagnitudeEpsilon ? 1 : f(f(1 / SOURCE_MOVEMENT_CONSTANTS.screenK) / projected);
}

/** Unity Vector3.Lerp-style binary32 update seen at 0x2b3c898 and 0x2b3f434. */
export function sourceLerpVelocity(current: SourceVector3, target: SourceVector3, dt: number, rate = 8): SourceVector3 {
  const a = clamp01(f(f(dt) * f(rate)));
  const lerp = (from: number, to: number) => f(f(from) + f(f(f(to) - f(from)) * a));
  return { x: lerp(current.x, target.x), y: lerp(current.y, target.y), z: lerp(current.z, target.z) };
}
/** Complete mathematical body of AutoSmoothStop 0x2b3f3d4; rb write belongs to caller. */
export function sourceAutoSmoothStop(current: SourceVector3, dt: number): SourceVector3 {
  const next = sourceLerpVelocity(current, zero(), dt);
  return squared(next) < SOURCE_MOVEMENT_CONSTANTS.autoStopSquaredSpeed ? zero() : next;
}

export interface SourceOrdinaryAutoParameters {
  readonly stopDistance: number; readonly zOffsetMax: number;
  readonly zOffsetMinDist: number; readonly zOffsetFullDist: number;
  readonly decelerationRange: number;
}
export type SourceOrdinaryAutoApproach =
  | { readonly kind: 'within-stop-distance'; readonly referenceDistance: number }
  | { readonly kind: 'tiny-direction'; readonly referenceDistance: number; readonly goal: SourceVector3 }
  | { readonly kind: 'approach'; readonly referenceDistance: number; readonly goal: SourceVector3; readonly direction: SourceVector3; readonly speedRatio: number };
/** Only ordinary approach branch 0x2b3c59c..0x2b3c894.
 * referencePosition = nearHitPoint when nearObj exists, else rawTargetPosition.
 * mode=1 skips Z offset. Within stop distance dispatches to separate retreat/stop
 * branches; this partial contract intentionally leaves those branches to caller.
 */
export function sourceOrdinaryAutoApproach(position: SourceVector3, rawTargetPosition: SourceVector3, referencePosition: SourceVector3, mode: number, p: SourceOrdinaryAutoParameters = SOURCE_ORDINARY_AUTO_DEFAULTS): SourceOrdinaryAutoApproach {
  const d = distanceXZ(position, referencePosition);
  if (d <= p.stopDistance) return { kind: 'within-stop-distance', referenceDistance: d };
  let offset = 0;
  if (mode !== 1) {
    const t = p.zOffsetMinDist === p.zOffsetFullDist ? 0 : clamp01(f(f(d - p.zOffsetMinDist) / f(p.zOffsetFullDist - p.zOffsetMinDist)));
    offset = f(p.zOffsetMax * t);
    const limit = f(p.stopDistance * SOURCE_MOVEMENT_CONSTANTS.autoOffsetStopRadiusRatio);
    if (Math.abs(offset) > limit) offset = f(offset * f(limit / Math.abs(offset)));
  }
  const goal = { x: f(rawTargetPosition.x), y: f(rawTargetPosition.y), z: f(rawTargetPosition.z + offset) };
  const x = f(goal.x - position.x), z = f(goal.z - position.z);
  const length = f(Math.sqrt(f(f(x * x) + f(z * z))));
  if (length < SOURCE_MOVEMENT_CONSTANTS.autoDirectionDistanceEpsilon) return { kind: 'tiny-direction', referenceDistance: d, goal };
  let speedRatio = 1;
  if (d < f(p.stopDistance + p.decelerationRange)) {
    const t = clamp01(f(f(d - p.stopDistance) / p.decelerationRange));
    const smooth = f(f(t * f(t * 3)) - f(t * f(t * f(t + t))));
    speedRatio = f(smooth + f(f(1 - smooth) * SOURCE_MOVEMENT_CONSTANTS.autoMinimumSpeedRatio));
  }
  return { kind: 'approach', referenceDistance: d, goal, direction: { x: f(x / length), y: 0, z: f(z / length) }, speedRatio };
}

export interface SourceTreeCandidate<T> { readonly value: T; readonly position: SourceVector3; readonly eligible: boolean }
export interface SourceTreeGrid<T> { readonly active: boolean; readonly z: number; readonly trees: readonly SourceTreeCandidate<T>[] }
/** Native score 0x2b3f1cc..0x2b3f238. */
export function sourceTreeScore(position: SourceVector3, target: SourceVector3, nearbyRadius = 8, zWeight = f(0.4)): number {
  const d = distanceXZ(position, target);
  const x = f(target.x - position.x), z = f(target.z - position.z);
  const dsq = f(f(x * x) + f(z * z));
  return dsq <= f(nearbyRadius * nearbyRadius) ? d : f(d + f(zWeight * Math.max(0, z)));
}
/** FindNearestTreeByGrid 0x2b3ecd8. Grids and trees MUST retain native array order.
 * eligible covers native object-null, activeSelf and nested target-object active checks.
 * level4Extra mirrors Tree_manager.Boss_tree at manager+0x100 and participates only after active-grid gate.
 */
export function sourceFindNearestTreeByGrid<T>(position: SourceVector3, grids: readonly SourceTreeGrid<T>[], level: number, level4Extra?: SourceTreeCandidate<T>, nearbyRadius = 8, zWeight = f(0.4)): T | undefined {
  const ordered = grids.map((grid, index) => ({ grid, index, lower: position.z < grid.z ? f(grid.z - position.z) : position.z > f(grid.z + 45) ? f(position.z - f(grid.z + 45)) : 0 })).filter(row => row.grid.active);
  if (ordered.length === 0) return undefined; // native returns before level4 extra
  ordered.sort((a, b) => a.lower - b.lower || a.index - b.index);
  let best: T | undefined, score = 3.4028234663852886e38;
  for (const row of ordered) {
    if (row.lower > score) break;
    for (const tree of row.grid.trees) {
      if (!tree.eligible) continue;
      const next = sourceTreeScore(position, tree.position, nearbyRadius, zWeight);
      if (next < score) { score = next; best = tree.value; }
    }
  }
  if (level === 4 && level4Extra?.eligible) {
    const extraScore = sourceTreeScore(position, level4Extra.position, nearbyRadius, zWeight);
    if (extraScore < score) best = level4Extra.value;
  }
  return best;
}

/** Balance_Reload 0x2b39064..0x2b390e0. Raw stat slots are int32 values,
 * not additive units of world velocity. Slots are Pet_manager.Pet_Speed_Accum
 * and Relic_manager.MoveSpeed_Value; see hunt-movement-binding.ts.
 */
export interface SourceRawMovementStatSlots { readonly slot5d5d4d0Static20: number; readonly slot5d5d4d8Static60: number }
export function sourceMoveSpeedFromRawStatSlots(isAI: boolean, slots: SourceRawMovementStatSlots): number {
  const sum = (slots.slot5d5d4d0Static20 + slots.slot5d5d4d8Static60) | 0;
  return f(f((isAI ? 17 : 15) * f(sum)) / 100);
}

/** Static RecordBreadcrumb 0x2b3a678: append after >=.5 world units and cap100. */
export function sourceRecordBreadcrumb(history: readonly SourceVector3[], lastRecordPosition: SourceVector3, current: SourceVector3): { history: SourceVector3[]; lastRecordPosition: SourceVector3 } {
  const d = { x: f(current.x-lastRecordPosition.x), y: f(current.y-lastRecordPosition.y), z: f(current.z-lastRecordPosition.z) };
  if (f(Math.sqrt(squared(d))) < 0.5) return { history: [...history], lastRecordPosition };
  const next = [...history, {x:f(current.x),y:f(current.y),z:f(current.z)}];
  if (next.length >= 101) next.shift();
  return { history: next, lastRecordPosition: next.at(-1)! };
}
/** GetBreadcrumbTarget 0x2b40f4c: nearest crumb +5, capped at tail.
 * At tail, native leader transform (if present) is returned; otherwise current.
 */
export function sourceGetBreadcrumbTarget(current: SourceVector3, history: readonly SourceVector3[], leader?: SourceVector3): SourceVector3 {
  if (!history.length) return current;
  let nearest = 0, distance = 3.4028234663852886e38;
  history.forEach((crumb, index) => {
    const d = squared({x:f(crumb.x-current.x),y:f(crumb.y-current.y),z:f(crumb.z-current.z)});
    if (d < distance) { nearest=index; distance=d; }
  });
  const ahead=Math.min(nearest+5,history.length-1);
  return ahead === nearest ? leader ?? current : history[ahead];
}

/** Physics is deliberately supplied by an adapter. No ray36 avoidance policy
 * has been established: RayCount=36 is consumed by attack target search.
 */
export interface SourceMovementPhysicsInputs {
  readonly pathClear: boolean;
  readonly nearObjectExists: boolean;
  readonly nearHitPoint?: SourceVector3;
  readonly obstacleLayerMask: number;
}
export const SOURCE_MOVEMENT_UNRESOLVED = Object.freeze([
  'Unity camera/quaternion state and screen-to-world adapter',
  'Physics queries and complete obstacle avoidance policy',
  'AI physics/target adapters, facing side effects, native RNG, and monster-mode state transitions',
  'within-stop-distance retreat/locked-attack-target branches',
  'business type binding for raw movement speed stat slots',
  'native runtime parity capture',
] as const);

/** Ordered leader history sample used by Cat.RecordLeaderHistory/GetLaggedLeaderPos.
 * Native keeps a shared insertion queue; callers must preserve insertion order.
 */
export interface SourceLeaderHistorySample {
  readonly position: SourceVector3;
  readonly time: number;
}
export const SOURCE_FOLLOW_CONSTANTS = Object.freeze({
  leaderHistoryDuration: f(2),
  formationAngleDegrees: f(360),
  degreesToRadians: f(0.01745329238474369),
  defaultMinEnemyDist: f(2),
  defaultFollowIdealDist: f(1.2),
  defaultFollowMaxDist: f(10),
  defaultHysteresisMargin: f(0.12),
  defaultMinStateDuration: f(0.3),
  defaultDecelerationRange: f(2),
  defaultMinSpeedRatio: f(0.15),
  defaultVelocitySmoothSpeed: f(8),
  lagSecondsMin: f(0.15),
  lagSecondsMax: f(0.6),
  speedMultiplierMin: f(0.88),
  speedMultiplierMax: f(1.12),
  fidgetIntervalMin: f(1.8),
  fidgetIntervalMax: f(3.5),
  attackDelayOffsetMin: 0,
  attackDelayOffsetMax: f(0.4),
  fidgetRadiusMin: f(0.3),
  fidgetRadiusMax: f(0.8),
  nearSeparationSquaredThreshold: f(0.1),
  nearSeparationDriftScale: f(0.3),
});

/** Cat.RecordLeaderHistory: append one sample, then remove front samples older than 2 s.
 * The native comparison is strict (>2), so a sample exactly two seconds old remains.
 */
export function sourceRecordLeaderHistory(
  history: readonly SourceLeaderHistorySample[],
  current: SourceVector3,
  now: number,
): SourceLeaderHistorySample[] {
  const next = [...history, { position: { x: f(current.x), y: f(current.y), z: f(current.z) }, time: f(now) }];
  const cutoff = f(now);
  while (next.length && f(cutoff - f(next[0].time)) > SOURCE_FOLLOW_CONSTANTS.leaderHistoryDuration) next.shift();
  return next;
}

/** Cat.GetLaggedLeaderPos: query `now - lagSeconds`, return the last sample with
 * timestamp <= queryTime. No interpolation or timestamp sorting occurs. When the
 * queue has no eligible sample, native falls back to leaderPosition/currentPosition.
 */
export function sourceGetLaggedLeaderPosition(
  fallback: SourceVector3,
  history: readonly SourceLeaderHistorySample[],
  now: number,
  lagSeconds: number,
): SourceVector3 {
  const query = f(f(now) - f(lagSeconds));
  let accepted: SourceVector3 = { x: f(fallback.x), y: f(fallback.y), z: f(fallback.z) };
  for (const sample of history) {
    if (f(sample.time) <= query) {
      accepted = { x: f(sample.position.x), y: f(sample.position.y), z: f(sample.position.z) };
      continue;
    }
    break;
  }
  return accepted;
}

/** SetupFormation: Cat_manager uses the native AI array order and places each
 * valid entry on a circle. The assembly passes degrees through sin/cos; the
 * first collected AI entry is angle 0, then 360/count per index. SetupFormation
 * collects only original Cat array indices >=1 and is_AI=true; it assigns
 * the separate manager +0x28 Cat its manager +0x30 Vector3 offset first. `radius` is manager field
 * +0x3c and the result is (sin(angle)*radius,0,cos(angle)*radius).
 */
export function sourceFormationOffset(index: number, count: number, radius: number): SourceVector3 {
  if (!(count > 0) || !Number.isFinite(index) || !Number.isFinite(radius)) return zero();
  const angle = f(f(f(SOURCE_FOLLOW_CONSTANTS.formationAngleDegrees / f(count)) * f(index)) * SOURCE_FOLLOW_CONSTANTS.degreesToRadians);
  return { x: f(f(Math.sin(angle)) * f(radius)), y: 0, z: f(f(Math.cos(angle)) * f(radius)) };
}

/** AIFollow's target construction, preserving native float32 add order. */
export function sourceFollowTarget(
  laggedLeader: SourceVector3,
  formationOffset: SourceVector3,
  fidgetOffset: SourceVector3,
): SourceVector3 {
  return {
    x: f(f(f(laggedLeader.x) + f(formationOffset.x)) + f(fidgetOffset.x)),
    y: f(f(f(laggedLeader.y) + f(formationOffset.y)) + f(fidgetOffset.y)),
    z: f(f(f(laggedLeader.z) + f(formationOffset.z)) + f(fidgetOffset.z)),
  };
}

export interface SourceFollowDistancePolicy {
  readonly idealDistance: number;
}
export type SourceFollowDistanceResult =
  | { readonly kind: 'near'; readonly distance: number; readonly threshold: number }
  | { readonly kind: 'far'; readonly distance: number; readonly threshold: number };
/** AIFollow branches at distance < FollowIdealDist * .5 (strict near). */
export function sourceFollowDistancePolicy(
  current: SourceVector3,
  target: SourceVector3,
  policy: SourceFollowDistancePolicy,
): SourceFollowDistanceResult {
  const dx = f(f(target.x) - f(current.x)), dy = f(f(target.y) - f(current.y)), dz = f(f(target.z) - f(current.z));
  const distance = f(Math.sqrt(f(f(f(dx * dx) + f(dy * dy)) + f(dz * dz))));
  const threshold = f(f(policy.idealDistance) * f(0.5));
  return distance < threshold ? { kind: 'near', distance, threshold } : { kind: 'far', distance, threshold };
}

/** Hysteresis is kept as a contract boundary because EvaluateDesiredState also
 * consumes combat/leader state and several private predicates. Use this only
 * for the proven minimum-duration state adoption in HandleAI.
 */
export function sourceAdoptAIState(
  currentState: number,
  desiredState: number,
  stateTimer: number,
  dt: number,
  minStateDuration: number,
): { readonly state: number; readonly timer: number } {
  const nextTimer = f(f(stateTimer) + f(dt));
  if (desiredState === currentState) return { state: currentState, timer: nextTimer };
  return nextTimer >= f(minStateDuration)
    ? { state: desiredState, timer: 0 }
    : { state: currentState, timer: nextTimer };
}

/** AIFidget timer update. The random draw and facing side effects are intentionally
 * adapter inputs; this helper only models the observed timer gate and offset reset.
 */
export interface SourceFidgetTimerResult {
  readonly timer: number;
  readonly interval: number;
  readonly offset: SourceVector3;
  readonly resampled: boolean;
}
export function sourceFidgetTimerStep(
  timer: number,
  interval: number,
  dt: number,
  currentOffset: SourceVector3,
  sample: () => { readonly interval: number; readonly offset: SourceVector3 },
): SourceFidgetTimerResult {
  const t = f(f(timer) + f(dt));
  if (t < f(interval)) return { timer: t, interval: f(interval), offset: currentOffset, resampled: false };
  const next = sample();
  return { timer: 0, interval: f(next.interval), offset: { x: f(next.offset.x), y: 0, z: f(next.offset.z) }, resampled: true };
}


/** level0 serialized overrides. Raw offsets refer to MonoBehaviour serialized
 * bytes (NOT IL2CPP instance offsets). See follow-20260930/contract.json.
 * SetupFormation special Cat 136810 gets manager offset [7,0,-7]; the remaining
 * AI order is [136809,136808], radius 2.5. Leader Cat 147400 is array index 0.
 */
export const SOURCE_LEVEL0_FOLLOW_PARAMETERS = Object.freeze({
  minEnemyDist: f(5), followIdealDist: f(15), followMaxDist: f(20),
  hysteresisMargin: f(0.12), minStateDuration: f(0.3),
  decelerationRange: f(2), minSpeedRatio: f(0.15), velocitySmoothSpeed: f(8),
  formationRadius: f(2.5),
  specialCatPathID: 136810,
  specialFormationOffset: Object.freeze({ x: f(7), y: 0, z: f(-7) }),
  ringCatPathIDs: Object.freeze([136809, 136808] as const),
  leaderCatPathID: 147400,
});

/** Near AIFollow consumes serialized/public SeparationForce at this+0x1d0,
 * not private _aiMoveDir at this+0x20c. Both branches call AIFidget afterward.
 * Far AIFollow tail-calls SmoothMoveTowardWithAvoidance and skips AIFidget.
 */
export function sourceNearFollowAction(separationForce: SourceVector3): 'smooth-stop' | 'separation-drift' {
  return squared(separationForce) <= SOURCE_FOLLOW_CONSTANTS.nearSeparationSquaredThreshold ? 'smooth-stop' : 'separation-drift';
}

export type SourceAIState = 0 | 1 | 2 | 3 | 4;
export interface SourceDesiredAIStateInputs {
  readonly currentState: SourceAIState;
  readonly leaderDistance: number;
  readonly followMaxDist: number;
  readonly targetExists: boolean;
  readonly leaderTargetExists: boolean;
  readonly distanceToNearHitPoint: number;
  readonly minEnemyDist: number;
  readonly autoStopDistance: number;
  readonly hysteresisMargin: number;
  /** Source GetApproachPosition(targetTransform.position, Attack_Length*.85)
   * distance to leader. Its physical target adapter remains outside this helper. */
  readonly desiredPositionDistanceToLeader: number;
}
/** EvaluateDesiredState 0x2b3fad0. Inputs carry native target/null predicates and
 * 3D distances. Enum: Follow=0, Chase=1, AttackStay=2, Reposition=3, Assist=4.
 */
export function sourceEvaluateDesiredAIState(p: SourceDesiredAIStateInputs): SourceAIState {
  if (f(p.leaderDistance) > f(p.followMaxDist)) return 0;
  if (!p.targetExists) return p.leaderTargetExists ? 4 : 0;
  const distance = f(p.distanceToNearHitPoint), expanded = f(1 + f(p.hysteresisMargin));
  if (p.currentState === 3) {
    if (distance < f(expanded * f(p.minEnemyDist))) return 3;
  } else {
    if (distance < f(p.minEnemyDist)) return 3;
    if (p.currentState === 2) return distance <= f(expanded * f(p.autoStopDistance)) ? 2 : 1;
  }
  if (distance <= f(p.autoStopDistance)) return 2;
  return f(p.desiredPositionDistanceToLeader) <= f(p.followMaxDist) ? 1 : 0;
}
