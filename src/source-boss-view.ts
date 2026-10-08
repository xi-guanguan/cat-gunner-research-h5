import { Assets, Container, DRAW_MODES, SimpleMesh, Texture } from 'pixi.js';
import {
 SOURCE_BOSS_VIEW_DATA, SOURCE_BOSS_TEXTURE_URLS, applySourceBossFacing, blendSourceBossLocalPose, sampleSourceBossLocalPose,
 sourceBossComposePose, sampleSourceBossMapPose, sourceBossSkinIndex, sourceBossSpriteWorldCorners,
 sourceBossTextureDependencies, sourceBossTransformPoint, sourceBossWorldCollider,
 type SourceBossAnimationState, type SourceBossClipName, type SourceBossLayer, type SourceBossLocalPose,
 type SourceBossPose, type SourceBossViewManifest, type SourceBossWorldPoint,
} from './source-boss-view-data';
export { SOURCE_BOSS_VIEW_DATA, SOURCE_BOSS_TEXTURE_URLS, sourceBossTextureDependencies } from './source-boss-view-data';
export interface SourceBossProjectedPoint {x:number;y:number}
/** Use the same world projection as the actual cat/projectile scene. Every vertex
 * is transformed through original Unity TRS before projection. */
export type SourceBossWorldProjection = (world:SourceBossWorldPoint)=>SourceBossProjectedPoint;
export interface SourceBossViewAssets {manifest:SourceBossViewManifest;textures:Map<string,Texture>}
export interface SourceBossAssetOptions {stage?:number;includeBackground?:boolean;manifest?:SourceBossViewManifest;resolveTextureUrl?:(sourceUrl:string)=>string}
export async function loadSourceBossViewAssets(options:SourceBossAssetOptions={}):Promise<SourceBossViewAssets> {
 const manifest=options.manifest??SOURCE_BOSS_VIEW_DATA,urls=sourceBossTextureDependencies(options.stage,options.includeBackground??true,manifest),requested=new Set(urls),textures=new Map<string,Texture>();
 await Promise.all(Object.entries(manifest.resources).filter(([,r])=>requested.has(r.textureUrl)).map(async([key,r])=>{textures.set(key,await Assets.load<Texture>(options.resolveTextureUrl?.(r.textureUrl)??r.textureUrl));}));
 return {manifest,textures};
}
export interface SourceBossViewOptions {
 projectWorld:SourceBossWorldProjection;stage?:number;worldPosition?:SourceBossWorldPoint;facing?:'left'|'right';
 includeBackground?:boolean;parent?:Container;backgroundParent?:Container;
 /** Defaults to original Animator fixed transition duration .25 seconds. */
 transitionSeconds?:number;
}
export interface SourceBossViewUpdate {
 dtSeconds:number;stage?:number;worldPosition?:SourceBossWorldPoint;facing?:'left'|'right';
 isMoving?:boolean;isDead?:boolean;visible?:boolean;animationState?:SourceBossAnimationState;
 /** Explicit source clip time for replay/debug; omitted means advance normal playback. */
 animationTimeSeconds?:number;headMode?:'normal'|'idle'|'death';
}
export type SourceBossAttachmentName='head'|'body'|'anchorBody'|'anchorWeapon'|'anchorStatus';
interface LayerView {layer:SourceBossLayer;mesh:SimpleMesh;spriteKey:string}
const UV=new Float32Array([0,0,1,0,1,1,0,1]),INDICES=new Uint16Array([0,1,2,0,2,3]);
function makeLayer(assets:SourceBossViewAssets,layer:SourceBossLayer):LayerView {
 const texture=assets.textures.get(layer.spriteKey);if(!texture)throw new Error(`Source Boss texture not loaded: ${layer.spriteKey}`);
 const mesh=new SimpleMesh(texture,new Float32Array(8),new Float32Array(UV),new Uint16Array(INDICES),DRAW_MODES.TRIANGLES);
 mesh.autoUpdate=false;mesh.alpha=layer.color[3];mesh.tint=(Math.round(layer.color[0]*255)<<16)|(Math.round(layer.color[1]*255)<<8)|Math.round(layer.color[2]*255);
 mesh.visible=layer.enabled;mesh.name=`Boss.SpriteRenderer:${layer.renderer}`;return {layer,mesh,spriteKey:layer.spriteKey};
}
/** Original nine source rigs, flattened only after complete 3D hierarchy TRS.
 * Shared Assets textures are owned by the caller/Assets cache and never destroyed. */
