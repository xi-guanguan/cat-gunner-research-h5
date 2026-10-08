// MODEL lifecycle + real host contacts, synthetic scene/clock/provider. No Cat
// movement/rig/render or source-device equivalence is asserted by these tests.
import test from 'node:test';import assert from 'node:assert/strict';
import {SourceRaidClientOwner,SOURCE_RAID_CLIENT_WAITS as waits} from '../raid-client-owner';
import {SourceRaidSessionBridge} from '../raid-session-bridge';
import {createSession,sourceGun,serializeSession,deserializeSession} from '../session';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {createActivityState} from '../source-activities';import {freshPlatformState} from '../local-platform';
import {createLocalMineTime} from '../mine-time';
import {sourceRaidTickets,sourceRaidSeason,sourceRaidAutoSelect,sourceRaidWeakType} from '../r6-raid';
const date=new Date(2026,9,3,12),time=createLocalMineTime(()=>date);
function bundle(){const b={session:{...createSession(7),historicMax:390,equippedGuns:[{...sourceGun(30),uid:'a'},null,null],starGem:20},meta:freshSourceMetaState(),activities:createActivityState(undefined,'2026-10-03'),platform:freshPlatformState()};b.meta.raid=sourceRaidTickets(sourceRaidSeason(b.meta.raid,date),time);return b;}
const response=(r,status='success')=>({...r,status,provider:'local-test',onlineVerified:false});
const frame={simulate:true,acceptInput:true,presentation:true,joystick:{x:0,y:0}};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
function emit(host){host.emit({catID:1,gunNum:0,generation:{type:0,pelletCount:5,spreadDegrees:10,explosionRadius:5,missileExplosionRadius:7,blastSniperExplosionRadius:9,penetratingBulletLifetime:2},damage:1e20,start:{x:-145,y:Math.fround(4.55),z:20},nearHitPoint:{x:-120,y:Math.fround(4.55),z:20},targetTransform:{x:-120,y:0,z:20},camForward:{x:0,y:-1,z:1},spreadDegrees:0,missileSpeed:50,random:()=>.5});}
function setup(options={}){
 let b=options.bundle??bundle(),current=true,writeFailure=false,consumeFailure=false,eventsFailure=false,renderFailure=false,presentationToggleFailure=false,catFailure=false;
 const writes=[],events=[],notices=[],requests=[],consumed=[],inputs=[],presentations=[];
 let destroyed=0,renders=0,cats=0;
 const scene={prepare:()=>options.prepare??Promise.resolve(),advanceCats(host,dt,input){cats++;if(catFailure)throw Error('bad Cat simulation');inputs.push(input);if(options.shoot)emit(host);},consume(e,f,dt){if(consumeFailure)throw Error('bad HUD');consumed.push({e,f,dt});},render(){if(renderFailure)throw Error('bad renderer');renders++;},setPresentationEnabled(on){if(presentationToggleFailure)throw Error('bad presentation toggle');presentations.push(on);},destroy(){destroyed++;}};
 const ports={read:()=>b,current:()=>current,write(next,reason){if(writeFailure)throw Error('quota');writes.push({next,reason});b=next;},scene:()=>scene,execute(r){requests.push(r);return options.execute?.(r)??Promise.resolve(response(r));},notice:t=>notices.push(t),events(e){if(eventsFailure)throw Error('bad event consumer');events.push(...e);}};
 const selection=sourceRaidAutoSelect(b.session,sourceRaidWeakType(b.meta.raid.seasonIndex));
 const owner=new SourceRaidClientOwner(options.id??'client',selection,ports);
 return {owner,writes,events,notices,requests,consumed,inputs,presentations,get b(){return b;},set b(value){b=value;},get destroyed(){return destroyed;},get cats(){return cats;},get renders(){return renders;},set current(value){current=value;},set writeFailure(value){writeFailure=value;},set consumeFailure(value){consumeFailure=value;},set eventsFailure(value){eventsFailure=value;},set renderFailure(value){renderFailure=value;},set presentationToggleFailure(value){presentationToggleFailure=value;},set catFailure(value){catFailure=value;}};
}
async function running(s){assert.equal(await s.owner.start(),true);s.owner.advance(2,frame);assert.equal(s.owner.phase,'playing');}
function finish(s){s.owner.advance(61,{...frame,presentation:false});s.owner.advance(0,{...frame,presentation:false});assert.equal(s.owner.phase,'ended');}
test('deferred bridge admits exactly once; source 2s wait separates debit and tryCount',()=>{
 let b=bundle();const bridge=new SourceRaidSessionBridge('deferred',b,sourceRaidAutoSelect(b.session,2));bridge.prepared();let r=bridge.startFree(b,true);assert.equal(r.status,'applied');b=r.bundle;
 assert.equal(b.meta.raid.freeUseCount,1);assert.equal(b.meta.raid.tryCount,0);assert.equal(bridge.host.phase,'prepared');assert.equal(r.events.length,0);
 assert.equal(bridge.startFree(b,true).status,'blocked');assert.equal(bridge.beginProvider(b),null);
 r=bridge.activate(b);assert.equal(r.bundle.meta.raid.tryCount,1);assert.equal(r.events.filter(e=>e.kind==='start').length,1);assert.equal(bridge.activate(r.bundle).status,'blocked');
});
test('owner readiness/debit/loading/Start have no premature Cats/clock/input and no overshoot spill',async()=>{
 const gate=deferred(),s=setup({prepare:gate.promise});const start=s.owner.start();s.owner.advance(90,frame);assert.equal(s.writes.length,0);assert.equal(s.cats,0);assert.equal(s.owner.host.remainingSeconds,60);assert.equal(await s.owner.start(),false);
 gate.resolve();assert.equal(await start,true);assert.equal(s.b.meta.raid.freeUseCount,1);assert.equal(s.b.meta.raid.tryCount,0);assert.equal(s.owner.host.phase,'prepared');assert.equal(s.owner.phase,'enter-loading');
 s.owner.advance(80,{...frame,simulate:false});assert.equal(s.owner.waitSeconds,2);assert.equal(s.cats,0);
 s.owner.advance(1.99,frame);assert.equal(s.owner.phase,'enter-loading');s.owner.advance(100,frame);assert.equal(s.owner.phase,'playing');assert.equal(s.owner.host.remainingSeconds,60);assert.equal(s.cats,0);assert.equal(s.b.meta.raid.tryCount,1);
 s.owner.advance(.1,frame);assert.equal(s.cats,1);assert.equal(s.owner.frameCount,1);assert.equal(s.owner.host.remainingSeconds,Math.fround(59.9));assert.deepEqual(s.writes.map(w=>w.reason),['admission','start']);
});
test('failed/late preparation and replaced save/selection leave every ticket and wallet untouched',async()=>{
 for(const variant of ['failure','cancel','foreign','gun']){const gate=deferred(),s=setup({prepare:gate.promise});const start=s.owner.start();
  if(variant==='failure')gate.reject(Error('missing source texture'));
  else {if(variant==='cancel')s.owner.cancel();if(variant==='foreign')s.current=false;if(variant==='gun')s.b={...s.b,session:{...s.b.session,equippedGuns:[{...sourceGun(31),uid:'a'},null,null]}};gate.resolve();}
  assert.equal(await start,false,variant);assert.equal(s.writes.length,0);assert.equal(s.requests.length,0);assert.equal(s.b.meta.raid.freeUseCount,0);assert.equal(s.b.meta.raid.tryCount,0);assert.equal(s.destroyed,1);
 }
});
test('pending local provider is after resources; success debits once but does not Start before wait',async()=>{
 const gate=deferred(),b=bundle();b.meta.raid.freeUseCount=2;const s=setup({bundle:b,execute:()=>gate.promise});const start=s.owner.start();await Promise.resolve();await Promise.resolve();
 assert.equal(s.owner.phase,'provider');assert.equal(s.requests.length,1);s.owner.advance(10,frame);assert.equal(s.cats,0);assert.equal(s.b.meta.raid.adUsed,false);
 gate.resolve(response(s.requests[0]));assert.equal(await start,true);assert.equal(s.b.meta.raid.adUsed,true);assert.equal(s.b.meta.raid.tryCount,0);assert.equal(s.b.meta.raid.entryClaims.length,1);
 assert.equal(await s.owner.start(),false);s.owner.advance(2,frame);assert.equal(s.b.meta.raid.tryCount,1);assert.equal(s.requests.length,1);
});
test('provider failure/cancel/unavailable/foreign callback/throw/stale context never debits or fabricates reward',async()=>{
 for(const status of ['failure','cancelled','unavailable','foreign','throw','stale']){
  const b=bundle();b.meta.raid.freeUseCount=2;let s;s=setup({bundle:b,execute:r=>{if(status==='throw')return Promise.reject(Error('offline'));if(status==='stale')s.current=false;return Promise.resolve(status==='foreign'?{...response(r),id:'foreign'}:response(r,status==='stale'?'success':status));}});
  assert.equal(await s.owner.start(),false,status);assert.equal(s.writes.length,0);assert.equal(s.b.meta.raid.adUsed,false);assert.equal(s.b.meta.raid.entryClaims.length,0);assert.equal(s.b.session.starGem,20);assert.equal(s.destroyed,1);
 }
});
test('late provider after explicit cancel/reset cannot mutate the new save',async()=>{
 const gate=deferred(),b=bundle();b.meta.raid.freeUseCount=2;const s=setup({bundle:b,execute:()=>gate.promise});const start=s.owner.start();await Promise.resolve();await Promise.resolve();s.owner.cancel();s.b=bundle();gate.resolve(response(s.requests[0]));assert.equal(await start,false);assert.equal(s.b.meta.raid.adUsed,false);assert.equal(s.writes.length,0);assert.equal(s.destroyed,1);
});
test('selection mutation after admission cancels activation without refund, Start or another provider call',async()=>{
 const s=setup();await s.owner.start();s.b={...s.b,session:{...s.b.session,equippedGuns:[null,null,null]}};s.owner.advance(2,frame);assert.equal(s.owner.closed,true);assert.equal(s.b.meta.raid.freeUseCount,1);assert.equal(s.b.meta.raid.tryCount,0);assert.equal(s.b.session.starGem,20);assert.equal(s.requests.length,0);
});
test('presentation off still computes contacts once; paused simulate stops Cats/timer, input policy is forwarded',async()=>{
 const s=setup({shoot:true});await running(s);const renders=s.renders;
 s.owner.advance(.2,{...frame,presentation:false,acceptInput:false,joystick:{x:1,y:0}});assert.equal(s.cats,1);assert.equal(s.renders,renders);assert.equal(s.owner.host.score,1);assert.equal(s.owner.hitCount,1);assert.equal(s.inputs[0].acceptInput,false);assert.equal(s.presentations.at(-1),false);
 const clock=s.owner.host.remainingSeconds;s.owner.advance(5,{...frame,simulate:false});assert.equal(s.owner.host.remainingSeconds,clock);assert.equal(s.cats,1);assert.equal(s.owner.frameCount,1);
});
test('real contact score -> CURRENT wallet/season best once, unrelated balances and serialize/reload preserved',async()=>{
 const s=setup();await running(s);emit(s.owner.host);s.owner.advance(.2,frame);assert.equal(s.owner.host.score,1);
 s.b={...s.b,session:{...s.b.session,starGem:200},meta:{...s.b.meta,petCoin:777}};finish(s);assert.equal(s.b.session.starGem,225);assert.equal(s.b.meta.petCoin,777);assert.equal(s.b.meta.raid.bestLevel,1);assert.deepEqual(s.b.meta.raid.settlementClaims,['client:result']);
 s.owner.advance(20,frame);assert.equal(s.writes.filter(w=>w.reason==='result').length,1);assert.equal(s.b.session.starGem,225);
 const restored={session:deserializeSession(serializeSession(s.b.session)),meta:decodeSourceMetaState(serializeSourceMetaState(s.b.meta))};assert.equal(restored.session.starGem,225);assert.deepEqual(restored.meta.raid.settlementClaims,['client:result']);
});
test('timer checks expiration on next resume, never awards on the subtracting frame',async()=>{
 const s=setup();await running(s);s.owner.advance(61,frame);assert.equal(s.owner.phase,'playing');assert.equal(s.owner.host.remainingSeconds,-1);assert.equal(s.writes.filter(w=>w.reason==='result').length,0);s.owner.advance(0,frame);assert.equal(s.owner.phase,'ended');assert.equal(s.writes.filter(w=>w.reason==='result').length,1);assert.equal(s.b.session.starGem,20);
});
test('unfinished exit never rewards/refunds; 1.5 + binary32 .2 waits restore once, calendar cannot dispose wait',async()=>{
 const s=setup();await running(s);emit(s.owner.host);s.owner.advance(.2,frame);assert.equal(s.owner.exit(),true);assert.equal(s.owner.exit(),false);assert.equal(s.owner.refreshClock(time,date),false);assert.equal(s.owner.phase,'exit-field-wait');assert.equal(s.b.session.starGem,20);assert.equal(s.b.meta.raid.freeUseCount,1);
 s.owner.advance(1.49,frame);assert.equal(s.owner.ownsField,true);s.owner.advance(99,frame);assert.equal(s.owner.restoredField,true);assert.equal(s.owner.phase,'exit-mask-wait');assert.equal(s.owner.closed,false);assert.equal(s.owner.waitSeconds,waits.exitMaskSeconds);assert.equal(s.owner.refreshClock(time,date),false);
 s.owner.advance(.1,frame);assert.equal(s.owner.closed,false);s.owner.advance(.1,frame);assert.equal(s.owner.closed,true);assert.equal(s.events.filter(e=>e.kind==='restore-field').length,1);assert.equal(s.destroyed,1);assert.equal(s.writes.filter(w=>w.reason==='result').length,0);
 s.owner.cancel();s.owner.advance(5,frame);assert.equal(s.destroyed,1);
});
test('ended exit preserves settled result and follows same separate waits',async()=>{
 const s=setup();await running(s);finish(s);assert.equal(s.owner.exit(),true);s.owner.advance(1.5,frame);assert.equal(s.owner.phase,'exit-mask-wait');s.owner.advance(waits.exitMaskSeconds,frame);assert.equal(s.owner.closed,true);assert.equal(s.writes.filter(w=>w.reason==='result').length,1);assert.equal(s.b.meta.raid.settlementClaims.length,1);
});
test('calendar no-op avoids disk write; running rollover keeps original boss weak type and writes current season',async()=>{
 const s=setup();await running(s);const weak=s.owner.host.weakType,season=s.b.meta.raid.seasonIndex,n=s.writes.length;
 assert.equal(s.owner.refreshClock(time,date),true);assert.equal(s.writes.length,n);
 const monday=new Date(2026,9,5);assert.equal(s.owner.refreshClock(createLocalMineTime(()=>monday),monday),true);assert.notEqual(s.b.meta.raid.seasonIndex,season);assert.equal(s.b.meta.raid.tryCount,0);assert.equal(s.owner.host.weakType,weak);assert.equal(s.writes.at(-1).reason,'clock');finish(s);assert.equal(s.b.meta.raid.tryCount,0);
});
test('pending provider across daily rollover invalidates old request, no new-day ad debit',async()=>{
 const gate=deferred(),b=bundle();b.meta.raid.freeUseCount=2;const s=setup({bundle:b,execute:()=>gate.promise});const start=s.owner.start();await Promise.resolve();await Promise.resolve();
 const tomorrow=new Date(2026,9,4);assert.equal(s.owner.refreshClock(createLocalMineTime(()=>tomorrow),tomorrow),true);assert.equal(s.b.meta.raid.freeUseCount,0);gate.resolve(response(s.requests[0]));assert.equal(await start,false);assert.equal(s.b.meta.raid.adUsed,false);assert.equal(s.writes.filter(w=>w.reason==='admission').length,0);
});
test('storage failure pauses debit/Start transaction for explicit retry, not another provider or try',async()=>{
 for(const when of ['admission','start']){
  const s=setup();if(when==='admission'){s.writeFailure=true;assert.equal(await s.owner.start(),false);assert.equal(s.b.meta.raid.freeUseCount,0);}else{await s.owner.start();s.writeFailure=true;s.owner.advance(2,frame);assert.equal(s.b.meta.raid.tryCount,0);}
  assert.match(s.owner.saveFailure,/quota/);s.owner.advance(20,frame);assert.equal(s.cats,0);assert.equal(s.owner.exit(),false);s.writeFailure=false;assert.equal(s.owner.retrySave(),true);assert.equal(s.owner.saveFailure,null);assert.equal(s.owner.retrySave(),false);
  if(when==='admission'){assert.equal(s.b.meta.raid.freeUseCount,1);assert.equal(s.owner.phase,'enter-loading');s.owner.advance(2,frame);}assert.equal(s.b.meta.raid.tryCount,1);assert.equal(s.owner.phase,'playing');assert.equal(s.writes.filter(w=>w.reason===when).length,1);
 }
});
test('failed result write retains valid settlement, merges unrelated CURRENT wallet on one retry',async()=>{
 const s=setup();await running(s);emit(s.owner.host);s.owner.advance(.2,frame);s.writeFailure=true;s.owner.advance(61,frame);s.owner.advance(0,frame);assert.equal(s.owner.host.phase,'ended');assert.equal(s.b.session.starGem,20);assert.equal(s.b.meta.raid.settlementClaims.length,0);assert.match(s.owner.saveFailure,/quota/);
 s.b={...s.b,session:{...s.b.session,starGem:200},meta:{...s.b.meta,petCoin:888}};assert.equal(s.owner.retrySave(),false);s.writeFailure=false;assert.equal(s.owner.retrySave(),true);assert.equal(s.owner.phase,'ended');assert.equal(s.b.session.starGem,225);assert.equal(s.b.meta.petCoin,888);assert.deepEqual(s.b.meta.raid.settlementClaims,['client:result']);assert.equal(s.owner.retrySave(),false);assert.equal(s.writes.filter(w=>w.reason==='result').length,1);
});
test('pending save identity/date replacement cannot overwrite fresh state',async()=>{
 for(const kind of ['context','raid','gun']){const s=setup();s.writeFailure=true;await s.owner.start();s.writeFailure=false;
  if(kind==='context'){s.current=false;s.b=bundle();}else if(kind==='raid')s.b={...s.b,meta:{...s.b.meta,raid:{...s.b.meta.raid,freeUseCount:1}}};else s.b={...s.b,session:{...s.b.session,equippedGuns:[null,null,null]}};
  assert.equal(s.owner.retrySave(),false,kind);assert.equal(s.owner.closed,true);assert.equal(s.writes.length,0);
 }
});
test('presentation/event consumer throws cannot roll back a successful provider/debit/result or re-grant',async()=>{
 const s=setup();s.consumeFailure=true;s.eventsFailure=true;assert.equal(await s.owner.start(),true);assert.equal(s.b.meta.raid.freeUseCount,1);assert.match(s.owner.presentationFailure,/bad HUD/);s.owner.advance(2,frame);assert.equal(s.b.meta.raid.tryCount,1);finish(s);assert.equal(s.writes.filter(w=>w.reason==='result').length,1);assert.equal(s.b.meta.raid.settlementClaims.length,1);assert.equal(s.owner.closed,false);assert.match(s.notices.join('\n'),/不回滚|保留/);
});
test('render failure occurs after authoritative advancement and never advances a second timer',async()=>{
 const s=setup();await running(s);s.renderFailure=true;s.owner.advance(.1,frame);assert.equal(s.owner.frameCount,1);assert.equal(s.owner.host.remainingSeconds,Math.fround(59.9));assert.match(s.owner.presentationFailure,/renderer/);s.owner.advance(.1,frame);assert.equal(s.owner.frameCount,2);assert.equal(s.cats,2);
});
test('invalid frame deltas reject before simulation, counts and source waits remain unchanged',async()=>{
 const s=setup();await s.owner.start();for(const dt of [-1,NaN,Infinity,Number.MAX_VALUE])assert.throws(()=>s.owner.advance(dt,frame));assert.equal(s.owner.waitSeconds,2);assert.equal(s.cats,0);assert.equal(s.owner.frameCount,0);
});

