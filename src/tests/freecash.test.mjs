// STATIC + MODEL/INTERFACE only. Not online SDK, original-device or real Storage proof.
import test from 'node:test';import assert from 'node:assert/strict';
import {freshSourceFreeCash,decodeSourceFreeCash,sourceFreeCashExposure,sourceFreeCashGrant,createLocalFreeCashProvider} from '../r6-freecash';
import {SourceFreeCashClient} from '../freecash-client';import {freshSourceEntitlements,sourceRewardEntitlements,sourceMineEntitlements} from '../r5-entitlements';
import {sourceRewardAdsRemoved,sourceForcedAdsRemoved} from '../r6-shop';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {SOURCE_QA_SCENARIOS,createSourceQAStorage} from '../r6-qa';
const request={id:'q1',operation:'link',place:'shop'},response={...request,status:'success',provider:'local-test',onlineVerified:false,sdkStatus:'linked'};
const config={minDisplayStage:15,maxHudDisplayStage:35};
function client(execute){const c={state:freshSourceFreeCash(),entitlements:freshSourceEntitlements(),contextID:'A',saveLoaded:true,fail:false,requests:[],writes:0,notes:[]};const p=createLocalFreeCashProvider(true);c.owner=new SourceFreeCashClient({read:()=>c,write(state,e){if(c.fail)throw Error('quota');c.state=state;c.entitlements=e;c.writes++;},execute(q){c.requests.push(q);return execute?execute(q):p.execute(q);},requestID:()=>`q${c.requests.length}`,notice:n=>c.notes.push(n)});return c;}
test('missing legacy state defaults false, no rewards; malformed states rejected',()=>{assert.deepEqual(decodeSourceFreeCash(undefined),freshSourceFreeCash());for(const s of [null,{}, {...freshSourceFreeCash(),isLinkRewardReceived:true},{...freshSourceFreeCash(),localReceipts:['q','q']},{...freshSourceFreeCash(),localReceipts:[1]}])assert.throws(()=>decodeSourceFreeCash(s));const m=freshSourceMetaState();delete m.freeCash;const d=decodeSourceMetaState(serializeSourceMetaState(m));assert.deepEqual(d.freeCash,freshSourceFreeCash());assert(!d.entitlements.adRemoved);});
for(const stage of [0,139,140,349,350,99999])test(`exposure source displayed stage ${stage}`,()=>{const r=sourceFreeCashExposure(freshSourceFreeCash(),'linkable',stage,config);assert.equal(r.exposureTarget,stage>=140);assert.equal(r.hud,stage>=140&&stage<350);});
test('SDK/config/saveLoaded/received gates separate; banner may outlive HUD max',()=>{for(const args of [[freshSourceFreeCash(),'unavailable',140,config],[freshSourceFreeCash(),'linked',140,null],[freshSourceFreeCash(),'linkable',140,config,false],[{...freshSourceFreeCash(),isLinkRewardReceived:true},'linked',140,config]])assert(!sourceFreeCashExposure(...args).exposureTarget);assert(sourceFreeCashExposure(freshSourceFreeCash(),'linked',350,config).exposureTarget);});
test('reward removes rewarded ads only; never mutates forced/all/package rights; duplicate does not grant',()=>{const e=freshSourceEntitlements(),r=sourceFreeCashGrant(freshSourceFreeCash(),e,request,response);assert(r.granted);assert(sourceRewardAdsRemoved(r.entitlements));assert(!sourceForcedAdsRemoved(r.entitlements));assert(!r.entitlements.removeAdsAll);assert(!r.entitlements.buffPack);assert.equal(r.state.localReceipts.length,1);assert(!sourceFreeCashGrant(r.state,r.entitlements,request,response).granted);assert(!e.adRemoved);const m={...freshSourceMetaState(),freeCash:r.state,entitlements:r.entitlements};assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(m)),m);});
for(const key of ['id','operation','place','provider','onlineVerified','status','sdkStatus'])test(`reject forged ${key}`,()=>{const r={...response,[key]:key==='onlineVerified'?true:key==='status'?'failure':key==='sdkStatus'?'linkable':'wrong'};assert(!sourceFreeCashGrant(freshSourceFreeCash(),freshSourceEntitlements(),request,r).granted);});
for(const status of ['success','failure','cancelled','unavailable'])test(`local provider ${status}, request dedup/conflict`,async()=>{const p=createLocalFreeCashProvider(status!=='unavailable',status==='unavailable'?'success':status);assert.equal(p.execute(request),p.execute({...request}));const r=await p.execute(request);assert.equal(r.status,status);assert(!r.onlineVerified);assert.equal(r.sdkStatus,status==='success'?'linked':status==='unavailable'?'unavailable':'linkable');assert.throws(()=>p.execute({...request,place:'hud'}));});
test('full init/check/link/close/reload and no duplicate provider grant',async()=>{const c=client();await c.owner.show('shop');assert(c.owner.open);assert.equal(c.owner.sdkStatus,'linkable');assert(!await c.owner.request('check'));assert.equal(c.writes,0);assert(await c.owner.request('link'));assert(!c.owner.open);assert.equal(c.writes,1);assert(!await c.owner.request('link'));assert.equal(c.requests.length,3);c.owner.reset();assert.equal(c.owner.sdkStatus,'unavailable');assert(c.state.isLinkRewardReceived);});
test('SDK not ready rejects link without pretending success',async()=>{const c=client();assert(!await c.owner.request('link'));assert.equal(c.requests.length,0);});
test('save failure keeps matched receipt, retries with CURRENT rights, never reruns provider',async()=>{const c=client();await c.owner.show('banner');c.fail=true;assert(!await c.owner.request('link'));assert(c.owner.pending&&c.owner.saveFailed);assert(!c.state.isLinkRewardReceived);c.entitlements={...c.entitlements,removeAdsForced:true};c.fail=false;assert(c.owner.retrySave());assert(c.entitlements.removeAdsForced&&c.entitlements.adRemoved);assert.equal(c.writes,1);assert.equal(c.requests.length,2);assert(!c.owner.retrySave());});
test('pending reward waits for source save-load flag, then commits once',async()=>{const c=client();await c.owner.show('qa');c.saveLoaded=false;assert(!await c.owner.request('link'));assert(!c.state.isLinkRewardReceived);assert(c.owner.pending);c.saveLoaded=true;assert(c.owner.retrySave());assert.equal(c.writes,1);});
for(const kind of ['reset','context','close','mismatch'])test(`delayed callback ${kind}`,async()=>{let resolve;const c=client(q=>q.operation==='init'?Promise.resolve({...q,status:'success',provider:'local-test',onlineVerified:false,sdkStatus:'linkable'}):new Promise(r=>resolve=r));await c.owner.show('hud');const p=c.owner.request('link'),q=c.requests.at(-1);assert(!await c.owner.request('link'));if(kind==='reset')c.owner.reset();if(kind==='context')c.contextID='B';if(kind==='close')c.owner.close();resolve({...q,status:'success',provider:'local-test',onlineVerified:false,sdkStatus:'linked',...(kind==='mismatch'?{place:'shop'}:{})});assert.equal(await p,!['reset','context','mismatch'].includes(kind));assert.equal(c.writes,['reset','context','mismatch'].includes(kind)?0:1);});
test('throwing provider releases request for bounded explicit retry',async()=>{const c=client(()=>{throw Error('bad');});await c.owner.show('shop');assert(!c.owner.pending);assert(!c.state.isRewardAdRemoved);});
test('QA registered and no player Storage calls',()=>{for(const n of ['page','hud','shop','buff','locked','over-hud','owned'])assert(SOURCE_QA_SCENARIOS.includes('freecash-'+n));let accesses=0;const q=createSourceQAStorage({getItem(){accesses++;return 'player';},setItem(){accesses++;}},true);q.setItem('save','fixture');assert.equal(q.getItem('save'),'fixture');assert.equal(accesses,0);});

