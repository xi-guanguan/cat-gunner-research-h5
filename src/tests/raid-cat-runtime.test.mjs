// MODEL ONLY: genuine Cat clocks, sphere rays and projectile contacts, with
// explicit synthetic camera/rig/RNG. Not source scene or device parity.
import test from 'node:test';import assert from 'node:assert/strict';
import {SourceRaidCatRuntime,sourceRaidEnemyRaycast,SOURCE_RAID_CAT_SETTINGS} from '../raid-cat-runtime';
import {SourceRaidBattleRuntime} from '../raid-battle-runtime';
import {SourceRaidCatClientScene} from '../raid-cat-client-scene';
import {SourceRaidClientOwner} from '../raid-client-owner';
import {SOURCE_RAID_WORLD} from '../raid-boss-runtime';
import {sourceHuntGunSockets} from '../hunt-gun-sockets';
import {sourceRaidCandidates,freshSourceRaid,sourceRaidSeason,sourceRaidTickets} from '../r6-raid';
import {sourceMoveSpeedFromRawStatSlots} from '../cat-movement-source';
import {createSession,sourceGun} from '../session';
import {freshSourceMetaState} from '../source-meta-runtime';
import {createActivityState} from '../source-activities';import {freshPlatformState} from '../local-platform';
import {createLocalMineTime} from '../mine-time';
const f=Math.fround,zero=()=>({x:0,y:0,z:0}),stats={slot5d5d4d0Static20:100,slot5d5d4d8Static60:0};
const frame={simulate:true,presentation:true,acceptInput:true,joystick:{x:0,y:0}};
function bundle(ids=[30,31,32]){const s=createSession();s.equippedGuns=[{...sourceGun(ids[0]),uid:'leader'},null,null];s.gunInventory=ids.slice(1).map((id,i)=>({...sourceGun(id),uid:`AI${i}`}));return {session:s,meta:freshSourceMetaState(),activities:createActivityState(),platform:freshPlatformState()};}
function settings(){return new Map([136809,136808].map(id=>[id,{lagSeconds:.2,speedMultiplier:1,attackDelayOffset:0,fidgetInterval:2,fidgetTimer:0,fidgetOffset:zero(),ai:{state:0,timer:0}}]));}
function setup(ids=[30,31,32],active=true){const b=bundle(ids),selection=[...sourceRaidCandidates(b.session),null,null].slice(0,3),host=new SourceRaidBattleRuntime('cat-model',2,false),cats=new SourceRaidCatRuntime(host,b,selection,stats,settings());if(active)host.start(freshSourceRaid());let rays=0,randomCalls=0,fidgets=0;const sockets=[],pose=[];
 const adapter={camForward:{x:0,y:-1,z:1},random:()=>{randomCalls++;return .5;},rangeInt:()=>0,project:()=>({x:.5,y:.5,z:1}),
  raycast:(...args)=>{rays++;return sourceRaidEnemyRaycast(host.boss,...args);},rayOrigin:c=>({...c.movement.position,y:2}),
  movement:{correctDirection:v=>v,screenSpeedMultiplier:()=>1,pathClear:()=>true},
  rotateJoystick:v=>v,
  transformWorld:(c,id)=>{sockets.push({id,cat:c.componentID});const bound=sourceHuntGunSockets(c.componentID,c.gun.gunNum);assert.ok([bound.shoot,...bound.shootRandom].includes(id));return {...c.movement.position,y:2};},
  beforeAttack:(c)=>pose.push(`attack:${c.componentID}`),afterCatUpdate:c=>pose.push(`pose:${c.componentID}`),
  sampleFidget:()=>{fidgets++;return {interval:2,offset:{x:.5,y:0,z:0}};}};
 return {b,selection,host,cats,adapter,sockets,pose,get rays(){return rays;},get randomCalls(){return randomCalls;},get fidgets(){return fidgets;}};
}
test('Raid ray uses original sphere/layer/Enemy identity and transform, not center or Hunt collider',()=>{
 const s=setup(),origin={x:-150,y:2,z:20},direction={x:2,y:0,z:0},hit=sourceRaidEnemyRaycast(s.host.boss,origin,direction,40,640);
 assert.equal(hit.colliderID,SOURCE_RAID_WORLD.colliderID);assert.deepEqual(hit.token,s.host.boss.token());assert.deepEqual(hit.transformPosition,{x:-120,y:0,z:20});assert.ok(hit.distance>18&&hit.distance<19);assert.equal(hit.point.y,2);
 assert.equal(sourceRaidEnemyRaycast(s.host.boss,origin,direction,10,640),null);assert.equal(sourceRaidEnemyRaycast(s.host.boss,origin,direction,40,512),null);
 assert.equal(sourceRaidEnemyRaycast(s.host.boss,{x:-120,y:2,z:20},direction,40,640),null);assert.equal(sourceRaidEnemyRaycast(s.host.boss,origin,zero(),40,640),null);
 s.host.exit();assert.equal(sourceRaidEnemyRaycast(s.host.boss,origin,direction,40,640),null);
});
test('serialized StopDistance10 overrides ctor/default16 for every selected source Cat',()=>{
 const s=setup();for(const c of s.cats.cats){assert.equal(c.sourceSettings.AutoStopDistance,10);assert.equal(c.sourceSettings.AutoMove,true);assert.equal(SOURCE_RAID_CAT_SETTINGS.cats.find(v=>v.componentID===c.componentID).fieldOffsets.AutoStopDistance,1156);}
});
test('selected compact Cats retain UID, star/damage/source sockets and source raw movement slots',()=>{
 const s=setup();assert.deepEqual(s.cats.cats.map(c=>c.selected.uid),['leader','AI0','AI1']);assert.deepEqual(s.cats.cats.map(c=>c.slotNum),[0,1,2]);
 s.cats.advanceFrame(.3,{...frame,joystick:{x:1,y:0}},s.adapter);assert.equal(s.cats.cats[0].movement.bodyVelocity.x,f(f(1/f(1.2))*15));assert.ok(s.sockets.length>=3);assert.equal(s.cats.cats[1].follow.ai.state,1);assert.equal(s.cats.cats[1].movement.running,true);
});
test('prepared, paused, zero-delta, terminal and disposed Cats never query/fire/advance',()=>{
 const s=setup(undefined,false),before=JSON.stringify(s.cats.cats.map(c=>c.movement));s.cats.advanceFrame(20,frame,s.adapter);s.host.start(freshSourceRaid());s.cats.advanceFrame(20,{...frame,simulate:false},s.adapter);s.cats.advanceFrame(0,frame,s.adapter);
 assert.equal(s.rays,0);assert.equal(s.cats.elapsedSeconds,0);assert.equal(JSON.stringify(s.cats.cats.map(c=>c.movement)),before);s.host.exit();s.cats.advanceFrame(1,frame,s.adapter);s.cats.dispose();s.cats.dispose();s.cats.advanceFrame(1,frame,s.adapter);assert.equal(s.rays,0);
});
test('Cats never advance authoritative timer or flights; real contacts require one host step',()=>{
 const s=setup([60]);const hp=s.host.boss.enemy.health.toString();s.cats.advanceFrame(.1,frame,s.adapter);assert.equal(s.host.remainingSeconds,60);assert.equal(s.host.boss.enemy.health.toString(),hp);assert.equal(s.host.score,0);assert.ok(s.host.projectiles.activeCount>0);
 const flight=s.host.advanceFrame(.4);assert.ok(flight.some(e=>e.event.kind==='direct-damage'));assert.equal(s.host.score,1);assert.equal(s.host.remainingSeconds,f(60-f(.4)));assert.equal(s.host.boss.enemy.health.toNumber(),3e7);
});
test('UI5 offscreen boss is not an offscreen-Hunt target and never fabricates attacks',()=>{
 const s=setup();s.adapter.project=()=>({x:3,y:.5,z:1});s.cats.advanceFrame(1,frame,s.adapter);assert.equal(s.rays,108);assert.equal(s.host.projectiles.activeCount,0);for(const c of s.cats.cats){assert.equal(c.target.nearObj,null);assert.equal(c.target.hasOffScreenMonster,false);}assert.equal(s.randomCalls,0);
});
test('native one-query/no-catchup and real per-Cat pose order on a long frame',()=>{
 const s=setup();s.cats.advanceFrame(3,frame,s.adapter);assert.equal(s.rays,108);const attacks=s.cats.drainEvents();assert.equal(attacks.length,3);assert.equal(s.cats.drainEvents().length,0);
 assert.ok(s.pose.indexOf('pose:147400')<s.pose.indexOf('attack:147400'));for(const id of [136809,136808])assert.ok(s.pose.indexOf(`attack:${id}`)<s.pose.indexOf(`pose:${id}`));
});
test('same Enemy Reload rebinds cache generation without waiting for next ray or replaying damage',()=>{
 const s=setup([60]);s.cats.advanceFrame(.1,frame,s.adapter);s.cats.drainEvents();const old=s.cats.cats[0].target.nearObj.token;s.host.advanceFrame(.4);assert.equal(s.host.score,1);const count=s.rays;
 s.cats.advanceFrame(.06,frame,s.adapter);assert.equal(s.rays,count);assert.notEqual(s.cats.cats[0].target.nearObj.token.generation,old.generation);assert.equal(s.cats.drainEvents().length,1);assert.equal(s.host.score,1);s.host.advanceFrame(.4);assert.equal(s.host.score,2);
});
test('pool allocation failure has no synthetic HP or attack event and source clock may retry',()=>{
 const s=setup([60]);s.adapter.canAllocate=()=>false;s.cats.advanceFrame(.1,frame,s.adapter);assert.equal(s.cats.drainEvents().length,0);assert.equal(s.host.projectiles.activeCount,0);assert.equal(s.host.score,0);
 s.adapter.canAllocate=()=>true;s.cats.advanceFrame(.1,frame,s.adapter);assert.equal(s.cats.drainEvents().length,1);assert.equal(s.host.score,0);
});
test('acceptInput gates joystick, not simulation; presentation=false does not mute calculations',()=>{
 const s=setup([30]);s.cats.advanceFrame(.1,{...frame,acceptInput:false,presentation:false,joystick:{x:1,y:1}},s.adapter);assert.equal(s.cats.cats[0].leaderAuto.target.position.x,-120);assert.equal(s.cats.cats[0].movement.running,true);assert.equal(s.rays,36);assert.equal(s.cats.drainEvents().length,1);
});
test('no mode4 clamp: original Raid Warp and free leader position survive outside radius14',()=>{
 const s=setup([30]);s.cats.cats[0].movement={...s.cats.cats[0].movement,position:{x:-150,y:0,z:20}};s.cats.advanceFrame(.1,{...frame,joystick:{x:1,y:0}},s.adapter);assert.equal(s.cats.cats[0].movement.position.x,f(-150+f(f(15/f(1.2))*f(.1))));
});
test('near Follow alone consumes fidget; far Follow keeps its random state and history lag',()=>{
 const s=setup();s.adapter.project=()=>({x:3,y:.5,z:1});const c=s.cats.cats[1];c.movement={...c.movement,position:{x:-100,y:0,z:2.5}};c.follow={...c.follow,fidgetTimer:1.99};s.cats.cats[2].movement={...s.cats.cats[2].movement,position:{x:-160,y:0,z:0}};s.cats.advanceFrame(.02,frame,s.adapter);assert.equal(s.fidgets,1);assert.equal(c.follow.fidgetTimer,0);assert.deepEqual(c.follow.fidgetOffset,{x:.5,y:0,z:0});
 const far=s.cats.cats[2];assert.equal(far.follow.fidgetTimer,0);
});
test('invalid clock/camera/joystick and unresolved settings reject without host debit',()=>{
 const s=setup();for(const dt of [-1,NaN,Infinity])assert.throws(()=>s.cats.advanceFrame(dt,frame,s.adapter),RangeError);assert.throws(()=>s.cats.advanceFrame(.1,{...frame,joystick:{x:NaN,y:0}},s.adapter));assert.throws(()=>s.cats.advanceFrame(.1,frame,{...s.adapter,camForward:{x:0,y:0,z:1}}));assert.equal(s.cats.elapsedSeconds,0);assert.equal(s.host.remainingSeconds,60);
 assert.throws(()=>new SourceRaidCatRuntime(s.host,s.b,s.selection,stats,new Map()),/Awake/);assert.throws(()=>new SourceRaidCatRuntime(s.host,s.b,s.selection,{...stats,slot5d5d4d8Static60:NaN},settings()),/movement stat/);
});
test('real leader movement is integrated exactly once, never by camera or host',()=>{
 const s=setup([30]),before=s.cats.cats[0].movement.position;s.cats.advanceFrame(.1,{...frame,joystick:{x:1,y:0}},s.adapter);
 const c=s.cats.cats[0];assert.equal(c.movement.position.x,f(before.x+f(c.movement.bodyVelocity.x*f(.1))));assert.equal(s.host.remainingSeconds,60);assert.deepEqual(c.leaderAuto,{searchTimer:0,target:null});
});
function sceneSetup(){const s=setup([60]);let destroyed=0,prepareCount=0;const consumed=[];const scene=new SourceRaidCatClientScene(s.host,s.selection,{read:()=>s.b,prepare:async()=>{prepareCount++;},bindCats:()=>{},movementStats:()=>stats,followSettings:settings,adapter:()=>s.adapter,consume:(e,f,a)=>consumed.push({e,f,a}),render:()=>{},destroy:()=>{destroyed++;},setPresentationEnabled:()=>{}});return {s,scene,consumed,get destroyed(){return destroyed;},get prepareCount(){return prepareCount;}};}
test('client scene prepares once, binds a single host and does not replay drained attacks',async()=>{
 const a=sceneSetup();assert.throws(()=>a.scene.advanceCats(a.s.host,.1,frame),/not prepared/);await Promise.all([a.scene.prepare(),a.scene.prepare()]);assert.equal(a.prepareCount,1);a.scene.advanceCats(a.s.host,.1,frame);assert.equal(a.s.host.remainingSeconds,60);assert.throws(()=>a.scene.advanceCats(new SourceRaidBattleRuntime('foreign',2,false),.1,frame),/foreign/);
 a.scene.consume([],[],.1);a.scene.consume([],[],.1);assert.equal(a.consumed[0].a.length,1);assert.equal(a.consumed[1].a.length,0);a.scene.destroy();a.scene.destroy();assert.equal(a.destroyed,1);
});
test('pending scene preparation never resurrects Cats after destroy',async()=>{
 const s=setup([30]);let done,destroyed=0;const scene=new SourceRaidCatClientScene(s.host,s.selection,{read:()=>s.b,prepare:()=>new Promise(resolve=>{done=resolve;}),bindCats:()=>{},movementStats:()=>stats,followSettings:settings,adapter:()=>s.adapter,consume:()=>{},render:()=>{},destroy:()=>destroyed++,setPresentationEnabled:()=>{}});
 const pending=scene.prepare();scene.destroy();done();await pending;assert.equal(scene.cats,null);assert.equal(destroyed,1);
});
test('existing owner runs genuine Cat/projectile chain, one clock and once-only score save',async()=>{
 let b=bundle([60]);b.session.historicMax=390;const date=new Date(2026,9,3,12),time=createLocalMineTime(()=>date);b.meta.raid=sourceRaidTickets(sourceRaidSeason(b.meta.raid,date),time);
 const before=JSON.stringify(b.session.equippedGuns),writes=[],consumed=[];let scene,adapter,synthetic;
 const owner=new SourceRaidClientOwner('owner-real-cat',[...sourceRaidCandidates(b.session),null,null].slice(0,3),{read:()=>b,current:()=>true,write:(next,why)=>{b=next;writes.push(why);},execute:()=>{throw Error('unexpected provider');},notice:()=>{},scene:(host,selection)=>{
  synthetic=setup([60]);adapter={...synthetic.adapter,raycast:(...args)=>sourceRaidEnemyRaycast(host.boss,...args)};
  scene=new SourceRaidCatClientScene(host,selection,{read:()=>b,prepare:async()=>{},bindCats:()=>{},movementStats:()=>stats,followSettings:settings,adapter:()=>adapter,consume:(e,f,a)=>consumed.push({e,f,a}),render:()=>{},destroy:()=>{},setPresentationEnabled:()=>{}});return scene;
 }});
 assert.equal(await owner.start(),true);assert.equal(b.meta.raid.freeUseCount,1);assert.equal(b.meta.raid.tryCount,0);owner.advance(2,frame);assert.equal(owner.phase,'playing');assert.equal(b.meta.raid.tryCount,1);
 owner.advance(.4,frame);assert.equal(owner.frameCount,1);assert.equal(owner.host.remainingSeconds,f(60-f(.4)));assert.equal(owner.host.score,1);assert.ok(consumed.some(x=>x.a.length&&x.f.length));
 // Stop allocation, let the native timer cross zero and settle on next resume.
 adapter.canAllocate=()=>false;owner.advance(61,frame);owner.advance(0,frame);assert.equal(owner.phase,'ended');assert.equal(b.session.starGem,owner.host.result.starGem);assert.deepEqual(writes,['admission','start','progress','result']);assert.equal(b.meta.raidStarPig.gem,75);assert.equal(JSON.stringify(b.session.equippedGuns),before);
 owner.advance(10,frame);assert.equal(writes.filter(v=>v==='result').length,1);assert.equal(owner.exit(),true);owner.advance(1.5,frame);owner.advance(.2,frame);assert.equal(owner.closed,true);
});
test('active helper is real fourth attack emitter, source sockets, swept hit and eco simulation, never inventory',()=>{
 const b=bundle([30,31,32]);b.meta.raid={...freshSourceRaid(),seasonIndex:7,helperSeasonIndex:7};b.session.bossSlotLevels=[3,1,5];const selection=sourceRaidCandidates(b.session),host=new SourceRaidBattleRuntime('helper-model',2,false),follow=settings();follow.set(136810,{...follow.get(136809)});
 const cats=new SourceRaidCatRuntime(host,b,selection,stats,follow);host.start(b.meta.raid);const helper=cats.cats.find(c=>c.componentID===136810);assert.equal(cats.cats.length,4);assert.equal(helper.gun.starLevel,1);assert.equal(helper.selected,null);assert.equal(helper.slotNum,-1);
 // Set a visible scene origin for a deterministic model of all source emission.
 for(const c of cats.cats)c.movement={...c.movement,position:{x:-135,y:0,z:20}};
 const adapter={camForward:{x:0,y:-1,z:1},random:()=>.5,rangeInt:()=>0,project:()=>({x:.5,y:.5,z:1}),raycast:(...args)=>sourceRaidEnemyRaycast(host.boss,...args),rayOrigin:c=>({...c.movement.position,y:2}),movement:{correctDirection:v=>v,screenSpeedMultiplier:()=>1,pathClear:()=>true},rotateJoystick:v=>v,transformWorld:(c,id)=>{const bound=sourceHuntGunSockets(c.componentID,c.gun.gunNum);assert.ok([bound.shoot,...bound.shootRandom].includes(id));return {...c.movement.position,y:2};},beforeAttack:()=>{},sampleFidget:()=>({interval:2,offset:zero()})};
 const helperTokens=new Set();let shots=0,helperHits=0;for(let i=0;i<120;i++){cats.advanceFrame(.05,{...frame,presentation:false},adapter);for(const a of cats.drainEvents())if(a.componentID===136810){shots++;for(const t of a.tokens)helperTokens.add(`${t.slot}:${t.generation}`);}for(const e of host.advanceFrame(.05))if((e.event.kind==='direct-damage'||e.event.kind==='blast-damage')&&helperTokens.has(`${e.token.slot}:${e.token.generation}`))helperHits++;}
 assert.ok(shots>0);assert.ok(helperHits>0);assert.ok(host.score>0);assert.equal(b.session.equippedGuns.length,3);assert.ok(host.remainingSeconds<60);const before=shots;cats.dispose();cats.advanceFrame(.1,frame,adapter);assert.equal(cats.drainEvents().length,0);assert.ok(before>0);
});