test('presentation toggle failure never stops the authoritative clock or settlement',async()=>{
 const s=setup();s.presentationToggleFailure=true;await running(s);assert.match(s.owner.presentationFailure,/presentation toggle/);
 s.owner.advance(.1,frame);assert.equal(s.owner.frameCount,1);assert.equal(s.owner.host.remainingSeconds,Math.fround(59.9));assert.equal(s.renders,0);
 finish(s);assert.equal(s.writes.filter(w=>w.reason==='result').length,1);assert.equal(s.b.meta.raid.tryCount,1);
});
test('Cat failure freezes battle without refund or fake result; explicit source exit waits still restore field',async()=>{
 const s=setup();await running(s);s.catFailure=true;s.owner.advance(.1,frame);
 assert.match(s.owner.simulationFailure,/Cat simulation/);assert.equal(s.owner.phase,'playing');assert.equal(s.owner.host.remainingSeconds,60);
 assert.equal(s.owner.frameCount,0);assert.equal(s.cats,1);s.owner.advance(100,frame);assert.equal(s.cats,1);
 assert.equal(s.b.meta.raid.freeUseCount,1);assert.equal(s.b.meta.raid.tryCount,1);assert.equal(s.writes.filter(w=>w.reason==='result').length,0);
 assert.equal(s.b.meta.raid.settlementClaims.length,0);assert.equal(s.b.session.starGem,20);assert.equal(await s.owner.start(),false);
 assert.equal(s.owner.exit(),true);assert.equal(s.owner.exit(),false);s.owner.advance(99,{...frame,simulate:false});assert.equal(s.owner.waitSeconds,1.5);
 s.owner.advance(1.5,frame);assert.equal(s.owner.restoredField,true);assert.equal(s.owner.phase,'exit-mask-wait');s.owner.advance(waits.exitMaskSeconds,frame);
 assert.equal(s.owner.closed,true);assert.equal(s.destroyed,1);assert.equal(s.events.filter(e=>e.kind==='restore-field').length,1);
 assert.equal(s.writes.filter(w=>w.reason==='admission').length,1);assert.equal(s.writes.filter(w=>w.reason==='start').length,1);assert.equal(s.requests.length,0);
});
test('host advancement exception also freezes simulation and leaves explicit exit available',async()=>{
 const s=setup();await running(s);s.owner.host.advanceFrame=()=>{throw Error('bad projectile simulation');};
 s.owner.advance(.1,frame);assert.match(s.owner.simulationFailure,/projectile simulation/);s.owner.advance(100,frame);assert.equal(s.cats,1);
 assert.equal(s.writes.filter(w=>w.reason==='result').length,0);assert.equal(s.owner.exit(),true);s.owner.advance(1.5,frame);s.owner.advance(waits.exitMaskSeconds,frame);assert.equal(s.owner.closed,true);
});

