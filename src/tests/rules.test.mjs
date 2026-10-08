import test from "node:test";
import assert from "node:assert/strict";
import { candidateConfig } from "../config.ts";
import { buyUpgrade, createLevel, tick, upgradePrice, upgradeValue, numericMirror, walletValue, healthValue } from "../rules.ts";
import { fieldToWorld } from "../field-space.ts";
import { screenInputToWorld } from "../input.ts";
import {
  acknowledgeDefeat, claimDaily, claimVictory, closeOverlay, createSession, openChallenge,
  ordinaryTargetCount, purchase, startChallenge, step, createFieldLevel, serializeSession, deserializeSession
} from "../session.ts";

import { BigValue } from "../big-value.ts";
import { upgradePriceValue, upgradeStatValue } from "../upgrade-tables.ts";

const fixedStep = 1 / 60;
const readySession = (seed = 1) => closeOverlay(claimDaily(createSession(seed)));

test("ordinary field starts at the original Cat transform before the first tree grid", () => {
  const battle = createSession(1).battle;
  assert.deepEqual(fieldToWorld(battle.player), { x: -100, z: 0 });
  assert.ok(battle.targets.every(target => fieldToWorld(target.position).z >= 26));
});

test("four screen directions map to the camera-aligned world diagonals", () => {
  const directions = [
    [{ moveX: 1 }, 1, 1], [{ moveX: -1 }, -1, -1],
    [{ moveY: -1 }, -1, 1], [{ moveY: 1 }, 1, -1]
  ];
  for (const [screen, xSign, zSign] of directions) {
    const world = screenInputToWorld(screen);
    assert.equal(Math.sign(world.moveX), xSign);
    assert.equal(Math.sign(world.moveY), zSign);
    const sx = screen.moveX ?? 0, sy = screen.moveY ?? 0;
    assert.ok(Math.abs(world.moveX - (sx / 1.2 + sy * 1.2) / Math.sqrt(2)) < 1e-10);
    assert.ok(Math.abs(world.moveY - (sx / 1.2 - sy * 1.2) / Math.sqrt(2)) < 1e-10);
    assert.ok(Math.abs(Math.hypot(world.moveX, world.moveY) - (sx ? 1 / 1.2 : 1.2)) < 1e-10);
  }
  assert.deepEqual(screenInputToWorld({}), { moveX: 0, moveY: 0 });
  const initial = readySession(1);
  const back = step(initial, 0.25, screenInputToWorld({ moveY: 1 }));
  assert.ok(fieldToWorld(back.battle.player).z < 0);
});

test("ordinary stage counts follow the traced Tree_Batch and Stage_Reload indices", () => {
  assert.equal(ordinaryTargetCount(0, 0), 30);
  assert.equal(ordinaryTargetCount(0, 1), 60);
  assert.equal(ordinaryTargetCount(0, 2), 90);
  assert.equal(ordinaryTargetCount(0, 4), 151);
  assert.equal(ordinaryTargetCount(7, 4), 501);
  assert.equal(createSession().battle.targets.length, 30);
  assert.equal(Math.trunc(14 / 60 * 100), 23);
  assert.equal(Math.trunc(80 / 90 * 100), 88);
});

test("Stage 1-5 includes the statically traced Boss and world-space auto stop", () => {
  const first = readySession(19);
  const stageFive = step({ ...first, battle: { ...first.battle, level: 3, phase: "won" } }, 0).battle;
  assert.equal(stageFive.targets.length, 151);
  const boss = stageFive.targets.at(-1);
  assert.deepEqual({ id: boss.id, health: boss.health, coin: boss.coin, boss: boss.boss },
    { id: 151, health: 8750, coin: 2000, boss: true });
  assert.equal(stageFive.autoStopWorldDistance, 10);

  const probe = { ...stageFive, player: { x: 4.5, y: 8 }, targets: [{ ...boss,
    position: { x: 4.5, y: 10 }, health: 8750 }] };
  const stopped = tick(probe, 0.1);
  assert.deepEqual(stopped.player, probe.player);
  const moving = tick({ ...probe, targets: [{ ...probe.targets[0], position: { x: 4.5, y: 13.5 } }] }, 0.1);
  assert.ok(moving.player.y > probe.player.y);
});

