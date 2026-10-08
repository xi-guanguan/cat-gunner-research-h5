import {sourceActivityPurchasePrice} from './source-activity-purchase-projection';
import {Text,type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import scene from './data/r6-weekly-ui.json';
import guns from './data/guns.json';
import colors from './data/r6-gun-degree-colors.json';
import {SOURCE_WEEKLY,SOURCE_PLUS_DURATION_MS,freshSourceWeekly,freshSourcePlus,sourceWeeklyGun,sourceWeeklyRemaining,sourceWeeklyVIPUnlocked,sourcePlusEntitlements} from './r6-weekly';
import type {Session} from './session';
import type {SourceEntitlements} from './r5-entitlements';
const manager=scene.find(r=>r.kind==='WeeklyShop')!,popup=manager.data.WeeklyShop_UI!,gunMenu=scene.find(r=>r.kind==='DailyGun_popup'&&r.id==='level0:1720')!;
const items=gunMenu.data.DailyGun_Item_List!.map(ref=>scene.find(r=>r.id===ref.id)!);
const plus=scene.filter(r=>r.kind==='PlusPack_Inapp_item');
const flags=['plusPack0Active','plusPack1Active','plusPack2Active'] as const;
const timeText=(ms:number)=>{const seconds=Math.ceil(Math.max(0,ms)/1000),days=Math.floor(seconds/86400);return `${days}天 ${String(Math.floor(seconds%86400/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
export interface SourceWeeklyPanelState {session:Session;entitlements:SourceEntitlements;nowUTC:number;menu:0|1;petCoin:number;pending:boolean;saveFailedProduct?:string;notice:string}
export interface SourceWeeklyPanelOptions extends SourceWeeklyPanelState {textures:Record<string,Texture>;viewport:SourceUiViewport;action(name:string,payload?:unknown):void}
export interface SourceWeeklyPanelView extends SourceUiView {sync(state:SourceWeeklyPanelState):void}
export function createSourceWeeklyPanel(o:SourceWeeklyPanelOptions):SourceWeeklyPanelView {
 const active:Record<string,boolean>={},byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));let n=byID.get(popup.id!);while(n){active[n.id]=true;n=n.parent?byID.get(n.parent):undefined;}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[2024],active}) as SourceWeeklyPanelView;
 const notice=new Text('',{fontFamily:'CatGunnerSC,sans-serif',fontSize:12,fill:0xffe5a5,align:'center',wordWrap:true,wordWrapWidth:o.viewport.width-28});notice.anchor.set(.5,1);notice.position.set(o.viewport.width/2,o.viewport.height-18);notice.eventMode='none';view.root.addChild(notice);
 view.sync=s=>{
  const week=s.session.weeklyShop??freshSourceWeekly(),pack=s.session.plusPack??freshSourcePlus(),rights=sourcePlusEntitlements(pack,s.entitlements,s.nowUTC),text:Record<string,string>={},a:Record<string,boolean>={},vip=sourceWeeklyVIPUnlocked(s.session),date=new Date(s.nowUTC),menu=vip?s.menu:0;
  a['level0:1720']=menu===0;a['level0:1524']=menu===1;a[manager.data.VIP_Locked_obj!.id!]=!vip;
  // Source Menu_Btn_2 is serialized inactive and duplicates Menu_Open_Gun. Do not invent a third category.
  a['level0:15621']=false;
  for(const [id,index] of [['level0:15622',0],['level0:4046',1]] as const){const node=byID.get(id);if(node)for(const child of sourceUiTree.nodes.filter(n=>n.parent===id)){if(child.name==='On_obj')a[child.id]=index===menu;if(child.name==='Off_obj')a[child.id]=index!==menu;}}
  text[gunMenu.data.Time_txt!.id!]=timeText(sourceWeeklyRemaining(date));
  notice.text=['本地测试商店 · 不真实支付 · 线上未连接',`当地周一刷新 · H5本地时钟非服务器可信 · 宠物币 ${s.petCoin}`,s.notice].filter(Boolean).join('\n');
  items.forEach(item=>{
   const i=item.data.Item_Idx!,d=item.data,visual=scene.find(r=>r.id===d.gun_item!.id)!.data,gunID=sourceWeeklyGun(i,date),g=guns.guns[gunID],remaining=Math.max(0,SOURCE_WEEKLY.maximumPurchases[i]-week.purchaseCounts[i]),can=remaining>0;
   text[d.PetCoin_txt!.id!]=String(SOURCE_WEEKLY.petCoinRewards[i]);text[d.Count_txt!.id!]=`${remaining}/${SOURCE_WEEKLY.maximumPurchases[i]}`;
   a[d.Disable_Panel_obj!.id!]=!can;a[d.Disable_Step_obj!.id!]=!can;a[d.PurchaseAble_obj!.id!]=can;
   text[visual.Type_txt!.id!]=['单发','激光','穿透','散弹','爆破','导弹','爆狙'][g.type];view.setTextureURL(visual.Gun_img!.id!,g.spriteURL);view.setTextureURL(visual.Shadow_img!.id!,g.spriteURL);view.setColor(visual.Panel_img!.id!,colors.colors[Math.floor(gunID/5)]);visual.Degree_objs!.forEach((ref,j)=>a[ref.id!]=j===Math.floor(gunID/5));
   for(const child of sourceUiTree.nodes.filter(n=>n.path.startsWith(item.path+'/')&&n.name==='Value_txt (1)'))text[child.id]=sourceActivityPurchasePrice(s,SOURCE_WEEKLY.products[i]);
  });
  plus.forEach(item=>{const i=item.data.type!,on=rights[flags[i]],t=pack.purchasedUTC[i];a[item.data.Active_obj!.id!]=on;a[item.data.NonActive_obj!.id!]=!on;text[item.data.Remain_Time_txt!.id!]=t===null?'旧档权益 · 源购买日期缺失':timeText(t+SOURCE_PLUS_DURATION_MS-s.nowUTC);for(const child of sourceUiTree.nodes.filter(n=>n.path.startsWith(item.path+'/')&&n.name==='Price_txt'))text[child.id]=sourceActivityPurchasePrice(s,SOURCE_WEEKLY.plusProducts[i]);});
  view.patch({active:a,text});
 };
 for(const id of [377,822])view.bindAction(id,e=>{e.stopPropagation();o.action('weekly-close');});
 for(const [id,menu] of [[15622,0],[4046,1],[15621,0]] as const)view.bindAction(id,e=>{e.stopPropagation();o.action('weekly-menu',menu);});
 items.forEach(item=>{view.bindAction(item.id,e=>{e.stopPropagation();o.action('weekly-purchase',item.data.Item_Idx);});view.bindAction(item.data.gun_item!.id!,e=>{e.stopPropagation();o.action('weekly-detail',item.data.Item_Idx);});});
 plus.forEach(item=>view.bindAction(item.id,e=>{e.stopPropagation();o.action('plus-purchase',item.data.type);}));
 for(const n of sourceUiTree.nodes.filter(n=>n.path.startsWith(popup.path!+'/')&&n.components.some(c=>c.kind==='Button')))if(!view.boundActions.has(n.id))view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);
 view.sync(o);return view;
}
