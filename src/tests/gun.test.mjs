import {makeActor} from '../cat-actors.ts';
import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY_ONE_DIAMONDS, GUN_GACHA_COST, claimDaily, claimVictory, closeOverlay,
  createSession, drawGun, equipGun, openGun, step, unequipGun, GUN_INVENTORY_CAPACITY
} from "../session.ts";

const viewGun=g=>({id:g.id,name:g.name,damage:g.damage,intervalSeconds:g.intervalSeconds,sourceType:g.sourceType});
const afterDayOne = () => closeOverlay(claimDaily(createSession()));
const afterStageOne = (seed) => claimVictory({ ...closeOverlay(claimDaily(createSession(seed))), mode: "victory" });

test("Day 1 reward adds the observed 70 diamonds once before Stage 1 claim", () => {
  const initial = createSession();
  assert.equal(initial.overlay, "daily");
  assert.equal(initial.diamonds, 0);
  const claimed = claimDaily(initial);
  assert.equal(claimed.diamonds, DAY_ONE_DIAMONDS);
  assert.equal(claimed.dailyClaimed, true);
  assert.equal(claimDaily(claimed), claimed);
  assert.equal(afterStageOne().diamonds, 100);
});

test("Stage 1 basic claim unlocks Gun with the observed starter gun", () => {
  const claimed = afterStageOne();
  assert.equal(claimed.diamonds, 100);
  assert.equal(claimed.gunUnlocked, true);
  assert.deepEqual(claimed.equippedGuns, [
    { id: "starter-single-d", name: "Single D", damage: 100, intervalSeconds: Math.fround(.6), sourceType:0 }, null, null
  ]);
  assert.deepEqual(claimed.gunInventory, []);
  assert.equal(openGun(createSession()).overlay, "daily");
  assert.equal(openGun(claimed).overlay, "gun");
});

test("source group-zero draw spends 100 diamonds, stores a seeded gun, and permits another funded draw", () => {
  const claimed = afterStageOne(423);
  const gunPanel = openGun(claimed);
  assert.equal(GUN_GACHA_COST, 100);
  const drawn = drawGun(gunPanel);
  assert.equal(drawn.diamonds, 0);
  assert.equal(gunPanel.diamonds, 100);
  assert.equal(drawn.gunInventory.length, 1);
  assert.deepEqual(viewGun(drawn.gunInventory[0]), {
    id: "source-gun-2", name: "Light SMG", damage: 50, intervalSeconds: Math.fround(0.3),sourceType:0
  });
  assert.equal(drawn.gunDraws, 1);
  assert.equal(drawn.events[0].type, "gunDrawn");
  assert.deepEqual(drawn.equippedGuns, gunPanel.equippedGuns);
  assert.equal(drawGun(drawn), drawn);
  const funded = { ...drawn, diamonds: 200 };
  const second = drawGun(funded);
  assert.equal(second.diamonds, 100);
  assert.equal(second.gunDraws, 2);
  assert.equal(second.gunInventory.length, 2);
  assert.deepEqual(drawGun(openGun(afterStageOne(423))).gunInventory, drawn.gunInventory);
  const underfunded = openGun(claimVictory({ ...closeOverlay(createSession()), mode: "victory" }));
  assert.equal(drawGun(underfunded), underfunded);
});

test("first drawn gun moves from inventory into the observed middle slot", () => {
  const claimed = afterStageOne(423);
  const drawn = drawGun(openGun(claimed));
  const equipped = equipGun(drawn, 0, 1);
  assert.equal(equipped.gunInventory.length, 0);
  assert.deepEqual(viewGun(equipped.equippedGuns[1]), {
    id: "source-gun-2", name: "Light SMG", damage: 50, intervalSeconds: Math.fround(0.3),sourceType:0
  });
  assert.deepEqual(equipped.events, [{ type: "gunEquipped", gun: equipped.equippedGuns[1], slot: 1 }]);
  assert.deepEqual(drawn.equippedGuns[1], null);
  assert.equal(equipGun(drawn, 0, 0), drawn);
  assert.equal(equipGun(drawn, 0, 3), drawn);
  assert.equal(equipGun(equipped, 0, 2), equipped);
});

