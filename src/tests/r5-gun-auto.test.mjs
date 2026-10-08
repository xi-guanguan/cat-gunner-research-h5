import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,sourceGun,sourceGunID} from '../session.ts';
import {gunEntityUID} from '../gun-drag.ts';
import {freshSourceGunAutoMerge,decodeSourceGunAutoMerge,sourceGunSetAutoMerge,sourceGunAutoMergeLimit,sourceGunAutoPool,sourceGunFindAutoMergePair,sourceGunAutoMergeOnce,sourceGunAutoMergePosition,createSourceGunAutoMergeScheduler,createSourceGunAutoDelay,SOURCE_GUN_AUTO_PAIR_SECONDS} from '../r5-gun-auto.ts';
const state={autoMergeRequested:true,configuredDegree:6};
function fixture(ids=[0,3,5,8],history=[30]){
 const session={...createSession(42),mode:'field',overlay:'gun',gunUnlocked:true,catalogSeen:history,gunInventory:ids.map((id,i)=>({...sourceGun(id),uid:`item-${i}`}))};
 return {session,state,plusPack2Active:true,pool:sourceGunAutoPool(session),positions:ids.map((_,i)=>({x:i*400,y:0})),deltaSec:.0625};
}
function start(frame,scheduler=createSourceGunAutoMergeScheduler()){assert.equal(scheduler.tick(frame).phase,'initial');return {scheduler,first:scheduler.tick(frame)};}
function commitFor(frame){const {scheduler}=start(frame);return scheduler.tick({...frame,deltaSec:.5}).commit;}
test('source state/config and history cap preserve collected history and package normalization',()=>{
 assert.deepEqual(freshSourceGunAutoMerge(),{autoMergeRequested:false,configuredDegree:6});assert.deepEqual(decodeSourceGunAutoMerge(undefined),freshSourceGunAutoMerge());
 assert.throws(()=>decodeSourceGunAutoMerge({autoMergeRequested:true,configuredDegree:7}));
 assert.equal(sourceGunSetAutoMerge(state,true,false).autoMergeRequested,false);
 assert.equal(sourceGunAutoMergeLimit(fixture([],[]).session,state),-2);
 assert.equal(sourceGunAutoMergeLimit(fixture([],[4]).session,state),-1);
 assert.equal(sourceGunAutoMergeLimit(fixture([],[5]).session,state),0);
 assert.equal(sourceGunAutoMergeLimit(fixture([],[64]).session,state),6);
 assert.equal(sourceGunAutoMergeLimit(fixture([],[64]).session,{...state,configuredDegree:2}),2);
 assert.equal(sourceGunAutoMergeLimit(fixture([],[14]).session,state,15),1);
});
test('degree ascending then pool order; same degree permits different weapon IDs',()=>{
 const frame=fixture([6,9,3,0]);frame.pool=[frame.pool[3],frame.pool[2],frame.pool[1],frame.pool[0]];
 const pair=sourceGunFindAutoMergePair(frame.session,state,true,frame.pool);assert.equal(pair.stationary.slot,3);assert.equal(pair.mover.slot,2);
 assert.equal(pair.stationary.sourceID,0);assert.equal(pair.mover.sourceID,3);
 for(const field of ['paused','adReward','dragging','autoMerging']){const f=fixture();f.pool[0][field]=true;const p=sourceGunFindAutoMergePair(f.session,state,true,f.pool);assert.equal(p.stationary.slot,2);assert.equal(p.mover.slot,3);}
 const f=fixture();assert.equal(sourceGunFindAutoMergePair(f.session,state,true,f.pool,[0]).stationary.slot,2);
 f.pool[0].active=false;assert.equal(sourceGunFindAutoMergePair(f.session,state,true,f.pool).stationary.slot,2);
 assert.equal(sourceGunFindAutoMergePair(f.session,state,false,f.pool),undefined);
 assert.equal(sourceGunFindAutoMergePair(fixture([35,39],[64]).session,state,true,fixture([35,39],[64]).pool),undefined);
});
test('native SmoothStep .25 seconds/25 source-unit threshold, initial frame yields',()=>{
 assert.deepEqual(sourceGunAutoMergePosition({x:400,y:0},{x:0,y:0},.125),{position:{x:200,y:0},ready:false});
 assert.equal(sourceGunAutoMergePosition({x:24,y:0},{x:0,y:0},0).ready,true);
 assert.throws(()=>sourceGunAutoMergePosition({x:NaN,y:0},{x:0,y:0},0),RangeError);
 const {first}=start(fixture());assert.equal(first.phase,'moving');assert.equal(first.position.x,337.5);
});
test('only mover moves toward original slot; global active dragging waits at arrival',()=>{
 const frame=fixture(),{scheduler,first}=start(frame);frame.positions[0]={x:999,y:999};frame.pool[3].dragging=true;
 const wait=scheduler.tick({...frame,deltaSec:.5});assert.equal(wait.phase,'waiting');assert.deepEqual(wait.position,{x:0,y:0});assert.equal(wait.commit,undefined);assert.equal(wait.pair.stationary.uid,first.pair.stationary.uid);
 frame.pool[3].dragging=false;const out=scheduler.tick({...frame,deltaSec:.01});assert.ok(out.commit);assert.deepEqual(out.commit.inventoryUIDs,['item-0','item-1','item-2','item-3']);
 assert.equal(out.commit.pair.mover.autoMerging,false);assert.equal(scheduler.pair,null);
 for(let i=0;i<5;i++)assert.equal(scheduler.tick({...frame,deltaSec:1}).commit,undefined);
});
test('TryAcquire cancels stale/paused/drag/ad/inactive pair, and re-reserves unmarked live item',()=>{
 for(const change of [f=>{f.pool[1].paused=true;},f=>{f.pool[1].adReward=true;},f=>{f.pool[1].dragging=true;},f=>{f.pool[1].active=false;},f=>{f.session.gunInventory[1]={...sourceGun(3),uid:'replacement'};},f=>{f.pool[1].sourceID=4;}]){
  const f=fixture(),{scheduler,first}=start(f);change(f);const result=scheduler.tick(f);assert.equal(result.phase,'cancelled');assert.deepEqual(result.releasedPair,first.pair);assert.equal(result.commit,undefined);
 }
 const f=fixture(),{scheduler}=start(f);f.pool[1].autoMerging=false;assert.equal(scheduler.tick(f).phase,'moving');
});
test('transaction uses exact original slots/UID and preserves blocked resource/RNG state',()=>{
 const f=fixture(),commit=commitFor(f),result=sourceGunAutoMergeOnce(f.session,state,true,commit);
 assert.equal(result.status,'granted');assert.equal(result.resultSlot,0);assert.equal(result.session.gunInventory.length,3);
 const resultID=sourceGunID(result.session.gunInventory[0]);assert.ok(resultID>=5&&resultID<10);assert.ok(result.session.catalogSeen.includes(resultID));assert.ok(result.session.catalogSeen.includes(30));
 assert.equal(result.session.gunInventory[1],f.session.gunInventory[2]);assert.notEqual(result.session.rngState,f.session.rngState);
 for(const mutate of [s=>({...s,overlay:'none'}),s=>({...s,catalogSeen:[0]}),s=>({...s,gunInventory:s.gunInventory.map((g,i)=>i===1?{...g,uid:'replacement'}:g)}),s=>({...s,gunInventory:[s.gunInventory[1],s.gunInventory[0],...s.gunInventory.slice(2)]})]){
  const session=mutate(f.session),blocked=sourceGunAutoMergeOnce(session,state,true,commit);assert.equal(blocked.status,'blocked');assert.equal(blocked.session,session);
 }
 assert.equal(sourceGunAutoMergeOnce(f.session,state,false,commit).session,f.session);
 const pool=sourceGunAutoPool(f.session);pool[3].dragging=true;assert.equal(sourceGunAutoMergeOnce(f.session,state,true,commit,pool).status,'blocked');
 pool[3].dragging=false;pool[1].paused=true;assert.equal(sourceGunAutoMergeOnce(f.session,state,true,commit,pool).status,'blocked');
});
test('anchor index adjusts when mover precedes anchor and history never depends on current inventory',()=>{
 const f=fixture();f.pool=[f.pool[1],f.pool[0],...f.pool.slice(2)];const commit=commitFor(f);assert.equal(commit.pair.stationary.slot,1);assert.equal(commit.pair.mover.slot,0);
 const result=sourceGunAutoMergeOnce(f.session,state,true,commit);assert.equal(result.resultSlot,0);assert.equal(result.status,'granted');
});
test('close/off/lost package reset reservation; terminal destroy cannot dispatch',()=>{
 for(const change of [f=>{f.enabled=false;},f=>{f.state={...state,autoMergeRequested:false};},f=>{f.plusPack2Active=false;}]){
  const f=fixture(),{scheduler,first}=start(f);change(f);const out=scheduler.tick(f);assert.equal(out.phase,'idle');assert.deepEqual(out.releasedPair,first.pair);
 }
 const f=fixture(),{scheduler,first}=start(f);assert.deepEqual(scheduler.cancel(),first.pair);assert.equal(scheduler.tick({...f,deltaSec:9}).phase,'stopped');scheduler.reset();assert.equal(scheduler.tick(f).phase,'initial');
});
test('post-pair delay survives panel rebuild and guards unacknowledged inventory',()=>{
 const f=fixture(),delay=createSourceGunAutoDelay(),s=createSourceGunAutoMergeScheduler(delay);start(f,s);const out=s.tick({...f,deltaSec:.5});assert.ok(out.commit);s.cancel();
 const next=sourceGunAutoMergeOnce(f.session,state,true,out.commit).session,rebuilt=createSourceGunAutoMergeScheduler(delay),frame={...f,session:next,pool:sourceGunAutoPool(next)};
 assert.equal(rebuilt.tick(frame).phase,'initial');assert.equal(rebuilt.tick({...frame,deltaSec:.1}).phase,'cooldown');assert.equal(rebuilt.tick({...frame,deltaSec:.03}).phase,'cooldown');assert.equal(delay.remainingSec,0);assert.equal(SOURCE_GUN_AUTO_PAIR_SECONDS,Math.fround(.12));
 rebuilt.reset();assert.deepEqual(delay,{remainingSec:0,awaitingInventory:null});
});

test('explicit rejected-host acknowledgement retries after native pair cooldown',()=>{
 const f=fixture(),{scheduler}=start(f);assert.ok(scheduler.tick({...f,deltaSec:.5}).commit);scheduler.acknowledge(false);
 assert.equal(scheduler.tick({...f,deltaSec:.2}).phase,'cooldown');assert.equal(scheduler.tick({...f,deltaSec:.01}).phase,'moving');
});