test('pig actual Start fill is saved once; failed Start write retries the same +50 without duplicate Start',async()=>{
 const s=setup();await s.owner.start();assert.equal(s.b.meta.raidStarPig.gem,0);s.writeFailure=true;s.owner.advance(2,frame);assert.equal(s.b.meta.raidStarPig.gem,0);assert.match(s.owner.saveFailure,/quota/);s.writeFailure=false;
 assert.equal(s.owner.retrySave(),true);assert.equal(s.b.meta.raidStarPig.gem,50);assert.equal(s.b.meta.raid.tryCount,1);assert.equal(s.owner.retrySave(),false);assert.equal(s.events.filter(e=>e.kind==='battle'&&e.event.kind==='start').length,1);
});
test('pig per-bar failure stops simulation; retry persists +25 once, exit/reload keeps unfinished accumulation',async()=>{
 const s=setup();await running(s);emit(s.owner.host);s.writeFailure=true;s.owner.advance(.2,frame);assert.match(s.owner.saveFailure,/quota/);assert.equal(s.b.meta.raidStarPig.gem,50);const count=s.owner.frameCount;s.owner.advance(5,frame);assert.equal(s.owner.frameCount,count);assert.equal(s.owner.exit(),false);
 s.b={...s.b,session:{...s.b.session,starGem:300},meta:{...s.b.meta,petCoin:555}};s.writeFailure=false;assert.equal(s.owner.retrySave(),true);assert.equal(s.b.meta.raidStarPig.gem,75);assert.equal(s.b.session.starGem,300);assert.equal(s.b.meta.petCoin,555);assert.equal(s.writes.filter(w=>w.reason==='progress').length,1);assert.equal(s.owner.retrySave(),false);
 assert.equal(s.owner.exit(),true);s.owner.advance(1.5,frame);s.owner.advance(waits.exitMaskSeconds,frame);assert.equal(s.owner.closed,true);const restored=decodeSourceMetaState(serializeSourceMetaState(s.b.meta));assert.equal(restored.raidStarPig.gem,75);assert.equal(restored.raid.settlementClaims.length,0);
});
test('pig pending write cannot overwrite changed pig context even with unchanged Raid state',async()=>{
 const s=setup();await running(s);emit(s.owner.host);s.writeFailure=true;s.owner.advance(.2,frame);s.b={...s.b,meta:{...s.b.meta,raidStarPig:{...s.b.meta.raidStarPig,purchaseCount:1}}};s.writeFailure=false;assert.equal(s.owner.retrySave(),false);assert.equal(s.owner.closed,true);assert.equal(s.b.meta.raidStarPig.purchaseCount,1);assert.equal(s.b.meta.raidStarPig.gem,50);
});


