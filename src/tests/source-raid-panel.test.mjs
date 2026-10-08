import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceUiTree,solveSourceUiLayout} from '../source-ui';
import {sourceRaidPanelBindings,sourceRaidAssetURLs} from '../source-raid-panel';
import scene from '../data/r6-raid-ui.json';
const nodes=new Map(sourceUiTree.nodes.map(n=>[n.id,n])),bindings=new Map(sourceRaidPanelBindings().map(r=>[r.id,r]));
const button=n=>n.components.find(c=>c.kind==='Button');
test('every source-enabled Raid button has an exact binding; disabled inner Demo is not revived',()=>{
 const start=scene.find(r=>r.kind==='Raid_Start_UI'),picker=scene.find(r=>r.kind==='Raid_GunSelect_Panel');
 for(const n of sourceUiTree.nodes.filter(n=>[start.path,picker.path].some(p=>n.path.startsWith(p+'/'))&&button(n)?.enabled!==false&&button(n)))assert.ok(bindings.has(n.id),n.path);
 const inner=scene.filter(r=>r.kind==='Gun_Item_Demo'&&r.path.startsWith(picker.path+'/'));assert.equal(inner.length,20);
 for(const n of inner){assert.equal(button(nodes.get(n.id)).enabled,false,n.path);assert.equal(bindings.has(n.id),false,n.path);}
 assert.equal(button(nodes.get('level0:17916')).enabled,false);assert.equal(bindings.has('level0:17916'),false);
 for(const ref of picker.data.item_list){assert.notEqual(button(nodes.get(ref.id)).enabled,false);assert.equal(bindings.get(ref.id).action,'raid-select');}
});
test('all five serialized boss portrait alternatives preload their original texture URLs',()=>{
 const start=scene.find(r=>r.kind==='Raid_Start_UI');assert.equal(start.data.Boss_Sprites.length,5);
 for(const url of start.data.Boss_Sprites.map(r=>sourceUiTree.sprites[r.spriteKey].url))assert(sourceRaidAssetURLs.includes(url),'boss portrait missing: '+url);
 assert.equal(new Set(sourceRaidAssetURLs).size,sourceRaidAssetURLs.length);
 assert.equal(sourceRaidAssetURLs.length,10);assert.ok(sourceRaidAssetURLs.every(u=>u.startsWith('/assets/generated/sprite/')));
});
for(const [width,height]of [[540,1168.615],[1080,1920]])test(`unmasked star button extends beyond source parent rect ${width}×${height}`,()=>{
 const active={};let n=nodes.get('level0:26119');while(n){active[n.id]=true;n=nodes.get(n.parent);}
 const l=solveSourceUiLayout(sourceUiTree,{width,height},{active}),slot=l.get('level0:26119'),star=l.get('level0:19298');
 assert.ok(star.y+star.height/2<slot.y);assert.equal(nodes.get('level0:26119').components.some(c=>['Mask','RectMask2D'].includes(c.kind)),false);
});
