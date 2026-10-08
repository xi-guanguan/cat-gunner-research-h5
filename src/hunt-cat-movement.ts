/** Cat.HandleAIMonster and movement bodies from source native + serialized data.
 * No guessed stat mapping, camera visibility, obstacle radius, auto-follow or
 * Euler integration is hidden in this module. Rigidbody/facing/Run are outputs.
 * See round6 hunt-cat-movement-contract.md for address and H5 adapter boundaries.
 */
import config from './data/hunt-cat-source.json';
import {sourceLerpVelocity,sourceGetBreadcrumbTarget,SOURCE_MOVEMENT_CONSTANTS,type SourceVector3} from './cat-movement-source';
import {sourceHuntClampCatRadius} from './hunt-cat-runtime';
export const SOURCE_HUNT_MOVE_PARAMETERS=Object.freeze({
 decelerationRange:config.serialized.DecelerationRange,minSpeedRatio:config.serialized.MinSpeedRatio,
 velocitySmoothSpeed:config.serialized.VelocitySmoothSpeed,obstacleLayerMask:config.serialized.ObstacleLayer,
 separationRadius:config.manager.SeparationRadius,separationStrength:config.manager.SeparationStrength,
 directionLengthGate:Math.fround(.001),directionSquaredGate:Math.fround(.0001),stopSquaredGate:Math.fround(.01),
 huntArrivalDistance:1,huntGoalSquaredGate:Math.fround(.001),radius:14,
});
const f=Math.fround,zero=():SourceVector3=>({x:0,y:0,z:0});
function number(v:number,label:string):number {if(!Number.isFinite(v)||!Number.isFinite(f(v)))throw new RangeError(`Invalid Hunt movement ${label}`);return f(v);}
function vector(v:SourceVector3):SourceVector3 {return {x:number(v.x,'x'),y:number(v.y,'y'),z:number(v.z,'z')};}
const sq=(v:SourceVector3)=>f(f(f(v.x*v.x)+f(v.y*v.y))+f(v.z*v.z));
const xzLength=(x:number,z:number)=>f(Math.sqrt(f(f(x*x)+f(z*z))));
const diff=(a:SourceVector3,b:SourceVector3):SourceVector3=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
export interface SourceHuntCatMovementState {
 readonly position:SourceVector3;readonly bodyVelocity:SourceVector3;readonly smoothVelocity:SourceVector3;
 readonly aiMoveDir:SourceVector3;readonly separationForce:SourceVector3;readonly running:boolean;readonly flipX:boolean;
}
export function freshSourceHuntCatMovementState(position:SourceVector3):SourceHuntCatMovementState {
 return {position:vector(position),bodyVelocity:zero(),smoothVelocity:zero(),aiMoveDir:zero(),separationForce:zero(),running:false,flipX:false};
}
export interface SourceHuntCatMovementAdapter {
 /** Cat.ScreenSpeedMultiplier consumes CamCorrection*direction. Required. */
 readonly screenSpeedMultiplier:(direction:SourceVector3)=>number;
 readonly correctDirection:(direction:SourceVector3)=>SourceVector3;
 /** Native query origin is Ray_trans.position, displacement is CAT -> goal XZ.
  * Host implements source physics query; no "all paths clear" default. */
 readonly pathClear:(origin:SourceVector3,direction:SourceVector3,length:number,mask:number)=>boolean;
}
export interface SourceHuntCatMoveFrame {
 readonly dt:number;readonly moveSpeed:number;readonly speedMultiplier:number;
 readonly rayOrigin:SourceVector3;readonly targetPosition:SourceVector3|null;
 readonly offScreenTargetPosition:SourceVector3|null;readonly mapCenter:SourceVector3;
 readonly breadcrumbs:readonly SourceVector3[];readonly leaderPosition?:SourceVector3;
}
export type SourceHuntCatMoveBranch='arrived'|'approach'|'tiny-stop'|'drift'|'drift-no-write';
export interface SourceHuntCatMoveResult {readonly state:SourceHuntCatMovementState;readonly branch:SourceHuntCatMoveBranch;readonly goal:SourceVector3;readonly usedBreadcrumb:boolean;readonly speedRatio:number}
function delta(v:number):number {const d=number(v,'dt');if(d<0)throw new RangeError('Negative Hunt movement dt');return d;}
function speed(v:number):number {const n=number(v,'speed');if(n<0)throw new RangeError('Negative Hunt movement speed');return n;}
function validateState(s:SourceHuntCatMovementState):void {vector(s.position);vector(s.bodyVelocity);vector(s.smoothVelocity);vector(s.aiMoveDir);vector(s.separationForce);}
function bodyXZ(s:SourceHuntCatMovementState,v:SourceVector3):SourceVector3 {return {x:v.x,y:s.bodyVelocity.y,z:v.z};}
/** SmoothStop: running=false only when post-Lerp 3D square < .01. */
export function sourceHuntCatSmoothStop(s:SourceHuntCatMovementState,dt:number):SourceHuntCatMovementState {
 validateState(s);let smooth=sourceLerpVelocity(s.smoothVelocity,zero(),delta(dt),SOURCE_HUNT_MOVE_PARAMETERS.velocitySmoothSpeed);
 const running=sq(smooth)>=SOURCE_HUNT_MOVE_PARAMETERS.stopSquaredGate;if(!running)smooth=zero();
 return {...s,smoothVelocity:smooth,bodyVelocity:bodyXZ(s,smooth),aiMoveDir:zero(),running};
}
/** ApplySeparationDrift: XZ square < .001 performs NO writes. The small
 * normalized Y passed to ScreenSpeedMultiplier at 0x2b40b70 is retained. */
