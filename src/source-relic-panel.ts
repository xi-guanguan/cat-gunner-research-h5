import {createSourceUiView,sourceUiTree,type SourceUiNode} from './source-ui';
import scene from './data/r6-relic-ui.json';
import manager from './data/r6-relic-contract.json';
import adventure from './data/r6-adventure-ui.json';
import cores from './data/r6-adventure-core-sprites.json';
import {sourceRelicValue,sourceRelicMaxLevel,sourceRelicUpgradeCost,sourceRelicDescription,sourceRelicNames,type SourceRelicDrawItem} from './r6-relic';
import type {SourceAdventurePanelOptions,SourceAdventurePanelView} from './source-adventure-panel';
const panelURLs=[395,705,411].map(id=>sourceUiTree.sprites[`sharedassets0.assets:${id}`].url);
const coreURLs=cores.map(p=>sourceUiTree.sprites[`sharedassets0.assets:${p.pathID}`].url);
export const sourceRelicAssetURLs=[...panelURLs,...coreURLs];
import {sourceRelicDrawPresentation} from './r6-relic-presentation';
export {sourceRelicDrawPresentation} from './r6-relic-presentation';
export function createSourceRelicPanel(o:SourceAdventurePanelOptions):SourceAdventurePanelView {
 const nav=o.navigation,page=nav.page,rs=scene as any[],record=(kind:string,id?:string)=>rs.find(r=>r.kind===kind&&(!id||r.id===id));
 const info=record('Relic_Info_UI'),draw=record('Relic_Draw_Panel'),down=record('Relic_DownPanel'),main=(adventure as any[]).find(r=>r.kind==='Adventure_Panel');
 const rootID=page==='relic-info'?info.id:page==='relic-draw'?draw.id:main.id;
 const tree={...sourceUiTree,nodes:sourceUiTree.nodes.map(n=>({...n,components:n.components.map(c=>c.kind==='Image'?{...c,data:{...c.data}}:c)}))};
 const byID=new Map(tree.nodes.map(n=>[n.id,n])),byPath=new Map(tree.nodes.map(n=>[n.path,n])),root=byID.get(rootID)!;
 const active:Record<string,boolean>={},text:Record<string,string>={},fills:Record<string,number>={};
 let ancestor:SourceUiNode|undefined=root;while(ancestor){active[ancestor.id]=true;ancestor=ancestor.parent?byID.get(ancestor.parent):undefined;}
 const children=(id:string)=>tree.nodes.filter(n=>{let p=n.parent;while(p){if(p===id)return true;p=byID.get(p)?.parent??null;}return false;});
 const put=(ref:any,value:string)=>{if(ref?.id)text[ref.id]=value;},show=(ref:any,value:boolean)=>{if(ref?.id)active[ref.id]=value;};
 const image=(ref:any,url:string|null|undefined)=>{if(!url)throw Error(`Missing original relic sprite for ${ref?.id}`);const c=byID.get(ref.id)?.components.find(c=>c.kind==='Image');if(c?.data)c.data.textureURL=url;};
 const label=(node:SourceUiNode|string,suffix:string,value:string)=>{const base=typeof node==='string'?byID.get(node)!:node,n=byPath.get(base.path+suffix);if(n)for(const c of [n,...children(n.id)])if(c.components.some(c=>c.kind==='TextMeshProUGUI'))text[c.id]=value;};
 const demo=(ref:any,index:number)=>{const d=record('Relic_Item_Demo',ref.id)?.data;if(!d)return;const spec=manager.items[index];d.Relic_Type_objs.forEach((ref:any,t:number)=>show(ref,t===spec.type));image(d.Core_img,coreURLs[spec.coreType]);image(d.Panel_img,panelURLs[spec.coreType]);};
 const fill=(ref:any,value:number)=>{if(ref?.id)fills[ref.id]=Math.max(0,Math.min(1,value));};
 const bound=new Set<string>(),actions:Array<{id:string;name:string;payload?:unknown}>=[];
 const bind=(id:string|number,name:string,payload?:unknown)=>{const key=typeof id==='number'?`level0:${id}`:id;bound.add(key);actions.push({id:key,name,payload});};
 const list=rs.filter(r=>r.kind==='Relic_Item');
 const drawView=()=>sourceRelicDrawPresentation(nav.relicDraws,nav.relicDrawPage,Math.max(0,(performance.now()-nav.relicStartedMs)/1000));
 if(page==='relic'){
  const map=byPath.get(root.path+'/Panel/Menu_list/Menu_Map'),relic=byPath.get(root.path+'/Panel/Menu_list/Menu_Relic');if(map)active[map.id]=false;if(relic)active[relic.id]=true;
  label(root,'/Panel/Title_txt','探索与遗物');label(root,'/PrismCore_Panel/Purchase_Btn','核心商店');label(root,'/PrismCore_Panel/Panel/I2_txt(Outline)','棱镜核心 · 全部遗物');label(root,'/Panel/Menu_list/Btn_list/Btn','探索');label(root,'/Panel/Menu_list/Btn_list/Btn (1)','遗物');
  for(const [suffix,on]of [['/Panel/Menu_list/Btn_list/Btn',false],['/Panel/Menu_list/Btn_list/Btn (1)',true]]as const){const base=root.path+suffix;const n=byPath.get(base+'/On_obj'),off=byPath.get(base+'/Off_obj');if(n)active[n.id]=on;if(off)active[off.id]=!on;}
  ['Forest','Desert','Tundra','ALL'].forEach((name,type)=>{const n=byPath.get(root.path+`/Currency_Core/Core (${name})/Count_txt`);if(n)text[n.id]=String(o.state.cores[type]);});
  put(main.data.Lv_txt,`Lv.${o.state.level}`);put(main.data.Exp_txt,String(o.state.exp));
  // Serialized Relic_Item_List order, not tree/name order.
  // Resolve by the previously extracted manager PPtrs (added to contract, never guess IDs).
  const order=(manager as any).itemUI as string[];
  if(!order||order.length!==15)throw Error('Missing original Relic_Item_List identity map');
  order.forEach((id,index)=>{const row=list.find(r=>r.id===id),d=row.data,item=o.relic.items[index],max=item.lv>=sourceRelicMaxLevel(index),cost=sourceRelicUpgradeCost(item.lv);
   demo(d.relic_item_demo,index);show(d.Unlock_obj,item.unlocked);show(d.Locked_obj,!item.unlocked);show(d.Alert_obj,item.unlocked&&!max&&item.count>=cost);
   image(d.LockedPanel_img,panelURLs[manager.items[index].coreType]);image(d.LockedCore_img,coreURLs[manager.items[index].coreType]);
   put(d.Lv_txt,`Lv.${item.lv}`);put(d.Count_txt,max?'MAX':`${item.count}/${cost}`);fill(d.Fill,max?1:item.count/cost);
   bind(d.relic_item_demo.id,'relic-info',index);if(byID.get(d.Locked_obj.id)?.components.some(c=>c.kind==='Button'))bind(d.Locked_obj.id,'relic-info',index);
  });
  rs.filter(r=>r.kind==='Relic_DrawMode_Btn').forEach(r=>{show(r.data.On_obj,r.data._type===nav.relicCoreType);show(r.data.Off_obj,r.data._type!==nav.relicCoreType);bind(r.id,'relic-core',r.data._type);});
  const balance=o.state.cores[nav.relicCoreType],count=Math.floor(balance/20);image(down.data.Core_img,coreURLs[nav.relicCoreType]);put(down.data.Count_txt,String(balance));put(down.data.MaxDraw_Count_txt,`抽取 ${count} 次`);put(down.data.MaxDraw_Price_txt,String(count*20));
  // Native Percent_str_return selects fixed region distribution strings. 1/3
  // is the explicit H5 label until its exact localized literal is compared.
  down.data.Draw_Percent_txt_list.forEach((ref:any,type:number)=>put(ref,nav.relicCoreType===3?'1/3':nav.relicCoreType===type?'100%':'0%'));
  down.data.Core_Alert_objs.forEach((ref:any,type:number)=>show(ref,o.state.cores[type]>=20));
  rs.filter(r=>r.kind==='Draw_Relic_Btn').forEach(r=>{image(r.data.Core_img,coreURLs[nav.relicCoreType]);if(!r.data.is_Max){put(r.data.Price_txt,'20');label(r.id,'','单次抽取');put(r.data.Price_txt,'20');}bind(r.id,'relic-draw',r.data.is_Max?'max':r.data.DrawCount);});
  bind(236,'prism-open');bind(1086,'close');bind(1839,'close');bind(27986,'adventure-main');bind(14082,'adventure-relic');
  main.data.Adventure_Map_list.forEach((ref:any,type:number)=>{const n=byPath.get(byID.get(ref.id)!.path+'/Enter_Btn');if(n)bind(n.id,'adventure-maps',type);});
 }
 if(page==='relic-info'){
  const index=nav.relicIndex,item=o.relic.items[index],d=info.data,cost=sourceRelicUpgradeCost(item.lv),max=item.lv>=sourceRelicMaxLevel(index);
  demo(d.relic_item_demo,index);put(d.Name_txt,sourceRelicNames[index]);put(d.Lv_txt,`Lv.${item.lv}${item.unlocked?'':' · 未获得'}`);put(d.Count_txt,max?'MAX':`${item.count}/${cost}`);put(d.Explain_txt,`${item.unlocked?'':'获得后：'}${sourceRelicDescription(index,item.lv)}${!max&&item.lv<299?`\n下一级：${sourceRelicValue(index,item.lv+1).format()}`:''}`);fill(d.Fill,max?1:item.count/cost);label(root,'/Panel/Upgrade_Btn',max?'已满级':`升级 · ${cost}碎片`);
  bind(1424,'relic-info-close');bind(1335,'relic-info-close');bind(d.relic_item_demo.id,'relic-info',index);bind(25474,'relic-upgrade',index);
 }
 if(page==='relic-draw'){
  const p=drawView(),d=draw.data;show(d.Relic_Item_Single,p.single);show(d.Relic_Item_obj,p.single);
  if(p.single&&nav.relicDraws[0])demo(d.Relic_Item_Single,nav.relicDraws[0].index);
  bind(d.Relic_Item_Single.id,'relic-info',nav.relicDraws[0]?.index??0);
  d.Relic_Item_List.forEach((ref:any,i:number)=>{const result=nav.relicDraws[p.start+i];show(ref,!p.single&&!!result&&i<p.visible);show(d.Relic_Item_obj_List[i],!p.single&&!!result&&i<p.visible);if(result)demo(ref,result.index);bind(ref.id,'relic-info',result?.index??0);});
  const close=byID.get('level0:788')!,closeParent=byID.get(close.parent!)!;active[closeParent.id]=p.ready;show(d.Left_Btn,p.left);show(d.Right_Btn,p.right);
  label(root,'/CloseBtn_obj/Close_Btn','返回遗物');bind(788,'relic-result-close');bind(d.Left_Btn.id,'relic-result-page',-1);bind(d.Right_Btn.id,'relic-result-page',1);
 }
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[root.gameObjectPathID],tree,active,text}) as SourceAdventurePanelView;
 Object.entries(fills).forEach(([id,value])=>view.setFill(id,value));
 for(const a of actions)view.bindAction(a.id,()=>o.action(a.name,a.payload));
 for(const node of [root,...children(root.id)])if(node.components.some(c=>c.kind==='Button')&&!bound.has(node.id)){const message=`未闭合源动作：${node.path}`;view.addDiagnostic(message);view.bindAction(node.id,()=>o.action('unresolved',message));}
 if(page==='relic-info'){const item=o.relic.items[nav.relicIndex];view.setColor(info.data.Upgrade_Btn_img.id,item.unlocked&&item.count>=sourceRelicUpgradeCost(item.lv)&&item.lv<sourceRelicMaxLevel(nav.relicIndex)?info.data.Color_UpgradeAble:info.data.Color_UpgradeDisable);}
 if(page==='relic')rs.filter(r=>r.kind==='Draw_Relic_Btn').forEach(r=>view.setColor(r.data.Panel_img.id,o.state.cores[nav.relicCoreType]>=20?r.data.Color_Panel_Able:r.data.Colo_Paner_Disable));
 view.syncClock=()=>{};
 view.syncFrame=()=>{if(page!=='relic-draw')return;const p=drawView(),d=draw.data;d.Relic_Item_List.forEach((ref:any,i:number)=>{const visible=!p.single&&!!nav.relicDraws[p.start+i]&&i<p.visible;view.setActive(ref.id,visible);view.setActive(d.Relic_Item_obj_List[i].id,visible);});view.setActive(byID.get('level0:788')!.parent!,p.ready);view.setActive(d.Left_Btn.id,p.left);view.setActive(d.Right_Btn.id,p.right);};
 view.addDiagnostic('Original Relic UI/sprites. H5 source-order core transaction; explicit local RNG and timing adapter. Offline simulation, ordinary Skip historical bound, Lv300 and original-device comparisons remain unclosed.');
 return view;
}
