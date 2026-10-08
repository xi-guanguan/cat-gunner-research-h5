import {createSourceUiView,sourceUiTree} from './source-ui';
import scene from './data/r6-prism-ui.json';
import {SOURCE_PRISM,sourcePrismRemaining} from './r6-prism';
import type {SourceAdventurePanelOptions,SourceAdventurePanelView} from './source-adventure-panel';
const ROOT='/Canvas/Adventure_manager/PrismCore_Purchase_popup';
export function createSourcePrismPanel(o:SourceAdventurePanelOptions):SourceAdventurePanelView {
 const rows=scene,byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n])),root=sourceUiTree.nodes.find(n=>n.path===ROOT)!;
 const active:Record<string,boolean>={},text:Record<string,string>={};let parent:typeof root|undefined=root;
 while(parent){active[parent.id]=true;parent=byID.get(parent.parent!);}
 const labels=(now:number)=>{
  for(const r of rows){
   const d=r.data,remaining=sourcePrismRemaining(o.coreShop,d.type,now),available=remaining===0;
   if(d.SoldOut_obj.id)active[d.SoldOut_obj.id]=!available;
   if(d.count_tmp.id)text[d.count_tmp.id]=available?'1/1':'0/1';
   if(d.remainTime_tmp.id){const seconds=Math.ceil(remaining/1000);text[d.remainTime_tmp.id]=`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m ${seconds%60}s`;}
  }
 };
 labels(o.nowUTC);
 for(const n of sourceUiTree.nodes){if(!n.path.startsWith(ROOT)||!n.components.some(c=>c.kind==='TextMeshProUGUI'))continue;
  if(n.name==='Count_txt'&&n.path.includes('/Currency_Core/')){
   const index=['Forest','Desert','Tundra','ALL'].findIndex(key=>n.path.includes(`Core (${key})`));if(index>=0)text[n.id]=String(o.state.cores[index]);
  }
  if(n.path.endsWith('/PrismCore_Panel/Panel/I2_txt(Outline)'))text[n.id]='棱镜核心 · 可抽取全部遗物';
  if(n.name==='Value_txt (1)')text[n.id]='本地测试'; // Do not present serialized mock USD as a live catalog quote.
  // Exact descendants, NOT string prefix: "(Limited) (1)" is a sibling.
  let ancestor=byID.get(n.parent!);let row:typeof rows[number]|undefined;
  while(ancestor&&!row){row=rows.find(r=>r.id===ancestor!.id);ancestor=byID.get(ancestor.parent!);}
  if(row&&n.name==='Value_txt')text[n.id]=String(SOURCE_PRISM.amounts[row.data.type]);
  if(row&&n.name==='I2_txt(Outline)')text[n.id]=row.data.type===4?'24小时特惠':'7天特惠';
 }
 const view=createSourceUiView({tree:sourceUiTree,roots:[root.gameObjectPathID],textures:o.textures,viewport:o.viewport,active,text}) as SourceAdventurePanelView;
 const bound=new Set<string>();const bind=(id:string,action:string,payload?:unknown)=>{bound.add(id);view.bindAction(id,()=>o.action(action,payload));};
 for(const row of rows)bind(row.id,'prism-purchase',row.data.type);
 for(const n of sourceUiTree.nodes.filter(n=>n.path.startsWith(ROOT)&&n.components.some(c=>c.kind==='Button'))){
  if(bound.has(n.id))continue;
  if(n.path===ROOT+'/Background'||n.path===ROOT+'/Panel/Close_Btn')bind(n.id,'prism-close');
  else{const message=`未闭合源动作：${n.path}`;view.addDiagnostic(message);bind(n.id,'unresolved',message);}
 }
 const opened=o.nowUTC,started=performance.now();
 view.syncClock=()=>{labels(Math.floor(opened+performance.now()-started));for(const row of rows){const d=row.data;if(d.SoldOut_obj.id)view.setActive(d.SoldOut_obj.id,active[d.SoldOut_obj.id]);if(d.count_tmp.id)view.setText(d.count_tmp.id,text[d.count_tmp.id]);if(d.remainTime_tmp.id)view.setText(d.remainTime_tmp.id,text[d.remainTime_tmp.id]);}};
 view.addDiagnostic('Core shop: source seven products/core3/rolling 24h and independent 7d cooldowns. Local-test provider only; local UTC adapter, no payment/catalog/online time. Original-device comparison NOT_RUN.');
 return view;
}
