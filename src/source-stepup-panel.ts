import {sourceActivityPurchasePrice} from './source-activity-purchase-projection';
import {Text,type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import scene from './data/r6-stepup-ui.json';
import guns from './data/guns.json';
import colors from './data/r6-gun-degree-colors.json';
import {SOURCE_STEPUP,freshSourceStepUp,sourceStepUpPurchasable,sourceStepUpExpired,sourceStepUpTimeText} from './r6-stepup';
import type {Session} from './session';
const popup=scene.find(r=>r.kind==='StepUp_popup')!;
const items=popup.data.StepUp_Item_list!.map(ref=>scene.find(r=>r.id===ref.id)!);
export interface SourceStepUpPanelOptions {textures:Record<string,Texture>;viewport:SourceUiViewport;session:Session;nowUTC:number;pending:boolean;saveFailedProduct?:string;notice:string;action(name:string,payload?:unknown):void}
export interface SourceStepUpPanelView extends SourceUiView {sync(o:Pick<SourceStepUpPanelOptions,'session'|'nowUTC'|'pending'|'saveFailedProduct'|'notice'>):void}
export function createSourceStepUpPanel(o:SourceStepUpPanelOptions):SourceStepUpPanelView {
 const active:Record<string,boolean>={},byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));let n=byID.get(popup.id);while(n){active[n.id]=true;n=n.parent?byID.get(n.parent):undefined;}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[697],active}) as SourceStepUpPanelView;
 const notice=new Text('',{fontFamily:'CatGunnerSC,sans-serif',fontSize:13,fill:0xffe5a5,align:'center',wordWrap:true,wordWrapWidth:o.viewport.width-24});notice.anchor.set(.5,1);notice.position.set(o.viewport.width/2,o.viewport.height-18);notice.eventMode='none';view.root.addChild(notice);
 view.sync=next=>{
  const s=next.session.stepUp??freshSourceStepUp(),expired=sourceStepUpExpired(s,next.nowUTC),text:Record<string,string>={},a:Record<string,boolean>={};
  text[popup.data.Time_txt!.id!]=sourceStepUpTimeText(s,next.nowUTC);notice.text=['本地测试商店 · 不真实支付 · 线上未连接',expired?'活动已结束：入口隐藏；源已开弹窗仍按顺序可购买':'',next.notice].filter(Boolean).join('\n');
  items.forEach((item,i)=>{
   const d=item.data,visual=scene.find(r=>r.id===d.gun_item!.id)!.data,gunID=SOURCE_STEPUP.gunRewards[i],g=guns.guns[gunID],can=sourceStepUpPurchasable(s,i),locked=!s.purchased[i]&&!can;
   text[d.Step_txt!.id!]=`第${i+1}档`;text[d.Dia_txt!.id!]=String(SOURCE_STEPUP.diaRewards[i]);a[d.Dia_obj!.id!]=SOURCE_STEPUP.diaRewards[i]>0;text[d.Locked_txt!.id!]=`先购买第${i}档`;
   a[d.Disable_Panel_obj!.id!]=locked;a[d.Disable_Step_obj!.id!]=locked;a[d.Purchased_obj!.id!]=s.purchased[i];a[d.Purchase_Btn_obj!.id!]=can;a[d.Glow_obj!.id!]=can&&!next.pending;
   text[visual.Type_txt!.id!]=["单发","激光","穿透","散弹","爆破","导弹","爆狙"][g.type];view.setTextureURL(visual.Gun_img!.id!,g.spriteURL);view.setTextureURL(visual.Shadow_img!.id!,g.spriteURL);view.setColor(visual.Panel_img!.id!,colors.colors[Math.floor(gunID/5)]);
   visual.Degree_objs!.forEach((ref,j)=>a[ref.id!]=j===Math.floor(gunID/5));
   const price=sourceUiTree.nodes.find(n=>n.parent===d.Purchase_Btn_obj!.id&&n.name==='Value_txt (1)')??sourceUiTree.nodes.find(n=>n.path.startsWith(d.Purchase_Btn_obj!.path!+'/')&&n.name==='Value_txt (1)');if(price)text[price.id]=sourceActivityPurchasePrice(next,SOURCE_STEPUP.products[i]);
  });view.patch({active:a,text});
 };
 view.bindAction(743,e=>{e.stopPropagation();o.action('stepup-close');});view.bindAction(1696,e=>{e.stopPropagation();o.action('stepup-close');});
 items.forEach((item,i)=>{view.bindAction(item.id,e=>{e.stopPropagation();o.action('stepup-purchase',i);});view.bindAction(item.data.gun_item!.id!,e=>{e.stopPropagation();o.action('stepup-detail',SOURCE_STEPUP.gunRewards[i]);});});
 for(const n of sourceUiTree.nodes.filter(n=>n.path.startsWith(popup.path+'/')&&n.components.some(c=>c.kind==='Button')))if(!view.boundActions.has(n.id))view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);
 view.setText(popup.path+'/Panel/Explain_txt','原五档奖励 · 本地测试交易 · 不真实支付');view.sync(o);return view;
}
