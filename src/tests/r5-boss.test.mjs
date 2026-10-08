import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {BigValue} from '../big-value.ts';
import {freshSourceBossState,sourceBossHealth,sourceBossSkin,sourceBossTimeMax,sourceBossReward,sourceBossEnter,sourceBossWin,sourceBossFail,sourceBossTick,sourceBossExit,sourceBossBonus,sourceBossSweep,sourceBossSweepAble,sourceBossSweepRequiredPower,sourceBossSweepEfficiency,serializeSourceBossState,decodeSourceBossState} from '../r5-boss.ts';
const normal={plusPack0Active:false,plusPack1Active:false,automaticBonus:false};
const enter=(state=freshSourceBossState(),e=normal)=>{const r=sourceBossEnter(state,e);assert.equal(r.status,'supported');return r.value;};
test('HP recurrence matches all1000 original serialized rows and keeps >Number-range values',()=>{
 const rows=JSON.parse(readFileSync('artifacts/evidence/round5-20261001/boss-health-serialized.json','utf8')).rows;
 for(let stage=0;stage<rows.length;stage++)assert.deepEqual(sourceBossHealth(stage).toJSON(),rows[stage],`stage${stage}`);
 let next=sourceBossHealth(999);for(let stage=1000;stage<=1040;stage++){next=next.nativeMultiply(BigValue.fromInteger(5)).significant(2);assert.ok(sourceBossHealth(stage).eq(next));}
 assert.equal(sourceBossHealth(0).toNumber(),50000);assert.ok(sourceBossHealth(1000).order>698);assert.equal(sourceBossHealth(1000).toNumber(),Infinity);
 for(const n of [-1,.5,NaN,2147483648])assert.throws(()=>sourceBossHealth(n),RangeError);
});
test('nine skin cycle, native60 second timer, Plus0 doubles time and Plus1 independently doubles reward',()=>{
 assert.equal(sourceBossSkin(0),0);assert.equal(sourceBossSkin(8),8);assert.equal(sourceBossSkin(9),0);
 assert.equal(sourceBossTimeMax(normal),60);assert.equal(sourceBossTimeMax({...normal,plusPack0Active:true}),120);
 assert.equal(sourceBossReward({...normal,plusPack0Active:true}),150);assert.equal(sourceBossReward({...normal,plusPack1Active:true}),300);
});
test('enter has no grant/debit; win guards duplicate settlement and increments only once',()=>{
 const initial=freshSourceBossState(),run=enter(initial);assert.deepEqual(initial,freshSourceBossState());assert.equal(run.run.playedStage,0);
 assert.equal(sourceBossEnter(run).reason,'boss-run-open');const win=sourceBossWin(run,normal);assert.equal(win.diamondGrant,150);assert.equal(win.resultCode,1);assert.equal(win.value.stage,1);
 assert.equal(sourceBossWin(win.value).reason,'boss-not-playing');assert.equal(sourceBossFail(win.value).status,'blocked');assert.equal(sourceBossEnter(win.value).reason,'boss-run-open');
 const exit=sourceBossExit(win.value);assert.equal(exit.diamondGrant,0);assert.equal(exit.resultCode,undefined);assert.equal(exit.value.run,null);assert.equal(enter(exit.value).run.playedStage,1);
});
test('fail and early exit preserve stage; result codes are3 and2 and never send another result',()=>{
 const run=enter({stage:23,run:null});const failed=sourceBossFail(run);assert.equal(failed.resultCode,3);assert.equal(failed.value.stage,23);assert.equal(failed.diamondGrant,0);
 assert.equal(sourceBossExit(failed.value).resultCode,undefined);assert.equal(sourceBossExit(run).resultCode,2);assert.equal(sourceBossExit(freshSourceBossState()).status,'blocked');
});
test('timer uses float32 subtraction and checks timeout before current frame subtraction',()=>{
 let state=enter();let r=sourceBossTick(state,60);assert.equal(r.value.run.phase,'playing');assert.equal(r.value.run.remainingSec,0);
 r=sourceBossTick(r.value,0);assert.equal(r.value.run.phase,'failed');assert.equal(r.resultCode,3);assert.equal(r.diamondGrant,0);assert.equal(r.value.stage,0);
 assert.equal(sourceBossTick(state,.1).value.run.remainingSec,Math.fround(Math.fround(60)-Math.fround(.1)));
 assert.throws(()=>sourceBossTick(state,NaN),RangeError);assert.throws(()=>sourceBossTick(state,-1),RangeError);
});
test('confirmed reward callback adds2x to the already paid1x; close atomically prevents replay',()=>{
 const won=sourceBossWin(enter(),normal);assert.equal(sourceBossBonus(won.value,false).reason,'boss-ad-unconfirmed');
 const bonus=sourceBossBonus(won.value,true);assert.equal(bonus.diamondGrant,300);assert.equal(won.diamondGrant+bonus.diamondGrant,450);assert.equal(bonus.value.run,null);
 assert.equal(sourceBossBonus(bonus.value,true).reason,'boss-bonus-unavailable');assert.equal(sourceBossBonus(enter(),true).status,'blocked');
 const e={...normal,plusPack1Active:true,automaticBonus:true};const auto=sourceBossWin(enter(freshSourceBossState(),e),e);assert.equal(auto.diamondGrant,900);assert.equal(sourceBossBonus(auto.value,true).status,'blocked');
});
test('sweep uses native divisor42/84 with H5; strict comparison rejects equal power and no extra ticket rule',()=>{
 const threshold=sourceBossSweepRequiredPower(0,normal);assert.ok(threshold.eq(1190));assert.ok(sourceBossSweepRequiredPower(0,{...normal,plusPack0Active:true}).eq(590));
 assert.equal(sourceBossSweepAble(0,threshold,normal),false);assert.equal(sourceBossSweep(freshSourceBossState(),threshold,normal).reason,'boss-sweep-power-insufficient');
 assert.equal(sourceBossSweepEfficiency(0,threshold,normal),100);assert.equal(sourceBossSweepEfficiency(0,0,normal),0);assert.equal(sourceBossSweepEfficiency(0,-100,normal),0);
 const swept=sourceBossSweep(freshSourceBossState(),threshold.add(1),normal);assert.equal(swept.status,'supported');assert.equal(swept.diamondGrant,150);assert.equal(swept.value.stage,1);assert.equal(swept.value.run.mode,'sweep');
 assert.equal(sourceBossSweep(swept.value,'1e99',normal).reason,'boss-run-open');assert.equal(sourceBossBonus(swept.value,true).diamondGrant,300);
});
test('native save roundtrip preserves only Boss_Stage and discards run or pending bonus',()=>{
 const won=sourceBossWin(enter({stage:99,run:null}),normal);assert.equal(serializeSourceBossState(won.value),'{"Boss_Stage":100}');
 assert.deepEqual(decodeSourceBossState(serializeSourceBossState(won.value)),{stage:100,run:null});assert.deepEqual(decodeSourceBossState({Boss_Stage:2147483647}),{stage:2147483647,run:null});
 for(const bad of [null,[],{}, {Boss_Stage:-1},{Boss_Stage:.1},{Boss_Stage:'1'},{Boss_Stage:2147483648}])assert.throws(()=>decodeSourceBossState(bad));
 assert.equal(sourceBossEnter({stage:2147483647,run:null}).reason,'boss-health-outside-h5-range');
});
