/** Actual mode5 world/rig/socket/flight consumer for the single-clock owner.
 * Original resources only; explicit H5 sphere queries/affine quads/FX samples.
 * Dynamic zoom, Animator/Bounce/shader/particle and source audio parity NOT_RUN.
 */
import {Assets,Container,Matrix,Sprite,Texture} from 'pixi.js';
import camera from './data/raid-camera-source.json';
import {SOURCE_RAID_SCENE,sourceRaidScenePieces,sourceRaidChainPoint,type SourceRaidTransformChain} from './raid-scene-geometry';
import {sourceRaidCameraFollowPosition,sourceRaidSceneViewport,RAID_SCENE_CAMERA_FORWARD,RAID_SCENE_CAMERA_RIGHT,RAID_SCENE_CAMERA_UP} from './raid-camera-follow';
import {sourceRaidEnemyRaycast,type SourceRaidCatRuntime,type SourceRaidCatAdapter,type SourceRaidCat,type SourceRaidCatAttackEvent} from './raid-cat-runtime';
import {LocalTestRaidRandom,sourceRaidCatStartRandom,sourceRaidCatFidgetRandom} from './raid-cat-random';
import {bindSourceRaidEquipment} from './raid-equipment-binding';
import {sourceCatCorrectDirectionH5,sourceCatScreenSpeedMultiplierH5,sourceCatRotateVector,SOURCE_CAT_JOYSTICK_YAW_H5} from './source-cat-quaternion';
import {SOURCE_HUNT_CAT_CONFIG} from './hunt-cat-runtime';
import {loadCatRigAssets,createCatRigActor,getCatRigProjectionConfig,type CatRigActor} from './cat-rig';
import {sourceHuntCanonicalTransform,SOURCE_HUNT_RIG_NODE_OVERRIDES} from './hunt-equipment-binding';
import {loadProjectileViewAssets,createProjectileView,createMuzzleView,createImpactView,advanceProjectileView,stopProjectileView,type ProjectileView} from './projectile-view';
import {SourceHuntProjectilePresentation} from './hunt-projectile-presentation';
import type {SourceRaidBattleRuntime,SourceRaidBattleEvent} from './raid-battle-runtime';
import type {SourceHuntFlightEvent} from './hunt-projectile-flight';
import type {SourceVector3} from './cat-movement-source';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceRaidSelection} from './r6-raid';
type V=SourceVector3;
const dot=(a:V,b:V)=>a.x*b.x+a.y*b.y+a.z*b.z;
const resources=SOURCE_RAID_SCENE.sprites as Record<string,typeof SOURCE_RAID_SCENE.sprites[keyof typeof SOURCE_RAID_SCENE.sprites]>;
export const RAID_SCENE_LIMITATIONS=[...camera.limitations,'Original five Boss multipart sprites/TRS consumed; Bounce/Animator/particles/material behavior and source audio NOT_RUN.','Analytic layer7 Boss sphere participates in enemy AND masked obstacle queries. Other mode5 dynamic solids/device physics NOT_RUN.','Source Cat draw/reseed order retained with visible local-test-xorshift32; no Unity RNG/InstanceID equivalence.','Canonical source Cat rig and distinct AI rest nodes; H5 rig/FX scheduling is an adapter.'];
export class SourceRaidSceneView {
 readonly root=new Container();readonly grounds=new Container();readonly actors=new Container();readonly fx=new Container();
 readonly rigs=new Map<number,CatRigActor>();readonly rng=new LocalTestRaidRandom();
 readonly bindings:ReturnType<typeof bindSourceRaidEquipment>;
 readonly projectilePresentation:SourceHuntProjectilePresentation<ProjectileView>;
 private cats:SourceRaidCatRuntime|null=null;
 private readonly pieces:ReturnType<typeof sourceRaidScenePieces>;
 private readonly sprites:Sprite[]=[];
 private transient:{view:ProjectileView;point:V;age:number}[]=[];
 private width:number;private height:number;private disposed=false;private presentationEnabled=true;private projectionStamp='';
 ready=false;attackCount=0;readonly attackByCat=new Map<number,number>();readonly hitsByCat=new Map<number,number>();
 private readonly projectileOwners=new Map<number,{generation:number;componentID:number}>();
 constructor(readonly host:SourceRaidBattleRuntime,bundle:SourceMetaBundle,selection:SourceRaidSelection,readonly skinIndex:number,width:number,height:number){
  this.bindings=bindSourceRaidEquipment(bundle,selection,host.weakType);this.pieces=sourceRaidScenePieces(skinIndex);this.width=width;this.height=height;
  this.root.addChild(this.grounds,this.actors,this.fx);this.actors.sortableChildren=true;this.grounds.sortableChildren=true;
  const place=(view:ProjectileView,age:number,point:V)=>{const p=this.project(point);view.position.set(p.x,p.y);advanceProjectileView(view,{ageSeconds:age,rootWorldPosition:point},this.ppw);};
  this.projectilePresentation=new SourceHuntProjectilePresentation({create:p=>{
   const view=createProjectileView(p.settings.gunNum,0,this.ppw,{seed:p.slot*65537+p.generation,cameraRotation:camera.camera.chain[1].rotation as [number,number,number,number],projectOffset:(v,k)=>this.offset(v,k),rootWorldPosition:p.start,rootRotation:[0,Math.sin(Math.atan2(p.velocity.x,p.velocity.z)/2),0,Math.cos(Math.atan2(p.velocity.x,p.velocity.z)/2)],velocityWorldPerSecond:Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)});this.fx.addChild(view);return view;},advance:place,stop:(view,age,point)=>stopProjectileView(view,age,this.ppw,point),completed:view=>view.presentation.completed,destroy:view=>view.destroy({children:true})});
 }
 async prepare():Promise<void>{
  const keys=[...new Set(this.pieces.map(p=>p.renderer.spriteKey))],textures:Record<string,Texture>={};
  const [base]=await Promise.all([loadCatRigAssets(),loadProjectileViewAssets(),Promise.all(keys.map(async k=>{textures[k]=await Assets.load<Texture>(resources[k].url);}))]);
  if(this.disposed)return;
  for(const p of this.pieces){const s=new Sprite(textures[p.renderer.spriteKey]);s.tint=(Math.round(p.renderer.color[0]*255)<<16)|(Math.round(p.renderer.color[1]*255)<<8)|Math.round(p.renderer.color[2]*255);s.alpha=p.renderer.color[3];s.zIndex=p.renderer.sortingOrder;this.grounds.addChild(s);this.sprites.push(s);}
  for(const cat of this.bindings){const mapping=SOURCE_HUNT_RIG_NODE_OVERRIDES.find(c=>c.catComponentID===cat.componentID);if(!mapping)throw RangeError(`Unbound source Raid rig ${cat.componentID}`);
   const overrides=mapping.nodeOverrides as unknown as Record<string,{position:number[];rotation:number[];scale:number[]}>;
   const manifest={...base.manifest,nodes:base.manifest.nodes.map(n=>({...n,...(overrides?.[n.id]??{})}))} as typeof base.manifest;
   const actor=createCatRigActor({manifest,textures:base.textures},{weaponId:cat.gun.gunNum,pixelsPerUnit:this.ppw*manifest.source.unityRootScale});this.rigs.set(cat.componentID,actor);this.actors.addChild(actor.view);
  }
  this.ready=true;this.refreshProjection();
 }
 bindCats(cats:SourceRaidCatRuntime){if(cats.host!==this.host)throw RangeError('Foreign Raid view host');this.cats=cats;if(this.ready)for(const cat of cats.cats)this.pose(cat,0,false);}
 followSettings(){const settings=new Map();for(const cat of this.bindings)if(cat.isAI)settings.set(cat.componentID,sourceRaidCatStartRandom(cat.componentID,this.rng));return settings;}
 get cameraRoot():V{return sourceRaidCameraFollowPosition(this.cats?.cats??this.bindings.map(c=>({componentID:c.componentID,movement:{position:c.position}})));}
 get ppw():number{return this.height/(2*camera.camera.orthographicSize);}
 project(p:V){const v=sourceRaidSceneViewport(p,this.width,this.height,this.cameraRoot);return {x:v.x*this.width,y:(1-v.y)*this.height};}
 private offset(p:V,k:number){return {x:dot(p,RAID_SCENE_CAMERA_RIGHT)*k,y:-dot(p,RAID_SCENE_CAMERA_UP)*k};}
 private quad(sprite:Sprite,key:string,chain:SourceRaidTransformChain,flipX:boolean,flipY:boolean):void{
  const r=resources[key],w=r.rect.width/r.pixelsPerUnit,h=r.rect.height/r.pixelsPerUnit;
  const point=(x:number,y:number)=>this.project(sourceRaidChainPoint(chain,{x:flipX?-x:x,y:flipY?-y:y,z:0}));
  const x=-w*r.pivot[0],y=-h*r.pivot[1],tl=point(x,y+h),tr=point(x+w,y+h),bl=point(x,y);
  sprite.transform.setFromMatrix(new Matrix((tr.x-tl.x)/sprite.texture.width,(tr.y-tl.y)/sprite.texture.width,(bl.x-tl.x)/sprite.texture.height,(bl.y-tl.y)/sprite.texture.height,tl.x,tl.y));
 }
 private refreshProjection():void{const p=this.cameraRoot,stamp=[this.width,this.height,p.x,p.y,p.z].join(':');if(stamp===this.projectionStamp)return;
  this.pieces.forEach((p,i)=>this.quad(this.sprites[i],p.renderer.spriteKey,p.object.transformChain,p.renderer.flipX,p.renderer.flipY));this.projectilePresentation.reproject();this.projectionStamp=stamp;
 }
 private pose(cat:SourceRaidCat,dt:number,upload:boolean):void{
  const rig=this.rigs.get(cat.componentID)!;const hit=cat.target.nearObj,target=hit&&this.host.boss.current(hit.token)?hit.transformPosition:null,root=cat.movement.position;
  const basis={forward:RAID_SCENE_CAMERA_FORWARD,right:RAID_SCENE_CAMERA_RIGHT,up:RAID_SCENE_CAMERA_UP};
  // Even in eco: sample source bones/socket math, but no geometry upload/draw.
  rig.update({dtSeconds:dt,moving:cat.movement.running,rootWorld:root,camera:basis,aimWorld:target?cat.target.nearHitPoint:null,targetWorld:target,gunType:cat.gun.generation.type,movementWorld:cat.movement.bodyVelocity,uploadGeometry:upload});
  if(!upload)return;const config=getCatRigProjectionConfig(rig.manifest,root,basis,this.ppw),p=this.project(config.originWorld),m=config.viewMatrix,k=this.ppw/(rig.pixelsPerUnit/rig.manifest.source.unityRootScale);
  rig.view.transform.setFromMatrix(new Matrix(m.a*k,m.b*k,m.c*k,m.d*k,p.x,p.y));rig.view.zIndex=p.y;
 }
 adapter():SourceRaidCatAdapter{return {random:()=>this.rng.unit(),rangeInt:(a,b)=>this.rng.rangeInt(a,b),project:p=>sourceRaidSceneViewport(p,this.width,this.height,this.cameraRoot),raycast:(...args)=>sourceRaidEnemyRaycast(this.host.boss,...args),camForward:RAID_SCENE_CAMERA_FORWARD,
  movement:{screenSpeedMultiplier:sourceCatScreenSpeedMultiplierH5,correctDirection:sourceCatCorrectDirectionH5,pathClear:(...args)=>sourceRaidEnemyRaycast(this.host.boss,...args)===null},
  rotateJoystick:p=>sourceCatRotateVector(SOURCE_CAT_JOYSTICK_YAW_H5,p),sampleFidget:()=>sourceRaidCatFidgetRandom(this.rng),
  rayOrigin:cat=>{const t=SOURCE_HUNT_CAT_CONFIG.cats.find(c=>c.componentID===cat.componentID)!.rayTransform.chain[0].position,p=cat.movement.position;return {x:p.x+t.x,y:p.y+t.y,z:p.z+t.z};},
  transformWorld:(cat,id)=>this.rigs.get(cat.componentID)!.getTransformWorld(sourceHuntCanonicalTransform(cat.componentID,id)),beforeAttack:(cat,request)=>this.rigs.get(cat.componentID)!.faceTowardEnemy(request.nearHitPoint),afterCatUpdate:(cat,dt)=>this.pose(cat,dt,false)};}
 consume(_events:readonly SourceRaidBattleEvent[],flights:readonly SourceHuntFlightEvent[],attacks:readonly SourceRaidCatAttackEvent[],dt:number):void{
  if(this.disposed)return;this.attackCount+=attacks.length;
  // Fire changes recoil/socket pose even without pixels; never queue invisible FX.
  for(const a of attacks){this.attackByCat.set(a.componentID,(this.attackByCat.get(a.componentID)??0)+1);for(const token of a.tokens)this.projectileOwners.set(token.slot,{generation:token.generation,componentID:a.componentID});this.rigs.get(a.componentID)!.fire(false);}
  for(const e of flights){const owner=this.projectileOwners.get(e.token.slot);if(owner?.generation===e.token.generation&&(e.event.kind==='direct-damage'||e.event.kind==='blast-damage'))this.hitsByCat.set(owner.componentID,(this.hitsByCat.get(owner.componentID)??0)+1);}
  if(!this.presentationEnabled)return;
  this.projectilePresentation.consume(this.host.projectiles.slots,attacks.flatMap(a=>a.tokens),dt);
  for(const a of attacks){const cat=this.bindings.find(c=>c.componentID===a.componentID)!,emit=this.rigs.get(a.componentID)!.getMuzzleEmissionTransform(),view=createMuzzleView(cat.gun.gunNum,0,this.ppw,{cameraRotation:camera.camera.chain[1].rotation as [number,number,number,number],projectOffset:(p,k)=>this.offset(p,k),...emit});this.fx.addChild(view);this.transient.push({view,point:emit.rootWorldPosition,age:0});}
  for(const e of flights)if(e.event.kind==='hit-fx'||e.event.kind==='explode'){const flight=this.host.projectiles.slots[e.token.slot];if(!flight||flight.generation!==e.token.generation)continue;const point=e.event.position,view=createImpactView(flight.settings.gunNum,0,this.ppw,{projectOffset:(p,k)=>this.offset(p,k),rootWorldPosition:point});this.fx.addChild(view);this.transient.push({view,point,age:0});}
 }
 render(dt:number,cats:SourceRaidCatRuntime):void{
  if(this.disposed)return;this.cats=cats;if(!this.ready||!this.presentationEnabled)return;this.refreshProjection();
  for(const cat of cats.cats)this.pose(cat,0,true);
  this.transient=this.transient.filter(item=>{item.age+=dt;const p=this.project(item.point);item.view.position.set(p.x,p.y);advanceProjectileView(item.view,{ageSeconds:item.age,rootWorldPosition:item.point},this.ppw);if(item.view.presentation.completed||item.age>5){item.view.destroy({children:true});return false;}return true;});
 }
 projectionState(){return {root:this.cameraRoot,targetCat:camera.follow.targetCatComponentID,targetTransform:camera.follow.targetTransformID,skinIndex:this.skinIndex,sourcePieces:this.pieces.map(p=>p.object.path),rng:this.rng.identity,transient:this.transient.length,visible:this.presentationEnabled};}
 setPresentationEnabled(enabled:boolean){if(this.disposed||enabled===this.presentationEnabled)return;this.presentationEnabled=enabled;this.root.visible=enabled;if(!enabled){this.projectilePresentation.clear();for(const t of this.transient)t.view.destroy({children:true});this.transient=[];}}
 resize(width:number,height:number){if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw RangeError('Invalid Raid view size');this.width=width;this.height=height;if(this.cats)this.render(0,this.cats);}
 destroy(){if(this.disposed)return;this.disposed=true;this.ready=false;this.projectilePresentation.destroy();this.root.destroy({children:true});this.rigs.clear();this.transient=[];}
}