test("first ordinary batch uses source tiers and permits any of its 30 spawned targets to take damage", () => {
  const battle = createSession(1).battle;
  assert.equal(battle.targetBatchSize, 0);
  assert.equal(battle.targets.length, 30);
  assert.ok(battle.targets.every(target =>
    (target.maxHealth === 250 && target.coin === 20) ||
    (target.maxHealth === 450 && target.coin === 36)));
  assert.deepEqual(createSession(1).battle.targets, battle.targets);
  assert.notDeepEqual(createSession(2).battle.targets.map(target => target.maxHealth),
    battle.targets.map(target => target.maxHealth));

  const sixth = battle.targets[5];
  const probe = { ...battle, targets: battle.targets.map((target, index) => ({ ...target,
    position: index === 5 ? { ...battle.player } : { x: 100, y: 100 },
    health: index === 5 ? 10 : target.health })) };
  const result = tick(probe, 0.25);
  assert.equal(result.targets[5].health, 0);
  assert.equal(result.coins, sixth.coin);
  assert.equal(result.targets[0].health, battle.targets[0].health);
});

test("second ordinary level initializes two distinct source grids with level-specific tiers", () => {
  const initial = readySession(17);
  const next = step({ ...initial, battle: { ...initial.battle, phase: "won" } }, 0);
  assert.equal(next.battle.level, 1);
  assert.equal(next.battle.targets.length, 60);
  assert.equal(next.battle.targetBatchSize, 0);
  assert.ok(next.battle.targets.every(target =>
    (target.maxHealth === 250 && target.coin === 20) ||
    (target.maxHealth === 450 && target.coin === 36) ||
    (target.maxHealth === 750 && target.coin === 60)));
  const firstGridY = next.battle.targets.slice(0, 30).map(target => target.position.y);
  const secondGridY = next.battle.targets.slice(30).map(target => target.position.y);
  assert.ok(Math.max(...firstGridY) < Math.min(...secondGridY));
});

function advance(session, seconds) {
  for (let frame = 0; frame < Math.ceil(seconds / fixedStep); frame++) {
    session = step(session, fixedStep);
    if (session.mode === "victory" || session.mode === "defeat") break;
  }
  return session;
}

test("candidate upgrade pricing spends exactly once and rejects invalid levels", () => {
  assert.equal(upgradePrice(0), 50);
  assert.equal(upgradePrice(1), 68);
  assert.equal(upgradePrice(3), 131);
  assert.equal(upgradePrice(4), 181);
  assert.equal(upgradePrice(5), 249);
  assert.equal(upgradeValue("speed", 3), 124);
  assert.equal(upgradeValue("money", 3), 125);
  assert.equal(upgradeValue("power", 4), 135);
  assert.equal(upgradeValue("power", 5), 145);
  const levelFour = createLevel(0, 0, 181, { power: 4, money: 0, speed: 0 });
  const levelFive = buyUpgrade(levelFour, "power");
  assert.equal(levelFive.upgradeLevels.power, 5);
  assert.equal(levelFive.coins, 0);
  assert.throws(() => upgradePrice(-1), RangeError);
  assert.throws(() => upgradePrice(1.5), RangeError);
  const initial = createLevel(0, 0, 49);
  assert.equal(buyUpgrade(initial, "power"), initial);
  const funded = { ...initial, coins: 50 };
  const bought = buyUpgrade(funded, "power");
  assert.equal(bought.coins, 0);
  assert.equal(bought.upgradeLevels.power, 1);
  assert.equal(funded.coins, 50);
  assert.equal(buyUpgrade(bought, "power"), bought);
});