export class SourceBossView {
 readonly view=new Container();
 readonly backgroundView=new Container();
 readonly manifest:SourceBossViewManifest;
 private stage:number;private world:SourceBossWorldPoint;private facing:'left'|'right';
 private moving=false;private dead=false;private state:SourceBossAnimationState='Idle';private time=0;
 private layers:LayerView[]=[];private mapLayers:LayerView[]=[];private pose:SourceBossPose;
 private lastLocals:SourceBossLocalPose;private blendFrom:SourceBossLocalPose|undefined;private blendElapsed=0;
 private projection:SourceBossWorldProjection;private transitionSeconds:number;private headOverride:'normal'|'idle'|'death'|undefined;
 private rootProjected:SourceBossProjectedPoint={x:0,y:0};private destroyed=false;
 constructor(private assets:SourceBossViewAssets,options:SourceBossViewOptions){
  this.manifest=assets.manifest;this.stage=options.stage??0;sourceBossSkinIndex(this.stage);
  const world=this.manifest.defaultWorld;this.world=options.worldPosition?{...options.worldPosition}:{x:world[0],y:world[1],z:world[2]};this.facing=options.facing??'left';
  this.projection=options.projectWorld;this.transitionSeconds=options.transitionSeconds??this.manifest.animator.transitionSeconds;
  if(!Number.isFinite(this.transitionSeconds)||this.transitionSeconds<0)throw new RangeError('Invalid source Boss animation transition duration');
  this.view.name='Source.Boss';this.backgroundView.name='Source.Boss.Map_obj';
  this.lastLocals=sampleSourceBossLocalPose(this.stage,'Ready',0,this.facing,this.manifest);this.pose=sourceBossComposePose(this.lastLocals,this.world,this.stage,this.manifest);
  this.selectSkin();
  if(options.includeBackground??true){this.mapLayers=this.manifest.map.layers.map(layer=>makeLayer(assets,layer));this.mapLayers.sort((a,b)=>a.layer.sortingLayer-b.layer.sortingLayer||a.layer.sortingOrder-b.layer.sortingOrder);this.mapLayers.forEach(v=>this.backgroundView.addChild(v.mesh));this.backgroundView.zIndex=this.mapLayers[0]?.layer.sortingOrder??0;}
  options.parent?.addChild(this.view);options.backgroundParent?.addChild(this.backgroundView);this.refresh();
 }
 private selectSkin(){
  const skin=this.manifest.skins[sourceBossSkinIndex(this.stage)];
  // Validate the complete selected skin before replacing any visible rig.
  for(const layer of skin.layers)if(!this.assets.textures.has(layer.spriteKey))throw new Error(`Source Boss texture not loaded: ${layer.spriteKey}`);
  for(const keys of Object.values(this.manifest.heads))if(!this.assets.textures.has(keys[skin.index]))throw new Error(`Source Boss head texture not loaded: ${keys[skin.index]}`);
  this.layers.forEach(v=>v.mesh.destroy());this.layers=skin.layers.map(layer=>makeLayer(this.assets,layer));
  this.layers.sort((a,b)=>a.layer.sortingLayer-b.layer.sortingLayer||a.layer.sortingOrder-b.layer.sortingOrder);this.layers.forEach(v=>this.view.addChild(v.mesh));
 }
 /** Death is kept at its exact final key. No gameplay transaction is performed here. */
 update(input:SourceBossViewUpdate){
  if(this.destroyed)throw new Error('Source Boss view is destroyed');
  const dt=input.dtSeconds;if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid source Boss delta time');
  let changedSkin=false;
  if(input.stage!==undefined&&input.stage!==this.stage){sourceBossSkinIndex(input.stage);const oldStage=this.stage;this.stage=input.stage;try{this.selectSkin();}catch(error){this.stage=oldStage;throw error;}changedSkin=true;this.time=0;this.blendFrom=undefined;}
  if(input.worldPosition)this.world={...input.worldPosition};if(input.facing)this.facing=input.facing;
  if(input.isMoving!==undefined)this.moving=input.isMoving;if(input.isDead!==undefined)this.dead=input.isDead;
  if(input.visible!==undefined)this.view.visible=input.visible;if(input.headMode!==undefined)this.headOverride=input.headMode;
  const next=this.dead?'Death':input.animationState??(this.moving?'Walk':'Idle');
  if(next!==this.state){this.blendFrom=changedSkin?undefined:this.lastLocals;this.blendElapsed=0;this.time=0;this.state=next;}
  const clip=this.manifest.clips[this.manifest.animator.stateClips[this.state]];
  this.time=input.animationTimeSeconds??this.time+dt;
  if(!Number.isFinite(this.time))throw new RangeError('Invalid source Boss animation time');
  this.time=clip.loop?((this.time%clip.duration)+clip.duration)%clip.duration:Math.max(0,Math.min(clip.duration,this.time));
  let locals=sampleSourceBossLocalPose(this.stage,this.manifest.animator.stateClips[this.state],this.time,this.facing,this.manifest);
  if(this.blendFrom&&this.transitionSeconds>0){this.blendElapsed+=dt;const fraction=Math.min(1,this.blendElapsed/this.transitionSeconds);locals=blendSourceBossLocalPose(this.blendFrom,locals,fraction);if(fraction===1)this.blendFrom=undefined;}
  else this.blendFrom=undefined;
  applySourceBossFacing(locals,this.facing,this.manifest);
  this.lastLocals=locals;this.pose=sourceBossComposePose(locals,this.world,this.stage,this.manifest);this.refresh();
 }
 /** Change the caller's world projection after viewport/camera/layout changes. */
 reflow(projectWorld?:SourceBossWorldProjection){if(this.destroyed)return;if(projectWorld)this.projection=projectWorld;this.refresh();}
 private drawLayer(v:LayerView,matrices:Map<number,number[]>,origin:SourceBossProjectedPoint){
  const m=matrices.get(v.layer.node);if(!m)throw new Error(`Missing Boss source transform ${v.layer.node}`);
  const resource=this.manifest.resources[v.spriteKey];const points=sourceBossSpriteWorldCorners(resource,m);const vertices=v.mesh.vertices;
  points.forEach((world,i)=>{const screen=this.projection(world);if(!Number.isFinite(screen.x)||!Number.isFinite(screen.y))throw new RangeError('Invalid source Boss projected point');vertices[2*i]=screen.x-origin.x;vertices[2*i+1]=screen.y-origin.y;});
  v.mesh.geometry.getBuffer('aVertexPosition').update();
 }
 private refresh(){
  this.rootProjected=this.projection(this.world);this.view.position.set(this.rootProjected.x,this.rootProjected.y);
  const skin=this.manifest.skins[sourceBossSkinIndex(this.stage)],mode=this.dead?'death':this.headOverride??'idle';
  for(const v of this.layers){if(v.layer.renderer===skin.headRenderer){const key=this.manifest.heads[mode][skin.index],texture=this.assets.textures.get(key);if(!texture)throw new Error(`Source Boss head not loaded: ${key}`);if(v.spriteKey!==key){v.mesh.texture=texture;v.spriteKey=key;}}
   this.drawLayer(v,this.pose.matrices,this.rootProjected);
  }
  if(this.mapLayers.length){const mapOrigin=this.manifest.map.worldOrigin,origin=this.projection({x:mapOrigin[0],y:mapOrigin[1],z:mapOrigin[2]}),matrices=sampleSourceBossMapPose(this.manifest);this.backgroundView.position.set(origin.x,origin.y);this.mapLayers.forEach(v=>this.drawLayer(v,matrices,origin));}
 }
 getAttachment(name:SourceBossAttachmentName){
  const skin=this.manifest.skins[sourceBossSkinIndex(this.stage)];let node:number|undefined;
  if(name==='head')node=skin.layers.find(layer=>layer.renderer===skin.headRenderer)?.node;
  else node=skin.nodes.find(id=>this.manifest.nodes.find(n=>n.id===id)?.name===({body:'Body',anchorBody:'AnchorBody',anchorWeapon:'AnchorWeapon',anchorStatus:'AnchorStatus'} as const)[name]);
  if(node===undefined)throw new Error(`Missing Boss source attachment ${name}`);
  const world=sourceBossTransformPoint(this.pose.matrices.get(node)!),projected=this.projection(world),screen=this.view.toGlobal({x:projected.x-this.rootProjected.x,y:projected.y-this.rootProjected.y});return {node,world,projected,screen:{x:screen.x,y:screen.y}};
 }
 getCollider(){return sourceBossWorldCollider(this.world,this.manifest);}
 get currentSkin(){return this.manifest.skins[sourceBossSkinIndex(this.stage)];}
 get animationComplete(){const clip=this.manifest.clips[this.manifest.animator.stateClips[this.state]];return !clip.loop&&this.time>=clip.duration;}
 debugPose(){return {stage:this.stage,skin:this.currentSkin.name,state:this.state,timeSeconds:this.time,worldPosition:{...this.world},facing:this.facing,headMode:this.dead?'death':this.headOverride??'idle',layerCount:this.layers.length,backgroundLayers:this.mapLayers.length,animationComplete:this.animationComplete,sourceController:this.manifest.source.controller,notSpine:this.manifest.source.notSpine};}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.view.destroy({children:true});this.backgroundView.destroy({children:true});this.layers=[];this.mapLayers=[];}
}
export function createSourceBossView(assets:SourceBossViewAssets,options:SourceBossViewOptions){return new SourceBossView(assets,options);}
