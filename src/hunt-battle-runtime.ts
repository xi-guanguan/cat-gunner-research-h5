/** Real projectile Hunt host, separate from ordinary/Boss rules.tick.
 * Native policies are composed, NOT converted into DPS/teamPower damage.
 * Frame/physics/query/PRNG ordering is explicitly H5; PhysX parity NOT_RUN.
 * Host owns assets, camera, original rig socket transforms, wallet/save bridge.
 * Nothing here opens production entry or reads/writes localStorage.
 */
import {BigValue,type BigValueInput} from './big-value';
import {SourceGunType,type SourceGunGenerationConfig} from './gun-projectiles';
import {sourceBossCooldown,sourceBossDamageStats,sourceBossShotDamage,type SourceBossTeamModifiers,type SourceBossDamageStats} from './r5-boss';
import {sourceHuntEnter,sourceHuntLevelClear,sourceHuntInvade,sourceHuntGiveUp,sourceHuntExit,sourceHuntBonus,freshSourceHuntState,
 type SourceHuntState,type SourceHuntEntitlements,type SourceHuntResult} from './r5-hunt';
import {sourceRecordBreadcrumb,sourceMoveSpeedFromRawStatSlots,type SourceVector3,type SourceRawMovementStatSlots} from './cat-movement-source';
import {SOURCE_HUNT_CAT_CONFIG,freshSourceHuntCatTargetState,sourceHuntCatRaycastFrame,sourceHuntClampCatRadius,SourceHuntCatAttackRuntime,
 type SourceHuntCatTargetState,type SourceHuntRaycast,type SourceHuntViewportProjection,type SourceHuntCatAttackRequest} from './hunt-cat-runtime';
import {freshSourceHuntCatMovementState,sourceHuntCatAIMovementFrame,sourceHuntLeaderVelocity,sourceHuntComputeSeparation,
 type SourceHuntCatMovementState,type SourceHuntCatMovementAdapter} from './hunt-cat-movement';
import {SOURCE_CAT_JOYSTICK_YAW_H5,sourceCatRotateVector} from './source-cat-quaternion';
import {sourceHuntGunSockets,sourceHuntGunFirePosition} from './hunt-gun-sockets';
import {SourceHuntMonsterRuntime,sourceHuntBarrierContact,type SourceHuntMonsterEvent} from './hunt-monster-runtime';
import {SourceHuntProjectileFlightRuntime,sourceHuntEmitGun,type SourceHuntFlightEvent,type SourceHuntFlightToken} from './hunt-projectile-flight';
import {sourceBulletRadius,SOURCE_BULLET_COLLIDERS} from './source-bullet-colliders';
const f=Math.fround,zero=():SourceVector3=>({x:0,y:0,z:0});
export const SOURCE_HUNT_HOST_WAITS=Object.freeze({enterSeconds:2,nextLevelSeconds:2,exitFieldSeconds:f(1.5),exitMaskSeconds:f(.2)});
export const SOURCE_HUNT_HOST_CENTER=Object.freeze({x:-100,y:0,z:0});
export type SourceHuntBattlePhase='idle'|'enter-loading'|'playing'|'next-level-wait'|'ended'|'exit-field-wait'|'exit-mask-wait'|'disposed';
export interface SourceHuntBattleGun {readonly gunNum:number;readonly generation:SourceGunGenerationConfig;readonly baseDamage:BigValueInput;readonly baseIntervalSeconds:number;readonly missileSpeed:number;readonly starLevel:number}
export interface SourceHuntBattleCatInput {
 readonly componentID:number;readonly active:boolean;
 /** Explicit source SlotNum, NOT serialized -1 or guessed Cat array position. */
 readonly slotNum:number;readonly position:SourceVector3;readonly gun:SourceHuntBattleGun;
}
export interface SourceHuntBattleCat extends SourceHuntBattleCatInput {
 readonly isAI:boolean;movement:SourceHuntCatMovementState;target:SourceHuntCatTargetState;
 readonly damage:SourceBossDamageStats;readonly cooldownSeconds:number;readonly attack:SourceHuntCatAttackRuntime;
}
export interface SourceHuntBattleAdapter {
 readonly aspect:number;readonly random:()=>number;readonly rangeInt:(min:number,maxExclusive:number)=>number;
 readonly project:SourceHuntViewportProjection;readonly raycast:SourceHuntRaycast;readonly movement:SourceHuntCatMovementAdapter;
 /** Live Ray_trans world position, never sprite center. */
 readonly rayOrigin:(cat:SourceHuntBattleCat)=>SourceVector3;
 /** Cat.Attack calls FaceTowardEnemy before reading a socket. Host must update
  * the source rig pose here. It must NOT advance animation a second time. */
 readonly beforeAttack:(cat:SourceHuntBattleCat,request:SourceHuntCatAttackRequest)=>void;
 /** Original Cat-specific transform IDs. A canonical render rig maps explicitly. */
 readonly transformWorld:(cat:SourceHuntBattleCat,transformID:number)=>SourceVector3;
 readonly camForward:SourceVector3;
 readonly afterCatUpdate?:(cat:SourceHuntBattleCat,dt:number)=>void;
 readonly canAllocate?:()=>boolean;
}
export interface SourceHuntBattleFrameInput {readonly joystick:{x:number;y:number};readonly resourcesReady:boolean;readonly simulate:boolean;readonly acceptInput:boolean}
export type SourceHuntBattleEvent=
 {kind:'monster';event:SourceHuntMonsterEvent}|{kind:'projectile';event:SourceHuntFlightEvent}|
 {kind:'attack';componentID:number;critical:boolean;tokens:SourceHuntFlightToken[];start:SourceVector3;damage:BigValue}|
 {kind:'settlement';requestID:string;action:'enter'|'level-clear'|'invasion'|'give-up'|'exit'|'bonus';result:Extract<SourceHuntResult,{status:'supported'}>}|
 {kind:'phase';phase:SourceHuntBattlePhase}|{kind:'restore-field'};
