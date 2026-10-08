// STATIC/MODEL only; original store/device/human proof is NOT_RUN.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SOURCE_RAID_HELPER as source,sourceRaidHelperActive,sourceRaidHelperGun,sourceRaidHelperStars,sourceRaidHelperGate,sourceRaidHelperRequest,sourceRaidHelperReward} from '../r6-raid-helper';
import {SourceRaidHelperClient} from '../raid-helper-client';
import {sourceRaidHelperSlot,sourceRaidHelperPopup,sourceRaidHelperPanelBindings} from '../raid-helper-ui-state';
import {freshSourceRaid,decodeSourceRaid,sourceRaidSeason,sourceRaidCandidates} from '../r6-raid';
import {sourceUiTree,solveSourceUiLayout} from '../source-ui';import {sourceRaidPanelBindings} from '../source-raid-panel';
import {createSession,sourceGun} from '../session';import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {bindSourceRaidEquipment} from '../raid-equipment-binding';import {sourceRaidCatDamage,sessionRaidModifiers} from '../raid-cat-balance';
import {SOURCE_HUNT_RIG_NODE_OVERRIDES,sourceHuntCanonicalTransform} from '../hunt-equipment-binding';import {sourceHuntGunSockets} from '../hunt-gun-sockets';
const fresh=()=>({...freshSourceRaid(),seasonIndex:7}),request=(s,id='helper')=>sourceRaidHelperRequest(s,390,id),response=(r,status='success')=>({...r,status,provider:'local-test',onlineVerified:false});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),get resolve(){return resolve;}};};
function client(o={}){let state=o.state??fresh(),contextID='A',historicMax=390,fail=false,seq=0;const requests=[],writes=[],notices=[];const owner=new SourceRaidHelperClient({read:()=>({state,contextID,historicMax}),write(s){if(fail)throw Error('quota');writes.push(s);state=s;},execute(r){requests.push(r);return o.execute?.(r)??Promise.resolve(response(r,o.outcome??'success'));},requestID:()=>`local:${++seq}`,notice:m=>notices.push(m)});return {owner,writes,requests,notices,get state(){return state;},set state(v){state=v;},set contextID(v){contextID=v;},set historicMax(v){historicMax=v;},set fail(v){fail=v;}};}
test('source product/default price/array, every weak type maps50..54 without owned inventory',()=>{
 assert.equal(source.product,'catgunner_raid_helper');assert.equal(source.defaultPrice,'$3.99');assert.deepEqual(source.gunTypeCodes,[2,4,1,5,6,0,3]);assert.deepEqual(source.storedFormationOffset,[0,0,0]);assert.deepEqual(source.warpOffset,[7,0,-7]);
 assert.deepEqual(Array.from({length:7},(_,i)=>sourceRaidHelperGun(i)),[54,52,50,54,51,53,54]);for(const v of [-1,7,NaN,1.5])assert.throws(()=>sourceRaidHelperGun(v));
});
test('minimum across all three slots, including empty selections; no invented fourth upgrade',()=>{
 assert.equal(sourceRaidHelperStars([3,1,5]),1);assert.equal(sourceRaidHelperStars([20,20,0]),0);assert.equal(sourceRaidHelperStars(undefined),0);assert.equal(sourceRaidHelperStars([]),0);for(const v of [[1,2],[1,2,21],[1,-1,2],[1,.5,2]])assert.throws(()=>sourceRaidHelperStars(v));
 const button=source.buttons.find(b=>b.id==='level0:36993');assert.equal(button.targetPathID,0);assert.equal(button.method,'onClick_StarUpgrade');assert.equal(sourceRaidPanelBindings().find(b=>b.id===button.id).action,'raid-source-orphan');
});
test('save migration empty claims never grants helper or mutates old currency/equipment',()=>{
 const m=freshSourceMetaState(),s={...fresh(),helperSeasonIndex:6};delete s.helperClaims;m.raid=s;const raw=serializeSourceMetaState(m),next=decodeSourceMetaState(raw);assert.deepEqual(next.raid.helperClaims,[]);assert.equal(next.raid.helperSeasonIndex,6);assert.equal(sourceRaidHelperActive(next.raid),false);assert.equal(next.petCoin,m.petCoin);for(const claims of [['x','x'],[''],[7]])assert.throws(()=>decodeSourceRaid({...fresh(),helperClaims:claims}));
 const own={...fresh(),helperSeasonIndex:7};assert.equal(sourceRaidHelperActive(own),true);const rolled=sourceRaidSeason(own,new Date(2026,9,3));assert.equal(rolled.helperSeasonIndex,7);assert.equal(sourceRaidHelperActive(rolled),false);assert.equal(sourceRaidHelperActive(freshSourceRaid()),false);
});
test('source progress and current-season owned gate, local callback IDs/status/season cannot bypass',()=>{
 assert.match(sourceRaidHelperGate(fresh(),389),/40/);assert.equal(request(fresh(),' '),null);assert.equal(sourceRaidHelperRequest(fresh(),389,'x'),null);assert.match(sourceRaidHelperGate({...fresh(),helperSeasonIndex:7},390),/已购买/);
 const r=request(fresh());for(const status of ['failure','cancelled','unavailable'])assert.equal(sourceRaidHelperReward(fresh(),r,response(r,status),390).status,'blocked');
 for(const bad of [{...r,id:'other'},{...r,purpose:'other'},{...r,kind:'ad'},{...r,seasonIndex:8}])assert.equal(sourceRaidHelperReward(fresh(),bad,response(r),390).status,'blocked');
 const grant=sourceRaidHelperReward(fresh(),r,response(r),390);assert.equal(grant.status,'granted');assert.equal(grant.state.helperSeasonIndex,7);assert.deepEqual(grant.state.helperClaims,['helper']);assert.equal(sourceRaidHelperReward(grant.state,r,response(r),390).status,'blocked');assert.equal(sourceRaidHelperReward(fresh(),r,{...response(r),onlineVerified:true},390).status,'blocked');
});
test('client failed/cancel/unavailable/transport no entitlement, duplicate clicks one request',async()=>{
 for(const outcome of ['failure','cancelled','unavailable']){const c=client({outcome});assert.equal(await c.owner.purchase(),false);assert.equal(c.writes.length,0);assert.equal(c.state.helperSeasonIndex,-1);assert.equal(c.owner.pending,false);}
 const err=client({execute:()=>Promise.reject(Error('transport'))});assert.equal(await err.owner.purchase(),false);assert.equal(err.owner.pending,false);
 const d=deferred(),c=client({execute:()=>d.promise}),pending=c.owner.purchase();assert.equal(c.owner.pending,true);assert.equal(await c.owner.purchase(),false);assert.equal(c.requests.length,1);d.resolve(response(c.requests[0]));assert.equal(await pending,true);assert.equal(c.writes.length,1);assert.equal(await c.owner.purchase(),false);
});
test('late context/reset/weekly/claimed callbacks never grant in another save or week',async()=>{
 for(const change of ['context','reset','week','claims']){const d=deferred(),c=client({execute:()=>d.promise}),p=c.owner.purchase();if(change==='context')c.contextID='B';if(change==='reset')c.owner.invalidate();if(change==='week')c.state={...c.state,seasonIndex:8};if(change==='claims')c.state={...c.state,helperClaims:[c.requests[0].id]};d.resolve(response(c.requests[0]));assert.equal(await p,false);assert.equal(c.writes.length,0);assert.equal(c.state.helperSeasonIndex,-1);}
});
test('atomic save failure retries same callback without a second transaction; stale retry rejected',async()=>{
 const c=client();c.fail=true;assert.equal(await c.owner.purchase(),false);assert.equal(c.owner.saveFailed,true);assert.equal(c.state.helperSeasonIndex,-1);c.fail=false;assert.equal(c.owner.retrySave(),true);assert.equal(c.state.helperSeasonIndex,7);assert.equal(c.requests.length,1);assert.equal(c.owner.retrySave(),false);
 const d=client();d.fail=true;await d.owner.purchase();d.fail=false;d.state={...d.state,seasonIndex:8};assert.equal(d.owner.retrySave(),false);assert.equal(d.writes.length,0);
});
test('helper bound as fourth true Cat with own source sockets/rig, no false UID or star slot',()=>{
 const session=createSession();session.equippedGuns=[30,31,32].map((id,i)=>({...sourceGun(id),uid:`selected:${i}`}));session.bossSlotLevels=[3,1,5];const meta=freshSourceMetaState();meta.raid={...fresh(),helperSeasonIndex:7};const b={session,meta},selection=sourceRaidCandidates(session),before=JSON.stringify(session);
 for(const selected of [selection,[selection[0],null,selection[2]],[null,null,selection[2]]]){const rows=bindSourceRaidEquipment(b,selected,2),helper=rows.at(-1);assert.equal(rows.length,selected.filter(Boolean).length+1);assert.equal(helper.componentID,136810);assert.equal(helper.role,'helper');assert.equal(helper.selectionSlot,null);assert.equal(helper.selected,null);assert.equal(helper.slotNum,-1);assert.equal(helper.gun.gunNum,50);assert.equal(helper.gun.starLevel,1);assert.deepEqual(helper.position,{x:-93,y:0,z:-7});assert.deepEqual(helper.formationOffset,{x:0,y:0,z:0});assert.deepEqual(helper.damage,sourceRaidCatDamage({...sessionRaidModifiers(session,meta),baseDamage:helper.gun.baseDamage,gunType:2,weakType:2,starLevel:1}));
  const map=SOURCE_HUNT_RIG_NODE_OVERRIDES.find(c=>c.catComponentID===136810);assert.ok(map);const socket=sourceHuntGunSockets(136810,50);assert.ok(sourceHuntCanonicalTransform(136810,socket.shoot));}
 assert.equal(JSON.stringify(session),before);meta.raid.helperSeasonIndex=6;assert.equal(bindSourceRaidEquipment(b,selection,2).length,3);
});
test('original popup all enabled buttons bound and Demo remains disabled; source min stars projected',()=>{
 const bindings=new Map(sourceRaidHelperPanelBindings.map(b=>[b.id,b]));const root='/Canvas/Contents_UI/Raid_UI/Helper_Purchase_Popup';const buttons=sourceUiTree.nodes.filter(n=>n.path.startsWith(root+'/')&&n.components.some(c=>c.kind==='Button'&&c.enabled!==false));assert.equal(buttons.length,3);for(const b of buttons)assert.ok(bindings.has(b.id),b.path);assert.equal(sourceUiTree.nodes.find(n=>n.id==='level0:17916').components.find(c=>c.kind==='Button').enabled,false);
 const session={...createSession(),bossSlotLevels:[3,1,5]},s={...fresh(),helperSeasonIndex:7};assert.equal(sourceRaidHelperSlot(s,session,2).text['level0:3604'],'1');assert.equal(sourceRaidHelperPopup(s,2,390).active['level0:275'],true);assert.equal(sourceRaidHelperPopup(s,2,390).active['level0:58'],false);
 const ids=new Map(sourceUiTree.nodes.map(n=>[n.id,n])),active={};let n=ids.get('level0:171');while(n){active[n.id]=true;n=ids.get(n.parent);}for(const [width,height]of [[390,844],[1080,1920]]){const layouts=solveSourceUiLayout(sourceUiTree,{width,height},{active});for(const b of bindings.values()){const p=layouts.get(b.id);assert.ok(p.active&&p.width>0&&p.height>0);}}
 const main=readFileSync('src/main.ts','utf8');assert.match(main,/ready:true/);assert.match(main,/new SourceRaidClientOwner/);assert.match(main,/void enterLiveRaid\(\)/);assert.match(main,/case 'raid-helper-purchase'/);assert.match(main,/raidHelperClient.invalidate/);
});
