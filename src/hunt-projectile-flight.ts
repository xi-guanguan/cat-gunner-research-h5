/** H5 flight/pool adapter. Source emission/lifetime/arc policies and real
 * Monster trigger consumers are reused; collision scheduling is not PhysX.
 * Pool grows on demand like a host allocator, NOT a guessed 27-bullet limit.
 * No save, wallet, scene progression or damage-over-time consumer exists here.
 */
import {BigValue} from './big-value';
import {SourceGunType,sourceProjectileState,sourceGunGenerationPolicy,sourceMissileFlight,sourceMissileArc,
 sourceShotgunYawRadians,sourceApplySpread,sourceMissileScatterTarget,SOURCE_PROJECTILE_GENERATION_CONSTANTS,
 type SourceGunGenerationConfig,type SourceProjectileState} from './gun-projectiles';
import type {SourceVector3} from './cat-movement-source';
import type {SourceProjectileTargetPort} from './source-projectile-target';
import {sourceHuntProjectileSegment,sourceHuntMissileEndpoint,type SourceHuntProjectileSettings,type SourceHuntProjectileEvent} from './hunt-projectile-runtime';
import {SOURCE_BULLET_COLLIDERS,sourceBulletRadius} from './source-bullet-colliders';
import {SOURCE_HUNT_CAT_CONFIG,sourceHuntCatBulletDirection} from './hunt-cat-runtime';
const f=Math.fround;
function scalar(n:number,name:string):number {if(!Number.isFinite(n)||!Number.isFinite(f(n)))throw new RangeError(`Invalid Hunt flight ${name}`);return f(n);}
function vector(p:SourceVector3):SourceVector3 {return {x:scalar(p.x,'x'),y:scalar(p.y,'y'),z:scalar(p.z,'z')};}
function settings(original:SourceHuntProjectileSettings,type:SourceGunType):SourceHuntProjectileSettings {
 sourceBulletRadius(original.gunNum);if(SOURCE_BULLET_COLLIDERS.gunBindings[original.gunNum].gunType!==type)throw new RangeError('Hunt flight gun/type mismatch');
 const damage=BigValue.from(original.damage),radius=scalar(original.explosionRadius,'explosion radius');
 if(damage.lt(0)||radius<0||!Number.isInteger(original.enemyLayerMask)||original.enemyLayerMask<-2147483648||original.enemyLayerMask>4294967295)throw new RangeError('Invalid Hunt flight settings');
 return {...original,damage,explosionRadius:radius};
}
export interface SourceHuntFlightToken {readonly slot:number;readonly generation:number}
export interface SourceHuntProjectileFlight {
 readonly slot:number;generation:number;active:boolean;settings:SourceHuntProjectileSettings;state:SourceProjectileState;
 position:SourceVector3;start:SourceVector3;end:SourceVector3;velocity:SourceVector3;
 elapsedSeconds:number;lifetimeSeconds:number;durationSeconds:number;arcHeight:number;
}
export type SourceHuntFlightEvent={token:SourceHuntFlightToken;event:SourceHuntProjectileEvent}|{token:SourceHuntFlightToken;event:{kind:'expired'}};
export class SourceHuntProjectileFlightRuntime {
 readonly slots:SourceHuntProjectileFlight[]=[];
 private readonly free:number[]=[];
 private readonly active=new Set<number>();
 get activeCount():number {return this.active.size;}
 token(p:SourceHuntProjectileFlight):SourceHuntFlightToken {return {slot:p.slot,generation:p.generation};}
 current(t:SourceHuntFlightToken):SourceHuntProjectileFlight|null {const p=this.slots[t.slot];return p?.active&&p.generation===t.generation?p:null;}
 private acquire(type:SourceGunType,start:SourceVector3,s:SourceHuntProjectileSettings):SourceHuntProjectileFlight {
  let p:SourceHuntProjectileFlight;
  if(this.free.length)p=this.slots[this.free.pop()!];else {
   p={slot:this.slots.length,generation:0,active:false,settings:s,state:sourceProjectileState(type),position:start,start,end:start,
    velocity:{x:0,y:0,z:0},elapsedSeconds:0,lifetimeSeconds:0,durationSeconds:0,arcHeight:0};this.slots.push(p);
  }
  p.generation++;p.active=true;p.settings=s;p.state=sourceProjectileState(type);p.position={...start};p.start={...start};p.end={...start};
  p.velocity={x:0,y:0,z:0};p.elapsedSeconds=0;p.lifetimeSeconds=0;p.durationSeconds=0;p.arcHeight=0;this.active.add(p.slot);return p;
 }
 emitLinear(type:SourceGunType,start:SourceVector3,direction:SourceVector3,speed:number,lifetimeSeconds:number,original:SourceHuntProjectileSettings):SourceHuntFlightToken {
  if(type===SourceGunType.Missile)throw new RangeError('Missile requires endpoint flight');
  const a=vector(start),d=vector(direction),speed32=scalar(speed,'linear speed'),life=scalar(lifetimeSeconds,'linear lifetime'),s=settings(original,type);
  if(speed32<=0||life<0)throw new RangeError('Invalid Hunt linear flight');
  const velocity=vector({x:f(d.x*speed32),y:f(d.y*speed32),z:f(d.z*speed32)}),p=this.acquire(type,a,s);p.velocity=velocity;p.lifetimeSeconds=life;return this.token(p);
 }
 emitMissile(start:SourceVector3,end:SourceVector3,speed:number,original:SourceHuntProjectileSettings):SourceHuntFlightToken {
  const a=vector(start),b=vector(end),speed32=scalar(speed,'missile speed'),s=settings(original,SourceGunType.Missile);
  if(speed32<0)throw new RangeError('Invalid missile speed');
  const flight=sourceMissileFlight(a,b,speed32),duration=scalar(flight.durationSeconds,'missile duration'),life=scalar(flight.destroyAfterSeconds,'missile lifetime'),height=scalar(flight.arcHeight,'missile arc height');
  const p=this.acquire(SourceGunType.Missile,a,s);p.end=b;p.durationSeconds=duration;p.lifetimeSeconds=life;p.arcHeight=height;return this.token(p);
 }
 cancel(t:SourceHuntFlightToken):boolean {const p=this.current(t);if(!p)return false;this.release(p);return true;}
 private release(p:SourceHuntProjectileFlight):void {p.active=false;p.state={...p.state,dead:true};this.active.delete(p.slot);this.free.push(p.slot);}
 /** One H5 motion segment per host frame. Lifetime clips motion so a long
  * frame cannot hit past expiry. Endpoint/collision explosion is single-shot.
  * Unity Update/FixedUpdate/coroutine phase parity is NOT claimed. */
 advanceFrame(dt:number,monsters:SourceProjectileTargetPort):SourceHuntFlightEvent[] {
  const delta=scalar(dt,'delta');if(delta<0)throw new RangeError('Negative Hunt flight delta');
  const events:SourceHuntFlightEvent[]=[];if(delta===0||monsters.phase!=='running')return events;
  for(const index of this.active){const p=this.slots[index],token=this.token(p),remaining=Math.max(0,f(p.lifetimeSeconds-p.elapsedSeconds)),step=Math.min(delta,remaining),elapsed=f(p.elapsedSeconds+step);
   const destination=p.state.type===SourceGunType.Missile?vector(sourceMissileArc(p.start,p.end,p.arcHeight,elapsed,p.durationSeconds)):
    vector({x:p.position.x+f(p.velocity.x*step),y:p.position.y+f(p.velocity.y*step),z:p.position.z+f(p.velocity.z*step)});
   const result=sourceHuntProjectileSegment(monsters,p.state,p.position,destination,p.settings);p.state=result.state;p.position=result.position;p.elapsedSeconds=elapsed;
   for(const event of result.events)events.push({token,event});
   if(!p.state.dead&&p.state.type===SourceGunType.Missile&&elapsed>=p.durationSeconds){const endpoint=sourceHuntMissileEndpoint(monsters,p.state,p.end,p.settings);p.state=endpoint.state;p.position=endpoint.position;for(const event of endpoint.events)events.push({token,event});}
   if(p.state.dead)this.release(p);
   else if(elapsed>=p.lifetimeSeconds){events.push({token,event:{kind:'expired'}});this.release(p);}
  }return events;
 }
 dispose():void {for(const index of this.active)this.release(this.slots[index]);}
}
export interface SourceHuntGunEmission {
 readonly gunNum:number;readonly generation:SourceGunGenerationConfig;readonly damage:SourceHuntProjectileSettings['damage'];
 readonly start:SourceVector3;readonly nearHitPoint:SourceVector3;
 /** Missile uses current target Transform.position; other gun types aim at
  * cached ray hit point. Null target means cached point, not world zero. */
 readonly targetTransform:SourceVector3|null;readonly camForward:SourceVector3;
 readonly spreadDegrees:number;readonly missileSpeed:number;readonly linearSpeed?:number;
 readonly random:()=>number;
 /** H5 fault-injection / allocation gate. Checked BEFORE sampling each pellet.
  * No finite capacity is asserted for the native smart pool. */
 readonly canAllocate?:()=>boolean;
}
export function sourceEnemyEmitGun(pool:SourceHuntProjectileFlightRuntime,input:SourceHuntGunEmission,enemyLayerMask:number):SourceHuntFlightToken[] {
 const gun=input.generation,type=gun.type,start=vector(input.start),target=vector(input.nearHitPoint),forward=vector(input.camForward),targetTransform=input.targetTransform===null?null:vector(input.targetTransform);
 const spread=scalar(input.spreadDegrees,'spread'),linear=scalar(input.linearSpeed??SOURCE_PROJECTILE_GENERATION_CONSTANTS.serializedLinearSpeed,'linear speed'),missile=scalar(input.missileSpeed,'missile speed');
 for(const n of [gun.pelletCount,gun.spreadDegrees,gun.explosionRadius,gun.missileExplosionRadius,gun.blastSniperExplosionRadius,gun.penetratingBulletLifetime])if(!Number.isFinite(n)||n<0)throw new RangeError('Invalid Hunt gun emission config');
 if(!Number.isInteger(gun.pelletCount)||!Number.isInteger(type)||type<0||type>6||spread<0||linear<=0||missile<0)throw new RangeError('Invalid Hunt gun emission');
 const policy=sourceGunGenerationPolicy(gun,linear),s=settings({gunNum:input.gunNum,damage:input.damage,explosionRadius:policy.explosionRadius,enemyLayerMask},type);
 const direction=sourceHuntCatBulletDirection(start,target,forward),tokens:SourceHuntFlightToken[]=[];
 const random=()=>{const n=input.random();if(!Number.isFinite(n)||n<0||n>1)throw new RangeError('Invalid Hunt emission random roll');return n;};
 for(let i=0;i<policy.pelletCount;i++){
  if(input.canAllocate&&!input.canAllocate())break;
  if(type===SourceGunType.Missile){const end=sourceMissileScatterTarget(start,targetTransform??target,spread,random);tokens.push(pool.emitMissile(start,end,missile,s));}
  else {
   let shot:SourceVector3;
   if(type===SourceGunType.Shotgun){const yaw=sourceShotgunYawRadians(1,gun.spreadDegrees,random)[0],cos=Math.cos(yaw),sin=Math.sin(yaw);shot={x:direction.x*cos+direction.z*sin,y:direction.y,z:direction.z*cos-direction.x*sin};}
   else shot=sourceApplySpread(direction,spread,random);
   tokens.push(pool.emitLinear(type,start,shot,linear,policy.linearLifetimeSeconds!,s));
  }
 }return tokens;
}

/** Shared allocation/flight policy; target port explicitly supplies mode-specific Enemy semantics. */
export {SourceHuntProjectileFlightRuntime as SourceEnemyProjectileFlightRuntime};

export function sourceHuntEmitGun(pool:SourceHuntProjectileFlightRuntime,input:SourceHuntGunEmission):SourceHuntFlightToken[] {
 return sourceEnemyEmitGun(pool,input,SOURCE_HUNT_CAT_CONFIG.serialized.EnemyLayer);
}
