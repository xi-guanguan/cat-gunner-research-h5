// MODEL/INTERFACE only: remove-ads local-test purchase persistence; no store or device proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceRemoveAdsPurchaseClient} from '../remove-ads-purchase-client';
import {createSession} from '../session';
import {freshSourceMetaState} from '../source-meta-runtime';
import {freshSourceDiaPig} from '../r6-diapig';
import {createActivityState} from '../source-activities';
import {freshPlatformState} from '../local-platform';
const response=q=>({...q,status:'success',provider:'local-test',onlineVerified:false});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
function fixture(opts={}){
 const c={ctx:'A',scope:true,fail:false,writes:0,requests:[],notes:[],shown:0,clock:{nowUTC:1730000000000,monoSeconds:10,canGrantTimedReward:false,pendingCount:0},runtime:null,b:{session:createSession(),activities:createActivityState(),platform:freshPlatformState(),meta:freshSourceMetaState()}};
 c.b.session={...c.b.session,diaPig:freshSourceDiaPig()};
 c.owner=new SourceRemoveAdsPurchaseClient({
  read:()=>({bundle:c.b,runtime:c.runtime,contextID:c.ctx}),
  write:(b,r)=>{if(c.fail)throw Error('quota');c.writes++;c.b=b;c.runtime=r;},
  clock:()=>c.clock,captureScope:()=>()=>c.scope,requestID:()=>`Q${c.requests.length}`,now:()=> '2026-10-06T12:00:00Z',
  execute:async q=>{c.requests.push(q);return opts.execute?opts.execute(q):response(q);},notice:n=>c.notes.push(n),granted:()=>{c.shown++;}
 });
 return c;
}
test('success persists entitlement, initialized pig and receipt before publish',async()=>{const c=fixture();assert(await c.owner.request('remove_all_ads'));assert(c.b.meta.entitlements.removeAdsAll);assert.equal(c.b.session.diaPig.diamonds,0);assert.equal(c.b.platform.claims.length,1);assert.equal(c.b.platform.sequence,1);assert.equal(c.writes,1);assert.equal(c.shown,1);assert.equal(c.owner.pending,null);assert.match(c.notes.at(-1),/已保存/);});
for(const status of ['failure','cancelled','unavailable'])test(`provider ${status} changes nothing`,async()=>{const c=fixture({execute:async q=>({...q,status,provider:'local-test',onlineVerified:false})});assert(!await c.owner.request('remove_all_ads'));assert(!c.b.meta.entitlements.removeAdsAll);assert.equal(c.b.platform.claims.length,0);assert.equal(c.writes,0);assert.equal(c.owner.pending,null);});
test('save failure retains same receipt and retry saves current candidate once',async()=>{const c=fixture();c.fail=true;assert(!await c.owner.request('remove_forced_ads'));assert(c.owner.saveFailed);assert(c.owner.pending);assert(!c.b.meta.entitlements.removeAdsForced);assert.equal(c.requests.length,1);c.b={...c.b,session:{...c.b.session,diamonds:42}};c.fail=false;assert(c.owner.retrySave('remove_forced_ads'));assert(c.b.meta.entitlements.removeAdsForced);assert.equal(c.b.session.diamonds,42);assert.equal(c.b.platform.claims.length,1);assert.equal(c.requests.length,1);assert.equal(c.writes,1);assert(!c.owner.retrySave('remove_forced_ads'));});
test('pending blocks unrelated product and panel close still permits callback',async()=>{const d=deferred(),c=fixture({execute:()=>d.promise});const a=c.owner.request('remove_all_ads');assert(c.owner.pending);assert(!await c.owner.request('remove_forced_ads'));c.scope=true;d.resolve(response(c.requests[0]));assert(await a);assert(c.b.meta.entitlements.removeAdsAll);});
test('result scope closure rejects callback without publish',async()=>{const d=deferred(),c=fixture({execute:()=>d.promise});const a=c.owner.request('remove_all_ads');c.scope=false;d.resolve(response(c.requests[0]));assert(!await a);assert(!c.b.meta.entitlements.removeAdsAll);assert.equal(c.writes,0);assert.equal(c.owner.pending,null);});
test('context replacement invalidates old callback and duplicate receipt is harmless',async()=>{const d=deferred(),c=fixture({execute:()=>d.promise});const a=c.owner.request('remove_all_ads');c.ctx='B';d.resolve(response(c.requests[0]));assert(!await a);assert.equal(c.writes,0);const r=fixture();assert(await r.owner.request('remove_all_ads'));const saved=r.b;const duplicate=fixture({execute:q=>response(q)});duplicate.b={...saved,platform:{...saved.platform,claims:[...saved.platform.claims]}};assert(!await duplicate.owner.request('remove_all_ads'));assert.equal(duplicate.writes,0);});
for(const patch of [{id:'wrong'},{purpose:'wrong'},{kind:'ad'},{provider:'online'},{onlineVerified:true}])test(`mismatched remove-ads receipt ${JSON.stringify(patch)} never writes`,async()=>{const c=fixture({execute:q=>({...response(q),...patch})});assert(!await c.owner.request('remove_all_ads'));assert.equal(c.writes,0);assert.equal(c.owner.pending,null);});
test('wrong-product retry, repeated save failure and original product retain a single transaction',async()=>{const c=fixture();c.fail=true;await c.owner.request('remove_all_ads');const q=c.owner.pending;assert(!c.owner.retrySave('remove_forced_ads'));assert(!c.owner.retrySave('remove_all_ads'));assert.equal(c.owner.pending,q);assert.equal(c.requests.length,1);c.fail=false;assert(c.owner.retrySave('remove_all_ads'));assert.equal(c.requests.length,1);assert.equal(c.writes,1);});
test('closed result or changed context rejects retained failed-save receipt',async()=>{for(const mode of ['scope','context']){const c=fixture();c.fail=true;await c.owner.request('remove_all_ads');c.fail=false;if(mode==='scope')c.scope=false;else c.ctx='B';assert(!c.owner.retrySave('remove_all_ads'));assert.equal(c.writes,0);assert.equal(c.owner.pending,null);assert(!c.b.meta.entitlements.removeAdsAll);}});
test('invalidate drops stale request without clearing a replacement transaction',async()=>{const old=deferred(),next=deferred(),c=fixture({execute:q=>q.id==='Q0'?old.promise:next.promise});const p=c.owner.request('remove_all_ads');c.owner.invalidate();const newer=c.owner.request('remove_forced_ads'),q=c.owner.pending;old.resolve(response(c.requests[0]));assert(!await p);assert.equal(c.owner.pending,q);next.resolve(response(c.requests[1]));assert(await newer);assert(c.b.meta.entitlements.removeAdsForced);assert(!c.b.meta.entitlements.removeAdsAll);});
test('provider exception clears busy without changing wallet or rights',async()=>{const c=fixture({execute:()=>{throw Error('provider');}});assert(!await c.owner.request('remove_all_ads'));assert.equal(c.owner.pending,null);assert.equal(c.writes,0);assert(!c.b.meta.entitlements.removeAdsAll);});
