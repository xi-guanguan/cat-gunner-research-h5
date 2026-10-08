/** Shared per-projectile Enemy consumers. Hunt and Raid supply distinct target ports.
 * Only contacts mutate HP. No teamPower*dt, offscreen DPS, wallet, mode switching
 * or fake level-clear. Motion/emission/scene clocks remain the host's contract.
 * Swept capsules + overlap ordering are explicitly H5 adapters, NOT PhysX.
 */
import {BigValue,type BigValueInput} from './big-value';
import {sourceProjectileHit,sourceExplosionColliders,SourceGunType,type SourceProjectileState} from './gun-projectiles';
import {SOURCE_BULLET_COLLIDERS,sourceBulletRadius} from './source-bullet-colliders';
import type {SourceProjectileTargetPort,SourceProjectileTargetToken} from './source-projectile-target';
import type {SourceVector3} from './cat-movement-source';
const f=Math.fround;
export interface SourceHuntProjectileSettings {
 readonly gunNum:number;
 readonly damage:BigValueInput;
 readonly explosionRadius:number;
 /** Cat.EnemyLayer -> Bullet.SpawnEx/SpawnMissile -> Bullet.enemyLayer.
  * Required, rather than silently inventing the serialized Cat layer mask. */
 readonly enemyLayerMask:number;
}
export type SourceHuntProjectileEvent=
 {kind:'direct-damage'|'blast-damage';token:SourceProjectileTargetToken;colliderID:number;damage:BigValue} |
 {kind:'hit-fx';position:SourceVector3} | {kind:'explode';position:SourceVector3;radius:number};
export interface SourceHuntProjectileResult {state:SourceProjectileState;position:SourceVector3;events:SourceHuntProjectileEvent[]}
function point(p:SourceVector3):SourceVector3 {
 for(const n of [p.x,p.y,p.z])if(!Number.isFinite(n)||!Number.isFinite(f(n)))throw new RangeError('Invalid Hunt projectile position');
 return {x:f(p.x),y:f(p.y),z:f(p.z)};
}
function checked(state:SourceProjectileState,settings:SourceHuntProjectileSettings):{damage:BigValue;radius:number} {
 const radius=sourceBulletRadius(settings.gunNum),damage=BigValue.from(settings.damage);
 if(SOURCE_BULLET_COLLIDERS.gunBindings[settings.gunNum].gunType!==state.type)throw new RangeError('Hunt projectile gun/type mismatch');
 if(damage.lt(0))throw new RangeError('Negative Hunt projectile damage');
 if(!Number.isFinite(settings.explosionRadius)||!Number.isFinite(f(settings.explosionRadius))||settings.explosionRadius<0)throw new RangeError('Invalid Hunt explosion radius');
 if(!Number.isInteger(settings.enemyLayerMask)||settings.enemyLayerMask<-2147483648||settings.enemyLayerMask>4294967295)throw new RangeError('Invalid Hunt enemy layer mask');
 return {damage,radius};
}
function explode(runtime:SourceProjectileTargetPort,state:SourceProjectileState,position:SourceVector3,settings:SourceHuntProjectileSettings,damage:BigValue,events:SourceHuntProjectileEvent[]):SourceProjectileState {
 const radius=f(settings.explosionRadius),contacts=runtime.explosionContacts(position,radius,settings.enemyLayerMask);
 events.push({kind:'explode',position:{...position},radius});
 const result=sourceExplosionColliders(state,contacts.map(c=>({colliderId:c.colliderID,active:!!runtime.current(c.token)})),radius);
 for(const id of result.damageColliderIds){const contact=contacts.find(c=>c.colliderID===id)!;
  if(runtime.damage(contact.token,damage))events.push({kind:'blast-damage',token:contact.token,colliderID:id,damage});
 }
 return result.state;
}
/** Earliest actual trigger along this segment. Laser/pierce may hit several
 * colliders. Every contact re-reads live health (prior explosions may kill it).
 * Only the current contact may explode even after its policy marked dead=true.
 * The explosion center is the swept contact position: explicit H5 CCD adapter,
 * not Unity's discrete Rigidbody Transform.position at trigger dispatch. */
export function sourceHuntProjectileSegment(runtime:SourceProjectileTargetPort,original:SourceProjectileState,from:SourceVector3,to:SourceVector3,settings:SourceHuntProjectileSettings):SourceHuntProjectileResult {
 const a=point(from),b=point(to),{damage,radius}=checked(original,settings),events:SourceHuntProjectileEvent[]=[];
 let state=original,position=b;
 if(original.dead||runtime.phase!=='running')return {state,position,events};
 for(const contact of runtime.bulletContacts(a,b,radius)){
  if(state.dead)break;
  const monster=runtime.current(contact.token);if(!monster)continue;
  const hitPosition=point({x:a.x+(b.x-a.x)*contact.t,y:a.y+(b.y-a.y)*contact.t,z:a.z+(b.z-a.z)*contact.t});
  const hit=sourceProjectileHit(state,{colliderId:contact.colliderID,enemyTagged:true,enemyAlive:true,healthBeforeHit:monster.health},damage,runtime.projectileUiMode);
  state=hit.state;
  if(hit.directDamage&&runtime.damage(contact.token,damage))events.push({kind:'direct-damage',token:contact.token,colliderID:contact.colliderID,damage});
  if(hit.explode)state=explode(runtime,state,hitPosition,settings,damage,events);
  if(hit.spawnFx)events.push({kind:'hit-fx',position:{...hitPosition}});
  if(state.dead)position=hitPosition;
 }
 return {state,position,events};
}
/** Bullet.Update: reaching the missile's chosen endpoint also explodes, even
 * without a hit. A prior collision/death prevents a second endpoint blast. */
export function sourceHuntMissileEndpoint(runtime:SourceProjectileTargetPort,original:SourceProjectileState,endpoint:SourceVector3,settings:SourceHuntProjectileSettings):SourceHuntProjectileResult {
 const position=point(endpoint),{damage}=checked(original,settings),events:SourceHuntProjectileEvent[]=[];
 if(original.type!==SourceGunType.Missile)throw new RangeError('Endpoint explosion requires Missile');
 if(original.dead||runtime.phase!=='running')return {state:original,position,events};
 let state:SourceProjectileState={...original,dead:true,fxSpawned:true};
 state=explode(runtime,state,position,settings,damage,events);events.push({kind:'hit-fx',position:{...position}});
 return {state,position,events};
}

// Compatibility names above remain for existing Hunt hosts; no Hunt rule is used by these consumers.
export {sourceHuntProjectileSegment as sourceEnemyProjectileSegment,sourceHuntMissileEndpoint as sourceEnemyMissileEndpoint};
