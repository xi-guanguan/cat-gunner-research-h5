import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceMineSweep,sourceMineSweepAdBonus,sourceMineSweepGate,sourceMineSweepClose} from '../source-meta-actions.ts';
const state=()=>({diamonds:7,tickets:{used:0,storedDate:'2026-10-01'},bestReward:3,sweep:null});
const opts={plusPack2Active:true,plusPack1Active:false,minePack:false,automaticBonus:false,trustedToday:'2026-10-01',canRolloverDaily:true};
test('sweep gated before daily ticket refresh',()=>{const s={...state(),tickets:{used:2,storedDate:'2026-09-30'}};const r=sourceMineSweep(s,{...opts,plusPack2Active:false});assert.equal(r.state,s);assert.equal(r.recordDailyGain,false);assert.equal(r.missionEvent,null);assert.equal(sourceMineSweepGate(0,true).status,'blocked');assert.equal(sourceMineSweepGate(3,null).status,'unsupported');});
test('sweep refresh then atomic ticket/reward/task; float32 truncation',()=>{const s={...state(),tickets:{used:2,storedDate:'2026-09-30'}};const r=sourceMineSweep(s,{...opts,plusPack1Active:true});assert.equal(r.status,'granted');assert.deepEqual(r.state.tickets,{used:1,storedDate:'2026-10-01'});assert.equal(r.state.diamonds,11);assert.equal(r.recordDailyGain,true);assert.deepEqual(r.missionEvent,{type:3,amount:1});assert.equal(s.diamonds,7);assert.equal(s.tickets.used,2);});
test('exhaustion never pays nor emits task; MinePack raises limit to six',()=>{const s={...state(),tickets:{used:2,storedDate:opts.trustedToday}};const r=sourceMineSweep(s,opts);assert.equal(r.status,'blocked');assert.equal(r.state.diamonds,7);assert.equal(r.missionEvent,null);assert.equal(r.showMinePackPurchase,true);assert.equal(sourceMineSweep(s,{...opts,minePack:true}).status,'granted');});
test('ad bonus once, automatic four times cannot become seven times',()=>{const r=sourceMineSweep(state(),opts);assert.equal(sourceMineSweepAdBonus(r.state,false).status,'blocked');const b=sourceMineSweepAdBonus(r.state,true);assert.equal(b.value.diamonds,19);assert.equal(b.value.sweep.totalReward,12);assert.equal(sourceMineSweepAdBonus(b.value,true).status,'blocked');const a=sourceMineSweep(state(),{...opts,automaticBonus:true});assert.equal(a.state.diamonds,19);assert.equal(sourceMineSweepAdBonus(a.state,true).status,'blocked');assert.equal(sourceMineSweepAdBonus(sourceMineSweepClose(r.state),true).status,'blocked');});

