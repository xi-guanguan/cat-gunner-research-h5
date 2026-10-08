import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFishAutoDelay,createSourceFishAutoMergeScheduler,sourceFishAutoMergePosition} from '../source-fish-auto-motion.ts';
import {freshSourceFishState,sourceFishAutoMergeOnce} from '../r5-fish.ts';
import {SOURCE_FISH_AUTO_MERGE_PAIR_SECONDS} from '../r5-fish-motion.ts';
import {createSession} from '../session.ts';
import {createActivityState} from '../source-activities.ts';
import {freshPlatformState} from '../local-platform.ts';
import {freshSourceMetaState,runtimeSourceFishAutoMergeOnce} from '../source-meta-runtime.ts';
const fixture=(inventory=[0,0,0,0])=>({fish:{...freshSourceFishState(),inventory,autoMergeRequested:true},plusPack2Active:true,pool:inventory.map((grade,inventoryIndex)=>({inventoryIndex,grade,active:true,dragging:false,autoMerging:false,pendingDelete:false,currentAlertTarget:false})),positions:inventory.map((_,i)=>({x:i*400,y:0})),deltaSec:.1});
const reserve=(frame,step)=>{if(step.pair)for(const index of Object.values(step.pair))frame.pool.find(p=>p.inventoryIndex===index).autoMerging=true;};
const tick=(scheduler,frame,dt=frame.deltaSec)=>{const step=scheduler.tick({...frame,deltaSec:dt});reserve(frame,step);return step;};
test('native smoothstep moves only toward captured target and reaches threshold at native duration',()=>{
 assert.deepEqual(sourceFishAutoMergePosition({x:400,y:0},{x:0,y:0},0),{position:{x:400,y:0},ready:false});
 assert.deepEqual(sourceFishAutoMergePosition({x:400,y:0},{x:0,y:0},.2),{position:{x:200,y:0},ready:false});
 assert.equal(sourceFishAutoMergePosition({x:400,y:0},{x:0,y:0},.4).ready,true);
 assert.equal(sourceFishAutoMergePosition({x:19,y:0},{x:0,y:0},0).ready,true);
 assert.throws(()=>sourceFishAutoMergePosition({x:NaN,y:0},{x:0,y:0},0),RangeError);
});
test('motion reserves a pair, freezes stationary, and dispatches one exact unreserved transaction after movement',()=>{
 const frame=fixture(),scheduler=createSourceFishAutoMergeScheduler();
 const first=tick(scheduler,frame);assert.equal(first.phase,'moving');assert.equal(first.commit,undefined);assert.deepEqual(first.pair,{stationary:0,mover:1});assert.equal(first.position.x,337.5);
 frame.positions[0]={x:900,y:900}; // Reservation keeps original stationary target.
 const middle=tick(scheduler,frame);assert.deepEqual(middle.position,{x:200,y:0});assert.equal(middle.commit,undefined);
 tick(scheduler,frame);const last=tick(scheduler,frame);assert.ok(last.commit);assert.deepEqual(last.position,{x:0,y:0});
 assert.deepEqual(last.commit.inventory,[0,0,0,0]);assert.deepEqual(last.commit.pool.map(p=>[p.inventoryIndex,p.autoMerging]),[[0,false],[1,false]]);
 const result=sourceFishAutoMergeOnce(frame.fish,true,last.commit.pool);assert.equal(result.status,'supported');assert.deepEqual(result.value.fish.inventory,[0,0,1]);
 for(let i=0;i<10;i++)assert.equal(tick(scheduler,frame,.4).commit,undefined,'caller must commit inventory before more pairs');
});
test('pair filtering keeps drag, active, reserved, alert and max-grade exclusions and pending blocks whole pool',()=>{
 for(const [flag,value] of [['dragging',true],['active',false],['autoMerging',true],['currentAlertTarget',true]]){
  const frame=fixture();frame.pool[0][flag]=value;const step=tick(createSourceFishAutoMergeScheduler(),frame);assert.deepEqual(step.pair,{stationary:1,mover:2});
 }
 const pending=fixture();pending.pool[3].pendingDelete=true;assert.equal(tick(createSourceFishAutoMergeScheduler(),pending).phase,'idle');
 assert.equal(tick(createSourceFishAutoMergeScheduler(),fixture([12,12])).phase,'idle');
});
test('pending unrelated deletion delays commitment, invalid selected item releases reservation',()=>{
 const frame=fixture(),scheduler=createSourceFishAutoMergeScheduler();const first=tick(scheduler,frame);frame.pool[3].pendingDelete=true;
 const waiting=tick(scheduler,frame,.4);assert.equal(waiting.phase,'waiting');assert.equal(waiting.commit,undefined);assert.deepEqual(waiting.pair,first.pair);
 frame.pool[3].pendingDelete=false;assert.ok(tick(scheduler,frame,.01).commit);
 for(const change of [f=>{f.pool[1].dragging=true;},f=>{f.pool[1].active=false;},f=>{f.pool[1].autoMerging=false;},f=>{f.fish.inventory[1]=2;},f=>{f.pool[1].inventoryIndex=8;}]){
  const f=fixture(),s=createSourceFishAutoMergeScheduler(),start=tick(s,f);change(f);const out=tick(s,f);assert.equal(out.phase,'cancelled');assert.deepEqual(out.releasedPair,start.pair);assert.equal(out.commit,undefined);
 }
});
test('off, lost entitlement and hidden view release reserved pair; destroy is terminal',()=>{
 for(const change of [f=>{f.fish.autoMergeRequested=false;},f=>{f.plusPack2Active=false;},f=>{f.enabled=false;}]){
  const f=fixture(),s=createSourceFishAutoMergeScheduler(),start=tick(s,f);change(f);const out=tick(s,f);assert.equal(out.phase,'idle');assert.deepEqual(out.releasedPair,start.pair);assert.equal(out.commit,undefined);
 }
 const f=fixture(),s=createSourceFishAutoMergeScheduler(),start=tick(s,f);assert.deepEqual(s.cancel(),start.pair);assert.equal(tick(s,f,1).phase,'stopped');assert.equal(s.cancel(),undefined);
});
test('shared postcommit delay survives synchronous panel rebuild; explicit cancel clears it',()=>{
 const carry=createSourceFishAutoDelay(),f=fixture(),old=createSourceFishAutoMergeScheduler(carry);const commit=tick(old,f,.4).commit;assert.ok(commit);old.cancel();
 const fused=sourceFishAutoMergeOnce(f.fish,true,commit.pool);const next=fixture(fused.value.fish.inventory),rebuilt=createSourceFishAutoMergeScheduler(carry);
 assert.equal(tick(rebuilt,next,.1).phase,'cooldown');assert.equal(tick(rebuilt,next,.05).phase,'cooldown');
 assert.equal(tick(rebuilt,next,.01).phase,'cooldown');assert.equal(tick(rebuilt,next,.01).phase,'moving');
 assert.equal(carry.awaitingInventory,null);
 rebuilt.cancel(true);assert.deepEqual(carry,{remainingSec:0,awaitingInventory:null});
 assert.equal(SOURCE_FISH_AUTO_MERGE_PAIR_SECONDS,Math.fround(.15));
});
test('selected order remains stable through runtime validator and source grade-priority search',()=>{
 const f=fixture([2,2,0,0]),s=createSourceFishAutoMergeScheduler();f.pool=[f.pool[3],f.pool[2],f.pool[0],f.pool[1]];
 const commit=tick(s,f,.4).commit;assert.deepEqual(commit.pair,{stationary:3,mover:2});
 const meta=freshSourceMetaState();meta.fish=f.fish;meta.entitlements.plusPack2Active=true;
 const b={session:{...createSession(7),mode:'field'},activities:createActivityState(),platform:freshPlatformState(),meta};
 const result=runtimeSourceFishAutoMergeOnce(b,commit.pool);assert.equal(result.status,'granted');assert.deepEqual(result.meta.fish.inventory,[2,2,1]);
});
