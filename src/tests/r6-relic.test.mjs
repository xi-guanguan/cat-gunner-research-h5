import test from 'node:test';
import assert from 'node:assert/strict';
import {BigValue} from '../big-value';
import {freshSourceRelicState,decodeSourceRelicState,sourceRelicValue,sourceRelicTotals,sourceRelicCandidates,sourceRelicProbabilities,sourceRelicDraw,sourceRelicUpgrade,sourceRelicUpgradeCost,sourceRelicOfflineMaxSeconds,SOURCE_RELIC_ITEMS} from '../r6-relic';
import {sourceRelicDrawPresentation} from '../r6-relic-presentation';
import {freshSourceMetaState,decodeSourceMetaState,serializeSourceMetaState,runtimeSourceRelic,runtimeSourceHuntPower} from '../source-meta-runtime';
import {createSession,createFieldLevel,sourceGun,sessionCombatModifiers,sessionBossPower,sessionChallengePower,sessionRebirthReward,confirmRebirth,startMine,step} from '../session';
import {sourceGunDamageStats,createLevel,tick} from '../rules';
import {sourceMoveSpeedFromRawStatSlots} from '../cat-movement-source';
import {freshPlatformState} from '../local-platform';
import {createActivityState} from '../source-activities';
import {SourceHuntSessionBridge} from '../hunt-session-bridge';
import {bindSourceHuntMovementStats} from '../hunt-movement-binding';
const wallet=()=>[400,401,402,403];
const all=(lv=0)=>({items:freshSourceRelicState().items.map(()=>({lv,count:100,unlocked:true}))});
const bundle=()=>({session:{...createSession(7),historicMax:340},meta:freshSourceMetaState(),activities:createActivityState(),platform:freshPlatformState()});
const draw=(s=freshSourceRelicState(),w=wallet(),type=0,count=1,rng=()=>0)=>sourceRelicDraw(s,w,type,count,rng);
const number=(v)=>v.toNumber();
test('15 source array identities retain three independent Skip relics and default no ownership',()=>{
 const s=freshSourceRelicState();assert.equal(s.items.length,15);assert.deepEqual(SOURCE_RELIC_ITEMS.map(x=>x.type),[0,1,2,11,12,3,4,5,10,12,6,7,8,9,12]);assert.ok(s.items.every(v=>v.lv===0&&v.count===0&&!v.unlocked));
 assert.deepEqual(sourceRelicCandidates(s,0),[0,1,2,3,4]);assert.deepEqual(sourceRelicCandidates(s,1),[5,6,7,8,9]);assert.deepEqual(sourceRelicCandidates(s,2),[10,11,12,13,14]);assert.equal(sourceRelicCandidates(s,3).length,15);
 const r=draw(s,wallet(),0,1,()=>.99);assert.equal(r.draws[0].index,4);assert.equal(r.state.items[4].unlocked,true);assert.equal(r.state.items[9].unlocked,false);assert.equal(r.state.items[14].unlocked,false);
});
test('native 300 balance arrays, integer truncation of 1.5 branch and scalar branches',()=>{
 for(const ids of [[0,1,2],[5,6,7],[10,11,12]]){assert.deepEqual(ids.map(i=>number(sourceRelicValue(i,0))),[5,7,10]);assert.deepEqual(ids.map(i=>number(sourceRelicValue(i,2))),[15,22,30]);assert.ok(sourceRelicValue(ids[0],299).gt(0));for(const i of ids)assert.throws(()=>sourceRelicValue(i,300),/boundary/);}
 for(const [i,base,per]of [[3,5,5],[4,2,2],[8,10,10],[9,2,2],[13,2,2],[14,2,2]]){assert.equal(number(sourceRelicValue(i,0)),base);assert.equal(number(sourceRelicValue(i,50)),base+50*per);assert.throws(()=>sourceRelicValue(i,51));}
});
test('unowned stats ignored; native cumulative values retain additive baselines',()=>{
 const base=sourceRelicTotals();assert.equal(number(base.damagePercent),100);assert.equal(number(base.moneyPercent),100);assert.equal(number(base.criticalPercent),100);assert.equal(base.rebirthPercent,100);assert.equal(base.moveSpeedValue,0);
 const s=all(2),t=sourceRelicTotals(s);assert.equal(number(t.damagePercent),167);assert.equal(number(t.moneyPercent),167);assert.equal(number(t.criticalPercent),167);assert.equal(t.rebirthPercent,115);assert.equal(t.moveSpeedValue,6);assert.equal(t.offlineMinutes,30);assert.equal(t.skipPercent,18);assert.equal(sourceRelicOfflineMaxSeconds(120,s),1920);
 s.items[0].unlocked=false;assert.equal(number(sourceRelicTotals(s).damagePercent),152);assert.equal(s.items[0].lv,2);
});
test('first unlock adds no duplicate fragment; repeat adds one; only selected core wallet debited',()=>{
 const s=freshSourceRelicState(),w=wallet(),a=draw(s,w),b=draw(a.state,a.cores);assert.equal(a.draws[0].firstUnlock,true);assert.equal(a.state.items[0].count,0);assert.equal(b.draws[0].firstUnlock,false);assert.equal(b.state.items[0].count,1);assert.deepEqual(b.cores,[360,401,402,403]);assert.deepEqual(s,freshSourceRelicState());assert.deepEqual(w,wallet());
});
test('all-balance draw is not the serialized DrawCount10 template; retains remainder',()=>{
 const r=draw(undefined,[399,0,0,0],0,'max');assert.equal(r.draws.length,19);assert.deepEqual(r.cores,[19,0,0,0]);assert.equal(r.state.items[0].count,18);
 const one=draw(undefined,[0,0,0,20],3,'max',()=>.999);assert.equal(one.draws[0].index,14);assert.deepEqual(one.cores,[0,0,0,0]);
});
test('candidate filtering uses max levels, all-max fallback preserves original group (boundary MODEL ONLY)',()=>{
 const s=all(0);s.items[3].lv=50;assert.deepEqual(sourceRelicCandidates(s,0),[0,1,2,4]);assert.equal(sourceRelicProbabilities(s,0)[3],0);assert.equal(sourceRelicProbabilities(s,0)[0],25);
 // Candidate selection itself is testable at native Lv300. Decoding/drawing
 // deliberately rejects the absent 301st balance value, rather than inventing it.
 for(const i of [0,1,2,4])s.items[i].lv=i===4?50:300;assert.deepEqual(sourceRelicCandidates(s,0),[0,1,2,3,4]);assert.equal(draw(s).status,'blocked');
});
for(const [label,w,type,count,rng]of [
 ['empty',[0,0,0,0],0,1,()=>0],['short',[19,0,0,0],0,1,()=>0],['invalid-type',wallet(),4,1,()=>0],['zero',wallet(),0,0,()=>0],['fraction',wallet(),0,1.5,()=>0],['bad-wallet',[-1,0,0,0],0,1,()=>0],['capacity',[2000020,0,0,0],0,'max',()=>0],['nan-roll',wallet(),0,1,()=>NaN],['one-roll',wallet(),0,1,()=>1],['partial-bad-roll',wallet(),0,2,(()=>{let n=0;return()=>n++?NaN:0;})()],
])test(`draw ${label} rejection is atomic`,()=>{const s=freshSourceRelicState(),before=JSON.stringify(s),r=draw(s,w,type,count,rng);assert.equal(r.status,'blocked');assert.equal(r.state,s);assert.equal(r.cores,w);assert.deepEqual(r.draws,[]);assert.equal(JSON.stringify(s),before);});
test('int32 duplicate overflow refuses all draws and preserves previous balance/state',()=>{const s=all();s.items[0].count=2147483647;const r=draw(s);assert.equal(r.status,'blocked');assert.equal(r.state,s);assert.deepEqual(r.cores,wallet());});
test('upgrade curve and successful fragment transaction preserves cores and original state',()=>{
 assert.deepEqual([0,1,23,24,49].map(sourceRelicUpgradeCost),[2,4,48,50,50]);const s=all(),w=wallet(),r=sourceRelicUpgrade(s,w,0);assert.equal(r.status,'granted');assert.deepEqual(r.state.items[0],{lv:1,count:98,unlocked:true});assert.deepEqual(r.state.items.slice(1),s.items.slice(1));assert.deepEqual(r.cores,w);assert.equal(s.items[0].lv,0);
});
test('locked, insufficient, scalar MAX and unresolved Lv299 upgrades never consume',()=>{
 for(const [index,patch,regex]of [[0,{unlocked:false},/尚未获得/],[0,{count:1},/不足/],[3,{lv:50},/满级/],[0,{lv:299},/边界/]]){const s=all();Object.assign(s.items[index],patch);const r=sourceRelicUpgrade(s,wallet(),index);assert.equal(r.status,'blocked');assert.equal(r.state,s);assert.match(r.reason,regex);assert.equal(r.state.items[index].count,s.items[index].count);}
 assert.equal(sourceRelicUpgrade(all(),wallet(),15).status,'blocked');assert.equal(sourceRelicUpgrade({items:[]},wallet(),0).status,'blocked');assert.equal(sourceRelicDraw({items:[]},wallet(),0,1,()=>0).status,'blocked');
});
test('legacy meta migrates only absent field, with no cores/resources/unlocks; current save roundtrip',()=>{
 const m=freshSourceMetaState();m.petCoin=91;m.adventure.cores=[11,22,33,44];m.relic=all(2);const raw=JSON.parse(serializeSourceMetaState(m));delete raw.relic;const old=decodeSourceMetaState(JSON.stringify(raw));assert.deepEqual(old.relic,freshSourceRelicState());assert.deepEqual(old.adventure.cores,[11,22,33,44]);assert.equal(old.petCoin,91);
 assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(m)).relic,m.relic);for(const relic of [null,{}, {items:[]}, {items:Array(15).fill({lv:300,count:0,unlocked:true})}])assert.throws(()=>decodeSourceMetaState(JSON.stringify({...raw,relic})));
});
test('decoder rejects malformed fields instead of silently clamping or regranting',()=>{
 for(const patch of [{lv:-1},{lv:1.1},{count:2147483648},{count:-1},{unlocked:1},{lv:300}]){const s=all();Object.assign(s.items[0],patch);assert.throws(()=>decodeSourceRelicState(s));}assert.deepEqual(decodeSourceRelicState(all(2)),all(2));
});
test('runtime respects source 35-major gate; successes commit RNG with core, failure commits neither',()=>{
 const b=bundle();b.meta.adventure.cores=wallet();let r=runtimeSourceRelic(b,'draw',0);assert.equal(r.status,'granted');assert.notEqual(r.session.rngState,b.session.rngState);assert.equal(r.meta.adventure.cores[0],380);assert.equal(r.meta.petCoin,b.meta.petCoin);
 const low={...b,session:{...b.session,historicMax:339}},locked=runtimeSourceRelic(low,'draw',0);assert.equal(locked.status,'blocked');assert.equal(locked.session,low.session);assert.equal(locked.meta,low.meta);
 const empty={...b,meta:{...b.meta,adventure:{...b.meta.adventure,cores:[0,0,0,0]}}},no=runtimeSourceRelic(empty,'draw',0);assert.equal(no.status,'blocked');assert.equal(no.session,empty.session);assert.equal(no.meta,empty.meta);
 b.meta.relic=all();b.meta.relic.items[0].lv=299;const edge=runtimeSourceRelic(b,'upgrade',0,1,0);assert.equal(edge.status,'blocked');assert.equal(edge.session,b.session);assert.equal(edge.meta,b.meta);assert.equal(edge.session.rngState,b.session.rngState);
});
test('actual damage truncates AFTER relic, BEFORE buff; critical is independently scaled',()=>{
 const gun={...sourceGun(0),damage:1.75,damageValue:BigValue.from('1.75')};const stats=sourceGunDamageStats(gun,0,{relicDamagePercent:BigValue.fromInteger(150),damageBuffMultiplier:4,criticalDamagePercent:133,relicCriticalPercent:BigValue.fromInteger(150)});
 assert.equal(number(stats.normalDamage),8);assert.equal(number(stats.criticalDamage),15);assert.equal(number(sourceGunDamageStats(gun,0).normalDamage),1);
});
test('actual kill wallet composes upgrade/rebirth/skin/buff/relic/pet in native order',()=>{
 const s=createLevel(0,0,0);s.autoMove=true;s.combatModifiers={...sessionCombatModifiers(createSession(),undefined,undefined,undefined,undefined,all(2)),sourceMoneyRebirthPercent:BigValue.fromInteger(105),sourceMoneyBuffPercent:300,petMoneyPercent:BigValue.fromInteger(123)};
 s.targets=[{id:1,position:{...s.player},health:1,maxHealth:1,coin:100,radius:1,healthValue:BigValue.fromInteger(1),maxHealthValue:BigValue.fromInteger(1),coinValue:BigValue.fromInteger(100)}];s.projectiles=[{id:777,position:{...s.player},velocity:{x:0,y:0},damage:1,damageValue:BigValue.fromInteger(1),remainingRange:1,distanceTraveled:0,gunSlot:0}];
 const killed=tick(s,0),expected=BigValue.fromInteger(100).nativeMultiply(105).nativeDivide(100).nativeMultiply(300).nativeDivide(100).nativeMultiply(167).nativeDivide(100).nativeMultiply(123).nativeDivide(100);assert.ok(killed.earnedValue.eq(expected));
});
test('relic lives in Meta; rebirth preserves permanent levels and relic while preview matches awarded rubies',()=>{
 const s={...createSession(7),historicMax:340,overlay:'rebirth',battle:createFieldLevel(34,2,0),permanentLevels:{damage:2,speed:3,money:4}},r=all(2),base=sessionRebirthReward(s),reward=sessionRebirthReward(s,r);assert.ok(reward.gt(base));const after=confirmRebirth(s,r);assert.ok(after.ruby.eq(s.ruby.nativeAdd(reward)));assert.deepEqual(after.permanentLevels,s.permanentLevels);assert.deepEqual(r,all(2));
});
test('Boss, Challenge, Hunt power and ordinary/Mine step consume the actual relic state',()=>{
 const s={...createSession(7),historicMax:340,overlay:'none',equippedGuns:[sourceGun(20),null,null]},r=all(2),args=[s,undefined,undefined,undefined];assert.ok(sessionBossPower(...args,r).gt(sessionBossPower(...args)));assert.ok(sessionChallengePower(...args,r).gt(sessionChallengePower(...args)));
 const b={...bundle(),session:s};b.meta.relic=r;assert.ok(runtimeSourceHuntPower(b).gt(runtimeSourceHuntPower({...b,meta:{...b.meta,relic:freshSourceRelicState()}})));
 const host=new SourceHuntSessionBridge('relic:consumer',b,bindSourceHuntMovementStats(b.meta.pet,sourceRelicTotals(r).moveSpeedValue));assert.ok(host.host);
 const after=step(s,1/60,{},undefined,undefined,undefined,undefined,undefined,r);assert.equal(after.battle.combatModifiers.relicMoveSpeedValue,6);assert.ok(after.battle.combatModifiers.relicDamagePercent.eq(167));
 const mine=startMine({...s,overlay:'mine'},{today:()=> '2026-10-03',canRolloverDaily:()=>true},false,undefined,undefined,undefined,undefined,r);
 assert.equal(mine.mode,'mine');assert.ok(mine.mine.run);assert.ok(mine.battle.combatModifiers.relicDamagePercent.eq(167));
 const mineAfter=step(mine,1/60,{},undefined,undefined,undefined,undefined,undefined,r);
 assert.equal(mineAfter.mode,'mine');assert.ok(mineAfter.mine.run.elapsed>0);assert.equal(mineAfter.battle.combatModifiers.relicMoveSpeedValue,6);assert.ok(mineAfter.battle.combatModifiers.relicDamagePercent.eq(167));
});
test('movement adds raw relic percentage to Pet stat before native float32 calculation',()=>{
 const b=bundle(),raw=bindSourceHuntMovementStats(b.meta.pet,sourceRelicTotals(all(2)).moveSpeedValue);assert.equal(raw.slot5d5d4d8Static60,6);assert.equal(sourceMoveSpeedFromRawStatSlots(false,raw),Math.fround(Math.fround(15*106)/100));
});
test('draw presentation retains original 12-item page, delay/interval and navigation readiness',()=>{
 const draws=Array.from({length:20},(_,index)=>({index:index%15,firstUnlock:index<15})),start=sourceRelicDrawPresentation(draws,0,0);assert.equal(start.size,12);assert.equal(start.visible,1);assert.equal(start.ready,false);assert.equal(start.right,false);
 const done=sourceRelicDrawPresentation(draws,0,100);assert.equal(done.visible,12);assert.equal(done.right,true);assert.equal(done.left,false);const next=sourceRelicDrawPresentation(draws,1,100);assert.equal(next.start,12);assert.equal(next.count,8);assert.equal(next.visible,8);assert.equal(next.right,false);assert.equal(next.left,true);
 const single=sourceRelicDrawPresentation(draws.slice(0,1),0,0);assert.equal(single.single,true);assert.equal(single.ready,false);assert.equal(sourceRelicDrawPresentation(draws.slice(0,1),0,100).ready,true);
});
