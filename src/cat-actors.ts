import type { Point, Target, State, TickInput } from './rules';
import type { RuleConfig } from './config';
import type { SourceCatSpreadState } from './gun-projectiles';
import ordinaryValues from './data/ordinary-values.json';
import { fieldToWorld, FIELD_UNITS_PER_POINT, worldToField } from './field-space';
import {
  sourceAutoSmoothStop, sourceFindNearestTreeByGrid, sourceLerpVelocity,
  sourceOrdinaryAutoApproach, sourceMoveSpeedFromRawStatSlots,
  sourceScreenSpeedMultiplierFromCorrectedDirection,
  sourceRecordBreadcrumb, sourceGetBreadcrumbTarget,
  sourceRecordLeaderHistory, sourceGetLaggedLeaderPosition, sourceFormationOffset, sourceFollowTarget,
  sourceFollowDistancePolicy, sourceNearFollowAction, sourceFidgetTimerStep,
  SOURCE_LEVEL0_FOLLOW_PARAMETERS, SOURCE_FOLLOW_CONSTANTS,
  type SourceLeaderHistorySample, type SourceVector3, type SourceMovementPhysicsInputs,
} from './cat-movement-source';

/** Explicit defaults while business stat types are awaiting metadata binding. */
export const DEFAULT_MOVEMENT_STAT_SLOTS = Object.freeze({ slot5d5d4d0Static20: 100, slot5d5d4d8Static60: 0 });
export const CAT_ACTOR_MOVEMENT_EVIDENCE = Object.freeze({
  ordinaryApproach: 'native-static .2 minimum; defaults16/-8/3/20',
  gridSelection: 'native-static grid bounds/score; source prefab anchors and cell order',
  stop: 'native-static square speed<.01; within-stop retreat remains candidate stop',
  physics: 'candidate geometry adapter; native Physics query not replayed',
  aiFormation: 'source level0 ring with explicit H5 candidate slot binding: H5 slot1=136809,slot2=136808; special136810 unmapped',
  follow: 'source history/lag/strict near7.5/fidget ordering; H5 deterministic RNG and geometry adapters',
  breadcrumbs: 'native-static .5 record distance,100 cap,nearest+5 target',
  movementStatModifiers: 'unmapped business types; explicit raw defaults100/0',
});

