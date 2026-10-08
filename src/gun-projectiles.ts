import { BigValue, type BigValueInput } from './big-value';

/** Bullet.OnTriggerEnter dispatch, 0x2b665e4..0x2b6670c. */
export enum SourceGunType { Single=0, Laser=1, Pierce=2, Shotgun=3, Explosive=4, Missile=5, BlastSniper=6 }
export interface SourceProjectileState {
  readonly type: SourceGunType;
  readonly dead: boolean;
  readonly hitColliderIds: readonly number[];
  readonly pierceCount: number;
  readonly firstHitDone: boolean;
  readonly fxSpawned: boolean;
}
export interface SourceProjectileContact {
  readonly colliderId: number;
  readonly enemyTagged: boolean;
  /** Native Enemy component and its nested object exist, with is_Die=false. */
  readonly enemyAlive: boolean;
  readonly healthBeforeHit?: BigValueInput;
}
export interface SourceProjectileHit {
  readonly state: SourceProjectileState;
  readonly directDamage: boolean;
  readonly explode: boolean;
  readonly spawnFx: boolean;
}
export function sourceProjectileState(type: SourceGunType): SourceProjectileState {
  return {type,dead:false,hitColliderIds:[],pierceCount:0,firstHitDone:false,fxSpawned:false};
}
/** Hit policies are independent of the collision adapter. Collider identity,
 * rather than Enemy identity, is the recovered deduplication key (+0xd0).
 * UI.currentType Raid=5 ends laser/pierce after a live enemy hit.
 */
export function sourceProjectileHit(state: SourceProjectileState, contact: SourceProjectileContact,
  damage: BigValueInput, uiMode=0): SourceProjectileHit {
  let next={...state,hitColliderIds:[...state.hitColliderIds]};
  const result=(directDamage=false,explode=false,spawnFx=false):SourceProjectileHit=>({state:next,directDamage,explode,spawnFx});
  if(state.dead || state.hitColliderIds.includes(contact.colliderId))return result();
  const fxOnce=()=>{const spawn=!next.fxSpawned;next.fxSpawned=true;return spawn;};
  const greater=()=>contact.enemyAlive && contact.healthBeforeHit!==undefined && BigValue.from(damage).gt(contact.healthBeforeHit);
  const pierce=()=>{
    if(!contact.enemyTagged){next.dead=true;return result(false,false,true);}
    next.hitColliderIds.push(contact.colliderId);
    if(!contact.enemyAlive)return result();
    next.pierceCount++;
    // 0x2b66bd8..0x2b66bf8: count<2 OR damage>HP permits continuation.
    next.dead=uiMode===5 || (next.pierceCount>=2 && !greater());
    return result(true,false,fxOnce());
  };
  switch(state.type){
    case SourceGunType.Single:
    case SourceGunType.Shotgun:
      next.dead=true;return result(true,false,true);
    case SourceGunType.Laser:
      if(!contact.enemyTagged){next.dead=true;return result(false,false,true);}
      next.hitColliderIds.push(contact.colliderId);next.dead=uiMode===5;
      return result(true,false,fxOnce());
    case SourceGunType.Pierce:return pierce();
    case SourceGunType.Explosive:
    case SourceGunType.Missile:
      next.dead=true;return result(false,true,true);
    case SourceGunType.BlastSniper:
      if(state.firstHitDone)return pierce();
      next.firstHitDone=true;
      // First blast delegates damage to Explode (no additional direct hit).
      next.dead=!contact.enemyTagged || !greater();
      return result(false,true,fxOnce());
  }
}
/** Explode 0x2b65edc: supplied overlaps MUST use source query order and active
 * collider eligibility. Sphere query/layer mask are the engine adapter's job.
 * A collider seen earlier on this projectile does not receive blast damage again.
 */
export function sourceExplosionColliders(state: SourceProjectileState,
  overlaps: readonly {colliderId:number;active:boolean}[], radius:number): {state:SourceProjectileState;damageColliderIds:number[]} {
  if(radius<=0)return {state,damageColliderIds:[]};
  const seen=new Set(state.hitColliderIds),damageColliderIds:number[]=[];
  for(const hit of overlaps){if(!hit.active || seen.has(hit.colliderId))continue;seen.add(hit.colliderId);damageColliderIds.push(hit.colliderId);}
  return {state:{...state,hitColliderIds:[...seen]},damageColliderIds};
}
export interface SourceProjectileVector3 { x:number;y:number;z:number }
/** Bullet.Update 0x2b65d18..0x2b65d74: clamped t and parabolic Y elevation. */
export function sourceMissileArc(start:SourceProjectileVector3,end:SourceProjectileVector3,
  arcHeight:number,elapsed:number,duration:number): SourceProjectileVector3 {
  const t=Math.max(0,Math.min(1,elapsed/duration));
  return {x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t+4*arcHeight*t*(1-t),z:start.z+(end.z-start.z)*t};
}