export function sourceHuntCatSeparationDrift(s:SourceHuntCatMovementState,dt:number,moveSpeed:number,multiplier:number,adapter:Pick<SourceHuntCatMovementAdapter,'screenSpeedMultiplier'>):{state:SourceHuntCatMovementState;didWrite:boolean} {
 validateState(s);const d=delta(dt),m=speed(moveSpeed),k=speed(multiplier),force=vector(s.separationForce),lenSq=f(f(force.x*force.x)+f(force.z*force.z));
 if(lenSq<SOURCE_HUNT_MOVE_PARAMETERS.directionLengthGate)return {state:s,didWrite:false};
 const length=f(Math.sqrt(lenSq)),direction=length>f(.00001)
  ?{x:f(force.x/length),y:f(f(.00001)/length),z:f(force.z/length)}:zero();
 const screen=speed(adapter.screenSpeedMultiplier(direction));
 const target={x:f(screen*f(f(direction.x*m)*k)),y:0,z:f(screen*f(f(direction.z*m)*k))};
 const smooth=sourceLerpVelocity(s.smoothVelocity,target,d,SOURCE_HUNT_MOVE_PARAMETERS.velocitySmoothSpeed);
 return {state:{...s,smoothVelocity:smooth,bodyVelocity:bodyXZ(s,smooth),running:true},didWrite:true};
}
/** IsPathClear: CAT-goal XZ length < .01 skips the Ray_trans query. Native
 * normalized Y is zero / length. Mask129 represents obstacles, not Enemy640. */
export function sourceHuntCatPathClear(position:SourceVector3,goal:SourceVector3,rayOrigin:SourceVector3,adapter:Pick<SourceHuntCatMovementAdapter,'pathClear'>):boolean {
 const p=vector(position),g=vector(goal),o=vector(rayOrigin),dx=f(g.x-p.x),dz=f(g.z-p.z),length=xzLength(dx,dz);
 if(length<SOURCE_HUNT_MOVE_PARAMETERS.stopSquaredGate)return true;
 return adapter.pathClear(o,{x:f(dx/length),y:0,z:f(dz/length)},length,SOURCE_HUNT_MOVE_PARAMETERS.obstacleLayerMask);
}
function facing(state:SourceHuntCatMovementState,target:SourceVector3|null,direction:SourceVector3,adapter:SourceHuntCatMovementAdapter):boolean {
 const v=target?diff(target,state.position):direction;return vector(adapter.correctDirection(v)).x<=0;
}
/** SmoothMoveTowardWithAvoidance. No invented steering when path is blocked:
 * the source uses nearest breadcrumb+5, otherwise leader/current fallback. */
