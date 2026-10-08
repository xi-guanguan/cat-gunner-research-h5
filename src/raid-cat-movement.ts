/** Ordinary Cat.HandleAI path for UI5. Common native SmoothStop/MoveToward/
 * SeparationDrift bodies are reused; Hunt radius14 AI is NOT used.
 * Native GetApproachPosition falls back to Vector3.right (static+0x3c), NOT
 * forward; EvaluateDesiredState/AIAssist share literal .85, NOT .8.
 * Evidence: raid-ai-extract.json + raid-scene-cat-native.txt.
 * Physics, live targets, lagged leader and random fidget are explicit inputs.
 */
import source from './data/raid-ai-source.json';
import {sourceAdoptAIState,sourceEvaluateDesiredAIState,sourceFollowTarget,sourceFollowDistancePolicy,
 SOURCE_LEVEL0_FOLLOW_PARAMETERS as defaults,SOURCE_FOLLOW_CONSTANTS,type SourceAIState,type SourceVector3} from './cat-movement-source';
import {sourceHuntCatMoveToward as moveToward,sourceHuntCatSmoothStop as smoothStop,sourceHuntCatSeparationDrift as drift,
 type SourceHuntCatMovementState,type SourceHuntCatMoveFrame,type SourceHuntCatMovementAdapter} from './hunt-cat-movement';
const f=Math.fround,zero=():SourceVector3=>({x:0,y:0,z:0});
export const SOURCE_RAID_AI=Object.freeze(source.constants);
function scalar(n:number,label:string):number {if(!Number.isFinite(n)||!Number.isFinite(f(n)))throw RangeError(`Invalid Raid AI ${label}`);return f(n);}
function nonnegative(n:number,label:string):number {const v=scalar(n,label);if(v<0)throw RangeError(`Negative Raid AI ${label}`);return v;}
function vector(p:SourceVector3):SourceVector3 {if(!p)throw RangeError('Missing Raid AI position');return {x:scalar(p.x,'x'),y:scalar(p.y,'y'),z:scalar(p.z,'z')};}
const sq=(p:SourceVector3)=>f(f(f(p.x*p.x)+f(p.y*p.y))+f(p.z*p.z));
const subtract=(a:SourceVector3,b:SourceVector3):SourceVector3=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
export function sourceRaidAIDistance(a:SourceVector3,b:SourceVector3):number {return f(Math.sqrt(sq(subtract(vector(a),vector(b)))));}
function normalize(p:SourceVector3):SourceVector3 {const mag=f(Math.sqrt(sq(p)));return mag>SOURCE_RAID_AI.normalizeMagnitude?{x:f(p.x/mag),y:f(p.y/mag),z:f(p.z/mag)}:zero();}
/** Cat.GetApproachPosition 0x2b4091c: current-target XZ, target's Y retained. */
export function sourceRaidApproachPosition(current:SourceVector3,target:SourceVector3,radius:number):SourceVector3 {
 const c=vector(current),t=vector(target),r=nonnegative(radius,'radius');
 let direction={x:f(c.x-t.x),y:0,z:f(c.z-t.z)};
 if(sq(direction)<SOURCE_RAID_AI.approachFallbackSquared)direction={x:source.fallbackVector[0],y:source.fallbackVector[1],z:source.fallbackVector[2]};
 const n=normalize(direction);return {x:f(t.x+f(n.x*r)),y:f(t.y+f(n.y*r)),z:f(t.z+f(n.z*r))};
}
export interface SourceRaidAIState {readonly state:SourceAIState;readonly timer:number}
export interface SourceRaidAIParameters {
 readonly minEnemyDist:number;readonly followIdealDist:number;readonly followMaxDist:number;
 readonly hysteresisMargin:number;readonly minStateDuration:number;
}
export const SOURCE_RAID_AI_PARAMETERS:SourceRaidAIParameters=Object.freeze({minEnemyDist:defaults.minEnemyDist,
 followIdealDist:defaults.followIdealDist,followMaxDist:defaults.followMaxDist,hysteresisMargin:defaults.hysteresisMargin,minStateDuration:defaults.minStateDuration});