/** Binary32 literals and prefab override recovered for this source sample. */
export const SOURCE_PROJECTILE_GENERATION_CONSTANTS = Object.freeze({
  minimumSpeedOrDuration: Math.fround(0.1),
  singleAndShotgunLifetime: Math.fround(0.7),
  explosiveLifetime: 1.5,
  maxLinearTravelDistance: 50,
  constructorLinearSpeed: 45,
  serializedLinearSpeed: 70,
  degreesToRadians: Math.fround(Math.PI / 180),
  missileArcFactor: Math.fround(0.4),
  missileDestroyTail: 0.5,
});
export interface SourceGunGenerationConfig {
  readonly type: SourceGunType;
  readonly pelletCount: number;
  readonly spreadDegrees: number;
  readonly explosionRadius: number;
  readonly missileExplosionRadius: number;
  readonly blastSniperExplosionRadius: number;
  readonly penetratingBulletLifetime: number;
}
/** Cat.Attack selects one generation branch by gun type. Pellet count is read
 * only by TryFireShotgun. Distances/speeds/radii use source Unity world units.
 */
export function sourceGunGenerationPolicy(gun: SourceGunGenerationConfig,
  linearSpeed:number=SOURCE_PROJECTILE_GENERATION_CONSTANTS.serializedLinearSpeed): {
    pelletCount:number; explosionRadius:number; linearLifetimeSeconds:number|undefined;
  } {
  const c=SOURCE_PROJECTILE_GENERATION_CONSTANTS;
  const maxLifetime=gun.type===SourceGunType.Single || gun.type===SourceGunType.Shotgun
    ? c.singleAndShotgunLifetime : gun.type===SourceGunType.Explosive
      ? c.explosiveLifetime : gun.penetratingBulletLifetime;
  const explosionRadius=gun.type===SourceGunType.Explosive ? gun.explosionRadius
    : gun.type===SourceGunType.Missile ? gun.missileExplosionRadius
      : gun.type===SourceGunType.BlastSniper ? gun.blastSniperExplosionRadius : 0;
  return {
    pelletCount:gun.type===SourceGunType.Shotgun ? Math.max(1,gun.pelletCount) : 1,
    explosionRadius,
    linearLifetimeSeconds:gun.type===SourceGunType.Missile ? undefined
      : Math.min(c.maxLinearTravelDistance/Math.max(linearSpeed,c.minimumSpeedOrDuration),maxLifetime),
  };
}
/** TryFireShotgun 0x2b420d0..0x2b42170: each pellet gets an independent
 * Random.Range(-spread,+spread), converted to radians around Unity world Y.
 * random01 adapts the native RNG; this helper does not claim sequence parity.
 */
export function sourceShotgunYawRadians(pelletCount:number,spreadDegrees:number,
  random01:()=>number): number[] {
  return Array.from({length:Math.max(1,pelletCount)},()=>
    (-spreadDegrees+2*spreadDegrees*random01())*SOURCE_PROJECTILE_GENERATION_CONSTANTS.degreesToRadians);
}
/** TryFireMissile 0x2b42420..0x2b42490 then SpawnMissile:
 * endpoint is already chosen (including source target scatter). ElevationMin/
 * Max are not consumed here. Destroy timer uses the UNCLAMPED travel duration.
 */
export function sourceMissileFlight(start:SourceProjectileVector3,end:SourceProjectileVector3,
  missileSpeed:number): {travelSeconds:number;durationSeconds:number;arcHeight:number;destroyAfterSeconds:number} {
  const c=SOURCE_PROJECTILE_GENERATION_CONSTANTS;
  const distanceXZ=Math.hypot(end.x-start.x,end.z-start.z);
  const travelSeconds=distanceXZ/Math.max(missileSpeed,c.minimumSpeedOrDuration);
  return {travelSeconds,durationSeconds:Math.max(travelSeconds,c.minimumSpeedOrDuration),
    arcHeight:distanceXZ*c.missileArcFactor,destroyAfterSeconds:travelSeconds+c.missileDestroyTail};
}

/** Cat fields are per instance. Public values may be overridden by the prefab. */
export interface SourceCatSpreadConfig {
  readonly minDegrees:number;
  readonly maxDegrees:number;
  readonly growthRate:number;
  readonly decayMultiplier:number;
}
export const SOURCE_CAT_SPREAD_CONSTRUCTOR_DEFAULTS:SourceCatSpreadConfig=Object.freeze({
  minDegrees:2,maxDegrees:25,growthRate:Math.fround(.3),decayMultiplier:3,
});
/** Current APK: identical public scalar block in all four Cat components. */
export const SOURCE_CAT_SPREAD_SERIALIZED_CONFIG:SourceCatSpreadConfig=Object.freeze({
  minDegrees:2,maxDegrees:20,growthRate:Math.fround(.3),decayMultiplier:3,
});
export const SOURCE_CAT_SPREAD_CONSTANTS=Object.freeze({
  cooldownFloor:Math.fround(.05),logOffset:Math.fround(Math.log(20)),
  logSpan:Math.fround(Math.log(40)),angleThreshold:Math.fround(.01),
});
export interface SourceCatSpreadState {
  readonly spreadAngleDegrees:number;
  readonly previousHadTarget:boolean;
  readonly attackTimerSeconds:number;
}
export function sourceCatSpreadState(initialAttackTimerSeconds=0):SourceCatSpreadState {
  return {spreadAngleDegrees:0,previousHadTarget:false,attackTimerSeconds:initialAttackTimerSeconds};
}
/** get_SpreadMaxAngle 0x2b38a90: inverse logarithmic cooldown interpolation.
 * Config is required because current APK public fields override ctor defaults.
 */
