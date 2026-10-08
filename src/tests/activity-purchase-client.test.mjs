// MODEL/INTERFACE only. Explicit local-test provider; no GUI, natural Storage, device or payment proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceActivityPurchaseClient,sourceActivityPurchaseGate} from '../activity-purchase-client';
import {sourceActivityPurchasePrice} from '../source-activity-purchase-projection';
import {createSession,sourceGun,sourceGunID,GUN_INVENTORY_CAPACITY,serializeSession,deserializeSession} from '../session';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {createActivityState} from '../source-activities';
import {freshPlatformState,decodePlatformState} from '../local-platform';
import {SOURCE_WEEKLY,SOURCE_PLUS_DURATION_MS,sourceWeekIndex,sourceWeeklyGun,sourceWeeklyRefresh,freshSourceWeekly,freshSourcePlus} from '../r6-weekly';
import {SOURCE_STEPUP,SOURCE_STEPUP_DURATION_MS,freshSourceStepUp} from '../r6-stepup';
const NOW=new Date(2026,9,6,12).getTime();
const resp=(q,status='success')=>({...q,status,provider:'local-test',onlineVerified:false});
const deferred=()=>{let resolve,reject;return {promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve,reject};};
function fixture(opts={}){
 const c={ctx:'A',now:NOW,fail:false,writes:0,attempts:0,requests:[],notes:[],shown:[],encoded:null,b:{session:createSession(),activities:createActivityState(),platform:freshPlatformState(),meta:freshSourceMetaState()}};
 c.b.session={...c.b.session,historicMax:190,catalogSeen:[20],weeklyShop:freshSourceWeekly(),plusPack:freshSourcePlus(),stepUp:{...freshSourceStepUp(),startedUTC:NOW}};
 c.owner=new SourceActivityPurchaseClient({
  read:()=>({bundle:c.b,contextID:c.ctx}),clock:()=>c.now,requestID:()=>opts.id??`Q${c.requests.length}`,
  execute:async q=>{c.requests.push(q);return opts.execute?opts.execute(q):resp(q,opts.status);},
  write:b=>{
   c.attempts++;if(c.fail)throw Error('quota');
   // Same codecs as main's writer; prove no publication precedes a complete candidate serialization.
   const envelope=JSON.parse(serializeSession(b.session));envelope.meta=JSON.parse(serializeSourceMetaState(b.meta));envelope.platform=b.platform;envelope.activities=b.activities;
   opts.beforeWrite?.(b,c);c.encoded=JSON.stringify(envelope);c.writes++;c.b=b;
  },notice:n=>c.notes.push(n),granted:gun=>{c.shown.push(gun);if(opts.presentationThrow)throw Error('renderer');}
 });return c;
}
function fullInventory(c){c.b={...c.b,session:{...c.b.session,gunInventory:Array.from({length:GUN_INVENTORY_CAPACITY},(_,i)=>({...sourceGun(0),uid:`full:${i}`}))}};}
function reload(c){const envelope=JSON.parse(c.encoded);c.b={...c.b,session:deserializeSession(c.encoded),meta:decodeSourceMetaState(JSON.stringify(envelope.meta)),platform:decodePlatformState(JSON.stringify(envelope.platform))};c.owner.invalidate();}
for(const family of ['weekly','plus','stepup']){
 test(`${family} save-before-publish and codec/reload receipt`,async()=>{
  let before;const c=fixture({beforeWrite:(candidate,c)=>{assert.equal(c.b,before);assert.equal(c.shown.length,0);assert(candidate.platform.claims.includes('Q0'));}});before=c.b;
  assert(await c.owner.request(family,0));assert.equal(c.writes,1);assert.equal(c.b.platform.sequence,1);assert.deepEqual(c.b.platform.audit[0],{id:'Q0',kind:'purchase',amount:0,at:new Date(NOW).toISOString()});
  if(family==='weekly'){assert.equal(c.b.meta.petCoin,SOURCE_WEEKLY.petCoinRewards[0]);assert.equal(sourceGunID(c.b.session.gunInventory.at(-1)),sourceWeeklyGun(0,new Date(NOW)));}
  if(family==='plus'){assert(c.b.meta.entitlements.plusPack0Active);assert.equal(c.b.session.plusPack.purchasedUTC[0],NOW);assert.equal(c.shown[0],undefined);}
  if(family==='stepup'){assert(c.b.session.stepUp.purchased[0]);assert.equal(sourceGunID(c.b.session.gunInventory.at(-1)),SOURCE_STEPUP.gunRewards[0]);}
  const beforeReload=c.b;reload(c);assert.deepEqual(c.b.session.weeklyShop,beforeReload.session.weeklyShop);assert.deepEqual(c.b.session.plusPack,beforeReload.session.plusPack);assert.deepEqual(c.b.session.stepUp,beforeReload.session.stepUp);assert.equal(c.b.meta.petCoin,beforeReload.meta.petCoin);assert.deepEqual(c.b.platform,beforeReload.platform);assert(!c.owner.retrySave(family,0));
 });
 for(const status of ['failure','cancelled','unavailable'])test(`${family} provider ${status}: no wallet/rights/receipt`,async()=>{const c=fixture({status}),before=c.b;assert(!await c.owner.request(family,0));assert.equal(c.b,before);assert.equal(c.writes,0);assert.equal(c.owner.pending,null);assert(!c.owner.saveFailed);});
 for(const patch of [{id:'wrong'},{purpose:'wrong'},{kind:'ad'},{provider:'online'},{onlineVerified:true}])test(`${family} rejects mismatched ${Object.keys(patch)[0]}`,async()=>{const c=fixture({execute:q=>({...resp(q),...patch})}),before=c.b;assert(!await c.owner.request(family,0));assert.equal(c.b,before);assert.equal(c.writes,0);assert.equal(c.owner.pending,null);});
 test(`${family} provider exception releases busy with no grant`,async()=>{const c=fixture({execute:()=>{throw Error('provider');}}),before=c.b;assert(!await c.owner.request(family,0));assert.equal(c.b,before);assert.equal(c.writes,0);assert.equal(c.owner.pending,null);});
 test(`${family} failed-save retries original receipt on current wallet, not a new transaction`,async()=>{
  const c=fixture(),before=c.b;c.fail=true;assert(!await c.owner.request(family,0));assert.equal(c.b,before);assert(c.owner.saveFailed);assert.equal(c.shown.length,0);const pending=c.owner.pending;
  assert(!c.owner.retrySave(family,1));assert(!c.owner.retrySave(family==='weekly'?'plus':'weekly',0));assert(!await c.owner.request(family,1));assert(!c.owner.retrySave(family,0));assert.equal(c.owner.pending,pending);
  c.b={...c.b,session:{...c.b.session,diamonds:99},meta:{...c.b.meta,petCoin:12,entitlements:{...c.b.meta.entitlements,minePack:true}},platform:{...c.b.platform,sequence:2,claims:['other'],audit:[{id:'other',kind:'resource',amount:99,at:new Date(NOW).toISOString()}]}};
  c.fail=false;assert(!c.owner.retrySave(family,1));assert(!c.owner.retrySave(family==='weekly'?'plus':'weekly',0));assert.equal(c.writes,0);assert.equal(c.owner.pending,pending);assert(c.owner.retrySave(family,0));assert.equal(c.b.session.diamonds,99);assert.equal(c.b.meta.petCoin,12+(family==='weekly'?300:0));assert(c.b.meta.entitlements.minePack);assert.deepEqual(c.b.platform.claims,['other','Q0']);assert.equal(c.b.platform.sequence,3);assert.equal(c.requests.length,1);assert.equal(c.writes,1);assert.equal(c.shown.length,1);assert(!c.owner.retrySave(family,0));
 });
 test(`${family} panel close does not cancel manager-owned receipt; double request blocked`,async()=>{const d=deferred(),c=fixture({execute:()=>d.promise});const p=c.owner.request(family,0);assert(c.owner.pending);assert(!await c.owner.request(family,0));assert.equal(c.requests.length,1);/* no view/scope in owner: closing panel leaves it alive */d.resolve(resp(c.requests[0]));assert(await p);assert.equal(c.writes,1);});
 for(const stage of ['pending','save-failed'])test(`${family} changed context rejects ${stage} receipt`,async()=>{
  const d=deferred(),c=fixture({execute:()=>d.promise}),p=c.owner.request(family,0);if(stage==='save-failed'){c.fail=true;d.resolve(resp(c.requests[0]));assert(!await p);assert(c.owner.saveFailed);}
  c.ctx='B';c.fail=false;if(stage==='pending'){d.resolve(resp(c.requests[0]));assert(!await p);}else assert(!c.owner.retrySave(family,0));assert.equal(c.writes,0);assert.equal(c.owner.pending,null);
 });
 test(`${family} duplicate platform receipt during callback is harmless`,async()=>{const d=deferred(),c=fixture({execute:()=>d.promise}),p=c.owner.request(family,0);c.b={...c.b,platform:{...c.b.platform,claims:['Q0']}};const before=c.b;d.resolve(resp(c.requests[0]));assert(!await p);assert.equal(c.b,before);assert.equal(c.writes,0);});
 test(`${family} presentation exception cannot retract persisted receipt`,async()=>{const c=fixture({presentationThrow:true});assert(await c.owner.request(family,0));assert.equal(c.writes,1);assert(c.b.platform.claims.includes('Q0'));assert.equal(c.owner.pending,null);assert(!c.owner.retrySave(family,0));});
}
test('weekly callback crosses local Monday and awards current-week gun/count, not admission week',async()=>{
 const d=deferred(),c=fixture({execute:()=>d.promise});c.now=new Date(2026,9,11,23,59,59).getTime();c.b={...c.b,session:sourceWeeklyRefresh(c.b.session,new Date(c.now))};const oldWeek=c.b.session.weeklyShop.weekKey;
 const p=c.owner.request('weekly',2);c.now+=2000;d.resolve(resp(c.requests[0]));assert(await p);assert.notEqual(c.b.session.weeklyShop.weekKey,oldWeek);assert.equal(c.b.session.weeklyShop.weekKey,sourceWeekIndex(new Date(c.now)));assert.equal(sourceGunID(c.b.session.gunInventory.at(-1)),sourceWeeklyGun(2,new Date(c.now)));assert.deepEqual(c.b.session.weeklyShop.purchaseCounts,[0,0,1]);
});
test('weekly failed-save retry crossing week reevaluates fulfillment time and preserves current counts',async()=>{
 const c=fixture();c.now=new Date(2026,9,11,23,59).getTime();c.fail=true;assert(!await c.owner.request('weekly',1));c.now+=120000;
 c.b={...c.b,session:sourceWeeklyRefresh(c.b.session,new Date(c.now))};c.b={...c.b,session:{...c.b.session,weeklyShop:{...c.b.session.weeklyShop,purchaseCounts:[1,0,1]}}};c.fail=false;assert(c.owner.retrySave('weekly',1));assert.deepEqual(c.b.session.weeklyShop.purchaseCounts,[1,1,1]);assert.equal(sourceGunID(c.b.session.gunInventory.at(-1)),sourceWeeklyGun(1,new Date(c.now)));assert.equal(c.requests.length,1);
});
test('weekly callback does not recheck admission cap or collected-degree gate',async()=>{
 const d=deferred(),c=fixture({execute:()=>d.promise});c.b={...c.b,session:sourceWeeklyRefresh(c.b.session,new Date(c.now))};const p=c.owner.request('weekly',0);c.b={...c.b,session:{...c.b.session,catalogSeen:[],weeklyShop:{...c.b.session.weeklyShop,purchaseCounts:[2,0,0]}}};d.resolve(resp(c.requests[0]));assert(await p);assert.equal(c.b.session.weeklyShop.purchaseCounts[0],3);
});
for(const family of ['weekly','stepup'])for(const stage of ['admission','callback','retry'])test(`${family} full inventory at ${stage} grants no partial reward/claim`,async()=>{
 const d=deferred(),c=fixture({execute:()=>d.promise});let p;
 if(stage==='admission'){fullInventory(c);assert(!await c.owner.request(family,0));assert.equal(c.requests.length,0);}
 else {p=c.owner.request(family,0);if(stage==='callback')fullInventory(c);else c.fail=true;d.resolve(resp(c.requests[0]));assert(!await p);if(stage==='retry'){assert(c.owner.saveFailed);fullInventory(c);c.fail=false;assert(!c.owner.retrySave(family,0));}}
 assert.equal(c.writes,0);assert.equal(c.b.meta.petCoin,0);assert.equal(c.b.session.diamonds,0);assert.equal(c.b.session.stepUp.purchased[0],false);assert.equal(c.b.platform.claims.length,0);
});
test('Plus fulfillment and retry start seven days at successful save, keeping unrelated/legacy rights',async()=>{
 const c=fixture();c.b.meta.entitlements={...c.b.meta.entitlements,plusPack1Active:true};c.fail=true;assert(!await c.owner.request('plus',0));c.now+=3*86400000;c.fail=false;assert(c.owner.retrySave('plus',0));assert.equal(c.b.session.plusPack.purchasedUTC[0],c.now);assert(c.b.meta.entitlements.plusPack0Active);assert(c.b.meta.entitlements.plusPack1Active);
 c.now+=SOURCE_PLUS_DURATION_MS-1;assert(!await c.owner.request('plus',0));assert.equal(c.requests.length,1);c.now++;assert(await c.owner.request('plus',0));assert.equal(c.b.session.plusPack.purchasedUTC[0],c.now);
});
test('Plus request rejects active undated legacy rights rather than inventing date',async()=>{const c=fixture();c.b.meta.entitlements={...c.b.meta.entitlements,plusPack2Active:true};assert(!await c.owner.request('plus',2));assert.equal(c.requests.length,0);assert.equal(c.b.session.plusPack.purchasedUTC[2],null);});
test('Plus callback expires other dated rights atomically; current rights are not overwritten from admission snapshot',async()=>{
 const d=deferred(),c=fixture({execute:()=>d.promise});const p=c.owner.request('plus',0);c.b={...c.b,session:{...c.b.session,plusPack:{...c.b.session.plusPack,purchasedUTC:[null,c.now-SOURCE_PLUS_DURATION_MS,null]}},meta:{...c.b.meta,entitlements:{...c.b.meta.entitlements,plusPack1Active:true,plusPack2Active:true}}};d.resolve(resp(c.requests[0]));assert(await p);assert(!c.b.meta.entitlements.plusPack1Active);assert(c.b.meta.entitlements.plusPack2Active);
});
test('StepUp callback ignores expired clock and changed order, but enforces activity generation',async()=>{
 const d=deferred(),c=fixture({execute:()=>d.promise});c.b.session.stepUp.purchased[0]=true;const p=c.owner.request('stepup',1);c.now+=SOURCE_STEPUP_DURATION_MS+1;c.b={...c.b,session:{...c.b.session,stepUp:{...c.b.session.stepUp,purchased:[false,false,false,false,false]}}};d.resolve(resp(c.requests[0]));assert(await p);assert(c.b.session.stepUp.purchased[1]);assert.equal(c.b.session.diamonds,200);
});
for(const stage of ['callback','retry'])test(`StepUp changed generation at ${stage} is rejected without partial reward`,async()=>{
 const d=deferred(),c=fixture({execute:()=>d.promise}),p=c.owner.request('stepup',0);if(stage==='retry')c.fail=true;else c.b.session={...c.b.session,stepUp:{...c.b.session.stepUp,startedUTC:NOW+1}};d.resolve(resp(c.requests[0]));assert(!await p);if(stage==='retry'){c.b.session={...c.b.session,stepUp:{...c.b.session.stepUp,startedUTC:NOW+1}};c.fail=false;assert(!c.owner.retrySave('stepup',0));}assert.equal(c.writes,0);assert.equal(c.b.platform.claims.length,0);
});
test('StepUp open-popup admission after expiry retains source sequential semantics',async()=>{const c=fixture();c.now+=SOURCE_STEPUP_DURATION_MS+1;assert(await c.owner.request('stepup',0));assert(await c.owner.request('stepup',1));assert(!await c.owner.request('stepup',4));assert.equal(c.requests.length,2);});
test('all five StepUp tiers sequence rewards/codec/owned rejection',async()=>{const c=fixture();for(let i=0;i<5;i++){assert(await c.owner.request('stepup',i));assert.equal(sourceGunID(c.b.session.gunInventory.at(-1)),SOURCE_STEPUP.gunRewards[i]);assert(!await c.owner.request('stepup',i));}assert.equal(c.requests.length,5);assert.equal(c.b.session.diamonds,2200);reload(c);assert(c.b.session.stepUp.purchased.every(Boolean));assert.equal(c.b.platform.claims.length,5);});
test('all Plus products affect only their own dated flag',async()=>{for(let i=0;i<3;i++){const c=fixture();assert(await c.owner.request('plus',i));for(let j=0;j<3;j++){assert.equal(c.b.meta.entitlements[`plusPack${j}Active`],i===j);assert.equal(c.b.session.plusPack.purchasedUTC[j],i===j?NOW:null);}}});
test('weekly source cap/Plus progression/StepUp order and initial generation reject before provider',async()=>{
 const c=fixture();c.b.session=sourceWeeklyRefresh(c.b.session,new Date(NOW));c.b.session.weeklyShop.purchaseCounts=[2,2,1];for(let i=0;i<3;i++)assert(!await c.owner.request('weekly',i));c.b.session={...c.b.session,historicMax:189};assert(!await c.owner.request('plus',0));assert(!await c.owner.request('stepup',1));c.b.session={...c.b.session,stepUp:freshSourceStepUp()};assert(!await c.owner.request('stepup',0));assert.equal(c.requests.length,0);
});
for(const family of ['weekly','plus','stepup'])test(`${family} invalid item, progress, mode and clock gate`,async()=>{
 const c=fixture();for(const i of [-1,99,.5,NaN])assert(!await c.owner.request(family,i));c.b.session={...c.b.session,catalogSeen:[],historicMax:0};assert(!await c.owner.request(family,0));c.b.session={...c.b.session,catalogSeen:[20],historicMax:190,mode:'mine'};assert(!await c.owner.request(family,0));c.b.session={...c.b.session,mode:'field'};for(const t of [NaN,Infinity,1.1,8640000000000001]){c.now=t;assert(!await c.owner.request(family,0));}assert.equal(c.requests.length,0);
});
for(const id of ['', ' ', 'x'.repeat(241), 'claimed'])test(`request identity ${id.length>30?'too-long':JSON.stringify(id)} rejected before provider`,async()=>{const c=fixture({id});c.b.platform.claims=['claimed'];assert(!await c.owner.request('weekly',0));assert.equal(c.requests.length,0);});
test('unknown family rejects before provider',async()=>{const c=fixture();assert.equal(sourceActivityPurchaseGate(c.b,'unknown',0,NOW),'未知活动商品；未请求交易');assert(!await c.owner.request('unknown',0));assert.equal(c.requests.length,0);});
test('invalidate/reset drops old callback without clearing replacement transaction',async()=>{
 const old=deferred(),next=deferred(),c=fixture({execute:q=>q.id==='Q0'?old.promise:next.promise});const p=c.owner.request('weekly',0);c.owner.invalidate();const newer=c.owner.request('plus',0),pending=c.owner.pending;old.resolve(resp(c.requests[0]));assert(!await p);assert.equal(c.owner.pending,pending);next.resolve(resp(c.requests[1]));assert(await newer);assert(c.b.meta.entitlements.plusPack0Active);assert.equal(c.b.meta.petCoin,0);
});
test('late provider rejection after reset does not clear new transaction',async()=>{const old=deferred(),next=deferred(),c=fixture({execute:q=>q.id==='Q0'?old.promise:next.promise});const p=c.owner.request('weekly',0);c.owner.invalidate();const n=c.owner.request('plus',0),pending=c.owner.pending;old.reject(Error('old provider'));assert(!await p);assert.equal(c.owner.pending,pending);next.resolve(resp(c.requests[1]));assert(await n);});
test('memory-only failed-save recovery intentionally disappears on invalidate/reload',async()=>{const c=fixture();c.fail=true;assert(!await c.owner.request('weekly',0));c.owner.invalidate();c.fail=false;assert(!c.owner.retrySave('weekly',0));assert.equal(c.writes,0);assert.equal(c.b.meta.petCoin,0);});
for(const family of ['weekly','plus','stepup'])test(`${family} platform sequence overflow rejects complete candidate`,async()=>{const c=fixture();c.b.platform.sequence=Number.MAX_SAFE_INTEGER;const before=c.b;assert(!await c.owner.request(family,0));assert.equal(c.b,before);assert.equal(c.writes,0);assert.equal(c.owner.pending,null);});
test('weekly pet-coin overflow no partial gun/count/receipt',async()=>{const c=fixture();c.b.meta.petCoin=Number.MAX_SAFE_INTEGER;assert(!await c.owner.request('weekly',0));assert.equal(c.writes,0);assert.equal(c.b.platform.claims.length,0);});
test('StepUp diamond overflow no partial gun/ownership/receipt',async()=>{const c=fixture();c.b.session.stepUp.purchased[0]=true;c.b.session.diamonds=Number.MAX_SAFE_INTEGER;assert(!await c.owner.request('stepup',1));assert.equal(c.writes,0);assert(!c.b.session.stepUp.purchased[1]);});
test('invalid callback clock rejects no partial entitlement/receipt',async()=>{const d=deferred(),c=fixture({execute:()=>d.promise}),p=c.owner.request('plus',0);c.now=NaN;d.resolve(resp(c.requests[0]));assert(!await p);assert.equal(c.writes,0);assert(!c.b.meta.entitlements.plusPack0Active);});
test('complete candidate retains other systems and trims only the audit tail',async()=>{const c=fixture();c.b.platform.audit=Array.from({length:100},(_,i)=>({id:`old${i}`,kind:'resource',amount:1,at:new Date(NOW).toISOString()}));const activities=c.b.activities,pet=c.b.meta.pet,adventure=c.b.meta.adventure;assert(await c.owner.request('weekly',0));assert.equal(c.b.activities,activities);assert.equal(c.b.meta.pet,pet);assert.equal(c.b.meta.adventure,adventure);assert.equal(c.b.platform.audit.length,100);assert.equal(c.b.platform.audit[0].id,'old1');});
for(const product of [...SOURCE_WEEKLY.products,...SOURCE_WEEKLY.plusProducts,...SOURCE_STEPUP.products])test(`source price projection retry isolates ${product}`,()=>{assert.equal(sourceActivityPurchasePrice({pending:false},product),'本地测试');assert.equal(sourceActivityPurchasePrice({pending:true},product),'等待回调');assert.equal(sourceActivityPurchasePrice({pending:true,saveFailedProduct:product},product),'重试保存');assert.equal(sourceActivityPurchasePrice({pending:true,saveFailedProduct:'other'},product),'等待回调');});
