import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Execute the actual main.ts layer initialization/refresh slices with lightweight
// display-node doubles. This checks wiring/ownership, not pixels or GUI layout.
const main=readFileSync('src/main.ts','utf8');
const initial=main.slice(main.indexOf('const world = new Container()'),main.indexOf('const transition = new SceneTransition()'));
const refresh=main.slice(main.indexOf('const huntOwned=!!liveHunt?.ownsField'),main.indexOf('syncLiveHuntHUD();syncLiveRaidHUD();'));
class Container {
  visible=true;parent=null;eventMode='auto';children=[];
  addChild(...children){for(const child of children){this.children.push(child);child.parent=this;}}
}
function scene(){
  const context=vm.createContext({Container,Rectangle:class{},W:390,H:844,app:{stage:new Container()}});
  vm.runInContext(initial+`;globalThis.layers={hud,world,huntWorldLayer,raidWorldLayer,huntHudLayer,raidHudLayer};`,context);
  context.nativeHud={view:{root:new Container()}};
  context.bossHud={root:new Container()};
  context.app.stage.addChild(context.nativeHud.view.root);
  return context;
}
function update(context,{hunt=false,raid=false,eco=false}={}){
  Object.assign(context,{liveHunt:hunt?{ownsField:true}:null,liveRaid:raid?{ownsField:true}:null,ecoMode:eco});
  // Separate scope, like consecutive invocations of update().
  vm.runInContext(`{${refresh}}`,context);
}
function retired(context){
  assert.equal(context.layers.hud.parent,null,'legacy HUD must stay outside the scene graph');
  assert.equal(context.layers.hud.visible,false,'legacy HUD must never be re-enabled');
  assert.equal(context.layers.hud.eventMode,'none','legacy buttons must not handle input');
}

test('prototype HUD is detached and non-interactive before source HUD is installed',()=>retired(scene()));
test('field, challenge, mine, result and boss refreshes cannot restore the prototype',()=>{
  const c=scene();
  for(const mode of ['field','challenge','mine','mine-result','result','boss']){
    c.session={mode};update(c);retired(c);
    assert.equal(c.nativeHud.view.root.visible,true);
  }
});
test('external battle and eco transitions retain only the current source world/HUD',()=>{
  const c=scene();
  for(const state of [{},{hunt:true},{hunt:true,eco:true},{eco:true},{},
    {raid:true},{raid:true,eco:true},{eco:true},{}]){
    update(c,state);retired(c);
    const external=!!(state.hunt||state.raid);
    assert.equal(c.nativeHud.view.root.visible,!external);
    assert.equal(c.layers.world.visible,!external&&!state.eco);
    assert.equal(c.layers.huntWorldLayer.visible,!!state.hunt&&!state.eco);
    assert.equal(c.layers.raidWorldLayer.visible,!!state.raid&&!state.eco);
    assert.equal(c.layers.raidHudLayer.visible,!!state.raid);
  }
});
test('panel close, resize and repeated refreshes do not resurrect duplicate menus/cards',()=>{
  const c=scene();
  for(let i=0;i<40;i++){
    c.settingsOpen=i%3===0;c.localPanel=i%2?'gun':'none';
    c.W=i%2?1080:390;c.H=i%2?1920:844;
    update(c,{eco:i%4===0});retired(c);
  }
});
test('all prototype visibility writes are false; stage attaches source HUD rather than prototype',()=>{
  const writes=[...main.matchAll(/\bhud\.visible\s*=\s*([^;]+);/g)].map(m=>m[1].trim());
  assert.ok(writes.length>0);
  assert.ok(writes.every(value=>value==='false'),JSON.stringify(writes));
  for(const call of main.matchAll(/app\.stage\.addChild(?:At)?\(([^;]+)\);/g)){
    assert.doesNotMatch(call[1],/(?:^|,)\s*hud\s*(?:,|$)/);
  }
  assert.match(main,/app\.stage\.addChildAt\(nativeHud\.view\.root,/);
});
test('regression guard detects the original refresh bug',()=>{
  const c=scene();Object.assign(c,{liveHunt:null,liveRaid:null,ecoMode:false});
  vm.runInContext(`{${refresh.replace('hud.visible=false;','hud.visible=!externalOwned;')}}`,c);
  assert.throws(()=>retired(c),/never be re-enabled/);
});
