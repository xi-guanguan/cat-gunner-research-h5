import {Text,type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import scene from './data/r6-skin-ui.json';
import {freshSourceSkinState,sourceSkinRow,sourceSkinTotals,SOURCE_SKIN_COUNT} from './r6-skin';
import type {Session} from './session';
const manager=scene.find(r=>r.kind==='Skin_manager')!.data,info=scene.find(r=>r.kind==='Skin_Info_UI')!.data;
const items=manager.Skin_item_list!.map(ref=>scene.find(r=>r.id===ref.id)!);
export const sourceSkinAssetURLs=manager.Skin_sprites!.map(p=>p.url!);
export interface SourceSkinPanelOptions {textures:Record<string,Texture>;viewport:SourceUiViewport;session:Session;panel:'skin'|'skin-info';index:number;notice?:string;action(name:string,payload?:unknown):void}
export interface SourceSkinPanelView extends SourceUiView {sync(o:Pick<SourceSkinPanelOptions,'session'|'index'|'notice'>):void}
/** Original source list/detail hierarchy, including each item's stable manager index. */
export function createSourceSkinPanel(o:SourceSkinPanelOptions):SourceSkinPanelView {
 const root=o.panel==='skin'?2285:903,active:Record<string,boolean>={},byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));let node=byID.get(`level0:${root}`);while(node){active[node.id]=true;node=node.parent?byID.get(node.parent):undefined;}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[root],active}) as SourceSkinPanelView;
 const notice=new Text('',{fontFamily:'CatGunnerSC, sans-serif',fontSize:14,fill:0xffe5a5,align:'center',wordWrap:true,wordWrapWidth:o.viewport.width-32});notice.anchor.set(.5,1);notice.position.set(o.viewport.width/2,o.viewport.height-18);notice.eventMode='none';view.root.addChild(notice);
 view.sync=next=>{
  notice.text=next.notice??'';
  const s=next.session.skin??freshSourceSkinState(),totals=sourceSkinTotals(s),text:Record<string,string>={},a:Record<string,boolean>={};
  if(o.panel==='skin'){
   const add=(key:'Damage_Accum_txt'|'Speed_Accum_txt'|'Money_Accum_txt',value:number)=>{text[manager[key]!.id!]=`+${value-100}%`;};add('Damage_Accum_txt',totals.damagePercent);add('Speed_Accum_txt',totals.speedPercent);add('Money_Accum_txt',totals.moneyPercent);
   items.forEach((item,i)=>{a[item.data.Selected_obj!.id!]=s.selected===i;a[item.data.Locked_obj!.id!]=!s.owned[i];view.setSprite(item.data.Cat_img!.id!,manager.Skin_sprites![i].spriteKey!);});
  }else{
   const i=next.index,row=sourceSkinRow(i),owned=s.owned[i],selected=s.selected===i;
   const set=(key:'Num_txt'|'Damage_txt'|'Speed_txt'|'Money_txt'|'Price_txt',value:string)=>text[info[key]!.id!]=value;
   set('Num_txt',String(i+1));set('Damage_txt',`+${row.damage}%`);set('Speed_txt',`+${row.speed}%`);set('Money_txt',`+${row.money}%`);set('Price_txt',String(row.price));
   a[info.Before_Btn_obj!.id!]=i>0;a[info.Next_Btn_obj!.id!]=i<SOURCE_SKIN_COUNT-1;a[info.Locked_img!.id!]=!owned;
   a[info.Purchase_Btn_obj!.id!]=!owned;a[info.Select_Btn_obj!.id!]=owned&&!selected;a[info.Selected_obj!.id!]=selected;
   view.setSprite(info.Cat_img!.id!,manager.Skin_sprites![i].spriteKey!);
   view.setColor(info.Price_txt!.id!,next.session.diamonds>=row.price?[1,1,1,1]:info.Color_Disable!);
  }
  view.patch({text,active:a});
 };
 const actions=new Map<string,{name:string;payload?:number}>(items.map((item,i)=>[item.path,{name:'skin-info',payload:i}]));
 const list='/Canvas/Skin_manager/SkinList_UI',detail='/Canvas/Skin_manager/SkinInfo_UI';
 for(const path of [list+'/Image',list+'/Panel/Close_Btn'])actions.set(path,{name:'skin-close'});
 for(const path of [detail+'/Background',detail+'/Panel/Close_Btn'])actions.set(path,{name:'skin-info-close'});
 for(const [path,name]of [['/Panel/Btn_list/Next_Btn','skin-next'],['/Panel/Btn_list/Before_Btn','skin-before'],['/Panel/Purchase_Btn','skin-purchase'],['/Panel/Select_Btn','skin-select']])actions.set(detail+path,{name});
 const prefix=o.panel==='skin'?list:detail;
 for(const n of sourceUiTree.nodes.filter(n=>n.path.startsWith(prefix+'/')&&n.components.some(c=>c.kind==='Button'))){const action=actions.get(n.path);if(!action){view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);continue;}view.bindAction(n.id,e=>{e.stopPropagation();o.action(action.name,action.payload);});}
 view.setText(list+'/Panel/Title_txt','皮肤');view.setText(detail+'/Panel/Purchase_Btn/I2_txt','购买');view.setText(detail+'/Panel/Select_Btn/I2_txt','选择');view.sync(o);return view;
}
