import {sourceUnboundActiveButtons,sourceViewButtonCandidates} from './source-button-audit';
import {sourceDragCaptureTransform,sourceDragRestoreTransform,sourceDragShiftInView} from './source-drag-transform';
import {sourcePetOwnedDragDecision,sourcePetNearestEmpty,SOURCE_PET_DRAG_GEOMETRY,type SourcePetOwnedDragDecision} from './r6-pet-drag';
import autoScene from './data/r6-pet-auto-scene.json';
import {createSourcePetAutoScheduler,freshSourcePetAutoState,sourcePetEntityRef,sourcePetSlotSnapshot,sourcePetRefCurrent,type SourcePetEntityRef,type SourcePetSlotSnapshot,type SourcePetAutoState,type SourcePetAutoPair} from './r6-pet-auto';
import {Container, Matrix, Sprite, type Texture, type FederatedPointerEvent} from 'pixi.js';
import {createSourceUiView, sourceUiTree, type SourceUiNode, type SourceUiView, type SourceUiViewport, type SourceUiTransformOverride} from './source-ui';
import {sourcePetStats, SOURCE_PET_DRAW_COST, type SourcePetState, type SourcePetWallet} from './r5-pet';
import {SourceMotion} from './source-motion';
import scene from './data/source-pet-panel-scene.json';

