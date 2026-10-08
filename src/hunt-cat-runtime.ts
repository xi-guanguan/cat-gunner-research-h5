/** Source Cat Hunt targeting and attack clocks. Host supplies camera, actual
 * weapon sockets and physics queries; there is deliberately no always-visible
 * camera, invented muzzle, DPS damage or wallet mutation here.
 * Native/serialized provenance: round6 hunt-cat-projection-* / hunt-cat-source.
 */
import source from './data/hunt-cat-source.json';
import {sourceHuntCapsuleSegmentEntry,SOURCE_HUNT_MONSTER_CONFIG,SourceHuntMonsterRuntime,type SourceHuntMonsterToken} from './hunt-monster-runtime';
import type {SourceVector3} from './cat-movement-source';
import {sourceCatSpreadState,sourceCatSpreadBeforeAttack,sourceCatAttackTick,sourceCatAttackResult,
 type SourceCatSpreadState,SourceGunType} from './gun-projectiles';
export const SOURCE_HUNT_CAT_CONFIG=source;
const f=Math.fround;
export const SOURCE_HUNT_CAT_CONSTANTS=Object.freeze({
 screenMargin:f(.02),directionSquaredGate:f(.0001),normalizeGate:f(.00001),radius:14,bulletPlaneY:2,
 degreesToRadians:f(Math.PI/180),
});
const spreadConfig=Object.freeze({minDegrees:source.serialized.SpreadAngleMin,maxDegrees:source.serialized.SpreadAngleMax,
 growthRate:source.serialized.SpreadGrowthRate,decayMultiplier:source.serialized.SpreadDecayMultiplier});
function scalar(n:number,name:string):number {if(!Number.isFinite(n)||!Number.isFinite(f(n)))throw new RangeError(`Invalid Cat ${name}`);return f(n);}
function vector(p:SourceVector3):SourceVector3 {return {x:scalar(p.x,'x'),y:scalar(p.y,'y'),z:scalar(p.z,'z')};}
export interface SourceHuntRayHit {
 readonly colliderID:number;
 readonly token:SourceHuntMonsterToken;
 readonly point:SourceVector3;
 /** Collider Transform.position, NOT hit point or sprite center. */
 readonly transformPosition:SourceVector3;
 readonly distance:number;
}
export type SourceHuntRaycast=(origin:SourceVector3,direction:SourceVector3,distance:number,mask:number)=>SourceHuntRayHit|null;
/** Null explicitly means no camera exists (native IsOnScreen returns true).
 * A present camera must return viewport XYZ, with Z being forward depth. */
export type SourceHuntViewportProjection=(world:SourceVector3)=>SourceVector3|null;
export function sourceHuntIsOnScreen(world:SourceVector3,project:SourceHuntViewportProjection,margin=SOURCE_HUNT_CAT_CONSTANTS.screenMargin):boolean {
 const m=scalar(margin,'screen margin');if(m<0)throw new RangeError('Negative Cat screen margin');
 const viewport=project(vector(world));if(viewport===null)return true;
 const p=vector(viewport);return p.z>0&&p.x>=f(-m)&&p.x<=f(1+m)&&p.y>=f(-m)&&p.y<=f(1+m);
}
/** Analytic H5 ray adapter over real source capsules. Stable pool order resolves
 * ties; it is NOT PhysX ordering. Unity raycasts exclude an origin contained in
 * a collider: unlike bullet swept overlap, such capsules must be skipped here.
 * Only the Hunt Monster layer is provided; other masked layers require a host
 * scene query, rather than silently treating layer7 as another Monster pool. */
