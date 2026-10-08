import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalDevelopmentR5PlatformProvider,createUnavailableR5PlatformProvider,R5_DEVELOPMENT_STORAGE_KEY} from '../r5-platform-provider.ts';
import {freshPlatformState} from '../local-platform.ts';
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
const fixture=(extra={})=>{let platform={...freshPlatformState(),developerEnabled:true};const storage=memory();const provider=createLocalDevelopmentR5PlatformProvider({getLocalState:()=>platform,storage,now:()=>new Date('2026-10-01T14:00:00Z'),...extra});return {provider,storage,setPlatform:p=>platform=p,platform:()=>platform}};
const call=(p,action,requestId,extra={})=>p.execute({action,requestId,...extra});
const login=p=>call(p,'google-login','login');
const snapshot=(maxStage=4)=>({maxStage,encodedSession:JSON.stringify({schema:1,stage:maxStage})});

test('normal adapter returns unavailable for every settings action and never signs in',async()=>{
 const p=createUnavailableR5PlatformProvider();
 for(const a of ['google-login','cloud-save','cloud-load','redeem','support','restore-purchases']){
  const r=await call(p,a,a,{confirmed:true,snapshot:snapshot(),code:'R5-LOCAL-UI-TEST'});
  assert.equal(r.status,'unavailable');assert.equal(r.scope,'unavailable');assert.equal(r.receipt,null);assert.equal(r.snapshot,undefined);
 }
 assert.equal(p.isSignedIn(),false);
});
test('developer switch gates local identity and separates receipts from purchase audit',async()=>{
 const f=fixture();f.setPlatform(freshPlatformState());assert.equal((await login(f.provider)).status,'unavailable');assert.equal(f.storage.values.size,0);
 f.setPlatform({...f.platform(),developerEnabled:true});const r=await login(f.provider);
 assert.equal(r.identity.provider,'local-development');assert.equal(r.scope,'local-development');assert.equal(r.receipt.platformVerified,false);
 assert.equal(r.receipt.provider,'r5-local-development');assert.equal(f.platform().audit.length,0);assert.equal(f.provider.isSignedIn(),true);
 assert.equal(f.storage.values.has(R5_DEVELOPMENT_STORAGE_KEY),true);f.setPlatform(freshPlatformState());assert.equal(f.provider.isSignedIn(),false);
});
test('save higher progress succeeds; overwriting higher test progress needs confirmation and load has preview first',async()=>{
 const f=fixture(),p=f.provider;assert.equal((await call(p,'cloud-load','unauth')).status,'failure');await login(p);
 assert.equal((await call(p,'cloud-load','empty')).status,'failure');
 assert.equal((await call(p,'cloud-save','save',{snapshot:snapshot(20)})).status,'success');
 const warning=await call(p,'cloud-save','overwrite',{snapshot:snapshot(2)});assert.equal(warning.status,'confirmation');assert.equal(warning.preview.maxStage,20);assert.equal(warning.receipt,null);
 const before=await call(p,'cloud-load','load');assert.equal(before.status,'confirmation');assert.equal(before.snapshot,undefined);assert.equal(before.preview.maxStage,20);
 const load=await call(p,'cloud-load','load',{confirmed:true});assert.equal(load.status,'success');assert.equal(load.snapshot.maxStage,20);
 assert.equal((await call(p,'cloud-save','overwrite',{snapshot:snapshot(2),confirmed:true})).status,'success');
 assert.equal((await call(p,'cloud-load','load-2')).preview.maxStage,2);
});
test('test slot and identity survive reload; replay cannot repeat operation or deliver payload',async()=>{
 const f=fixture();await login(f.provider);await call(f.provider,'cloud-save','s',{snapshot:snapshot()});
 const reload=createLocalDevelopmentR5PlatformProvider({getLocalState:f.platform,storage:f.storage});assert.equal(reload.isSignedIn(),true);
 const loaded=await call(reload,'cloud-load','l',{confirmed:true});loaded.snapshot.maxStage=90;
 assert.equal((await call(reload,'cloud-load','another')).preview.maxStage,4);
 const duplicate=await call(reload,'cloud-load','l',{confirmed:true});assert.equal(duplicate.status,'duplicate');assert.equal(duplicate.snapshot,undefined);
 assert.equal((await call(reload,'cloud-save','s',{snapshot:snapshot(100)})).status,'duplicate');
 assert.equal((await call(reload,'cloud-load','after')).preview.maxStage,4);
});
test('failure and aborted confirmation do not modify test slot',async()=>{
 const f=fixture({beforeExecute:async r=>r.requestId==='fail'?'failure':'success'});await login(f.provider);await call(f.provider,'cloud-save','s',{snapshot:snapshot(20)});
 assert.equal((await call(f.provider,'cloud-save','fail',{confirmed:true,snapshot:snapshot(100)})).status,'failure');
 const c=new AbortController();c.abort();const cancel=await call(f.provider,'cloud-save','cancel',{confirmed:true,snapshot:snapshot(100),signal:c.signal});
 assert.equal(cancel.status,'cancelled');assert.equal(cancel.receipt.scope,'local-development');assert.equal((await call(f.provider,'cloud-load','view')).preview.maxStage,20);
});
test('cancellation or developer disable during pending request prevents mutation',async()=>{
 let resolve;const f=fixture({beforeExecute:()=>new Promise(r=>resolve=r)}),c=new AbortController();
 const pending=call(f.provider,'google-login','pending',{signal:c.signal});await Promise.resolve();assert.equal(f.provider.isSignedIn(),false);c.abort();resolve('success');
 assert.equal((await pending).status,'cancelled');assert.equal(f.provider.isSignedIn(),false);
 const disabled=call(f.provider,'google-login','disabled');await Promise.resolve();f.setPlatform(freshPlatformState());resolve('success');assert.equal((await disabled).status,'unavailable');assert.equal(f.provider.isSignedIn(),false);
});
test('parallel duplicate requests serialize to one persisted effect',async()=>{
 const f=fixture();const r=await Promise.all([login(f.provider),login(f.provider)]);assert.deepEqual(r.map(x=>x.status),['success','duplicate']);
 assert.equal(JSON.parse(f.storage.getItem(R5_DEVELOPMENT_STORAGE_KEY)).receipts.length,1);
});
test('local redeem fixture validates, accepts once and never produces a grant',async()=>{
 const f=fixture();assert.equal((await call(f.provider,'redeem','bad',{code:'any-live-code'})).status,'failure');
 const accepted=await call(f.provider,'redeem','valid',{code:' R5-LOCAL-UI-TEST '});assert.equal(accepted.status,'success');assert.equal(accepted.redeemedCode,'R5-LOCAL-UI-TEST');
 assert.equal((await call(f.provider,'redeem','repeat',{code:'R5-LOCAL-UI-TEST'})).status,'failure');assert.equal(f.platform().claims.length,0);assert.equal(f.platform().audit.length,0);
});
test('support produces draft only and restore enumerates prior test purchases without regrant',async()=>{
 const f=fixture();f.setPlatform({...f.platform(),audit:[{id:'shop:0',kind:'purchase',amount:100,at:'2026-10-01T14:00:00Z'},{id:'ad:0',kind:'ad',amount:20,at:'2026-10-01T14:00:00Z'},null,{kind:'purchase',amount:Infinity}]});
 const old=f.platform();const support=await call(f.provider,'support','support',{supportBody:'test game state'});assert.equal(support.supportDraft,'test game state');
 const restore=await call(f.provider,'restore-purchases','restore');assert.deepEqual(restore.restoredTestPurchases,[{id:'shop:0',amount:100,at:'2026-10-01T14:00:00Z'}]);assert.equal(f.platform(),old);
});
test('invalid snapshot, corrupt persistence and storage failure never report success',async()=>{
 const f=fixture();await login(f.provider);assert.equal((await call(f.provider,'cloud-save','invalid',{snapshot:{encodedSession:'',maxStage:Infinity}})).status,'failure');
 const bad=memory();bad.setItem(R5_DEVELOPMENT_STORAGE_KEY,JSON.stringify({schema:1,scope:'platform',signedIn:true}));
 const p=createLocalDevelopmentR5PlatformProvider({getLocalState:f.platform,storage:bad});assert.equal(p.isSignedIn(),false);
 const broken=createLocalDevelopmentR5PlatformProvider({getLocalState:f.platform,storage:{getItem:()=>null,setItem:()=>{throw Error('full')}}});
 assert.equal((await login(broken)).status,'failure');assert.equal(broken.isSignedIn(),false);
});
