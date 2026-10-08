import test from 'node:test';
import assert from 'node:assert/strict';
import {createLevel,tick,healthValue,walletValue} from '../rules.ts';
import {BigValue} from '../big-value.ts';
import {sourceProjectileState} from '../gun-projectiles.ts';
function probe(type,hp,radius=.4) {
  const base=createLevel();
  return {...base,shootCooldown:999,targetBatchSize:0,targets:hp.map((health,i)=>({id:i+1,position:{x:i+1,y:5},radius:.1,
    health,maxHealth:health,healthValue:BigValue.fromInteger(health),maxHealthValue:BigValue.fromInteger(health),coin:10,coinValue:BigValue.fromInteger(10)})),
    projectiles:[{id:90,position:{x:0,y:5},velocity:{x:15,y:0},damage:100,damageValue:BigValue.fromInteger(100),remainingRange:10,
      distanceTraveled:0,gunSlot:0,source:sourceProjectileState(type),explosionRadius:radius}]};
}
test('integrated pierce compares pre-hit HP strictly and stops after second equal-damage hit',()=>{
  const next=tick(probe(2,[30,100,30]),.2);
  assert.deepEqual(next.targets.map(t=>t.health),[0,0,30]);assert.equal(next.projectiles.length,0);
  assert.ok(walletValue(next).eq(20));
});
test('integrated laser sweeps every collider once and maintains its per-projectile hit set',()=>{
  const initial=probe(1,[200,200,200]),next=tick(initial,.2);
  assert.deepEqual(next.targets.map(t=>t.health),[100,100,100]);assert.equal(next.projectiles.length,1);
  assert.deepEqual(next.projectiles[0].source.hitColliderIds,[1,2,3]);
  // Remaining segment starts within collider3: re-entry must not damage it twice.
  const again=tick(next,.01);assert.equal(again.targets[2].health,100);assert.equal(initial.targets[0].health,200);
});
test('integrated explosion applies one damage per eligible collider and one currency payout per death',()=>{
  const initial=probe(4,[100,100,100],3),next=tick(initial,.2);
  assert.deepEqual(next.targets.map(t=>t.health),[0,0,0]);assert.ok(walletValue(next).eq(30));
  assert.equal(next.projectiles.length,0);assert.ok(walletValue(tick(next,.1)).eq(30));
});
test('integrated blast sniper explodes first, then consumes pierce policy on later contacts',()=>{
  const next=tick(probe(6,[30,200,100]),.2);
  assert.deepEqual(next.targets.map(t=>t.health),[0,100,0]);assert.ok(walletValue(next).eq(20));
  assert.equal(next.projectiles.length,0);
});
test('native HP precision discards a smaller operand before subtraction as the source helper specifies',()=>{
  const base=probe(0,[1]);base.targets[0]={...base.targets[0],health:Number.MAX_VALUE,maxHealth:Number.MAX_VALUE,
    healthValue:BigValue.from('1e1000'),maxHealthValue:BigValue.from('1e1000')};
  base.projectiles[0].damage=Number.MAX_VALUE;base.projectiles[0].damageValue=BigValue.from('3e999');
  assert.ok(healthValue(tick(base,.1).targets[0]).eq('1e1000'));
});
