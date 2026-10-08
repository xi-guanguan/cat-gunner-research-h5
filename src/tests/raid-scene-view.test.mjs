// STATIC/MODEL ONLY; real browser/device claims require separate evidence.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {settings} from 'pixi.js';
import {sourceRaidCameraFollowPosition,sourceRaidSceneViewport} from '../raid-camera-follow';
import {SOURCE_RAID_SCENE,sourceRaidChainPoint,sourceRaidScenePieces} from '../raid-scene-geometry';
import {SourceRaidSceneView} from '../raid-scene-view';
import {SourceRaidBattleRuntime} from '../raid-battle-runtime';
import {SourceRaidCatRuntime} from '../raid-cat-runtime';
import {sourceRaidCandidates} from '../r6-raid';import {createSession,sourceGun} from '../session';
import {freshSourceMetaState} from '../source-meta-runtime';import {createActivityState} from '../source-activities';import {freshPlatformState} from '../local-platform';
import {isSourceRaidLiveQARoute,SOURCE_RAID_LIVE_QA_ROUTES} from '../raid-live-qa-routes';
settings.ADAPTER={...settings.ADAPTER,createCanvas:()=>({getContext:()=>null})};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function setup(){const s=createSession(1);s.equippedGuns=[30,24,29].map((id,i)=>({...sourceGun(id),uid:`view-${i}`}));const b={session:s,meta:freshSourceMetaState(),activities:createActivityState(),platform:freshPlatformState()},selection=sourceRaidCandidates(s),host=new SourceRaidBattleRuntime('view-model',2,false),view=new SourceRaidSceneView(host,b,selection,0,390,844);return {host,view,b,selection};}
test('mode5 camera/native hash matches imported scene and targets the true leader, never first serialized AI',()=>{
 const source=JSON.parse(readFileSync('src/data/raid-camera-source.json','utf8'));assert.equal(source.sceneSha256,SOURCE_RAID_SCENE.sceneSha256);assert.equal(source.nativeSha256,SOURCE_RAID_SCENE.nativeSha256);assert.equal(source.follow.targetCatComponentID,147400);assert.equal(source.follow.targetTransformID,44677);
 const leader={componentID:147400,movement:{position:{x:-98,y:3,z:5}}},ai={componentID:136808,movement:{position:{x:900,y:900,z:900}}};const p=sourceRaidCameraFollowPosition([ai,leader]);assert.deepEqual(p,leader.movement.position);assert.notEqual(p,leader.movement.position);assert.throws(()=>sourceRaidCameraFollowPosition([ai]),/147400.*44677/);
 const a=sourceRaidSceneViewport(p,390,844,p),moved={x:p.x+11,y:p.y-2,z:p.z-3},b=sourceRaidSceneViewport(moved,390,844,moved);near(a.x,b.x);near(a.y,b.y);assert.throws(()=>sourceRaidSceneViewport(p,0,844,p),/Invalid/);
});
test('all five source skins contain exactly ground plus four original parts; inactive alternatives are excluded',()=>{
 const ids=new Set();for(let skin=0;skin<5;skin++){const pieces=sourceRaidScenePieces(skin);assert.equal(pieces.length,5);assert.equal(pieces.filter(p=>p.object.path.includes('Ground')).length,1);assert.equal(pieces.filter(p=>p.object.path.includes(`/Bounce/${skin}/`)).length,4);for(const p of pieces){assert.ok(SOURCE_RAID_SCENE.sprites[p.renderer.spriteKey]);ids.add(p.renderer.spriteKey);}}
 assert.equal(ids.size,21);for(const n of [-1,5,NaN,1.1])assert.throws(()=>sourceRaidScenePieces(n),/Invalid/);
 const chain=sourceRaidScenePieces(0)[0].object.transformChain;assert.deepEqual(sourceRaidChainPoint(chain,{x:0,y:0,z:0}),{x:-100,y:0,z:0});
 // Noncommuting TRS catches the wrong root-to-leaf order (source is leaf-first).
 const p=sourceRaidChainPoint([{id:1,name:'leaf',position:[1,0,0],scale:[1,1,1],rotation:[0,0,0,1]},{id:2,name:'parent',position:[10,0,0],scale:[2,2,2],rotation:[0,0,0,1]}],{x:1,y:0,z:0});assert.deepEqual(p,{x:14,y:0,z:0});
});
test('source layer7 Boss participates in masked obstacle paths; no unconditional-clear shortcut',()=>{
 const s=setup();s.host.start(s.b.meta.raid);const a=s.view.adapter(),origin={x:-150,y:Math.fround(4.55),z:20},d={x:1,y:0,z:0};assert.equal(a.movement.pathClear(origin,d,50,129),false);assert.equal(a.movement.pathClear(origin,d,10,129),true);assert.equal(a.movement.pathClear(origin,d,50,1),true);s.view.destroy();
});
test('live Follow works from a start-in-eco bound runtime without ever calling render',()=>{
 const s=setup(),cats=new SourceRaidCatRuntime(s.host,s.b,s.selection,{slot5d5d4d0Static20:100,slot5d5d4d8Static60:0},s.view.followSettings());s.view.bindCats(cats);s.view.setPresentationEnabled(false);const leader=cats.cats.find(c=>!c.isAI);leader.movement.position={x:-75,y:2,z:8};assert.deepEqual(s.view.cameraRoot,leader.movement.position);assert.equal(s.view.root.visible,false);assert.equal(s.view.projectionState().rng,'local-test-xorshift32');assert.throws(()=>s.view.resize(0,10),/Invalid/);s.view.destroy();
});
test('live QA exact allowlist/bootstrap blocks ordinary save reads and no injected score/force-end controls',()=>{
 for(const route of SOURCE_RAID_LIVE_QA_ROUTES)assert.equal(isSourceRaidLiveQARoute(route),true);for(const route of [null,'raid-live-fake','raid-live/','raid'])assert.equal(isSourceRaidLiveQARoute(route),false);
 const qa=readFileSync('src/raid-live-qa.ts','utf8'),boot=readFileSync('src/bootstrap.ts','utf8');assert.match(boot,/isSourceRaidLiveQARoute/);assert.doesNotMatch(qa,/localStorage|sessionStorage|\.host\.emit\(|\.host\.end\(/);assert.match(qa,/new SourceRaidClientOwner/);assert.match(qa,/new SourceRaidCatClientScene/);
});

import {sourceRaidHUDCurrency} from '../raid-hud-state';
import {createFieldLevel} from '../session';
test('Raid source Currency reads Money/Dia, never StarGem or a provider label',()=>{
 const s=createSession(1);s.battle=createFieldLevel(0,0,1234);s.diamonds=567;s.starGem=999;
 assert.deepEqual(sourceRaidHUDCurrency(s),{money:'1230',diamonds:'567'});
 s.fieldBattle=createFieldLevel(0,0,42);s.starGem=111;assert.deepEqual(sourceRaidHUDCurrency(s),{money:'42',diamonds:'567'});
 const qa=readFileSync('src/raid-live-qa.ts','utf8');assert.match(qa,/sourceRaidHUDCurrency\(bundle.session\)/);
});