test("a lethal projectile awards a drop once and leaves input state unchanged", () => {
  const config = {
    ...candidateConfig,
    level: { ...candidateConfig.level, targetCount: 1, targetHealth: 10, targetCoin: 7 },
    player: { ...candidateConfig.player, baseDamage: 10, projectileSpeed: 100 }
  };
  const initial = createLevel(0, 0, 0, { power: 0, money: 0, speed: 0 }, config);
  const result = tick(initial, 0.25, {}, config);
  assert.equal(result.phase, "won");
  assert.equal(result.coins, 7);
  assert.equal(result.earned, 7);
  assert.equal(result.targets[0].health, 0);
  assert.equal(initial.targets[0].health, 10);
  assert.equal(initial.coins, 0);
  const repeated = tick(result, 0.25, {}, config);
  assert.deepEqual(repeated, { ...result, shotEvents: [],impactEvents:[],projectileLifecycleEvents:[] });
  assert.equal(repeated.coins, 7);
});

test("projectiles cannot damage a target in a hidden batch", () => {
  const config = { ...candidateConfig,
    level: { ...candidateConfig.level, targetCount: 6, targetHealth: 10 },
    player: { ...candidateConfig.player, attackRange: 1, projectileSpeed: 100 } };
  const initial = createLevel(0, 0, 0, undefined, config);
  initial.player = { x: 0.3, y: 0.3 };
  initial.targets = initial.targets.map((target, index) => ({ ...target,
    position: index === 5 ? { x: 4.5, y: 8 } : { x: 8, y: 15 } }));
  initial.projectiles = [{ id: 100, position: { x: 4.5, y: 8 }, velocity: { x: 0, y: 0 }, damage: 5, remainingRange: 1 }];
  const result = tick(initial, 0.1, {}, config);
  assert.equal(result.targets[5].health, 10);
  assert.equal(result.coins, 0);
});

test("fixed-step replay is deterministic and a challenge overlay pauses combat", () => {
  const replay = () => {
    let state = createLevel();
    for (let frame = 0; frame < 180; frame++) state = tick(state, fixedStep, { moveX: frame < 90 ? 1 : -1 });
    return state;
  };
  assert.deepEqual(replay(), replay());
  const session = openChallenge(readySession());
  const paused = step(session, fixedStep);
  assert.equal(paused.battle, session.battle);
  assert.equal(paused.battle.elapsed, 0);
});

test("manual input keeps analog speed and ignores the traced dead zone", () => {
  const state = createLevel();
  const deadZone = tick(state, 0.1, { moveX: 0.005 });
  const halfInput = tick(state, 0.1, { moveX: 0.5 });
  const fullInput = tick(state, 0.1, { moveX: 1 });
  assert.equal(deadZone.player.x, state.player.x);
  assert.ok(halfInput.player.x > state.player.x);
  assert.ok(halfInput.player.x < fullInput.player.x);
});

test("ordinary auto movement seeks a live target while joystick input takes priority", () => {
  const battle = createSession(9).battle;
  const targets = battle.targets.map((target, index) => ({ ...target,
    position: index === 0 ? { x: battle.player.x + 4, y: battle.player.y } : { x: 100, y: 100 } }));
  const probe = { ...battle, targets };
  const automatic = tick(probe, 0.1);
  const manual = tick(probe, 0.1, { moveX: -1 });
  assert.ok(automatic.player.x > probe.player.x);
  assert.ok(manual.player.x < probe.player.x);
  assert.equal(probe.player.x, battle.player.x);
});

