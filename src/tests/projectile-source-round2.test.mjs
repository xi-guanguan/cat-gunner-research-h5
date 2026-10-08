import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleProjectileParticle,projectileBurstBirths,projectileMaterialBlend,shouldPresentProjectileParticle,evaluateProjectileCurve} from '../projectile-view.ts';
const data=JSON.parse(readFileSync('src/data/projectile-presentation.json','utf8'));
const raw=JSON.parse(readFileSync('artifacts/evidence/projectile-visuals-20260930/particle-source.json','utf8'));
const root=data.particles['level0:67675'],glow=data.particles['level0:68688'];

test('normal hit schedules native six sparks plus one glow, keeping extracted 3.3 world size',()=>{
  assert.deepEqual(projectileBurstBirths(root),Array(6).fill(0));
  assert.deepEqual(projectileBurstBirths(glow),[0]);
  assert.equal(glow.initial.startSize.scalar,raw['level0:68688'].particleSystem.InitialModule.startSize.scalar);
  assert.equal(sampleProjectileParticle(glow,0).size,glow.initial.startSize.scalar);
  assert.equal(glow.initial.startSize.scalar,3.299999952316284);
});
test('normal glow fades and disappears by source .15s particle life despite emitter duration 1s',()=>{
  assert.equal(glow.durationSeconds,1);
  const fresh=sampleProjectileParticle(glow,0),half=sampleProjectileParticle(glow,.075),gone=sampleProjectileParticle(glow,.16);
  assert.equal(fresh.color[3],1);assert.ok(Math.abs(half.color[3]-.5)<1e-6);
  assert.ok(half.size<fresh.size);assert.equal(gone.alive,false);
  assert.ok(Math.abs(fresh.endSeconds-.15)<1e-6);
  assert.ok(fresh.color[2]<.01,'native yellow gradient replaces adapter white');
});
test('start size uses emitter birth phase, size over life uses individual age',()=>{
  const p=structuredClone(glow);
  p.initial.startSize={mode:1,scalar:4,maxCurve:[{time:0,value:0,inSlope:1,outSlope:1},{time:1,value:1,inSlope:1,outSlope:1}]};
  p.durationSeconds=2;p.initial.startLifetime={mode:0,scalar:1};p.sizeOverLifetime.enabled=false;
  const a=sampleProjectileParticle(p,.6,.5,.5),b=sampleProjectileParticle(p,1,.5,.5);
  assert.equal(a.size,1);assert.equal(b.size,1);assert.equal(a.emitterPhase,.25);assert.equal(b.lifePhase,.5);
});
test('source delay, simulation speed, disabled renderer and emission gate visibility',()=>{
  const p=structuredClone(glow);p.startDelay={mode:0,scalar:.2};p.simulationSpeed=2;
  assert.equal(sampleProjectileParticle(p,.05).alive,false);assert.equal(sampleProjectileParticle(p,.11).alive,true);
  assert.equal(sampleProjectileParticle(p,.2).alive,false);
  p.renderer.enabled=false;assert.equal(sampleProjectileParticle(p,.11).alive,false);
  p.renderer.enabled=true;p.emission.enabled=false;assert.equal(sampleProjectileParticle(p,.11).alive,false);
});
test('serialized blend controls rendering even for misleading ADD asset names',()=>{
  assert.equal(projectileMaterialBlend({renderProperties:{_SrcBlend:5,_DstBlend:1}}),1);
  assert.equal(projectileMaterialBlend({renderProperties:{_SrcBlend:5,_DstBlend:10},name:'magic_orb2_ADD'}),0);
});
test('all retained source lifetimes, delays, burst counts and active module flags match APK evidence',()=>{
  for(const [key,p] of Object.entries(data.particles)){
    const s=raw[key].particleSystem;
    assert.equal(p.initial.startLifetime.scalar,s.InitialModule.startLifetime.scalar,key);
    assert.equal(p.startDelay.scalar,s.startDelay.scalar,key);
    assert.equal(p.sizeOverLifetime.enabled,s.SizeModule.enabled,key);
    assert.equal(p.colorOverLifetime.enabled,s.ColorModule.enabled,key);
    assert.equal(p.renderer.enabled,raw[key].renderer.m_Enabled,key);
    assert.equal(p.emission.bursts.length,s.EmissionModule.m_BurstCount,key);
    for(let i=0;i<p.emission.bursts.length;i++)assert.equal(p.emission.bursts[i].count.scalar,s.EmissionModule.m_Bursts[i].countCurve.scalar,key);
  }
});
test('spark source size-overlife Hermite shrinks to zero while keeping short randomized lifetime',()=>{
  assert.equal(evaluateProjectileCurve(root.sizeOverLifetime.x,0),1);
  assert.equal(evaluateProjectileCurve(root.sizeOverLifetime.x,1),0);
  assert.equal(sampleProjectileParticle(root,.21,0).alive,false);
  assert.equal(sampleProjectileParticle(root,.19,1).alive,true);
});

test('selected inactive FX root is activated while disabled Beam descendants are omitted',()=>{
  assert.equal(root.activeSelf,false);assert.equal(shouldPresentProjectileParticle(root,true),true);
  const beam=data.particles['level0:67153'];assert.equal(beam.name,'Beam');
  assert.equal(shouldPresentProjectileParticle(beam,false),false);
});
