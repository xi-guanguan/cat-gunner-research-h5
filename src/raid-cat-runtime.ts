/** Mode5 selected Cats -> ordinary AI -> source attack clocks/sockets -> live
 * Raid Enemy projectiles. This runtime NEVER advances the Raid timer/flight
 * host or touches a wallet/save. SourceRaidClientOwner remains their sole owner.
 * Camera, rig pose and native random
 * settings must be supplied explicitly, not replaced by Hunt radius14 policy.
 * Scheduling / Euler integration / analytic sphere rays are H5 adapters;
 * scene/device parity is NOT implied by synthetic tests.
 */
import {sourceRaidLeaderMovementFrame,freshSourceRaidLeaderAutoState,type SourceRaidLeaderAutoState} from './raid-leader-movement';
import {BigValue} from './big-value';
import serialized from './data/raid-cat-settings-source.json';
export const SOURCE_RAID_CAT_SETTINGS=serialized;
import {bindSourceRaidEquipment,type SourceRaidEquipmentBinding} from './raid-equipment-binding';
import {SourceRaidBattleRuntime} from './raid-battle-runtime';
import {SOURCE_RAID_WORLD,sourceRaidSphereSegmentEntry,type SourceRaidBossRuntime} from './raid-boss-runtime';
import {sourceRaidCatAIMovementFrame,type SourceRaidAIState} from './raid-cat-movement';
import {sourceMoveSpeedFromRawStatSlots,sourceRecordBreadcrumb,sourceRecordLeaderHistory,
 sourceGetLaggedLeaderPosition,sourceFidgetTimerStep,
 type SourceVector3,type SourceRawMovementStatSlots,type SourceLeaderHistorySample} from './cat-movement-source';
import {freshSourceHuntCatMovementState,sourceHuntComputeSeparation,
 type SourceHuntCatMovementState,type SourceHuntCatMovementAdapter} from './hunt-cat-movement';
import {SOURCE_HUNT_CAT_CONFIG,SourceHuntCatAttackRuntime,freshSourceHuntCatTargetState,sourceHuntCatRaycastFrame,
 type SourceHuntCatTargetState,type SourceHuntRayHit,type SourceHuntRaycast,type SourceHuntViewportProjection,
 type SourceHuntCatAttackRequest} from './hunt-cat-runtime';
import {sourceHuntGunSockets,sourceHuntGunFirePosition} from './hunt-gun-sockets';
import {sourceBulletRadius,SOURCE_BULLET_COLLIDERS} from './source-bullet-colliders';
import {sourceBossShotDamage} from './r5-boss';
import type {SourceHuntFlightToken} from './hunt-projectile-flight';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceRaidSelection} from './r6-raid';
import type {SourceRaidClientFrame} from './raid-client-owner';
const f=Math.fround,zero=():SourceVector3=>({x:0,y:0,z:0});
function scalar(value:number,label:string):number {
 if(!Number.isFinite(value)||!Number.isFinite(f(value)))throw RangeError(`Invalid Raid Cat ${label}`);
 return f(value);
}
function nonnegative(value:number,label:string):number {
 const v=scalar(value,label);if(v<0)throw RangeError(`Negative Raid Cat ${label}`);return v;
}
function vector(p:SourceVector3):SourceVector3 {
 if(!p)throw RangeError('Missing Raid Cat vector');
 return {x:scalar(p.x,'x'),y:scalar(p.y,'y'),z:scalar(p.z,'z')};
}
const bossPosition=():SourceVector3=>({x:SOURCE_RAID_WORLD.bossPosition[0],y:SOURCE_RAID_WORLD.bossPosition[1],z:SOURCE_RAID_WORLD.bossPosition[2]});
/** Scene adapter over the original Raid sphere, NOT a Hunt capsule/pool.
 * Origins inside/on the sphere are excluded as for a Unity ray, unlike swept
 * bullets. Stable single collider means no invented target tie-break ordering.
 */
