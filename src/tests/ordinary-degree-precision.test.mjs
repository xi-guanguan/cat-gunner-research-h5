import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldLevel } from '../session.ts';
import { sourceDegreeFactors } from '../challenge-source.ts';
import { healthValue, numericMirror } from '../rules.ts';

test('shared native degree constructors retain int H5 and double H17 precision',()=>{
  for(const tier of [0,1,2,3]) {
    const factors=sourceDegreeFactors(tier),precision=tier===1?17:5;
    assert.equal(factors.health.precision,precision);assert.equal(factors.money.precision,precision);
  }
  assert.ok(sourceDegreeFactors(3).health.eq(35));assert.ok(sourceDegreeFactors(3).money.eq(100));
  for(const tier of [-1,4,1.2])assert.throws(()=>sourceDegreeFactors(tier));
});

test('ordinary Stage 1/2/3 use paired source HP and money without simplified-factor truncation',()=>{
  const fixtures=[[[250,450,750],[20,36,60]],[[750,1350,2250],[60,108,180]],[[2200,3960,6600],[180,324,540]]];
  fixtures.forEach(([hp,money],stage)=>{
    const battle=createFieldLevel(stage,2,0,undefined,19);
    assert.deepEqual(new Set(battle.targets.map(target=>target.tier)),new Set([0,1,2]));
    for(const target of battle.targets) {
      assert.ok(healthValue(target).eq(hp[target.tier]));assert.ok(target.maxHealthValue.eq(hp[target.tier]));
      assert.ok(target.coinValue.eq(money[target.tier]));
      assert.equal(target.health,hp[target.tier]);assert.equal(target.maxHealth,hp[target.tier]);
      assert.equal(target.coin,money[target.tier]);
      assert.equal(target.healthValue.precision,target.tier===1?17:5);
      assert.equal(target.coinValue.precision,target.tier===1?17:5);
    }
  });
});

test('boss HP35 and money100 retain native integer precision',()=>{
  for(const [stage,hp,money] of [[0,8750,2000],[1,26250,6000],[2,77000,18000]]) {
    const battle=createFieldLevel(stage,4,0,undefined,19),boss=battle.targets.find(target=>target.boss);
    assert.ok(boss);assert.equal(boss.tier,3);
    assert.ok(healthValue(boss).eq(hp));assert.ok(boss.maxHealthValue.eq(hp));assert.ok(boss.coinValue.eq(money));
    assert.equal(boss.health,hp);assert.equal(boss.coin,money);
    assert.equal(boss.healthValue.precision,5);assert.equal(boss.coinValue.precision,5);
  }
});

test('large ordinary authoritative values keep tier precision beyond Number mirrors',()=>{
  const battle=createFieldLevel(4999,2,0,undefined,19);
  for(const target of battle.targets) {
    const factor=sourceDegreeFactors(target.tier);
    assert.ok(target.healthValue.gt(0));assert.ok(target.coinValue.gt(0));
    assert.equal(target.healthValue.precision,factor.health.precision);
    assert.equal(target.coinValue.precision,factor.money.precision);
    assert.equal(target.health,numericMirror(target.healthValue));
    assert.equal(target.coin,numericMirror(target.coinValue));
    assert.equal(target.health,Number.MAX_VALUE);assert.equal(target.coin,Number.MAX_VALUE);
  }
});
