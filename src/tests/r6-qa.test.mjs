import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOURCE_QA_SCENARIOS,isSourceQAScenario,resolveSourceQARoute,createSourceQAStorage} from '../r6-qa';
import {createLocalDevelopmentR5PlatformProvider,R5_DEVELOPMENT_STORAGE_KEY} from '../r5-platform-provider';
import {freshPlatformState} from '../local-platform';
function fixture(){const values=new Map([['player','real-player-progress'],[R5_DEVELOPMENT_STORAGE_KEY,'normal-provider-data']]);let reads=0,writes=0;return {values,get reads(){return reads;},get writes(){return writes;},getItem(k){reads++;return values.get(k)??null;},setItem(k,v){writes++;values.set(k,v);}};}
test('every registered test route isolates before loading; unknown, empty, repeated and escaped names never fall back to player',()=>{
 assert.deepEqual(resolveSourceQARoute('?other=1'),{isolated:false,scenario:null,error:null});
 assert.equal(new Set(SOURCE_QA_SCENARIOS).size,SOURCE_QA_SCENARIOS.length);
 for(const s of SOURCE_QA_SCENARIOS)assert.deepEqual(resolveSourceQARoute('?qa='+s),{isolated:true,scenario:s,error:null});
 for(const search of ['?qa','?qa=','?qa=nonexistent','?qa=%3Cscript%3E','?qa=&qa=challenge-fight','?qa=bad&qa=entry']){const r=resolveSourceQARoute(search);assert.equal(r.isolated,true);assert.equal(r.scenario,null);assert.match(r.error,/普通存档未读取、未写入/);}
 assert.equal(isSourceQAScenario(null),false);assert.equal(isSourceQAScenario('challenge-defeat-freecash'),true);
});
test('isolated storage never reads/writes normal storage and isolates test scenarios from each other',()=>{
 const f=fixture(),q=createSourceQAStorage(f,true);assert.equal(q.getItem('player'),null);q.setItem('player','fixture');assert.equal(q.getItem('player'),'fixture');q.isolate();assert.equal(q.getItem('player'),null);assert.equal(f.reads,0);assert.equal(f.writes,0);assert.equal(f.values.get('player'),'real-player-progress');
});
test('normal route retains storage semantics; developer fixture switch permanently isolates',()=>{
 const f=fixture(),q=createSourceQAStorage(f,false);assert.equal(q.getItem('player'),'real-player-progress');q.setItem('player','new-progress');q.isolate();const before={reads:f.reads,writes:f.writes};assert.equal(q.getItem('player'),null);q.setItem('player','qa');assert.equal(f.values.get('player'),'new-progress');assert.equal(f.reads,before.reads);assert.equal(f.writes,before.writes);
});
test('QA local login and cloud-save use only fixture memory and reset identity on scenario change',async()=>{
 const f=fixture(),q=createSourceQAStorage(f,true),getLocalState=()=>({...freshPlatformState(),developerEnabled:true});let p=createLocalDevelopmentR5PlatformProvider({storage:q,getLocalState});assert.equal(p.isSignedIn(),false);
 assert.equal((await p.execute({action:'google-login',requestId:'qa-login'})).status,'success');
 assert.equal((await p.execute({action:'cloud-save',requestId:'qa-cloud',snapshot:{encodedSession:'test-only',maxStage:1}})).status,'success');assert.ok(q.getItem(R5_DEVELOPMENT_STORAGE_KEY));q.isolate();p=createLocalDevelopmentR5PlatformProvider({storage:q,getLocalState});assert.equal(p.isSignedIn(),false);assert.equal(f.reads,0);assert.equal(f.writes,0);assert.equal(f.values.get(R5_DEVELOPMENT_STORAGE_KEY),'normal-provider-data');
});
test('same-build QA selector links all use the single registry (no forgotten boot whitelist)',()=>{
 const html=readFileSync('public/qa.html','utf8');const routes=[...html.matchAll(/href="\/\?qa=([^"&]+)/g)].map(m=>m[1]);assert.ok(routes.length>70);for(const s of routes)assert.equal(isSourceQAScenario(s),true,`unregistered selector ${s}`);
});

test('QA preference toggles do not alter normal audio/vibration settings',async()=>{
 const {loadBrowserPreferences,createBrowserFeedback,BROWSER_PREFERENCES_STORAGE_KEY}=await import('../browser-preferences');const f=fixture(),q=createSourceQAStorage(f,true);f.values.set(BROWSER_PREFERENCES_STORAGE_KEY,'{"music":false,"sound":false,"vibration":false}');const preferences=loadBrowserPreferences(q);assert.equal(preferences.music,true);const feedback=createBrowserFeedback(preferences,{},q);feedback.setPreferences({sound:false});feedback.dispose();assert.equal(f.reads,0);assert.equal(f.writes,0);assert.equal(JSON.parse(f.values.get(BROWSER_PREFERENCES_STORAGE_KEY)).music,false);
});