export function sourceRaidEnemyRaycast(boss:SourceRaidBossRuntime,origin:SourceVector3,direction:SourceVector3,maxDistance:number,mask:number):SourceHuntRayHit|null {
 const o=vector(origin),d=vector(direction),length=nonnegative(maxDistance,'ray length');
 if(!Number.isInteger(mask)||mask<-2147483648||mask>4294967295)throw RangeError('Invalid Raid Cat ray mask');
 if(!boss.current(boss.token())||!(mask&(1<<SOURCE_RAID_WORLD.layer))||length===0)return null;
 const magnitude=f(Math.sqrt(f(f(f(d.x*d.x)+f(d.y*d.y))+f(d.z*d.z))));
 if(magnitude<=f(.00001)||sourceRaidSphereSegmentEntry(o,o,0)!==null)return null;
 const end={x:f(o.x+f(f(d.x/magnitude)*length)),y:f(o.y+f(f(d.y/magnitude)*length)),z:f(o.z+f(f(d.z/magnitude)*length))};
 const t=sourceRaidSphereSegmentEntry(o,end,0);if(t===null)return null;
 return {token:boss.token(),colliderID:SOURCE_RAID_WORLD.colliderID,distance:f(t*length),transformPosition:bossPosition(),
  point:{x:f(o.x+f(f(end.x-o.x)*t)),y:f(o.y+f(f(end.y-o.y)*t)),z:f(o.z+f(f(end.z-o.z)*t))}};
}
export interface SourceRaidCatFollowSettings {
 /** Source Awake/random state, never silently replaced by an H5 seed. */
 readonly lagSeconds:number;readonly speedMultiplier:number;readonly attackDelayOffset:number;
 readonly fidgetInterval:number;readonly fidgetTimer:number;readonly fidgetOffset:SourceVector3;
 readonly ai:SourceRaidAIState;
}
export interface SourceRaidCat extends SourceRaidEquipmentBinding {
 movement:SourceHuntCatMovementState;target:SourceHuntCatTargetState;
 readonly attack:SourceHuntCatAttackRuntime;
 readonly sourceSettings:(typeof serialized.cats)[number]['values'];
 follow:SourceRaidCatFollowSettings|null;
 leaderAuto:SourceRaidLeaderAutoState;
}
export interface SourceRaidCatAdapter {
 readonly random:()=>number;readonly rangeInt:(min:number,maxExclusive:number)=>number;
 readonly project:SourceHuntViewportProjection;readonly raycast:SourceHuntRaycast;
 readonly movement:SourceHuntCatMovementAdapter;readonly camForward:SourceVector3;
 /** Required original Ray_trans.position and actual per-Cat socket mapping. */
 readonly rayOrigin:(cat:SourceRaidCat)=>SourceVector3;
 readonly transformWorld:(cat:SourceRaidCat,transformID:number)=>SourceVector3;
 readonly beforeAttack:(cat:SourceRaidCat,request:SourceHuntCatAttackRequest)=>void;
 /** Native manual yaw port, distinct from facing CamCorrection. */
 readonly rotateJoystick:(direction:SourceVector3)=>SourceVector3;
 readonly sampleFidget:(cat:SourceRaidCat)=>{interval:number;offset:SourceVector3};
 readonly afterCatUpdate?:(cat:SourceRaidCat,dt:number)=>void;
 readonly canAllocate?:()=>boolean;
}
export interface SourceRaidCatAttackEvent {
 readonly kind:'attack';readonly componentID:number;readonly critical:boolean;
 readonly start:SourceVector3;readonly damage:BigValue;readonly tokens:SourceHuntFlightToken[];
}
/** Native Reload retains the Enemy/collider object. H5 generations guard
 * projectile callbacks, not a Unity Object reference held by nearObj. Rebind
 * that SAME collider on reload without an invented .1s blind/attack delay.
 */