test('FreeCash rewarded-ad removal projects automatic bonuses without persisting unrelated rights',()=>{
 const e=sourceFreeCashGrant(freshSourceFreeCash(),freshSourceEntitlements(),request,response).entitlements;
 assert.equal(e.automaticBonus,false);assert.equal(sourceRewardEntitlements(e).automaticBonus,true);assert.equal(sourceMineEntitlements(e).automaticBonus,true);
 const forced={...freshSourceEntitlements(),removeAdsForced:true};assert.equal(sourceRewardEntitlements(forced).automaticBonus,false);assert.equal(sourceMineEntitlements(forced).automaticBonus,false);
 assert.equal(sourceRewardEntitlements(sourceRewardEntitlements(e)).automaticBonus,true);assert(!e.buffPack&&!e.minePack&&!e.plusPack1Active);
});

// A readiness change patches the same underlying source view, not its settlement/scroll.
import {FREECASH_RESULT_ROOTS,freeCashBackgroundActivation,syncFreeCashBackground} from '../freecash-background';
test('all ten source result banners switch locally on SDK readiness without reward mutation',()=>{
 const s={removeAdsAll:false,buffPack:false,exposure:{featureEnabled:true,exposureTarget:false}};
 const before=JSON.stringify(s),off=freeCashBackgroundActivation(s),on=freeCashBackgroundActivation({...s,exposure:{featureEnabled:true,exposureTarget:true}});
 assert.equal(FREECASH_RESULT_ROOTS.length,10);
 for(const root of FREECASH_RESULT_ROOTS){const p=root+'/Remove Ads ALL (Inapp)';assert(off[p+'/Remove_AD_All']);assert(!off[p+'/FreeCash_Banner']);assert(!on[p+'/Remove_AD_All']);assert(on[p+'/FreeCash_Banner']);}
 const owned=freeCashBackgroundActivation({...s,removeAdsAll:true});for(const root of FREECASH_RESULT_ROOTS)assert(!owned[root+'/Remove Ads ALL (Inapp)']);
 assert.equal(JSON.stringify(s),before);
});
test('background patch touches only current-view source paths in one batch',()=>{
 const root=FREECASH_RESULT_ROOTS[0]+'/Remove Ads ALL (Inapp)',paths=new Set([root,root+'/Remove_AD_All',root+'/FreeCash_Banner']);let patch;
 syncFreeCashBackground({get:p=>paths.has(p),patch:p=>{assert(!patch);patch=p;}},{removeAdsAll:false,buffPack:false,exposure:{featureEnabled:true,exposureTarget:true}});
 assert.deepEqual(Object.keys(patch.active),[...paths]);assert(patch.active[root+'/FreeCash_Banner']);
});


test('configured local SDK initializes before hidden banners; absent config does not request or retry',async()=>{
 const c=client();assert.equal(c.owner.ensureInitialized(false),null);assert.equal(c.requests.length,0);
 await c.owner.ensureInitialized(true);assert.equal(c.owner.sdkStatus,'linkable');assert(!c.owner.open);
 assert.equal(c.owner.ensureInitialized(true),null);assert.equal(c.requests.length,1);
 c.owner.reset();await c.owner.ensureInitialized(true);assert.equal(c.requests.length,2);
});
test('unavailable initialization is bounded; explicit page check can retry',async()=>{
 const c=client(q=>Promise.resolve({...q,status:'unavailable',provider:'local-test',onlineVerified:false,sdkStatus:'unavailable'}));
 await c.owner.ensureInitialized(true);for(let i=0;i<20;i++)assert.equal(c.owner.ensureInitialized(true),null);
 assert.equal(c.requests.length,1);await c.owner.request('check');assert.equal(c.requests.length,2);
});
