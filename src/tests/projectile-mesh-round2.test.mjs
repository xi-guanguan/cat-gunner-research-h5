import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectileMaterialBlend,sampleProjectileParticle} from '../projectile-view.ts';
const data=JSON.parse(readFileSync('src/data/projectile-presentation.json','utf8'));
// APK SHA in data.source, sharedassets0.assets Shader:221 m_ParsedForm.m_SubShaders[].m_Passes[].m_State:
// rtBlend0.srcBlend.val=5, destBlend.val=10, zWrite.val=0, culling.val=0.
// The shader hardcodes Alpha Blended, ignoring saved material properties 1/0.
test('legacy Ring source shader restores alpha blend despite stale saved opaque blend properties',()=>{
  const material=data.materials['sharedassets0.assets:42'];
  assert.equal(material.shader.name,'Legacy Shaders/Particles/Alpha Blended');
  assert.equal(material.renderProperties._SrcBlend,1);assert.equal(material.renderProperties._DstBlend,0);
  assert.equal(projectileMaterialBlend(material),0,'Pixi NORMAL, not NONE');
});
test('Ring retains native mesh, atlas, start opacity and native dimensions',()=>{
  const p=data.particles['level0:70002'];
  assert.equal(p.renderer.meshKeys[0],'sharedassets0.assets:202');
  assert.equal(p.textureSheetAnimation.tilesX,3);assert.equal(p.textureSheetAnimation.tilesY,3);
  const sample=sampleProjectileParticle(p,0);
  assert.equal(sample.color[3],.23529411852359772);assert.equal(p.initial.startSize.scalar,1.2999999523162842);
});
test('URP alpha/additive remain controlled by consumed material blend properties',()=>{
  const materials=Object.values(data.materials).filter(m=>m.shader?.name.startsWith('Universal'));
  for(const m of materials)assert.equal(projectileMaterialBlend(m),m.renderProperties._DstBlend===1?1:0,m.name);
});