test("fixed-step challenge win with seeded currency, claim, and unlock preserve field progress", () => {
  let session = readySession();
  session = { ...session, battle: { ...session.battle, coins: 526 } };
  for (let i = 0; i < 5; i++) session = purchase(session, "power");
  assert.equal(session.battle.upgradeLevels.power, 5);
  const field = session.battle;
  session = startChallenge(openChallenge(session));
  assert.equal(session.mode, "challenge");
  assert.equal(session.battle.autoMove, true);
  assert.equal(session.battle.targets.length, 20);
  const stageOneHealth = session.battle.targets.map(target => target.maxHealth);
  assert.ok(stageOneHealth.every(health => [250, 450, 750].includes(health)));
  assert.deepEqual(stageOneHealth, startChallenge(openChallenge(readySession(1))).battle.targets.map(target => target.maxHealth));
  assert.notDeepEqual(stageOneHealth, startChallenge(openChallenge(readySession(2))).battle.targets.map(target => target.maxHealth));
  session = advance(session, 60);
  assert.equal(session.mode, "victory");
  assert.ok(session.events.some(event => event.type === "stageWon"));
  session = claimVictory(session);
  assert.equal(session.mode, "field");
  assert.equal(session.diamonds, 100);
  assert.equal(session.challengeStage, 2);
  assert.equal(session.gunUnlocked, true);
  assert.deepEqual(session.battle.targets, field.targets);
  assert.equal(session.battle.upgradeLevels.power, 5);
  assert.deepEqual(session.events, [{ type: "gunUnlocked" }]);

  session = startChallenge(openChallenge(session));
  assert.equal(session.battle.stage, session.challengeStage - 1);
  assert.equal(session.battle.targets.length, 35);
  const stageTwoHealth = session.battle.targets.map(target => target.maxHealth);
  assert.ok(stageTwoHealth.every(health => [750, 1350, 2250].includes(health)));
  session = advance(session, 60);
  assert.equal(session.mode, "defeat");
  assert.ok(session.battle.targets.some(target => target.health === 0));
  assert.ok(session.battle.targets.some(target => target.health > 0));
});

test("challenge timeout enters defeat and acknowledgement restores the field", () => {
  let session = startChallenge(openChallenge(readySession()));
  const field = session.fieldBattle;
  session = { ...session, battle: { ...session.battle, elapsed: 59.9 } };
  session = step(session, 0.2);
  assert.equal(session.mode, "defeat");
  assert.ok(session.events.some(event => event.type === "stageFailed"));
  session = acknowledgeDefeat(session);
  assert.equal(session.mode, "field");
  assert.equal(session.challengeStage, 1);
  assert.deepEqual(session.battle.targets, field.targets);
});

test("source Stage 3 challenge continues with its own target count and HP", () => {
  const stageThree = { ...readySession(), challengeStage: 3 };
  const entered = startChallenge(openChallenge(stageThree));
  assert.equal(entered.mode,"challenge");
  assert.equal(entered.battle.targets.length,50);
  for(const target of entered.battle.targets) assert.equal(target.health,[2200,3960,6600][target.tier]);
});


const decimalTarget = (target, hp, coin = target.coinValue ?? BigValue.from(target.coin)) => ({
  ...target, health: numericMirror(hp), maxHealth: numericMirror(hp), healthValue: hp, maxHealthValue: hp,
  coin: numericMirror(coin), coinValue: coin
});
const singleTargetProbe = (hp = BigValue.from('1e100')) => {
  const config = { ...candidateConfig, level: { ...candidateConfig.level, targetCount: 1 } };
  const battle = createLevel(0, 0, 0, undefined, config);
  return { ...battle, targets: [decimalTarget({ ...battle.targets[0], position: { x: 6, y: 8 }, radius: 0.1 }, hp)] };
};

test("source input transform preserves analog amplitude and clamps before rotation", () => {
  assert.deepEqual(screenInputToWorld({ moveX: 2, moveY: -2 }), screenInputToWorld({ moveX: 1, moveY: -1 }));
  const small = screenInputToWorld({ moveX: 0.5, moveY: 0.25 });
  const large = screenInputToWorld({ moveX: 1, moveY: 0.5 });
  assert.ok(Math.abs(small.moveX * 2 - large.moveX) < 1e-12);
  assert.ok(Math.abs(small.moveY * 2 - large.moveY) < 1e-12);
});

