import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Sprite,Texture,settings} from 'pixi.js';
import {sourceHuntCameraFollowPosition,sourceHuntSceneViewport,SOURCE_HUNT_CAMERA_FOLLOW} from '../hunt-camera-follow';
import {SourceHuntSceneView} from '../hunt-scene-view';
const scene=JSON.parse(readFileSync('src/data/hunt-scene-source.json','utf8'));
const cats=JSON.parse(readFileSync('src/data/hunt-cat-source.json','utf8')).cats;
const v=(x,y=0,z=0)=>({x,y,z});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} != ${b}`);
settings.ADAPTER={...settings.ADAPTER,createCanvas:()=>({getContext:()=>null})};
test('source Follow target is the exact non-AI Cat Transform; native setter is world position',()=>{
 const cat=cats.find(c=>c.componentID===SOURCE_HUNT_CAMERA_FOLLOW.targetCatComponentID);
 assert.equal(cat.isAI,false);assert.equal(cat.rayTransform.chain[1].pathID,SOURCE_HUNT_CAMERA_FOLLOW.targetTransformID);
 assert.match(SOURCE_HUNT_CAMERA_FOLLOW.setPositionWrapper.icall,/Transform::set_position_Injected/);
 const native=JSON.parse(readFileSync('artifacts/evidence/round6-20261002/hunt-camera-follow-native.json','utf8'));
 assert.match(native.wrappers[0].icall,/Transform::set_localScale_Injected/);
 assert.equal(native.follow.nativeSha256,scene.nativeSha256);
});
test('Follow copies exact XYZ; reordered cats, inactive leader and moving AI cannot choose a different target',()=>{
 const leader={componentID:147400,active:false,movement:{position:v(-93,4,2)}};
 const ai={componentID:136809,active:true,movement:{position:v(99,99,99)}};
 const p=sourceHuntCameraFollowPosition([ai,leader]);assert.deepEqual(p,leader.movement.position);assert.notEqual(p,leader.movement.position);
 p.x=500;assert.equal(leader.movement.position.x,-93);
 assert.deepEqual(sourceHuntCameraFollowPosition([leader,ai]),leader.movement.position);
 assert.throws(()=>sourceHuntCameraFollowPosition([ai]),/147400.*44677/);
 for(const n of [NaN,Infinity,-Infinity])assert.throws(()=>sourceHuntCameraFollowPosition([{...leader,movement:{position:v(n)}}]),/Invalid/);
});
test('leader stays at serialized framing while ground/monster/projectile world points share translated projection at both sizes',()=>{
 for(const [w,h]of [[390,844],[1080,1920]]){
  const old=v(-100),next=v(-88,3,-7),d=v(12,3,-7);
  const a=sourceHuntSceneViewport(old,w,h,old),b=sourceHuntSceneViewport(next,w,h,next);assert.deepEqual(a,b);
  for(const p of [v(-110,1,20),v(-105,2,-10),v(-98,4,9)]){
   const shifted=v(p.x+d.x,p.y+d.y,p.z+d.z);
   assert.deepEqual(sourceHuntSceneViewport(shifted,w,h,next),sourceHuntSceneViewport(p,w,h,old));
   assert.notDeepEqual(sourceHuntSceneViewport(p,w,h,next),sourceHuntSceneViewport(p,w,h,old));
  }
 }
 for(const [w,h,p,root]of [[Infinity,844,v(0),v(0)],[390,844,v(NaN),v(0)],[390,844,v(0),v(Infinity)]])assert.throws(()=>sourceHuntSceneViewport(p,w,h,root));
});
function viewFixture(){
 const leader={componentID:147400,movement:{position:v(-100)}};
 const host={cats:[leader],monsters:{activeMonsters:()=>[]},projectiles:{slots:[]}};
 const view=new SourceHuntSceneView(host,390,844);view.base={};view.pose=()=>{};
 for(const ground of scene.grounds)view.grounds.addChild(new Sprite(Texture.EMPTY));
 return {view,leader,host};
}
test('live adapter, actor projection and ground quads share camera; moved camera reprojects retired FX without advancing simulation',()=>{
 const {view,leader,host}=viewFixture();let reprojections=0;
 const original=view.projectilePresentation.reproject.bind(view.projectilePresentation);
 view.projectilePresentation.reproject=()=>{reprojections++;original();};
 try{
  view.render(0);const before=view.projectionState(),a=view.adapter(()=>.5),point=v(-102,1,2),old=a.project(point);
  leader.movement.position=v(-94,2,-3);view.render(0);const after=view.projectionState();
  assert.equal(reprojections,2);assert.notDeepEqual(after.grounds,before.grounds);
  assert.deepEqual(after.root,leader.movement.position);assert.deepEqual(after.leaderViewport,before.leaderViewport);
  const vp=a.project(point);assert.notDeepEqual(vp,old);assert.deepEqual(vp,sourceHuntSceneViewport(point,390,844,after.root));
  const pixel=view.project(point);near(pixel.x,vp.x*390);near(pixel.y,(1-vp.y)*844);
  for(let i=0;i<after.grounds.length;i++){
   near(after.grounds[i].a,before.grounds[i].a);near(after.grounds[i].d,before.grounds[i].d);
   near(after.grounds[i].tx-before.grounds[i].tx,(vp.x-old.x)*390);
   near(after.grounds[i].ty-before.grounds[i].ty,-(vp.y-old.y)*844);
  }
  view.render(0);assert.equal(reprojections,2,'unchanged camera does not rebuild static ground');
  assert.equal(host.projectiles.slots.length,0);
  view.resize(1080,1920);assert.equal(reprojections,3);assert.deepEqual(a.project(point),sourceHuntSceneViewport(point,1080,1920,after.root));
 }finally{view.destroy();}
});
test('moving an AI does not translate camera/ground; destroyed scene does not reproject or revive',()=>{
 const {view,leader,host}=viewFixture();host.cats.push({componentID:136809,movement:{position:v(-95)}});
 view.render(0);const before=view.projectionState();host.cats[1].movement.position=v(-20);view.render(0);assert.deepEqual(view.projectionState(),before);
 view.destroy();leader.movement.position=v(-200);assert.doesNotThrow(()=>view.render(0));assert.equal(view.root.destroyed,true);
});
