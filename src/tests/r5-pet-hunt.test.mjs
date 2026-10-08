import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {BigValue} from '../big-value.ts';
import * as pet from '../r5-pet.ts';import * as hunt from '../r5-hunt.ts';
const scene=JSON.parse(readFileSync('artifacts/evidence/round5-20261001/pet-hunt-scene-raw.json','utf8'));
const e={plusPack1Active:false,plusPack2Active:false,automaticBonus:false};
function supported(r){assert.equal(r.status,'supported',r.reason);return r.value;}
test('Pet runtime recurrence matches every serialized grade; selected buffs include100 baseline',()=>{
 for(let i=0;i<10;i++){const stats=pet.sourcePetStats(i);assert.ok(stats.money.eq(BigValue.fromJSON(scene.pet.stats[i].money)),`grade${i}`);assert.equal(stats.moveSpeed,scene.pet.stats[i].moveSpeed);}
 const s=pet.freshSourcePetState();assert.equal(pet.sourcePetSelectedStats(s).moneyMultiplierPercent.toNumber(),100);assert.equal(pet.sourcePetSelectedStats(s).moveSpeedMultiplierPercent,100);
 s.selected=[0,2,9];assert.equal(pet.sourcePetSelectedStats(s).moneyMultiplierPercent.toNumber(),46120);assert.equal(pet.sourcePetSelectedStats(s).moveSpeedMultiplierPercent,202);
 assert.equal(pet.sourcePetEntryUnlocked(11),false);assert.equal(pet.sourcePetEntryUnlocked(12),true);assert.throws(()=>pet.sourcePetStats(10));
});
test('Pet paid draw uses first fixed hole, fixedgrade0 and first collection; full never debits',()=>{
 let s=pet.freshSourcePetState();s.owned[0]=5;const r=pet.sourcePetDraw(s,{petCoin:100,diamonds:100},'petCoin');s=supported(r);assert.equal(r.slot,1);assert.equal(r.petCoinDelta,-100);assert.equal(r.diamondDelta,0);assert.equal(r.newCollection,true);assert.equal(s.owned[1],0);assert.equal(s.owned.length,16);
 const r2=pet.sourcePetDraw(s,{petCoin:100,diamonds:100},'diamonds');assert.equal(r2.newCollection,false);assert.equal(r2.diamondDelta,-100);
 s.owned.fill(0);assert.equal(pet.sourcePetDraw(s,{petCoin:100,diamonds:100},'diamonds').reason,'pet-inventory-full');assert.equal(pet.sourcePetDraw(s,{petCoin:99,diamonds:100},'petCoin').status,'blocked');
});
test('Pet daily AD grade1, huntprogress gate, confirmation/date/full do not consume day',()=>{
 const s=pet.freshSourcePetState(),options={wave:0,level:1,todayKey:'source-clock-key',confirmed:true};
 assert.equal(pet.sourcePetDailyAd(s,{...options,level:0}).reason,'pet-daily-ad-locked');assert.equal(pet.sourcePetDailyAd(s,{...options,confirmed:false}).reason,'pet-ad-unconfirmed');assert.equal(s.dailyLastDate,'');
 const r=pet.sourcePetDailyAd(s,options),next=supported(r);assert.equal(next.owned[0],1);assert.equal(next.dailyLastDate,options.todayKey);assert.equal(r.newCollection,true);assert.equal(pet.sourcePetDailyAd(next,options).reason,'pet-daily-ad-used');
 s.owned.fill(0);assert.equal(pet.sourcePetDailyAd(s,options).reason,'pet-inventory-full');assert.equal(s.dailyLastDate,'');
});
test('Pet merge keeps holes/anchor/history; blocks lock, different/max grades',()=>{
 let s=pet.freshSourcePetState();s.owned[1]=s.owned[9]=2;s.collect[2]=true;const r=pet.sourcePetMerge(s,1,9);const next=supported(r);assert.equal(next.owned[1],-1);assert.equal(next.owned[9],3);assert.equal(next.owned.length,16);assert.equal(next.collect[2],true);assert.equal(next.collect[3],true);assert.equal(r.newCollection,true);assert.equal(s.owned[1],2);
 s.ownedLocks[1]=3;assert.equal(pet.sourcePetMerge(s,1,9).reason,'pet-merge-locked');s.ownedLocks[1]=-1;s.owned[1]=1;assert.equal(pet.sourcePetMerge(s,1,9).reason,'pet-merge-grade-mismatch');s.owned[1]=s.owned[9]=9;assert.equal(pet.sourcePetMerge(s,1,9).reason,'pet-merge-max-grade');
});
test('Pet dispatch locks follow equipped swaps, allow locked equip, survive unequip and release by group',()=>{
 let s=pet.freshSourcePetState();s.owned[4]=3;s.owned[0]=1;s.selected[0]=7;s.selectedLocks[0]=8;s=supported(pet.sourcePetLock(s,'owned',4,42));assert.equal(pet.sourcePetCanDispatch(s,'owned',4),false);
 s=supported(pet.sourcePetEquip(s,4,0));assert.deepEqual([s.selected[0],s.selectedLocks[0],s.owned[4],s.ownedLocks[4]],[3,42,7,8]);s=supported(pet.sourcePetSwapSelected(s,0,2));assert.deepEqual([s.selected[0],s.selectedLocks[0],s.selected[2],s.selectedLocks[2]],[-1,-1,3,42]);
 s=supported(pet.sourcePetUnequip(s,2));assert.equal(s.owned[1],3);assert.equal(s.ownedLocks[1],42);assert.equal(s.selected[2],-1);s=supported(pet.sourcePetUnlockGroup(s,42));assert.equal(pet.sourcePetCanDispatch(s,'owned',1),true);assert.equal(s.ownedLocks[4],8);
 s.owned.fill(0);s.selected[0]=1;assert.equal(pet.sourcePetUnequip(s,0).reason,'pet-inventory-full');
});
test('Pet save preserves fixedholes/history/date, native lock resize migrates old saves',()=>{
 const s=pet.freshSourcePetState();s.owned[7]=9;s.selected[2]=4;s.collect[9]=true;s.dailyLastDate='utc-source';s.ownedLocks[7]=12;assert.deepEqual(pet.decodeSourcePetState(pet.serializeSourcePetState(s)),pet.sourcePetWithIdentities(s));
 const old=JSON.parse(pet.serializeSourcePetState(s));delete old.Owned_Pet_LockGroup;delete old.Selected_LockGroup;assert.deepEqual(pet.decodeSourcePetState(old).ownedLocks,Array(16).fill(-1));old.Owned_Pet_LockGroup=[8,9];assert.deepEqual(pet.decodeSourcePetState(old).ownedLocks,[8,9,...Array(14).fill(-1)]);old.Selected_LockGroup=[1,2,3,4];assert.deepEqual(pet.decodeSourcePetState(old).selectedLocks,[1,2,3]);
 old.Owned_Pet_list=[0];assert.throws(()=>pet.decodeSourcePetState(old));
});
test('Hunt finite coefficient prefix/cycle matches all2000 source rows and continuation beyondNumber',()=>{
 for(let i=0;i<scene.monster.health.length;i++)assert.ok(hunt.sourceHuntWaveHealth(i).eq(BigValue.fromJSON(scene.monster.health[i])),`wave${i}`);
 let hp=hunt.sourceHuntWaveHealth(1999);for(let i=2000;i<2050;i++){hp=hp.nativeMultiply(3).significant(2);assert.ok(hunt.sourceHuntWaveHealth(i).eq(hp));}
 assert.equal(hunt.sourceHuntWaveHealth(0).toNumber(),500);assert.equal(hunt.sourceHuntWaveHealth(2000).toNumber(),Infinity);for(const w of [-1,.5,NaN])assert.throws(()=>hunt.sourceHuntWaveHealth(w));assert.throws(()=>hunt.sourceHuntWaveHealth(2147483647),RangeError);
});
test('Hunt threshold uses exactinterval truncation/levelscale; strictGT needs Plus2, sweep scans100',()=>{
 assert.deepEqual(hunt.SOURCE_HUNT_SPAWN_INTERVALS.map(x=>Math.trunc(Math.fround(x*100))),[35,20,17,12,8]);assert.deepEqual(hunt.SOURCE_HUNT_MONSTER_COUNTS,[90,120,160,200,240]);
 const thresholds=[2142.8,5250,7941.1,13750,24375];for(let l=0;l<5;l++)assert.equal(hunt.sourceHuntSweepRequiredPower(0,l).toNumber(),thresholds[l]);
 const s=hunt.freshSourceHuntState(),p=hunt.sourceHuntSweepRequiredPower(0,0),plus={...e,plusPack2Active:true};assert.equal(hunt.sourceHuntSweepAble(s,p,plus),false);assert.equal(hunt.sourceHuntSweepAble(s,p.nativeAdd(1),plus),true);assert.equal(hunt.sourceHuntSweepAble(s,p.nativeAdd(1),e),false);
 assert.equal(hunt.sourceHuntSweepEfficiency(0,0,p),100);assert.equal(hunt.sourceHuntSweepEfficiency(0,0,0),0);assert.equal(hunt.sourceHuntSweepTarget(0,0,p).count,0);assert.deepEqual(hunt.sourceHuntSweepTarget(0,0,p.nativeAdd(1)),{wave:0,level:1,count:1});assert.deepEqual(hunt.sourceHuntSweepTarget(0,0,'1e100'),{wave:20,level:0,count:100});
});
test('Hunt clear paysimmediately, fivelevels advancewave; invasion failscode1 withoutsecond reward',()=>{
 let s=supported(hunt.sourceHuntEnter(hunt.freshSourceHuntState()));assert.equal(s.run.hp,1);assert.equal(hunt.sourceHuntEnter(s).status,'blocked');let total=0;
 for(let i=0;i<5;i++){const r=hunt.sourceHuntLevelClear(s);total+=r.petCoinGrant;s=supported(r);}assert.equal(total,150);assert.deepEqual([s.wave,s.level,s.run.accumulatedPetCoin],[1,0,150]);
 const r=hunt.sourceHuntInvade(s);s=supported(r);assert.equal(r.petCoinGrant,0);assert.equal(r.resultCode,1);assert.equal(r.resultStage,21);assert.equal(s.run.hp,0);assert.equal(hunt.sourceHuntLevelClear(s).status,'blocked');assert.equal(hunt.sourceHuntFail(s).status,'blocked');const exit=hunt.sourceHuntExit(s);assert.equal(exit.resultCode,undefined);assert.equal(exit.petCoinGrant,0);assert.equal(exit.value.wave,1);
});
test('Hunt Plus1/auto independently multiply, giveupcode2 and confirmedonebonus closes',()=>{
 const plus={...e,plusPack1Active:true};let s=supported(hunt.sourceHuntEnter(hunt.freshSourceHuntState(),plus));const clear=hunt.sourceHuntLevelClear(s,plus);assert.equal(clear.petCoinGrant,60);s=supported(clear);const giveup=hunt.sourceHuntGiveUp(s);assert.equal(giveup.resultCode,2);s=supported(giveup);assert.equal(hunt.sourceHuntBonus(s,false).status,'blocked');const bonus=hunt.sourceHuntBonus(s,true);assert.equal(bonus.petCoinGrant,60);s=supported(bonus);assert.equal(s.run,null);assert.equal(hunt.sourceHuntBonus(s,true).status,'blocked');
 const auto={...plus,automaticBonus:true};s=supported(hunt.sourceHuntEnter(hunt.freshSourceHuntState(),auto));const r=hunt.sourceHuntLevelClear(s,auto);assert.equal(r.petCoinGrant,120);assert.equal(r.value.run.accumulatedPetCoin,60);s=supported(hunt.sourceHuntFail(r.value));assert.equal(hunt.sourceHuntBonus(s,true).status,'blocked');
});
test('Hunt sweep immediatebase/pendingbonus/result/rank, save drops transientrun',()=>{
 const initial=hunt.freshSourceHuntState(),p=hunt.sourceHuntSweepRequiredPower(0,0).nativeAdd(1);assert.equal(hunt.sourceHuntSweep(initial,p,e).reason,'hunt-sweep-plus2-required');const r=hunt.sourceHuntSweep(initial,p,{...e,plusPack2Active:true});let s=supported(r);assert.equal(r.petCoinGrant,30);assert.equal(r.resultCode,1);assert.equal(r.rankScore,1);assert.equal(r.resultStage,12);assert.equal(s.run.clearedLevels,1);assert.equal(hunt.sourceHuntSweep(s,p,{...e,plusPack2Active:true}).status,'blocked');assert.equal(hunt.sourceHuntBonus(s,true).petCoinGrant,30);
 assert.deepEqual(hunt.decodeSourceHuntState(hunt.serializeSourceHuntState(s)),{wave:0,level:1,run:null});assert.equal(hunt.sourceHuntExit(s).petCoinGrant,0);assert.equal(hunt.sourceHuntExit(s).resultCode,undefined);assert.equal(hunt.sourceHuntEntryUnlocked(12),true);
 const maximum={wave:2147483647,level:0,run:null};assert.equal(hunt.sourceHuntSweep(maximum,1,{...e,plusPack2Active:true}).status,'unsupported');
});
test('Hunt nativepower uses Boss inputs/type multipliers, activehierarchy and float32 centisecondtrunc',()=>{
 assert.deepEqual([0,1,2,3,4,5,6,7].map(t=>hunt.sourceHuntTypeMultiplier(t,8)),[1,7,5,8,5,5,10,1]);assert.equal(hunt.sourceHuntTypeMultiplier(3,0),1);
 const cats=[{active:true,cooldownSeconds:.5,expectedDamage:100,gunType:1,shotgunPelletCount:0},{active:false,cooldownSeconds:.5,expectedDamage:'1e200',gunType:6,shotgunPelletCount:0},{active:true,cooldownSeconds:.001,expectedDamage:'1e200',gunType:6,shotgunPelletCount:0}];assert.equal(hunt.sourceHuntPowerFromCats(cats).toNumber(),1400);
 assert.equal(hunt.sourceHuntPowerFromCats([{active:true,cooldownSeconds:.079999999,expectedDamage:7,gunType:0,shotgunPelletCount:0}]).toNumber(),87.5);
 const modifiers={rebirthDamagePercent:100,skinDamagePercent:100,fishDamagePercent:0,relicDamagePercent:100,damageBuffMultiplier:1,fishCriticalValuePercent:0,relicCriticalDamagePercent:100,fishCriticalChancePercent:0,skinSpeedPercent:100,rebirthSpeedPercent:100,speedBuffMultiplier:1};
 assert.equal(hunt.sourceHuntTeamPower([{active:true,baseDamage:100,baseIntervalSeconds:.5,starLevel:0,gunType:1,shotgunPelletCount:0}],modifiers).toNumber(),1400);
});
