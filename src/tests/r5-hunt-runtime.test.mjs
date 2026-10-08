import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,sourceGun} from '../session';
import {createActivityState} from '../source-activities';
import {freshPlatformState} from '../local-platform';
import {freshSourceMetaState,runtimeSourceHuntPower,runtimeSourceHuntAction,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {sourceHuntSweepRequiredPower} from '../r5-hunt';
const fixture=()=>({session:{...createSession(),historicMax:110,equippedGuns:[sourceGun(25),null,null]},activities:createActivityState(),platform:{...freshPlatformState(),developerEnabled:true,freeAds:true},meta:freshSourceMetaState()});
test('Hunt sweep gate and native type power; grant is atomic and run cannot be paid twice',()=>{
 let b=fixture();assert.equal(runtimeSourceHuntAction(b,'sweep').status,'blocked');b.meta.entitlements.plusPack2Active=true;b.session.historicMax=109;assert.equal(runtimeSourceHuntAction(b,'sweep').status,'blocked');b.session.historicMax=110;
 assert.ok(runtimeSourceHuntPower(b).gt(sourceHuntSweepRequiredPower(0,0)));const n=runtimeSourceHuntAction(b,'sweep');assert.equal(n.status,'granted');assert.equal(n.meta.petCoin,n.meta.hunt.run.clearedLevels*30);assert.equal(b.meta.petCoin,0);
 const repeat=runtimeSourceHuntAction(n,'sweep');assert.equal(repeat.status,'blocked');assert.equal(repeat.meta.petCoin,n.meta.petCoin);
 const saved=decodeSourceMetaState(serializeSourceMetaState(n.meta));assert.equal(saved.hunt.run,null);assert.equal(saved.petCoin,n.meta.petCoin);assert.equal(saved.hunt.wave,n.meta.hunt.wave);
});
test('Hunt Plus1 and automatic2x grants base once; exit does not change wallet',()=>{
 let b=fixture();Object.assign(b.meta.entitlements,{plusPack1Active:true,plusPack2Active:true,automaticBonus:true});b=runtimeSourceHuntAction(b,'sweep');assert.equal(b.meta.petCoin,b.meta.hunt.run.clearedLevels*120);
 const amount=b.meta.petCoin;b=runtimeSourceHuntAction(b,'exit');assert.equal(b.meta.petCoin,amount);assert.equal(b.meta.hunt.run,null);
});
