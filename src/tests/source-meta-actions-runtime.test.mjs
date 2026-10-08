import test from 'node:test';import assert from 'node:assert/strict';
import {createSession} from '../session.ts';import {createActivityState,decodeActivityState,serializeActivityState,ACTIVITY_MISSIONS} from '../source-activities.ts';import {freshPlatformState} from '../local-platform.ts';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState,developerSourceMetaPass,developerSourceMetaEntitlement,runtimeSourceMineSweep,developerSourceMineSweepBonus,closeSourceMineSweep,runtimeSourcePassClaim,runtimeSourceMissionClaim} from '../source-meta-runtime.ts';
const bundle=()=>({session:{...createSession(),overlay:'none',diamonds:0},activities:createActivityState(),platform:{...freshPlatformState(),developerEnabled:true},meta:freshSourceMetaState()});
const time={today:()=> 'h5-local:2026-10-01',canRolloverDaily:()=>true,evidence:'test date adapter'};
test('bridge refuses unconfirmed providers; VIP/epic consume actual source gun entities',()=>{
 const b=bundle();assert.equal(developerSourceMetaPass({...b,platform:{...b.platform,developerEnabled:false}},'vip').status,'blocked');
 let r=developerSourceMetaPass(b,'luxury');assert.equal(r.session.diamonds,1000);assert.equal(r.activities.passExp,300);assert.equal(r.meta.vip,true);assert.equal(r.meta.luxury,true);
 for(let i=0;i<3;i++){r=runtimeSourcePassClaim(r,0,i);assert.equal(r.status,'granted');r=runtimeSourcePassClaim(r,1,i);assert.equal(r.status,'granted');}
 assert.equal(r.session.gunInventory.length,b.session.gunInventory.length+2);assert.deepEqual(r.meta.epicClaims,[0,1,2]);assert.deepEqual(r.activities.passClaims,[0,1,2]);assert.deepEqual(decodeActivityState(serializeActivityState(r.activities)),r.activities);assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(r.meta)),r.meta);
});
test('bridge sweep atomically updates tickets diamonds mission once and ad bonus once',()=>{
 let b=bundle();b.session.mine={...b.session.mine,bestReward:10,tickets:{used:0,storedDate:time.today()}};assert.equal(runtimeSourceMineSweep(b,time).status,'blocked');
 b=developerSourceMetaEntitlement(b,'plusPack2Active');const r=runtimeSourceMineSweep(b,time);assert.equal(r.status,'granted');assert.equal(r.session.mine.tickets.used,1);assert.equal(r.session.diamonds,10);assert.equal(r.activities.counters['mine-played'],1);assert.equal(runtimeSourceMineSweep(r,time).status,'blocked');
 const ad=developerSourceMineSweepBonus(r);assert.equal(ad.session.diamonds,40);assert.equal(ad.activities.counters['mine-played'],1);assert.equal(developerSourceMineSweepBonus(ad).status,'blocked');
 const next=runtimeSourceMineSweep(closeSourceMineSweep(ad),time);assert.equal(next.session.mine.tickets.used,2);assert.equal(next.activities.counters['mine-played'],2);
});
test('bridge inventory full leaves advanced claim and balance untouched',()=>{
 let b=developerSourceMetaPass(bundle(),'luxury');for(let i=0;i<2;i++){b=runtimeSourcePassClaim(b,0,i);b=runtimeSourcePassClaim(b,1,i);}
 b={...b,session:{...b.session,gunInventory:Array.from({length:16},()=>b.session.gunInventory[0])}};
 const r=runtimeSourcePassClaim(b,1,2);assert.equal(r.status,'blocked');assert.equal(r.session,b.session);assert.deepEqual(r.meta.epicClaims,[0,1]);assert.equal(r.session.diamonds,b.session.diamonds);
});
test('VIP missions stay in extension so legacy ActivityState decoder remains valid',()=>{
 const mission=ACTIVITY_MISSIONS.find(m=>m.requiresVip);assert.ok(mission);
 let b=developerSourceMetaPass(bundle(),'luxury');b={...b,activities:{...b.activities,counters:{...b.activities.counters,[mission.counter]:mission.goal}}};
 const r=runtimeSourceMissionClaim(b,mission.id);assert.equal(r.status,'granted');assert.ok(r.meta.vipMissionClaims.includes(mission.id));assert.equal(r.activities.missionClaims.includes(mission.id),false);assert.deepEqual(decodeActivityState(serializeActivityState(r.activities)),r.activities);
 const bonus=runtimeSourceMissionClaim(r,mission.id,true);assert.equal(bonus.status,'granted');assert.equal(runtimeSourceMissionClaim(bonus,mission.id,true).status,'blocked');assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(bonus.meta)),bonus.meta);
});