import {sourcePassExpGet,sourceApplySeasonPass,sourcePassClaimGate,sourceClaimPassReward,sourceClaimLuxuryMission,sourceMissionReset,sourceSeasonReset,sourceClaimDailyGun,sourceDailyGunGate,sourceAutoMergeGate} from '../source-meta-actions.ts';
const pass=()=>({level:3,exp:20,vip:false,luxury:false,normalClaims:[false,false,false,false],epicClaims:[false,false,false,false],pendingAdRewardIndex:-1});
const season=()=>({...pass(),seasonNumber:4,seasonStarted:true,gunSeason:true,seasonEnd:'source-old-end',missionStart:'source-old-start',counters:[4,3,2,1],missionClaims:[{normal:true,luxury:false},{normal:true,luxury:true}]});
const ad={adConfirmed:false,adRemoved:false};
test('VIP/Luxury confirmed callbacks grant exact value, level progress and deduplicate receipts',()=>{
 const original={diamonds:8,pass:pass(),consumedReceipts:[]};assert.equal(sourceApplySeasonPass(original,'vip',{confirmed:false,receiptId:'a'}).status,'blocked');
 const vip=sourceApplySeasonPass(original,'vip',{confirmed:true,receiptId:'a'}).value;
 assert.equal(vip.diamonds,508);assert.equal(vip.pass.vip,true);assert.equal(vip.pass.luxury,false);assert.equal(vip.pass.level,3);
 const luxury=sourceApplySeasonPass(vip,'luxury-upgrade',{confirmed:true,receiptId:'b'}).value;
 assert.equal(luxury.diamonds,1508);assert.equal(luxury.pass.level,6);assert.equal(luxury.pass.exp,20);assert.equal(luxury.pass.luxury,true);
 assert.equal(sourceApplySeasonPass(luxury,'luxury-upgrade',{confirmed:true,receiptId:'b'}).status,'blocked');assert.equal(original.diamonds,8);
});
test('native Exp_Get retains remainder on reaching25 then ignores later awards',()=>{
 const r=sourcePassExpGet({...pass(),level:24,exp:70},300);assert.equal(r.level,25);assert.equal(r.exp,270);assert.equal(sourcePassExpGet(r,10),r);
});
test('VIP shared sequence requires both tracks; first reward order is free',()=>{
 const s={...pass(),vip:true};assert.equal(sourcePassClaimGate(s,1,0,ad).status,'supported');
 const c=sourceClaimPassReward(s,{amount:0},1,0,ad,w=>({amount:w.amount+5}));assert.equal(c.value.wallet.amount,5);assert.equal(c.value.pass.epicClaims[0],true);
 assert.equal(sourcePassClaimGate(c.value.pass,1,1,ad).reason,'previous-reward-required');
 const d=sourceClaimPassReward(c.value.pass,c.value.wallet,0,0,ad,w=>({amount:w.amount+10}));assert.equal(sourcePassClaimGate(d.value.pass,1,1,ad).status,'supported');assert.equal(s.normalClaims[0],false);
 assert.equal(sourcePassClaimGate(pass(),1,0,ad).reason,'vip-required');
});
test('failed reward consumer leaves claims unchanged; advertisement only on normal index3/6...',()=>{
 const s={...pass(),level:4,normalClaims:[true,true,true,false]};let calls=0;
 assert.equal(sourceClaimPassReward(s,{},0,3,ad,()=>{calls++;return {};}).reason,'ad-unconfirmed');assert.equal(calls,0);
 const r=sourceClaimPassReward(s,{},0,3,{...ad,adConfirmed:true},()=>{calls++;return null;});assert.equal(r.reason,'reward-consumer-failed');assert.equal(calls,1);assert.equal(s.normalClaims[3],false);
 assert.equal(sourcePassClaimGate(s,0,3,{...ad,adRemoved:null}).status,'unsupported');assert.equal(sourcePassClaimGate(s,0,3,{...ad,adRemoved:true}).status,'supported');
});
test('Luxury extra claim requires normal; float32 half uses banker rounding',()=>{
 const s={...season(),luxury:true,vip:true};const r=sourceClaimLuxuryMission(s,0,5);assert.equal(r.value.grantedExp,2);assert.equal(r.value.state.exp,22);
 assert.equal(sourceClaimLuxuryMission(r.value.state,0,5).reason,'already-claimed');assert.equal(sourceClaimLuxuryMission(s,0,7).value.grantedExp,4);
 assert.equal(sourceClaimLuxuryMission({...s,missionClaims:[{normal:false,luxury:false}]},0,7).reason,'normal-mission-reward-required');
});
test('daily mission reset preserves pass and entitlements; season reset clears them with explicit dates',()=>{
 const s={...season(),vip:true,luxury:true,normalClaims:[true,false,false,false],pendingAdRewardIndex:3};
 const m=sourceMissionReset(s,'source-now').value;assert.equal(m.vip,true);assert.equal(m.level,3);assert.deepEqual(m.normalClaims,s.normalClaims);assert.deepEqual(m.counters,[0,0,0,0]);assert.equal(m.missionStart,'source-now');assert.equal(m.missionClaims[1].luxury,false);
 const r=sourceSeasonReset(s,{incrementSeason:true,recordGain:true,trustedNow:'source-now',nextSeasonEnd:'source-next-end'}).value;assert.equal(r.state.seasonNumber,5);assert.equal(r.state.level,0);assert.equal(r.state.exp,0);assert.equal(r.state.vip,false);assert.equal(r.state.luxury,false);assert.equal(r.state.pendingAdRewardIndex,-1);assert.equal(r.state.seasonEnd,'source-next-end');assert.equal(r.recordSeasonGain,true);assert.equal(r.reapplyRewardBalance,true);assert.equal(s.vip,true);
 assert.equal(sourceSeasonReset(s,{incrementSeason:true,recordGain:true,trustedNow:'source-now',nextSeasonEnd:null}).status,'unsupported');
});
test('daily gun uses historic30, server config and first empty slot; full inventory keeps day available',()=>{
 const o={serverWeapon01AdOn:true,historicStage:30,trustedTodayKey:'source-key',adConfirmed:true,roll:0.999};
 const s={lastDailyGunKey:null,inventory:[{id:9},null,null]};const r=sourceClaimDailyGun(s,o,(id,slot)=>({id,slot})).value;assert.equal(r.gunId,9);assert.equal(r.slot,1);assert.equal(r.state.inventory.filter(Boolean).length,2);assert.equal(r.state.lastDailyGunKey,'source-key');assert.equal(s.lastDailyGunKey,null);
 assert.equal(sourceClaimDailyGun(r.state,o,()=>{throw Error('Must not create');}).reason,'daily-gun-already-claimed');
 const full={lastDailyGunKey:null,inventory:[{id:5}]};assert.equal(sourceClaimDailyGun(full,o,()=>{}).reason,'inventory-full');assert.equal(full.lastDailyGunKey,null);
 assert.equal(sourceDailyGunGate(null,{...o,historicStage:29}).reason,'historic-stage30-required');assert.equal(sourceDailyGunGate(null,{...o,serverWeapon01AdOn:null}).status,'unsupported');
});
test('auto merge entitlement and limit are exposed without pretending to run native coroutine',()=>{
 assert.equal(sourceAutoMergeGate(false,true,5,8).status,'blocked');assert.deepEqual(sourceAutoMergeGate(true,true,8,4).value,{active:true,limitDegree:3});assert.equal(sourceAutoMergeGate(true,false,8,12).value.limitDegree,6);
});
import {sourceNextSeasonEnd,sourceSeasonClosed} from '../source-meta-actions.ts';
test('native month addition clamps leap month and preserves clock instead of assuming30days',()=>{
 assert.equal(sourceNextSeasonEnd('2028-01-31T12:03:04.1234567+08:00').value,'2028-02-29T12:03:04.1234567+08:00');
 assert.equal(sourceNextSeasonEnd('2026-01-31T00:00:00Z').value,'2026-02-28T00:00:00Z');assert.equal(sourceNextSeasonEnd('2026-12-31T00:00:00').value,'2027-01-31T00:00:00');
 assert.equal(sourceNextSeasonEnd('2026-02-31T00:00:00').status,'unsupported');
});
test('season closes on the end date, after time gate and pending count checks',()=>{
 const o={seasonStarted:true,canGrantTimedReward:true,pendingCount:0,trustedToday:'2026-10-01',seasonEndDate:'2026-10-01'};
 assert.equal(sourceSeasonClosed(o).value,true);assert.equal(sourceSeasonClosed({...o,trustedToday:'2026-09-30'}).value,false);
 assert.equal(sourceSeasonClosed({...o,pendingCount:1}).value,false);assert.equal(sourceSeasonClosed({...o,canGrantTimedReward:false,pendingCount:null}).value,false);
 assert.equal(sourceSeasonClosed({...o,seasonStarted:false,canGrantTimedReward:null,trustedToday:null}).value,true);
});
