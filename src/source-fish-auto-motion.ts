/** Frame-driven native Fish_Tank auto merge projection. No timers and no inventory writes. */
import {sourceFishFindAutoMergePair,type SourceFishAutoMergeCandidate,type SourceFishState} from './r5-fish';
import {SOURCE_FISH_AUTO_MERGE_DISTANCE,SOURCE_FISH_AUTO_MERGE_MOVE_SECONDS,SOURCE_FISH_AUTO_MERGE_PAIR_SECONDS,type SourceFishPoint} from './r5-fish-motion';
export interface SourceFishAutoPair {stationary:number;mover:number}
export interface SourceFishAutoCommit {pair:SourceFishAutoPair;pool:SourceFishAutoMergeCandidate[];inventory:number[]}
/** Shared across a caller's panel rebuild after commit; never persisted into game saves. */
export interface SourceFishAutoDelay {remainingSec:number;awaitingInventory:string|null}
export const createSourceFishAutoDelay=():SourceFishAutoDelay=>({remainingSec:0,awaitingInventory:null});
export interface SourceFishAutoFrame {
 fish:SourceFishState;plusPack2Active:boolean;pool:readonly SourceFishAutoMergeCandidate[];
 positions:readonly SourceFishPoint[];deltaSec:number;enabled?:boolean;
}
export interface SourceFishAutoStep {
 phase:'idle'|'moving'|'cooldown'|'waiting'|'cancelled'|'stopped';
 pair?:SourceFishAutoPair;position?:SourceFishPoint;releasedPair?:SourceFishAutoPair;commit?:SourceFishAutoCommit;
}
const f=Math.fround,signature=(fish:SourceFishState)=>fish.inventory.join(',');
/** Native SmoothStep(0,1,elapsed/.4) then Vector2.Lerp; distance<=20 can finish before .4. */
export function sourceFishAutoMergePosition(from:SourceFishPoint,target:SourceFishPoint,elapsedSec:number):{position:SourceFishPoint;ready:boolean} {
 if(![from.x,from.y,target.x,target.y,elapsedSec].every(Number.isFinite)||elapsedSec<0)throw new RangeError('Invalid fish auto merge motion');
 const t=f(Math.min(1,f(elapsedSec)/SOURCE_FISH_AUTO_MERGE_MOVE_SECONDS));
 const smooth=f(f(f(3*t)*t)-f(f(t*f(t+t))*t));
 const position={x:f(from.x+f(f(target.x-from.x)*smooth)),y:f(from.y+f(f(target.y-from.y)*smooth))};
 const dx=f(position.x-target.x),dy=f(position.y-target.y),distance=f(Math.sqrt(f(f(dx*dx)+f(dy*dy))));
 return {position,ready:smooth>=1||distance<=SOURCE_FISH_AUTO_MERGE_DISTANCE};
}
export function createSourceFishAutoMergeScheduler(delay:SourceFishAutoDelay=createSourceFishAutoDelay()) {
 let running:{pair:SourceFishAutoPair;grade:number;from:SourceFishPoint;target:SourceFishPoint;elapsedSec:number}|null=null,stopped=false;
 const release=(resetDelay:boolean)=>{const pair=running?.pair;running=null;if(resetDelay){delay.remainingSec=0;delay.awaitingInventory=null;}return pair;};
 return {
  /** destroy cancels only this view; explicit close/off also clears the caller's carry. */
  cancel(resetDelay=false):SourceFishAutoPair|undefined {stopped=true;return release(resetDelay);},
  tick(frame:SourceFishAutoFrame):SourceFishAutoStep {
   if(!Number.isFinite(frame.deltaSec)||frame.deltaSec<0)throw new RangeError('Invalid fish auto merge delta');
   if(stopped)return {phase:'stopped'};
   if(frame.enabled===false||!frame.plusPack2Active||!frame.fish.autoMergeRequested){const releasedPair=release(true);return {phase:'idle',releasedPair};}
   if(delay.awaitingInventory!==null){if(delay.awaitingInventory===signature(frame.fish))return {phase:'waiting'};delay.awaitingInventory=null;}
   if(delay.remainingSec>0){delay.remainingSec=Math.max(0,f(delay.remainingSec-f(frame.deltaSec)));return {phase:'cooldown'};}
   const anyPending=frame.pool.some(p=>p.pendingDelete);
   let started=false;
   if(!running){
    if(anyPending||frame.deltaSec===0)return {phase:'idle'};
    const pair=sourceFishFindAutoMergePair(frame.fish,frame.plusPack2Active,frame.pool);if(!pair)return {phase:'idle'};
    const from=frame.positions[pair.mover],target=frame.positions[pair.stationary];
    if(!from||!target||![from.x,from.y,target.x,target.y].every(Number.isFinite))return {phase:'idle'};
    running={pair,grade:frame.fish.inventory[pair.mover],from:{...from},target:{...target},elapsedSec:0};started=true;
   }
   const current=running,pair=current.pair;
   const candidates=[pair.stationary,pair.mover].map(index=>frame.pool.find(p=>p.inventoryIndex===index));
   const valid=candidates.every(p=>p&&p.active&&!p.dragging&&!p.pendingDelete&&!p.currentAlertTarget&&(started||p.autoMerging)&&p.grade===current.grade&&frame.fish.inventory[p.inventoryIndex]===current.grade);
   if(!valid){const releasedPair=release(false);delay.remainingSec=SOURCE_FISH_AUTO_MERGE_PAIR_SECONDS;return {phase:'cancelled',releasedPair};}
   current.elapsedSec=f(current.elapsedSec+f(frame.deltaSec));
   const motion=sourceFishAutoMergePosition(current.from,current.target,current.elapsedSec);
   if(!motion.ready)return {phase:'moving',pair,position:motion.position};
   if(anyPending)return {phase:'waiting',pair,position:motion.position};
   // Release reservation for the transaction validator, preserving exact selected order.
   const pool=candidates.map(p=>({...p!,autoMerging:false}));
   const commit:SourceFishAutoCommit={pair:{...pair},pool,inventory:[...frame.fish.inventory]};
   delay.remainingSec=SOURCE_FISH_AUTO_MERGE_PAIR_SECONDS;delay.awaitingInventory=signature(frame.fish);running=null;
   return {phase:'waiting',pair,position:motion.position,commit};
  }
 };
}