test("Stage 3 source HP/money are 2200/180 and three grids sample unique source cells", () => {
  const battle = createFieldLevel(2, 2, 0, undefined, 19);
  assert.equal(battle.targets.length, 150);
  // Native int factors retain H5; double 1.8 retains H17 before multiplication.
  const tiers = new Map([[0, [2200, 180]], [1, [3960, 324]], [2, [6600, 540]]]);
  assert.ok(battle.targets.some(target => target.tier === 0));
  for (const target of battle.targets) {
    const [hp, coin] = tiers.get(target.tier);
    assert.ok(target.healthValue.eq(hp));
    assert.ok(target.coinValue.eq(coin));
    assert.equal(target.healthValue.precision, target.tier === 1 ? 17 : 5);
    assert.equal(target.coinValue.precision, target.tier === 1 ? 17 : 5);
  }
  for (let grid = 0; grid < 3; grid++) {
    const targets = battle.targets.filter(target => target.grid === grid);
    assert.equal(targets.length, 50);
    const cells = targets.map(target => {
      const world = fieldToWorld(target.position);
      const column = Math.round((world.x + 122.5) / 5);
      const row = Math.round((world.z - (27.5 + grid * 50)) / 5);
      assert.ok(column >= 0 && column < 10 && row >= 0 && row < 10);
      assert.ok(Math.abs(world.x - (-122.5 + column * 5)) <= 1.5 + 1e-10);
      assert.ok(Math.abs(world.z - (27.5 + grid * 50 + row * 5)) <= 1.5 + 1e-10);
      return `${column}:${row}`;
    });
    assert.equal(new Set(cells).size, 50);
  }
  assert.deepEqual(createFieldLevel(2, 2, 0, undefined, 19).targets, battle.targets);
});

test("4999/5000/5001 source prices and stats survive exact wallet debit beyond Number", () => {
  const expected = [
    [4999, '304e698', '103e163'], [5000, '42e699', '111e163'], [5001, '84e699', '119e163']
  ];
  for (const [level, priceText, statText] of expected) {
    const price = BigValue.from(priceText);
    assert.ok(upgradePriceValue(level).eq(price));
    assert.ok(upgradeStatValue('power', level).eq(statText));
    assert.ok(upgradeStatValue('money', level).eq(statText));
    assert.equal(upgradeValue('speed', level), 100 + 8 * level);
    const initial = createLevel(0, 0, price.add(7), { power: level, money: 0, speed: 0 });
    assert.equal(initial.coins, Number.MAX_VALUE);
    const bought = buyUpgrade(initial, 'power');
    assert.ok(walletValue(bought).eq(7));
    assert.equal(bought.upgradeLevels.power, level + 1);
    assert.ok(walletValue(initial).eq(price.add(7)));
    const short = createLevel(0, 0, price.sub(1), { power: level, money: 0, speed: 0 });
    assert.equal(short.coins, initial.coins, 'same Number mirror does not imply affordability');
    assert.equal(buyUpgrade(short, 'power'), short);
  }
});

test("BigValue HP subtraction and one-time huge payout preserve independent decimal authority", () => {
  const hp = BigValue.from('10000e996'), damage = BigValue.from('30000e995'), reward = BigValue.from('123e900');
  const initial = singleTargetProbe(hp);
  initial.coinsValue = BigValue.from('1e1000').add(7); initial.coins = numericMirror(initial.coinsValue);
  initial.shootCooldown = 999;
  initial.targets = [decimalTarget(initial.targets[0], hp, reward)];
  const bullet = amount => ({ id: 99, position: { ...initial.targets[0].position }, velocity: { x: 0, y: 0 },
    damage: numericMirror(amount), damageValue: amount, remainingRange: 1, distanceTraveled: 0, gunSlot: 0 });
  const hurt = tick({ ...initial, projectiles: [bullet(damage)] }, 0);
  assert.ok(healthValue(hurt.targets[0]).eq('7e999'));
  assert.equal(healthValue(hurt.targets[0]).fractionOf(hurt.targets[0].maxHealthValue), 0.7);
  assert.ok(walletValue(hurt).eq(initial.coinsValue));
  const killed = tick({ ...hurt, projectiles: [bullet(BigValue.from('7e999'))] }, 0);
  assert.ok(healthValue(killed.targets[0]).isZero);
  assert.ok(walletValue(killed).eq(initial.coinsValue.add(reward)));
  assert.ok(killed.earnedValue.eq(reward));
  assert.ok(walletValue(tick(killed, 0.1)).eq(walletValue(killed)));
  assert.ok(healthValue(initial.targets[0]).eq(hp));
});

