import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceActors, ordinaryActorGridPools, makeActor, DEFAULT_MOVEMENT_STAT_SLOTS, CAT_ACTOR_MOVEMENT_EVIDENCE } from '../cat-actors.ts';
import { createFieldLevel, createSession } from '../session.ts';
import { worldToField, fieldToWorld, FIELD_UNITS_PER_POINT } from '../field-space.ts';
import { candidateConfig } from '../config.ts';
import { sourceGetBreadcrumbTarget } from '../cat-movement-source.ts';

const config = { ...candidateConfig, arena: { ...candidateConfig.arena, height: 100 } };
const base = createFieldLevel(0, 0, 0, undefined, 19);
const position = worldToField(-100, 50);
const target = base.targets[0];
const withTargets = targets => ({ ...base, player: position, actors: [makeActor(0, position)], targets });

// These tests verify source contract consumption in H5, without original runtime capture.
test('ordinary grid scoring consumes the source positive-Z surcharge', () => {
  const state = withTargets([
    { ...target, id: 1, grid: 0, position: worldToField(-100, 59) },
    { ...target, id: 2, grid: 0, position: worldToField(-100, 40) },
  ]);
  assert.equal(advanceActors(state, 0, {}, config, [0])[0].autoTargetId, 2);
});

test('ordinary source stop16 holds at distance15 despite legacy state10', () => {
  const state = { ...withTargets([{ ...target, position: worldToField(-100, 65) }]), autoStopWorldDistance: 10 };
  const [actor] = advanceActors(state, .1, {}, config, [0]);
  assert.deepEqual(actor.position, position);
  assert.deepEqual(actor.velocity, { x: 0, y: 0 });
});

test('ordinary source approach advances at distance20', () => {
  const state = withTargets([{ ...target, position: worldToField(-100, 70) }]);
  assert.ok(advanceActors(state, .1, {}, config, [0])[0].position.y > position.y);
});

test('ordinary Main mode preserves Z offset across all five sublevels', () => {
  const targets = [{ ...target, position: worldToField(-80, 70) }];
  const zero = advanceActors({ ...withTargets(targets), level: 0 }, .1, {}, config, [0])[0];
  for (const level of [1, 2, 3, 4]) {
    const actor = advanceActors({ ...withTargets(targets), level }, .1, {}, config, [0])[0];
    assert.deepEqual(actor.velocity, zero.velocity);
  }
});

test('legacy two-field-point target is inside source stop and manual input still preempts', () => {
  const battle = createSession(9).battle;
  const state = { ...battle, targets: [{ ...battle.targets[0], position: { x: battle.player.x + 2, y: battle.player.y } }] };
  assert.equal(2 * FIELD_UNITS_PER_POINT.x, 100 / 9);
  assert.deepEqual(advanceActors(state, .1, {}, config, [0])[0].position, battle.player);
  assert.ok(advanceActors(state, .1, { moveX: -1 }, config, [0])[0].position.x < battle.player.x);
  const distant = { ...state, targets: [{ ...state.targets[0], position: { x: battle.player.x + 4, y: battle.player.y } }] };
  assert.ok(advanceActors(distant, .1, {}, config, [0])[0].position.x > battle.player.x);
});

test('level4 boss-only fixture retains active source grid objects and uses native stop16', () => {
  const stage = createFieldLevel(0, 4, 0, undefined, 19);
  const boss = stage.targets.find(t => t.boss);
  assert.ok(boss);
  const probe = { ...stage, player: { x: 4.5, y: 8 }, actors: [makeActor(0, { x: 4.5, y: 8 })], targets: [{ ...boss, position: { x: 4.5, y: 12 } }] };
  const [stopped] = advanceActors(probe, .1, {}, candidateConfig, [0]);
  assert.equal(stopped.autoTargetId, boss.id);
  assert.deepEqual(stopped.position, probe.player);
  const [moving] = advanceActors({ ...probe, targets: [{ ...probe.targets[0], position: { x: 4.5, y: 13.5 } }] }, .1, {}, candidateConfig, [0]);
  assert.ok(moving.position.y > probe.player.y);
});

test('no target consumes native squared-speed stop gate', () => {
  const actor = makeActor(0, position);
  actor.velocity = { x: .05, y: 0 };
  assert.deepEqual(advanceActors({ ...withTargets([]), actors: [actor] }, 0, {}, config, [0])[0].velocity, { x: 0, y: 0 });
});

test('source prefab grid anchors and original cell traversal survive seeded spawn jitter', () => {
  const state = createFieldLevel(0, 2, 0, undefined, 7);
  const grids = ordinaryActorGridPools(state, state.targets);
  assert.deepEqual(grids.map(g => g.z), [50, 100, 150, 200, 250]);
  assert.deepEqual(grids.map(g => g.active), [true, true, true, false, false]);
  for (let i = 0; i < 3; i++) {
    const cells = grids[i].trees.map(t => Math.round((t.position.x + 122.5) / 5) + 10 * Math.round((t.position.z - (27.5 + 50 * i)) / 5));
    assert.deepEqual(cells, [...cells].sort((a, b) => a - b));
  }
});

test('player actor consumes breadcrumb .5 record gate and cap100', () => {
  const actor = makeActor(0, position);
  actor.breadcrumbLastRecordPosition = worldToField(-100, 49.5);
  actor.breadcrumbs = Array.from({ length: 100 }, (_, i) => worldToField(-100, i));
  const [next] = advanceActors({ ...withTargets([]), actors: [actor] }, 0, {}, config, [0]);
  assert.equal(next.breadcrumbs.length, 100);
  assert.deepEqual(next.breadcrumbs[0], actor.breadcrumbs[1]);
  assert.deepEqual(next.breadcrumbs.at(-1), position);
  const last = fieldToWorld(next.breadcrumbLastRecordPosition);
  assert.equal(last.x, -100);assert.ok(Math.abs(last.z - 50) < 1e-12);
  assert.equal(actor.breadcrumbs.length, 100);
  assert.deepEqual(actor.breadcrumbs[0], worldToField(-100, 0));
});

test('breadcrumb nearest tie keeps native first entry and then advances five', () => {
  const history = [{ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, ...Array.from({ length: 8 }, (_, i) => ({ x: 10 + i, y: 0, z: 0 }))];
  assert.equal(sourceGetBreadcrumbTarget({ x: 0, y: 0, z: 0 }, history), history[5]);
});

test('raw movement modifier defaults and unresolved AI formation are explicit', () => {
  assert.deepEqual(DEFAULT_MOVEMENT_STAT_SLOTS, { slot5d5d4d0Static20: 100, slot5d5d4d8Static60: 0 });
  assert.match(CAT_ACTOR_MOVEMENT_EVIDENCE.aiFormation, /candidate/);
});
