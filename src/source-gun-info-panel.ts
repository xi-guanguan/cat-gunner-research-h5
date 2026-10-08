import {Sprite,type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import {sourceGun,type Session} from './session';
import guns from './data/guns.json';
import scene from './data/r6-gun-info-ui.json';
import degree from './data/r6-gun-degree-colors.json';
import {freshSourceGunSafe,sourceGunSafeUnlocked,sourceGunSafeOpenSlots,sourceGunSafeNextPrice,sourceGunDetailRef,sourceGunDetailCurrent,type SourceGunDetailRef} from './r6-gun-storage';
type Ref={id:string|null};
interface GunVisual {Gun_img:Ref;Shadow_img:Ref;Panel_img:Ref;Degree_objs:Ref[];Type_txt?:Ref;Locked_obj?:Ref}
const row=(kind:string)=>scene.find(r=>r.kind===kind)!;
const byRef=(ref:Ref)=>scene.find(r=>r.id===ref.id)!;
const typeNames=['单发','激光','穿透','散弹','爆破','导弹','爆狙'];
/** Translated semantics of Gun_Info_UI.Explain_Return's seven source type branches. */
const explanations=['单发弹体命中单个目标。','激光持续命中路径上的目标。','穿透弹体可连续命中多个目标。','多弹丸按散布角度同时发射。','爆炸对半径内目标造成伤害。','导弹飞行并爆炸，对范围目标造成伤害。','狙击命中后产生范围爆炸。'];
export interface SourceGunInfoOptions {textures:Record<string,Texture>;viewport:SourceUiViewport;session:Session;panel:'gun-collection'|'gun-info'|'gun-safe'|'gun-guide';detail?:SourceGunDetailRef;notice:string;action(name:string,payload?:unknown):void}
export interface SourceGunInfoPanelView extends SourceUiView {sync(options:Pick<SourceGunInfoOptions,'session'|'detail'|'notice'>):void}
/** Original UI roots, original serialized component identities; catalogue and safe indices are assigned by Reload, not prefab demo GunNum/SlotNum. */
export function createSourceGunInfoPanel(o:SourceGunInfoOptions):SourceGunInfoPanelView {
 const rootID={'gun-collection':1439,'gun-info':995,'gun-safe':1221,'gun-guide':778}[o.panel];
 const tree={...sourceUiTree,nodes:sourceUiTree.nodes.map(n=>({...n,components:n.components.map(c=>c.kind==='Image'?{...c,data:{...c.data}}:c)}))};
 const byID=new Map(tree.nodes.map(n=>[n.id,n])),active:Record<string,boolean>={};let node=byID.get(`level0:${rootID}`);while(node){active[node.id]=true;node=node.parent?byID.get(node.parent):undefined;}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[rootID],tree,active}) as SourceGunInfoPanelView;
 const rootPath=byID.get(`level0:${rootID}`)!.path;
 let session=o.session,detail=o.detail;
 const bind=(id:string|number,name:string,payload?:unknown)=>view.bindAction(id,e=>{e.stopPropagation();o.action(name,typeof payload==='function'?(payload as ()=>unknown)():payload);});
 const art=(ref:Ref,sourceID:number)=>{if(!ref.id)return;const raw=guns.guns[sourceID];if(!raw)return;const image=byID.get(ref.id)?.components.find(c=>c.kind==='Image');if(image?.data)image.data.textureURL=raw.spriteURL;
  for(const child of view.getGraphic(ref.id)?.children??[])if(child instanceof Sprite){const w=child.width,h=child.height;child.texture=o.textures[raw.spriteURL];child.width=w;child.height=h;}
 };
 const visual=(d:GunVisual,sourceID:number,changes:Record<string,boolean>,values:Record<string,string>)=>{art(d.Gun_img,sourceID);art(d.Shadow_img,sourceID);if(d.Panel_img.id)view.setColor(d.Panel_img.id,degree.colors[Math.floor(sourceID/5)]);d.Degree_objs.forEach((p,i)=>{if(p.id)changes[p.id]=i===Math.floor(sourceID/5);});if(d.Type_txt?.id)values[d.Type_txt.id]=typeNames[guns.guns[sourceID]?.type??0];};
 if(o.panel==='gun-collection'){
  (row('Gun_Collection_UI').data.items as Ref[]).forEach((ref,index)=>bind(ref.id!,'gun-info-open',{kind:'catalogue',sourceID:index}));bind(276,'gun-sub-close');
  // Background button closes the same root in the original UnityEvent.
  for(const n of tree.nodes.filter(n=>n.path===rootPath+'/Background'))bind(n.id,'gun-sub-close');
 }else if(o.panel==='gun-info'){
  bind(391,'gun-info-close');bind(636,'gun-info-close');bind(483,'gun-safe-takeout');bind(1642,'gun-protect',true);bind(837,'gun-protect',false);bind(1851,'gun-protection-locked');
 }else if(o.panel==='gun-safe'){
  bind(417,'gun-sub-close');bind(1628,'gun-sub-close');
  (row('Safe_UI').data.items as Ref[]).forEach((ref,index)=>{const d=byRef(ref).data;const action=(e:{stopPropagation():void})=>{e.stopPropagation();const current=sourceGunDetailRef(session,'safe',index);if(current)o.action('gun-info-open',current);else o.action('gun-safe-slot',index);};view.bindAction(ref.id!,action);view.bindAction(d.Gun_obj!.id!,action);});
 }else{bind(83,'gun-sub-close');bind(166,'gun-sub-close');view.setText(10103,'武器抽取概率');}
 view.sync=next=>{
  session=next.session;detail=next.detail;const changes:Record<string,boolean>={},values:Record<string,string>={};
  if(o.panel==='gun-collection'){
   (row('Gun_Collection_UI').data.items as Ref[]).forEach((ref,index)=>{const d=byRef(ref).data as GunVisual;visual(d,index,changes,values);if(d.Locked_obj?.id)changes[d.Locked_obj.id]=!session.catalogSeen?.includes(index);});
  }else if(o.panel==='gun-info'&&detail){
   const d=row('Gun_Info_UI').data;const gun=detail.kind==='catalogue'?sourceGun(detail.sourceID):sourceGunDetailCurrent(session,detail);
   if(gun){visual(d as GunVisual,detail.sourceID,changes,values);values[d.Name_txt!.id!]=gun.name;values[d.Damage_txt!.id!]=gun.damageValue?.format()??String(gun.damage);values[d.Speed_txt!.id!]=String(Number(gun.intervalSeconds.toFixed(3)));values[d.Explain_txt!.id!]=next.notice||explanations[gun.sourceType??0];}
   else values[d.Explain_txt!.id!]='武器位置已变化，请返回重新选择';
   const canToggle=!!gun&&(detail.kind==='inventory'||detail.kind==='equipment')&&!gun.adReward,paused=gun?.paused===true,open=sourceGunSafeUnlocked(session.historicMax);
   changes[d.Pause_obj!.id!]=paused;changes[d.TakeOut_Btn_obj!.id!]=!!gun&&detail.kind==='safe';changes[d.Unpause_Btn_obj!.id!]=canToggle&&paused;changes[d.Pause_Btn_obj!.id!]=canToggle&&!paused&&open;changes[d.Pause_Btn_Locked_obj!.id!]=canToggle&&!paused&&!open;
  }else if(o.panel==='gun-safe'){
   const safe=session.gunSafe??freshSourceGunSafe(),open=sourceGunSafeOpenSlots(safe),price=sourceGunSafeNextPrice(safe);
   // Original instruction rectangle doubles as transaction feedback; no synthetic popup.
   values['level0:10185']=next.notice||'将背包武器拖到保险库入口存入。取出后默认保护，解除保护才可合成。';
   values['level0:10346']='武器保险库';
   (row('Safe_UI').data.items as Ref[]).forEach((ref,index)=>{const d=byRef(ref).data,gun=safe.guns[index],slotOpen=index<open;
    changes[d.Empty_obj!.id!]=slotOpen&&!gun;changes[d.Gun_obj!.id!]=slotOpen&&!!gun;changes[d.PurchaseAble_obj!.id!]=index===open;changes[d.Locked_obj!.id!]=index>open;
    values[d.Price_txt!.id!]=`<sprite=1>${price}`;view.setColor(d.Price_txt!.id!,((session.diamonds>=price?d.Price_Enough_Color:d.Price_Lack_Color)??[1,1,1,1]) as number[]);
    if(gun)visual(byRef(d.gun_item!).data as GunVisual,Number(gun.id.match(/source-gun-(\d+)/)?.[1]??0),changes,values);
   });
  }
  view.patch({active:changes,text:values});
 };
 for(const n of tree.nodes.filter(n=>n.path.startsWith(rootPath+'/')&&n.components.some(c=>c.kind==='Button'))){if(!view.boundActions.has(n.id))view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);}
 view.sync(o);view.addDiagnostic('Gun catalogue/detail/safe original roots and PPtrs. Explanation is a Chinese H5 translation; 13 source Degree_Colors are recovered from manager serialization. Original device parity NOT_RUN.');return view;
}
