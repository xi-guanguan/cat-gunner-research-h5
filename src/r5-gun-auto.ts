import { fuseInventory, sourceGunID, type Session, type Gun } from './session';
import { gunEntityUID, type DragPoint } from './gun-drag';

/** Gun_manager scene 123082: requested=false, configured degree=6. PlusPack.Is_Active(2). */
export interface SourceGunAutoMergeState {autoMergeRequested:boolean;configuredDegree:number}
export const SOURCE_GUN_AUTO_MOVE_SECONDS=Math.fround(.25);
export const SOURCE_GUN_AUTO_MERGE_DISTANCE=Math.fround(25);
export const SOURCE_GUN_AUTO_PAIR_SECONDS=Math.fround(.12);
export const freshSourceGunAutoMerge=():SourceGunAutoMergeState=>({autoMergeRequested:false,configuredDegree:6});
export function decodeSourceGunAutoMerge(raw:unknown):SourceGunAutoMergeState {
 if(raw===undefined||raw===null)return freshSourceGunAutoMerge();
 const v=raw as SourceGunAutoMergeState;
 if(typeof v!=='object'||typeof v.autoMergeRequested!=='boolean'||!Number.isSafeInteger(v.configuredDegree)||v.configuredDegree<0||v.configuredDegree>6)throw new Error('Invalid gun auto merge state');
 return {autoMergeRequested:v.autoMergeRequested,configuredDegree:v.configuredDegree};
}
export function sourceGunSetAutoMerge(state:SourceGunAutoMergeState,requested:boolean,plusPack2Active:boolean):SourceGunAutoMergeState {
 return {...state,autoMergeRequested:plusPack2Active&&requested};
}
/** Highest true Gun_Collect entry /5, minus one. Inventory is only an older-save history fallback. */
export function sourceGunAutoMergeLimit(session:Session,state:SourceGunAutoMergeState,gunCount=65):number {
 const collected=session.catalogSeen??[...session.gunInventory,...session.equippedGuns.filter((g):g is Gun=>!!g)].map(sourceGunID);
 const highest=collected.reduce((max,id)=>Number.isSafeInteger(id)&&id>=0&&id<gunCount?Math.max(max,id):max,-1);
 return Math.min(state.configuredDegree,Math.floor(highest/5)-1,6,Math.floor(gunCount/5)-2);
}
export interface SourceGunAutoItem {slot:number;sourceID:number;uid:string;active:boolean;adReward?:boolean;paused?:boolean;dragging?:boolean;autoMerging?:boolean}
export interface SourceGunAutoPair {stationary:SourceGunAutoItem;mover:SourceGunAutoItem}
export interface SourceGunAutoCommit {pair:SourceGunAutoPair;inventoryUIDs:string[];inventoryIDs:number[]}
export function sourceGunAutoPool(session:Session):SourceGunAutoItem[] {
 return session.gunInventory.map((gun,slot)=>{const flags=gun as Gun&{adReward?:boolean;paused?:boolean};return {slot,sourceID:sourceGunID(gun),uid:gunEntityUID(gun),active:true,adReward:flags.adReward===true,paused:flags.paused===true};});
}
const identity=(session:Session)=>JSON.stringify(session.gunInventory.map(gunEntityUID));
const available=(p:SourceGunAutoItem)=>p.active&&!p.adReward&&!p.paused&&!p.dragging&&!p.autoMerging;
function sameItem(session:Session,p:SourceGunAutoItem):boolean {
 const g=session.gunInventory[p.slot];return Number.isSafeInteger(p.slot)&&p.slot>=0&&!!g&&gunEntityUID(g)===p.uid&&sourceGunID(g)===p.sourceID;
}
/** Degree ascending; serialized pool order. First is anchor, second is mover. Source IDs may differ. */
export function sourceGunFindAutoMergePair(session:Session,state:SourceGunAutoMergeState,plusPack2Active:boolean,pool:readonly SourceGunAutoItem[],dragTargets:readonly number[]=[]):SourceGunAutoPair|undefined {
 if(!plusPack2Active||!state.autoMergeRequested)return;
 const excluded=new Set(dragTargets),cap=sourceGunAutoMergeLimit(session,state);
 for(let degree=0;degree<=cap;degree++){
  let stationary:SourceGunAutoItem|undefined;
  for(const p of pool){if(!available(p)||excluded.has(p.slot)||!sameItem(session,p)||Math.floor(p.sourceID/5)!==degree)continue;
   if(!stationary){stationary=p;continue;}
   if(stationary.slot!==p.slot&&stationary.uid!==p.uid)return {stationary:{...stationary},mover:{...p}};
  }
 }
}
export interface SourceGunAutoTransactionResult {status:'granted'|'blocked';session:Session;reason?:string;resultSlot?:number}
/** Host revalidates the exact pair against CURRENT state; every blocked path preserves session/RNG. */
export function sourceGunAutoMergeOnce(session:Session,state:SourceGunAutoMergeState,plusPack2Active:boolean,commit:SourceGunAutoCommit,pool:readonly SourceGunAutoItem[]=sourceGunAutoPool(session)):SourceGunAutoTransactionResult {
 const blocked=(reason:string):SourceGunAutoTransactionResult=>({status:'blocked',session,reason});
 if(session.mode!=='field'||session.overlay!=='gun'||!session.gunUnlocked)return blocked('Gun panel is not active');
 if(!plusPack2Active||!state.autoMergeRequested)return blocked('Gun auto merge is not enabled');
 if(commit.inventoryUIDs.length!==session.gunInventory.length||commit.inventoryIDs.length!==session.gunInventory.length||session.gunInventory.some((g,i)=>gunEntityUID(g)!==commit.inventoryUIDs[i]||sourceGunID(g)!==commit.inventoryIDs[i]))return blocked('Inventory changed before auto merge');
 if(pool.some(p=>p.active&&p.dragging))return blocked('Wait for all gun dragging to end');
 const {stationary,mover}=commit.pair;
 if(stationary.slot===mover.slot||stationary.uid===mover.uid)return blocked('Auto merge needs distinct weapons');
 for(const selected of [stationary,mover]){
  const p=pool.find(p=>p.slot===selected.slot&&p.uid===selected.uid);
  if(!p||!sameItem(session,selected)||p.sourceID!==selected.sourceID||!available(p))return blocked('Auto merge item became unavailable');
 }
 const degree=Math.floor(mover.sourceID/5);
 if(degree!==Math.floor(stationary.sourceID/5)||degree>sourceGunAutoMergeLimit(session,state))return blocked('Auto merge degree exceeds collected history');
 const next=fuseInventory(session,mover.slot,stationary.slot);
 if(next.gunInventory===session.gunInventory)return blocked('Fusion rejected');
 const resultSlot=stationary.slot-(mover.slot<stationary.slot?1:0),resultID=sourceGunID(next.gunInventory[resultSlot]);
 // Native FuseItems calls OnWeaponAcquired(result). Keep historical collection after later sales.
 return {status:'granted',session:{...next,catalogSeen:[...new Set([...(session.catalogSeen??[...session.gunInventory,...session.equippedGuns.filter((g):g is Gun=>!!g)].map(sourceGunID)),resultID])]},resultSlot};
}
const f=Math.fround;
/** Native SmoothStep/Vector2.Lerp, source-space distance threshold, mover only. */
export function sourceGunAutoMergePosition(from:DragPoint,target:DragPoint,elapsedSec:number):{position:DragPoint;ready:boolean} {
 if(![from.x,from.y,target.x,target.y,elapsedSec].every(Number.isFinite)||elapsedSec<0)throw new RangeError('Invalid gun auto merge motion');
 const t=f(Math.min(1,f(elapsedSec)/SOURCE_GUN_AUTO_MOVE_SECONDS)),smooth=f(f(f(3*t)*t)-f(f(t*f(t+t))*t));
 const position={x:f(from.x+f(f(target.x-from.x)*smooth)),y:f(from.y+f(f(target.y-from.y)*smooth))};
 const dx=f(position.x-target.x),dy=f(position.y-target.y),distance=f(Math.sqrt(f(f(dx*dx)+f(dy*dy))));
 return {position,ready:t>=1||distance<=SOURCE_GUN_AUTO_MERGE_DISTANCE};
}
export interface SourceGunAutoDelay {remainingSec:number;awaitingInventory:string|null}
export const createSourceGunAutoDelay=():SourceGunAutoDelay=>({remainingSec:0,awaitingInventory:null});
export interface SourceGunAutoFrame {session:Session;state:SourceGunAutoMergeState;plusPack2Active:boolean;pool:readonly SourceGunAutoItem[];positions:readonly DragPoint[];deltaSec:number;enabled?:boolean;dragTargets?:readonly number[]}
export interface SourceGunAutoStep {phase:'idle'|'initial'|'moving'|'waiting'|'cooldown'|'cancelled'|'stopped';pair?:SourceGunAutoPair;position?:DragPoint;releasedPair?:SourceGunAutoPair;commit?:SourceGunAutoCommit}
/** Native initial frame yield, per-frame reacquisition, global drag wait, .12s post-pair delay.
 * H5 scans again when new inventory arrives; source resumes through ReloadList/TryStartAutoMerge. */