export const sourcePetPanelAssetURLs=[795,742,869,889,692,640,710,665,731,680].map((id,grade)=>`/assets/generated/sprite/sharedassets0.assets__${String(id).padStart(8,'0')}__${grade}.png`);
export interface SourcePetPanelOptions {
 textures:Record<string,Texture>;viewport:SourceUiViewport;state:SourcePetState;wallet:SourcePetWallet;
 moneyText?:string;notice?:string;dailyAdVisible?:boolean;autoMerge?:{state:SourcePetAutoState;plus2:boolean;weeklyVipUnlocked:boolean};
 /** pet-draw: 'petCoin'|'diamonds'; pet-merge/equip/swap-selected: {a,b}; pet-unequip: number; pet-daily-ad: no payload. */
 action(name:string,payload?:unknown):void;
 pointerSurface?:HTMLCanvasElement;clientToUi?:(x:number,y:number)=>{x:number;y:number};
}
export type SourcePetReference=SourcePetEntityRef;
export type SourcePetDropIntent={status:'supported';action:'pet-merge'|'pet-equip'|'pet-swap-selected'|'pet-unequip'|'pet-move-owned'|'pet-swap-owned';payload:{a:number;b:number;destination?:number;guards:SourcePetSlotSnapshot[]}|{index:number;guards:SourcePetSlotSnapshot[]}}|{status:'blocked';reason:string};
export const sourcePetReference=sourcePetEntityRef;
/** Pointer intent only; all authoritative checks and changes happen in r5-pet via the host. */
export function sourcePetDropIntent(state:SourcePetState,from:SourcePetReference,target:{kind:'owned'|'selected';index:number;destination?:number}|null):SourcePetDropIntent {
 if(!sourcePetRefCurrent(state,from))return {status:'blocked',reason:'pet-drag-stale'};
 if(!target)return {status:'blocked',reason:'pet-drop-outside'};
 const limit=target.kind==='owned'?16:3;if(!Number.isInteger(target.index)||target.index<0||target.index>=limit)return {status:'blocked',reason:'pet-drop-outside'};
 if(from.kind===target.kind&&from.index===target.index)return {status:'blocked',reason:'pet-drop-self'};
 if(from.kind==='owned'&&target.kind==='selected')return {status:'supported',action:'pet-equip',payload:{a:from.index,b:target.index,guards:[sourcePetSlotSnapshot(state,from.kind,from.index),sourcePetSlotSnapshot(state,target.kind,target.index)]}};
 if(from.kind==='selected'&&target.kind==='selected')return {status:'supported',action:'pet-swap-selected',payload:{a:from.index,b:target.index,guards:[sourcePetSlotSnapshot(state,from.kind,from.index),sourcePetSlotSnapshot(state,target.kind,target.index)]}};
 if(from.kind==='selected')return state.owned.includes(-1)?{status:'supported',action:'pet-unequip',payload:{index:from.index,guards:[sourcePetSlotSnapshot(state,from.kind,from.index)]}}:{status:'blocked',reason:'pet-inventory-full'};
 const guards=[sourcePetSlotSnapshot(state,from.kind,from.index),sourcePetSlotSnapshot(state,target.kind,target.index)];
 if(state.owned[target.index]===-1)return {status:'supported',action:'pet-move-owned',payload:{a:from.index,b:target.index,guards}};
 if(state.owned[target.index]===from.grade&&from.lock===-1&&state.ownedLocks[target.index]===-1){
  if(from.grade===9)return {status:'blocked',reason:'pet-max-grade'};
  return {status:'supported',action:'pet-merge',payload:{a:from.index,b:target.index,guards}};
 }
 const destination=target.destination??sourcePetNearestEmpty(state,SOURCE_PET_DRAG_GEOMETRY.positions[target.index],from.index,target.index);
 if(destination!==-1&&destination!==from.index)guards.push(sourcePetSlotSnapshot(state,'owned',destination));
 return {status:'supported',action:'pet-swap-owned',payload:{a:from.index,b:target.index,destination,guards}};
}
export interface SourcePetPanelView extends SourceUiView {
 inventorySlots:string[];emptySlots:string[];equipmentSlots:string[];
 sync(options:Pick<SourcePetPanelOptions,'state'|'wallet'|'notice'|'dailyAdVisible'|'moneyText'|'autoMerge'>):void;
 connectPointer(canvas:HTMLCanvasElement,convert?:(x:number,y:number)=>{x:number;y:number}):()=>void;
 resolveDrop(accepted:boolean,notice?:string):void;cancelDrag():void;
 readonly dragState:SourcePetReference|null;readonly dragPreview:SourcePetOwnedDragDecision|null;readonly pendingDrop:SourcePetDropIntent|null;
}
/** Original Pet_UI GameObject tree, pool PPtrs, fixed SlotTransforms and original ten sprites. */
export function createSourcePetPanel(options:SourcePetPanelOptions):SourcePetPanelView {
 const nodes=sourceUiTree.nodes,byID=new Map(nodes.map(n=>[n.id,n]));
 const go=(id:number)=>byID.get(`level0:${id}`)!;
 const component=(ref:number[])=>nodes.find(n=>n.file==='level0'&&n.components.some(c=>c.pathID===ref?.[1]));
 const object=(ref:number[])=>go(ref?.[1]);
 const transform=(ref:number[])=>nodes.find(n=>n.file==='level0'&&n.transformPathID===ref?.[1]);
 const data=(id:number)=>scene.rows.find(r=>r.pathID===id)!.data as any;
 const list=data(124416),pool:SourceUiNode[]=list.Pet_Item_Pool.map(component),slots:SourceUiNode[]=list.SlotTransforms.map(transform);
 const equipment=[4049,15342,15343].map(go),items=pool.map(n=>data(n.components.find(c=>c.kind==='Pet_Item')!.pathID!));
 const equips=equipment.map(n=>data(n.components.find(c=>c.kind==='Pet_Slot')!.pathID!));
 if(pool.length!==16||slots.length!==16||pool.some(n=>!n)||slots.some(n=>!n)||equipment.some(n=>!n))throw new Error('Source Pet references incomplete');
 const descendants=(root:SourceUiNode)=>nodes.filter(n=>{let p=n.parent;while(p){if(p===root.id)return true;p=byID.get(p)?.parent??null;}return false;});
 const active:Record<string,boolean>={},text:Record<string,string>={},transforms:Record<string,SourceUiTransformOverride>={};
 const show=(n:SourceUiNode|undefined,v:boolean)=>{if(n)active[n.id]=v;};
 let ancestor:SourceUiNode|undefined=go(1373);while(ancestor){show(ancestor,true);ancestor=ancestor.parent?byID.get(ancestor.parent):undefined;}
 slots.forEach(slot=>descendants(slot).forEach(child=>show(child,false)));
 // Source list/guide nodes; auto visibility and Plus gate are synchronized below.
 show(go(1203),true);show(go(18806),false);show(go(10196),false);show(go(10212),true);
 text[go(10317).id]='拖动宠物装备';text[go(10212).id]='拖动同级宠物合成';text[go(10258).id]='抽取宠物';text[go(10150).id]='抽取宠物';text[go(10081).id]='信息';text[go(10096).id]='图鉴';
 text[go(411).id]=`<sprite=4>${SOURCE_PET_DRAW_COST}`;text[go(175).id]=`<sprite=1>${SOURCE_PET_DRAW_COST}`;
 pool.forEach((n,i)=>{
  const slot=slots[i],parent=byID.get(n.parent!)!,slotParent=byID.get(slot.parent!)!;
  if(slot.rect&&parent.rect&&slotParent.rect)transforms[n.id]={anchorMin:slot.rect.anchorMin,anchorMax:slot.rect.anchorMax,anchoredPosition:[slot.rect.anchoredPosition[0]+slotParent.rect.anchoredPosition[0]-parent.rect.anchoredPosition[0],slot.rect.anchoredPosition[1]+slotParent.rect.anchoredPosition[1]-parent.rect.anchoredPosition[1]]};
 });
 const tree={...sourceUiTree,nodes:nodes.map(n=>({...n,active:active[n.id]??n.active,components:n.components.map(c=>c.kind==='Image'?{...c,data:{...c.data}}:c)}))};
 const live=new Map(tree.nodes.map(n=>[n.id,n]));
 // Seed every pool/selected Image before source-ui chooses Sprite versus fallback Graphics.
 const seed=(d:any,grade:number)=>{for(const ref of [d.Pet_img,d.Shadow_img]){const n=component(ref);const image=n&&live.get(n.id)?.components.find(c=>c.kind==='Image');if(image?.data)image.data.textureURL=sourcePetPanelAssetURLs[Math.max(0,grade)];}};
 items.forEach((d,i)=>seed(d,options.state.owned[i]));equips.forEach((d,i)=>seed(d,options.state.selected[i]));
 const view=createSourceUiView({textures:options.textures,viewport:options.viewport,roots:[1373],tree,text,transforms}) as SourcePetPanelView;
 view.inventorySlots=pool.map(n=>n.id);view.emptySlots=slots.map(n=>n.id);view.equipmentSlots=equipment.map(n=>n.id);
 const fingerprint=(s:SourcePetState)=>JSON.stringify([s.owned,s.selected,s.ownedLocks,s.selectedLocks,s.ownedIDs,s.selectedIDs]);
 let state=options.state,stateFingerprint=fingerprint(state),disposed=false,surface:HTMLCanvasElement|undefined,convert:((x:number,y:number)=>{x:number;y:number})|undefined,disconnect:(()=>void)|undefined;
 let pending:SourcePetDropIntent|null=null,currentAuto=options.autoMerge;const autoScheduler=createSourcePetAutoScheduler(),autoReserved=new Set<number>();
 let autoVisual:{box:Container;parent:Container;index:number;matrix:Matrix;origin:{x:number;y:number};sourceOrigin:{x:number;y:number};scale:number}|null=null;
 const overlay=new Container();overlay.name='SourcePetDragOverlay';overlay.eventMode='none';view.root.addChild(overlay);
 type Drag={ref:SourcePetReference;pointerId:number;box:Container;parent:Container;childIndex:number;matrix:Matrix;offset:{x:number;y:number};origin:{x:number;y:number};start:{x:number;y:number};moved:boolean;motion:SourceMotion};
 let drag:Drag|null=null;
 const localShow=(n:SourceUiNode|undefined,v:boolean)=>{if(!n)return;active[n.id]=v;const node=live.get(n.id);if(node)node.active=v;const b=view.get(n.id);if(b)b.visible=v;const l=view.layout.get(n.id);if(l)l.selfActive=v;};
 const buttonCandidates=sourceViewButtonCandidates(tree.nodes,view.layout);
 const unboundReported=new Set<string>();
 const applyActive=()=>{
  const inherits=(id:string):boolean=>{const n=byID.get(id),own=active[id]??n?.active??true;return own&&(!n?.parent||inherits(n.parent));};
  for(const [id,l]of view.layout)l.active=inherits(id);
  const unbound=sourceUnboundActiveButtons(buttonCandidates,new Set(buttonCandidates.filter(n=>view.layout.get(n.id)?.active).map(n=>n.id)),view.boundActions);
  for(const path of unbound)if(!unboundReported.has(path)){unboundReported.add(path);view.addDiagnostic('UNBOUND_SOURCE_BUTTON:'+path);console.error('[source-pet-panel] unbound source button: '+path);}
 };
 const art=(n:SourceUiNode|undefined,grade:number)=>{
  if(!n)return;const url=sourcePetPanelAssetURLs[grade],image=live.get(n.id)?.components.find(c=>c.kind==='Image');if(image?.data)image.data.textureURL=url;
  const texture=options.textures[url];if(!texture)return;
  for(const child of view.getGraphic(n.id)?.children??[])if(child instanceof Sprite){const w=child.width,h=child.height;child.texture=texture;child.width=w;child.height=h;}
 };
 const renderPet=(d:any,grade:number,lock:number)=>{
  localShow(object(d.Lock_obj),grade>=0&&lock!==-1);for(const [i,ref]of d.Degree_objs.entries())localShow(object(ref),grade===i);
  if(grade>=0){art(component(d.Pet_img),grade);art(component(d.Shadow_img),grade);}
 };
 const releaseAuto=()=>{
  if(autoVisual){const v=autoVisual;autoVisual=null;v.parent.addChildAt(v.box,Math.min(v.index,v.parent.children.length));sourceDragRestoreTransform(v.box,v.matrix);}
  for(const i of autoReserved)localShow(object(items[i].AutoMerge_obj),false);autoReserved.clear();
 };
 const resetAuto=()=>{autoScheduler.reset();releaseAuto();};
 const reserveAuto=(pair:SourcePetAutoPair)=>{
  if(autoReserved.has(pair.mover.index)&&autoReserved.has(pair.anchor.index))return;releaseAuto();
  for(const i of [pair.mover.index,pair.anchor.index]){autoReserved.add(i);localShow(object(items[i].AutoMerge_obj),true);}
  const box=view.get(pool[pair.mover.index].id)!,parent=box.parent,index=parent.getChildIndex(box),matrix=sourceDragCaptureTransform(box),world=box.worldTransform.clone(),l=view.layout.get(slots[pair.mover.index].id)!;
  overlay.addChild(box);box.transform.setFromMatrix(overlay.worldTransform.clone().invert().append(world));
  autoVisual={box,parent,index,matrix,origin:{x:box.x,y:box.y},sourceOrigin:{x:(l.x+l.width/2)/l.scale,y:(l.y+l.height/2)/l.scale},scale:l.scale};
 };
 let dragPreview:SourcePetOwnedDragDecision|null=null,swapVisual:{box:Container;matrix:Matrix}|null=null;
 const restoreSwap=()=>{if(swapVisual){sourceDragRestoreTransform(swapVisual.box,swapVisual.matrix);swapVisual=null;}dragPreview=null;};
 const releaseCapture=(id:number)=>{try{if(surface?.hasPointerCapture(id))surface.releasePointerCapture(id);}catch{}};
 const restore=()=>{restoreSwap();if(!drag)return;const d=drag;drag=null;releaseCapture(d.pointerId);d.motion.reset();d.parent.addChildAt(d.box,Math.min(d.childIndex,d.parent.children.length));sourceDragRestoreTransform(d.box,d.matrix);};
 const cancel=()=>{pending=null;restore();pool.forEach((_,i)=>localShow(object(items[i].FusionAble_obj),false));applyActive();};
 view.cancelDrag=cancel;
 Object.defineProperties(view,{dragState:{get:()=>drag?.ref??null},dragPreview:{get:()=>dragPreview},pendingDrop:{get:()=>pending}});
 view.resolveDrop=(_accepted,notice)=>{pending=null;restore();if(notice)view.setText(10317,notice);};
 view.sync=o=>{
  if(disposed)return;currentAuto=o.autoMerge;if(!currentAuto?.state.requested||!currentAuto.plus2)resetAuto();const nextFingerprint=fingerprint(o.state);
  if(drag&&stateFingerprint!==nextFingerprint)cancel();state=o.state;stateFingerprint=nextFingerprint;
  pool.forEach((n,i)=>{localShow(n,state.owned[i]>=0);renderPet(items[i],state.owned[i],state.ownedLocks[i]);localShow(object(items[i].FusionAble_obj),false);localShow(object(items[i].AutoMerge_obj),autoReserved.has(i));});
  equipment.forEach((_,i)=>{const grade=state.selected[i],d=equips[i];localShow(object(d.Selected_obj),grade>=0);localShow(object(d.UnSelected_obj),grade<0);renderPet(d,grade,state.selectedLocks[i]);if(grade>=0){const stat=sourcePetStats(grade);view.setText(component(d.Money_txt)!.id,`${stat.money.format()}%`);view.setText(component(d.MoveSpeed_txt)!.id,`${stat.moveSpeed}%`);}});
  const autoOn=currentAuto?.plus2===true&&currentAuto.state.requested;localShow(go(18806),currentAuto?.weeklyVipUnlocked===true);localShow(go(10196),autoOn);localShow(go(10212),!autoOn);localShow(go(autoScene.OnOff.on.pathID),autoOn);localShow(go(autoScene.OnOff.off.pathID),!autoOn);view.setText(10196,'自动合成：不超过历史最高级前一级，上限6');
  localShow(go(1846),o.dailyAdVisible===true);view.setText(9866,String(o.wallet.diamonds));view.setText(9849,String(o.wallet.petCoin));view.setText(9850,o.moneyText??'0');view.setText(10317,o.notice?.trim()||'拖动宠物装备');
  view.setColor(411,o.wallet.petCoin>=100?[1,1,1,1]:[1,.38,.38,1]);view.setColor(175,o.wallet.diamonds>=100?[1,1,1,1]:[1,.38,.38,1]);applyActive();
 };
 const hit=(p:{x:number;y:number})=>{
  const contains=(id:string)=>{const r=view.layout.get(id);return !!r&&r.active&&p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.width&&p.y<=r.y+r.height;};
  const e=equipment.findIndex(n=>contains(n.id));if(e>=0)return {kind:'selected' as const,index:e};
  if(!drag)return null;
  // Equipped -> item list still calls native Unequip (first empty). Owned pets
  // use their dragged RectTransform center, not the pointer/slot hit rectangle.
  if(drag.ref.kind==='selected')return contains(go(1203).id)?{kind:'owned' as const,index:0}:null;
  const index=drag.ref.index,l=view.layout.get(slots[index].id)!,g=SOURCE_PET_DRAG_GEOMETRY.positions[index];
  const point={x:g.x+(drag.box.x-drag.origin.x)/l.scale,y:g.y-(drag.box.y-drag.origin.y)/l.scale};
  const decision=sourcePetOwnedDragDecision(state,index,point,autoReserved);dragPreview=decision;
  return decision.target<0?null:{kind:'owned' as const,index:decision.target,...(decision.kind==='swap'?{destination:decision.destination}:{})};
 };
 const previewSwap=(decision:SourcePetOwnedDragDecision|null)=>{
  if(decision?.kind!=='swap'||decision.destination<0)return;
  const box=view.get(pool[decision.target].id)!,a=view.layout.get(slots[decision.target].id)!,b=view.layout.get(slots[decision.destination].id)!;
  swapVisual={box,matrix:sourceDragCaptureTransform(box)};sourceDragShiftInView(box,view.root,{x:b.x-a.x,y:b.y-a.y});
 };
 const move=(id:number,p:{x:number;y:number})=>{
  if(!drag||drag.pointerId!==id||pending)return;const d=drag;
  if(!d.moved&&(Math.abs(p.x-d.start.x)>2||Math.abs(p.y-d.start.y)>2)){d.moved=true;d.motion.reset();}
  if(d.moved)d.box.position.set(p.x+d.offset.x,p.y+d.offset.y);
  restoreSwap();const target=hit(p),intent=sourcePetDropIntent(state,d.ref,target);previewSwap(dragPreview);
  pool.forEach((_,i)=>localShow(object(items[i].FusionAble_obj),intent.status==='supported'&&intent.action==='pet-merge'&&target?.index===i));applyActive();
 };
 const end=(id:number,p:{x:number;y:number})=>{
  if(!drag||drag.pointerId!==id||pending)return;move(id,p);const d=drag;
  pool.forEach((_,i)=>localShow(object(items[i].FusionAble_obj),false));applyActive();releaseCapture(id);
  if(!d.moved){const current=sourcePetRefCurrent(state,d.ref);restore();if(current)options.action('pet-info',d.ref.grade);return;}
  const intent=sourcePetDropIntent(state,d.ref,hit(p));
  if(intent.status==='blocked'){restore();options.action('pet-drag-rejected',intent.reason);return;}
  pending=intent;options.action(intent.action,intent.payload);
 };
 const begin=(e:FederatedPointerEvent,kind:SourcePetReference['kind'],index:number,box:Container,d:any)=>{
  if(e.button!==0||disposed||drag||pending||autoReserved.has(index)&&kind==='owned')return;resetAuto();const ref=sourcePetReference(state,kind,index);if(!ref)return;
  e.stopPropagation();const parent=box.parent!,childIndex=parent.getChildIndex(box),matrix=sourceDragCaptureTransform(box),global=box.toGlobal({x:0,y:0}),origin=view.root.toLocal(global),p=view.root.toLocal(e.global);
  const carriedMatrix=overlay.worldTransform.clone().invert().append(box.worldTransform);overlay.addChild(box);box.transform.setFromMatrix(carriedMatrix);
  const motion=new SourceMotion(box);motion.to(d.PressScale,d.PressAnimDuration);
  drag={ref,pointerId:e.pointerId,box,parent,childIndex,matrix,offset:{x:origin.x-p.x,y:origin.y-p.y},origin,start:{x:p.x,y:p.y},moved:false,motion};
  try{surface?.setPointerCapture(e.pointerId);}catch{}
 };
 pool.forEach((n,i)=>{const b=view.get(n.id)!;b.eventMode='static';b.cursor='grab';b.on('pointerdown',e=>begin(e,'owned',i,b,items[i]));});
 equipment.forEach((_,i)=>{const b=view.get(component(equips[i].Pet_img)!.id)!;b.eventMode='static';b.cursor='grab';b.on('pointerdown',e=>begin(e,'selected',i,b,equips[i]));});
 const bind=(id:number,name:string,payload?:unknown)=>view.bindAction(id,e=>{e.stopPropagation();if(drag||pending)return;options.action(name,payload);});
 bind(1100,'pet-draw','petCoin');bind(1326,'pet-draw','diamonds');bind(1846,'pet-daily-ad');bind(2138,'close');bind(631,'close');
 [18446,7897,7896].forEach((id,i)=>bind(id,'pet-unequip',i));bind(1351,'pet-draw-info');bind(18806,'pet-auto-toggle');
 // Original Collection_Btn is serialized inactive and actually points to
 // Gun_Collection_UI.UI_Reload, not a missing pet collection. Keep it hidden;
 // if any future runtime exposes it, active-button audit must reject omission.
 view.addDiagnostic('SOURCE_INACTIVE_BUTTON:'+go(1561).path+'; serialized event Gun_Collection_UI.UI_Reload; not a pet-collection progress gate');
 const baseUpdate=view.update.bind(view),baseDestroy=view.destroy.bind(view),baseReflow=view.reflow.bind(view);
 let lastLayout=view.layout;
 view.update=dt=>{if(disposed)return;baseUpdate(dt);drag?.motion.update(dt);
  if(lastLayout!==view.layout){lastLayout=view.layout;cancel();resetAuto();applyActive();}
  const step=autoScheduler.tick({state,auto:currentAuto?.state??freshSourcePetAutoState(),plus2:currentAuto?.plus2===true,pool:pool.map((n,slot)=>({slot,active:view.layout.get(n.id)?.active===true,dragging:drag?.ref.kind==='owned'&&drag.ref.index===slot,autoMerging:autoReserved.has(slot),reserved:false})),positions:slots.map(n=>{const l=view.layout.get(n.id)!;return {x:(l.x+l.width/2)/l.scale,y:(l.y+l.height/2)/l.scale};}),dt,enabled:!pending,dragging:!!drag});
  if(step.phase==='cancelled'||step.phase==='idle')releaseAuto();
  if(step.pair&&step.position){reserveAuto(step.pair);if(autoVisual)autoVisual.box.position.set(autoVisual.origin.x+(step.position.x-autoVisual.sourceOrigin.x)*autoVisual.scale,autoVisual.origin.y+(step.position.y-autoVisual.sourceOrigin.y)*autoVisual.scale);}
  if(step.commit){releaseAuto();applyActive();options.action('pet-auto-fuse',{a:step.commit.mover.index,b:step.commit.anchor.index,guards:[step.commit.mover,step.commit.anchor]});return;}applyActive();
 };
 view.reflow=v=>{if(disposed)return;cancel();resetAuto();baseReflow(v);if(v)options.viewport=v;applyActive();};
 view.destroy=()=>{if(disposed)return;disposed=true;disconnect?.();cancel();resetAuto();baseDestroy();};
 view.connectPointer=(canvas,fn)=>{
  disconnect?.();surface=canvas;convert=fn??((x,y)=>{const r=canvas.getBoundingClientRect();return {x:(x-r.left)*options.viewport.width/r.width,y:(y-r.top)*options.viewport.height/r.height};});
  const pointerMove=(e:PointerEvent)=>move(e.pointerId,convert!(e.clientX,e.clientY));const pointerUp=(e:PointerEvent)=>end(e.pointerId,convert!(e.clientX,e.clientY));const pointerCancel=(e:PointerEvent)=>{if(drag?.pointerId===e.pointerId)cancel();};const interruptPreview=()=>{cancel();resetAuto();};
  window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerCancel);window.addEventListener('blur',interruptPreview);window.addEventListener('resize',interruptPreview);
  const cleanup=()=>{window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',pointerCancel);window.removeEventListener('blur',interruptPreview);window.removeEventListener('resize',interruptPreview);cancel();if(surface===canvas)surface=undefined;};disconnect=cleanup;return cleanup;
 };
 view.root.on('globalpointermove',(e:FederatedPointerEvent)=>{if(!surface)move(e.pointerId,view.root.toLocal(e.global));});view.root.on('pointerup',(e:FederatedPointerEvent)=>{if(!surface)end(e.pointerId,view.root.toLocal(e.global));});view.root.on('pointerupoutside',(e:FederatedPointerEvent)=>{if(!surface)end(e.pointerId,view.root.toLocal(e.global));});
 view.sync(options);if(options.pointerSurface)view.connectPointer(options.pointerSurface,options.clientToUi);
 view.addDiagnostic('Pet_UI original tree GO1373, source16 pool /16 slot PPtrs, three source equipment nodes; image/degrees/dispatch locks and raw press scale/duration. Transaction boundary/pointer-capture/2px drag threshold are H5 adapters. Auto uses original .25s movement, 25 distance and .12s pair gap with ID-checked host commit. Panel closure cancels movement as an explicit H5 lifecycle adapter. Owned movement uses original strict overlap/shrink40 and float32 nearest empty/original. Swap preview moves target into nearest empty/original; grades, locks and H5 IDs commit together. Source Info_Btn navigates through the host. The serialized inactive Collection_Btn targets Gun_Collection_UI and is not exposed.');
 return view;
}
