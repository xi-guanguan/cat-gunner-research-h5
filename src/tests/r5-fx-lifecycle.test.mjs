import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Assets,Texture,settings} from 'pixi.js';
import {projectileEmissionSegment,loadProjectileViewAssets,createProjectileView,createMuzzleView,advanceProjectileView,stopProjectileView} from '../projectile-view.ts';
import {createCatRigActor} from '../cat-rig.ts';
const contract=JSON.parse(readFileSync('src/data/projectile-presentation.json','utf8'));
const muzzle=JSON.parse(readFileSync('src/data/fx-muzzle-presentation.json','utf8'));
const rig=JSON.parse(readFileSync('public/assets/cat-rig/rig.json','utf8'));
const normal=contract.particles['level0:68367'];
// Geometry rules run without a GPU; no raster/render quality claim is made.
settings.ADAPTER={...settings.ADAPTER,createCanvas:()=>({getContext:()=>null})};
const v=(x,y=0,z=0)=>({x,y,z});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('Normal source has distance4 only, partitions world distance without emitting while idle',()=>{
  assert.equal(normal.emission.rateOverTime.scalar,0);assert.equal(normal.emission.bursts.length,0);assert.equal(normal.emission.rateOverDistance.scalar,4);
  const idle=projectileEmissionSegment(normal,0,.05,v(0),v(0));assert.equal(idle.births.length,0);
  const a=projectileEmissionSegment(normal,0,.02,v(0),v(.1));assert.equal(a.births.length,0);close(a.distanceRemainder,.4);
  const b=projectileEmissionSegment(normal,.02,.04,v(.1),v(.5),a.distanceRemainder);
  assert.equal(b.births.length,2);close(b.births[0].world.x,.25);close(b.births[1].world.x,.5);close(b.distanceRemainder,0);
  const one=projectileEmissionSegment(normal,0,.04,v(0),v(.5));assert.deepEqual(one.births.map(b=>b.world),b.births.map(b=>b.world));
});
test('source time births retain all live SemiCircles and do not invent a stationary beam',()=>{
  for(const [ids,name] of [[[17,19],'3_Laser'],[[21,23],'4_Laser'],[[25,27],'5_Laser']])for(const id of ids){
    const template=contract.templates[contract.gunBindings[id].templateKey];assert.equal(template.name,name);
    const ring=template.bodyParticleKeys.map(k=>contract.particles[k]).find(p=>p.name==='Ring');assert.equal(ring.simulationSpace,0);
    const semi=template.bodyParticleKeys.map(k=>contract.particles[k]).find(p=>p.name==='SemiCircles');assert.equal(semi.simulationSpace,1);
    const births=projectileEmissionSegment(semi,0,.2,v(0),v(14));assert.equal(births.births.length,6);
    close(births.births[0].world.x,70/30);close(births.births[5].world.x,14);
  }
});
test('same-timestamp measured path emits distance births, with no invented time emission',()=>{
  const path=projectileEmissionSegment(normal,0,0,v(0),v(1));assert.equal(path.births.length,4);
  assert.deepEqual(path.births.map(b=>b.localSeconds),[0,0,0,0]);assert.deepEqual(path.births.map(b=>b.world.x),[.25,.5,.75,1]);
});
test('65 Muzzle subtrees bind exact shoot and muzzle transforms, source counts and existing textures',()=>{
  assert.equal(muzzle.gunBindings.length,65);assert.equal(Object.keys(muzzle.particles).length,130);
  for(const b of muzzle.gunBindings){const source=rig.guns[b.gunNum];assert.equal(b.shootTransformID,source.shoot);assert.equal(b.muzzleTransformID,source.muzzle);
    const template=muzzle.templates[b.templateKey];assert.equal(template.allParticleKeys.length,2);
    for(const k of template.allParticleKeys){const p=muzzle.particles[k];assert.equal(p.emission.rateOverTime.scalar,0);assert.equal(p.emission.bursts[0].time,0);assert.ok(p.emission.bursts[0].count.scalar>0);
      for(const mk of p.renderer.materialKeys)for(const tx of Object.values(muzzle.materials[mk].textures))assert.doesNotThrow(()=>readFileSync(`public${muzzle.textures[tx.textureKey].url}`));}
  }
});
test('actual Sprite instances preserve world tails, local Ring, muzzle bursts and post-death draining',async()=>{
  const get=Assets.get,load=Assets.load,fetch=globalThis.fetch;
  Assets.get=()=>Texture.EMPTY;Assets.load=async()=>{};
  globalThis.fetch=async url=>({ok:true,status:200,json:async()=>structuredClone(contract),text:async()=>readFileSync(`public${url}`,'utf8')});
  try{await loadProjectileViewAssets();
    const view=createProjectileView(0,0,15,{seed:11,rootWorldPosition:v(0)});assert.equal(view.presentation.liveParticleCount,0);
    advanceProjectileView(view,{ageSeconds:.04,rootWorldPosition:v(4)},15);assert.equal(view.presentation.liveParticleCount,46);
    assert.deepEqual(Object.fromEntries(view.presentation.selectedParticleKeys.map(k=>[contract.particles[k].name,view.children.filter(s=>s.name===k).length])),{'0_Normal':16,SparkTrail:4,Glow:10,Normal:16});
    const oldest=view.children[0];close(oldest.x,-3.75*15);
    advanceProjectileView(view,{ageSeconds:.06,rootWorldPosition:v(6)},15);assert.equal(view.presentation.liveParticleCount,69);close(oldest.x,-5.75*15);
    stopProjectileView(view,.06,15,v(6));assert.equal(view.presentation.completed,false);
    advanceProjectileView(view,{ageSeconds:.10,rootWorldPosition:v(6)},15);assert.ok(view.presentation.liveParticleCount>0);assert.ok(view.presentation.liveParticleCount<69);
    advanceProjectileView(view,{ageSeconds:.15,rootWorldPosition:v(6)},15);assert.ok(view.children.some(s=>s.visible&&s.name==='level0:71567'));
    advanceProjectileView(view,{ageSeconds:.4,rootWorldPosition:v(6)},15);assert.equal(view.presentation.liveParticleCount,0);assert.equal(view.presentation.completed,true);
    const same=createProjectileView(0,0,15,{seed:12,rootWorldPosition:v(0)});stopProjectileView(same,0,15,v(1));assert.equal(same.presentation.liveParticleCount,11);
    advanceProjectileView(same,{ageSeconds:.31,rootWorldPosition:v(1)},15);assert.equal(same.presentation.completed,true);
    const laser=createProjectileView(17,0,15,{seed:13,rootWorldPosition:v(0)});assert.equal(laser.presentation.liveParticleCount,1);
    advanceProjectileView(laser,{ageSeconds:.2,rootWorldPosition:v(14)},15);assert.equal(laser.presentation.liveParticleCount,126);
    assert.deepEqual(Object.fromEntries(laser.presentation.selectedParticleKeys.map(k=>[contract.particles[k].name,laser.children.filter(s=>s.name===k).length])),{'3_Laser':56,Trail:56,SemiCircles:6,Ring:1,SparkTrail:7});
    const ring=laser.children.find(s=>s.name==='level0:73379');close(ring.x,0);
    const semicircles=laser.children.filter(s=>s.name==='level0:70645');assert.equal(semicircles.length,6);assert.ok(new Set(semicircles.map(s=>s.x.toFixed(3))).size>1);
    stopProjectileView(laser,.2,15,v(14));assert.equal(laser.children.some(s=>s.name==='level0:73379'||s.name==='level0:70645'),false);
    assert.ok(laser.children.some(s=>s.visible&&s.name==='level0:69252'));assert.equal(laser.presentation.completed,false);
    advanceProjectileView(laser,{ageSeconds:.51,rootWorldPosition:v(14)},15);assert.equal(laser.presentation.completed,true);
    const flash=createMuzzleView(0,0,15,{seed:15,rootWorldPosition:v(0),rootScaleWorld:v(.55,.55,.55)});
    assert.equal(flash.presentation.kind,'muzzle');assert.equal(flash.presentation.liveParticleCount,14);assert.ok(flash.presentation.suggestedDurationSeconds<=.40001);
    advanceProjectileView(flash,{ageSeconds:.5,rootWorldPosition:v(0)},15);assert.equal(flash.presentation.completed,true);
  }finally{Assets.get=get;Assets.load=load;globalThis.fetch=fetch;}
});
test('rig exposes distinct Shoot and Muzzle source APIs and inherits parent scale once',()=>{
  const textures=new Map(rig.layers.map(l=>[l.sprite,Texture.EMPTY]));const actor=createCatRigActor({manifest:rig,textures},{weaponId:0});
  actor.update({dtSeconds:0,moving:false,rootWorld:v(0),camera:{forward:v(0,-.7,.7)},immediateAim:true});
  assert.deepEqual(actor.getShootRawWorld(),actor.getMuzzleRawWorld()); // zero serialized Muzzle translation
  const effect=actor.getMuzzleEmissionTransform();const gunNode=rig.nodes.find(n=>n.id===rig.guns[0].node);close(effect.rootScaleWorld.x,rig.source.unityRootScale*gunNode.scale[0]);close(effect.rootScaleWorld.y,rig.source.unityRootScale*gunNode.scale[1]);
  assert.equal(effect.rootRotation.length,4);assert.ok(effect.rootRotation.every(Number.isFinite));actor.destroy();
});