function scalar(n:number,label:string):number {if(!Number.isFinite(n)||!Number.isFinite(f(n)))throw new RangeError(`Invalid Hunt host ${label}`);return f(n);}
function vector(p:SourceVector3):SourceVector3 {return {x:scalar(p.x,'x'),y:scalar(p.y,'y'),z:scalar(p.z,'z')};}
function copyState(s:SourceHuntState):SourceHuntState{return {...s,run:s.run?{...s.run}:null};}
export class SourceHuntBattleRuntime {
 readonly monsters=new SourceHuntMonsterRuntime();readonly projectiles=new SourceHuntProjectileFlightRuntime();readonly cats:SourceHuntBattleCat[];
 phase:SourceHuntBattlePhase='idle';waitSeconds=0;elapsedSeconds=0;petCoinGranted=0;
 private progress:SourceHuntState;private readonly events:SourceHuntBattleEvent[]=[];private sequence=0;
 private breadcrumbs:SourceVector3[]=[];private lastBreadcrumb:SourceVector3;
 constructor(readonly runID:string,initial:SourceHuntState,inputs:readonly SourceHuntBattleCatInput[],readonly entitlements:SourceHuntEntitlements,
  modifiers:SourceBossTeamModifiers,readonly movementStats:SourceRawMovementStatSlots){
  if(!runID||inputs.length>4)throw new RangeError('Invalid Hunt host run/cat list');
  // Reuse source validation without entering or granting resources.
  const probe=sourceHuntEnter(copyState(initial),entitlements);if(probe.status==='unsupported')throw new Error(probe.reason);
  this.progress=copyState(initial);const order=SOURCE_HUNT_CAT_CONFIG.manager.Cat_list.map(p=>p.pathID) as number[];
  order.push(SOURCE_HUNT_CAT_CONFIG.manager.Helper_Cat.pathID);
  const seen=new Set<number>();
  this.cats=inputs.map(input=>{
   const source=SOURCE_HUNT_CAT_CONFIG.cats.find(c=>c.componentID===input.componentID);
   if(!source||seen.has(input.componentID)||!Number.isInteger(input.slotNum)||input.slotNum<0||input.slotNum>2)throw new RangeError('Invalid Hunt Cat/SlotNum');
   seen.add(input.componentID);const gun=input.gun;sourceHuntGunSockets(input.componentID,gun.gunNum);sourceBulletRadius(gun.gunNum);
   if(SOURCE_BULLET_COLLIDERS.gunBindings[gun.gunNum].gunType!==gun.generation.type)throw new RangeError('Hunt host gun/type mismatch');
   const missile=scalar(gun.missileSpeed,'missile speed');if(missile<0)throw new RangeError('Negative missile speed');
   const cooldownSeconds=sourceBossCooldown({...modifiers,baseIntervalSeconds:gun.baseIntervalSeconds});
   if(cooldownSeconds<=0)throw new RangeError('Nonpositive Hunt cooldown');
   return {...input,gun:{...gun,generation:{...gun.generation}},position:vector(input.position),isAI:source.isAI,
    movement:freshSourceHuntCatMovementState(input.position),target:freshSourceHuntCatTargetState(),damage:sourceBossDamageStats({...modifiers,baseDamage:gun.baseDamage,starLevel:gun.starLevel}),cooldownSeconds,attack:new SourceHuntCatAttackRuntime()};
  }).sort((a,b)=>order.indexOf(a.componentID)-order.indexOf(b.componentID));
  if(this.cats.filter(c=>c.active&&!c.isAI).length!==1)throw new RangeError('Hunt requires one active leader');
  this.lastBreadcrumb={...this.cats.find(c=>c.active&&!c.isAI)!.movement.position};
  for(const c of this.cats)sourceMoveSpeedFromRawStatSlots(c.isAI,movementStats);
 }
 get state():SourceHuntState{return copyState(this.progress);}
 drainEvents():SourceHuntBattleEvent[]{return this.events.splice(0);}
 private setPhase(phase:SourceHuntBattlePhase,wait=0):void {this.phase=phase;this.waitSeconds=wait;this.events.push({kind:'phase',phase});}
 private settle(action:Extract<SourceHuntBattleEvent,{kind:'settlement'}>['action'],result:SourceHuntResult):boolean {
  if(result.status!=='supported')return false;
  this.progress=copyState(result.value);this.petCoinGranted+=result.petCoinGrant;
  this.events.push({kind:'settlement',requestID:`${this.runID}:${++this.sequence}:${action}`,action,result:{...result,value:copyState(result.value)}});return true;
 }
 enter():SourceHuntResult {
  if(this.phase!=='idle')return {status:'blocked',reason:'hunt-host-already-entered'};
  const r=sourceHuntEnter(this.progress,this.entitlements);if(this.settle('enter',r))this.setPhase('enter-loading',SOURCE_HUNT_HOST_WAITS.enterSeconds);return r;
 }
 giveUp():SourceHuntResult {
  if(!['enter-loading','playing','next-level-wait'].includes(this.phase))return {status:'blocked',reason:'hunt-host-not-playing'};
  const r=sourceHuntGiveUp(this.progress);if(this.settle('give-up',r)){this.projectiles.dispose();this.setPhase('ended');}return r;
 }
 exit():SourceHuntResult {
  if(['idle','exit-field-wait','exit-mask-wait','disposed'].includes(this.phase))return {status:'blocked',reason:'hunt-host-no-open-run'};
  const r=sourceHuntExit(this.progress);if(this.settle('exit',r))this.beginExit();return r;
 }
 bonus(confirmed:boolean):SourceHuntResult {
  if(this.phase!=='ended')return {status:'blocked',reason:'hunt-host-result-not-open'};
  const r=sourceHuntBonus(this.progress,confirmed);if(this.settle('bonus',r))this.beginExit();return r;
 }
 private beginExit():void {this.projectiles.dispose();this.monsters.dispose();this.setPhase('exit-field-wait',SOURCE_HUNT_HOST_WAITS.exitFieldSeconds);}
 /** Source coroutine at most one resume/frame; never consumes remainder into
  * another level, fires a catch-up volley, or simulates while loading. */
 advanceFrame(dt:number,input:SourceHuntBattleFrameInput,adapter:SourceHuntBattleAdapter):void {
  const delta=scalar(dt,'delta');if(delta<0)throw new RangeError('Negative Hunt host delta');
  const joy={x:scalar(input.joystick.x,'joystick.x'),y:scalar(input.joystick.y,'joystick.y')};
  if(!input.simulate||delta===0||this.phase==='idle'||this.phase==='disposed'||this.phase==='ended')return;
  if(this.phase!=='playing'){
   if(this.phase==='enter-loading'&&!input.resourcesReady)return;
   this.waitSeconds=f(this.waitSeconds-delta);if(this.waitSeconds>0)return;
   if(this.phase==='enter-loading'||this.phase==='next-level-wait'){
    this.monsters.startLevel(this.progress.wave,this.progress.level,{aspect:adapter.aspect,random:adapter.random});
    this.setPhase('playing');this.collectMonsterEvents();
   }else if(this.phase==='exit-field-wait'){this.events.push({kind:'restore-field'});this.setPhase('exit-mask-wait',SOURCE_HUNT_HOST_WAITS.exitMaskSeconds);}
   else this.setPhase('disposed');return;
  }
  this.elapsedSeconds=f(this.elapsedSeconds+delta);
  this.monsters.advanceSpawnFrame(delta,{aspect:adapter.aspect,random:adapter.random});
  this.collectMonsterEvents();if(this.phase!=='playing')return;
  const leader=this.cats.find(c=>c.active&&!c.isAI)!;
  const history=sourceRecordBreadcrumb(this.breadcrumbs,this.lastBreadcrumb,leader.movement.position);this.breadcrumbs=history.history;this.lastBreadcrumb=history.lastRecordPosition;
  // Relative ordering of MonoBehaviour instances is an explicit H5 schedule.
  const separated=sourceHuntComputeSeparation(this.cats.map(c=>({valid:c.active,isAI:c.isAI,position:c.movement.position,separationForce:c.movement.separationForce})));
  this.cats.forEach((c,i)=>c.movement={...c.movement,separationForce:separated[i].separationForce});
  for(const cat of this.cats){if(!cat.active)continue;
   const origin=vector(adapter.rayOrigin(cat));
   // HandleAIMonster itself refreshes rays BEFORE movement (0x2b3df00).
   // Do not rely on the outer Cat.Update call graph to infer a stale target.
   cat.target=sourceHuntCatRaycastFrame(cat.target,delta,origin,adapter.raycast,adapter.project,4);
   const hit=cat.target.nearObj,live=hit?this.monsters.current(hit.token):undefined;
   if(hit&&!live)cat.target={...cat.target,nearObj:null};
   cat.attack.prepareFrame(delta,cat.cooldownSeconds,cat.gun.generation.type,!!live);
   const speed=sourceMoveSpeedFromRawStatSlots(cat.isAI,this.movementStats);
   if(cat.isAI)cat.movement=sourceHuntCatAIMovementFrame(cat.movement,{dt:delta,moveSpeed:speed,speedMultiplier:1,rayOrigin:origin,
    targetPosition:live?.position??null,offScreenTargetPosition:cat.target.hasOffScreenMonster?cat.target.offScreenMonsterPosition:null,
    mapCenter:SOURCE_HUNT_HOST_CENTER,breadcrumbs:this.breadcrumbs,leaderPosition:leader.movement.position},adapter.movement).state;
   else {
    const velocity=sourceHuntLeaderVelocity(input.acceptInput?joy:{x:0,y:0},speed,cat.movement.bodyVelocity.y,v=>sourceCatRotateVector(SOURCE_CAT_JOYSTICK_YAW_H5,v));
    const bounded=sourceHuntClampCatRadius(cat.movement.position,velocity,SOURCE_HUNT_HOST_CENTER);
    cat.movement={...cat.movement,position:bounded.position,bodyVelocity:bounded.velocity,running:velocity.x!==0||velocity.z!==0};
   }
   // Leader hand/face precede Attack; AI Attack precedes its final hand/face.
   if(!cat.isAI)adapter.afterCatUpdate?.(cat,delta);
   cat.attack.attackPreparedFrame(delta,cat.cooldownSeconds,cat.gun.generation.type,cat.target.nearObj,cat.target.nearHitPoint,request=>{
    const monster=this.monsters.current(request.target.token);if(!monster)return false;
    adapter.beforeAttack(cat,request);
    const start=sourceHuntGunFirePosition(sourceHuntGunSockets(cat.componentID,cat.gun.gunNum),adapter.camForward,id=>adapter.transformWorld(cat,id),adapter.rangeInt);
    const shot=sourceBossShotDamage(cat.damage,adapter.random());
    const tokens=sourceHuntEmitGun(this.projectiles,{gunNum:cat.gun.gunNum,generation:cat.gun.generation,damage:shot.damage,start,nearHitPoint:request.nearHitPoint,
     targetTransform:monster.position,camForward:adapter.camForward,spreadDegrees:request.spreadDegrees,missileSpeed:cat.gun.missileSpeed,random:adapter.random,canAllocate:adapter.canAllocate});
    if(tokens.length)this.events.push({kind:'attack',componentID:cat.componentID,critical:shot.isCritical,tokens,start,damage:shot.damage});return tokens.length>0;
   });
   if(cat.isAI)adapter.afterCatUpdate?.(cat,delta);
  }
  // H5 scheduling choice: swept bullet contact before same-frame barrier entry.
  // Not an assertion about Unity FixedUpdate/coroutine callback dispatch order.
  this.monsters.advanceKnockbackFrame(delta);this.monsters.integrateH5(delta,false);
  for(const event of this.projectiles.advanceFrame(delta,this.monsters))this.events.push({kind:'projectile',event});
  for(const m of [...this.monsters.activeMonsters()])if(sourceHuntBarrierContact(m.position))this.monsters.invade(this.monsters.token(m));
  for(const cat of this.cats)if(cat.active){const p=cat.movement.position,v=cat.movement.bodyVelocity;cat.movement={...cat.movement,position:vector({x:f(p.x+f(v.x*delta)),y:f(p.y+f(v.y*delta)),z:f(p.z+f(v.z*delta))})};}
  this.collectMonsterEvents();
 }
 private collectMonsterEvents():void {
  for(const event of this.monsters.drainEvents()){
   this.events.push({kind:'monster',event});
   if(event.kind==='invasion'){
    this.settle('invasion',sourceHuntInvade(this.progress));
    if(event.fatal){this.projectiles.dispose();this.setPhase('ended');}
   }else if(event.kind==='level-clear'){
    this.settle('level-clear',sourceHuntLevelClear(this.progress,this.entitlements));this.projectiles.dispose();this.setPhase('next-level-wait',SOURCE_HUNT_HOST_WAITS.nextLevelSeconds);
   }
  }
 }
}
