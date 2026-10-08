/** Original Hunt sprites + Cat rig + projectile/FX samples. Rectangular Sprite
 * projection and particle sampling are explicit H5 adapters, not URP/PhysX.
 * Source Follow target drives all live projections; zoom transitions NOT_RUN.
 */
import {Assets,Container,Matrix,Sprite,Texture} from 'pixi.js';
import scene from './data/hunt-scene-source.json';
import {SOURCE_HUNT_MONSTER_CONFIG} from './hunt-monster-runtime';
import {sourceHuntMonsterRaycast,SOURCE_HUNT_CAT_CONFIG} from './hunt-cat-runtime';
import {sourceCatCorrectDirectionH5,sourceCatScreenSpeedMultiplierH5} from './source-cat-quaternion';
import {loadCatRigAssets,createCatRigActor,getCatRigProjectionConfig,type CatRigActor,type CatRigAssets} from './cat-rig';
import {sourceHuntCanonicalTransform,SOURCE_HUNT_RIG_NODE_OVERRIDES} from './hunt-equipment-binding';
import {loadProjectileViewAssets,createProjectileView,createMuzzleView,createImpactView,advanceProjectileView,stopProjectileView,type ProjectileView} from './projectile-view';
import type {SourceHuntBattleRuntime,SourceHuntBattleAdapter,SourceHuntBattleCat,SourceHuntBattleEvent} from './hunt-battle-runtime';
import {SourceHuntProjectilePresentation} from './hunt-projectile-presentation';
import type {SourceVector3} from './cat-movement-source';
import {huntRotate,sourceHuntSceneViewport,sourceHuntCameraFollowPosition,SOURCE_HUNT_CAMERA_FOLLOW,HUNT_SCENE_CAMERA_ROTATION,HUNT_SCENE_CAMERA_FORWARD,HUNT_SCENE_CAMERA_RIGHT,HUNT_SCENE_CAMERA_UP} from './hunt-camera-follow';
export {huntRotate,sourceHuntSceneViewport,HUNT_SCENE_CAMERA_ROTATION,HUNT_SCENE_CAMERA_FORWARD,HUNT_SCENE_CAMERA_RIGHT,HUNT_SCENE_CAMERA_UP} from './hunt-camera-follow';
type V=SourceVector3;type Q={x:number;y:number;z:number;w:number};
const q=(a:number[]):Q=>({x:a[0],y:a[1],z:a[2],w:a[3]});
const dot=(a:V,b:V)=>a.x*b.x+a.y*b.y+a.z*b.z;
export function sourceHuntSceneSkinKey(wave:number,variant:0|1):string {
 if(!Number.isInteger(wave)||wave<0||!(variant===0||variant===1))throw RangeError('Invalid Hunt sprite selection');return scene.skins[2*(wave%10)+variant];
}
export const HUNT_SCENE_LIMITATIONS=[...scene.limitations,'Canonical Cat animation reused; distinct serialized AI hand rest TRS retained. Source Animator scheduling NOT_RUN.','Hunt audio is not wired in live adapters; hearing/source comparison NOT_RUN.','Live adapters have no layer0/7 obstacle solids; original masked obstacle scene lifecycle NOT_RUN.'];
type Chain=typeof scene.monster.chain;
function chainPoint(chain:Chain,point:V):V {
 let p=point;
 for(let i=chain.length-1;i>=0;i--){const t=chain[i];p=huntRotate(q(t.rotation),{x:p.x*t.scale[0],y:p.y*t.scale[1],z:p.z*t.scale[2]});p={x:p.x+t.position[0],y:p.y+t.position[1],z:p.z+t.position[2]};}
 return p;
}
const resources=scene.resources as Record<string,{url:string;rect:number[];pivot:number[];pixelsPerUnit:number;texturePixels:number[];textureRectOffset:number[]}>;
export class SourceHuntSceneView {
 readonly root=new Container();readonly grounds=new Container();readonly actors=new Container();readonly fx=new Container();
 readonly rigs=new Map<number,CatRigActor>();readonly monsters=new Map<number,Sprite>();
 readonly projectilePresentation:SourceHuntProjectilePresentation<ProjectileView>;
 private transient:{view:ProjectileView;point:V;age:number}[]=[];
 private textures:Record<string,Texture>={};private base:CatRigAssets|undefined;
 private width:number;private height:number;private projectionStamp='';
 ready=false;private disposed=false;private presentationEnabled=true;
 constructor(readonly host:SourceHuntBattleRuntime,width:number,height:number){this.width=width;this.height=height;this.root.addChild(this.grounds,this.actors,this.fx);this.actors.sortableChildren=true;
  const place=(view:ProjectileView,age:number,point:V)=>{const p=this.project(point);view.position.set(p.x,p.y);advanceProjectileView(view,{ageSeconds:age,rootWorldPosition:point},this.ppw);};
  this.projectilePresentation=new SourceHuntProjectilePresentation({
   create:p=>{const view=createProjectileView(p.settings.gunNum,0,this.ppw,{seed:p.slot*65537+p.generation,cameraRotation:scene.camera.chain[1].rotation as [number,number,number,number],projectOffset:(v,k)=>this.offset(v,k),rootWorldPosition:p.start,rootRotation:[0,Math.sin(Math.atan2(p.velocity.x,p.velocity.z)/2),0,Math.cos(Math.atan2(p.velocity.x,p.velocity.z)/2)],velocityWorldPerSecond:Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)});this.fx.addChild(view);return view;},
   advance:place,stop:(view,age,point)=>stopProjectileView(view,age,this.ppw,point),completed:view=>view.presentation.completed,destroy:view=>view.destroy({children:true})});
 }
 async prepare():Promise<void> {
  const [rig]=await Promise.all([loadCatRigAssets(),loadProjectileViewAssets(),Promise.all(Object.entries(resources).map(async([k,r])=>{this.textures[k]=await Assets.load<Texture>(r.url);}))]);
  if(this.disposed)return;
  this.base=rig;
  for(const ground of scene.grounds){const sprite=new Sprite(this.textures[ground.spriteKey]);sprite.tint=(Math.round(ground.color[0]*255)<<16)|(Math.round(ground.color[1]*255)<<8)|Math.round(ground.color[2]*255);this.grounds.addChild(sprite);this.quad(sprite,ground.spriteKey,ground.chain);}
  for(const cat of this.host.cats){const overrides=SOURCE_HUNT_RIG_NODE_OVERRIDES.find(c=>c.catComponentID===cat.componentID)?.nodeOverrides as unknown as Record<string,{position:number[];rotation:number[];scale:number[]}>;
   const manifest={...rig.manifest,nodes:rig.manifest.nodes.map(n=>({...n,...(overrides?.[n.id]??{})}))} as typeof rig.manifest;
   const actor=createCatRigActor({manifest,textures:rig.textures},{weaponId:cat.gun.gunNum,pixelsPerUnit:this.ppw*manifest.source.unityRootScale});this.rigs.set(cat.componentID,actor);this.actors.addChild(actor.view);this.pose(cat,0,true);
  }
  this.ready=true;this.render(0);
 }
 get cameraRoot():V {return sourceHuntCameraFollowPosition(this.host.cats);}
 projectionState(){const root=this.cameraRoot;return {targetCatComponentID:SOURCE_HUNT_CAMERA_FOLLOW.targetCatComponentID,targetTransformID:SOURCE_HUNT_CAMERA_FOLLOW.targetTransformID,root,leaderViewport:sourceHuntSceneViewport(root,this.width,this.height,root),grounds:this.grounds.children.map(s=>{s.transform.updateLocalTransform();const m=s.localTransform;return {a:m.a,b:m.b,c:m.c,d:m.d,tx:m.tx,ty:m.ty};}),scheduling:SOURCE_HUNT_CAMERA_FOLLOW.h5Scheduling};}
 private refreshProjection():void {
  const c=this.cameraRoot,stamp=[this.width,this.height,c.x,c.y,c.z].join(':');
  if(stamp===this.projectionStamp)return;
  this.grounds.children.forEach((s,i)=>this.quad(s as Sprite,scene.grounds[i].spriteKey,scene.grounds[i].chain));
  this.projectilePresentation.reproject();this.projectionStamp=stamp;
 }
 get ppw():number{return this.height/(scene.camera.orthographicSize*2);}
 project(p:V):{x:number;y:number}{const v=sourceHuntSceneViewport(p,this.width,this.height,this.cameraRoot);return {x:v.x*this.width,y:(1-v.y)*this.height};}
 offset(p:V,scale:number):{x:number;y:number}{return {x:dot(p,HUNT_SCENE_CAMERA_RIGHT)*scale,y:-dot(p,HUNT_SCENE_CAMERA_UP)*scale};}
 private quad(sprite:Sprite,key:string,chain:Chain):void {
  const r=resources[key],w=r.rect[0]/r.pixelsPerUnit,h=r.rect[1]/r.pixelsPerUnit;
  const bottom={x:-w*r.pivot[0],y:-h*r.pivot[1],z:0};
  const tl=this.project(chainPoint(chain,{x:bottom.x,y:bottom.y+h,z:0})),tr=this.project(chainPoint(chain,{x:bottom.x+w,y:bottom.y+h,z:0})),bl=this.project(chainPoint(chain,bottom));
  sprite.transform.setFromMatrix(new Matrix((tr.x-tl.x)/sprite.texture.width,(tr.y-tl.y)/sprite.texture.width,(bl.x-tl.x)/sprite.texture.height,(bl.y-tl.y)/sprite.texture.height,tl.x,tl.y));
 }
 private pose(cat:SourceHuntBattleCat,dt:number,upload:boolean):void {
  const rig=this.rigs.get(cat.componentID)!;
  const hit=cat.target.nearObj,monster=hit?this.host.monsters.current(hit.token):undefined;
  const root=cat.movement.position;
  rig.update({dtSeconds:dt,moving:cat.movement.running,rootWorld:root,camera:{forward:HUNT_SCENE_CAMERA_FORWARD,right:HUNT_SCENE_CAMERA_RIGHT,up:HUNT_SCENE_CAMERA_UP},
   aimWorld:monster?cat.target.nearHitPoint:null,targetWorld:monster?.position??null,gunType:cat.gun.generation.type,movementWorld:cat.movement.bodyVelocity,uploadGeometry:upload});
  const config=getCatRigProjectionConfig(rig.manifest,root,{forward:HUNT_SCENE_CAMERA_FORWARD,right:HUNT_SCENE_CAMERA_RIGHT,up:HUNT_SCENE_CAMERA_UP},this.ppw),p=this.project(config.originWorld),m=config.viewMatrix;
  // Mesh units were constructed for initial ppw; resize scales projection only.
  const initialPPW=rig.pixelsPerUnit/rig.manifest.source.unityRootScale,k=this.ppw/initialPPW;
  rig.view.transform.setFromMatrix(new Matrix(m.a*k,m.b*k,m.c*k,m.d*k,p.x,p.y));rig.view.zIndex=p.y;
 }
 adapter(random:()=>number):SourceHuntBattleAdapter {
  const thisView=this;
  return {get aspect(){return thisView.width/thisView.height;},random,rangeInt:(min,max)=>Math.floor(random()*(max-min))+min,
   project:p=>sourceHuntSceneViewport(p,this.width,this.height,this.cameraRoot),raycast:(...a)=>sourceHuntMonsterRaycast(this.host.monsters,...a),
   movement:{screenSpeedMultiplier:sourceCatScreenSpeedMultiplierH5,correctDirection:sourceCatCorrectDirectionH5,
    // Explicit QA scene: only source ground renderers and layer9 monsters
    // are installed. No layer0/7 solid was inserted. Source obstacle scene
    // lifecycle is NOT verified; do not treat this adapter as original PhysX.
    pathClear:()=>true}
   ,rayOrigin:cat=>{const source=SOURCE_HUNT_CAT_CONFIG.cats.find(c=>c.componentID===cat.componentID)!,t=source.rayTransform.chain[0].position;return {x:cat.movement.position.x+t.x,y:cat.movement.position.y+t.y,z:cat.movement.position.z+t.z};},
   camForward:HUNT_SCENE_CAMERA_FORWARD,beforeAttack:(cat,request)=>{this.rigs.get(cat.componentID)!.faceTowardEnemy(request.nearHitPoint);},
   transformWorld:(cat,id)=>this.rigs.get(cat.componentID)!.getTransformWorld(sourceHuntCanonicalTransform(cat.componentID,id)),afterCatUpdate:(cat,dt)=>this.pose(cat,dt,false)};
  // Closure retains live resize dimensions; never copy initial aspect.
 }
 setPresentationEnabled(enabled:boolean):void {
  if(this.disposed||enabled===this.presentationEnabled)return;
  this.presentationEnabled=enabled;this.root.visible=enabled;
  if(!enabled){this.projectilePresentation.clear();for(const item of this.transient)item.view.destroy({children:true});this.transient=[];}
 }
 consume(events:readonly SourceHuntBattleEvent[],dt=0):void {
  if(this.disposed||!this.presentationEnabled)return;
  this.projectilePresentation.consume(this.host.projectiles.slots,events.flatMap(e=>e.kind==='attack'?e.tokens:[]),dt);
  for(const e of events){
   if(e.kind==='attack'){
    const cat=this.host.cats.find(c=>c.componentID===e.componentID)!,rig=this.rigs.get(cat.componentID)!;rig.fire(false);
    const emit=rig.getMuzzleEmissionTransform();const view=createMuzzleView(cat.gun.gunNum,0,this.ppw,{cameraRotation:scene.camera.chain[1].rotation as [number,number,number,number],projectOffset:(p,k)=>this.offset(p,k),...emit});
    this.fx.addChild(view);this.transient.push({view,point:emit.rootWorldPosition,age:0});
   }else if(e.kind==='projectile'&&(e.event.event.kind==='hit-fx'||e.event.event.kind==='explode')){
    const flight=this.host.projectiles.slots[e.event.token.slot];if(!flight||flight.generation!==e.event.token.generation)continue;
    const point=e.event.event.position,view=createImpactView(flight.settings.gunNum,0,this.ppw,{projectOffset:(p,k)=>this.offset(p,k),rootWorldPosition:point});this.fx.addChild(view);this.transient.push({view,point,age:0});
   }
  }
 }
 render(dt:number):void {
  if(!this.base||this.disposed||!this.presentationEnabled)return;
  this.refreshProjection();
  const active=new Set<number>();
  for(const m of this.host.monsters.activeMonsters()){
   active.add(m.id);const key=sourceHuntSceneSkinKey(this.host.monsters.wave,m.big?1:0);let sprite=this.monsters.get(m.id);
   if(!sprite){sprite=new Sprite(this.textures[key]);this.actors.addChild(sprite);this.monsters.set(m.id,sprite);}else sprite.texture=this.textures[key];
   sprite.visible=true;const chain=scene.monster.chain.map(n=>({...n}));chain[0]={...chain[0],position:[m.position.x,m.position.y,m.position.z]};
   const scale=m.big?SOURCE_HUNT_MONSTER_CONFIG.spriteScale.big:SOURCE_HUNT_MONSTER_CONFIG.spriteScale.small;chain.at(-1)!.scale=scale;this.quad(sprite,key,chain);sprite.zIndex=this.project(m.position).y;
  }
  for(const [id,sprite]of this.monsters)if(!active.has(id))sprite.visible=false;
  for(const cat of this.host.cats)this.pose(cat,0,true);
  this.transient=this.transient.filter(item=>{item.age+=dt;const point=this.project(item.point);item.view.position.set(point.x,point.y);advanceProjectileView(item.view,{ageSeconds:item.age,rootWorldPosition:item.point},this.ppw);if(item.view.presentation.completed||item.age>5){item.view.destroy({children:true});return false;}return true;});
 }
 resize(width:number,height:number):void {this.width=width;this.height=height;this.render(0);}
 destroy():void {if(this.disposed)return;this.disposed=true;this.ready=false;this.projectilePresentation.destroy();this.root.destroy({children:true});this.monsters.clear();this.rigs.clear();this.transient=[];}
}