export function createSourceGunAutoMergeScheduler(delay:SourceGunAutoDelay=createSourceGunAutoDelay()) {
 let running:{pair:SourceGunAutoPair;from:DragPoint;target:DragPoint;elapsedSec:number}|null=null,stopped=false,initial=true;
 const release=(resetDelay:boolean)=>{const pair=running?.pair;running=null;if(resetDelay){delay.remainingSec=0;delay.awaitingInventory=null;initial=true;}return pair;};
 return {
  get pair():SourceGunAutoPair|null{return running?.pair??null;},
  /** A rejected host transaction releases the replay guard; cooldown still applies. */
  acknowledge(accepted:boolean):void{if(!accepted)delay.awaitingInventory=null;},
  cancel(resetDelay=false):SourceGunAutoPair|undefined{stopped=true;return release(resetDelay);},
  reset():SourceGunAutoPair|undefined{stopped=false;return release(true);},
  tick(frame:SourceGunAutoFrame):SourceGunAutoStep {
   if(!Number.isFinite(frame.deltaSec)||frame.deltaSec<0)throw new RangeError('Invalid gun auto merge delta');
   if(stopped)return {phase:'stopped'};
   if(frame.enabled===false||!frame.plusPack2Active||!frame.state.autoMergeRequested){const releasedPair=release(true);return {phase:'idle',releasedPair};}
   if(initial){initial=false;return {phase:'initial'};}
   if(delay.awaitingInventory!==null){if(delay.awaitingInventory===identity(frame.session))return {phase:'waiting'};delay.awaitingInventory=null;}
   if(delay.remainingSec>0){delay.remainingSec=Math.max(0,f(delay.remainingSec-f(frame.deltaSec)));return {phase:'cooldown'};}
   if(!running){
    const pair=sourceGunFindAutoMergePair(frame.session,frame.state,frame.plusPack2Active,frame.pool,frame.dragTargets);if(!pair)return {phase:'idle'};
    const from=frame.positions[pair.mover.slot],target=frame.positions[pair.stationary.slot];
    if(!from||!target||![from.x,from.y,target.x,target.y].every(Number.isFinite))return {phase:'idle'};
    running={pair,from:{...from},target:{...target},elapsedSec:0};
   }
   const {pair}=running;
   const candidates=[pair.stationary,pair.mover].map(selected=>frame.pool.find(p=>p.slot===selected.slot&&p.uid===selected.uid&&p.sourceID===selected.sourceID));
   // TryAcquireAutoMergeItem reapplies reservation when needed; IsAutoMerging=false alone is not invalid.
   if(candidates.some((p,i)=>!p||!p.active||p.adReward||p.paused||p.dragging||!sameItem(frame.session,[pair.stationary,pair.mover][i]))){
    const releasedPair=release(false);delay.remainingSec=SOURCE_GUN_AUTO_PAIR_SECONDS;return {phase:'cancelled',releasedPair};
   }
   running.elapsedSec=f(running.elapsedSec+f(frame.deltaSec));const motion=sourceGunAutoMergePosition(running.from,running.target,running.elapsedSec);
   if(!motion.ready)return {phase:'moving',pair,position:motion.position};
   if(frame.pool.some(p=>p.active&&p.dragging))return {phase:'waiting',pair,position:{...running.target}};
   const commit:SourceGunAutoCommit={pair:{stationary:{...pair.stationary,autoMerging:false},mover:{...pair.mover,autoMerging:false}},inventoryUIDs:frame.session.gunInventory.map(gunEntityUID),inventoryIDs:frame.session.gunInventory.map(sourceGunID)};
   delay.remainingSec=SOURCE_GUN_AUTO_PAIR_SECONDS;delay.awaitingInventory=identity(frame.session);running=null;
   return {phase:'waiting',pair,position:motion.position,commit};
  }
 };
}
