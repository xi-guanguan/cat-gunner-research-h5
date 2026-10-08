// Explicit model guns/muzzles/calendar; source-device parity NOT_RUN.
import test from 'node:test';import assert from 'node:assert/strict';
import {SourceRaidSessionBridge} from '../raid-session-bridge';
import {createSession,sourceGun,serializeSession,deserializeSession} from '../session';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {createActivityState} from '../source-activities';import {freshPlatformState} from '../local-platform';
import {createLocalMineTime} from '../mine-time';import {sourceRaidTickets,sourceRaidSeason,sourceRaidAutoSelect,sourceRaidWeakType,decodeSourceRaid} from '../r6-raid';
const date=new Date(2026,9,4,23,59,59),time=createLocalMineTime(()=>date);
function bundle(){const b={session:{...createSession(7),historicMax:390,equippedGuns:[{...sourceGun(30),uid:'a'},null,null],starGem:20},meta:freshSourceMetaState(),activities:createActivityState(undefined,'2026-10-04'),platform:freshPlatformState()};b.meta.raid=sourceRaidTickets(sourceRaidSeason(b.meta.raid,date),time);return b;}
function live(b=bundle(),id='bridge'){return {b,bridge:new SourceRaidSessionBridge(id,b,sourceRaidAutoSelect(b.session,sourceRaidWeakType(b.meta.raid.seasonIndex)))};}
const response=(r,status='success')=>({...r,status,provider:'local-test',onlineVerified:false});
function bar(host){const start={x:-145,y:Math.fround(4.55),z:20};host.emit({catID:1,gunNum:0,generation:{type:0,pelletCount:5,spreadDegrees:10,explosionRadius:5,missileExplosionRadius:7,blastSniperExplosionRadius:9,penetratingBulletLifetime:2},damage:1e20,start,nearHitPoint:{x:-120,y:Math.fround(4.55),z:20},targetTransform:{x:-120,y:0,z:20},camForward:{x:0,y:-1,z:1},spreadDegrees:0,missileSpeed:50,random:()=>.5});host.advanceFrame(.2);}
function end(host,n=2){for(let i=0;i<n;i++)bar(host);host.advanceFrame(61);host.advanceFrame(0);assert.equal(host.phase,'ended');}
test('unprepared never debits; one ready free Start increments both freeUse and season tries once',()=>{
 const {b,bridge}=live();assert.equal(bridge.startFree(b).status,'blocked');assert.equal(b.meta.raid.freeUseCount,0);assert.equal(bridge.host.phase,'prepared');assert.equal(bridge.beginProvider(b),null);
 bridge.prepared();const r=bridge.startFree(b);assert.equal(r.status,'applied');assert.equal(r.bundle.meta.raid.freeUseCount,1);assert.equal(r.bundle.meta.raid.tryCount,1);assert.equal(r.events.filter(e=>e.kind==='start').length,1);assert.equal(bridge.startFree(r.bundle).status,'blocked');assert.equal(b.meta.raid.freeUseCount,0);
});
test('real projectile completion atomically applies current wallet, season/type best and receipt; no duplicates',()=>{
 let {b,bridge}=live();bridge.prepared();b=bridge.startFree(b).bundle;bar(bridge.host);const mid=bridge.commit(b);assert.equal(mid.granted,0);assert.equal(mid.bundle.session.starGem,20);assert.equal(mid.events.filter(e=>e.kind==='bar-cleared').length,1);assert.equal(mid.bundle.meta.raidStarPig.gem,75);b=mid.bundle;
 end(bridge.host,1);b={...b,session:{...b.session,starGem:200},meta:{...b.meta,petCoin:777}};const r=bridge.commit(b);assert.equal(r.granted,50);assert.equal(r.bundle.session.starGem,250);assert.equal(r.bundle.meta.petCoin,777);assert.equal(r.bundle.meta.raid.bestLevel,2);assert.equal(r.bundle.meta.raid.bestByType[bridge.host.weakType],2);assert.deepEqual(r.bundle.meta.raid.settlementClaims,['bridge:result']);assert.equal(bridge.commit(r.bundle).granted,0);
 const restored={session:deserializeSession(serializeSession(r.bundle.session)),meta:decodeSourceMetaState(serializeSourceMetaState(r.bundle.meta))};assert.equal(restored.session.starGem,250);assert.deepEqual(restored.meta.raid.settlementClaims,['bridge:result']);
});
test('zero score still records one result; missing old ledger migrates empty with no gifted currency',()=>{
 let {b,bridge}=live();const old={...b.meta.raid};delete old.settlementClaims;assert.deepEqual(decodeSourceRaid(old).settlementClaims,[]);bridge.prepared();b=bridge.startFree(b).bundle;end(bridge.host,0);const r=bridge.commit(b);assert.equal(r.granted,0);assert.equal(r.bundle.session.starGem,20);assert.equal(r.bundle.meta.raid.settlementClaims.length,1);
 for(const claims of [[null],[''],['a','a']])assert.throws(()=>decodeSourceRaid({...old,settlementClaims:claims}));
});
test('provider identity failures/cancellation/unavailable are no-debit, retry identity is fresh, success once',()=>{
 for(const status of ['failure','cancelled','unavailable']){let {b,bridge}=live();b={...b,meta:{...b.meta,raid:{...b.meta.raid,freeUseCount:2}}};bridge=new SourceRaidSessionBridge('provider-'+status,b,sourceRaidAutoSelect(b.session,2));bridge.prepared();const ticket=bridge.beginProvider(b);assert.equal(ticket.entryType,2);assert.equal(bridge.beginProvider(b),null);const r=bridge.finishProvider(b,ticket,response(ticket,status));assert.equal(r.status,'blocked');assert.equal(r.bundle,b);assert.equal(bridge.host.phase,'prepared');assert.equal(b.meta.raid.adUsed,false);const retry=bridge.beginProvider(b);assert.notEqual(retry.id,ticket.id);const started=bridge.finishProvider(b,retry,response(retry));assert.equal(started.status,'applied');assert.equal(started.bundle.meta.raid.adUsed,true);assert.equal(started.bundle.meta.raid.tryCount,1);assert.equal(bridge.finishProvider(started.bundle,retry,response(retry)).status,'blocked');}
});
test('IAP follows exact source product; spoofed callbacks never consume; successful local callback only',()=>{
 let {b}=live();b.meta.raid={...b.meta.raid,freeUseCount:2,adUsed:true};const bridge=new SourceRaidSessionBridge('iap',b,sourceRaidAutoSelect(b.session,2));bridge.prepared();const req=bridge.beginProvider(b);assert.equal(req.purpose,'catgunner_raid_ticket');assert.equal(req.kind,'purchase');assert.equal(bridge.finishProvider(b,req,{...response(req),id:'foreign'}).status,'blocked');assert.equal(b.meta.raid.iapUsed,false);const retry=bridge.beginProvider(b),r=bridge.finishProvider(b,retry,response(retry));assert.equal(r.bundle.meta.raid.iapUsed,true);assert.equal(r.bundle.meta.raid.tryCount,1);assert.match(r.reason,/线上未连接/);
});
test('cancel/reset/stale identity/selection replacement never rewards or refunds the previous run',()=>{
 let {b,bridge}=live();bridge.prepared();b=bridge.startFree(b).bundle;bar(bridge.host);bridge.cancel();assert.equal(bridge.commit(b).status,'blocked');assert.equal(bridge.host.result,null);assert.equal(b.meta.raid.freeUseCount,1);assert.equal(b.session.starGem,20);
 ({b,bridge}=live());bridge.prepared();b=bridge.startFree(b).bundle;end(bridge.host);const reset=bundle();assert.equal(bridge.commit(reset).status,'blocked');assert.equal(reset.session.starGem,20);
 ({b,bridge}=live());bridge.prepared();const changed={...b,session:{...b.session,equippedGuns:[{...sourceGun(31),uid:'a'},null,null]}};assert.equal(bridge.startFree(changed).status,'blocked');assert.equal(bridge.host.phase,'prepared');
});
test('live calendar transition writes only current season best, keeps all-time records and original weak type',()=>{
 let b=bundle();b.meta.raid.bestByType[6]=8;const bridge=new SourceRaidSessionBridge('rollover',b,sourceRaidAutoSelect(b.session,2));const weak=bridge.host.weakType,oldSeason=b.meta.raid.seasonIndex;bridge.prepared();b=bridge.startFree(b).bundle;
 const monday=new Date(2026,9,5);const refresh=bridge.refreshClock(b,createLocalMineTime(()=>monday),monday);assert.equal(refresh.status,'applied');b=refresh.bundle;assert.notEqual(b.meta.raid.seasonIndex,oldSeason);assert.equal(b.meta.raid.tryCount,0);assert.equal(b.meta.raid.freeUseCount,0);assert.equal(bridge.host.weakType,weak);end(bridge.host,1);const r=bridge.commit(b);assert.equal(r.bundle.meta.raid.bestLevel,1);assert.equal(r.bundle.meta.raid.bestByType[6],8);assert.equal(r.granted,25);
});
test('pending provider after day rollover cannot debit new day; season rollover requires a newly prepared owner',()=>{
 let {b}=live();b.meta.raid.freeUseCount=2;let bridge=new SourceRaidSessionBridge('day',b,sourceRaidAutoSelect(b.session,2));bridge.prepared();const req=bridge.beginProvider(b);const nextDay=new Date(2026,9,5);const refreshed=bridge.refreshClock(b,createLocalMineTime(()=>nextDay),nextDay);assert.equal(refreshed.status,'blocked');assert.equal(bridge.finishProvider(b,req,response(req)).status,'blocked');assert.equal(b.meta.raid.adUsed,false);
});
test('wallet overflow keeps end event retryable; no partial best/receipt update',()=>{
 let {b,bridge}=live();bridge.prepared();b=bridge.startFree(b).bundle;end(bridge.host,1);const huge={...b,session:{...b.session,starGem:Number.MAX_SAFE_INTEGER}};assert.throws(()=>bridge.commit(huge));assert.equal(b.meta.raid.bestLevel,0);assert.equal(b.meta.raid.settlementClaims.length,0);const r=bridge.commit(b);assert.equal(r.granted,25);assert.equal(r.bundle.session.starGem,45);
});
test('bad selection/ordinary progress/other mode/daily exhaustion deny before runtime creation',()=>{
 const b=bundle(),s=sourceRaidAutoSelect(b.session,2);for(const selection of [[],[s[0],s[0],null]])assert.throws(()=>new SourceRaidSessionBridge('bad',b,selection));assert.throws(()=>new SourceRaidSessionBridge('bad',{...b,session:{...b.session,historicMax:389}},s));assert.throws(()=>new SourceRaidSessionBridge('bad',{...b,session:{...b.session,mode:'boss'}},s));b.meta.raid={...b.meta.raid,freeUseCount:2,adUsed:true,iapUsed:true};assert.throws(()=>new SourceRaidSessionBridge('bad',b,s));
});