export function sourceHuntMonsterRaycast(runtime:SourceHuntMonsterRuntime,origin:SourceVector3,direction:SourceVector3,maxDistance:number,mask:number):SourceHuntRayHit|null {
 const o=vector(origin),d=vector(direction),length=scalar(maxDistance,'ray length');
 if(length<0||!Number.isInteger(mask)||mask<-2147483648||mask>4294967295)throw new RangeError('Invalid Cat ray query');
 if(runtime.phase!=='running'||!(mask&(1<<SOURCE_HUNT_MONSTER_CONFIG.colliderFilter.monsterLayer))||length===0)return null;
 const norm=f(Math.sqrt(f(f(f(d.x*d.x)+f(d.y*d.y))+f(d.z*d.z))));if(norm<=SOURCE_HUNT_CAT_CONSTANTS.normalizeGate)return null;
 const end=vector({x:o.x+f(f(d.x/norm)*length),y:o.y+f(f(d.y/norm)*length),z:o.z+f(f(d.z/norm)*length)});
 let best:SourceHuntRayHit|null=null;
 for(const monster of runtime.activeMonsters()){
  // Closed boundary exclusion is an explicit H5 choice; exact PhysX skin NOT_RUN.
  if(sourceHuntCapsuleSegmentEntry(o,o,monster.position,0)!==null)continue;
  const t=sourceHuntCapsuleSegmentEntry(o,end,monster.position,0);if(t===null)continue;
  const distance=f(t*length);if(best&&distance>=best.distance)continue;
  best={token:runtime.token(monster),colliderID:monster.colliderID,distance,transformPosition:{...monster.position},
   point:vector({x:o.x+f(f(end.x-o.x)*t),y:o.y+f(f(end.y-o.y)*t),z:o.z+f(f(end.z-o.z)*t)})};
 }return best;
}
export interface SourceHuntCatTargetState {
 readonly rayTimerSeconds:number;
 readonly nearObj:SourceHuntRayHit|null;
 readonly nearHitPoint:SourceVector3;
 readonly hasOffScreenMonster:boolean;
 readonly offScreenMonsterPosition:SourceVector3;
}
export function freshSourceHuntCatTargetState():SourceHuntCatTargetState {
 return {rayTimerSeconds:0,nearObj:null,nearHitPoint:{x:0,y:0,z:0},hasOffScreenMonster:false,offScreenMonsterPosition:{x:0,y:0,z:0}};
}
/** Native strict < distance and ray iteration order. One first hit per ray;
 * rejecting an offscreen first collider NEVER reveals a farther visible one. */
export function sourceHuntFindNearestEnemy(state:SourceHuntCatTargetState,origin:SourceVector3,raycast:SourceHuntRaycast,project:SourceHuntViewportProjection,uiMode=4):SourceHuntCatTargetState {
 const o=vector(origin);let nearObj:SourceHuntRayHit|null=null,nearHitPoint=state.nearHitPoint,
  offScreenMonsterPosition=state.offScreenMonsterPosition,hasOffScreenMonster=false,best=Infinity,offBest=Infinity;
 const step=f(360/source.serialized.RayCount);
 for(let i=0;i<source.serialized.RayCount;i++){
  const angle=f(f(step*i)*SOURCE_HUNT_CAT_CONSTANTS.degreesToRadians);
  const direction={x:f(Math.sin(angle)),y:0,z:f(Math.cos(angle))};
  const hit=raycast(o,direction,source.serialized.Attack_Length,source.serialized.EnemyLayer);if(!hit)continue;
  const distance=scalar(hit.distance,'hit distance');if(distance<0||distance>source.serialized.Attack_Length)throw new RangeError('Cat ray hit outside query');
  const transform=vector(hit.transformPosition),point=vector(hit.point);
  if(sourceHuntIsOnScreen(transform,project)){if(distance<best){best=distance;nearObj={...hit,distance,point,transformPosition:transform};nearHitPoint=point;}}
  else if(uiMode===4&&distance<offBest){offBest=distance;offScreenMonsterPosition=transform;hasOffScreenMonster=true;}
 }
 return {...state,nearObj,nearHitPoint,offScreenMonsterPosition,hasOffScreenMonster};
}
/** Add dt, then at most one query and reset to ZERO (no catch-up/remainder). */
export function sourceHuntCatRaycastFrame(state:SourceHuntCatTargetState,dt:number,origin:SourceVector3,raycast:SourceHuntRaycast,project:SourceHuntViewportProjection,uiMode=4):SourceHuntCatTargetState {
 const delta=scalar(dt,'ray delta');if(delta<0)throw new RangeError('Negative Cat ray delta');
 const timer=f(scalar(state.rayTimerSeconds,'ray timer')+delta);
 return timer<source.serialized.Raycast_Cool_Max?{...state,rayTimerSeconds:timer}:
  {...sourceHuntFindNearestEnemy(state,origin,raycast,project,uiMode),rayTimerSeconds:0};
}
/** CalcBulletSpawnPos / GetFirePosition. A real muzzle world Transform and
 * Cat.CamForward are REQUIRED. Reject a horizontal forward vector rather than
 * concealing an unresolved camera with a made-up socket. */
