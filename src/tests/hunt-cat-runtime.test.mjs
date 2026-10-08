import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceHuntMonsterRuntime} from '../hunt-monster-runtime';
import {freshSourceHuntCatTargetState,sourceHuntFindNearestEnemy,sourceHuntCatRaycastFrame,sourceHuntMonsterRaycast,
 sourceHuntIsOnScreen,sourceHuntCatBulletSpawnPosition,sourceHuntCatBulletDirection,sourceHuntClampCatRadius,
 SourceHuntCatAttackRuntime,SOURCE_HUNT_CAT_CONFIG as config,SOURCE_HUNT_CAT_CONSTANTS as constants} from '../hunt-cat-runtime';
import {SourceGunType} from '../gun-projectiles';
const origin={x:-100,y:5,z:0};
const visible=()=>({x:.5,y:.5,z:1});
const hit=(distance=10,pos={x:-100,y:0,z:12},id=1)=>({colliderID:id,token:{id,generation:1},point:{x:-100,y:5,z:distance},transformPosition:pos,distance});
function fixture(positions){const r=new SourceHuntMonsterRuntime(),input={aspect:1,random:()=>.5};r.startLevel(0,0,input);for(let i=1;i<positions.length;i++)r.advanceSpawnFrame(1,input);const monsters=[...r.activeMonsters()];positions.forEach((pos,i)=>monsters[i].position=pos);return {r,monsters};}
test('Cat serialized mask/count/speeds and provenance are exact, not guessed',()=>{
 assert.equal(config.serialized.EnemyLayer,640);assert.equal(config.serialized.RayCount,36);assert.equal(config.serialized.Attack_Length,40);assert.equal(config.serialized.Raycast_Cool_Max,Math.fround(.1));
 assert.equal(config.cats.find(c=>!c.isAI).moveSpeed,13);assert.ok(config.cats.filter(c=>c.isAI).every(c=>c.moveSpeed===14));assert.match(config.sceneSha256,/^[0-9a-f]{64}$/);
});
test('IsOnScreen checks viewport XYZ and inclusive source margin, no camera explicit branch',()=>{
 const m=constants.screenMargin;for(const [x,y,z,expected] of [[-m,.5,1,true],[Math.fround(1+m),.5,1,true],[.5,-m,1,true],[.5,Math.fround(1+m),1,true],[-m-.0001,.5,1,false],[.5,1+m+.0001,1,false],[.5,.5,0,false],[.5,.5,-1,false]])assert.equal(sourceHuntIsOnScreen(origin,()=>({x,y,z})),expected);
 assert.equal(sourceHuntIsOnScreen(origin,()=>null),true);assert.throws(()=>sourceHuntIsOnScreen(origin,()=>({x:NaN,y:0,z:1})),RangeError);
});
test('36 worldXZ rays carry original mask40 length, strict distance and retain nearHitPoint on miss',()=>{
 let calls=0;const directions=[],a=hit(10),b=hit(10,undefined,2),c=hit(9,undefined,3),state={...freshSourceHuntCatTargetState(),nearHitPoint:{x:7,y:8,z:9}};
 const found=sourceHuntFindNearestEnemy(state,origin,(o,d,l,m)=>{assert.deepEqual(o,origin);assert.equal(l,40);assert.equal(m,640);assert.equal(d.y,0);directions.push(d);return [a,b,c][calls++]??null;},visible);
 assert.equal(calls,36);assert.equal(found.nearObj.colliderID,3);assert.deepEqual(found.nearHitPoint,c.point);assert.deepEqual(directions[0],{x:0,y:0,z:1});assert.ok(Math.abs(directions[9].x-1)<1e-6);assert.ok(Math.abs(directions[18].z+1)<1e-6);
 calls=0;const tie=sourceHuntFindNearestEnemy(state,origin,()=>[a,b][calls++]??null,visible);assert.equal(tie.nearObj.colliderID,1);
 const miss=sourceHuntFindNearestEnemy(found,origin,()=>null,visible);assert.equal(miss.nearObj,null);assert.deepEqual(miss.nearHitPoint,c.point);assert.equal(miss.hasOffScreenMonster,false);
});
test('offscreen first hit never falls through to farther hit and only mode4 caches movement target',()=>{
 let calls=0;const near=hit(3,{x:1,y:2,z:3}),far=hit(12,{x:4,y:5,z:6},2),project=p=>({x:p.x===1?2:.5,y:.5,z:1});
 const result=sourceHuntFindNearestEnemy(freshSourceHuntCatTargetState(),origin,()=>[far,near][calls++]??null,project);
 assert.equal(result.nearObj.colliderID,2);assert.equal(result.hasOffScreenMonster,true);assert.deepEqual(result.offScreenMonsterPosition,near.transformPosition);
 const off=sourceHuntFindNearestEnemy(result,origin,()=>near,project);assert.equal(off.nearObj,null);assert.equal(off.hasOffScreenMonster,true);assert.deepEqual(off.nearHitPoint,far.point);
 const other=sourceHuntFindNearestEnemy(off,origin,()=>near,project,0);assert.equal(other.hasOffScreenMonster,false);assert.deepEqual(other.offScreenMonsterPosition,near.transformPosition);
});
test('ray clock adds float32 delta, scans once and resets zero even for 50s stall',()=>{
 let n=0;const query=()=>{n++;return null;};let state=freshSourceHuntCatTargetState();state=sourceHuntCatRaycastFrame(state,.05,origin,query,visible);assert.equal(n,0);assert.equal(state.rayTimerSeconds,Math.fround(.05));
 state=sourceHuntCatRaycastFrame(state,.05,origin,query,visible);assert.equal(n,36);assert.equal(state.rayTimerSeconds,0);state=sourceHuntCatRaycastFrame(state,50,origin,query,visible);assert.equal(n,72);assert.equal(state.rayTimerSeconds,0);
 const before={...state};assert.throws(()=>sourceHuntCatRaycastFrame(state,-1,origin,query,visible),RangeError);assert.deepEqual(state,before);
});
test('real 3D ray capsules use nearest first collider, mask, origin-inside exclusion and alive state',()=>{
 const {r,monsters}=fixture([{x:-100,y:0,z:10},{x:-100,y:0,z:20}]),d={x:0,y:0,z:2};
 const ray=sourceHuntMonsterRaycast(r,origin,d,40,640);assert.equal(ray.colliderID,monsters[0].colliderID);assert.ok(Math.abs(ray.distance-7.9)<1e-4);assert.deepEqual(ray.transformPosition,monsters[0].position);
 assert.equal(sourceHuntMonsterRaycast(r,origin,d,5,640),null);assert.equal(sourceHuntMonsterRaycast(r,origin,d,40,1<<7),null);assert.equal(sourceHuntMonsterRaycast(r,{...origin,y:50},d,40,640),null);
 const inside=sourceHuntMonsterRaycast(r,{x:-100,y:5,z:10},d,40,640);assert.equal(inside.colliderID,monsters[1].colliderID);
 r.kill(r.token(monsters[0]));const next=sourceHuntMonsterRaycast(r,origin,d,40,640);assert.equal(next.colliderID,monsters[1].colliderID);r.dispose();assert.equal(sourceHuntMonsterRaycast(r,origin,d,40,640),null);
});
test('36-ray geometry actually resolves a visible Monster and stale token is detectable after pool reuse',()=>{
 const {r,monsters}=fixture([{x:-100,y:0,z:12}]);const found=sourceHuntFindNearestEnemy(freshSourceHuntCatTargetState(),origin,(...args)=>sourceHuntMonsterRaycast(r,...args),visible);
 assert.ok(found.nearObj);assert.equal(found.nearObj.colliderID,monsters[0].colliderID);assert.equal(r.current(found.nearObj.token),monsters[0]);r.kill(found.nearObj.token);assert.equal(r.current(found.nearObj.token),undefined);
});
test('muzzle projection consumes supplied CamCorrection and preserves plane; no guessed muzzle',()=>{
 assert.deepEqual(sourceHuntCatBulletSpawnPosition({x:4,y:6,z:8},{x:1,y:-2,z:3}),{x:6,y:2,z:14});assert.deepEqual(sourceHuntCatBulletSpawnPosition({x:4,y:2,z:8},{x:1,y:-2,z:3}),{x:4,y:2,z:8});
 assert.throws(()=>sourceHuntCatBulletSpawnPosition(origin,{x:0,y:0,z:1}),RangeError);assert.throws(()=>sourceHuntCatBulletSpawnPosition({...origin,x:NaN},{x:1,y:1,z:1}),RangeError);
});
test('direction is worldXZ normalized and strict squared threshold uses supplied CamForward',()=>{
 const fallback={x:.6,y:0,z:.8};assert.deepEqual(sourceHuntCatBulletDirection({x:0,y:2,z:0},{x:3,y:500,z:4},fallback),{x:Math.fround(.6),y:0,z:Math.fround(.8)});
 assert.deepEqual(sourceHuntCatBulletDirection({x:0,y:2,z:0},{x:0,y:99,z:0},fallback),{x:Math.fround(.6),y:0,z:Math.fround(.8)});
 assert.deepEqual(sourceHuntCatBulletDirection({x:0,y:2,z:0},{x:Math.fround(.01),y:0,z:0},fallback),{x:Math.fround(.6),y:0,z:Math.fround(.8)});
 assert.deepEqual(sourceHuntCatBulletDirection({x:0,y:2,z:0},{x:.01001,y:0,z:0},fallback),{x:1,y:0,z:0});
});
test('radius14 removes only outward XZ velocity, preserves inward/tangential and all Y',()=>{
 const center={x:-100,y:0,z:0};const inside=sourceHuntClampCatRadius({x:-87,y:3,z:0},{x:5,y:7,z:2},center);assert.equal(inside.clamped,false);assert.equal(inside.velocity.x,5);
 const at=sourceHuntClampCatRadius({x:-86,y:3,z:0},{x:5,y:7,z:2},center);assert.equal(at.clamped,true);assert.deepEqual(at.velocity,{x:0,y:7,z:2});
 const outside=sourceHuntClampCatRadius({x:-70,y:3,z:0},{x:-5,y:7,z:2},center);assert.deepEqual(outside.position,{x:-86,y:3,z:0});assert.deepEqual(outside.velocity,{x:-5,y:7,z:2});
 const diagonal=sourceHuntClampCatRadius({x:-80,y:3,z:20},{x:4,y:7,z:2},center);assert.ok(Math.abs(Math.hypot(diagonal.position.x+100,diagonal.position.z)-14)<1e-5);assert.ok(Math.abs(diagonal.velocity.x+diagonal.velocity.z)<1e-5);
});
test('Cat target transition resets fire clock; at most one emission per dt and lost-target decay',()=>{
 const attack=new SourceHuntCatAttackRuntime(),t=hit(),point=t.point;let calls=0;
 attack.advanceFrame(10,.5,SourceGunType.Single,null,point,()=>{calls++;return true;});assert.equal(calls,0);
 assert.equal(attack.advanceFrame(.1,.5,0,t,point,()=>{calls++;return true;}),false);assert.equal(attack.spread.attackTimerSeconds,Math.fround(.1));
 assert.equal(attack.advanceFrame(.5,.5,0,t,point,r=>{assert.equal(r.spreadDegrees,0);calls++;return true;}),true);assert.ok(attack.spread.spreadAngleDegrees>0);assert.equal(calls,1);
 attack.advanceFrame(50,.5,0,t,point,()=>{calls++;return true;});assert.equal(calls,2);assert.equal(attack.spread.attackTimerSeconds,0);
 attack.advanceFrame(50,.5,0,null,point,()=>{throw Error('must not emit');});assert.equal(attack.spread.spreadAngleDegrees,0);attack.reset();assert.equal(attack.spread.previousHadTarget,false);
});
test('allocation failure retries cooldown-dt; shotgun does not grow Cat spread; invalid dt is atomic',()=>{
 const attack=new SourceHuntCatAttackRuntime(),t=hit();assert.equal(attack.advanceFrame(.5,.5,0,t,t.point,()=>false),false);assert.equal(attack.spread.attackTimerSeconds,0);
 let calls=0;attack.advanceFrame(.1,.5,0,t,t.point,()=>false);attack.advanceFrame(.4,.5,0,t,t.point,()=>{calls++;return false;});assert.equal(calls,1);assert.ok(Math.abs(attack.spread.attackTimerSeconds-.1)<1e-6);
 attack.reset();attack.advanceFrame(1,.5,SourceGunType.Shotgun,t,t.point,()=>true);assert.equal(attack.spread.spreadAngleDegrees,0);
 const before=attack.spread;assert.throws(()=>attack.advanceFrame(-1,.5,0,t,t.point,()=>true),RangeError);assert.equal(attack.spread,before);
});
