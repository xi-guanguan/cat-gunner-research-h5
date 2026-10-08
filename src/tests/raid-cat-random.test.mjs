// MODEL ONLY. Port call/range contracts, H5 explicit local RNG and libm.
import test from 'node:test';import assert from 'node:assert/strict';
import {sourceRaidCatStartRandom,sourceRaidCatFidgetRandom,LocalTestRaidRandom,SOURCE_RAID_CAT_RANDOM as c} from '../raid-cat-random';
import {SourceRaidCatRuntime} from '../raid-cat-runtime';import {SourceRaidBattleRuntime} from '../raid-battle-runtime';
import {sourceRaidCandidates,freshSourceRaid} from '../r6-raid';import {createSession,sourceGun} from '../session';
import {freshSourceMetaState} from '../source-meta-runtime';import {createActivityState} from '../source-activities';import {freshPlatformState} from '../local-platform';
const f=Math.fround;
function recording(){const trace=[];return {trace,initState:id=>trace.push(['init',id]),rangeFloat:(min,max)=>{trace.push(['range',min,max]);return f(f(min)+f(f(max-min)*.5));}};}
test('Start seeds instance identity then exactly lag/speed/interval/attack draws',()=>{
 const rng=recording(),s=sourceRaidCatStartRandom(-123,rng);assert.deepEqual(rng.trace,[['init',-123],['range',c.lagMin,c.lagMax],['range',c.speedMin,c.speedMax],['range',c.intervalMin,c.intervalMax],['range',0,c.attackOffsetMax]]);
 assert.deepEqual(s.ai,{state:0,timer:0});assert.deepEqual(s.fidgetOffset,{x:0,y:0,z:0});assert.equal(s.fidgetTimer,0);assert.equal(s.attackDelayOffset,f(.2));
});
test('Start range endpoint inputs remain float32; do not drop fourth attack offset draw',()=>{
 for(const end of ['min','max']){const rng={initState:()=>{},rangeFloat:(min,max)=>end==='min'?min:max},s=sourceRaidCatStartRandom(123,rng);assert.equal(s.lagSeconds,end==='min'?c.lagMin:c.lagMax);assert.equal(s.attackDelayOffset,end==='min'?0:c.attackOffsetMax);assert.equal(s.fidgetInterval,end==='min'?c.intervalMin:c.intervalMax);}
});
test('invalid instance ID rejects before RNG and out-of-range result is not clamped to success',()=>{
 const rng=recording();for(const id of [NaN,1.1,Infinity,2147483648])assert.throws(()=>sourceRaidCatStartRandom(id,rng));assert.equal(rng.trace.length,0);
 for(const result of [-1,Infinity,NaN,1])assert.throws(()=>sourceRaidCatStartRandom(12,{initState:()=>{},rangeFloat:()=>result}),/out of bounds/);
});
test('AIFidget order interval/angle/radius; sin maps X, cos maps Z, Y is exactly zero',()=>{
 const ranges=[];for(const angle of [0,90,180,270,360]){let i=0;const values=[2,angle,.5],sample=sourceRaidCatFidgetRandom({initState:()=>{throw Error('must not reseed on fidget');},rangeFloat:(min,max)=>{ranges.push([min,max]);return values[i++];}}),r=f(f(angle)*c.degreesToRadians);
 assert.equal(i,3);assert.deepEqual(sample,{interval:2,offset:{x:f(.5*f(Math.sin(r))),y:0,z:f(.5*f(Math.cos(r)))}});}
 assert.deepEqual(ranges.slice(0,3),[[c.intervalMin,c.intervalMax],[0,360],[c.radiusMin,c.radiusMax]]);
});
test('named local test RNG is deterministic/reseedable, and int endpoint remains maxExclusive',()=>{
 const a=new LocalTestRaidRandom(),b=new LocalTestRaidRandom();assert.equal(a.identity,'local-test-xorshift32');const x=sourceRaidCatStartRandom(808,a),y=sourceRaidCatStartRandom(808,b);assert.deepEqual(x,y);
 for(let i=0;i<1000;i++){const v=a.rangeInt(2,5);assert.ok(v>=2&&v<5);const t=a.rangeFloat(.3,.8);assert.ok(t>=f(.3)&&t<=f(.8));}
 assert.throws(()=>a.rangeInt(5,5));
 assert.deepEqual(sourceRaidCatStartRandom(808,a),x);
});
test('sampled Start attack clock is consumed by actual Raid Cat runtime, then target acquisition resets it',()=>{
 const session=createSession();session.equippedGuns=[{...sourceGun(30),uid:'main'},null,null];session.gunInventory=[{...sourceGun(31),uid:'AI'}];const bundle={session,meta:freshSourceMetaState(),activities:createActivityState(),platform:freshPlatformState()},host=new SourceRaidBattleRuntime('random-contract',2,false);
 const rng=new LocalTestRaidRandom(),settings=new Map([[136809,sourceRaidCatStartRandom(136809,rng)]]),runtime=new SourceRaidCatRuntime(host,bundle,[...sourceRaidCandidates(session),null,null].slice(0,3),{slot5d5d4d0Static20:100,slot5d5d4d8Static60:0},settings);
 const ai=runtime.cats[1],initial=settings.get(ai.componentID).attackDelayOffset;assert.equal(ai.attack.spread.attackTimerSeconds,initial);assert.ok(initial>0);
 host.start(freshSourceRaid());const adapter={camForward:{x:0,y:-1,z:1},random:()=>.5,rangeInt:()=>0,project:()=>null,raycast:()=>null,movement:{correctDirection:v=>v,screenSpeedMultiplier:()=>1,pathClear:()=>true},rotateJoystick:v=>v,rayOrigin:c=>({...c.movement.position,y:2}),transformWorld:c=>c.movement.position,beforeAttack:()=>{},sampleFidget:()=>sourceRaidCatFidgetRandom(rng)};
 runtime.advanceFrame(.01,{simulate:true,presentation:true,acceptInput:true,joystick:{x:0,y:0}},adapter);assert.equal(ai.attack.spread.attackTimerSeconds,initial+f(.01));
 // sourceCatSpreadBeforeAttack explicitly discards initial attack delay on
 // false->true target. Do not introduce a guessed extra stagger cooldown.
 ai.attack.prepareFrame(.01,ai.cooldownSeconds,ai.gun.generation.type,true);assert.equal(ai.attack.spread.attackTimerSeconds,0);
});