export interface CatActor {
  id: number; role: 'player' | 'companion'; position: Point; velocity: Point;
  autoTargetId: number | null; aimTargetId: number | null; searchTimer: number;
  aim: Point; breadcrumbs: Point[]; breadcrumbLastRecordPosition?: Point;
  movementPhysics?: SourceMovementPhysicsInputs;
  attackState?: SourceCatSpreadState;
  leaderHistory?: SourceLeaderHistorySample[];
  followState?: H5FollowState;
}
/** Explicit H5 binding; special manager Cat 136810 has no H5 slot. */
export const H5_FOLLOW_SOURCE_BINDING = Object.freeze({ 0:147400, 1:136809, 2:136808 });
export interface H5FollowState {
  sourceCatPathID: number | null;
  lagSeconds: number; speedMultiplier: number; attackDelayOffset: number;
  fidgetInterval: number; fidgetTimer: number; rngState: number;
  formationOffset: SourceVector3; fidgetOffset: SourceVector3;
  separationForce: SourceVector3;
}
function h5FollowRandom01(state: {rngState:number}): number {
  state.rngState=(Math.imul(state.rngState,1664525)+1013904223)>>>0;
  return state.rngState/0x100000000;
}
export function makeH5FollowState(slot:number): H5FollowState {
  const rng={rngState:(0xf0110 ^ slot)>>>0};
  const range=(a:number,b:number)=>Math.fround(a+(b-a)*h5FollowRandom01(rng));
  const k=SOURCE_FOLLOW_CONSTANTS;
  const lagSeconds=range(k.lagSecondsMin,k.lagSecondsMax);
  const speedMultiplier=range(k.speedMultiplierMin,k.speedMultiplierMax);
  const fidgetInterval=range(k.fidgetIntervalMin,k.fidgetIntervalMax);
  const attackDelayOffset=range(k.attackDelayOffsetMin,k.attackDelayOffsetMax);
  return {sourceCatPathID:slot===1?136809:slot===2?136808:null,
    lagSeconds,speedMultiplier,fidgetInterval,attackDelayOffset,fidgetTimer:0,rngState:rng.rngState,
    formationOffset:slot===1||slot===2?sourceFormationOffset(slot-1,2,2.5):{x:0,y:0,z:0},
    fidgetOffset:{x:0,y:0,z:0},separationForce:{x:0,y:0,z:0}};
}
/** H5 geometry adapter; native public SeparationForce producer is unresolved. */
function h5GeometrySeparation(actor:CatActor, actors:CatActor[], scale:Point): SourceVector3 {
  const force={x:0,y:0,z:0};
  for(const other of actors) if(other.id!==actor.id) {
    const away=delta(other.position,actor.position,scale);
    if(away.distance<3) {force.x+=away.x*(3-away.distance)*3;force.z+=away.y*(3-away.distance)*3;}
  }
  return force;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function worldDistance(a: Point, b: Point, scale: Point): number {
  return Math.hypot((a.x-b.x)*scale.x, (a.y-b.y)*scale.y);
}
export function makeActor(id: number, position: Point): CatActor {
  return { id, role: id ? 'companion' : 'player', position: {...position}, velocity: {x:0,y:0},
    autoTargetId:null, aimTargetId:null, searchTimer:0.3, aim:{x:1,y:0}, breadcrumbs:[] };
}
function closest(position: Point, targets: Target[], scale: Point): Target | undefined {
  let result: Target | undefined, best = Infinity;
  for (const target of targets) {
    const d = worldDistance(position, target.position, scale);
    if (d < best || d === best && target.id < (result?.id ?? Infinity)) { best=d; result=target; }
  }
  return result;
}
function delta(a: Point, b: Point, scale: Point) {
  const x=(b.x-a.x)*scale.x, y=(b.y-a.y)*scale.y, d=Math.hypot(x,y);
  return {x:d ? x/d : 0, y:d ? y/d : 0, distance:d};
}
const asVelocity3 = (p: Point): SourceVector3 => ({x:p.x,y:0,z:p.y});
const asPoint = (v: SourceVector3): Point => ({x:v.x,y:v.z});
function nativePosition(point: Point, scale: Point, field: boolean): SourceVector3 {
  if (field) { const world=fieldToWorld(point); return {x:Math.fround(world.x),y:0,z:Math.fround(world.z)}; }
  return {x:Math.fround(point.x*scale.x),y:0,z:Math.fround(point.y*scale.y)};
}
/** CamCorrection input .7853981852531433 radians in .cctor.
 * H5 yaw adapter supplies the corrected direction; original Unity quaternion
 * output has no runtime capture yet. Source scalar function is consumed below.
 */
function screenSpeed(direction: Point) {
  const angle=0.7853981852531433, c=Math.cos(angle), s=Math.sin(angle);
  return sourceScreenSpeedMultiplierFromCorrectedDirection({
    x:Math.fround(direction.x*c+direction.y*s), y:0,
    z:Math.fround(-direction.x*s+direction.y*c),
  });
}
function smooth(actor: CatActor, wanted: Point, dt: number) {
  actor.velocity=asPoint(sourceLerpVelocity(asVelocity3(actor.velocity),asVelocity3(wanted),dt));
}
function smoothStop(actor: CatActor, dt: number) {
  actor.velocity=asPoint(sourceAutoSmoothStop(asVelocity3(actor.velocity),dt));
}
/** Restore original tree_refs cell traversal from source prefab grid anchors.
 * Spawn jitter is bounded +/-1.5, so nearest5-unit cell recovers pool index.
 * A target outside that source cell lattice retains its input order as adapter.
 */
export function ordinaryActorGridPools(state: State, available: Target[]) {
  return ordinaryValues.tree_grids.entries.map(entry => {
    const anchor=entry.tree_list_anchor.world_translation;
    const cellOrder=(target:Target) => {
      const world=fieldToWorld(target.position);
      const col=Math.round((world.x-anchor[0])/5),row=Math.round((world.z-anchor[2])/5);
      return col>=0 && col<10 && row>=0 && row<10 ? row*10+col : Infinity;
    };
    const ordered=available.filter(t=>!t.boss && t.grid===entry.index)
      .map((target,index)=>({target,index,cell:cellOrder(target)}))
      .sort((a,b)=>a.cell-b.cell || a.index-b.index);
    return { active:entry.index<=state.level,z:entry.grid_anchor.world_translation[2],
      trees:ordered.map(({target})=>({value:target,position:nativePosition(target.position,state.worldUnitsPerPoint,true),eligible:target.health>0})) };
  });
}
function candidateCanTraverse(from: Point, to: Point, trees: Target[], scale: Point): boolean {
  const vx=(to.x-from.x)*scale.x, vy=(to.y-from.y)*scale.y, length=vx*vx+vy*vy;
  return trees.every(tree => {
    const dx=(tree.position.x-from.x)*scale.x, dy=(tree.position.y-from.y)*scale.y;
    const t=length ? clamp((dx*vx+dy*vy)/length,0,1):0;
    return Math.hypot(dx-t*vx,dy-t*vy) > 1.5;
  });
}
/** Separate player/AI paths. AI collision radius/formation remain H5 adapters pending native physics replay. */
export function advanceActors(state: State, dt: number, input: TickInput, c: RuleConfig, gunSlots: number[]): CatActor[] {
  const scale=state.worldUnitsPerPoint;
  const movementStatSlots={slot5d5d4d0Static20:state.combatModifiers?.petMoveSpeedPercent??100,slot5d5d4d8Static60:state.combatModifiers?.relicMoveSpeedValue??0};
  const ordinaryField=state.targets.some(t=>t.grid!==undefined) && scale.x===FIELD_UNITS_PER_POINT.x && scale.y===FIELD_UNITS_PER_POINT.y;
  const live=state.targets.filter(t=>t.health>0);
  const batch=state.targetBatchSize;
  const batchIndex=batch&&live.length ? Math.floor((live[0].id-1)/batch):0;
  const available=live.filter(t=>!batch || Math.floor((t.id-1)/batch)===batchIndex);
  const prior=state.actors ?? [];
  const actors=gunSlots.map(id=> {
    const old=prior.find(a=>a.id===id) ?? makeActor(id,{x:state.player.x-id*0.5,y:state.player.y-id*0.4});
    return {...old, position:id ? {...old.position}:{...state.player}, velocity:{...old.velocity},
      aim:{...old.aim}, breadcrumbs:old.breadcrumbs.map(p=>({...p})),
      breadcrumbLastRecordPosition:old.breadcrumbLastRecordPosition ? {...old.breadcrumbLastRecordPosition}:undefined,
      movementPhysics:old.movementPhysics ? {...old.movementPhysics, nearHitPoint:old.movementPhysics.nearHitPoint ? {...old.movementPhysics.nearHitPoint}:undefined}:undefined,
      attackState:old.attackState ? {...old.attackState}:undefined,
      leaderHistory:old.leaderHistory?.map(sample=>({...sample,position:{...sample.position}})),
      followState:old.followState ? {...old.followState,formationOffset:{...old.followState.formationOffset},
        fidgetOffset:{...old.followState.fidgetOffset},separationForce:{...old.followState.separationForce}} : id ? makeH5FollowState(id):undefined};
  });
  const manual=(input.moveX??0)**2+(input.moveY??0)**2 >= 0.0001;
  const player=actors.find(actor=>actor.id===0) ?? actors[0];
  if(!player) return actors;
  // Source non-AI Update records before motion, using the current frame clock.
  player.leaderHistory=sourceRecordLeaderHistory(player.leaderHistory??[],nativePosition(player.position,scale,ordinaryField),state.elapsed);
  for (const actor of actors) {
    actor.searchTimer+=dt;
    const valid=available.find(t=>t.id===actor.autoTargetId);
    if (!valid || actor.searchTimer>=0.3) {
      if (ordinaryField) {
        const extra=available.find(t=>t.boss);
        const selected=sourceFindNearestTreeByGrid(nativePosition(actor.position,scale,true),ordinaryActorGridPools(state,available),state.level,
          extra ? {value:extra,position:nativePosition(extra.position,scale,true),eligible:true}:undefined);
        actor.autoTargetId=selected?.id ?? null;
      } else actor.autoTargetId=closest(actor.position,available,scale)?.id ?? null;
      actor.searchTimer=0;
    }
    const attackRange=state.autoMove ? 40 : c.player.attackRange;
    let aimed=available.find(t=>t.id===actor.aimTargetId && worldDistance(actor.position,t.position,scale)<=attackRange);
    if (!aimed || actor.searchTimer===0) aimed=closest(actor.position,
      available.filter(t=>worldDistance(actor.position,t.position,scale)<=attackRange),scale);
    actor.aimTargetId=aimed?.id ?? null;
    if (aimed) { const d=delta(actor.position,aimed.position,scale); actor.aim={x:d.x,y:d.y}; }
    if (!actor.id) {
      if (manual) {
        actor.autoTargetId=null;
        const speed=sourceMoveSpeedFromRawStatSlots(false,movementStatSlots);
        actor.velocity=state.autoMove ? {x:(input.moveX??0)*speed,y:(input.moveY??0)*speed}
          : {x:(input.moveX??0)*c.player.speed,y:(input.moveY??0)*c.player.speed};
      } else if (state.autoMove) {
        const destination=available.find(t=>t.id===actor.autoTargetId);
        if (!destination) smoothStop(actor,dt);
        else if (ordinaryField) {
          const origin=nativePosition(actor.position,scale,true), rawTarget=nativePosition(destination.position,scale,true);
          const physics=actor.movementPhysics;
          const reference=physics?.nearObjectExists && physics.nearHitPoint ? physics.nearHitPoint : rawTarget;
          const approach=sourceOrdinaryAutoApproach(origin,rawTarget,reference,0);
          if (approach.kind!=='approach') {
            // Native inside-stop retreat/locked-target branches are unresolved.
            // Explicit candidate behavior for that boundary: smooth stop.
            smoothStop(actor,dt);
          } else {
            const direction=asPoint(approach.direction);
            const speed=sourceMoveSpeedFromRawStatSlots(false,movementStatSlots)*screenSpeed(direction)*approach.speedRatio;
            smooth(actor,{x:direction.x*speed,y:direction.y*speed},dt);
          }
        } else {
          // Challenge movement remains a candidate adapter (no ordinary grid source).
          const d=delta(actor.position,destination.position,scale);
          if (d.distance<=state.autoStopWorldDistance) smoothStop(actor,dt);
          else {
            const u=clamp((d.distance-state.autoStopWorldDistance)/2,0,1), easing=u*u*(3-2*u);
            const speed=sourceMoveSpeedFromRawStatSlots(false,movementStatSlots)*screenSpeed(d)*(0.2+0.8*easing);
            smooth(actor,{x:d.x*speed,y:d.y*speed},dt);
          }
        }
      } else actor.velocity={x:0,y:0};
    } else {
      const follow=actor.followState!;
      actor.breadcrumbs=player.breadcrumbs.map(p=>({...p}));
      const lagged=sourceGetLaggedLeaderPosition(nativePosition(player.position,scale,ordinaryField),
        player.leaderHistory??[],state.elapsed,follow.lagSeconds);
      const target=sourceFollowTarget(lagged,follow.formationOffset,follow.fidgetOffset);
      const policy=sourceFollowDistancePolicy(nativePosition(actor.position,scale,ordinaryField),target,
        {idealDistance:SOURCE_LEVEL0_FOLLOW_PARAMETERS.followIdealDist});
      follow.separationForce=h5GeometrySeparation(actor,actors,scale);
      if(policy.kind==='near') {
        // Source confirms the SmoothStop call, not its body: H5 reuses AutoSmoothStop adapter.
        if(sourceNearFollowAction(follow.separationForce)==='smooth-stop') smoothStop(actor,dt);
        else actor.velocity=asPoint({x:follow.separationForce.x*.3,y:0,z:follow.separationForce.z*.3});
        // Source invokes AIFidget only after the near movement decision.
        const fidget=sourceFidgetTimerStep(follow.fidgetTimer,follow.fidgetInterval,dt,follow.fidgetOffset,()=>{
          const k=SOURCE_FOLLOW_CONSTANTS;
          const interval=k.fidgetIntervalMin+(k.fidgetIntervalMax-k.fidgetIntervalMin)*h5FollowRandom01(follow);
          const angle=h5FollowRandom01(follow)*Math.PI*2;
          const radius=k.fidgetRadiusMin+(k.fidgetRadiusMax-k.fidgetRadiusMin)*h5FollowRandom01(follow);
          return {interval,offset:{x:Math.cos(angle)*radius,y:0,z:Math.sin(angle)*radius}};
        });
        follow.fidgetTimer=fidget.timer;follow.fidgetInterval=fidget.interval;follow.fidgetOffset={...fidget.offset};
      } else {
        // H5 SmoothMoveTowardWithAvoidance geometry adapter, not Unity Physics replay.
        let destination=ordinaryField ? worldToField(target.x,target.z):{x:target.x/scale.x,y:target.z/scale.y};
        if(!candidateCanTraverse(actor.position,destination,live,scale)) {
          const breadcrumb=sourceGetBreadcrumbTarget(nativePosition(actor.position,scale,ordinaryField),
            player.breadcrumbs.map(p=>nativePosition(p,scale,ordinaryField)),nativePosition(player.position,scale,ordinaryField));
          destination=ordinaryField ? worldToField(breadcrumb.x,breadcrumb.z):{x:breadcrumb.x/scale.x,y:breadcrumb.z/scale.y};
        }
        const d=delta(actor.position,destination,scale);
        const speed=sourceMoveSpeedFromRawStatSlots(true,movementStatSlots)*follow.speedMultiplier;
        const desired={x:d.x*speed,y:d.y*speed};
        const next={x:actor.position.x+desired.x*dt/scale.x,y:actor.position.y+desired.y*dt/scale.y};
        if(!candidateCanTraverse(actor.position,next,live,scale)) {
          const tangent=[{x:-desired.y,y:desired.x},{x:desired.y,y:-desired.x}].find(v=>
            candidateCanTraverse(actor.position,{x:actor.position.x+v.x*dt/scale.x,y:actor.position.y+v.y*dt/scale.y},live,scale));
          desired.x=tangent?.x??0;desired.y=tangent?.y??0;
        }
        smooth(actor,desired,dt);
      }
    }
    actor.position.x=clamp(actor.position.x+actor.velocity.x*dt/(state.autoMove?scale.x:1),c.player.radius,c.arena.width-c.player.radius);
    actor.position.y=clamp(actor.position.y+actor.velocity.y*dt/(state.autoMove?scale.y:1),c.player.radius,c.arena.height-c.player.radius);
    if (!actor.id) {
      const last=actor.breadcrumbLastRecordPosition ? nativePosition(actor.breadcrumbLastRecordPosition,scale,ordinaryField) : {x:0,y:0,z:0};
      const record=sourceRecordBreadcrumb(actor.breadcrumbs.map(p=>nativePosition(p,scale,ordinaryField)),last,nativePosition(actor.position,scale,ordinaryField));
      const point=(v:SourceVector3)=>ordinaryField ? worldToField(v.x,v.z) : {x:v.x/scale.x,y:v.z/scale.y};
      actor.breadcrumbs=record.history.map(point);
      actor.breadcrumbLastRecordPosition=point(record.lastRecordPosition);
    }
  }
  return actors;
}
