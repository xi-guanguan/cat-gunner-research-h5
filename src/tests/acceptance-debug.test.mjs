import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FOCUS,normalizedDelay,scenarioURL,isIsolatedChild,fixtureAPI,viewportSize,boundedRecord,usesHostProviderControls} from '../../public/debug/model.mjs';
import {SOURCE_QA_SCENARIOS, isSourceQAScenario} from '../r6-qa';
const known=new Set(SOURCE_QA_SCENARIOS);
const html=readFileSync('public/qa.html','utf8'),shell=readFileSync('public/debug.html','utf8'),page=readFileSync('public/debug/page.mjs','utf8');

test('debug focus cards only use registered same-build scenarios that the selector actually exposes',()=>{
 const exposed=new Set([...html.matchAll(/href="\/\?qa=([^"&]+)/g)].map(m=>m[1]));
 assert.ok(FOCUS.length>=15);assert.equal(new Set(FOCUS.map(c=>c.route)).size,FOCUS.length);
 for(const card of FOCUS){assert.equal(isSourceQAScenario(card.route),true,card.route);assert.equal(exposed.has(card.route),true,card.route);assert.ok(card.steps.length>20);}
});
test('debug selector link has no QA route so the existing QA registry check remains exhaustive',()=>{
 assert.match(html,/href="\/debug.html"/);assert.match(shell,/src="about:blank"/);assert.doesNotMatch(shell,/src="\/\??"/);
});
for(const outcome of ['success','failure','cancelled','unavailable'])test(`provider ${outcome} keeps the exact QA route and applies only explicit fixture parameters`,()=>{
 const u=new URL(scenarioURL('/?qa=boss-reward&activity-save-failure=1',known,outcome,3000),'http://localhost:4311');
 assert.equal(u.pathname,'/');assert.equal(u.searchParams.get('qa'),'boss-reward');assert.equal(u.searchParams.get('provider-outcome'),outcome);assert.equal(u.searchParams.get('activity-save-failure'),'1');
 for(const key of ['reward','activity','shop','pass','auto-ad','adgun'])assert.equal(u.searchParams.get(`${key}-provider-delay`),'3000');
});
for(const url of ['/','/?other=1','/?qa=','/?qa=not-a-route','/?qa=wrong&qa=boss-reward','/?qa=boss-reward&qa=entry','https://foreign.test/?qa=boss-reward','//foreign.test/?qa=boss-reward','/debug.html?qa=boss-reward'])test(`refuse non-fixture or foreign target ${url}`,()=>{
 assert.throws(()=>scenarioURL(url,known),/拒绝/);
});
test('unknown outcome cannot masquerade as local success',()=>{assert.throws(()=>scenarioURL('/?qa=boss-reward',known,'online-success'));});
test('delay injection matches common ceiling and never emits NaN, infinity, negative or fractions',()=>{
 for(const [input,result] of [[-1,0],[0,0],[5000,5000],[10000,5000],['3000',3000],[45.9,45],[NaN,0],[Infinity,0],['oops',0]])assert.equal(normalizedDelay(input),result);
});
test('fixture mutation needs same origin/path/exact query + registered route + explicit runtime handshake',()=>{
 const expected='http://localhost:4311/?qa=boss-reward&provider-outcome=success',handshake={qaFixtureActive:true};
 assert.equal(isIsolatedChild(expected,expected,known,handshake),true);
 for(const actual of ['http://localhost:4311/','http://localhost:4311/?qa=boss-reward','http://localhost:4311/?qa=unknown','http://other:4311/?qa=boss-reward&provider-outcome=success','http://localhost:4311/?qa=hunt-plus&provider-outcome=success'])assert.equal(isIsolatedChild(expected,actual,known,handshake),false,actual);
 for(const h of [null,{}, {qaFixtureActive:false},{qaFixtureActive:1}])assert.equal(isIsolatedChild(expected,expected,known,h),false);
 assert.equal(isIsolatedChild(expected,'about:blank',known,handshake),false);
});
test('route owns the correct save-failure client, independent combat hosts are read-only',()=>{
 assert.equal(fixtureAPI('boss-reward-plus'),'__catBossRewardFixture');assert.equal(fixtureAPI('hunt-plus'),'__catActivityPurchaseFixture');assert.equal(fixtureAPI('boss-plus-locked'),'__catActivityPurchaseFixture');assert.equal(fixtureAPI('pass-scroll'),'__catPassFixture');
 for(const route of ['raid-live','hunt-live','mine','pet-auto','gun-auto','entry'])assert.equal(fixtureAPI(route),null);
 const main=readFileSync('src/main.ts','utf8');for(const route of known){const api=fixtureAPI(route);if(api)assert.ok(main.includes(api+':'),`missing source API ${api}`);}
});
test('both acceptance sizes use real iframe dimensions, not only canvas styling',()=>{
 assert.deepEqual(viewportSize('390x844'),{width:390,height:844});assert.deepEqual(viewportSize('1080x1920'),{width:1080,height:1920});assert.deepEqual(viewportSize('bad'),{width:390,height:844});
 assert.match(page,/frame\.style\.width=/);assert.match(page,/frame\.style\.height=/);assert.match(page,/width:w\.innerWidth,height:w\.innerHeight/);
});
test('observations bounded at100 and do not mutate caller records',()=>{
 const records=Array.from({length:100},(_,i)=>({i}));const next=boundedRecord(records,{i:100});assert.equal(next.length,100);assert.equal(next[0].i,1);assert.equal(next.at(-1).i,100);assert.equal(records[0].i,0);
});
test('shell never reads/writes real browser storage or triggers rewards/payment in debug controls',()=>{
 assert.doesNotMatch(page,/localStorage|sessionStorage|\.clear\(|__catSourceAction|\.execute\(|requestBossResultBonus|requestWeeklyReward/);
 assert.match(page,/USER_OBSERVATION_ONLY/);assert.match(page,/normalSaveIncluded:false/);assert.match(page,/originalDevice:'NOT_RUN'/);assert.match(page,/if\(!snapshot\?\.isolated\)throw/);
});
test('navigation invalidates snapshots/fixture controls until the new iframe load and handshake',()=>{
 assert.match(page,/\|\|navigating\)return null/);assert.match(page,/navigating=true;disableMutations\(\)/);assert.match(page,/frame\.addEventListener\('load'/);
 assert.match(page,/last=null;disableMutations\(\)/);assert.match(page,/old|旧/);
});
test('reset reloads the exact active fixture; catalog failure never opens ordinary entry',()=>{
 assert.match(page,/frame\.src=active\.url/);assert.doesNotMatch(page,/frame\.src=['"]\/['"]/);assert.match(page,/目录为空，拒绝回退到普通存档/);
 assert.match(shell,/target="_blank" rel="noopener">正常入口/);
});
test('static debug modules and stylesheet ship from public with absolute resolvable URLs',()=>{
 for(const asset of ['/debug/style.css','/debug/page.mjs'])assert.ok(shell.includes(asset));assert.ok(page.includes("from './model.mjs'"));
 for(const path of ['public/debug/style.css','public/debug/page.mjs','public/debug/model.mjs'])assert.ok(readFileSync(path).length>100);
});

// Controller integration checks use a small fake DOM, NOT a browser/GUI proof.
import vm from 'node:vm';
async function controller() {
 const elements=new Map();
 class E {
  constructor(id=''){this.id=id;this.children=[];this.options=[];this.events={};this.style={};this.dataset={};this.attributes={};this.value='';this.disabled=false;this.clientWidth=850;this.clientHeight=900;this.textContent='';}
  addEventListener(event,cb){this.events[event]=cb;}
  replaceChildren(){this.children=[];this.options=[];this.value='';}
  append(item){this.children.push(item);if(this.id==='scenario'){this.options.push(item);if(!this.value)this.value=item.value;}}
  setAttribute(key,value){this.attributes[key]=value;}
  click(){this.events.click?.();}
 }
 for(const id of [...shell.matchAll(/id="([^"]+)"/g)].map(m=>m[1]))elements.set(id,new E(id));
 elements.get('viewport').value='390x844';elements.get('outcome').value='success';elements.get('delay').value='0';
 const anchors=['boss-reward-save-failure','boss-reward','hunt-plus'].map(route=>({getAttribute(){return '/?qa='+route;},childNodes:[{nodeType:3,textContent:route}],querySelector(){return {textContent:'isolated fixture'};}}));
 const ctx=vm.createContext({console,URL,URLSearchParams,Set,Map,JSON,Math,Date,Number,String,Error,Promise,FOCUS,scenarioURL,isIsolatedChild,fixtureAPI,viewportSize,normalizedDelay,boundedRecord,usesHostProviderControls,location:{origin:'http://127.0.0.1:4311'},performance:{now:()=>10},
  Option:class{constructor(text,value){this.text=text;this.value=value;}},Node:{TEXT_NODE:3},ResizeObserver:class{observe(){}},
  document:{getElementById:id=>elements.get(id),createElement:()=>new E(),addEventListener(){},hidden:false},
  DOMParser:class{parseFromString(){return {querySelectorAll(){return anchors;}};}},
  fetch:async path=>({ok:true,json:async()=>({sourceInputSHA256:'test-input',mode:'WIP'}),text:async()=>html}),setInterval(){},setTimeout(){},
 });
 vm.runInContext(page.replace(/^import .*?;\n/,''),ctx);
 await new Promise(setImmediate);await new Promise(setImmediate);
 const evalCode=code=>vm.runInContext(code,ctx),frame=elements.get('game-frame');
 let actions=[],readCount=0;
 const child={location:{href:frame.src},document:{getElementById(){return null;},readyState:'complete'},innerWidth:390,innerHeight:844,
  __catPresentation(){readCount++;return {qaFixtureActive:true,localPanel:'boss',transition:{active:false}};},
  __catState(){return {mode:'boss-result',overlay:'none',diamonds:3000};},__catShopQA(){return {petCoin:20,notice:'local fixture'};},
  __catBossRewardQA(){return {pending:null,saveFailed:false,saveFailureFixture:true};},__catBossRewardFixture(...args){actions.push(args);},
 };
 frame.contentWindow=child;
 return {elements,ctx,evalCode,frame,child,actions,get reads(){return readCount;},load(){frame.events.load();}};
}
test('controller launches only QA and refuses mutations while navigation is uncommitted (fake DOM)',async()=>{
 const h=await controller();assert.match(h.frame.src,/\?qa=boss-reward-save-failure/);
 h.evalCode('inject(true)');assert.equal(h.actions.length,0);assert.match(h.elements.get('action-status').textContent,/拒绝/);
 h.load();assert.equal(h.elements.get('fail-save').disabled,false);
 h.elements.get('fail-save').click();assert.deepEqual(h.actions,[['save-failure',true]]);
 h.elements.get('allow-save').click();assert.deepEqual(h.actions.at(-1),['save-failure',false]);
});
test('controller ordinary navigation stops all reads and mutations before touching real state (fake DOM)',async()=>{
 const h=await controller();h.load();const reads=h.reads;
 h.child.location.href='http://127.0.0.1:4311/';h.evalCode('poll()');h.evalCode('inject(true)');
 assert.equal(h.reads,reads);assert.equal(h.actions.length,0);assert.equal(h.elements.get('fail-save').disabled,true);
 assert.match(h.elements.get('runtime-status').textContent,/已停止/);
});
test('controller rejects a false runtime isolation handshake (fake DOM)',async()=>{
 const h=await controller();h.child.__catPresentation=()=>({qaFixtureActive:false});h.load();h.evalCode('inject(false)');
 assert.equal(h.actions.length,0);assert.equal(h.elements.get('fail-save').disabled,true);
});
test('controller reset keeps applied route/provider configuration instead of a pending selection (fake DOM)',async()=>{
 const h=await controller();h.load();const old=h.frame.src;
 h.elements.get('scenario').value='/?qa=hunt-plus';h.elements.get('outcome').value='failure';h.elements.get('reset').click();
 assert.equal(h.frame.src,old);assert.equal(h.elements.get('fail-save').disabled,true);h.evalCode('inject(true)');assert.equal(h.actions.length,0);
});
test('controller observation records explicit snapshots, notes and unverified gates without player storage (fake DOM)',async()=>{
 const h=await controller();h.load();h.elements.get('note').value='实际按钮重试：余额只追加一次';h.elements.get('record').click();
 const record=JSON.parse(h.evalCode('JSON.stringify(records[0])'));
 assert.equal(record.before.wallet.diamonds,3000);assert.equal(record.after.wallet.diamonds,3000);assert.equal(record.observation,'实际按钮重试：余额只追加一次');
 assert.equal(record.verdict,'USER_OBSERVATION_ONLY');assert.equal(record.proofGates.automatedGUI,'NOT_RUN');assert.equal(record.configuration.route,'boss-reward-save-failure');
});

test('independent combat host uses its own provider selector, no fake shell failure or delay injection',()=>{
 for(const route of ['raid-live','hunt-live']){assert.equal(usesHostProviderControls(route),true);const url=scenarioURL('/?qa='+route,known,'failure',3000);assert.equal(new URL(url,'http://debug.invalid').searchParams.has('provider-outcome'),false);}
 assert.equal(usesHostProviderControls('hunt-client'),false);assert.match(page,/active.outcome='host-controls'/);
});
