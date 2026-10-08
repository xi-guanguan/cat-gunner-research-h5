/** Native Pet_manager and Pet_Item_List auto contracts; IDs are the H5 stale-transaction guard. */
import scene from './data/r6-pet-auto-scene.json';
import {sourcePetWithIdentities,type SourcePetState} from './r5-pet';
export interface SourcePetAutoState {requested:boolean;configuredDegree:number}
/** Scene overrides ctor: requested=false, degree6. Source does not save this toggle. */
export const freshSourcePetAutoState=(_plus2=false):SourcePetAutoState=>({requested:scene.requested,configuredDegree:scene.configuredDegree});
export const sourcePetAutoEntryUnlocked=(historicMax:number)=>historicMax>=190;
export function sourcePetAutoLimit(s:SourcePetState,configured=6):number {
 if(!Number.isInteger(configured))throw new RangeError('Pet auto degree');return Math.min(configured,s.collect.lastIndexOf(true)-1,6);
}
export interface SourcePetEntityRef {kind:'owned'|'selected';index:number;grade:number;lock:number;uid:string}
export function sourcePetEntityRef(s:SourcePetState,kind:SourcePetEntityRef['kind'],index:number):SourcePetEntityRef|null {
 s=sourcePetWithIdentities(s);const items=kind==='owned'?s.owned:s.selected,locks=kind==='owned'?s.ownedLocks:s.selectedLocks,ids=kind==='owned'?s.ownedIDs:s.selectedIDs;
 return Number.isInteger(index)&&index>=0&&index<items.length&&items[index]>=0?{kind,index,grade:items[index],lock:locks[index],uid:ids[index]!}:null;
}
export function sourcePetRefCurrent(s:SourcePetState,ref:SourcePetEntityRef|null):boolean {
 if(!ref)return false;const now=sourcePetEntityRef(s,ref.kind,ref.index);return !!now&&now.uid===ref.uid&&now.grade===ref.grade&&now.lock===ref.lock;
}
export interface SourcePetAutoCandidate {slot:number;active:boolean;dragging:boolean;autoMerging:boolean;reserved:boolean}
export interface SourcePetAutoPair {mover:SourcePetEntityRef;anchor:SourcePetEntityRef}
/** Native FindAutoMergePair scans grade 0 upward then active pool order; first=mover, second=anchor. */
export function sourcePetFindAutoPair(s:SourcePetState,auto:SourcePetAutoState,plus2:boolean,pool:readonly SourcePetAutoCandidate[]):SourcePetAutoPair|null {
 if(!plus2||!auto.requested)return null;
 const limit=sourcePetAutoLimit(s,auto.configuredDegree);
 for(let grade=0;grade<=limit;grade++){
  let mover:SourcePetEntityRef|null=null;
  for(const c of pool){if(!c.active||c.dragging||c.autoMerging||c.reserved)continue;const ref=sourcePetEntityRef(s,'owned',c.slot);if(!ref||ref.grade!==grade||ref.lock!==-1)continue;if(mover&&mover.uid!==ref.uid)return {mover,anchor:ref};mover=ref;}
 }
 return null;
}
export const SOURCE_PET_AUTO_MOVE_SECONDS=Math.fround(.25),SOURCE_PET_AUTO_DISTANCE=25,SOURCE_PET_AUTO_PAIR_SECONDS=Math.fround(.12);
export interface PetAutoPoint {x:number;y:number}
const f=Math.fround;
export function sourcePetAutoPosition(from:PetAutoPoint,target:PetAutoPoint,elapsed:number){
 if(![from.x,from.y,target.x,target.y,elapsed].every(Number.isFinite)||elapsed<0)throw new RangeError('Pet auto motion');
 const t=f(Math.min(1,f(elapsed)/SOURCE_PET_AUTO_MOVE_SECONDS)),smooth=f(f(f(3*t)*t)-f(f(t*f(t+t))*t));
 const position={x:f(from.x+f(f(target.x-from.x)*smooth)),y:f(from.y+f(f(target.y-from.y)*smooth))};
 const dx=f(position.x-target.x),dy=f(position.y-target.y),distance=f(Math.sqrt(f(f(dx*dx)+f(dy*dy))));
 return {position,ready:smooth>=1||distance<=SOURCE_PET_AUTO_DISTANCE};
}
export interface SourcePetAutoFrame {state:SourcePetState;auto:SourcePetAutoState;plus2:boolean;pool:readonly SourcePetAutoCandidate[];positions:readonly PetAutoPoint[];dt:number;enabled:boolean;dragging:boolean}
export function createSourcePetAutoScheduler(){
 let running:{pair:SourcePetAutoPair;from:PetAutoPoint;target:PetAutoPoint;elapsed:number}|null=null,cooldown=0,waiting:string|null=null;
 const signature=(s:SourcePetState)=>JSON.stringify([s.owned,s.ownedLocks,s.ownedIDs]);
 const reset=()=>{running=null;cooldown=0;waiting=null;};
 return {reset,tick(frame:SourcePetAutoFrame):{phase:'idle'|'moving'|'cooldown'|'waiting'|'cancelled';pair?:SourcePetAutoPair;position?:PetAutoPoint;commit?:SourcePetAutoPair}{
  if(!Number.isFinite(frame.dt)||frame.dt<0)throw new RangeError('Pet auto delta');
  if(!frame.enabled||!frame.plus2||!frame.auto.requested||frame.dragging){reset();return {phase:'idle'};}
  if(waiting!==null){if(waiting===signature(frame.state))return {phase:'waiting'};waiting=null;}
  if(cooldown>0){cooldown=Math.max(0,f(cooldown-f(frame.dt)));return {phase:'cooldown'};}
  if(!running){if(frame.dt===0)return {phase:'idle'};const pair=sourcePetFindAutoPair(frame.state,frame.auto,frame.plus2,frame.pool);if(!pair)return {phase:'idle'};const from=frame.positions[pair.mover.index],target=frame.positions[pair.anchor.index];if(!from||!target)return {phase:'idle'};running={pair,from:{...from},target:{...target},elapsed:0};}
  const r=running;
  const valid=[r.pair.mover,r.pair.anchor].every(ref=>sourcePetRefCurrent(frame.state,ref)&&ref.lock===-1&&frame.pool.some(c=>c.slot===ref.index&&c.active&&!c.dragging&&!c.reserved));
  if(!valid||r.pair.mover.grade>sourcePetAutoLimit(frame.state,frame.auto.configuredDegree)){running=null;cooldown=SOURCE_PET_AUTO_PAIR_SECONDS;return {phase:'cancelled'};}
  r.elapsed=f(r.elapsed+f(frame.dt));const motion=sourcePetAutoPosition(r.from,r.target,r.elapsed);
  if(!motion.ready)return {phase:'moving',pair:r.pair,position:motion.position};
  running=null;cooldown=SOURCE_PET_AUTO_PAIR_SECONDS;waiting=signature(frame.state);return {phase:'waiting',pair:r.pair,position:motion.position,commit:r.pair};
 }};
}

export interface SourcePetSlotSnapshot {kind:'owned'|'selected';index:number;grade:number;lock:number;uid:string|null}
export function sourcePetSlotSnapshot(state:SourcePetState,kind:SourcePetSlotSnapshot['kind'],index:number):SourcePetSlotSnapshot {
 const s=sourcePetWithIdentities(state),items=kind==='owned'?s.owned:s.selected,locks=kind==='owned'?s.ownedLocks:s.selectedLocks,ids=kind==='owned'?s.ownedIDs:s.selectedIDs;
 if(!Number.isInteger(index)||index<0||index>=items.length)throw new RangeError('Pet slot snapshot');
 return {kind,index,grade:items[index],lock:locks[index],uid:ids[index]};
}
export function sourcePetGuardsCurrent(state:SourcePetState,guards:unknown):boolean {
 if(!Array.isArray(guards)||guards.length<1||guards.length>3)return false;
 return guards.every(ref=>{if(!ref||typeof ref!=='object'||!['owned','selected'].includes(ref.kind))return false;try{const now=sourcePetSlotSnapshot(state,ref.kind,ref.index);return now.uid===ref.uid&&now.grade===ref.grade&&now.lock===ref.lock;}catch{return false;}});
}
