// Pure native numeric policy tests; not source-device/GUI evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {BigValue} from '../big-value';
import {sourceRaidCatDamage,sourceRaidCatCooldown,sessionRaidModifiers} from '../raid-cat-balance';
import {sourceBossDamageStats,sourceBossCooldown,sourceBossStarDamagePercent} from '../r5-boss';
import {createSession} from '../session';import {freshSourceMetaState} from '../source-meta-runtime';
const damage=(o={})=>({baseDamage:1000,gunType:2,weakType:4,skinDamagePercent:100,fishDamagePercent:0,relicDamagePercent:100,damageBuffMultiplier:1,starLevel:0,fishCriticalValuePercent:0,relicCriticalDamagePercent:100,fishCriticalChancePercent:0,...o});
test('UI5 skips power/rebirth entirely, including accidental caller extras; Boss must differ',()=>{
 const i=damage({rebirthDamagePercent:10000,power:1e20});assert.equal(sourceRaidCatDamage(i).normalDamage.toNumber(),1000);
 assert.equal(sourceBossDamageStats(i).normalDamage.toNumber(),100000);
});
test('ordered skin/fish/relic-G/buff/star/weak/critical-G consumers; weakness after star',()=>{
 const i=damage({baseDamage:'12345678901234567890123456789e-19',skinDamagePercent:123,fishDamagePercent:47,relicDamagePercent:BigValue.fromInteger(135),damageBuffMultiplier:3,starLevel:7,gunType:4,fishCriticalValuePercent:33,relicCriticalDamagePercent:BigValue.fromInteger(127),fishCriticalChancePercent:23});
 const p=(v,n)=>v.nativeMultiply(typeof n==='number'?BigValue.fromInteger(n):n).nativeDivide(BigValue.fromInteger(100));
 let expected=p(BigValue.from(i.baseDamage),123);expected=p(expected,147);expected=p(expected,135).truncateInteger();expected=expected.nativeMultiply(BigValue.fromInteger(3));expected=p(expected,sourceBossStarDamagePercent(7));expected=expected.nativeMultiply(BigValue.fromInteger(10));
 const critical=p(p(expected,158),127).truncateInteger(),r=sourceRaidCatDamage(i);
 assert.deepEqual(r.normalDamage,expected);assert.deepEqual(r.criticalDamage,critical);
 assert.deepEqual(r.expectedDamage,expected.nativeMultiply(BigValue.fromInteger(77)).nativeAdd(critical.nativeMultiply(BigValue.fromInteger(23))).nativeDivide(BigValue.fromInteger(100)));
});
test('small base is truncated before weakness, not rescued by x10; crit probability uses RAW float32',()=>{
 assert.equal(sourceRaidCatDamage(damage({baseDamage:.9,gunType:4})).normalDamage.toNumber(),0);
 const r=sourceRaidCatDamage(damage({fishCriticalChancePercent:123}));assert.equal(r.criticalChancePercent,100);assert.equal(r.shotCriticalProbability,Math.fround(Math.fround(123)/Math.fround(100)));
});
test('UI5 cooldown flags true,false,true skip permanent/ordinary speed and stage penalty',()=>{
 const i={baseIntervalSeconds:1,skinSpeedPercent:300,speedBuffMultiplier:3,rebirthSpeedPercent:10000,ordinarySpeed:10000,stage:10000};
 assert.equal(sourceRaidCatCooldown(i),Math.fround(Math.fround(.5)/3));assert.notEqual(sourceRaidCatCooldown(i),sourceBossCooldown(i));
 assert.equal(sourceRaidCatCooldown({...i,skinSpeedPercent:100,speedBuffMultiplier:1}),1);
 assert.equal(sourceRaidCatCooldown({...i,skinSpeedPercent:10100,speedBuffMultiplier:1}),Math.fround(.05));
 assert.equal(sourceRaidCatCooldown({...i,baseIntervalSeconds:20,skinSpeedPercent:100,speedBuffMultiplier:1}),2);
});
test('invalid numeric/type/star input rejected without InfVal fallback',()=>{
 for(const o of [{gunType:7},{weakType:-1},{starLevel:21},{fishCriticalChancePercent:1.5}])assert.throws(()=>sourceRaidCatDamage(damage(o)));
 for(const o of [{baseIntervalSeconds:NaN},{baseIntervalSeconds:0},{speedBuffMultiplier:0},{skinSpeedPercent:1.5}])assert.throws(()=>sourceRaidCatCooldown({baseIntervalSeconds:1,skinSpeedPercent:100,speedBuffMultiplier:1,...o}));
});
test('session projection carries source skin/fish/relic/buff but no permanent multiplier property',()=>{
 const m=sessionRaidModifiers(createSession(4),freshSourceMetaState());assert.ok(!('rebirthDamagePercent'in m));assert.ok(!('rebirthSpeedPercent'in m));assert.equal(m.skinDamagePercent,100);assert.equal(m.skinSpeedPercent,100);
});