test("an equipped second gun fires an independent opening projectile", () => {
  const claimed = afterStageOne(423);
  const drawn = drawGun(openGun(claimed));
  const equipped = equipGun(drawn, 0, 1);
  // Opening damage/equipment probe: all source actors already hold a target and are ready.
  const actors=[0,1].map(id=>({...makeActor(id,claimed.battle.player),
    attackState:{spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:2}}));
  const battle = { ...claimed.battle, actors, targets: claimed.battle.targets.map((target, index) => ({ ...target,
    position: index === 0 ? { x: claimed.battle.player.x + 2, y: claimed.battle.player.y } : { x: 100, y: 100 } })) };
  const single = step({ ...claimed, overlay: "none", battle }, 1 / 60);
  const double = step({ ...equipped, overlay: "none", battle }, 1 / 60);
  assert.equal(single.battle.projectiles.length, 1);
  assert.equal(double.battle.projectiles.length, 2);
  assert.deepEqual(double.battle.projectiles.map(projectile => projectile.damage), [100, 50]);
  assert.deepEqual(double.battle.projectiles.map(projectile => projectile.gunSlot), [0, 1]);
  assert.ok(double.battle.projectiles.every(projectile => projectile.distanceTraveled === 0));
  const boosted = { ...equipped, battle: { ...battle,
    upgradeLevels: { power: 5, speed: 0, money: 0 } } };
  const boostedShots = step(boosted, 1 / 60).battle.projectiles;
  assert.deepEqual(boostedShots.map(projectile => projectile.damage), [145, 72]);
});

test("source shotgun entries emit two independently scattered world-space projectiles", () => {
  const claimed = afterStageOne(1000);
  const drawn = drawGun(openGun(claimed));
  assert.equal(drawn.gunInventory[0].id, "source-gun-3");
  const equipped = equipGun(drawn, 0, 1);
  // Opening damage/equipment probe: all source actors already hold a target and are ready.
  const actors=[0,1].map(id=>({...makeActor(id,claimed.battle.player),
    attackState:{spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:2}}));
  const battle = { ...claimed.battle, actors, targets: claimed.battle.targets.map((target, index) => ({ ...target,
    position: index === 0 ? { x: claimed.battle.player.x + 2, y: claimed.battle.player.y } : { x: 100, y: 100 } })) };
  const result = step({ ...equipped, overlay: "none", battle }, 1 / 60).battle;
  assert.equal(result.projectiles.length, 3);
  assert.deepEqual(result.projectiles.map(projectile => projectile.damage), [100, 80, 80]);
  const shot = result.shotEvents.find(event => event.gunSlot === 1);
  const pelletAngles = shot.projectileIds.map(id => {
    const bullet = result.projectiles.find(projectile => projectile.id === id);
    const u=result.worldUnitsPerPoint,dx=shot.direction.x*u.x,dz=shot.direction.y*u.y,
      vx=bullet.velocity.x*u.x,vz=bullet.velocity.y*u.y;
    return Math.atan2(dx*vz-dz*vx,dx*vx+dz*vz);
  });
  assert.notEqual(pelletAngles[0],pelletAngles[1]);
  assert.ok(pelletAngles.every(a=>Math.abs(a)<=10*Math.PI/180+1e-8));
});


test("H5 equipment policy blocks removal of the last gun without consuming inventory", () => {
  const panel = openGun(afterStageOne(423));
  const blocked = unequipGun(panel, 0);
  assert.deepEqual(blocked.equippedGuns, panel.equippedGuns);
  assert.deepEqual(blocked.gunInventory, panel.gunInventory);
  assert.equal(blocked.notice, '无法卸下，至少需要装备1件');
  assert.equal(unequipGun({ ...panel, overlay: 'none' }, 0).overlay, 'none');
  const paired = equipGun(drawGun(panel), 0, 1);
  const removed = unequipGun(paired, 0);
  assert.equal(removed.equippedGuns[0].id, paired.equippedGuns[1].id);
  assert.equal(removed.equippedGuns[1], null);
  assert.equal(removed.gunInventory.at(-1).id, paired.equippedGuns[0].id);
  assert.equal(removed.equippedGuns.filter(Boolean).length, 1);
  const last = unequipGun(removed, 0);
  assert.deepEqual(last.equippedGuns, removed.equippedGuns);
  assert.deepEqual(last.gunInventory, removed.gunInventory);
  const full = { ...paired, gunInventory: Array.from({ length: GUN_INVENTORY_CAPACITY }, () => paired.equippedGuns[0]) };
  const rejected = unequipGun(full, 1);
  assert.equal(rejected.notice, '背包已满');
  assert.deepEqual(rejected.equippedGuns, full.equippedGuns);
  assert.equal(rejected.gunInventory.length, GUN_INVENTORY_CAPACITY);
});
