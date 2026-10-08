import test from 'node:test';
import assert from 'node:assert/strict';
import {BigValue} from '../big-value.ts';
import {createSession,createFieldLevel,closeOverlay,openRebirth,confirmRebirth,openPermanent,purchasePermanent,
  sourceGun,fuseInventory,serializeSession,deserializeSession,sessionCombatModifiers,step} from '../session.ts';
import {walletValue} from '../rules.ts';
import {permanentUpgradeQuote} from '../meta-progression.ts';
const ready=()=>({...closeOverlay(createSession(7654)),historicMax:20,battle:createFieldLevel(2,1,12345,{power:10,money:3,speed:2},7654),
  gunUnlocked:true,gunInventory:[sourceGun(2),sourceGun(4)],equippedGuns:[sourceGun(6),sourceGun(9),null],
  permanentLevels:{damage:2,money:1,speed:3},ruby:BigValue.fromInteger(900)});

test('rebirth commits reward once, resets ordinary progression, and preserves permanent ownership',()=>{
  const before=openRebirth(ready());
  const after=confirmRebirth(before);
  assert.equal(after.overlay,'none');assert.equal(after.battle.stage,0);assert.equal(after.battle.level,0);
  assert.ok(walletValue(after.battle).isZero);assert.deepEqual(after.battle.upgradeLevels,{power:0,money:0,speed:0});
  assert.ok(after.ruby.eq('1297.9'));assert.equal(after.rebirthCount,1);
  assert.deepEqual(after.permanentLevels,before.permanentLevels);assert.deepEqual(after.gunInventory,before.gunInventory);
  assert.deepEqual(after.equippedGuns,before.equippedGuns);assert.equal(after.historicMax,20);
  assert.equal(confirmRebirth(after),after);assert.equal(before.battle.stage,2);
});

test('permanent purchase rejects shortfall, spends exact quote, and survives persistence',()=>{
  const panel=openPermanent({...ready(),permanentLevels:{damage:0,money:0,speed:0}});
  const q=permanentUpgradeQuote('damage',0).value;
  assert.ok(q.price.eq(3));
  const short={...panel,ruby:q.price.sub(1)},rejected=purchasePermanent(short,'damage');
  assert.ok(rejected.ruby.eq(2));assert.equal(rejected.permanentLevels.damage,0);
  const bought=purchasePermanent({...panel,ruby:q.price},'damage');
  assert.ok(bought.ruby.isZero);assert.equal(bought.permanentLevels.damage,1);
  const restored=deserializeSession(serializeSession(bought));
  assert.equal(restored.permanentLevels.damage,1);assert.ok(restored.ruby.isZero);
  assert.ok(sessionCombatModifiers(restored).permanentDamagePercent.eq(105));
  const capped=purchasePermanent({...panel,permanentLevels:{damage:20000,money:0,speed:0},ruby:BigValue.from('1e2000')},'damage');
  assert.equal(capped.permanentLevels.damage,20000);assert.ok(capped.ruby.eq('1e2000'));
});

test('fusion consumes two same-group guns into one next-group gun; mismatched or same slot cannot consume',()=>{
  const panel={...ready(),overlay:'gun'},after=fuseInventory(panel,0,1);
  assert.equal(after.gunInventory.length,1);assert.match(after.gunInventory[0].id,/source-gun-[5-9]$/);
  assert.equal(panel.gunInventory.length,2);assert.equal(after.diamonds,panel.diamonds);
  assert.deepEqual(fuseInventory(panel,0,0).gunInventory,panel.gunInventory);
  const mismatch={...panel,gunInventory:[sourceGun(2),sourceGun(5)]};
  assert.deepEqual(fuseInventory(mismatch,0,1).gunInventory,mismatch.gunInventory);
  const terminal={...panel,gunInventory:[sourceGun(60),sourceGun(64)]};
  assert.deepEqual(fuseInventory(terminal,0,1).gunInventory,terminal.gunInventory);
});

test('save rejects corrupt currency, out-of-range permanent upgrades and invalid equipment',()=>{
  const initial=ready();initial.ruby=BigValue.from('123456789012345678901e1000');
  const restored=deserializeSession(serializeSession(initial));assert.ok(restored.ruby.eq(initial.ruby));
  for(const mutate of [s=>s.ruby=BigValue.from(-1),s=>s.permanentLevels.damage=20001,s=>s.equippedGuns=[null,null,null],
    s=>s.gunInventory=[{...sourceGun(2),id:'source-gun-65'}]]){
    const copy=deserializeSession(serializeSession(initial));mutate(copy);
    assert.throws(()=>deserializeSession(serializeSession(copy)));
  }
});

test('equipment overlay keeps combat running; rebirth and permanent screens pause the H5 field',()=>{
  const base=ready();
  assert.ok(step({...base,overlay:'gun'},.1).battle.elapsed>base.battle.elapsed);
  for(const overlay of ['rebirth','permanent'])assert.equal(step({...base,overlay},.1).battle.elapsed,base.battle.elapsed);
});
