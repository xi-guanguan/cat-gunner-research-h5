// MODEL ONLY. Source binary32 branches, explicit synthetic camera/transform.
import test from 'node:test';import assert from 'node:assert/strict';
import {sourceRaidLeaderMovementFrame as run,freshSourceRaidLeaderAutoState as fresh,SOURCE_RAID_LEADER_CONSTANTS as C} from '../raid-leader-movement';
import {freshSourceHuntCatMovementState} from '../hunt-cat-movement';
import {sourceOrdinaryAutoApproach,sourceLerpVelocity,sourceAutoSmoothStop} from '../cat-movement-source';
import {SOURCE_RAID_CAT_SETTINGS} from '../raid-cat-runtime';
const f=Math.fround,z=()=>({x:0,y:0,z:0}),p=SOURCE_RAID_CAT_SETTINGS.cats.find(c=>c.componentID===147400).values;
function fixture(position={x:-100,y:0,z:0}){let calls=0;const boss={position:{x:-120,y:0,z:20}},camera={correctDirection:v=>v,screenSpeedMultiplier:()=>1,rotateJoystick:v=>v,findRaidBossTransform:()=>{calls++;return boss;}},input={dt:.1,moveSpeed:15,joystick:{x:0,y:0},nearObjectPosition:null,nearHitPoint:z()},state=freshSourceHuntCatMovementState(position);return {boss,camera,input,state,get calls(){return calls;}};}
test('Raid serialized stop10/offset-15 is not ordinary default16 and clamps offset to -9',()=>{
 const a=fixture(),r=run(a.state,fresh(),a.input,p,a.camera),math=sourceOrdinaryAutoApproach(a.state.position,a.boss.position,a.boss.position,5,{stopDistance:10,zOffsetMax:-15,zOffsetMinDist:3,zOffsetFullDist:10,decelerationRange:2});
 assert.equal(math.goal.z,11);assert.equal(r.branch,'approach');assert.equal(r.movement.running,true);assert.deepEqual(r.movement.position,a.state.position);
 assert.deepEqual(r.movement.smoothVelocity,sourceLerpVelocity(z(),{x:f(math.direction.x*15),y:0,z:f(math.direction.z*15)},.1));assert.equal(r.movement.flipX,true);
});
test('AutoMove dispatch strict < squared gate; exact equality is manual but not running',()=>{
 const a=fixture();for(const x of [.009,.01,.011]){const r=run(a.state,fresh(),{...a.input,joystick:{x,y:0}},p,a.camera);assert.equal(r.branch,x===.009?'approach':x===.01?'manual-stop':'manual');assert.equal(r.movement.running,x!==.01);}
 assert.equal(f(f(.01)*f(.01)),C.joystickSquared);
});
test('manual mapping uses 1.2 asymmetry then separate required yaw, no screen multiplier',()=>{
 const a=fixture();let seen;a.camera.rotateJoystick=v=>{seen=v;return {x:v.z,y:3,z:-v.x};};a.camera.screenSpeedMultiplier=()=>{throw Error('manual must not scale again');};
 const state={...a.state,bodyVelocity:{x:90,y:7,z:90}},r=run(state,{searchTimer:.2,target:a.boss},{...a.input,joystick:{x:1,y:.5}},p,a.camera);
 assert.deepEqual(seen,{x:f(1/f(1.2)),y:0,z:f(f(.5)*f(1.2))});assert.deepEqual(r.movement.bodyVelocity,{x:f(seen.z*15),y:7,z:f(-seen.x*15)});assert.deepEqual(r.auto,fresh());assert.equal(a.calls,0);
});
test('AutoMove=false with zero joystick is manual-stop and preserves old facing without nearObj',()=>{
 const a=fixture();const r=run({...a.state,flipX:true,bodyVelocity:{x:5,y:9,z:7}},fresh(),a.input,{...p,AutoMove:false},a.camera);assert.equal(r.branch,'manual-stop');assert.equal(r.movement.flipX,true);assert.deepEqual(r.movement.bodyVelocity,{x:0,y:9,z:0});assert.equal(a.calls,0);
});
test('ClearAutoTarget clears smooth only strictly >.001, including its Y component',()=>{
 const a=fixture();for(const smooth of [{x:0,y:0,z:0},{x:.01,y:0,z:0},{x:0,y:1,z:0}]){const r=run({...a.state,smoothVelocity:smooth},{searchTimer:.2,target:a.boss},{...a.input,joystick:{x:1,y:0}},p,a.camera);assert.deepEqual(r.auto,fresh());assert.deepEqual(r.movement.smoothVelocity,smooth.y?z():{x:f(smooth.x),y:f(smooth.y),z:f(smooth.z)});}
});
test('manual and stationary nearObj facing consume corrected target delta, <=0 flips',()=>{
 const a=fixture();let seen;a.camera.correctDirection=v=>{seen=v;return {x:0,y:0,z:0};};
 for(const x of [0,1]){const r=run(a.state,fresh(),{...a.input,joystick:{x,y:0},nearObjectPosition:{x:-90,y:3,z:4}},p,a.camera);assert.equal(r.movement.flipX,true);assert.deepEqual(seen,{x:10,y:3,z:4});}
});
test('null cache searches immediately, live Transform retained before interval, no catchup',()=>{
 const a=fixture();let r=run(a.state,fresh(),{...a.input,dt:.01},p,a.camera);assert.equal(a.calls,1);assert.equal(r.auto.searchTimer,0);assert.equal(r.auto.target,a.boss);
 a.boss.position={x:-80,y:0,z:20};r=run(a.state,r.auto,{...a.input,dt:.1},p,a.camera);assert.equal(a.calls,1);assert.equal(r.movement.flipX,false);
 r=run(a.state,r.auto,{...a.input,dt:p.AutoSearchInterval},p,a.camera);assert.equal(a.calls,2);assert.equal(r.auto.searchTimer,0);
 r=run(a.state,r.auto,{...a.input,dt:30},p,a.camera);assert.equal(a.calls,3);assert.equal(r.auto.searchTimer,0);
});
test('null target performs AutoSmoothStop without facing or rays, never guessed target',()=>{
 const a=fixture();a.camera.findRaidBossTransform=()=>null;a.camera.correctDirection=()=>{throw Error('no facing target');};const smooth={x:1,y:.5,z:1},r=run({...a.state,smoothVelocity:smooth,flipX:true,bodyVelocity:{x:1,y:8,z:1}},fresh(),a.input,p,a.camera);
 assert.equal(r.branch,'no-target');assert.deepEqual(r.movement.smoothVelocity,sourceAutoSmoothStop(smooth,.1));assert.equal(r.movement.bodyVelocity.y,8);assert.equal(r.movement.running,false);assert.equal(r.movement.flipX,true);
});
test('inside stop radius without nearObj stops even when raw target is within MinEnemyDist',()=>{
 const a=fixture({x:-120,y:0,z:18}),r=run(a.state,fresh(),a.input,p,a.camera);assert.equal(r.branch,'auto-stop');assert.equal(r.movement.running,false);
});
test('nearHitPoint not target transform controls stop/reference distance; at MinEnemyDist stops',()=>{
 const a=fixture(z());a.boss.position={x:100,y:0,z:100};const r=run(a.state,fresh(),{...a.input,nearObjectPosition:a.boss.position,nearHitPoint:{x:5,y:0,z:0}},p,a.camera);assert.equal(r.branch,'auto-stop');
 const distant=run(a.state,fresh(),{...a.input,nearObjectPosition:a.boss.position,nearHitPoint:{x:11,y:0,z:0}},p,a.camera);assert.equal(distant.branch,'approach');
});
test('retreat fallback is Vector3.right, not forward, and runs with bodyY retained',()=>{
 const a=fixture(z());a.boss.position=z();const r=run({...a.state,bodyVelocity:{x:0,y:6,z:0}},fresh(),{...a.input,nearObjectPosition:z(),nearHitPoint:z()},p,a.camera);
 assert.equal(r.branch,'retreat');assert.equal(r.movement.running,true);assert.equal(r.movement.bodyVelocity.y,6);assert.ok(r.movement.bodyVelocity.x>0);assert.equal(r.movement.bodyVelocity.z,0);assert.equal(r.movement.flipX,false);
});
test('retreat normalization uses full XYZ and arrival literal is .05, not inherited .1',()=>{
 assert.equal(C.retreatArrival,f(.05));const a=fixture();a.boss.position=z();
 for(const x of [.04,.075]){const state=freshSourceHuntCatMovementState({x,y:100,z:0}),r=run(state,fresh(),{...a.input,nearObjectPosition:z(),nearHitPoint:z()},p,a.camera);assert.equal(r.branch,x===.04?'auto-stop':'retreat');}
});
test('automatic stopped Run=false even while smooth velocity remains nonzero',()=>{
 const a=fixture({x:-120,y:0,z:18}),r=run({...a.state,smoothVelocity:{x:8,y:0,z:2},bodyVelocity:{x:8,y:11,z:2}},fresh(),a.input,p,a.camera);
 assert.equal(r.branch,'auto-stop');assert.equal(r.movement.running,false);assert.ok(r.movement.bodyVelocity.x>1);assert.equal(r.movement.bodyVelocity.y,11);
});
test('approach has reference deceleration, .2 minimum and screen scale does not rotate movement',()=>{
 const a=fixture(z());a.boss.position={x:20,y:0,z:20};a.camera.screenSpeedMultiplier=()=>2;a.camera.correctDirection=v=>({x:-v.x,y:v.y,z:-v.z});
 const ref={x:10.5,y:0,z:0},math=sourceOrdinaryAutoApproach(a.state.position,a.boss.position,ref,5,{stopDistance:10,zOffsetMax:-15,zOffsetMinDist:3,zOffsetFullDist:10,decelerationRange:2}),r=run(a.state,fresh(),{...a.input,nearObjectPosition:a.boss.position,nearHitPoint:ref},p,a.camera);
 assert.equal(r.branch,'approach');assert.equal(r.movement.flipX,true);assert.ok(r.movement.bodyVelocity.x>0);assert.deepEqual(r.movement.smoothVelocity,sourceLerpVelocity(z(),{x:f(2*f(math.speedRatio*f(math.direction.x*15))),y:0,z:f(2*f(math.speedRatio*f(math.direction.z*15)))},.1));
});
test('tiny approach goal smooth-stops instead of normalizing a near zero direction',()=>{
 const a=fixture({x:0,y:0,z:11});a.boss.position={x:0,y:0,z:20};const r=run(a.state,fresh(),{...a.input,nearObjectPosition:a.boss.position,nearHitPoint:{x:0,y:0,z:30}},p,a.camera);assert.equal(r.branch,'tiny-direction');assert.equal(r.movement.running,false);
});
test('invalid scalar/vector/required camera ports reject, with no writes or source lookup',()=>{
 const a=fixture();for(const bad of [-1,NaN,Infinity])assert.throws(()=>run(a.state,fresh(),{...a.input,dt:bad},p,a.camera),RangeError);
 assert.throws(()=>run(a.state,fresh(),{...a.input,joystick:{x:NaN,y:0}},p,a.camera));assert.throws(()=>run(a.state,fresh(),a.input,p,{...a.camera,rotateJoystick:null}));assert.throws(()=>run(a.state,fresh(),a.input,{...p,AutoStopDistance:-1},a.camera));assert.equal(a.calls,0);
});
