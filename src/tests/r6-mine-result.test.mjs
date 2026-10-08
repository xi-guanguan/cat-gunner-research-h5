import test from 'node:test';
import assert from 'node:assert/strict';
import {mineSettlement} from '../meta-progression.ts';
import {sourceMineResultReward} from '../r6-mine-result.ts';
import {sourceResultContext,sourceResultContextMatches} from '../r6-result-context.ts';
import {createSession,serializeSession,deserializeSession,openMine,startMine,step} from '../session.ts';
import {freshSourceMetaState} from '../source-meta-runtime.ts';
function fixture(kind='mine',auto=false){const value=mineSettlement({diaScore:300,bestReward:0,automaticBonus:auto}).value;return {diamonds:value.initialReward,settlement:kind==='mine'?value:null,sweep:kind==='sweep'?{rewardValue:30,initialReward:value.initialReward,totalReward:value.totalReward,automaticBonus:auto,bonusClaimed:auto,pending:true}:null,sweepSequence:4,claims:[]};}
function request(kind='mine'){return {id:'result-ad:123',kind:'ad',purpose:kind==='mine'?'mine:bonus':'mine-sweep:bonus',resultKind:kind,sweepSequence:4};}
function response(r,status='success'){return {...r,status,provider:'local-test',onlineVerified:false};}
for(const kind of ['mine','sweep']){
 test(`${kind}: local callback adds exactly 3x once, preserves other state, ledger survives JSON`,()=>{
  const s=fixture(kind),r=request(kind),res=sourceMineResultReward(s,r,response(r));assert.equal(res.status,'granted');assert.equal(res.amount,90);assert.equal(res.state.diamonds,120);assert.equal(s.diamonds,30);assert.deepEqual(s.claims,[]);
  const terminal=kind==='mine'?res.state.settlement:res.state.sweep;assert.equal(terminal.bonusClaimed,true);assert.equal(terminal.totalReward,120);if(kind==='sweep')assert.equal(terminal.pending,false);
  const saved=JSON.parse(JSON.stringify(res.state));assert.equal(sourceMineResultReward(saved,r,response(r)).status,'duplicate');assert.equal(sourceMineResultReward(saved,{...r,id:'second-request'},response({...r,id:'second-request'})).status,'blocked');
 });
 test(`${kind}: failure/cancelled/unavailable and mismatched callbacks do not mutate or mark ledger`,()=>{
  const s=fixture(kind),r=request(kind);for(const status of ['failure','cancelled','unavailable']){const res=sourceMineResultReward(s,r,response(r,status));assert.equal(res.state,s);assert.equal(res.amount,0);assert.equal(res.status,'blocked');}
  for(const patch of [{id:'other'},{purpose:'other'},{kind:'purchase'},{provider:'online'},{onlineVerified:true}])assert.equal(sourceMineResultReward(s,r,{...response(r),...patch}).state,s);
  for(const patch of [{purpose:'other'},{kind:'purchase'}]){const wrong={...r,...patch};assert.equal(sourceMineResultReward(s,wrong,response(wrong)).status,'blocked');}
 });
 test(`${kind}: automatic 4x cannot be rewarded again; overflow cannot partially commit`,()=>{
  const s=fixture(kind,true),r=request(kind);assert.equal(s.diamonds,120);assert.equal(sourceMineResultReward(s,r,response(r)).state,s);
  const overflow={...fixture(kind),diamonds:Number.MAX_SAFE_INTEGER-10};assert.throws(()=>sourceMineResultReward(overflow,r,response(r)),RangeError);assert.deepEqual(overflow.claims,[]);assert.equal(overflow.diamonds,Number.MAX_SAFE_INTEGER-10);
 });
}
test('sweep batch changed or closed and missing mine settlement cannot grant',()=>{
 const s=fixture('sweep'),r=request('sweep');assert.equal(sourceMineResultReward({...s,sweepSequence:5},r,response(r)).status,'blocked');assert.equal(sourceMineResultReward({...s,sweep:{...s.sweep,pending:false}},r,response(r)).status,'blocked');const m=fixture();assert.equal(sourceMineResultReward({...m,settlement:null},request(),response(request())).status,'blocked');
});
test('mine result context owns exact settlement; exit, reload and transitions revoke callback',()=>{
 let session=createSession(2);const meta=freshSourceMetaState();assert.equal(sourceResultContext(session,meta),null);session.historicMax=30;session.overlay="none";session=startMine(openMine(session),{today:()=>"2026-10-02",canRolloverDaily:()=>true});session.mine.run.score=300;session.mine.run.elapsed=59.99;session.battle.elapsed=59.99;session=step(session,.02,undefined,undefined,meta.entitlements);assert.equal(session.mode,'mine-result');const context=sourceResultContext(session,meta);assert.equal(context.kind,'mine');assert.equal(sourceResultContextMatches(context,session,meta,false),true);assert.equal(sourceResultContextMatches(context,session,meta,true),false);assert.equal(sourceResultContextMatches(context,deserializeSession(serializeSession(session)),meta,false),false);assert.equal(sourceResultContextMatches(context,{...session,mode:'field'},meta,false),false);assert.equal(sourceResultContextMatches(context,{...session,mine:{...session.mine,settlement:{...session.mine.settlement}}},meta,false),false);
});
test('mine sweep ownership rejects closed/replaced batch even when numeric reward is identical',()=>{
 const session=createSession(2),meta={...freshSourceMetaState(),sweep:fixture('sweep').sweep,sweepSequence:4};session.mode='field';session.overlay='mine';const c=sourceResultContext(session,meta);assert.equal(c.kind,'mine-sweep');assert.equal(sourceResultContextMatches(c,session,meta,false),true);for(const patch of [{sweepSequence:5},{sweep:{...meta.sweep,pending:false}},{sweep:{...meta.sweep}}])assert.equal(sourceResultContextMatches(c,session,{...meta,...patch},false),false);assert.equal(sourceResultContextMatches(c,{...session,overlay:'none'},meta,false),false);
});
test('challenge contexts include failure, victory and sweep only and retain run identity',()=>{
 const session=createSession(2),meta=freshSourceMetaState();session.challengeRunID='challenge:123';for(const [mode,overlay]of [['victory','none'],['defeat','none'],['field','challenge-sweep']]){session.mode=mode;session.overlay=overlay;const c=sourceResultContext(session,meta);assert.equal(c.kind,'challenge');assert.equal(sourceResultContextMatches(c,session,meta,false),true);assert.equal(sourceResultContextMatches(c,{...session,challengeRunID:'other'},meta,false),false);}session.mode='challenge';session.overlay='none';assert.equal(sourceResultContext(session,meta),null);
});

test('Boss result async purchase owns exact run across exit/reload/transition, not just matching reward amount',()=>{
 const session=createSession(2),meta=freshSourceMetaState();assert.equal(sourceResultContext({...session,mode:'boss'},meta),null);
 // Runtime-reference ownership fixture; Boss state rules are verified separately.
 const run={phase:'won',mode:'fight'},result={...session,mode:'boss-result',boss:{...session.boss,run}};
 const c=sourceResultContext(result,meta);assert.equal(c.kind,'boss');assert(sourceResultContextMatches(c,result,meta,false));
 for(const s of [{...result,mode:'field'},{...result,boss:{...result.boss,run:{...run}}},{...result,boss:{...result.boss,run:null}}])assert(!sourceResultContextMatches(c,s,meta,false));
 assert(!sourceResultContextMatches(c,result,meta,true));
});
