import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,sourceGun} from '../session.ts';
import {freshSourceEntitlements} from '../r5-entitlements.ts';
import {freshSourcePlus,sourcePlusEntitlements,SOURCE_PLUS_DURATION_MS,sourceWeeklyReward,sourcePlusReward} from '../r6-weekly.ts';
import {sourceBossTimeMax,sourceBossReward,sourceBossEnter,freshSourceBossState} from '../r5-boss.ts';
import {mineSettlement} from '../meta-progression.ts';
import {raidTimeBonus} from '../r5-raid.ts';
import {createSourceGunAutoMergeScheduler,sourceGunAutoPool,sourceGunAutoMergeOnce} from '../r5-gun-auto.ts';
import {freshSourcePetState,sourcePetWithIdentities} from '../r5-pet.ts';
import {createSourcePetAutoScheduler} from '../r6-pet-auto.ts';
const start=Date.UTC(2026,9,2,8),end=start+SOURCE_PLUS_DURATION_MS;
const pack={...freshSourcePlus(),purchasedUTC:[start,start,start]};
const rights=t=>sourcePlusEntitlements(pack,freshSourceEntitlements(),t);
test('Plus strict seven-day boundary feeds boss time/reward, mine float32 payout and raid time bonus independently',()=>{
 const on=rights(end-1),off=rights(end);
 assert.equal(sourceBossTimeMax(on),120);assert.equal(sourceBossTimeMax(off),60);
 assert.equal(sourceBossReward(on),300);assert.equal(sourceBossReward(off),150);
 assert.equal(raidTimeBonus(on.plusPack0Active),10);assert.equal(raidTimeBonus(off.plusPack0Active),0);
 const mine=e=>mineSettlement({diaScore:159,bestReward:0,plusPack1Active:e.plusPack1Active,automaticBonus:false}).value;
 assert.equal(mine(on).baseReward,15);assert.equal(mine(on).initialReward,22);assert.equal(mine(off).initialReward,15);
 for(let item=0;item<3;item++){const p={...freshSourcePlus(),purchasedUTC:[null,null,null]};p.purchasedUTC[item]=start;const e=sourcePlusEntitlements(p,freshSourceEntitlements(),start);assert.equal(sourceBossTimeMax(e),item===0?120:60);assert.equal(sourceBossReward(e),item===1?300:150);}
});
test('boss run snapshots time at entry; Plus expiry does not rewrite an existing battle timer',()=>{
 const before=sourceBossEnter(freshSourceBossState(),rights(end-1));assert.equal(before.status,'supported');assert.equal(before.value.run.remainingSec,120);
 const after=sourceBossEnter(freshSourceBossState(),rights(end));assert.equal(after.value.run.remainingSec,60);assert.equal(before.value.run.remainingSec,120);
});
test('Plus expiry releases gun pair in motion, no commit/debit; renewal starts with native initial yield',()=>{
 const session={...createSession(4),gunUnlocked:true,mode:'field',overlay:'gun',catalogSeen:[30],gunInventory:[sourceGun(0),sourceGun(3)]};
 const state={autoMergeRequested:true,configuredDegree:6},scheduler=createSourceGunAutoMergeScheduler();
 const frame=t=>({session,state,plusPack2Active:rights(t).plusPack2Active,pool:sourceGunAutoPool(session),positions:[{x:0,y:0},{x:400,y:0}],deltaSec:.02});
 assert.equal(scheduler.tick(frame(end-2)).phase,'initial');const moving=scheduler.tick(frame(end-1));assert.equal(moving.phase,'moving');
 const expired=scheduler.tick(frame(end));assert.equal(expired.phase,'idle');assert.ok(expired.releasedPair);assert.equal(expired.commit,undefined);assert.equal(session.gunInventory.length,2);
 assert.equal(scheduler.tick(frame(end-1)).phase,'initial');assert.equal(scheduler.tick(frame(end-1)).phase,'moving');
 const ready=scheduler.tick({...frame(end-1),deltaSec:.5});assert.ok(ready.commit);
 const rejected=sourceGunAutoMergeOnce(session,state,rights(end).plusPack2Active,ready.commit);assert.equal(rejected.status,'blocked');assert.equal(rejected.session,session);
});
test('Plus expiry cancels pet motion, preserves IDs/locks; renewal must reacquire current unlocked pair',()=>{
 let state=freshSourcePetState();state.owned[0]=state.owned[1]=0;state.collect[2]=true;state=sourcePetWithIdentities(state);
 const scheduler=createSourcePetAutoScheduler(),auto={requested:true,configuredDegree:6};
 const frame=t=>({state,auto,plus2:rights(t).plusPack2Active,pool:[0,1].map(slot=>({slot,active:true,dragging:false,autoMerging:false,reserved:false})),positions:[{x:0,y:0},{x:300,y:0}],dt:.02,enabled:true,dragging:false});
 const snapshot=structuredClone(state);assert.equal(scheduler.tick(frame(end-1)).phase,'moving');const expired=scheduler.tick(frame(end));assert.equal(expired.phase,'idle');assert.equal(expired.commit,undefined);assert.deepEqual(state,snapshot);
 state.ownedLocks[0]=2;assert.equal(scheduler.tick(frame(end-1)).phase,'idle');state.ownedLocks[0]=-1;assert.equal(scheduler.tick(frame(end-1)).phase,'moving');
});
for(const id of ['', '  ', null, 4])test(`weekly/Plus reject invalid request id ${JSON.stringify(id)} without mutations`,()=>{
 const s=createSession(),e=freshSourceEntitlements(),r={id,item:0,kind:'purchase',purpose:'catgunner_dailygun_0'},response={...r,status:'success',provider:'local-test',onlineVerified:false};
 assert.equal(sourceWeeklyReward(s,0,r,response,new Date(start)).status,'blocked');const p={...r,purpose:'catgunner_pluspack_0'};assert.equal(sourcePlusReward(s,e,p,{...response,purpose:p.purpose},start).status,'blocked');
});
