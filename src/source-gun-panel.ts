import {sourceAdGunTimeText} from './r6-adgun';
import {sourceStepUpVisible,sourceStepUpCurrent,sourceStepUpTimeText,freshSourceStepUp,SOURCE_STEPUP} from './r6-stepup';
import stepupScene from './data/r6-stepup-ui.json';
import degreeColors from './data/r6-gun-degree-colors.json';
import {sourceGunDetailRef,sourceGunSafeUnlocked} from './r6-gun-storage';
import {sourceStarUnlocked} from './r6-star';
import { Container, Graphics, Matrix, Sprite, type Texture, type FederatedPointerEvent } from 'pixi.js';
import { SourceMotion, SourceBounceMotion, SOURCE_GUN_PANEL_BOUNCE, SOURCE_GUN_PRESS, SOURCE_GUN_RELEASE_SECONDS } from './source-motion';
import { GunDragController, gunEntityRef, gunEntityUID, raycastGunTargets, type GunDropRequest, type GunHover, type GunDropTarget, type GunLocationKind, type DragPoint } from './gun-drag';
import { createSourceUiView, sourceUiTree, type SourceUiView, type SourceUiNode, type SourceUiViewport, type SourceUiTransformOverride } from './source-ui';
import { sourceGunID, GUN_GACHA_COST, type Session, type Gun } from './session';
import guns from './data/guns.json';
import { walletValue } from './rules';
import { createSourceGunAutoDelay, createSourceGunAutoMergeScheduler, freshSourceGunAutoMerge, sourceGunAutoPool, type SourceGunAutoMergeState, type SourceGunAutoDelay, type SourceGunAutoPair } from './r5-gun-auto';

const ADAPTER_GUN_RETURN_SECONDS=.15;
const gunAutoDelayByAction=new WeakMap<SourceGunPanelOptions['action'],SourceGunAutoDelay>();
export interface SourceGunPanelAutoMerge {state:SourceGunAutoMergeState;plusPack2Active:boolean;weeklyVipUnlocked:boolean}

/** Action contract: ad-daily-gun has no payload; the host uses SourceGunDailyClient
 * with its current bundle, explicit local date/provider and callback-time inventory checks.
 * The panel never assumes eligibility or grants a reward itself. */
