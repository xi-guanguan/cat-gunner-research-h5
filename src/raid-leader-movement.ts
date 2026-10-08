/** Cat.Update / HandleAutoMove(mode5) / ClearAutoTarget / HandleMovement.
 * Native addresses and binary32 literals: raid-leader-extract.json and
 * raid-scene-cat-native.txt. Camera ports remain explicit; no radius14 clamp,
 * position integration, target ray, attack clock, host clock or wallet writes.
 */
import {SOURCE_MOVEMENT_CONSTANTS,sourceOrdinaryAutoApproach,sourceLerpVelocity,sourceAutoSmoothStop,type SourceVector3} from './cat-movement-source';
import {sourceHuntLeaderVelocity,type SourceHuntCatMovementState} from './hunt-cat-movement';
import source from './data/raid-leader-source.json';
export const SOURCE_RAID_LEADER_CONSTANTS=Object.freeze(source.constants);
const f=Math.fround,zero=():SourceVector3=>({x:0,y:0,z:0});
const sq=(v:SourceVector3)=>f(f(f(v.x*v.x)+f(v.y*v.y))+f(v.z*v.z));
const diff=(a:SourceVector3,b:SourceVector3):SourceVector3=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
function scalar(v:number):number {if(!Number.isFinite(v)||!Number.isFinite(f(v)))throw RangeError('Invalid Raid leader scalar');return f(v);}
function positive(v:number):number {const n=scalar(v);if(n<0)throw RangeError('Negative Raid leader parameter');return n;}
function vector(v:SourceVector3):SourceVector3 {return {x:scalar(v.x),y:scalar(v.y),z:scalar(v.z)};}
/** Unity Transform reference, not Enemy projectile-generation token. Reload
 * keeps this object; its live position is read even between search ticks. */