export interface SourceRaidAIFrame extends SourceHuntCatMoveFrame {
 readonly leaderPosition:SourceVector3;readonly leaderTargetPosition:SourceVector3|null;
 readonly nearHitPoint:SourceVector3;readonly autoStopDistance:number;readonly attackLength:number;
 readonly laggedLeaderPosition:SourceVector3;readonly formationOffset:SourceVector3;readonly fidgetOffset:SourceVector3;
}
export interface SourceRaidAIMoveResult {
 readonly movement:SourceHuntCatMovementState;readonly ai:SourceRaidAIState;readonly desiredState:SourceAIState;
 readonly action:'no-target'|'stop'|'drift'|'drift-no-write'|'move';readonly goal:SourceVector3|null;
 readonly usedBreadcrumb:boolean;readonly runFidget:boolean;
}
/** Hysteresis adoption precedes dispatch; no integration or attack clock here. */
export function sourceRaidCatAIMovementFrame(movement:SourceHuntCatMovementState,ai:SourceRaidAIState,frame:SourceRaidAIFrame,
 adapter:SourceHuntCatMovementAdapter,parameters:SourceRaidAIParameters=SOURCE_RAID_AI_PARAMETERS):SourceRaidAIMoveResult {
 const dt=nonnegative(frame.dt,'dt'),position=vector(movement.position),leader=vector(frame.leaderPosition),near=vector(frame.nearHitPoint);
 if(!Number.isInteger(ai.state)||ai.state<0||ai.state>4)throw RangeError('Invalid Raid AI state');nonnegative(ai.timer,'state timer');
 for(const [k,v]of Object.entries(parameters))nonnegative(v,k);
 nonnegative(frame.moveSpeed,'move speed');nonnegative(frame.speedMultiplier,'speed multiplier');
 const stopRadius=nonnegative(frame.autoStopDistance,'stop distance'),attackLength=nonnegative(frame.attackLength,'attack length');
 const target=frame.targetPosition?vector(frame.targetPosition):null,leaderTarget=frame.leaderTargetPosition?vector(frame.leaderTargetPosition):null;
 const desiredState=sourceEvaluateDesiredAIState({currentState:ai.state,leaderDistance:sourceRaidAIDistance(position,leader),followMaxDist:parameters.followMaxDist,
  targetExists:!!target,leaderTargetExists:!!leaderTarget,distanceToNearHitPoint:sourceRaidAIDistance(position,near),minEnemyDist:parameters.minEnemyDist,
  autoStopDistance:stopRadius,hysteresisMargin:parameters.hysteresisMargin,
  desiredPositionDistanceToLeader:target?sourceRaidAIDistance(sourceRaidApproachPosition(position,target,f(attackLength*SOURCE_RAID_AI.assistRadiusRatio)),leader):0});
 const adopted=sourceAdoptAIState(ai.state,desiredState,ai.timer,dt,parameters.minStateDuration),nextAI={state:adopted.state as SourceAIState,timer:adopted.timer};
 const result=(state:SourceHuntCatMovementState,action:SourceRaidAIMoveResult['action'],goal:SourceVector3|null=null,usedBreadcrumb=false,runFidget=false):SourceRaidAIMoveResult=>
  ({movement:state,ai:nextAI,desiredState,action,goal,usedBreadcrumb,runFidget});
 const stop=(goal:SourceVector3|null=null,runFidget=false)=>result(smoothStop(movement,dt),'stop',goal,false,runFidget);
 const move=(goal:SourceVector3)=>{const r=moveToward(movement,goal,frame,adapter);return result(r.state,r.branch==='approach'?'move':r.branch==='tiny-stop'?'stop':r.branch==='drift'?'drift':'drift-no-write',r.goal,r.usedBreadcrumb);};
 const face=(r:SourceRaidAIMoveResult)=>target?{...r,movement:{...r.movement,flipX:vector(adapter.correctDirection(subtract(target,position))).x<=0}}:r;
 const separate=(multiplier:number,goal:SourceVector3|null=null,runFidget=false)=>{const r=drift(movement,dt,frame.moveSpeed,multiplier,adapter);return result(r.state,r.didWrite?'drift':'drift-no-write',goal,false,runFidget);};
 switch(nextAI.state){
  case 0:{
   const goal=sourceFollowTarget(vector(frame.laggedLeaderPosition),vector(frame.formationOffset),vector(frame.fidgetOffset));
   if(sourceFollowDistancePolicy(position,goal,{idealDistance:parameters.followIdealDist}).kind==='near'){
    if(sq(vector(movement.separationForce))>SOURCE_RAID_AI.nearFollowSeparationSquared)return face(separate(SOURCE_FOLLOW_CONSTANTS.nearSeparationDriftScale,goal,true));
    return face(stop(goal,true));
   }return face(move(goal));
  }
  case 1:{if(!target)return result(movement,'no-target');const goal=sourceRaidApproachPosition(position,near,stopRadius);return sourceRaidAIDistance(position,goal)<.5?stop(goal):move(goal);}
  case 2:{
   let r=sq(vector(movement.separationForce))>SOURCE_RAID_AI.attackStaySeparationSquared?separate(SOURCE_RAID_AI.attackStayDriftMultiplier):stop();
   // AIAttackStay updates target-facing even after SmoothStop/drift.
   if(target)r={...r,movement:{...r.movement,flipX:vector(adapter.correctDirection(subtract(target,position))).x<=0}};
   return r;
  }
  case 3:{if(!target)return result(movement,'no-target');return move(sourceRaidApproachPosition(position,near,f(parameters.minEnemyDist+.5)));}
  case 4:{
   if(!leaderTarget)return stop();let goal=sourceRaidApproachPosition(position,leaderTarget,stopRadius);
   const radius=f(parameters.followMaxDist*SOURCE_RAID_AI.assistRadiusRatio);
   if(sourceRaidAIDistance(goal,leader)>radius){
    const n=normalize(subtract(goal,leader)); // source multiplies maxDist THEN .85
    goal={x:f(leader.x+f(f(n.x*parameters.followMaxDist)*SOURCE_RAID_AI.assistRadiusRatio)),
     y:f(leader.y+f(f(n.y*parameters.followMaxDist)*SOURCE_RAID_AI.assistRadiusRatio)),z:f(leader.z+f(f(n.z*parameters.followMaxDist)*SOURCE_RAID_AI.assistRadiusRatio))};
   }return sourceRaidAIDistance(position,goal)<.5?stop(goal):move(goal);
  }
 }
}