test('real contacts/end persist bestLevel mission eligibility without auto-claiming rewards',async()=>{
 const s=setup({shoot:true});await running(s);assert.equal(s.b.meta.raid.tryCount,1);assert(s.b.meta.raidMission.clear[0]);assert.equal(s.b.session.starGem,20);
 s.owner.advance(.2,frame);assert(s.owner.hitCount>0);finish(s);
 assert(s.b.meta.raid.bestLevel>=1);assert(s.b.meta.raidMission.clear[3]);assert(s.b.meta.raidMission.rewardGet.every(v=>!v));
 assert.equal(s.b.session.starGem,20+s.owner.host.result.starGem);assert.equal(s.b.meta.raid.settlementClaims.length,1);
 s.owner.advance(100,frame);assert.equal(s.b.meta.raid.settlementClaims.length,1);
});
for(const change of ['mission-claim','mission-ticket','new-week'])test('pending Raid result cannot overwrite '+change,async()=>{
 const s=setup({shoot:true});await running(s);s.owner.advance(.2,frame);s.writeFailure=true;s.owner.advance(61,frame);s.owner.advance(0,frame);assert.match(s.owner.saveFailure,/quota/);
 if(change==='new-week')s.b={...s.b,meta:{...s.b.meta,raid:{...s.b.meta.raid,seasonIndex:s.b.meta.raid.seasonIndex+1}}};
 else s.b={...s.b,meta:{...s.b.meta,raidMission:{...s.b.meta.raidMission,...(change==='mission-ticket'?{ticketPurchased:true}:{rewardGet:[true,...Array(7).fill(false)]})}}};
 const before=serializeSourceMetaState(s.b.meta),balance=s.b.session.starGem;s.writeFailure=false;assert.equal(s.owner.retrySave(),false);assert(s.owner.closed);assert.equal(serializeSourceMetaState(s.b.meta),before);assert.equal(s.b.session.starGem,balance);
});
test('clock writes mission-only normalization even when Raid/pig are unchanged',async()=>{
 const b=bundle();b.meta.raid.tryCount=1;b.meta.raidMission.seasonIndex=b.meta.raid.seasonIndex;
 const s=setup({bundle:b});assert(!s.b.meta.raidMission.clear[0]);assert(s.owner.refreshClock(time,date));assert(s.b.meta.raidMission.clear[0]);assert.equal(s.writes.at(-1).reason,'clock');
});