export function sourceHuntCatBulletSpawnPosition(muzzle:SourceVector3,camForward:SourceVector3):SourceVector3 {
 const p=vector(muzzle),c=vector(camForward);if(c.y===0)throw new RangeError('Cat CamForward cannot project to bullet plane');
 const k=f(f(SOURCE_HUNT_CAT_CONSTANTS.bulletPlaneY-p.y)/c.y);
 return vector({x:f(p.x+f(k*c.x)),y:SOURCE_HUNT_CAT_CONSTANTS.bulletPlaneY,z:f(p.z+f(k*c.z))});
}
export function sourceHuntCatBulletDirection(start:SourceVector3,target:SourceVector3,camForward:SourceVector3):SourceVector3 {
 const a=vector(start),b=vector(target),fallback=vector(camForward),dx=f(b.x-a.x),dz=f(b.z-a.z),sq=f(f(dx*dx)+f(dz*dz));
 if(sq<=SOURCE_HUNT_CAT_CONSTANTS.directionSquaredGate)return fallback;
 const d=f(Math.sqrt(sq));return d>SOURCE_HUNT_CAT_CONSTANTS.normalizeGate?{x:f(dx/d),y:0,z:f(dz/d)}:{x:0,y:0,z:0};
}
/** ClampToMonsterRadius: XZ distance>=14 clamps position and removes only
 * outward XZ velocity. Y position/velocity survives; inward/tangent survives. */
export function sourceHuntClampCatRadius(position:SourceVector3,velocity:SourceVector3,mapCenter:SourceVector3):{position:SourceVector3;velocity:SourceVector3;clamped:boolean} {
 const p=vector(position),v=vector(velocity),c=vector(mapCenter),dx=f(p.x-c.x),dz=f(p.z-c.z),d=f(Math.sqrt(f(f(dx*dx)+f(dz*dz))));
 if(d<SOURCE_HUNT_CAT_CONSTANTS.radius)return {position:p,velocity:v,clamped:false};
 const nx=f(dx/d),nz=f(dz/d),out=f(f(nx*v.x)+f(nz*v.z));
 return {position:{x:f(c.x+f(nx*14)),y:p.y,z:f(c.z+f(nz*14))},
  velocity:out>0?{x:f(v.x-f(nx*out)),y:v.y,z:f(v.z-f(nz*out))}:v,clamped:true};
}
export interface SourceHuntCatAttackRequest {readonly target:SourceHuntRayHit;readonly nearHitPoint:SourceVector3;readonly spreadDegrees:number}
/** Host calls this AFTER ray/target resolution and BEFORE/AFTER its source
 * movement as appropriate. Target still needs generation/alive validation.
 * Emission callback owns gun sockets, damage/critical choice and pool requests. */
export class SourceHuntCatAttackRuntime {
 spread:SourceCatSpreadState=sourceCatSpreadState();
 advanceFrame(dt:number,cooldownSeconds:number,type:SourceGunType,target:SourceHuntRayHit|null,nearHitPoint:SourceVector3,emit:(request:SourceHuntCatAttackRequest)=>boolean):boolean {
  const delta=scalar(dt,'attack delta'),cooldown=scalar(cooldownSeconds,'attack cooldown');
  if(delta<0||cooldown<=0||!Number.isInteger(type)||type<0||type>6)throw new RangeError('Invalid Cat attack frame');
  this.prepareFrame(delta,cooldown,type,!!target);
  return this.attackPreparedFrame(delta,cooldown,type,target,nearHitPoint,emit);
 }
 /** Source UpdateSpreadState occurs before movement; attack clock afterward. */
 prepareFrame(dt:number,cooldownSeconds:number,type:SourceGunType,hasTarget:boolean):void {
  const delta=scalar(dt,'spread delta'),cooldown=scalar(cooldownSeconds,'spread cooldown');
  if(delta<0||cooldown<=0||!Number.isInteger(type)||type<0||type>6)throw new RangeError('Invalid Cat spread frame');
  this.spread=sourceCatSpreadBeforeAttack(this.spread,hasTarget,delta,cooldown,spreadConfig);
 }
 attackPreparedFrame(dt:number,cooldownSeconds:number,type:SourceGunType,target:SourceHuntRayHit|null,nearHitPoint:SourceVector3,emit:(request:SourceHuntCatAttackRequest)=>boolean):boolean {
  const delta=scalar(dt,'attack delta'),cooldown=scalar(cooldownSeconds,'attack cooldown');
  if(delta<0||cooldown<=0||!Number.isInteger(type)||type<0||type>6)throw new RangeError('Invalid Cat attack frame');
  const tick=sourceCatAttackTick(this.spread,!!target,delta,cooldown);this.spread=tick.state;
  if(!tick.attemptAttack||!target)return false;
  const succeeded=emit({target,nearHitPoint:vector(nearHitPoint),spreadDegrees:this.spread.spreadAngleDegrees});
  this.spread=sourceCatAttackResult(this.spread,type,succeeded,delta,cooldown,spreadConfig);return succeeded;
 }
 reset():void {this.spread=sourceCatSpreadState();}
}
