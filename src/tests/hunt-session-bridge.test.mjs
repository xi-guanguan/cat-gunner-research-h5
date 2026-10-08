import test from 'node:test';
import assert from 'node:assert/strict';
import {bindSourceHuntEquipment,sourceHuntCanonicalTransform,SOURCE_HUNT_RIG_NODE_OVERRIDES} from '../hunt-equipment-binding';
import {SourceHuntSessionBridge} from '../hunt-session-bridge';
import {createSession,sourceGun,serializeSession,deserializeSession} from '../session';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {createActivityState} from '../source-activities';
import {freshPlatformState} from '../local-platform';
import {sourceHuntMonsterRaycast} from '../hunt-cat-runtime';
import {sourceHuntGunSockets} from '../hunt-gun-sockets';
import {sourceCatScreenSpeedMultiplierH5,sourceCatCorrectDirectionH5} from '../source-cat-quaternion';
import {createLocalRewardProvider} from '../r6-reward-provider';
const stats={slot5d5d4d0Static20:100,slot5d5d4d8Static60:0};
const frame={joystick:{x:0,y:0},resourcesReady:true,simulate:true,acceptInput:true};
function bundle(ids=[20,null,null]){return {session:{...createSession(7),historicMax:110,equippedGuns:ids.map((id,i)=>id===null?null:{...sourceGun(id),uid:`gun-${i}`}),bossSlotLevels:[0,0,0]},meta:freshSourceMetaState(),activities:createActivityState(undefined,'2026-10-02'),platform:freshPlatformState()};}
function live(b=bundle(),id='test-live'){
 const bridge=new SourceHuntSessionBridge(id,b,stats),host=bridge.host;
 // MODEL ONLY: origin/socket viewport fixtures, analytic capsules and native spawn/flight.
 const adapter={aspect:390/844,random:()=>.5,rangeInt:(lo)=>lo,project:()=>({x:.5,y:.5,z:100}),raycast:(...a)=>sourceHuntMonsterRaycast(host.monsters,...a),
  movement:{screenSpeedMultiplier:sourceCatScreenSpeedMultiplierH5,correctDirection:sourceCatCorrectDirectionH5,pathClear:()=>true},rayOrigin:c=>({...c.movement.position,y:2}),
  beforeAttack:()=>{},transformWorld:c=>({...c.movement.position,y:2}),camForward:{x:-.54,y:-.64,z:.54}};
 host.enter();b=bridge.commit(b).bundle;return {bridge,host,adapter,get bundle(){return b;},commit(){const r=bridge.commit(b);b=r.bundle;return r;},step(dt=.05){host.advanceFrame(dt,frame,adapter);return this.commit();}};
}
test('source Cat_list compacts holes and star follows compact Cat SlotNum, NOT original equipped slot',()=>{
 const b=bundle([0,null,20]);b.session.bossSlotLevels=[2,5,9];const rows=bindSourceHuntEquipment(b.session);
 assert.deepEqual(rows.map(r=>[r.componentID,r.equipmentSlot,r.slotNum,r.gun.gunNum,r.gun.starLevel]),[[147400,0,0,0,2],[136809,2,1,20,5]]);
 assert.deepEqual(rows.map(r=>r.equipmentUID),['gun-0','gun-2']);
 b.session.equippedGuns=[sourceGun(20),sourceGun(0),null];assert.deepEqual(bindSourceHuntEquipment(b.session).map(r=>r.gun.starLevel),[2,5]);
 assert.throws(()=>bindSourceHuntEquipment({equippedGuns:[null,null,null],bossSlotLevels:[0,0,0]}));
 assert.throws(()=>bindSourceHuntEquipment({...b.session,bossSlotLevels:[0,0,21]}));
});
test('all original648 socket paths are explicit; differing AI hand rest pose retained as override',()=>{
 assert.equal(SOURCE_HUNT_RIG_NODE_OVERRIDES.length,4);
 for(const c of SOURCE_HUNT_RIG_NODE_OVERRIDES)for(let g=0;g<65;g++){
  const a=sourceHuntGunSockets(c.catComponentID,g),b=sourceHuntGunSockets(147400,g);
  assert.equal(sourceHuntCanonicalTransform(c.catComponentID,a.shoot),b.shoot);
  assert.deepEqual(a.shootRandom.map(t=>sourceHuntCanonicalTransform(c.catComponentID,t)),b.shootRandom);
 }
 assert.deepEqual(SOURCE_HUNT_RIG_NODE_OVERRIDES.find(c=>c.catComponentID===136809).differentCanonicalNodes,[47858]);
 assert.throws(()=>sourceHuntCanonicalTransform(136809,-1));assert.throws(()=>sourceHuntCanonicalTransform(7,49459));
});
test('bridge refuses progress lock, nonfield entry or already-open result; no save/resource injection',()=>{
 const b=bundle();for(const session of [{...b.session,historicMax:109},{...b.session,mode:'mine'}])assert.throws(()=>new SourceHuntSessionBridge('locked',{...b,session},stats));
 const x=live();assert.throws(()=>new SourceHuntSessionBridge('already-open',x.bundle,stats));assert.equal(x.bundle.meta.petCoin,0);
});
test('enter commits once; original spawn and real projectile kills pay immediately once, preserved on giveup/exit',()=>{
 const original=bundle([64,64,64]);original.meta.petCoin=13;const x=live(original);
 x.step(2);let clear=null,damages=0;
 for(let i=0;i<6000&&!clear;i++){const r=x.step();damages+=r.events.filter(e=>e.kind==='projectile'&&e.event.event.kind==='direct-damage').length;clear=r.events.find(e=>e.kind==='settlement'&&e.action==='level-clear');}
 assert.ok(clear,'natural source spawns/contacts must clear without kill fixture');assert.ok(damages>0);assert.equal(x.bundle.meta.hunt.level,1);assert.equal(x.bundle.meta.petCoin,43);
 const again=x.commit();assert.equal(again.granted,0);assert.equal(x.bundle.meta.petCoin,43);
 x.host.giveUp();x.commit();x.host.exit();x.commit();assert.equal(x.bundle.meta.petCoin,43);assert.equal(x.bundle.meta.hunt.run,null);
 assert.equal(new Set(x.bundle.meta.huntSettlementClaims).size,x.bundle.meta.huntSettlementClaims.length);
 assert.equal(x.bundle.session,original.session);assert.equal(x.bundle.activities,original.activities);assert.equal(x.bundle.platform,original.platform);
});
test('model natural invasion ends without rewards; ended run saved ONLY as progress, never a live pool',()=>{
 const x=live(bundle([0,null,null]));x.step(2);
 for(let i=0;i<3000&&x.host.phase!=='ended';i++)x.step();
 assert.equal(x.host.phase,'ended');assert.equal(x.bundle.meta.hunt.run.hp,0);assert.equal(x.bundle.meta.petCoin,0);
 const raw=serializeSourceMetaState(x.bundle.meta),restored=decodeSourceMetaState(raw);assert.equal(restored.hunt.run,null);assert.deepEqual(restored.huntSettlementClaims,x.bundle.meta.huntSettlementClaims);
 const session=deserializeSession(serializeSession(x.bundle.session));assert.equal(session.equippedGuns[0].uid,'gun-0');
});
test('old metadata without Hunt ledger migrates without gifts; malformed ledger rejected',()=>{
 const m=freshSourceMetaState(),old=serializeSourceMetaState(m),restored=decodeSourceMetaState(old);assert.equal(restored.petCoin,0);assert.deepEqual(restored.hunt,m.hunt);
 for(const receipts of [['dup','dup'],[7],'wrong'])assert.throws(()=>decodeSourceMetaState(JSON.stringify({...JSON.parse(old),huntSettlementClaims:receipts})));
});
test('reset/load/reused identity stops stale settlement; caller wallet/state untouched',()=>{
 const x=live();x.host.giveUp();const reset={...x.bundle,meta:{...freshSourceMetaState(),petCoin:777}};
 const rejected=x.bridge.commit(reset);assert.equal(rejected.status,'blocked');assert.equal(rejected.bundle,reset);assert.equal(reset.meta.petCoin,777);
 const b=bundle();b.meta.huntSettlementClaims=['reuse:1:enter'];const r=live(b,'reuse');assert.equal(r.bundle.meta.hunt.run,null);assert.equal(r.bundle.meta.petCoin,0);
});
test('local successful bonus uses copied host state identity, repeated callback never grants again',async()=>{
 const x=live(bundle([64,64,64]));x.step(2);for(let i=0;i<6000&&x.bundle.meta.hunt.level===0;i++)x.step();x.host.giveUp();x.commit();
 const ticket=x.bridge.beginBonus();assert.ok(ticket);assert.equal(x.bridge.beginBonus(),null);
 const provider=createLocalRewardProvider(true),response=await provider.execute(ticket.request);
 assert.equal(x.bridge.finishBonus(ticket,response).status,'applied');assert.equal(x.commit().granted,30);assert.equal(x.bundle.meta.petCoin,60);
 assert.equal(x.bridge.finishBonus(ticket,response).status,'blocked');assert.equal(x.commit().granted,0);assert.equal(x.bundle.meta.hunt.run,null);
});
test('failure/cancel/unavailable/identity mismatch retain result and do not grant; retries have fresh identity',async()=>{
 const x=live();x.host.giveUp();x.commit();const ids=[];
 for(const outcome of ['failure','cancelled','unavailable','mismatch']){
  const t=x.bridge.beginBonus();ids.push(t.request.id);const p=createLocalRewardProvider(outcome!=='unavailable',outcome==='cancelled'?'cancelled':outcome==='failure'?'failure':'success');
  const response=await p.execute(t.request);if(outcome==='mismatch')response.id='other';
  assert.equal(x.bridge.finishBonus(t,response).status,'blocked');assert.equal(x.commit().granted,0);assert.equal(x.host.phase,'ended');
 }
 assert.equal(new Set(ids).size,4);
});
test('bonus callbacks cancelled by exit/reset or copied ticket cannot cross ownership',async()=>{
 const x=live();x.host.giveUp();x.commit();const t=x.bridge.beginBonus(),r=await createLocalRewardProvider(true).execute(t.request);
 assert.equal(x.bridge.finishBonus({...t},r).status,'blocked');x.host.exit();x.commit();assert.equal(x.bridge.finishBonus(t,r).status,'blocked');assert.equal(x.bundle.meta.petCoin,0);
 const y=live(undefined,'cancel');y.host.giveUp();y.commit();const t2=y.bridge.beginBonus();y.bridge.cancel();assert.equal(y.bridge.finishBonus(t2,{...t2.request,status:'success',provider:'local-test',onlineVerified:false}).status,'blocked');
});