export function sourceHuntCatMoveToward(s:SourceHuntCatMovementState,goal:SourceVector3,frame:SourceHuntCatMoveFrame,adapter:SourceHuntCatMovementAdapter):SourceHuntCatMoveResult {
 validateState(s);const dt=delta(frame.dt),move=speed(frame.moveSpeed),multiplier=speed(frame.speedMultiplier);
 let g=vector(goal),usedBreadcrumb=false;
 if(!sourceHuntCatPathClear(s.position,g,frame.rayOrigin,adapter)){
  g=vector(sourceGetBreadcrumbTarget(s.position,frame.breadcrumbs,frame.leaderPosition));usedBreadcrumb=true;
 }
 const dx=f(g.x-s.position.x),dz=f(g.z-s.position.z),length=xzLength(dx,dz);
 const dir=length>SOURCE_HUNT_MOVE_PARAMETERS.directionLengthGate?{x:f(dx/length),y:0,z:f(dz/length)}:zero();
 if(sq(dir)<=SOURCE_HUNT_MOVE_PARAMETERS.directionSquaredGate){
  if(sq(s.separationForce)>SOURCE_HUNT_MOVE_PARAMETERS.stopSquaredGate){
   const drift=sourceHuntCatSeparationDrift(s,dt,move,.5,adapter);
   return {state:drift.state,branch:drift.didWrite?'drift':'drift-no-write',goal:g,usedBreadcrumb,speedRatio:0};
  }
  return {state:sourceHuntCatSmoothStop(s,dt),branch:'tiny-stop',goal:g,usedBreadcrumb,speedRatio:0};
 }
 let ratio=1;const range=SOURCE_HUNT_MOVE_PARAMETERS.decelerationRange;
 if(range>0&&length<range){
  const t=Math.max(0,Math.min(1,f(length/range))),smooth=f(f(f(3*t)*t)-f(f(t*f(t+t))*t));
  ratio=f(smooth+f(f(1-smooth)*SOURCE_HUNT_MOVE_PARAMETERS.minSpeedRatio));
 }
 const screen=speed(adapter.screenSpeedMultiplier(dir)),magnitude=f(f(f(move*multiplier)*ratio)*screen);
 const velocity={x:f(f(dir.x*magnitude)+f(s.separationForce.x*move)),y:0,z:f(f(dir.z*magnitude)+f(s.separationForce.z*move))};
 const smooth=sourceLerpVelocity(s.smoothVelocity,velocity,dt,SOURCE_HUNT_MOVE_PARAMETERS.velocitySmoothSpeed);
 return {state:{...s,smoothVelocity:smooth,bodyVelocity:bodyXZ(s,smooth),aiMoveDir:dir,running:true,flipX:facing(s,frame.targetPosition,dir,adapter)},branch:'approach',goal:g,usedBreadcrumb,speedRatio:ratio};
}
/** HandleAIMonster goal chooses LIVE transform before cached off-screen position.
 * Goal radius14 is distinct from rb radius clamp; arrival forcibly zeros rbXZ
 * after SmoothStop but retains the private smooth velocity until it decays. */
