import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceUiView, findSourceUiNode, solveSourceUiLayout, sourceUiCanvasScale, sourceUiSliceBorders, sourceUiTree } from '../source-ui.ts';
const near=(actual,expected,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
const node=(id,parent,rect={},extra={})=>({id,name:id,path:parent?`/Canvas/${id}`:'/Canvas',file:'fixture',gameObjectPathID:Number(id)||1,transformPathID:Number(id)||1,parent,siblingIndex:0,active:true,rect:{anchorMin:[.5,.5],anchorMax:[.5,.5],anchoredPosition:[0,0],sizeDelta:[100,100],pivot:[.5,.5],...rect},localPosition:[0,0,0],localScale:[1,1,1],localRotation:[0,0,0,1],components:[],...extra});
const tree=(nodes,scaler={})=>({schemaVersion:1,canvas:{root:'root',scaler:{uiScaleMode:1,referenceResolution:[1080,1920],screenMatchMode:0,matchWidthOrHeight:0,referencePixelsPerUnit:100,...scaler}},nodes:[node('root',null),...nodes],sprites:{},materials:{},fonts:{}});
const comp=(kind,data)=>({kind,data,enabled:true});

test('Canvas width scale preserves tall viewport and ignores serialized zero scale',()=>{
 const input=tree([node('child','root',{anchorMin:[0,0],anchorMax:[1,1],sizeDelta:[0,0]})]);input.nodes[0].localScale=[0,0,0];
 const a=solveSourceUiLayout(input,{width:540,height:1200}),b=solveSourceUiLayout(input,{width:540,height:960});
 near(a.get('root').localWidth,1080);near(a.get('root').localHeight,2400);near(a.get('child').height,1200);
 near(b.get('child').height,960);near(a.get('child').x,0);near(a.get('child').y,0);
 near(sourceUiCanvasScale(tree([], {matchWidthOrHeight:1}),{width:540,height:1200}),.625);
 near(sourceUiCanvasScale(tree([], {screenMatchMode:1}),{width:540,height:1200}),.5);
 near(sourceUiCanvasScale(tree([], {screenMatchMode:2}),{width:540,height:1200}),.625);
});
test('stretch anchor reference follows pivot rather than the anchor midpoint',()=>{
 const input=tree([node('stretch','root',{anchorMin:[.2,.1],anchorMax:[.8,.9],sizeDelta:[-20,-40],pivot:[.25,.8],anchoredPosition:[7,13]})]);
 const l=solveSourceUiLayout(input,{width:540,height:960}).get('stretch');
 near(l.localWidth,628);near(l.localHeight,1496);near(l.localX,385);near(l.localY,-1433.8);
 near(l.x,(385-628*.25)*.5);near(l.y,960+(-1433.8-1496*.2)*.5);
});
test('source active hierarchy accepts explicit runtime overrides',()=>{
 const input=tree([node('parent','root',{}, {active:false}),node('child','parent')]);
 assert.equal(solveSourceUiLayout(input,{width:540,height:960}).get('child').active,false);
 assert.equal(solveSourceUiLayout(input,{width:540,height:960},{active:{parent:true}}).get('child').active,true);
 assert.equal(solveSourceUiLayout(input,{width:540,height:960},{active:{parent:true,child:false}}).get('child').active,false);
});
test('quaternion Y mirror survives into nested screen geometry',()=>{
 const input=tree([node('mirror','root',{}, {localRotation:[0,1,0,0]}),node('child','mirror',{anchoredPosition:[20,0],sizeDelta:[10,10]})]);
 const l=solveSourceUiLayout(input,{width:540,height:960});near(l.get('mirror').matrix.a,-.5);near(l.get('child').matrix.tx,260);
});
test('vertical layout + preferred content fitter respects inactive children and sibling order',()=>{
 const input=tree([node('group','root',{sizeDelta:[100,300],pivot:[0,1]},{components:[comp('VerticalLayoutGroup',{padding:[10,20,5,7],spacing:3,childAlignment:0,childControlWidth:false,childControlHeight:false,childForceExpandWidth:false,childForceExpandHeight:false}),comp('ContentSizeFitter',{horizontalFit:0,verticalFit:2})]}),
 node('b','group',{sizeDelta:[20,30]},{siblingIndex:1}),node('a','group',{sizeDelta:[40,50]},{siblingIndex:0}),node('hidden','group',{sizeDelta:[90,999]},{active:false,siblingIndex:2})]);
 const l=solveSourceUiLayout(input,{width:540,height:960});near(l.get('group').localHeight,95);near(l.get('a').localX,30);near(l.get('a').localY,30);near(l.get('b').localY,73);
 const shown=solveSourceUiLayout(input,{width:540,height:960},{active:{hidden:true}});near(shown.get('group').localHeight,1097);
});
test('group-controlled preferred/flexible sizes distribute surplus with source padding',()=>{
 const g={padding:[10,10,0,0],spacing:10,childAlignment:0,childControlWidth:true,childControlHeight:false,childForceExpandWidth:false,childForceExpandHeight:false};
 const input=tree([node('g','root',{sizeDelta:[320,100]},{components:[comp('HorizontalLayoutGroup',g)]}),node('a','g',{}, {components:[comp('LayoutElement',{minWidth:20,preferredWidth:50,flexibleWidth:1})]}),node('b','g',{}, {siblingIndex:1,components:[comp('LayoutElement',{minWidth:20,preferredWidth:100,flexibleWidth:2})]})]);
 const l=solveSourceUiLayout(input,{width:540,height:960});near(l.get('a').localWidth,50+140/3);near(l.get('b').localWidth,100+280/3);
});
test('grid constraint, corner and vertical fill axis determine source slots',()=>{
 const input=tree([node('g','root',{sizeDelta:[300,400],pivot:[0,1]},{components:[comp('GridLayoutGroup',{padding:[10,10,5,5],childAlignment:0,cellSize:[50,30],spacing:[3,7],constraint:2,constraintCount:2,startAxis:1,startCorner:1})]}),...Array.from({length:4},(_,i)=>node('slot'+i,'g',{}, {siblingIndex:i}))]);
 const l=solveSourceUiLayout(input,{width:540,height:960});near(l.get('slot0').localWidth,50);near(l.get('slot0').localX,88);near(l.get('slot1').localY,57);near(l.get('slot2').localX,35);
});
test('source sprite borders use PPU scale and shrink opposing borders consistently',()=>{
 assert.deepEqual(sourceUiSliceBorders([20,30,40,50],100,100),[20,50,40,30]);
 const b=sourceUiSliceBorders([20,30,40,50],30,40);near(b[0],10);near(b[2],20);near(b[1],25);near(b[3],15);
 assert.deepEqual(sourceUiSliceBorders([20,30,40,50],100,100,.5),[10,25,20,15]);
});
test('actual source ancestor chain positions Upgrade_List visibly at both viewport heights',()=>{
 for(const height of [960,1200]){const l=solveSourceUiLayout(sourceUiTree,{width:540,height}),up=findSourceUiNode('/Ingame/Upgrade_List'),parent=findSourceUiNode('/SafeArea/Ingame');
   near(l.get(parent.id).localWidth,100);near(l.get(parent.id).localHeight,height*2-1820);
   near(l.get(up.id).x,35);near(l.get(up.id).y,height-114.8084716796875);near(l.get(up.id).width,470);
   assert.ok(l.get(up.id).y+l.get(up.id).height<height);
 }
});
test('stable full path and unique suffix bind correctly while duplicate panel names are rejected',()=>{
 assert.equal(findSourceUiNode('/Main_UI/Currency/Money/Price_txt').gameObjectPathID,17253);
 assert.equal(findSourceUiNode('/Main_UI/Currency/Dia/Price_txt').gameObjectPathID,5794);
 assert.equal(findSourceUiNode('GunItem'),undefined);
 assert.equal(findSourceUiNode('/Canvas/SafeArea/Gun_UI  (SafeArea)/GunList_UI/Panel/Menu (Gun List)/Content/GunItem'),undefined);
 assert.ok(findSourceUiNode('level0:10730').components.some(c=>c.kind==='Gun_Item'));
 assert.equal(findSourceUiNode('Panel'),undefined);
});

// Real mutable view, not just projection: aliases must not re-override ID writes.
test('view canonicalizes initial path/id overrides and restores the same panel after popup close',()=>{
 const input=tree([node('panel','root'),node('popup','root'),node('button','panel')]);
 const view=createSourceUiView({tree:input,textures:{},viewport:{width:390,height:844},active:{panel:true,'/Canvas/panel':false,'/Canvas/popup':true},transforms:{'/Canvas/panel':{anchoredPosition:[3,4]}}});
 const identity=view.instanceId;
 assert.equal(view.layout.get('panel').active,false);
 view.patch({active:{'/Canvas/panel':true,popup:false}});
 assert.equal(view.layout.get('panel').active,true);assert.equal(view.layout.get('button').active,true);assert.equal(view.layout.get('popup').active,false);
 view.patch({active:{panel:false,'/Canvas/popup':true}});view.setActive('panel',true);view.setActive('/Canvas/popup',false);
 assert.equal(view.layout.get('button').active,true);assert.equal(view.layout.get('popup').selfActive,false);assert.equal(view.instanceId,identity);
 const before=view.layout.get('panel');view.setTransform('panel',{anchoredPosition:[30,40]});near(view.layout.get('panel').localX-before.localX,27);near(view.layout.get('panel').localY-before.localY,-36);
 view.destroy();
});
