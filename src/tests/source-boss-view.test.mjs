import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SOURCE_BOSS_VIEW_DATA as data,sourceBossSkinIndex,sourceBossSampleCubic,sampleSourceBossLocalPose,blendSourceBossLocalPose,applySourceBossFacing,sampleSourceBossPose,sourceBossTransformPoint,sourceBossSpriteWorldCorners,sourceBossWorldCollider,sourceBossProjectileHitsBox,sourceBossProjectileHits,sourceBossGroundCollider,sourceBossTextureDependencies} from '../source-boss-view-data.ts';
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const root={x:-115,y:0,z:15};
const localPoint=(box,[x,y,z])=>({x:box.center.x+box.axes[0][0]*x+box.axes[1][0]*y+box.axes[2][0]*z,y:box.center.y+box.axes[0][1]*x+box.axes[1][1]*y+box.axes[2][1]*z,z:box.center.z+box.axes[0][2]*x+box.axes[1][2]*y+box.axes[2][2]*z});
test('all nine original rigs, source clip IDs and74 PNG hashes remain present',()=>{
 assert.equal(data.skins.length,9);assert.equal(data.nodes.length,123);assert.equal(Object.keys(data.resources).length,74);assert.equal(data.source.controller,'sharedassets0.assets:301');assert.equal(data.source.notSpine,true);
 for(let i=0;i<9;i++){assert.equal(data.skins[i].index,i);assert.equal(data.skins[i].layers.length,9);assert.equal(sourceBossSkinIndex(i+9),i);}
 for(const [key,r] of Object.entries(data.resources)){const bytes=readFileSync(`public${r.textureUrl}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256,key);assert.equal(bytes.readUInt32BE(16),r.texturePngSize[0],key);assert.equal(bytes.readUInt32BE(20),r.texturePngSize[1],key);}
 const renderer=JSON.parse(readFileSync('artifacts/evidence/round5-20261001/boss-renderer-order-source.json','utf8'));assert.equal(renderer.spriteFlips.length,83);assert.ok(renderer.spriteFlips.every(r=>!r.flipX&&!r.flipY));assert.equal(renderer.sortingGroups.length,9);assert.ok(renderer.sortingGroups.every(g=>g.fields.m_SortingLayerID===0&&g.fields.m_SortingOrder===0));
});
test('trimmed PNG quad retains native textureRectOffset rather than stretching to full Sprite rect',()=>{
 const r=data.resources['sharedassets0.assets:350'],identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],corners=sourceBossSpriteWorldCorners(r,identity);
 assert.deepEqual(r.texturePngSize,[464,356]);near(corners[0].x,(149.0761260986328-769.9248046875*.5)/76.99248504638672);near(corners[0].y,(77.07611846923828+355.8477783203125-512.7699584960938*.5)/76.99248504638672);near(corners[1].x-corners[0].x,463.8477783203125/76.99248504638672);near(corners[0].y-corners[3].y,355.8477783203125/76.99248504638672);
});
test('native cubic Walk Body.y golden values and all-skin path mappings',()=>{
 const track=data.clips.Walk.tracks.find(t=>t.path==='Body'&&t.property==='localPosition');assert.ok(track);near(sourceBossSampleCubic(track.channels[1],0),3);near(sourceBossSampleCubic(track.channels[1],1/6),3.4000000953674316);
 for(const clip of Object.values(data.clips))for(const t of clip.tracks){assert.equal(t.nodes.length,9);for(let i=0;i<9;i++)assert.ok(data.skins[i].nodes.includes(t.nodes[i]),`${t.path} skin${i}`);}
 for(let i=0;i<9;i++)near(sampleSourceBossLocalPose(i,'Walk',1/6).get(track.nodes[i]).position[1],3.4000000953674316);
});
test('Ready wraps at1.5s, Death clamps at original duration and sentinel does not extrapolate',()=>{
 assert.equal(data.clips.Ready.duration,1.5);assert.equal(data.clips.Walk.duration,.5);near(data.clips.Death.duration,.6666666865348816,1e-10);
 assert.deepEqual(sampleSourceBossLocalPose(0,'Ready',0),sampleSourceBossLocalPose(0,'Ready',1.5));assert.deepEqual(sampleSourceBossLocalPose(8,'Death',data.clips.Death.duration),sampleSourceBossLocalPose(8,'Death',100));
 assert.equal(sourceBossSampleCubic({keys:[[-3.4028234663852886e38,1,2,3,7],[0,0,0,0,9]]},-.1),7);
});
test('full original root, Bounce tilt and scale4 survive world compose for each skin',()=>{
 for(let i=0;i<9;i++){const pose=sampleSourceBossPose(i,'Ready',0,root);assert.deepEqual(sourceBossTransformPoint(pose.matrices.get(data.root)),root);const skin=data.skins[i],node=data.nodes.find(n=>n.id===skin.root);assert.deepEqual(node.scale,i===0?[4,4,4]:[4,4,1]);assert.deepEqual(pose.locals.get(skin.root).scale,node.scale);for(const layer of skin.layers){const corners=sourceBossSpriteWorldCorners(data.resources[layer.spriteKey],pose.matrices.get(layer.node));assert.equal(corners.length,4);assert.ok(corners.every(p=>Object.values(p).every(Number.isFinite)));}}
 const bounce=data.nodes.find(n=>n.name==='Bounce');assert.ok(bounce);assert.deepEqual(bounce.rotation,[.3535533845424652,-.3535533845424652,.1464466005563736,.8535534739494324]);
});
test('source facing is immediate even while clip poses blend; collider stays on sibling branch',()=>{
 const left=sampleSourceBossLocalPose(0,'Ready',0,'left'),right=sampleSourceBossLocalPose(0,'Walk',.1,'right'),mixed=blendSourceBossLocalPose(left,right,.1);applySourceBossFacing(mixed,'right');assert.deepEqual(mixed.get(data.skinFacingNode).rotation,right.get(data.skinFacingNode).rotation);near(right.get(data.skinFacingNode).rotation[1],1);near(right.get(data.skinFacingNode).rotation[3],0);
 const a=sampleSourceBossPose(0,'Ready',0,root,'left'),b=sampleSourceBossPose(0,'Ready',0,root,'right');assert.deepEqual(a.matrices.get(39264),b.matrices.get(39264));const skin=data.skins[0],body=skin.layers.find(l=>data.nodes.find(n=>n.id===l.node)?.name==='Body');assert.notDeepEqual(a.matrices.get(body.node),b.matrices.get(body.node));
});
test('active Enemy_Coll native OBB has exact scaled size and displaced center; inactive sphere excluded',()=>{
 const box=sourceBossWorldCollider(root);assert.equal(box.node,39264);near(box.halfExtents[0],10.380000114440918);near(box.halfExtents[1],6);near(box.halfExtents[2],6.8999998569488525);near(box.center.x-root.x,-3.5123548669);near(box.center.y-root.y,6.0799998862);near(box.center.z-root.z,3.2523551148);
 assert.equal(data.nodes.find(n=>n.id===39332).active,false);near(box.axes[0][0],Math.SQRT1_2);near(box.axes[0][2],Math.SQRT1_2);near(box.axes[2][0],-Math.SQRT1_2);
});
test('swept original OBB detects crossing, tangent, stationary point and genuine miss',()=>{
 const box=sourceBossWorldCollider(root),h=box.halfExtents;
 assert.equal(sourceBossProjectileHitsBox(box,localPoint(box,[-30,0,0]),localPoint(box,[30,0,0])),true);
 assert.equal(sourceBossProjectileHits(root,localPoint(box,[-30,0,0]),localPoint(box,[30,0,0])),true);
 assert.equal(sourceBossProjectileHitsBox(box,localPoint(box,[0,h[1]+1,0]),localPoint(box,[0,h[1]+1,0]),1),true);
 assert.equal(sourceBossProjectileHitsBox(box,localPoint(box,[0,h[1]+1.01,0]),localPoint(box,[0,h[1]+1.01,0]),1),false);
 assert.equal(sourceBossProjectileHitsBox(box,box.center,box.center),true);
 assert.equal(sourceBossProjectileHitsBox(box,localPoint(box,[-30,h[1]+2,0]),localPoint(box,[30,h[1]+2,0]),1),false);
});
test('swept sphere corner uses Euclidean distance rather than expanded-box false positive',()=>{
 const box=sourceBossWorldCollider(root),h=box.halfExtents;const outside=localPoint(box,[h[0]+.8,h[1]+.8,0]);assert.equal(sourceBossProjectileHitsBox(box,outside,outside,1),false);
 const inside=localPoint(box,[h[0]+.7,h[1]+.7,0]);assert.equal(sourceBossProjectileHitsBox(box,inside,inside,1),true);
 assert.equal(sourceBossProjectileHitsBox(box,localPoint(box,[h[0]+.8,h[1]+.8,-30]),localPoint(box,[h[0]+.8,h[1]+.8,30]),1),false);
});
test('original Map_obj background resource and native ground box are independently available',()=>{
 const layer=data.map.layers[0],r=data.resources[layer.spriteKey];assert.equal(layer.renderer,82859);assert.equal(layer.sortingOrder,-32);assert.equal(r.textureUrl,'/assets/generated/sprite/sharedassets0.assets__00000810__boss.png');assert.equal(r.rect.width,512);assert.equal(r.pixelsPerUnit,50);assert.deepEqual(data.map.worldOrigin,[-100,0,0]);assert.equal(data.map.nodes.find(n=>n.name==='Ground (1)').scale[0],15);const box=sourceBossGroundCollider();assert.equal(box.node,39342);near(box.halfExtents[0],10.229999542236328*15/2);near(box.halfExtents[1],10.239999771118164*15/2);near(box.halfExtents[2],.20000000298023224*15/2);
});
test('textures can preload all skins or a single skin plus all original head states',()=>{
 assert.equal(sourceBossTextureDependencies().length,73);assert.equal(sourceBossTextureDependencies(undefined,false).length,72);for(let i=0;i<9;i++){const urls=sourceBossTextureDependencies(i,false);for(const layer of data.skins[i].layers)assert.ok(urls.includes(data.resources[layer.spriteKey].textureUrl));for(const head of Object.values(data.heads))assert.ok(urls.includes(data.resources[head[i]].textureUrl));assert.equal(sourceBossTextureDependencies(i).length,urls.length+1);}for(const bad of [-1,.5,NaN,2147483648])assert.throws(()=>sourceBossSkinIndex(bad),RangeError);
 assert.throws(()=>sourceBossProjectileHitsBox(sourceBossWorldCollider(root),root,root,-1),RangeError);
});
