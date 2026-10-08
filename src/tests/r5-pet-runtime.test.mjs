import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession} from '../session';
import {createActivityState} from '../source-activities';
import {freshPlatformState} from '../local-platform';
import {freshSourceMetaState,decodeSourceMetaState,serializeSourceMetaState,runtimeSourcePetAction} from '../source-meta-runtime';
const fixture=()=>({session:{...createSession(),historicMax:110,diamonds:300},activities:createActivityState(),platform:{...freshPlatformState(),developerEnabled:true,freeAds:true},meta:freshSourceMetaState()});
const clock={today:()=> '2026-10-02',canRolloverDaily:()=>true};
test('pet runtime uses historical gate and atomic separate wallets; full inventory cannot debit',()=>{
 const b=fixture();b.session.historicMax=109;assert.equal(runtimeSourcePetAction(b,'draw','diamonds').status,'blocked');b.session.historicMax=110;
 let n=runtimeSourcePetAction(b,'draw','diamonds');assert.equal(n.status,'granted');assert.equal(n.session.diamonds,200);assert.equal(n.meta.pet.owned[0],0);assert.equal(b.session.diamonds,300);
 assert.equal(runtimeSourcePetAction(n,'draw','petCoin').status,'blocked');n.meta.petCoin=100;n=runtimeSourcePetAction(n,'draw','petCoin');assert.equal(n.meta.petCoin,0);assert.equal(n.session.diamonds,200);
 n.meta.pet.owned.fill(0);const full=runtimeSourcePetAction(n,'draw','diamonds');assert.equal(full.status,'blocked');assert.equal(full.session.diamonds,200);
});
test('pet merge/equip/unequip saves fixed holes and native dispatch locks',()=>{
 let b=fixture();b.meta.pet.owned[1]=b.meta.pet.owned[9]=0;b=runtimeSourcePetAction(b,'merge',{a:1,b:9});assert.equal(b.meta.pet.owned[1],-1);assert.equal(b.meta.pet.owned[9],1);
 b.meta.pet.ownedLocks[9]=7;b=runtimeSourcePetAction(b,'equip',{a:9,b:0});assert.equal(b.meta.pet.selectedLocks[0],7);b=runtimeSourcePetAction(b,'unequip',0);assert.equal(b.meta.pet.ownedLocks[0],7);
 const restored=decodeSourceMetaState(serializeSourceMetaState(b.meta));assert.deepEqual(restored.pet,b.meta.pet);assert.deepEqual(restored.hunt,{wave:0,level:0,run:null});
});
test('pet daily local receipt is one grant; canceled/full/locked never consume receipt',()=>{
 let b=fixture();assert.equal(runtimeSourcePetAction(b,'daily-ad',null,clock,'r1').status,'blocked');assert.equal(b.platform.sequence,0);b.meta.hunt.level=1;
 b=runtimeSourcePetAction(b,'daily-ad',null,clock,'r1');assert.equal(b.status,'granted');assert.equal(b.meta.pet.owned[0],1);assert.equal(b.platform.audit.at(-1).kind,'ad');assert.equal(b.platform.sequence,1);
 assert.equal(runtimeSourcePetAction(b,'daily-ad',null,clock,'r1').status,'blocked');assert.equal(runtimeSourcePetAction(b,'daily-ad',null,clock,'r2').status,'blocked');assert.equal(b.platform.sequence,1);
 const c=fixture();c.meta.hunt.level=1;c.platform.freeAds=false;assert.equal(runtimeSourcePetAction(c,'daily-ad',null,clock,'cancel').status,'blocked');assert.equal(c.meta.pet.dailyLastDate,'');
});
test('meta absence migrates, malformed pet/hunt wallets are rejected; active hunt is not persisted',()=>{
 const legacy=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));delete legacy.pet;delete legacy.petCoin;delete legacy.hunt;assert.deepEqual(decodeSourceMetaState(JSON.stringify(legacy)).pet,freshSourceMetaState().pet);
 for(const mutate of [s=>s.pet=null,s=>s.pet.ownedLocks=[],s=>s.petCoin=-1,s=>s.hunt.level=5,s=>s.hunt.run={}]){const bad=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));mutate(bad);assert.throws(()=>decodeSourceMetaState(JSON.stringify(bad)));}
 const live=freshSourceMetaState();live.hunt.run={phase:'playing'};assert.equal(decodeSourceMetaState(serializeSourceMetaState(live)).hunt.run,null);
});
import {sourcePetLocalDate} from '../source-meta-runtime';
import {sessionCombatModifiers} from '../session';
import {sourcePetSelectedStats} from '../r5-pet';
import {sourceMoveSpeedFromRawStatSlots} from '../cat-movement-source';
import {tick,createLevel,walletValue} from '../rules';
import {BigValue} from '../big-value';
test('pet source date formatting strips adapter prefix and rejects invalid calendar dates',()=>{
 assert.equal(sourcePetLocalDate('h5-local:2026-10-01'),'20261001');assert.equal(sourcePetLocalDate('2026-02-29'),'');assert.equal(sourcePetLocalDate(''),'');
});
test('equipped pet money reaches actual kill payout in source order; move stat reaches Cat movement',()=>{
 const b=fixture();b.meta.pet.selected=[0,2,9];b.meta.entitlements.buffPack=true;
 const stats=sourcePetSelectedStats(b.meta.pet),mods=sessionCombatModifiers(b.session,b.meta.entitlements,b.meta.fish,b.meta.pet);
 assert.ok(mods.petMoneyPercent.eq(stats.moneyMultiplierPercent));assert.equal(mods.petMoveSpeedPercent,202);
 const state=createLevel(0,0,0);state.autoMove=true;state.combatModifiers=mods;state.targets=[];state.shootCooldown=999;
 const moved=tick(state,.01,{moveX:1,moveY:0});assert.equal(moved.actors[0].velocity.x,sourceMoveSpeedFromRawStatSlots(false,{slot5d5d4d0Static20:202,slot5d5d4d8Static60:0}));
 state.targets=[{id:1,position:{...state.player},health:1,maxHealth:1,coin:100,radius:1,healthValue:BigValue.fromInteger(1),maxHealthValue:BigValue.fromInteger(1),coinValue:BigValue.fromInteger(100)}];
 state.projectiles=[{id:777,position:{...state.player},velocity:{x:0,y:0},damage:1,damageValue:BigValue.fromInteger(1),remainingRange:1,distanceTraveled:0,gunSlot:0}];
 const paid=tick(state,0);assert.ok(walletValue(paid).eq(BigValue.fromInteger(100).nativeMultiply(4).nativeMultiply(stats.moneyMultiplierPercent).nativeDivide(100)));
});
