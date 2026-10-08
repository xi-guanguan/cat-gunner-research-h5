import { BigValue } from './big-value';
import { candidateConfig, type RuleConfig } from './config';
import { makeActor, type CatActor } from './cat-actors';
import { tick, healthValue, numericMirror, type State, type Target, type Point,
  type TickInput, type ExtraGun, type ShotEvent, type MuzzleResolver, type CombatModifiers } from './rules';
import { upgradeSpeedValue } from './upgrade-tables';
import { generateSourceMine, createH5MineRandom, sourceMineAttackInterval, SOURCE_MINE_CONFIG,
  SOURCE_MINE_PLAYER_RULES, type MineAdapters, type MineGeneration, type MineGenerationConfig } from './mine-source';

export interface MineTarget extends Target { oreType: 0 | 1; scoreValue: number; poolIndex: number }
export type MineEvent = ({ type: 'shot'; x: number; y: number } & ShotEvent)
  | ({type:'projectileImpact'} & import('./rules').ProjectileImpactEvent)
  | import('./rules').ProjectileViewLifecycleEvent
  | { type: 'hit'; id: number; damage: number; damageValue: BigValue }
  | { type: 'death'; id: number; x: number; y: number; oreType: 0 | 1; score: number };
export interface MineRun {
  battle: State & { targets: MineTarget[] };
  guns: ExtraGun[]; score: number; elapsed: number; durationSeconds: number;
  settled: boolean; settlementReason: 'timeout' | 'cleared' | null;
  sourceOreCountNow: number; events: MineEvent[]; generation: MineGeneration;
  bounds: { minimum: Point; maximum: Point }; adapterEvidence: typeof MINE_RUNTIME_ADAPTER_EVIDENCE;
}
export interface MineBattleOptions {
  /** Array indices preserve source equipped slots; a nonempty primary is required. */
  guns?: (ExtraGun | null)[]; combatModifiers?: CombatModifiers;
  plusTimePackActive?: boolean; adapters?: MineAdapters;
  generationConfig?: MineGenerationConfig; spawn?: Point;
}
export const MINE_RUNTIME_ADAPTER_EVIDENCE = Object.freeze({
  random: 'H5 xorshift32, not Unity seed source/System.Random',
  perlin: 'H5 seeded 2D gradient noise; Unity Mathf.PerlinNoise not reproduced',
  movement: 'existing Cat actors generic nearest-target movement/physics and formation adapter; native mine smoothing/overlap not replayed',
  combat: 'rules.tick projectile/pellet engine and catch-up firing; source gun type/pellet/speed/lifetime/missile arc consumed; collision geometry, native timer failure handling and RNG are H5 adapters',
  geometry: 'identity source x/z; internal positive-rectangle translation for rules.tick clamp; radius1.2/projectile speed80/stop10 are H5 adapter inputs',
  settlement: 'source pool counter retained; fewer active ores than pool can wait for timeout after all active ores die',
  spawn: 'source serialized all-zero CatSpawnPos inferred at12124 immediately before gameSlider; caller may provide confirmed spawn',
});
/** H5-only gradient noise. The map algorithm remains the recovered source algorithm. */
export function createH5MinePerlin(seed: number): (x: number, z: number) => number {
  const random = createH5MineRandom(seed ^ 0x51ed270b), p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = random.nextInt(0, i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const gradient = (hash: number, x: number, y: number) => {
    const h = hash & 7; const a = h < 4 ? x : y, b = h < 4 ? y : x;
    return ((h & 1) ? -a : a) + ((h & 2) ? -b : b);
  };
  return (x, z) => {
    const xi = Math.floor(x) & 255, zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x), zf = z - Math.floor(z), u = fade(xf), v = fade(zf);
    const hash = (a: number, b: number) => p[(p[a & 255] + b) & 255];
    const n = mix(mix(gradient(hash(xi, zi), xf, zf), gradient(hash(xi + 1, zi), xf - 1, zf), u),
      mix(gradient(hash(xi, zi + 1), xf, zf - 1), gradient(hash(xi + 1, zi + 1), xf - 1, zf - 1), u), v);
    return Math.max(0, Math.min(1, (n + 1) / 2));
  };
}
function copyGuns(guns: (ExtraGun | null)[]): ExtraGun[] {
  const result = guns.flatMap((gun, index) => gun ? [{ ...gun, slot: gun.slot ?? index }] : []);
  if (!result.length || result[0].slot !== 0) throw new Error('Mine selected equipment requires primary slot0');
  return result;
}
export function createMineBattle(fieldState: State, seed: number, options: MineBattleOptions = {}): MineRun {
  const config = options.generationConfig ?? SOURCE_MINE_CONFIG;
  const adapters = options.adapters ?? { random: createH5MineRandom(seed), perlinNoise: createH5MinePerlin(seed),
    noiseEvidence: MINE_RUNTIME_ADAPTER_EVIDENCE.perlin };
  const generation = generateSourceMine(adapters, config);
  const guns = copyGuns(options.guns ?? [fieldState.primaryGun ?? { damage: 100, intervalSeconds: 0.6, id: 'starter-single-d', slot: 0 }]);
  const targets: MineTarget[] = generation.ores.map(ore => ({
    id: ore.poolIndex + 1, poolIndex: ore.poolIndex, oreType: ore.type, scoreValue: ore.score,
    position: { x: ore.position.x, y: ore.position.z }, radius: 1.2,
    health: ore.hp, maxHealth: ore.hp, healthValue: BigValue.from(ore.hp), maxHealthValue: BigValue.from(ore.hp),
    coin: 0, coinValue: BigValue.ZERO,
  }));
  const spawn = { ...(options.spawn ?? { x: 0, y: 0 }) };
  const radius = config.outerRadius + 2;
  const bounds = { minimum: { x: Math.min(config.center.x - radius, spawn.x - 2), y: Math.min(config.center.z - radius, spawn.y - 2) },
    maximum: { x: Math.max(config.center.x + radius, spawn.x + 2), y: Math.max(config.center.z + radius, spawn.y + 2) } };
  const durationSeconds = options.plusTimePackActive
    ? Math.fround(SOURCE_MINE_PLAYER_RULES.baseDurationSeconds * SOURCE_MINE_PLAYER_RULES.plusTimeMultiplier)
    : SOURCE_MINE_PLAYER_RULES.baseDurationSeconds;
  const battle: MineRun['battle'] = { ...fieldState, phase: 'playing', elapsed: 0, player: spawn,
    targets, earned: 0, earnedValue: BigValue.ZERO, upgradeLevels: { ...fieldState.upgradeLevels },
    combatModifiers: options.combatModifiers ?? fieldState.combatModifiers,
    projectiles: [], shootCooldown: 0, extraGunCooldowns: [], shotEvents: [], impactEvents: [], projectileLifecycleEvents: [],
    nextId: config.poolCapacity + 1, primaryGun: { ...guns[0], damage: 1, damageValue: BigValue.ONE },
    actors: [makeActor(0, spawn)], targetBatchSize: 0, autoMove: true,
    autoStopWorldDistance: 10, worldUnitsPerPoint: { x: 1, y: 1 },
  };
  return { battle, guns, score: 0, elapsed: 0, durationSeconds, settled: false,
    settlementReason: null, sourceOreCountNow: generation.sourceInitializedOreCount,
    events: [], generation, bounds, adapterEvidence: MINE_RUNTIME_ADAPTER_EVIDENCE };
}
function translatePoint(point: Point, offset: Point): Point { return { x: point.x + offset.x, y: point.y + offset.y }; }
function translateActor(actor: CatActor, offset: Point, scale: Point): CatActor {
  const translateWorld = (point: {x:number;y:number;z:number}) => ({ ...point, x:point.x+offset.x*scale.x, z:point.z+offset.y*scale.y });
  return { ...actor, position: translatePoint(actor.position, offset), velocity: { ...actor.velocity }, aim: { ...actor.aim },
    breadcrumbs: actor.breadcrumbs.map(point => translatePoint(point, offset)),
    leaderHistory: actor.leaderHistory?.map(sample => ({ ...sample, position: translateWorld(sample.position) })),
    movementPhysics: actor.movementPhysics ? { ...actor.movementPhysics, nearHitPoint: actor.movementPhysics.nearHitPoint ? translateWorld(actor.movementPhysics.nearHitPoint) : undefined } : undefined,
    breadcrumbLastRecordPosition: actor.breadcrumbLastRecordPosition ? translatePoint(actor.breadcrumbLastRecordPosition, offset) : undefined };
}
function translateBattle(battle: State, offset: Point): State {
  return { ...battle, player: translatePoint(battle.player, offset),
    actors: battle.actors?.map(actor => translateActor(actor, offset, battle.worldUnitsPerPoint)),
    targets: battle.targets.map(target => ({ ...target, position: translatePoint(target.position, offset) })),
    projectiles: battle.projectiles.map(projectile => ({ ...projectile, position: translatePoint(projectile.position, offset),
      spawnPosition: projectile.spawnPosition ? translatePoint(projectile.spawnPosition, offset) : undefined,
      flight:projectile.flight?{...projectile.flight,
        start:{...projectile.flight.start,x:projectile.flight.start.x+offset.x*battle.worldUnitsPerPoint.x,z:projectile.flight.start.z+offset.y*battle.worldUnitsPerPoint.y},
        end:{...projectile.flight.end,x:projectile.flight.end.x+offset.x*battle.worldUnitsPerPoint.x,z:projectile.flight.end.z+offset.y*battle.worldUnitsPerPoint.y}}:undefined })),
    projectileLifecycleEvents:battle.projectileLifecycleEvents?.map(event=>event.type==='projectilePath'
      ?{...event,position:translatePoint(event.position,offset),fromPosition:translatePoint(event.fromPosition,offset)}
      :{...event,position:translatePoint(event.position,offset)}),
    impactEvents:battle.impactEvents?.map(event=>({...event,position:translatePoint(event.position,offset)})),
    shotEvents: battle.shotEvents?.map(event => ({ ...event, muzzle: translatePoint(event.muzzle, offset),
      direction: { ...event.direction }, projectileIds: [...event.projectileIds] })) };
}
export function tickMineBattle(run: MineRun, dt: number, input: TickInput = {}, resolveMuzzle?: MuzzleResolver,
  selectedGuns?: (ExtraGun | null)[], combatModifiers?: CombatModifiers): MineRun {
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.25) throw new RangeError('Mine tick requires 0..0.25 seconds');
  if (run.settled) return { ...run, events: [], battle: { ...run.battle, shotEvents: [],impactEvents:[],projectileLifecycleEvents:[] } };
  const guns = selectedGuns ? copyGuns(selectedGuns) : run.guns;
  const modifiers = combatModifiers ?? run.battle.combatModifiers;
  const resolved = guns.map(gun => {
    const interval = sourceMineAttackInterval({ gunBaseInterval: gun.intervalSeconds,
      ordinarySpeedPercent: upgradeSpeedValue(run.battle.upgradeLevels.speed),
      permanentSpeedPercent: modifiers?.permanentSpeedPercent ?? 100,
      skinSpeedPercent: modifiers?.skinSpeedPercent ?? 100, speedBuffMultiplier: modifiers?.attackSpeedBuff ?? 1 });
    if (interval.status === 'unsupported') throw new Error(interval.reason);
    return { ...gun, damage: 1, damageValue: BigValue.ONE, intervalSeconds: interval.seconds };
  });
  const offset = { x: -run.bounds.minimum.x, y: -run.bounds.minimum.y }, inverse = { x: -offset.x, y: -offset.y };
  const internal = translateBattle(run.battle, offset);
  internal.phase = 'playing'; internal.stage = 0; internal.upgradeLevels = { power: 0, money: 0, speed: 0 };
  internal.combatModifiers = undefined; internal.primaryGun = resolved[0];
  // Only the current mine's projectiles enter this adapter; keep fixed1 for in-flight projectiles too.
  internal.projectiles = internal.projectiles.map(projectile => ({ ...projectile, damage: 1, damageValue: BigValue.ONE }));
  const config: RuleConfig = { ...candidateConfig,
    arena: { width: run.bounds.maximum.x - run.bounds.minimum.x, height: run.bounds.maximum.y - run.bounds.minimum.y },
    player: { ...candidateConfig.player, attackRange: 40, baseDamage: 1, projectileSpeed: 80 },
    level: { ...candidateConfig.level, seconds: run.durationSeconds },
  };
  const resolver: MuzzleResolver | undefined = resolveMuzzle ? (actor, gun, state) => {
    const result = resolveMuzzle(translateActor(actor, inverse, state.worldUnitsPerPoint), gun, translateBattle(state, inverse));
    return { position: translatePoint(result.position, offset), height: result.height };
  } : undefined;
  const effectiveDt = Math.min(dt, Math.max(0, run.durationSeconds - run.elapsed));
  const raw = tick(internal, effectiveDt, input, config, resolved.slice(1), resolver);
  const battle = translateBattle(raw, inverse) as MineRun['battle'];
  battle.stage = run.battle.stage; battle.level = run.battle.level;
  battle.upgradeLevels = { ...run.battle.upgradeLevels }; battle.combatModifiers = modifiers;
  battle.primaryGun = { ...guns[0], damage: 1, damageValue: BigValue.ONE };
  const events: MineEvent[] = (battle.shotEvents ?? []).map(event => ({ ...event, type: 'shot', x: event.muzzle.x, y: event.muzzle.y }));
  events.push(...(battle.projectileLifecycleEvents??[]));
  events.push(...(battle.impactEvents??[]).map(event=>({...event,type:"projectileImpact" as const})));
  let score = run.score, sourceOreCountNow = run.sourceOreCountNow;
  const beforeById = new Map(run.battle.targets.map(target => [target.id, target]));
  for (const target of battle.targets) {
    const before = beforeById.get(target.id);
    if (!before || healthValue(target).gte(healthValue(before))) continue;
    const damageValue = healthValue(before).sub(healthValue(target));
    events.push({ type: 'hit', id: target.id, damage: numericMirror(damageValue), damageValue });
    if (target.health === 0) {
      score += target.scoreValue; sourceOreCountNow--;
      events.push({ type: 'death', id: target.id, x: target.position.x, y: target.position.y, oreType: target.oreType, score: target.scoreValue });
    }
  }
  const elapsed = battle.elapsed;
  const settlementReason = sourceOreCountNow <= 0 ? 'cleared' : elapsed + 1e-9 >= run.durationSeconds ? 'timeout' : null;
  // Source retains pool-sized OreCount even if generation activated fewer objects.
  battle.phase = settlementReason ? 'won' : 'playing';
  return { ...run, battle, guns, score, elapsed, sourceOreCountNow, events,
    settled: settlementReason !== null, settlementReason };
}
export function mineProgress(run: MineRun) {
  const remainingOres = run.battle.targets.filter(target => target.health > 0).length;
  return { score: run.score, elapsed: run.elapsed, remainingSeconds: Math.max(0, run.durationSeconds - run.elapsed),
    activeCount: run.generation.activeCount, remainingOres, destroyedCount: run.generation.activeCount - remainingOres,
    sourceOreCountNow: run.sourceOreCountNow, settled: run.settled, settlementReason: run.settlementReason };
}
