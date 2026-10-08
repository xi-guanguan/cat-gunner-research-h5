import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOURCE_BULLET_COLLIDERS as data,sourceBulletCollider,sourceBulletRadius,sourceBulletColliderEnabled} from '../source-bullet-colliders.ts';
import {sourceBossWorldCollider,sourceBossProjectileHitsBox} from '../source-boss-view-data.ts';
const source=JSON.parse(readFileSync('artifacts/evidence/round5-20261001/boss-projectile-collider-source.json','utf8'));
const localPoint=(box,[x,y,z])=>({x:box.center.x+box.axes[0][0]*x+box.axes[1][0]*y+box.axes[2][0]*z,y:box.center.y+box.axes[0][1]*x+box.axes[1][1]*y+box.axes[2][1]*z,z:box.center.z+box.axes[0][2]*x+box.axes[1][2]*y+box.axes[2][2]*z});
test('all 27 complete pool hierarchies contain exactly one root SphereCollider',()=>{
 assert.equal(source.poolRoots.length,27);assert.equal(data.poolRoots.length,27);
 for(const c of source.poolRoots){assert.equal(c.subtreeColliders.length,1);assert.equal(c.subtreeColliders[0].key,c.sphereCollider.key);assert.equal(c.subtreeColliders[0].gameObject,c.gameObject);assert.equal(c.sphereCollider.radius,.6000000238418579);assert.deepEqual(c.sphereCollider.center,[0,0,0]);assert.deepEqual(c.worldScale,[1,1,1]);assert.equal(c.rigidbody.collisionDetection,0);assert.equal(c.sphereCollider.trigger,true);assert.equal(c.sphereCollider.enabled,true);assert.equal(c.activeSelf,false);}
});
test('65 guns and 45 independent selected visual templates use the root radius',()=>{
 assert.equal(data.gunBindings.length,65);assert.equal(source.selectedVisualTemplates.length,45);
 for(const s of source.selectedVisualTemplates)assert.deepEqual(s.subtreeColliders,[]);
 for(let gunNum=0;gunNum<65;gunNum++){const c=sourceBulletCollider(gunNum);assert.equal(c.actualBulletRadius,.6000000238418579);assert.equal(c.shape,'sphere');assert.equal(c.visualTemplateKey,data.gunBindings[gunNum].visualTemplateKey);assert.equal(c.sourceColliderKey,'level0:66821');assert.equal(c.sourcePoolColliderKeys.length,27);}
 assert.deepEqual([...new Set(data.gunBindings.map(g=>g.gunType))].sort(),[0,1,2,3,4,5,6]);
});
test('caller scale is an explicit bounding sphere adapter, original source scale is 1',()=>{
 assert.equal(sourceBulletRadius(0),.6000000238418579);assert.equal(sourceBulletRadius(0,[1,-2,.5]),1.2000000476837158);assert.equal(sourceBulletRadius(64,[0,0,0]),0);assert.deepEqual(sourceBulletCollider(64,[1,-2,.5]).worldScale,[1,-2,.5]);
 for(const bad of [-1,65,.5,NaN,Infinity])assert.throws(()=>sourceBulletRadius(bad),RangeError);
 assert.throws(()=>sourceBulletRadius(0,[1,NaN,1]),RangeError);assert.throws(()=>sourceBulletRadius(0,[1,Infinity,1]),RangeError);
});
test('live Collider and source death/reuse gates are explicitly represented',()=>{
 assert.equal(sourceBulletColliderEnabled('pooled'),false);assert.equal(sourceBulletColliderEnabled('live'),true);assert.equal(sourceBulletColliderEnabled('died'),false);assert.throws(()=>sourceBulletColliderEnabled('unknown'),RangeError);
 const wrappers=JSON.parse(readFileSync('artifacts/evidence/round5-20261001/boss-projectile-wrapper-calls.json','utf8'));const enable=wrappers.calls.find(c=>c.target==='0x5766a54');assert.equal(enable.icall,'UnityEngine.Collider::set_enabled_Injected(System.IntPtr,System.Boolean)');assert.deepEqual([...new Set(enable.callsites.map(c=>c.caller))].sort(),['Bullet.DieAndWait','Bullet.ResetState']);
});
test('original Bullet sphere hits Boss edge where a point projectile misses',()=>{
 const box=sourceBossWorldCollider({x:-115,y:0,z:15});const r=sourceBulletRadius(0),h=box.halfExtents;const a=localPoint(box,[-h[0]-3,0,h[2]+r*.75]),b=localPoint(box,[h[0]+3,0,h[2]+r*.75]);
 assert.equal(sourceBossProjectileHitsBox(box,a,b,0),false);assert.equal(sourceBossProjectileHitsBox(box,a,b,r),true);
 const outside=localPoint(box,[0,0,h[2]+r+.01]);assert.equal(sourceBossProjectileHitsBox(box,outside,outside,r),false);
});
test('65 actual muzzle subtrees have exact exported particle coverage',()=>{
 assert.equal(source.muzzleCoverage.length,65);for(const m of source.muzzleCoverage){assert.equal(m.bindingMatches,true);assert.deepEqual(m.missing,[]);assert.deepEqual(m.extra,[]);}assert.equal(source.coverage.muzzleMissingParticles,0);
});
