import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {BigValue}from'../big-value.ts';
import {sourceBossDamageStats,sourceBossShotDamage,sourceBossCooldown,sourceBossPowerFromCats,sourceBossTeamPower,sourceBossStarDamagePercent,sourceBossEnemySpawn,sourceBossEnemyDamage,sourceBossEnter,sourceBossWin,freshSourceBossState,sourceBossPathCrossesCat,sourceBossPickWanderPoint,sourceBossMoveVelocity,SOURCE_BOSS_MOVEMENT}from'../r5-boss.ts';
const modifiers={rebirthDamagePercent:100,skinDamagePercent:100,fishDamagePercent:0,relicDamagePercent:100,damageBuffMultiplier:1,fishCriticalValuePercent:0,relicCriticalDamagePercent:100,fishCriticalChancePercent:20,skinSpeedPercent:100,rebirthSpeedPercent:100,speedBuffMultiplier:1};
const damage=(values={})=>sourceBossDamageStats({...modifiers,baseDamage:100,starLevel:0,...values});
const assertValue=(a,b)=>assert.ok(a.eq(b),`${a.toString()} != ${b}`);
test('Boss damage has source critical expectation and explicitly excludes ordinary upgrade/stage power',()=>{
 const d=damage();assertValue(d.normalDamage,100);assertValue(d.criticalDamage,125);assertValue(d.expectedDamage,105);
 assertValue(damage({ordinaryPower:9999999,normalStage:3000}).expectedDamage,105);
 assertValue(damage({fishCriticalChancePercent:-1}).expectedDamage,100);assertValue(damage({fishCriticalChancePercent:101}).expectedDamage,125);
});
test('actual shot crit uses strict float32 probability and a single supplied attack roll, separate from expected DPS',()=>{
 const d=damage();assert.equal(sourceBossShotDamage(d,Math.fround(.2)).isCritical,false);assert.equal(sourceBossShotDamage(d,.199).isCritical,true);assertValue(sourceBossShotDamage(d,.1).damage,125);
 assert.equal(sourceBossShotDamage(damage({fishCriticalChancePercent:100}),1).isCritical,false);assert.equal(sourceBossShotDamage(damage({fishCriticalChancePercent:101}),1).isCritical,true);assert.throws(()=>sourceBossShotDamage(d,2),RangeError);
});
test('native damage integer truncation occurs before buff/star and once after critical modifiers',()=>{
 const d=damage({baseDamage:101,skinDamagePercent:101,damageBuffMultiplier:3,starLevel:1,fishCriticalChancePercent:100});
 assertValue(d.normalDamage,459);assertValue(d.criticalDamage,573);assertValue(d.expectedDamage,573);
 const huge=damage({baseDamage:'1e900',fishCriticalChancePercent:100});assert.ok(huge.expectedDamage.order>=900);assert.equal(huge.expectedDamage.toNumber(),Infinity);
});
test('source star levels use H2 recurrent table, clamp20, and bypass <=0',()=>{
 assertValue(sourceBossStarDamagePercent(0),100);assertValue(sourceBossStarDamagePercent(1),150);assertValue(sourceBossStarDamagePercent(2),240);assertValue(sourceBossStarDamagePercent(3),410);
 assertValue(sourceBossStarDamagePercent(25),sourceBossStarDamagePercent(20));assertValue(sourceBossStarDamagePercent(-1),100);assert.throws(()=>sourceBossStarDamagePercent(.5),RangeError);
});
test('Boss cooldown includes permanent, skin, and speed buff; excludes ordinary upgrade and stage',()=>{
 const i={...modifiers,baseIntervalSeconds:.6};assert.equal(sourceBossCooldown(i),Math.fround(.6));
 assert.equal(sourceBossCooldown({...i,skinSpeedPercent:200,rebirthSpeedPercent:200}),Math.fround(Math.fround(Math.fround(Math.fround(.6)/200)*100)));
 assert.equal(sourceBossCooldown({...i,skinSpeedPercent:100000,speedBuffMultiplier:3}),Math.fround(.05));assert.equal(sourceBossCooldown({...i,baseIntervalSeconds:4}),2);
 assert.equal(sourceBossCooldown({...i,ordinarySpeedPercent:100000,normalStage:5000}),sourceBossCooldown(i));
});
test('actual enabled cats, float32 centisecond denominator, native sum and H5 determine power',()=>{
 assertValue(sourceBossPowerFromCats([{active:true,expectedDamage:105,cooldownSeconds:Math.fround(.6)}]),175);
 assertValue(sourceBossPowerFromCats([{active:false,expectedDamage:'1e900',cooldownSeconds:0},{active:true,expectedDamage:100,cooldownSeconds:.001}]),0);
 // .29f *100 rounds to29f, .57f *100 rounds to57f: FCVTZS uses the rounded product.
 const cats=[{active:true,expectedDamage:100,cooldownSeconds:.29},{active:true,expectedDamage:125,cooldownSeconds:.57}];
 const expected=BigValue.from(100).nativeMultiply(100).nativeDivide(29).nativeAdd(BigValue.from(125).nativeMultiply(100).nativeDivide(57)).significant(5);assertValue(sourceBossPowerFromCats(cats),expected);
 assertValue(sourceBossTeamPower([{active:true,baseDamage:100,baseIntervalSeconds:.6,starLevel:0},{active:false,baseDamage:'1e99',baseIntervalSeconds:.05,starLevel:20}],modifiers),175);
});
test('Boss HP==0 is alive; only a subsequent negative result emits death, with zero kill money',()=>{
 const spawn=sourceBossEnemySpawn(0);assertValue(spawn.healthNow,50000);assert.equal(spawn.isDead,false);
 assert.equal(sourceBossEnemyDamage(spawn,50001,false).value,spawn);
 const zero=sourceBossEnemyDamage(spawn,50000,true);assertValue(zero.value.healthNow,0);assert.equal(zero.diedThisHit,false);
 const dead=sourceBossEnemyDamage(zero.value,1,true);assertValue(dead.value.healthNow,-1);assert.equal(dead.diedThisHit,true);assert.equal(dead.moneyGrant,0);
 assert.equal(sourceBossEnemyDamage(dead.value,1,true).value,dead.value);assert.equal(sourceBossEnemyDamage(dead.value,1,true).diedThisHit,false);
 const entered=sourceBossEnter(freshSourceBossState()).value,won=sourceBossWin(entered);assert.equal(won.value.stage,1);assert.equal(won.diamondGrant,150);assert.equal(sourceBossWin(won.value).status,'blocked');
});
test('scene movement reads actual serialized speed15, source transform chain, and true skin arrays',()=>{
 const j=JSON.parse(readFileSync('artifacts/evidence/round5-20261001/boss-battle-scene.json','utf8'));
 assert.equal(j.bossComponent.movement.moveSpeed,15);assert.deepEqual(j.sceneWorldSpawn,[-115,0,15]);assert.deepEqual(j.catSpawnWorld,[-100,0,0]);assert.equal(j.bossComponent.refs.Skin_obj.length,9);assert.equal(j.bossComponent.refs.Head_spriteRenderer.length,9);
 assert.equal(SOURCE_BOSS_MOVEMENT.moveSpeed,15);assert.deepEqual(SOURCE_BOSS_MOVEMENT.spawnWorld,{x:-115,y:0,z:15});
});
test('wander path radius is strict; 3D geometry, missing zero cat, and degenerate segments are handled',()=>{
 const a={x:-110,y:0,z:0},b={x:-90,y:0,z:0};
 assert.equal(sourceBossPathCrossesCat(a,b,{x:-100,y:0,z:3.99}),true);assert.equal(sourceBossPathCrossesCat(a,b,{x:-100,y:0,z:4}),false);assert.equal(sourceBossPathCrossesCat(a,b,{x:-100,y:4,z:0}),false);
 assert.equal(sourceBossPathCrossesCat(a,b,{x:0,y:0,z:0}),false);assert.equal(sourceBossPathCrossesCat(a,a,{x:-110,y:0,z:0}),false);
});
test('ten rejected wander points cause a fresh eleventh sample, not reuse of a rejected target',()=>{
 let calls=0;const result=sourceBossPickWanderPoint({x:-110,y:2,z:0},{x:-100,y:2,z:0},()=>{calls++;return calls<=10?{x:.5,y:0}:{x:0,y:1};});
 assert.equal(calls,11);assert.equal(result.samples,11);assert.equal(result.fallback,true);assert.deepEqual(result.point,{x:-100,y:2,z:60});
 const first=sourceBossPickWanderPoint({x:-110,y:2,z:0},{x:0,y:0,z:0},()=>({x:0,y:1}));assert.equal(first.samples,1);assert.equal(first.fallback,false);
});
test('movement drives horizontal native velocity15, stops at <=.5 arrival or gaming false',()=>{
 const p={x:-115,y:2,z:15},t={x:-112,y:99,z:19};
 assert.deepEqual(sourceBossMoveVelocity(p,t,true),{velocity:{x:9,y:0,z:12},arrived:false,isMoving:true,facing:'right'});
 assert.deepEqual(sourceBossMoveVelocity(p,{x:-114.5,y:99,z:15},true).velocity,{x:0,y:0,z:0});
 assert.equal(sourceBossMoveVelocity(p,t,false).isMoving,false);assert.equal(sourceBossMoveVelocity(p,{x:-115,y:0,z:20},true).facing,null);
});
