import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Assets,Texture} from 'pixi.js';
import {loadProjectileViewAssets,createImpactView,updateProjectileView} from '../projectile-view.ts';
const data=JSON.parse(readFileSync('src/data/projectile-presentation.json','utf8'));
test('actual Sprite view renders six distinct projected spark directions and original fading glow',async()=>{
  const get=Assets.get,load=Assets.load,fetch=globalThis.fetch;
  Assets.get=()=>Texture.EMPTY;Assets.load=async()=>{};
  globalThis.fetch=async url=>({ok:true,status:200,json:async()=>data,text:async()=>readFileSync(`public${url}`,'utf8')});
  try{
    await loadProjectileViewAssets();
    const view=createImpactView(0,0,15,{seed:31,cameraRotation:[.27984518,-.36470559,.11591566,.88047725]});
    const sparks=view.children.filter(x=>x.name==='level0:67675');
    assert.equal(sparks.length,6);assert.equal(new Set(sparks.map(x=>x.rotation.toFixed(5))).size,6);
    assert.equal(view.children.find(x=>x.name==='level0:68688').alpha,1);
    updateProjectileView(view,.15,15);
    assert.ok(view.children.find(x=>x.name==='level0:68688').alpha<.000001);
    updateProjectileView(view,.21,15);assert.equal(view.presentation.completed,true);assert.equal(view.presentation.liveParticleCount,0);
  }finally{Assets.get=get;Assets.load=load;globalThis.fetch=fetch;}
});