test("schema 2 save restores huge wallet, HP, payout and projectile values as BigValue", () => {
  const session = readySession(29), battle = singleTargetProbe(BigValue.from('9876543210123456789e900'));
  battle.coinsValue = BigValue.from('1e2200').add(17); battle.coins = numericMirror(battle.coinsValue);
  battle.earnedValue = BigValue.from('7e1700'); battle.earned = numericMirror(battle.earnedValue);
  battle.targets[0] = decimalTarget(battle.targets[0], battle.targets[0].healthValue, BigValue.from('91e800'));
  battle.projectiles = [{ id: 777, position: { x: 4, y: 8 }, velocity: { x: 1, y: 0 }, damage: Number.MAX_VALUE,
    damageValue: BigValue.from('5e1000'), remainingRange: 10, distanceTraveled: 0, gunSlot: 0 }];
  const saved = { ...session, battle, fieldBattle: battle, events: [{ type: 'stageWon', stage: 0 }] };
  const restored = deserializeSession(serializeSession(saved));
  assert.ok(restored.battle.coinsValue instanceof BigValue);
  assert.ok(walletValue(restored.battle).sub('1e2200').eq(17));
  assert.ok(restored.battle.earnedValue.eq('7e1700'));
  assert.deepEqual(restored.battle.targets[0].healthValue.toJSON(), battle.targets[0].healthValue.toJSON());
  assert.ok(restored.battle.targets[0].maxHealthValue.eq(battle.targets[0].maxHealthValue));
  assert.ok(restored.battle.targets[0].coinValue.eq('91e800'));
  assert.ok(restored.battle.projectiles[0].damageValue.eq('5e1000'));
  assert.ok(walletValue(restored.fieldBattle).eq(battle.coinsValue));
  assert.deepEqual(restored.events, []);
  assert.equal(serializeSession(restored), serializeSession({ ...saved, notice: '' }));
});

test("three cat actors emit separate shotEvents from each resolved muzzle and session forwards every event", () => {
  const battle = singleTargetProbe();
  const guns = [
    { id: 'fixture-player', name: 'Player', damage: 100, intervalSeconds: 0.6 },
    { id: 'fixture-companion-1', name: 'Companion 1', damage: 50, intervalSeconds: 0.3 },
    { id: 'fixture-companion-2', name: 'Companion 2', damage: 80, intervalSeconds: 0.5 }
  ];
  const seen = new Map();
  const result = step({ ...readySession(31), battle, equippedGuns: guns }, fixedStep, {}, (actor, weapon) => {
    const muzzle = { position: { x: actor.position.x + 0.2, y: actor.position.y + 0.1 }, height: actor.id + 2 };
    seen.set(actor.id, muzzle); return muzzle;
  });
  assert.deepEqual(result.battle.actors.map(actor => actor.id), [0, 1, 2]);
  assert.deepEqual(result.battle.shotEvents.map(event => event.actorId), [0, 1, 2]);
  assert.equal(result.events.filter(event => event.type === 'shot').length, 3);
  const projectileIds = result.battle.shotEvents.flatMap(event => event.projectileIds);
  assert.equal(new Set(projectileIds).size, 3);
  for (const event of result.battle.shotEvents) {
    assert.equal(event.gunSlot, event.actorId);
    assert.equal(event.weaponId, guns[event.actorId].id);
    assert.deepEqual(event.muzzle, seen.get(event.actorId).position);
    assert.equal(event.height, seen.get(event.actorId).height);
    assert.equal(event.targetId, battle.targets[0].id);
    assert.ok(Math.abs(Math.hypot(event.direction.x, event.direction.y) - 1) < 1e-12);
    const projectile = result.battle.projectiles.find(item => item.id === event.projectileIds[0]);
    assert.deepEqual(projectile.spawnPosition, event.muzzle);
    assert.equal(projectile.gunSlot, event.gunSlot);
  }
});

