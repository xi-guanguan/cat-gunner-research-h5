import {BigValue} from '../big-value.ts';
import {freshSourceEntitlements,sourceEntitlementCombatModifiers} from '../r5-entitlements.ts';
import test from 'node:test';import assert from 'node:assert/strict';
import {freshSourceFishState,decodeSourceFishState,sourceFishRollGrade,sourceFishDraw,sourceFishFusion,sourceFishTotals,sourceFishCombatModifiers,SOURCE_FISH_INFO} from '../r5-fish.ts';
import {freshSourceMetaState,decodeSourceMetaState,serializeSourceMetaState,runtimeSourceFishDraw,runtimeSourceFishFusion} from '../source-meta-runtime.ts';
import {createSession,sessionCombatModifiers} from '../session.ts';import {createActivityState} from '../source-activities.ts';import {freshPlatformState} from '../local-platform.ts';
const options={trustedTodayKey:'h5-local:2026-10-01',canRolloverDaily:true,adConfirmed:false,roll:0};
const time={today:()=>options.trustedTodayKey,canRolloverDaily:(category,stored,today)=>{assert.equal(category,3);assert.equal(today,options.trustedTodayKey);return stored===''||today>stored;},evidence:'test local date'};
const bundle=()=>({session:{...createSession(19),overlay:'none',diamonds:200},activities:createActivityState(),platform:freshPlatformState(),meta:freshSourceMetaState()});
test('source probability boundaries use strict float thresholds, base shift and inclusive100 fallback',()=>{
 for(const [roll,grade]of [[0,0],[.599,0],[.6,1],[.899,1],[.9,2],[.999,2],[1,0]]){assert.equal(sourceFishRollGrade(0,roll),grade);assert.equal(sourceFishRollGrade(1,roll),grade+1);}
 assert.throws(()=>sourceFishRollGrade(0,NaN),RangeError);
});
test('fish daily3 free2 confirmed ad, full capacity and same date do not invent draws',()=>{
 const initial=freshSourceFishState();let fish=initial;
 for(let i=0;i<3;i++){const r=sourceFishDraw(fish,200,'free',options);assert.equal(r.status,'granted');assert.equal(r.diamonds,200);fish=r.fish;}
 assert.equal(sourceFishDraw(fish,200,'free',options).reason,'fish-ad-unconfirmed');
 for(let i=0;i<2;i++)fish=sourceFishDraw(fish,200,'free',{...options,adConfirmed:true}).fish;
 assert.equal(sourceFishDraw(fish,200,'free',{...options,adConfirmed:true}).reason,'fish-daily-limit');assert.equal(fish.inventory.length,5);assert.equal(initial.inventory.length,0);
 const full={...fish,inventory:Array(20).fill(0)};assert.equal(sourceFishDraw(full,200,'premium',options).reason,'fish-inventory-full');
 const reset=sourceFishDraw(full,200,'free',{...options,trustedTodayKey:'h5-local:2026-10-02'});assert.equal(reset.status,'blocked');assert.equal(reset.recordDailyGain,true);assert.equal(reset.fish.freeCount,0);
});
test('premium200 independent daily count; backwards or untrusted date never grants a rollover',()=>{
 const fish={...freshSourceFishState(),freeDate:options.trustedTodayKey,freeCount:5};
 assert.equal(sourceFishDraw(fish,199,'premium',options).reason,'fish-diamonds-insufficient');
 const p=sourceFishDraw(fish,200,'premium',options);assert.equal(p.status,'granted');assert.equal(p.diamonds,0);assert.equal(p.grade,1);assert.equal(p.fish.freeCount,5);assert.equal(p.recordDailyGain,false);
 assert.equal(sourceFishDraw(fish,200,'free',{...options,trustedTodayKey:'h5-local:2026-09-30'}).reason,'fish-clock-went-backwards');
 assert.equal(sourceFishDraw(fish,200,'free',{...options,trustedTodayKey:null}).status,'unsupported');
 assert.equal(sourceFishDraw(fish,200,'free',{...options,trustedTodayKey:'h5-local:2026-10-02',canRolloverDaily:false}).reason,'fish-daily-limit');
});
test('native fusion removes both positions then appends output, duplicates sum and max grade stays intact',()=>{
 const fish={...freshSourceFishState(),inventory:[0,3,0,2]};const r=sourceFishFusion(fish,2,0);assert.equal(r.status,'supported');assert.deepEqual(r.value.fish.inventory,[3,2,1]);assert.equal(r.value.index,0);assert.deepEqual(fish.inventory,[0,3,0,2]);
 assert.equal(sourceFishFusion(fish,0,0).status,'blocked');assert.equal(sourceFishFusion(fish,0,1).reason,'fish-fusion-grade-mismatch');assert.equal(sourceFishFusion({...fish,inventory:[12,12]},0,1).reason,'fish-max-grade');
 const duplicate={...fish,inventory:[0,0]};assert.deepEqual(sourceFishTotals(duplicate),{damagePercent:8,criticalChancePercent:2,criticalDamagePercent:16});
 const base=sessionCombatModifiers(createSession(19));const mods=sourceFishCombatModifiers(base,duplicate);assert.equal(mods.permanentDamagePercent,base.permanentDamagePercent);assert.equal(mods.fishDamagePercent,108);assert.equal(mods.criticalDamagePercent,141);assert.equal(sourceFishCombatModifiers(base,freshSourceFishState()).fishDamagePercent,100);
 assert.equal(SOURCE_FISH_INFO[12].damagePercent,2100000);assert.equal(sourceFishTotals({...fish,inventory:[6,6]}).criticalChancePercent,200);
});
test('runtime draw saves inventory rng diamonds daily count receipt together and blocks replay',()=>{
 let b=bundle();const initialRng=b.session.rngState;
 for(let i=0;i<3;i++){const r=runtimeSourceFishDraw(b,'free',time,String(i));assert.equal(r.status,'granted');b=r;}
 const blocked=runtimeSourceFishDraw(b,'free',time,'4');assert.equal(blocked.status,'blocked');assert.equal(blocked.session.rngState,b.session.rngState);assert.equal(blocked.session.diamonds,200);assert.notEqual(b.session.rngState,initialRng);
 b={...b,platform:{...b.platform,developerEnabled:true}};const ad=runtimeSourceFishDraw(b,'free',time,'4');assert.equal(ad.status,'granted');assert.equal(ad.meta.fish.freeCount,4);assert.equal(ad.platform.audit.at(-1).kind,'ad');assert.equal(runtimeSourceFishDraw(ad,'free',time,'4').status,'blocked');
 const premium=runtimeSourceFishDraw(ad,'premium',time,'p');assert.equal(premium.session.diamonds,0);assert.equal(premium.meta.fish.freeCount,4);assert.equal(premium.meta.fishDailyGainDates.length,1);
 assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(premium.meta)),premium.meta);
 const f=runtimeSourceFishFusion({...premium,meta:{...premium.meta,fish:{...premium.meta.fish,inventory:[0,0]}}},0,1);assert.equal(f.status,'granted');assert.deepEqual(f.meta.fish.inventory,[1]);
});
test('explicit malformed fish envelopes fail closed and old absent fish migrate empty',()=>{
 const old=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));delete old.fish;delete old.fishDailyGainDates;assert.deepEqual(decodeSourceMetaState(JSON.stringify(old)).fish,freshSourceFishState());
 for(const v of [null,{...freshSourceFishState(),inventory:[13]},{...freshSourceFishState(),inventory:Array(21).fill(0)},{...freshSourceFishState(),freeCount:6},{...freshSourceFishState(),freeDate:'h5-local:2026-02-30'}])assert.throws(()=>decodeSourceFishState(v));
 assert.throws(()=>decodeSourceMetaState(JSON.stringify({...old,fish:null})));
});

test('damage modifiers preserve independent native stages; G precedes power buff and CriDmg ends in G',()=>{
 const base={...sessionCombatModifiers(createSession(19)),sentinel:'preserved'};
 const mods=sourceFishCombatModifiers(sourceEntitlementCombatModifiers(base,{...freshSourceEntitlements(),buffPack:true}),{...freshSourceFishState(),inventory:[0]});
 assert.equal(mods.permanentDamagePercent,base.permanentDamagePercent);assert.equal(mods.damageBuffMultiplier,4);
 assert.equal(mods.fishDamagePercent,104);assert.equal(mods.criticalDamagePercent,133);assert.equal(mods.sentinel,'preserved');
 // Contract witness: 1.75 is the value after fish/relic before ordinary G; star/raid are identity here.
 const beforeG=BigValue.from(1.75),damage=beforeG.truncateInteger().nativeMultiply(mods.damageBuffMultiplier);
 assert.equal(damage.toNumber(),4);assert.equal(beforeG.nativeMultiply(4).truncateInteger().toNumber(),7);
 const critical=damage.nativeMultiply(mods.criticalDamagePercent).nativeDivide(100).nativeMultiply(100).nativeDivide(100).truncateInteger();
 assert.equal(critical.toNumber(),5);
});
