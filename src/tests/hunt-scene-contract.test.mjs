import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Texture,settings} from 'pixi.js';
import {sourceHuntSceneViewport,sourceHuntSceneSkinKey,HUNT_SCENE_CAMERA_RIGHT,HUNT_SCENE_CAMERA_UP,HUNT_SCENE_CAMERA_FORWARD,SourceHuntSceneView} from '../hunt-scene-view';
import {createCatRigActor} from '../cat-rig';
import {SOURCE_QA_SCENARIOS} from '../r6-qa';
import {SOURCE_HUNT_LIVE_QA_ROUTES,isSourceHuntLiveQARoute} from '../hunt-qa-routes';
const scene=JSON.parse(readFileSync('src/data/hunt-scene-source.json','utf8'));
const manifest=JSON.parse(readFileSync('public/assets/cat-rig/rig.json','utf8'));
settings.ADAPTER={...settings.ADAPTER,createCanvas:()=>({getContext:()=>null})};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} != ${b}`);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const v=(x,y=0,z=0)=>({x,y,z});
test('serialized Hunt orthographic projection has unit axes, centered camera and aspect-aware scale',()=>{
 const axes=[HUNT_SCENE_CAMERA_RIGHT,HUNT_SCENE_CAMERA_UP,HUNT_SCENE_CAMERA_FORWARD];
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)near(dot(axes[i],axes[j]),i===j?1:0);
 const a=scene.camera.chain[0].position,b=scene.camera.chain[1].position,c={x:a[0]+b[0],y:a[1]+b[1],z:a[2]+b[2]};
 for(const [w,h]of [[390,844],[1080,1920]]){const center=sourceHuntSceneViewport(c,w,h);near(center.x,.5);near(center.y,.5);near(center.z,0);
 const p={x:c.x+40*axes[0].x,y:c.y+40*axes[0].y,z:c.z+40*axes[0].z};near(sourceHuntSceneViewport(p,w,h).x,.5+.5*h/w);}
 for(const [w,h]of [[0,844],[390,0],[-1,1],[NaN,1]])assert.throws(()=>sourceHuntSceneViewport(v(0),w,h));
});
test('Hunt sprites select original 10-wave pair cycle; invalid identities fail loudly',()=>{
 for(let wave=0;wave<40;wave++)for(const variant of [0,1])assert.equal(sourceHuntSceneSkinKey(wave,variant),scene.skins[2*(wave%10)+variant]);
 for(const [wave,variant]of [[-1,0],[.5,0],[NaN,0],[0,2]])assert.throws(()=>sourceHuntSceneSkinKey(wave,variant));
});
test('strict Transform getter and immediate facing do not advance animation, recoil or procedural hand/face lerp',()=>{
 const actor=createCatRigActor({manifest,textures:new Map(manifest.layers.map(l=>[l.sprite,Texture.EMPTY]))},{weaponId:20});
 try{assert.throws(()=>actor.getTransformWorld(manifest.guns[20].shoot));assert.throws(()=>actor.faceTowardEnemy(v(1)));
 actor.update({dtSeconds:.035,moving:true,rootWorld:v(-100),aimWorld:v(-90,4,4),targetWorld:v(-90,4,4),camera:{forward:HUNT_SCENE_CAMERA_FORWARD}});
 const before=actor.debugPose(),hand=new Map(actor.proceduralRotations);const angle=actor.nativeHandZ;
 const first=actor.getTransformWorld(manifest.guns[20].shoot);assert.deepEqual(first,actor.getShootRawWorld());assert.throws(()=>actor.getTransformWorld(-1),/Unbound/);
 actor.faceTowardEnemy(v(-120,4,-4));const after=actor.debugPose();
 assert.equal(after.timeSeconds,before.timeSeconds);assert.equal(after.clip,before.clip);assert.equal(after.recoilTime,before.recoilTime);assert.deepEqual(after.nativeAim,before.nativeAim);assert.equal(actor.nativeHandZ,angle);assert.deepEqual(actor.proceduralRotations,hand);
 assert.notEqual(after.facing,before.facing);assert.notDeepEqual(actor.getTransformWorld(manifest.guns[20].shoot),first);
 }finally{actor.destroy();}
});
test('live view cleanup is idempotent; late preparation may not resurrect destroyed containers',()=>{
 const view=new SourceHuntSceneView({cats:[]},390,844);view.destroy();view.destroy();assert.equal(view.ready,false);assert.equal(view.root.destroyed,true);
});
test('same-build Hunt bootstrap and QA registry stay aligned and do not load ordinary main/save on explicit Hunt routes',()=>{
 for(const route of SOURCE_HUNT_LIVE_QA_ROUTES){assert.ok(SOURCE_QA_SCENARIOS.includes(route));assert.equal(isSourceHuntLiveQARoute(route),true);}
 for(const route of [null,'','mine','hunt','hunt-live-invalid'])assert.equal(isSourceHuntLiveQARoute(route),false);
 const bootstrap=readFileSync('src/bootstrap.ts','utf8'),qa=readFileSync('src/hunt-live-qa.ts','utf8');
 assert.match(bootstrap,/if\(isSourceHuntLiveQARoute\(route\)\)/);assert.match(bootstrap,/else import\('\.\/main'\)/);
 assert.doesNotMatch(qa.replace(/\/\*[\s\S]*?\*\//g,''),/localStorage\s*(?:\.|\[)|from ['"]\.\/main['"]/);assert.match(qa,/decodeSourceMetaState\(JSON\.stringify\(raw\.meta\)\)/);
 assert.match(readFileSync('index.html','utf8'),/src\/bootstrap\.ts/);
});