function resolveTarget(state:SourceHuntCatTargetState,host:SourceRaidBattleRuntime):SourceHuntCatTargetState {
 const hit=state.nearObj;
 if(!hit)return state;
 if(hit.token.id!==SOURCE_RAID_WORLD.enemyID||hit.colliderID!==SOURCE_RAID_WORLD.colliderID||!host.boss.current(host.boss.token()))return {...state,nearObj:null};
 return {...state,nearObj:{...hit,token:host.boss.token(),transformPosition:bossPosition()}};
}
function followSettings(settings:SourceRaidCatFollowSettings|undefined):SourceRaidCatFollowSettings {
 if(!settings)throw RangeError('Unresolved Raid Cat Awake/follow settings');
 const lagSeconds=nonnegative(settings.lagSeconds,'lag'),speedMultiplier=nonnegative(settings.speedMultiplier,'speed multiplier'),
  fidgetInterval=nonnegative(settings.fidgetInterval,'fidget interval'),fidgetTimer=nonnegative(settings.fidgetTimer,'fidget timer'),
  attackDelayOffset=nonnegative(settings.attackDelayOffset,'Start attack delay');
 if(speedMultiplier===0||fidgetInterval===0||!settings.ai||!Number.isInteger(settings.ai.state)||settings.ai.state<0||settings.ai.state>4)throw RangeError('Invalid Raid Cat follow settings');
 return {lagSeconds,speedMultiplier,fidgetInterval,fidgetTimer,attackDelayOffset,fidgetOffset:vector(settings.fidgetOffset),
  ai:{state:settings.ai.state,timer:nonnegative(settings.ai.timer,'AI timer')}};
}
export class SourceRaidCatRuntime {
 readonly cats:SourceRaidCat[];
 elapsedSeconds=0;
 private history:SourceLeaderHistorySample[]=[];
 private breadcrumbs:SourceVector3[]=[];
 private lastBreadcrumb:SourceVector3;
 private readonly stats:SourceRawMovementStatSlots;
 private readonly events:SourceRaidCatAttackEvent[]=[];
 private disposed=false;
 private readonly autoBossTransform={position:bossPosition()};
 constructor(readonly host:SourceRaidBattleRuntime,bundle:SourceMetaBundle,selection:SourceRaidSelection,
  movementStats:SourceRawMovementStatSlots,settings:ReadonlyMap<number,SourceRaidCatFollowSettings>) {
  for(const n of Object.values(movementStats))if(!Number.isInteger(n)||n<-2147483648||n>2147483647)throw RangeError('Unresolved Raid Cat raw movement stat');
  if(movementStats.slot5d5d4d0Static20===undefined||movementStats.slot5d5d4d8Static60===undefined)throw RangeError('Missing Raid Cat raw movement stat');
  this.stats={...movementStats};
  this.cats=bindSourceRaidEquipment(bundle,selection,host.weakType).map(binding=>{
   sourceHuntGunSockets(binding.componentID,binding.gun.gunNum);sourceBulletRadius(binding.gun.gunNum);
   if(SOURCE_BULLET_COLLIDERS.gunBindings[binding.gun.gunNum].gunType!==binding.gun.generation.type)throw RangeError('Raid Cat source gun/type mismatch');
   if(binding.cooldownSeconds<=0)throw RangeError('Nonpositive Raid Cat cooldown');
   const sourceSettings=serialized.cats.find(c=>c.componentID===binding.componentID)?.values;
   if(!sourceSettings)throw RangeError('Missing original Raid Cat serialized settings');
   const follow=binding.isAI?followSettings(settings.get(binding.componentID)):null,attack=new SourceHuntCatAttackRuntime();
   if(follow)attack.spread={...attack.spread,attackTimerSeconds:follow.attackDelayOffset};
   return {...binding,sourceSettings,movement:freshSourceHuntCatMovementState(binding.position),target:freshSourceHuntCatTargetState(),
    attack,leaderAuto:freshSourceRaidLeaderAutoState(),follow};
  });
  this.lastBreadcrumb={...this.cats[0].movement.position};
  for(const c of this.cats)if(sourceMoveSpeedFromRawStatSlots(c.isAI,this.stats)<0)throw RangeError('Negative Raid Cat movement speed');
 }
 drainEvents():SourceRaidCatAttackEvent[]{return this.events.splice(0);}
 advanceFrame(dt:number,input:SourceRaidClientFrame,adapter:SourceRaidCatAdapter):void {
  const delta=nonnegative(dt,'delta'),joy={x:scalar(input.joystick.x,'joystick x'),y:scalar(input.joystick.y,'joystick y')};
  if(this.disposed||!input.simulate||this.host.phase!=='running'||delta===0)return;
  // Validate required camera before any partial attack/clock mutation.
  const forward=vector(adapter.camForward);if(forward.y===0)throw RangeError('Unresolved Raid Cat camera forward');
  this.elapsedSeconds=f(this.elapsedSeconds+delta);
  const leader=this.cats[0];
  const recorded=sourceRecordBreadcrumb(this.breadcrumbs,this.lastBreadcrumb,leader.movement.position);
  this.breadcrumbs=recorded.history;this.lastBreadcrumb=recorded.lastRecordPosition;
  this.history=sourceRecordLeaderHistory(this.history,leader.movement.position,this.elapsedSeconds);
  const separated=sourceHuntComputeSeparation(this.cats.map(c=>({valid:c.active,isAI:c.isAI,position:c.movement.position,separationForce:c.movement.separationForce})));
  this.cats.forEach((c,i)=>c.movement={...c.movement,separationForce:separated[i].separationForce});
  for(const cat of this.cats){
   const origin=vector(adapter.rayOrigin(cat));
   cat.target=resolveTarget(sourceHuntCatRaycastFrame(cat.target,delta,origin,adapter.raycast,adapter.project,5),this.host);
   const target=cat.target.nearObj?.transformPosition??null;
   cat.attack.prepareFrame(delta,cat.cooldownSeconds,cat.gun.generation.type,!!target);
   const moveSpeed=sourceMoveSpeedFromRawStatSlots(cat.isAI,this.stats);
   if(cat.isAI){
    const follow=cat.follow!;
    const result=sourceRaidCatAIMovementFrame(cat.movement,follow.ai,{dt:delta,moveSpeed,speedMultiplier:follow.speedMultiplier,
     rayOrigin:origin,targetPosition:target,offScreenTargetPosition:null,mapCenter:zero(),breadcrumbs:this.breadcrumbs,
     leaderPosition:leader.movement.position,leaderTargetPosition:leader.target.nearObj?.transformPosition??null,
     nearHitPoint:cat.target.nearHitPoint,attackLength:SOURCE_HUNT_CAT_CONFIG.serialized.Attack_Length,
     autoStopDistance:cat.sourceSettings.AutoStopDistance,laggedLeaderPosition:sourceGetLaggedLeaderPosition(leader.movement.position,this.history,this.elapsedSeconds,follow.lagSeconds),
     formationOffset:cat.formationOffset,fidgetOffset:follow.fidgetOffset},adapter.movement,
     {minEnemyDist:cat.sourceSettings.MinEnemyDist,followIdealDist:cat.sourceSettings.FollowIdealDist,followMaxDist:cat.sourceSettings.FollowMaxDist,
      hysteresisMargin:cat.sourceSettings.HysteresisMargin,minStateDuration:cat.sourceSettings.MinStateDuration});
    cat.movement=result.movement;cat.follow={...follow,ai:result.ai};
    if(result.runFidget){
     const sampled=sourceFidgetTimerStep(follow.fidgetTimer,follow.fidgetInterval,delta,follow.fidgetOffset,()=>{
      const next=adapter.sampleFidget(cat),interval=nonnegative(next.interval,'sampled fidget interval');
      if(interval===0)throw RangeError('Zero sampled Raid Cat fidget interval');return {interval,offset:vector(next.offset)};
     });
     cat.follow={...cat.follow,fidgetTimer:sampled.timer,fidgetInterval:sampled.interval,fidgetOffset:sampled.offset};
    }
   }else {
    const result=sourceRaidLeaderMovementFrame(cat.movement,cat.leaderAuto,{dt:delta,joystick:input.acceptInput?joy:{x:0,y:0},moveSpeed,
     nearObjectPosition:target,nearHitPoint:cat.target.nearHitPoint},cat.sourceSettings,{...adapter.movement,
     rotateJoystick:adapter.rotateJoystick,findRaidBossTransform:()=>this.autoBossTransform});
    cat.movement=result.movement;cat.leaderAuto=result.auto;
    adapter.afterCatUpdate?.(cat,delta);
   }
   cat.attack.attackPreparedFrame(delta,cat.cooldownSeconds,cat.gun.generation.type,cat.target.nearObj,cat.target.nearHitPoint,request=>{
    if(!this.host.boss.current(request.target.token))return false;
    adapter.beforeAttack(cat,request);
    const start=sourceHuntGunFirePosition(sourceHuntGunSockets(cat.componentID,cat.gun.gunNum),forward,id=>adapter.transformWorld(cat,id),adapter.rangeInt);
    const shot=sourceBossShotDamage(cat.damage,adapter.random());
    const tokens=this.host.emit({gunNum:cat.gun.gunNum,generation:cat.gun.generation,damage:shot.damage,start,
     nearHitPoint:request.nearHitPoint,targetTransform:bossPosition(),camForward:forward,
     spreadDegrees:request.spreadDegrees,missileSpeed:cat.gun.missileSpeed,random:adapter.random,canAllocate:adapter.canAllocate});
    if(tokens.length)this.events.push({kind:'attack',componentID:cat.componentID,critical:shot.isCritical,start,damage:shot.damage,tokens});
    return tokens.length>0;
   });
   if(cat.isAI)adapter.afterCatUpdate?.(cat,delta);
  }
  // Explicit H5 integration, NOT PhysX; no mode4 radius14 constraint.
  for(const cat of this.cats){const p=vector(cat.movement.position),v=vector(cat.movement.bodyVelocity);
   cat.movement={...cat.movement,position:vector({x:f(p.x+f(v.x*delta)),y:f(p.y+f(v.y*delta)),z:f(p.z+f(v.z*delta))})};
  }
 }
 dispose():void {if(this.disposed)return;this.disposed=true;this.events.length=0;for(const c of this.cats){c.target=freshSourceHuntCatTargetState();c.leaderAuto=freshSourceRaidLeaderAutoState();c.attack.reset();}}
}