export interface SourceGunPanelOptions {
  textures: Record<string, Texture>; viewport: SourceUiViewport; session: Session;
  /** Host notice displayed in the original equipment guide, without changing its rectangle. */
  notice?:string;
  nowUTC?:number;
  /** Gun_manager.Is_AD_Daily_Gun_Able; host supplies server/history/calendar state. */
  adDailyGunVisible?:boolean;
  /** Host state; native button visibility is the independent WeeklyShop VIP unlock gate. */
  autoMerge?:SourceGunPanelAutoMerge;
  /** gun-auto-set:boolean; gun-auto-shop:no payload; gun-auto-fuse:SourceGunAutoCommit. */
  action(name:string,payload?:unknown):void;
  /** Native surface binding is optional for fixtures; host should pass its canvas. */
  pointerSurface?:HTMLCanvasElement;
  clientToUi?:(clientX:number,clientY:number)=>DragPoint;
}
export interface SourceGunPanelView extends SourceUiView {
  inventorySlots:string[]; equipmentSlots:string[];
  sync(options:Pick<SourceGunPanelOptions,'session'|'notice'|'adDailyGunVisible'|'autoMerge'|'nowUTC'>):void;
  connectPointer(canvas:HTMLCanvasElement,clientToUi?:(x:number,y:number)=>DragPoint):()=>void;
  resolveDrop(accepted:boolean,notice?:string):void;
  cancelDrag():void;
  /** Host calls for rejected gun-auto-fuse; accepted inventory sync clears its guard. */
  resolveAutoMerge(accepted:boolean):void;
  /** Call after sync for a confirmed acquisition/fusion, never ordinary ReloadList. */
  playSpawnBounceAtSlot(index:number):boolean;
  readonly dragState:GunDragController['state'];
  readonly pendingDrop:GunDropRequest|null;
}
/** Original Gun_Item pool and its separately serialized SlotTransforms. */
export function createSourceGunPanel(options:SourceGunPanelOptions):SourceGunPanelView {
  const nodes=sourceUiTree.nodes, byID=new Map(nodes.map(n=>[n.id,n]));
  const go=(id:number)=>byID.get(`level0:${id}`)!;
  const componentRef=(ref:any):SourceUiNode|undefined=>nodes.find(n=>n.file==='level0'&&n.components.some(c=>c.pathID===(Array.isArray(ref)?ref[1]:ref?.m_PathID)));
  const objectRef=(ref:any)=>go(Array.isArray(ref)?ref[1]:ref?.m_PathID);
  const transformRef=(ref:any)=>nodes.find(n=>n.file==='level0'&&n.transformPathID===ref[1]);
  const list=go(1624).components.find(c=>c.kind==='Gun_Item_List')!.data!;
  const pool:SourceUiNode[]=list.Gun_Item_Pool.map(componentRef);
  const slots:SourceUiNode[]=list.SlotTransforms.map(transformRef);
  if(pool.length!==16||slots.length!==16||pool.some(n=>!n)||slots.some(n=>!n))throw new Error('Source gun pool/slot references incomplete');
  const active:Record<string,boolean>={},text:Record<string,string>={},art=new Map<string,string>(),transforms:Record<string,SourceUiTransformOverride>={};
  const show=(n:SourceUiNode|undefined,value:boolean)=>{if(n)active[n.id]=value;};
  const descendants=(root:SourceUiNode)=>nodes.filter(n=>{let p=n.parent;while(p){if(p===root.id)return true;p=byID.get(p)?.parent??null;}return false;});
  const named=(root:SourceUiNode,name:string)=>descendants(root).find(n=>n.name===name);
  const bindGun=(gun:Gun,img:SourceUiNode|undefined,type:SourceUiNode|undefined,degrees:SourceUiNode[])=>{
    const id=sourceGunID(gun),raw=guns.guns.find(g=>g.sourceID===id);
    if(img&&raw)art.set(img.id,raw.spriteURL);
    if(type)text[type.id]=['单发','激光','穿透','散弹','爆破','导弹','爆狙'][raw?.type??gun.sourceType??0]??String(raw?.type??gun.sourceType??0);
    // Native CheckOverlap compares GunNum / 5; catalogue contains 13 groups of 5.
    degrees.forEach((n,i)=>show(n,!!raw&&i===Math.floor(raw.sourceID/5)));
  };
  // Activate the serialized modal branch only; all descendants retain original structure.
  let ancestor:SourceUiNode|undefined=go(2235);while(ancestor){show(ancestor,true);ancestor=ancestor.parent?byID.get(ancestor.parent):undefined;}
  // SlotTransforms are empty background placeholders, never inventory renderers.
  // Hide any serialized sample subtree while preserving each original slot Image.
  slots.forEach(slot=>descendants(slot).forEach(child=>show(child,false)));
  show(go(1491),options.adDailyGunVisible===true); // AD_Draw_Btn_Reload; ordinary Draw remains active.
  show(go(1128),sourceStepUpVisible(options.session,options.nowUTC??Date.now()));
  show(named(go(2027),'Locked_obj'),!sourceGunSafeUnlocked(options.session.historicMax));
  const initialAutoActive=options.autoMerge?.plusPack2Active===true&&options.autoMerge.state.autoMergeRequested;
  show(go(17341),options.autoMerge?.weeklyVipUnlocked===true);show(go(10362),initialAutoActive);show(go(10186),!initialAutoActive);
  show(go(11925),initialAutoActive);show(go(30327),!initialAutoActive);text[go(10362).id]='已获得更高阶级的武器可自动合成';text[go(14477).id]='自动合成';
  const translations:Record<string,string>={10175:'拖动武器装备',10213:'抽取武器',10261:'图鉴',10186:'拖动同级武器合成',10278:'信息',10393:'保险库'};
  for(const [id,value] of Object.entries(translations))text[go(Number(id)).id]=value;
  text[go(5793).id]=String(options.session.diamonds); // Currency/Dia/Price_txt, TMP component 119569.
  text[go(17254).id]=walletValue(options.session.battle).format();
  if(options.notice?.trim())text[go(10175).id]=options.notice.trim();
  text[go(1106).id]=`<sprite=1>${GUN_GACHA_COST}`;
  show(go(1558),true); // GunList_UI is serialized inactive and opened by the original runtime.
  pool.forEach((n,index)=>{
    const data=n.components.find(c=>c.kind==='Gun_Item')!.data!,gun=options.session.gunInventory[index];
    show(n,!!gun);
    const slot=slots[index],parent=byID.get(n.parent!)!,slotParent=byID.get(slot.parent!)!;
    // Both original parents share anchors/pivot; account for their four-unit origin difference.
    if(slot.rect&&parent.rect&&slotParent.rect)transforms[n.id]={anchorMin:slot.rect.anchorMin,anchorMax:slot.rect.anchorMax,anchoredPosition:[slot.rect.anchoredPosition[0]+slotParent.rect.anchoredPosition[0]-parent.rect.anchoredPosition[0],slot.rect.anchoredPosition[1]+slotParent.rect.anchoredPosition[1]-parent.rect.anchoredPosition[1]]};
    ['FusionAble_obj','Pause_obj','AD_Reward_obj','AutoMerge_obj'].forEach(k=>show(objectRef(data[k]),false));
    show(objectRef(data.Pause_obj),gun?.paused===true);show(objectRef(data.AD_Reward_obj),gun?.adReward===true);
    const adText=componentRef(data.AD_Time_txt);if(adText&&gun?.adReward)text[adText.id]=sourceAdGunTimeText(options.session,options.nowUTC??Date.now());
    if(gun){bindGun(gun,componentRef(data.Gun_img),componentRef(data.Type_txt),data.Degree_objs.map(objectRef));const shadow=componentRef(data.Shadow_img),raw=guns.guns.find(g=>g.sourceID===sourceGunID(gun));if(shadow&&raw)art.set(shadow.id,raw.spriteURL);}
  });
  const equipment=[4250,6047,6046].map(go);
  equipment.forEach((n,index)=>{
    const gun=options.session.equippedGuns[index];
    // Source slot stars are not weapon catalogue degree; even empty slots can be upgraded.
    show(named(n,'Star'),sourceStarUnlocked(options.session.historicMax));
    const starLv=named(n,'Star')&&named(named(n,'Star')!,'StarLv_txt');if(starLv)text[starLv.id]=String(options.session.bossSlotLevels?.[index]??0);
    show(named(n,'Selected'),!!gun);show(named(n,'UnSelected'),!gun);show(named(n,'FusionAble_obj'),false);show(named(n,'Pause_obj'),gun?.paused===true);
    if(gun){const degree=named(n,'Degree (1)');bindGun(gun,named(n,'Gun_img'),named(n,'Type_txt'),degree?nodes.filter(x=>x.parent===degree.id):[]);
      const damage=named(n,'Damage'),speed=named(n,'Speed');const d=damage&&named(damage,'Value_txt'),s=speed&&named(speed,'Value_txt');if(d)text[d.id]=gun.damageValue?.format()??String(gun.damage);if(s)text[s.id]=String(Number(gun.intervalSeconds.toFixed(3)));
    }
  });
  const tree={...sourceUiTree,nodes:nodes.map(n=>({...n,components:n.components.map(c=>c.kind==='Image'?{...c,data:{...c.data,...(art.has(n.id)?{textureURL:art.get(n.id)}:{})}}:c)}))};
  const view=createSourceUiView({textures:options.textures,viewport:options.viewport,roots:[2235],tree,active,text,transforms}) as SourceGunPanelView;
  view.inventorySlots=pool.map(n=>n.id);view.equipmentSlots=equipment.map(n=>n.id);
  view.addDiagnostic('Gun_Item pool placement follows ReloadList → AlignGrid → GetSlotPosition; evidence: ui-gun-runtime.json.');
  // Local content updates keep Button instances, masks and pointer listeners alive.
  const liveNodes=new Map(tree.nodes.map(n=>[n.id,n]));
  let currentSession=options.session,currentAuto=options.autoMerge,disposed=false,lastLayout=view.layout;
  const autoDelay=gunAutoDelayByAction.get(options.action)??createSourceGunAutoDelay();gunAutoDelayByAction.set(options.action,autoDelay);
  const autoScheduler=createSourceGunAutoMergeScheduler(autoDelay),autoReserved=new Set<number>();
  let autoVisual:{box:Container;parent:Container;index:number;matrix:Matrix;origin:DragPoint;sourceOrigin:DragPoint;scale:number}|null=null;
  const controller=new GunDragController(),overlay=new Container(),highlight=new Graphics();
  overlay.name='SourceGunDragOverlay';overlay.eventMode='none';highlight.eventMode='none';
  view.root.addChild(highlight,overlay);
  let dragOrigin:DragPoint|null=null,safeHover=false;
  let pending:GunDropRequest|null=null,surface:HTMLCanvasElement|undefined,convert:((x:number,y:number)=>DragPoint)|undefined,disconnect:(()=>void)|undefined;
  type Visual={box:Container;parent:Container;index:number;matrix:Matrix;motion:SourceMotion;origin:DragPoint;offset:DragPoint;rect:{width:number;height:number;scale:number};fromGun:Gun;moved:boolean;returnElapsed?:number;returnStart?:DragPoint};
  let visual:Visual|null=null;
  const slotMotions=pool.map(n=>new SourceMotion(view.get(n.id)!));
  const slotUIDs=pool.map((_,i)=>currentSession.gunInventory[i]?gunEntityUID(currentSession.gunInventory[i]):undefined);
  let activeDirty=true;
  const buttonMotions:Array<{motion:SourceBounceMotion;pointerId:number|null}>=[];
  const releaseButtons=(id?:number)=>{for(const entry of buttonMotions)if(id===undefined||entry.pointerId===id){entry.motion.pointerUp();entry.pointerId=null;}};
  const applyLocalActive=()=>{
    for(const [id,value] of Object.entries(active)){const box=view.get(id);if(box)box.visible=value;const l=view.layout.get(id);if(l)l.selfActive=value;}
    const inherited=(id:string):boolean=>{const n=byID.get(id),own=active[id]??n?.active??true;return own&&(!n?.parent||inherited(n.parent));};
    for(const [id,l]of view.layout)l.active=inherited(id);activeDirty=false;
  };
  const localShow=(n:SourceUiNode|undefined,value:boolean)=>{if(!n||active[n.id]===value)return;active[n.id]=value;activeDirty=true;const box=view.get(n.id);if(box)box.visible=value;const l=view.layout.get(n.id);if(l)l.selfActive=value;};
  const localArt=(n:SourceUiNode|undefined,gun:Gun)=>{
    const raw=guns.guns.find(g=>g.sourceID===sourceGunID(gun));if(!n||!raw)return;
    const node=liveNodes.get(n.id),component=node?.components.find(c=>c.kind==='Image');if(component?.data&&component.data.textureURL!==raw.spriteURL)component.data.textureURL=raw.spriteURL;
    const texture=options.textures[raw.spriteURL];if(!texture)return;
    for(const child of view.getGraphic(n.id)?.children??[]){if(child instanceof Sprite&&child.texture!==texture){const width=child.width,height=child.height;child.texture=texture;child.width=width;child.height=height;}}
  };
  const localGun=(gun:Gun,img:SourceUiNode|undefined,type:SourceUiNode|undefined,degrees:SourceUiNode[])=>{
    localArt(img,gun);if(type)view.setText(type.id,['单发','激光','穿透','散弹','爆破','导弹','爆狙'][gun.sourceType??guns.guns.find(g=>g.sourceID===sourceGunID(gun))?.type??0]??'');
    degrees.forEach((n,i)=>localShow(n,i===Math.floor(sourceGunID(gun)/5)));
  };
  const restoreVisual=()=>{
    if(!visual)return;const v=visual;visual=null;v.motion.reset();v.parent.addChildAt(v.box,Math.min(v.index,v.parent.children.length));v.box.transform.setFromMatrix(v.matrix);highlight.clear();
  };
  const returnVisual=()=>{if(!visual)return;visual.returnStart={x:visual.box.x,y:visual.box.y};visual.returnElapsed=0;if(visual.moved)visual.motion.reset();else visual.motion.release();highlight.clear();};
  const releaseCapture=(id:number)=>{try{if(surface?.hasPointerCapture(id))surface.releasePointerCapture(id);}catch{/* A disconnected canvas can already have released capture. */}};
  const cancel=()=>{releaseButtons();const id=controller.state?.pointerId;controller.cancel();pending=null;if(id!==undefined)releaseCapture(id);returnVisual();};
  const releaseAutoVisual=()=>{
    if(autoVisual){const v=autoVisual;autoVisual=null;v.parent.addChildAt(v.box,Math.min(v.index,v.parent.children.length));v.box.transform.setFromMatrix(v.matrix);}
    for(const index of autoReserved){const data=pool[index]?.components.find(c=>c.kind==='Gun_Item')?.data;localShow(data&&objectRef(data.AutoMerge_obj),false);}
    autoReserved.clear();
  };
  const reserveAuto=(pair:SourceGunAutoPair)=>{
    if(autoReserved.has(pair.mover.slot)&&autoReserved.has(pair.stationary.slot))return;
    releaseAutoVisual();
    for(const index of [pair.stationary.slot,pair.mover.slot]){autoReserved.add(index);slotMotions[index]?.reset();const data=pool[index].components.find(c=>c.kind==='Gun_Item')!.data!;localShow(objectRef(data.AutoMerge_obj),true);}
    const box=view.get(pool[pair.mover.slot].id)!,parent=box.parent,index=parent.getChildIndex(box),matrix=box.localTransform.clone(),world=box.worldTransform.clone(),l=view.layout.get(slots[pair.mover.slot].id)!;
    const local=overlay.worldTransform.clone().invert().append(world);overlay.addChild(box);box.transform.setFromMatrix(local);
    autoVisual={box,parent,index,matrix,origin:{x:box.x,y:box.y},sourceOrigin:{x:(l.x+l.width/2)/l.scale,y:(l.y+l.height/2)/l.scale},scale:l.scale};
  };
  const resetAuto=()=>{autoScheduler.reset();releaseAutoVisual();};
  const targetList=():GunDropTarget[]=>[
    ...slots.map((slot,index)=>{const l=view.layout.get(slot.id)!,gun=currentSession.gunInventory[index];return {ref:{kind:'inventory' as const,index,...(gun?{uid:gunEntityUID(gun),sourceID:sourceGunID(gun),paused:(gun as Gun&{paused?:boolean}).paused,adReward:(gun as Gun&{adReward?:boolean}).adReward,autoMerging:autoReserved.has(index)}:{})},rect:{x:l.x,y:l.y,width:l.width,height:l.height}};}),
    ...equipment.map((n,index)=>{const l=view.layout.get(n.id)!,gun=currentSession.equippedGuns[index];return {ref:{kind:'equipment' as const,index,...(gun?{uid:gunEntityUID(gun),sourceID:sourceGunID(gun)}:{})},rect:{x:l.x,y:l.y,width:l.width,height:l.height}};})
  ];
  const showHover=(hover:GunHover)=>{
    highlight.clear();if(!hover.target||['none','self'].includes(hover.type))return;
    const target=targetList().find(t=>t.ref.kind===hover.target?.kind&&t.ref.index===hover.target.index);if(!target)return;
    const r=target.rect,color=hover.type==='fuse'?0xffd956:hover.type==='reject'?0xe96161:0x85d9ef;
    // Colour indicates interaction state; exact native material is not recovered.
    highlight.lineStyle(3,color,.95).drawRoundedRect(r.x,r.y,r.width,r.height,8);
  };
  const movePointer=(id:number,p:DragPoint)=>{
    if(!visual||controller.state?.pointerId!==id)return;
    const threshold=surface?6*options.viewport.width/surface.getBoundingClientRect().width:6;
    if(!visual.moved){if(!dragOrigin||Math.hypot(p.x-dragOrigin.x,p.y-dragOrigin.y)<threshold)return;visual.moved=true;visual.motion.reset();}
    const safe=view.layout.get('level0:2027');safeHover=controller.state.from.kind==='inventory'&&sourceGunSafeUnlocked(currentSession.historicMax)&&!!safe?.active&&p.x>=safe.x&&p.x<=safe.x+safe.width&&p.y>=safe.y&&p.y<=safe.y+safe.height;
    visual.box.position.set(p.x+visual.offset.x,p.y+visual.offset.y);
    const r=visual.rect,carried={x:visual.box.x-r.width/2,y:visual.box.y-r.height/2,width:r.width,height:r.height};
    const inside=p.x>=0&&p.y>=0&&p.x<=options.viewport.width&&p.y<=options.viewport.height;
    const target=inside?raycastGunTargets(controller.state.from,p,carried,targetList(),40,r.scale):undefined;
    controller.move(id,p,target);showHover(controller.state!.hover);
  };
  const endPointer=(id:number,p:DragPoint)=>{
    if(controller.state?.pointerId!==id)return;movePointer(id,p);
    const from=controller.state!.from,tapped=!visual?.moved,deposit=safeHover&&visual?.moved;
    const hover=controller.state!.hover,request=controller.end(id);releaseCapture(id);safeHover=false;dragOrigin=null;
    if(tapped){restoreVisual();const gun=from.kind==='inventory'?currentSession.gunInventory[from.index]:currentSession.equippedGuns[from.index];if(gun?.adReward){options.action('ad-temporary-gun');return;}const ref=sourceGunDetailRef(currentSession,from.kind,from.index);if(ref)options.action('gun-info-open',ref);return;}
    if(deposit){restoreVisual();options.action('gun-safe-deposit',from);return;}
    const dragged=from.kind==='inventory'?currentSession.gunInventory[from.index]:currentSession.equippedGuns[from.index];const target=hover.target,targetGun=target?.kind==='inventory'?currentSession.gunInventory[target.index]:target?.kind==='equipment'?currentSession.equippedGuns[target.index]:null;
    if(dragged?.adReward||targetGun?.adReward){restoreVisual();options.action('ad-temporary-gun');return;}
    if(!request){if(hover.type==='reject'){view.setText(10175,hover.reason??'无法移动武器');options.action('gun-drag-rejected',{reason:hover.reason});}returnVisual();return;}
    pending=request;options.action('gun-drop',request);
  };
  const begin=(event:FederatedPointerEvent,kind:GunLocationKind,index:number,box:Container)=>{
    if(disposed||controller.state||pending||visual||event.button!==0||(kind==='inventory'&&autoReserved.has(index)))return;
    const gun=kind==='inventory'?currentSession.gunInventory[index]:currentSession.equippedGuns[index];if(!gun)return;
    event.stopPropagation();const id=event.pointerId,p={x:event.global.x,y:event.global.y},from=gunEntityRef(gun,kind,index);
    if(!controller.begin(id,from,p))return;dragOrigin=p;safeHover=false;
    if(kind==='inventory')slotMotions[index].reset();
    const parent=box.parent,indexInParent=parent.getChildIndex(box),matrix=box.localTransform.clone(),world=box.worldTransform.clone();
    const local=overlay.worldTransform.clone().invert().append(world);overlay.addChild(box);box.transform.setFromMatrix(local);
    const image=kind==='equipment'?named(equipment[index],'Gun_img'):undefined;
    const l=view.layout.get(image?.id??pool[index]?.id??equipment[index].id)!;
    visual={box,parent,index:indexInParent,matrix,motion:new SourceMotion(box),origin:{x:box.x,y:box.y},offset:{x:box.x-p.x,y:box.y-p.y},rect:{width:l.width,height:l.height,scale:l.scale},fromGun:gun,moved:false};
    const data=kind==='inventory'?pool[index].components.find(c=>c.kind==='Gun_Item')?.data:undefined;
    visual.motion.press(data?{scale:data.PressScale,pressSeconds:data.PressAnimDuration,releaseSeconds:data.PressBounceBackDuration}:SOURCE_GUN_PRESS);
    try{surface?.setPointerCapture(id);}catch{/* Synthetic fixtures need not implement native capture. */}
  };
  const banner=stepupScene.find(r=>r.kind==='StepUp_Banner')!,demo=stepupScene.find(r=>r.id===banner.data.gun_item!.id)!;
  view.bindAction(1833,e=>{e.stopPropagation();options.action('stepup-open');});
  view.bindAction(17917,e=>{e.stopPropagation();const i=sourceStepUpCurrent(currentSession.stepUp??freshSourceStepUp());if(i>=0)options.action('stepup-detail',SOURCE_STEPUP.gunRewards[i]);});
  view.sync=next=>{
    currentSession=next.session;currentAuto=next.autoMerge;
    const st=currentSession.stepUp??freshSourceStepUp(),utc=next.nowUTC??Date.now(),step=sourceStepUpCurrent(st);localShow(go(1128),sourceStepUpVisible(currentSession,utc));view.setText(banner.data.Time_txt!.id!,sourceStepUpTimeText(st,utc));view.setText(banner.data.Sale_txt!.id!,'本地测试 · 不支付');
    if(step>=0){const id=SOURCE_STEPUP.gunRewards[step],g=guns.guns[id],d=demo.data;view.setTextureURL(d.Gun_img!.id!,g.spriteURL);view.setTextureURL(d.Shadow_img!.id!,g.spriteURL);view.setColor(d.Panel_img!.id!,degreeColors.colors[Math.floor(id/5)]);view.setText(d.Type_txt!.id!,['单发','激光','穿透','散弹','爆破','导弹','爆狙'][g.type]);d.Degree_objs!.forEach((ref,j)=>localShow(byID.get(ref.id!),j===Math.floor(id/5)));}
    localShow(named(go(2027),'Locked_obj'),!sourceGunSafeUnlocked(currentSession.historicMax));
    const autoActive=currentAuto?.plusPack2Active===true&&currentAuto.state.autoMergeRequested;
    localShow(go(17341),currentAuto?.weeklyVipUnlocked===true);localShow(go(10362),autoActive);localShow(go(10186),!autoActive);localShow(go(11925),autoActive);localShow(go(30327),!autoActive);
    if(!autoActive)resetAuto();
    if(controller.state){const from=controller.state.from,gun=from.kind==='inventory'?currentSession.gunInventory[from.index]:currentSession.equippedGuns[from.index];if(!gun||gunEntityUID(gun)!==from.uid)cancel();}
    view.setColor(1106,currentSession.diamonds>=GUN_GACHA_COST?[1,1,1,1]:[1,Math.fround(103/255),Math.fround(103/255),1]);
    view.setText(5793,String(currentSession.diamonds));view.setText(17254,walletValue(currentSession.battle).format());view.setText(10175,next.notice?.trim()||'拖动武器装备');localShow(go(1491),next.adDailyGunVisible===true);
    pool.forEach((n,index)=>{const gun=currentSession.gunInventory[index],uid=gun?gunEntityUID(gun):undefined;if(uid!==slotUIDs[index]){slotMotions[index].reset();slotUIDs[index]=uid;}const data=n.components.find(c=>c.kind==='Gun_Item')!.data!;localShow(n,!!gun);localShow(objectRef(data.Pause_obj),gun?.paused===true);localShow(objectRef(data.AD_Reward_obj),gun?.adReward===true);const adText=componentRef(data.AD_Time_txt);if(adText&&gun?.adReward)view.setText(adText.id,sourceAdGunTimeText(currentSession,next.nowUTC??Date.now()));if(gun){const panel=componentRef(data.Panel_img);if(panel)view.setColor(panel.id,degreeColors.colors[Math.floor(sourceGunID(gun)/5)]);localGun(gun,componentRef(data.Gun_img),componentRef(data.Type_txt),data.Degree_objs.map(objectRef));localArt(componentRef(data.Shadow_img),gun);}});
    equipment.forEach((n,index)=>{const star=named(n,'Star');localShow(star,sourceStarUnlocked(currentSession.historicMax));if(star){const level=named(star,'StarLv_txt');if(level)view.setText(level.id,String(currentSession.bossSlotLevels?.[index]??0));}const gun=currentSession.equippedGuns[index];localShow(named(n,'Pause_obj'),gun?.paused===true);localShow(named(n,'Selected'),!!gun);localShow(named(n,'UnSelected'),!gun);if(gun){const panel=named(n,'Panel');if(panel)view.setColor(panel.id,degreeColors.colors[Math.floor(sourceGunID(gun)/5)]);const degree=named(n,'Degree (1)');localGun(gun,named(n,'Gun_img'),named(n,'Type_txt'),degree?nodes.filter(x=>x.parent===degree.id):[]);const damage=named(n,'Damage'),speed=named(n,'Speed'),d=damage&&named(damage,'Value_txt'),s=speed&&named(speed,'Value_txt');if(d)view.setText(d.id,gun.damageValue?.format()??String(gun.damage));if(s)view.setText(s.id,String(Number(gun.intervalSeconds.toFixed(3))));}});
    if(activeDirty)applyLocalActive();
  };
  view.connectPointer=(canvas,clientToUi)=>{
    disconnect?.();surface=canvas;convert=clientToUi??((x,y)=>{const r=canvas.getBoundingClientRect();return {x:(x-r.left)*options.viewport.width/r.width,y:(y-r.top)*options.viewport.height/r.height};});
    const move=(e:PointerEvent)=>movePointer(e.pointerId,convert!(e.clientX,e.clientY));
    const up=(e:PointerEvent)=>{releaseButtons(e.pointerId);endPointer(e.pointerId,convert!(e.clientX,e.clientY));};
    const cancelled=(e:PointerEvent)=>{releaseButtons(e.pointerId);if(controller.state?.pointerId===e.pointerId)cancel();};
    const blurred=()=>cancel();
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancelled);window.addEventListener('blur',blurred);canvas.addEventListener('lostpointercapture',cancelled);
    disconnect=()=>{cancel();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancelled);window.removeEventListener('blur',blurred);canvas.removeEventListener('lostpointercapture',cancelled);surface=undefined;convert=undefined;disconnect=undefined;};return disconnect;
  };
  view.resolveDrop=(accepted,notice)=>{pending=null;if(notice)view.setText(10175,notice);if(accepted)restoreVisual();else returnVisual();};
  view.playSpawnBounceAtSlot=index=>{const gun=currentSession.gunInventory[index];if(disposed||controller.state||pending||visual||autoReserved.has(index)||!Number.isInteger(index)||index<0||index>=slotMotions.length||!gun||!view.layout.get(pool[index].id)?.active)return false;slotMotions[index].spawn();return true;};
  view.resolveAutoMerge=accepted=>autoScheduler.acknowledge(accepted);
  view.cancelDrag=cancel;Object.defineProperty(view,'dragState',{get:()=>controller.state});Object.defineProperty(view,'pendingDrop',{get:()=>pending});
  const baseUpdate=view.update.bind(view),baseDestroy=view.destroy.bind(view),baseReflow=view.reflow.bind(view);
  view.update=dt=>{
    if(disposed)return;
    baseUpdate(dt);for(const entry of buttonMotions)entry.motion.update(dt);for(const motion of slotMotions)motion.update(dt);
    if(lastLayout!==view.layout){lastLayout=view.layout;cancel();restoreVisual();resetAuto();for(const entry of buttonMotions)entry.motion.reset();for(const motion of slotMotions)motion.reset();applyLocalActive();}
    const poolState=sourceGunAutoPool(currentSession).map(item=>({...item,active:view.layout.get(pool[item.slot].id)?.active===true,dragging:controller.state?.from.kind==='inventory'&&controller.state.from.index===item.slot,autoMerging:autoReserved.has(item.slot)}));
    const hover=controller.state?.hover.target,dragTargets=hover?.kind==='inventory'?[hover.index]:[];
    // Pending manual drop is an adapter transaction boundary; no source pending-delete rule is applied.
    const step=autoScheduler.tick({session:currentSession,state:currentAuto?.state??freshSourceGunAutoMerge(),plusPack2Active:currentAuto?.plusPack2Active===true,pool:poolState,positions:slots.map(slot=>{const l=view.layout.get(slot.id)!;return {x:(l.x+l.width/2)/l.scale,y:(l.y+l.height/2)/l.scale};}),deltaSec:dt,enabled:!pending&&currentSession.mode==='field'&&currentSession.overlay==='gun',dragTargets});
    if(step.releasedPair)releaseAutoVisual();
    if(step.pair&&step.position){reserveAuto(step.pair);if(autoVisual)autoVisual.box.position.set(autoVisual.origin.x+(step.position.x-autoVisual.sourceOrigin.x)*autoVisual.scale,autoVisual.origin.y+(step.position.y-autoVisual.sourceOrigin.y)*autoVisual.scale);}
    if(step.commit){releaseAutoVisual();if(activeDirty)applyLocalActive();options.action('gun-auto-fuse',step.commit);return;}
    if(activeDirty)applyLocalActive();
    if(visual){visual.motion.update(dt);if(visual.returnElapsed!==undefined){visual.returnElapsed+=Math.max(0,dt);const t=Math.min(1,visual.returnElapsed/ADAPTER_GUN_RETURN_SECONDS),start=visual.returnStart!;visual.box.position.set(start.x+(visual.origin.x-start.x)*t,start.y+(visual.origin.y-start.y)*t);if(t===1&&(visual.moved||visual.returnElapsed>=SOURCE_GUN_RELEASE_SECONDS))restoreVisual();}}
  };
  view.reflow=viewport=>{cancel();restoreVisual();resetAuto();for(const entry of buttonMotions)entry.motion.reset();for(const motion of slotMotions)motion.reset();baseReflow(viewport);if(viewport)options.viewport=viewport;lastLayout=view.layout;applyLocalActive();};
  view.destroy=()=>{if(disposed)return;disposed=true;disconnect?.();controller.cancel();restoreVisual();autoScheduler.cancel();releaseAutoVisual();for(const motion of slotMotions)motion.reset();baseDestroy();};
  const bound=new Set<number>([17341]);
  const bind=(n:SourceUiNode,name:string,payload?:unknown)=>{bound.add(n.gameObjectPathID);view.bindAction(n.id,e=>{e.stopPropagation();if(controller.state||pending)return;if(name==='close')resetAuto();if(name==='unresolved'&&typeof payload==='string')view.setText(10175,payload);options.action(name,payload);});};
  bind(go(802),'draw-gun');bind(go(1491),'ad-daily-gun');bind(go(159),'close');bind(go(1108),'close');bind(go(2053),'gun-collection-open');bind(go(1430),'gun-guide-open');bind(go(2027),'gun-safe-open');
  view.bindAction(go(17341).id,e=>{e.stopPropagation();if(disposed||controller.state||pending)return;if(currentAuto?.plusPack2Active!==true){options.action('gun-auto-shop');return;}const requested=!currentAuto.state.autoMergeRequested;if(!requested)resetAuto();options.action('gun-auto-set',requested);});
  equipment.forEach((n,i)=>{const star=named(n,'Star');if(star)bind(star,'star-open',i);const button=named(n,'UnSelect_Btn');if(button)bind(button,'unequip',i);const gunImage=named(n,'Gun_img'),box=gunImage&&view.get(gunImage.id);if(box){box.eventMode='static';box.cursor='grab';box.on('pointerdown',e=>begin(e,'equipment',i,box));}});
  pool.forEach((n,i)=>{const box=view.get(n.id);if(box){box.eventMode='static';box.cursor='grab';box.on('pointerdown',e=>begin(e,'inventory',i,box));}});
  descendants(go(2235)).filter(n=>n.components.some(c=>c.kind==='Button')&&!bound.has(n.gameObjectPathID)&&!view.boundActions.has(n.id)).forEach(n=>view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`));
  for(const n of descendants(go(2235))){const component=n.components.find(c=>c.kind==='BounceBtn'),scale=component&&SOURCE_GUN_PANEL_BOUNCE[component.pathID!],box=view.get(n.id);if(scale===undefined||!box)continue;
    const entry={motion:new SourceBounceMotion(box,scale),pointerId:null as number|null};buttonMotions.push(entry);
    box.on('pointerdown',(e:FederatedPointerEvent)=>{if(e.button!==0||controller.state||pending)return;entry.pointerId=e.pointerId;entry.motion.pointerDown();});
    const release=(e:FederatedPointerEvent)=>{if(entry.pointerId===e.pointerId){entry.motion.pointerUp();entry.pointerId=null;}};box.on('pointerup',release);box.on('pointerupoutside',release);
  }
  view.sync(options);
  if(options.pointerSurface)view.connectPointer(options.pointerSurface,options.clientToUi);
  view.addDiagnostic('Gun auto merge: scene configured cap6/requested off, PlusPack2 entitlement, independent WeeklyShop VIP entry gate; degree/history/pool filters, initial yield, source .25s SmoothStep/25 distance/.12s pair delay; marker reservation, global drag wait and exact UID commit. Native slot-space motion maps once through source layout scale.');
  view.addDiagnostic('Gun_Item press uses recovered SmoothStep 0.9 / 0.08s; click release 1.05→0.98→1 in 0.19s; spawn 0→1.1→0.95→1.02→1 in 0.34s. First movement restores normal scale as native OnBeginDrag. Return position timing is an adapter. BounceBtn 123932 / all 12 serialized Gun_UI peers have proven WantSize and 0.1s linear down/up. Purchase_Btn 123931 restores affordability/disabled price colour. Open streamed cubic curves are recovered for separate NewGun_UI/NewPet_UI popups; Gun_UI has no Animator and is not assigned that clip.');
  return view;
}
