import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {solveSourceUiLayout,sourceUiTree} from '../source-ui';
const json=f=>JSON.parse(readFileSync(process.cwd()+'/artifacts/evidence/round6-20261002/'+f,'utf8'));
test('pet source Info button opens draw odds, while pointer-up invokes actual pet detail',()=>{
 const events=json('pet-draw-info-ui-scene.json').buttons;
 const info=events.find(x=>x.id==='level0:1351').listeners[0];
 assert.equal(info.method,'SetActive');assert.equal(info.target.pathID,1050);assert.equal(info.arguments.bool,true);
 for(const id of ['level0:1087','level0:8']){const e=events.find(x=>x.id===id).listeners[0];assert.equal(e.target.pathID,1050);assert.equal(e.method,'SetActive');assert.equal(e.arguments.bool,false);}
 const methods=json('pet-navigation-native.json').methods;
 assert(methods.find(x=>x.name==='Pet_Item.OnPointerUp').calls.some(x=>x.names.includes('Pet_Info_UI.Reload')));
 assert(methods.find(x=>x.name==='Pet_Slot.OnPointerUp').calls.some(x=>x.names.includes('Pet_manager.Pet_Info_UI_Reload')));
});
test('exported original draw odds root retains D100% and inactive higher rows at both acceptance sizes',()=>{
 const node=sourceUiTree.nodes.find(n=>n.id==='level0:1050');assert.equal(node.path,'/Canvas/Pet_manager/Draw_Info_UI');assert.equal(node.active,false);
 const active={};let n=node;while(n){active[n.id]=true;n=sourceUiTree.nodes.find(x=>x.id===n.parent);}
 for(const [width,height] of [[390,844],[1080,1920]]){
  const layout=solveSourceUiLayout(sourceUiTree,{width,height},{active});
  assert.equal(layout.get('level0:9891').active,true);assert.equal(layout.get('level0:9863').active,false);
  assert.equal(sourceUiTree.nodes.find(x=>x.id==='level0:9891').components.find(c=>c.kind==='TextMeshProUGUI').data.text,'100%');
 }
});