export function sourceCatSpreadMaxAngle(cooldownSeconds:number,config:SourceCatSpreadConfig):number {
  const c=SOURCE_CAT_SPREAD_CONSTANTS;
  const weight=1-Math.min(1,Math.max(0,(Math.log(Math.max(cooldownSeconds,c.cooldownFloor))+c.logOffset)/c.logSpan));
  return config.minDegrees+(config.maxDegrees-config.minDegrees)*weight;
}
/** UpdateSpreadState precedes movement and firing. A false -> true target
 * transition resets angle AND clock; switching between two nonnull targets
 * does not. No moving/stopped flag is consumed by the source method.
 */
export function sourceCatSpreadBeforeAttack(state:SourceCatSpreadState,hasTarget:boolean,
  deltaSeconds:number,cooldownSeconds:number,config:SourceCatSpreadConfig):SourceCatSpreadState {
  if(hasTarget && !state.previousHadTarget)
    return {...state,spreadAngleDegrees:0,attackTimerSeconds:0,previousHadTarget:true};
  const decay=Math.max(sourceCatSpreadMaxAngle(cooldownSeconds,config),1)*config.decayMultiplier*deltaSeconds;
  return {...state,previousHadTarget:hasTarget,spreadAngleDegrees:
    !hasTarget && state.spreadAngleDegrees>0 ? Math.max(0,state.spreadAngleDegrees-decay) : state.spreadAngleDegrees};
}
/** Cat.Update / HandleAI / HandleAIMonster add dt once then attempt at most one
 * attack. Timer advances without a target. Consumer performs the attack when
 * attemptAttack is true and passes the result to sourceCatAttackResult.
 */
export function sourceCatAttackTick(state:SourceCatSpreadState,hasTarget:boolean,
  deltaSeconds:number,cooldownSeconds:number):{state:SourceCatSpreadState;attemptAttack:boolean} {
  const timer=state.attackTimerSeconds+deltaSeconds;
  const attemptAttack=timer>=cooldownSeconds && hasTarget;
  return {state:{...state,attackTimerSeconds:attemptAttack?0:timer},attemptAttack};
}
/** Attack success grows spread only for non-Shotgun guns, AFTER emission.
 * Failed pool/spawn returns restore cooldown-dt; next tick may retry immediately.
 */
export function sourceCatAttackResult(state:SourceCatSpreadState,type:SourceGunType,succeeded:boolean,
  deltaSeconds:number,cooldownSeconds:number,config:SourceCatSpreadConfig):SourceCatSpreadState {
  if(!succeeded)return {...state,attackTimerSeconds:cooldownSeconds-deltaSeconds};
  if(type===SourceGunType.Shotgun)return state;
  const maxAngle=sourceCatSpreadMaxAngle(cooldownSeconds,config);
  const growth=Math.min(1,Math.max(0,config.growthRate));
  return {...state,spreadAngleDegrees:state.spreadAngleDegrees+(maxAngle-state.spreadAngleDegrees)*growth};
}
/** ApplySpread uses a signed world-Y yaw, with a strict less-than skip gate.
 * Unlike missile scattering, equality with source .01 still samples RNG.
 */
export function sourceApplySpread(direction:SourceProjectileVector3,spreadDegrees:number,
  random01:()=>number):SourceProjectileVector3 {
  if(spreadDegrees<SOURCE_CAT_SPREAD_CONSTANTS.angleThreshold)return {...direction};
  const yaw=(-spreadDegrees+2*spreadDegrees*random01())*SOURCE_PROJECTILE_GENERATION_CONSTANTS.degreesToRadians;
  const cos=Math.cos(yaw),sin=Math.sin(yaw);
  return {x:direction.x*cos+direction.z*sin,y:direction.y,z:direction.z*cos-direction.x*sin};
}
/** TryFireMissile samples azimuth then LINEAR radius, and offsets target XZ.
 * A valid Transform supplies current target XYZ; otherwise caller supplies the
 * cached nearHitPoint. Only angles strictly greater than source .01 scatter.
 */
export function sourceMissileScatterTarget(start:SourceProjectileVector3,target:SourceProjectileVector3,
  spreadDegrees:number,random01:()=>number):SourceProjectileVector3 {
  if(spreadDegrees<=SOURCE_CAT_SPREAD_CONSTANTS.angleThreshold)return {...target};
  const radians=SOURCE_PROJECTILE_GENERATION_CONSTANTS.degreesToRadians;
  const maxRadius=Math.hypot(target.x-start.x,target.z-start.z)*Math.tan(spreadDegrees*radians);
  const azimuth=360*random01()*radians;
  const radius=maxRadius*random01();
  return {x:target.x+radius*Math.cos(azimuth),y:target.y,z:target.z+radius*Math.sin(azimuth)};
}