test("a 0.25 second update preserves every elapsed fire event and resets the event list next update", () => {
  const battle = { ...singleTargetProbe(), primaryGun: { id: 'fast-fixture', damage: 1, intervalSeconds: 0.05 } };
  const result = tick(battle, 0.25, {}, candidateConfig, [], () => ({ position: { x: 0.5, y: 8 }, height: 2 }));
  assert.equal(result.shotEvents.length, 5);
  assert.deepEqual(result.shotEvents.map(event => Number(event.time.toFixed(9))), [0, 0.050000001, 0.100000001, 0.150000002, 0.200000003]);
  assert.equal(new Set(result.shotEvents.flatMap(event => event.projectileIds)).size, 5);
  assert.ok(result.shotEvents.every(event => event.projectileIds.length === 1 && event.weaponId === 'fast-fixture'));
  for (const event of result.shotEvents) {
    const projectile = result.projectiles.find(item => item.id === event.projectileIds[0]);
    assert.ok(projectile);
    assert.ok(Math.abs(projectile.distanceTraveled - 15 * (0.25 - event.time)) < 1e-10,
      'a late shot travels only the remaining part of the update');
  }
  const next = tick(result, 0);
  assert.deepEqual(next.shotEvents, []);
});

test("source cooldown floor keeps speed level 5000 at the native Float32 boundary in a 0.25 second update", () => {
  const battle = { ...singleTargetProbe(), primaryGun: { id: 'fast-upgrade-fixture', damage: 1, intervalSeconds: 0.6 },
    upgradeLevels: { power: 0, money: 0, speed: 5000 } };
  // Native CalculateAtkCoolMax clamps speed% to 100..10000, then final interval to .05..2.
  const result = tick(battle, 0.25);
  assert.equal(result.shotEvents.length, 5);
  assert.deepEqual(result.shotEvents.map(event => Number(event.time.toFixed(9))), [0, 0.050000001, 0.100000001, 0.150000002, 0.200000003]);
  assert.ok(result.shootCooldown > 0);
});

test("dead target invalidates aim immediately and manual input preempts only auto movement", () => {
  const battle = singleTargetProbe();
  battle.targets.push(decimalTarget({ ...battle.targets[0], id: 2, position: { x: 7, y: 8 } }, BigValue.from('1e100')));
  const aimed = tick(battle, 0);
  assert.equal(aimed.actors[0].aimTargetId, 1);
  assert.equal(aimed.actors[0].autoTargetId, 1);
  const dead = { ...aimed, targets: aimed.targets.map(target => target.id === 1 ? { ...target, health: 0, healthValue: BigValue.ZERO } : target) };
  const retargeted = tick(dead, 0);
  assert.equal(retargeted.actors[0].aimTargetId, 2);
  assert.equal(retargeted.actors[0].autoTargetId, 2);
  const manual = tick({ ...retargeted, autoMove: true }, 0.1, { moveX: -0.5 });
  assert.equal(manual.actors[0].autoTargetId, null);
  assert.equal(manual.actors[0].aimTargetId, 2);
  assert.ok(manual.player.x < retargeted.player.x);
  assert.equal(manual.actors[0].velocity.x, -7.5);
  const resumed = tick(manual, 0);
  assert.equal(resumed.actors[0].autoTargetId, 2);
});