export function sourceHuntCatAIMovementFrame(s:SourceHuntCatMovementState,frame:SourceHuntCatMoveFrame,adapter:SourceHuntCatMovementAdapter):SourceHuntCatMoveResult {
 validateState(s);delta(frame.dt);speed(frame.moveSpeed);speed(frame.speedMultiplier);
 const center=vector(frame.mapCenter),raw=frame.targetPosition??frame.offScreenTargetPosition;
 let goal={x:center.x,y:s.position.y,z:center.z};
 if(raw){const r=vector(raw),dx=f(r.x-center.x),dz=f(r.z-center.z),q=f(f(dx*dx)+f(dz*dz));
  if(q>SOURCE_HUNT_MOVE_PARAMETERS.huntGoalSquaredGate){const d=f(Math.sqrt(q));goal={x:f(center.x+f(f(dx/d)*14)),y:s.position.y,z:f(center.z+f(f(dz/d)*14))};}
 }
 let result:SourceHuntCatMoveResult;
 if(xzLength(f(goal.x-s.position.x),f(goal.z-s.position.z))<SOURCE_HUNT_MOVE_PARAMETERS.huntArrivalDistance){
  let stopped=sourceHuntCatSmoothStop(s,frame.dt);stopped={...stopped,bodyVelocity:{x:0,y:s.bodyVelocity.y,z:0},running:false,
   flipX:raw&&frame.targetPosition?facing(s,frame.targetPosition,zero(),adapter):stopped.flipX};
  result={state:stopped,branch:'arrived',goal,usedBreadcrumb:false,speedRatio:0};
 }else result=sourceHuntCatMoveToward(s,goal,frame,adapter);
 const clamped=sourceHuntClampCatRadius(result.state.position,result.state.bodyVelocity,center);
 return {...result,state:{...result.state,position:clamped.position,bodyVelocity:clamped.velocity}};
}
export interface SourceHuntSeparationParticipant {readonly valid:boolean;readonly isAI:boolean;readonly position:SourceVector3;readonly separationForce:SourceVector3}
/** Cat_list order followed by active helper. Null/invalid objects still count
 * toward source array length; <2 returns without clearing any force. No ID sort. */
export function sourceHuntComputeSeparation<T extends SourceHuntSeparationParticipant>(ordered:readonly T[],radius=SOURCE_HUNT_MOVE_PARAMETERS.separationRadius,strength=SOURCE_HUNT_MOVE_PARAMETERS.separationStrength):T[] {
 const r=speed(radius),k=speed(strength);if(r===0)throw new RangeError('Zero separation radius');
 for(const cat of ordered){vector(cat.position);vector(cat.separationForce);}
 if(ordered.length<2)return [...ordered];
 const next=ordered.map(cat=>cat.valid&&cat.isAI?{...cat,separationForce:zero()}:cat);
 for(let i=0;i<next.length;i++)for(let j=i+1;j<next.length;j++){
  const a=next[i],b=next[j];if(!a.valid||!b.valid)continue;
  const dx=f(a.position.x-b.position.x),dz=f(a.position.z-b.position.z),d=xzLength(dx,dz);
  if(d<SOURCE_HUNT_MOVE_PARAMETERS.directionLengthGate||d>r)continue;
  const weight=f(f(1-f(d/r))*k),x=f(f(dx/d)*weight),z=f(f(dz/d)*weight);
  if(a.isAI)next[i]={...a,separationForce:{x:f(x+a.separationForce.x),y:a.separationForce.y,z:f(z+a.separationForce.z)}};
  if(b.isAI)next[j]={...b,separationForce:{x:f(b.separationForce.x-x),y:b.separationForce.y,z:f(b.separationForce.z-z)}};
 }return next;
}
/** Leader HandleMovement: supplied original joystick, no auto movement policy.
 * Host supplies the native yaw rotation (radians confirmed in camera evidence). */
export function sourceHuntLeaderVelocity(joystick:{x:number;y:number},moveSpeed:number,bodyY:number,rotateJoystick:(v:SourceVector3)=>SourceVector3,squaredThreshold=f(.0001)):SourceVector3 {
 const x=number(joystick.x,'joystick.x'),y=number(joystick.y,'joystick.y'),m=speed(moveSpeed),vy=number(bodyY,'bodyY'),gate=speed(squaredThreshold);
 if(f(f(x*x)+f(y*y))<=gate)return {x:0,y:vy,z:0};
 const rotated=vector(rotateJoystick({x:f(x/SOURCE_MOVEMENT_CONSTANTS.screenK),y:0,z:f(y*SOURCE_MOVEMENT_CONSTANTS.screenK)}));
 return {x:f(rotated.x*m),y:vy,z:f(rotated.z*m)};
}
