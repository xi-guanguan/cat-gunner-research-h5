import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleProjectileMotion,projectileStretch,sampleProjectileParticle} from '../projectile-view.ts';
const data=JSON.parse(readFileSync('src/data/projectile-presentation.json','utf8'));
const raw=JSON.parse(readFileSync('artifacts/evidence/projectile-visuals-20260930/particle-source.json','utf8'));
const spark=data.particles['level0:67675'];
const fixture=()=>structuredClone(spark);
const length=v=>Math.hypot(v.x,v.y,v.z);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('stretched spark flags and original triangle texture come directly from renderer source',()=>{
  assert.equal(data.materials[spark.renderer.materialKeys[0]].textures._BaseMap.textureKey,'sharedassets0.assets:105');
  for(const [k,p] of Object.entries(data.particles)){
    assert.equal(p.renderer.m_FreeformStretching,raw[k].renderer.m_FreeformStretching);
    assert.equal(p.renderer.m_RotateWithStretchDirection,raw[k].renderer.m_RotateWithStretchDirection);
  }
});
test('sphere edge spark births retain source radius and speeds, with distinct outward velocities',()=>{
  const angles=[];
  for(const random of [.13,.29,.51,.67,.81,.94]){
    const birth=sampleProjectileMotion(spark,0,0,random),later=sampleProjectileMotion(spark,.08,0,random);
    close(length(birth.position),spark.shape.radius);
    close(length(birth.velocity),1+2*random);
    close(length(later.position)-length(birth.position),length(birth.velocity)*.08);
    angles.push(Math.atan2(birth.velocity.y,birth.velocity.x));
  }
  assert.equal(new Set(angles.map(x=>x.toFixed(5))).size,6);
});
test('hemisphere2 emits on positive Z and box5 emits forward from the box volume',()=>{
  for(let i=1;i<50;i++){
    const p=fixture();p.shape.radius=2;p.shape.radiusThickness=1;p.shape.type=2;
    const m=sampleProjectileMotion(p,0,0,i/50);assert.ok(m.position.z>=0);assert.ok(m.velocity.z>=0);assert.ok(length(m.position)<=2);
    p.shape.type=5;p.shape.m_Scale={x:2,y:4,z:6};
    const box=sampleProjectileMotion(p,0,0,i/50);assert.ok(Math.abs(box.position.x)<=1);assert.ok(Math.abs(box.position.y)<=2);assert.ok(Math.abs(box.position.z)<=3);
    close(box.velocity.x,0);close(box.velocity.y,0);assert.ok(box.velocity.z>0);
  }
});
test('cone4 emits from XY base and shape Euler rotation rotates forward velocity',()=>{
  const p=fixture();p.shape.type=4;p.shape.angle=0;p.shape.radius=2;p.shape.radiusThickness=1;
  const cone=sampleProjectileMotion(p,0,0,.37);close(cone.position.z,0);assert.ok(Math.hypot(cone.position.x,cone.position.y)<=2);close(cone.velocity.x,0);close(cone.velocity.y,0);
  p.shape.m_Rotation={x:0,y:90,z:0};p.shape.m_Position={x:2,y:3,z:4};
  const rotated=sampleProjectileMotion(p,0,0,.37);close(rotated.velocity.z,0);close(rotated.velocity.x,length(cone.velocity));close(rotated.position.x,2);
});
test('sphere radius thickness is a physical radial shell, not a linear volume fraction',()=>{
  const p=fixture();p.shape.radius=2;p.shape.radiusThickness=.5;
  const radii=Array.from({length:500},(_,i)=>length(sampleProjectileMotion(p,0,0,(i+1)/501).position));
  assert.ok(Math.min(...radii)>=1);assert.ok(Math.min(...radii)<1.1);assert.ok(Math.max(...radii)<=2);
});
test('stretched billboard follows particle projection and adds source size and speed lengths',()=>{
  const east=projectileStretch(spark,.6,{x:6,y:0,z:0},15,{});
  const north=projectileStretch(spark,.6,{x:0,y:6,z:0},15,{});
  close(east.height,(.6*spark.renderer.m_LengthScale+6*spark.renderer.m_VelocityScale)*15);
  close(east.rotation,Math.PI/2);close(north.rotation,0);
  const headOn=projectileStretch(spark,.6,{x:0,y:0,z:6},15,{});close(headOn.height,0);
});
test('gun0 glow retains original life, alpha, yellow source gradient and dimensions',()=>{
  const glow=data.particles['level0:68688'],sample=sampleProjectileParticle(glow,0);
  close(sample.size,3.299999952316284);close(sample.lifetime,.15000000596046448);close(sample.color[3],1);
  close(sample.color[0],1);close(sample.color[1],.772549033164978);close(sample.color[2],0);
  assert.deepEqual(glow.chainTransformIDs.map(id=>data.transforms[id].scale),[[3,3,3],[1,1,1]]);
  assert.deepEqual(readFileSync('src/data/projectile-presentation.json'),readFileSync('public/assets/data/projectile-presentation.json'));
});
