import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceHuntClientOwner} from '../hunt-client-owner';
import {createSession,sourceGun} from '../session';
import {freshSourceMetaState} from '../source-meta-runtime';
import {createActivityState} from '../source-activities';
import {freshPlatformState} from '../local-platform';
import {sourceHuntMonsterRaycast} from '../hunt-cat-runtime';
import {sourceCatScreenSpeedMultiplierH5,sourceCatCorrectDirectionH5} from '../source-cat-quaternion';
import {createLocalRewardProvider} from '../r6-reward-provider';
const frame={simulate:true,acceptInput:true,presentation:true,joystick:{x:0,y:0}};
const encode=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?`${x}n`:x);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(ids=[64,64,64]){
 return {session:{...createSession(7),historicMax:110,equippedGuns:ids.map((id,i)=>id===null?null:{...sourceGun(id),uid:`client-${i}`})},meta:freshSourceMetaState(),activities:createActivityState(),platform:freshPlatformState()};
}
function client({initial=fixture(),prepare=Promise.resolve(),id='client'}={}){
 let b=initial,current=true,writes=0,destroys=0,renders=0,presentation=true,notices=[],events=[],consumes=0;
 const owner=new SourceHuntClientOwner(id,{
  read:()=>b,current:()=>current,write:next=>{b=next;writes++;},random:()=>.5,notice:n=>notices.push(n),events:e=>events.push(...e),
  scene:host=>({prepare:()=>prepare,adapter:()=>({aspect:390/844,random:()=>.5,rangeInt:lo=>lo,project:()=>({x:.5,y:.5,z:100}),raycast:(...a)=>sourceHuntMonsterRaycast(host.monsters,...a),movement:{screenSpeedMultiplier:sourceCatScreenSpeedMultiplierH5,correctDirection:sourceCatCorrectDirectionH5,pathClear:()=>true},rayOrigin:c=>({...c.movement.position,y:2}),beforeAttack:()=>{},transformWorld:c=>({...c.movement.position,y:2}),camForward:{x:-.54,y:-.64,z:.54}}),consume:()=>consumes++,render:()=>renders++,setPresentationEnabled:enabled=>{presentation=enabled;},destroy:()=>destroys++})
 });
 return {owner,get b(){return b;},set b(v){b=v;},get writes(){return writes;},get renders(){return renders;},get destroys(){return destroys;},get presentation(){return presentation;},notices,events,invalidate(){current=false;},step:(dt=.05,f=frame)=>owner.advance(dt,f)};
}
test('preparation owns field without changing run/wallet, source 2s wait starts only after ready',async()=>{
 const load=deferred(),x=client({prepare:load.promise}),before=encode(x.b),start=x.owner.start();
 assert.equal(x.owner.phase,'preparing');assert.equal(x.owner.ownsField,true);x.step(10);assert.equal(x.writes,0);assert.equal(encode(x.b),before);
 load.resolve();assert.equal(await start,true);assert.equal(x.owner.phase,'enter-loading');assert.equal(x.writes,1);assert.equal([...x.owner.host.monsters.activeMonsters()].length,0);
 x.step(1.99);assert.equal(x.owner.phase,'enter-loading');x.step(.02);assert.equal(x.owner.phase,'playing');assert.equal(await x.owner.start(),false);
});
test('failed resources restore ownership without creating receipt, save or reward',async()=>{
 const load=deferred(),x=client({prepare:load.promise}),before=encode(x.b),start=x.owner.start();load.reject(Error('fixture missing texture'));
 assert.equal(await start,false);assert.equal(x.owner.closed,true);assert.equal(x.owner.ownsField,false);assert.equal(x.writes,0);assert.equal(encode(x.b),before);assert.equal(x.destroys,1);assert.match(x.notices[0],/准备失败/);
});
test('preparation cancelled by reset or save context replacement cannot enter identical fresh save',async()=>{
 for(const action of ['cancel','context']){const load=deferred(),x=client({prepare:load.promise}),start=x.owner.start();x.b=fixture();if(action==='cancel')x.owner.cancel();else x.invalidate();load.resolve();assert.equal(await start,false);assert.equal(x.writes,0);assert.equal(x.b.meta.hunt.run,null);assert.equal(x.destroys,1);}
});
test('source restore-field at 1.5s transfers clock once; final mask .2s never holds field again',async()=>{
 const x=client();await x.owner.start();x.step(2);assert.equal(x.owner.giveUp(),true);assert.equal(x.owner.phase,'ended');assert.equal(x.owner.ownsField,true);assert.equal(x.owner.exit(),true);
 x.step(1.49);assert.equal(x.owner.ownsField,true);x.step(.02);assert.equal(x.owner.phase,'exit-mask-wait');assert.equal(x.owner.ownsField,false);assert.equal(x.events.filter(e=>e.kind==='restore-field').length,1);
 x.step(.21);assert.equal(x.owner.closed,true);assert.equal(x.events.filter(e=>e.kind==='restore-field').length,1);assert.equal(x.destroys,1);x.owner.cancel();assert.equal(x.destroys,1);
});
test('paused client has no catch-up advance; eco performs host simulation without render',async()=>{
 const x=client();await x.owner.start();x.step(2);const before=x.owner.host.elapsedSeconds,count=x.owner.frameCount;
 x.step(100,{...frame,simulate:false,presentation:false});assert.equal(x.owner.host.elapsedSeconds,before);assert.equal(x.owner.frameCount,count);
 const renderCount=x.renders;x.step(.1,{...frame,presentation:false});assert.equal(x.renders,renderCount);assert.equal(x.presentation,false);assert.ok(x.owner.host.elapsedSeconds>before);
 x.step(.05);assert.equal(x.presentation,true);assert.equal(x.renders,renderCount+1);
});
test('MODEL ONLY: real spawn/projectile clear -> result -> bonus -> restore; unrelated current wallet preserved',async()=>{
 const x=client();await x.owner.start();x.step(2);
 for(let i=0;i<6000&&x.b.meta.hunt.level===0;i++)x.step();assert.equal(x.b.meta.hunt.level,1);assert.equal(x.b.meta.petCoin,30);assert.ok(x.events.some(e=>e.kind==='attack'));assert.ok(x.events.some(e=>e.kind==='projectile'&&e.event.event.kind==='direct-damage'));
 x.b={...x.b,session:{...x.b.session,diamonds:12345}};
 assert.equal(x.owner.giveUp(),true);const grant=x.owner.bonus(r=>createLocalRewardProvider(true).execute(r));assert.equal(x.owner.pendingBonus,true);assert.equal(await grant,true);
 assert.equal(x.b.meta.petCoin,60);assert.equal(x.b.session.diamonds,12345);assert.equal(x.owner.phase,'exit-field-wait');assert.equal(x.b.meta.hunt.run,null);
 assert.equal(await x.owner.bonus(r=>createLocalRewardProvider(true).execute(r)),false);assert.equal(x.b.meta.petCoin,60);
});
test('provider failure, cancellation, unavailability and thrown failure leave result and permit fresh retry',async()=>{
 const x=client();await x.owner.start();x.owner.giveUp();
 for(const outcome of ['failure','cancelled','unavailable','throw']){
  const before=x.b.meta.petCoin;
  assert.equal(await x.owner.bonus(r=>outcome==='throw'?Promise.reject(Error('offline')):createLocalRewardProvider(outcome!=='unavailable',outcome==='unavailable'?'success':outcome).execute(r)),false);
  assert.equal(x.owner.pendingBonus,false);assert.equal(x.b.meta.petCoin,before);assert.equal(x.owner.phase,'ended');
 }
 assert.equal(await x.owner.bonus(r=>createLocalRewardProvider(true).execute(r)),true);
});
test('delayed provider after exit/reset/identical context replacement never grants current save',async()=>{
 for(const action of ['exit','reset','context']){
  const x=client(),wait=deferred();await x.owner.start();x.owner.giveUp();let request;const bonus=x.owner.bonus(r=>{request=r;return wait.promise;});
  if(action==='exit')x.owner.exit();else {x.b=fixture();if(action==='reset')x.owner.cancel();else x.invalidate();}
  const before=encode(x.b);wait.resolve({...request,status:'success',provider:'local-test',onlineVerified:false});assert.equal(await bonus,false);assert.equal(encode(x.b),before);
 }
});
test('ordinary historicMax109 gate and existing result reject before scene allocation',()=>{
 const b=fixture();b.session.historicMax=109;assert.throws(()=>client({initial:b}),/第12大关/);
 const x=client();x.owner.host.enter();const r=x.owner.bridge.commit(x.b);assert.throws(()=>client({initial:r.bundle}),/上次狩猎/);x.owner.cancel();
});