export interface SourceRaidLeaderTarget {readonly position:SourceVector3}
export interface SourceRaidLeaderAutoState {readonly searchTimer:number;readonly target:SourceRaidLeaderTarget|null}
export const freshSourceRaidLeaderAutoState=():SourceRaidLeaderAutoState=>({searchTimer:0,target:null});
export interface SourceRaidLeaderParameters {
 readonly AutoMove:boolean;readonly AutoSearchInterval:number;readonly AutoStopDistance:number;
 readonly AutoZOffsetMax:number;readonly AutoZOffsetMinDist:number;readonly AutoZOffsetFullDist:number;
 readonly AutoDecelerationRange:number;readonly MinEnemyDist:number;
}
export interface SourceRaidLeaderFrame {
 readonly dt:number;readonly moveSpeed:number;readonly joystick:{x:number;y:number};
 readonly nearObjectPosition:SourceVector3|null;readonly nearHitPoint:SourceVector3;
}
export interface SourceRaidLeaderCamera {
 readonly correctDirection:(v:SourceVector3)=>SourceVector3;
 readonly screenSpeedMultiplier:(v:SourceVector3)=>number;
 /** HandleMovement uses its separately constructed yaw quaternion, NOT the
  * CamCorrection quaternion used by facing/ScreenSpeedMultiplier. */
 readonly rotateJoystick:(v:SourceVector3)=>SourceVector3;
 readonly findRaidBossTransform:()=>SourceRaidLeaderTarget|null;
}
export type SourceRaidLeaderBranch='manual'|'manual-stop'|'no-target'|'approach'|'tiny-direction'|'retreat'|'auto-stop';
export function sourceRaidLeaderMovementFrame(
 state:SourceHuntCatMovementState,auto:SourceRaidLeaderAutoState,input:SourceRaidLeaderFrame,
 p:SourceRaidLeaderParameters,camera:SourceRaidLeaderCamera,
):{movement:SourceHuntCatMovementState;auto:SourceRaidLeaderAutoState;branch:SourceRaidLeaderBranch} {
 const dt=positive(input.dt),speed=positive(input.moveSpeed),x=scalar(input.joystick.x),y=scalar(input.joystick.y);
 const position=vector(state.position),body=vector(state.bodyVelocity),smooth=vector(state.smoothVelocity);
 const near=input.nearObjectPosition?vector(input.nearObjectPosition):null,hit=vector(input.nearHitPoint);
 for(const n of [p.AutoSearchInterval,p.AutoStopDistance,p.AutoZOffsetMinDist,p.AutoZOffsetFullDist,p.AutoDecelerationRange,p.MinEnemyDist])positive(n);
 scalar(p.AutoZOffsetMax);positive(auto.searchTimer);
 if(typeof p.AutoMove!=='boolean'||!camera.rotateJoystick||!camera.correctDirection||!camera.screenSpeedMultiplier||!camera.findRaidBossTransform)throw RangeError('Unresolved Raid leader camera/parameters');
 const face=(v:SourceVector3)=>vector(camera.correctDirection(v)).x<=0;
 const joystickSquared=f(f(x*x)+f(y*y)),gate=SOURCE_RAID_LEADER_CONSTANTS.joystickSquared;
 if(!p.AutoMove||joystickSquared>=gate){
  // ClearAutoTarget only clears smoothVelocity when full sq is STRICTLY >.001.
  const cleared=sq(smooth)>SOURCE_RAID_LEADER_CONSTANTS.awayFallbackSquared?zero():smooth;
  const running=joystickSquared>gate;
  const flipX=near?face(diff(near,position)):running?x<=0:state.flipX;
  return {auto:freshSourceRaidLeaderAutoState(),branch:running?'manual':'manual-stop',
   movement:{...state,smoothVelocity:cleared,bodyVelocity:sourceHuntLeaderVelocity({x,y},speed,body.y,camera.rotateJoystick),running,flipX}};
 }
 let nextAuto:SourceRaidLeaderAutoState={...auto,searchTimer:f(f(auto.searchTimer)+dt)};
 if(nextAuto.searchTimer>=f(p.AutoSearchInterval)||!auto.target){
  nextAuto={searchTimer:0,target:camera.findRaidBossTransform()}; // one lookup, no catchup
 }
 const stop=(branch:SourceRaidLeaderBranch,raw?:SourceVector3)=>{
  const next=sourceAutoSmoothStop(smooth,dt);
  return {auto:nextAuto,branch,movement:{...state,smoothVelocity:next,bodyVelocity:{x:next.x,y:body.y,z:next.z},running:false,
   flipX:raw?face(diff(near??{...raw,y:position.y},position)):state.flipX}};
 };
 if(!nextAuto.target)return stop('no-target'); // native early exit, no guessed facing
 const raw=vector(nextAuto.target.position),ref=near?hit:raw;
 const approach=sourceOrdinaryAutoApproach(position,raw,ref,5,{stopDistance:f(p.AutoStopDistance),zOffsetMax:f(p.AutoZOffsetMax),
  zOffsetMinDist:f(p.AutoZOffsetMinDist),zOffsetFullDist:f(p.AutoZOffsetFullDist),decelerationRange:f(p.AutoDecelerationRange)});
 const move=(dir:SourceVector3,ratio:number,facing:SourceVector3,branch:SourceRaidLeaderBranch)=>{
  const scale=positive(camera.screenSpeedMultiplier(dir));
  // Native multiplies direction*speed, then ratio, then screen scale.
  const desired={x:f(scale*f(ratio*f(dir.x*speed))),y:0,z:f(scale*f(ratio*f(dir.z*speed)))};
  const next=sourceLerpVelocity(smooth,desired,dt,SOURCE_MOVEMENT_CONSTANTS.autoSmoothSpeed);
  return {auto:nextAuto,branch,movement:{...state,smoothVelocity:next,bodyVelocity:{x:next.x,y:body.y,z:next.z},running:true,flipX:face(facing)}};
 };
 if(approach.kind==='tiny-direction')return stop('tiny-direction',raw);
 if(approach.kind==='approach')return move(approach.direction,approach.speedRatio,near?diff(near,position):approach.direction,'approach');
 if(approach.referenceDistance>=f(p.MinEnemyDist)||!near)return stop('auto-stop',raw);
 let away=diff(position,hit);
 if(sq(away)<SOURCE_RAID_LEADER_CONSTANTS.awayFallbackSquared)away={x:1,y:0,z:0};
 const magnitude=f(Math.sqrt(sq(away)));
 away=magnitude>SOURCE_RAID_LEADER_CONSTANTS.normalizeMagnitude?{x:f(away.x/magnitude),y:f(away.y/magnitude),z:f(away.z/magnitude)}:zero();
 const radius=f(f(p.MinEnemyDist)+f(.5));
 const goal={x:f(hit.x+f(away.x*radius)),y:0,z:f(hit.z+f(away.z*radius))};
 const dx=f(goal.x-position.x),dz=f(goal.z-position.z),length=f(Math.sqrt(f(f(dx*dx)+f(dz*dz))));
 // 0x106c094 is .05, NOT .1 (inherited handoff assumption corrected by bytes).
 if(length<=SOURCE_RAID_LEADER_CONSTANTS.retreatArrival)return stop('auto-stop',raw);
 return move({x:f(dx/length),y:0,z:f(dz/length)},1,away,'retreat');
}
