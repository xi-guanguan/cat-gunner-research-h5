import {Text,type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import scene from './data/r6-diapig-ui.json';
import {freshSourceDiaPig,sourceDiaPigUnlocked,sourceDiaPigTickAmount,SOURCE_DIAPIG,type SourceRemoveAdsProduct} from './r6-diapig';
import type {Session} from './session';
import type {SourceEntitlements} from './r5-entitlements';
const popup=scene.find(r=>r.kind==='DiaPig_UI')!;
export interface SourceDiaPigPanelState {session:Session;entitlements:SourceEntitlements;seconds:number;pending:boolean;notice:string}
export interface SourceDiaPigPanelOptions extends SourceDiaPigPanelState {textures:Record<string,Texture>;viewport:SourceUiViewport;action(name:string,payload?:unknown):void}
export interface SourceDiaPigPanelView extends SourceUiView {sync(state:SourceDiaPigPanelState):void}
export function createSourceDiaPigPanel(o:SourceDiaPigPanelOptions):SourceDiaPigPanelView {
 const active:Record<string,boolean>={},byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));let n=byID.get(popup.id);while(n){active[n.id]=true;n=n.parent?byID.get(n.parent):undefined;}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[10834],active}) as SourceDiaPigPanelView;
 const notice=new Text('',{fontFamily:'CatGunnerSC,sans-serif',fontSize:13,fill:0xffe5a5,align:'center',wordWrap:true,wordWrapWidth:o.viewport.width-24});notice.anchor.set(.5,1);notice.position.set(o.viewport.width/2,o.viewport.height-18);notice.eventMode='none';view.root.addChild(notice);
 view.sync=s=>{
  const pig=s.session.diaPig??freshSourceDiaPig(),unlocked=sourceDiaPigUnlocked(s.entitlements),d=popup.data;
  view.patch({active:{[d.Locked_obj!.id!]:!unlocked,[d.Unlock_obj!.id!]:unlocked,[d.Descrip_obj!.id!]:unlocked,[d.Descrip_obj_Init!.id!]:!unlocked,[d.Remove_Ads_All_obj!.id!]:!s.entitlements.removeAdsAll||s.entitlements.removeAdsForced,[d.Remove_Ads_Forced_obj!.id!]:s.entitlements.removeAdsAll},text:{'level0:35156':'钻石存钱罐',[d.Count_txt!.id!]:`${pig.diamonds}/${SOURCE_DIAPIG.maximum}`,[d.CoolTime_txt!.id!]:pig.diamonds===SOURCE_DIAPIG.maximum?'已满':`${s.seconds}s`,[d.DiaValue_txt!.id!]:`每分钟累计 ${sourceDiaPigTickAmount(s.entitlements)} 钻石 · 上限 500`,'level0:10229':'拥有任一去广告权益后开始累计；购买不即时赠送钻石','level0:12026':'未解锁 · 点击前往商店','level0:7241':pig.diamonds?'领取':'暂无钻石','level0:35108':'移除全部广告','level0:35157':'移除强制广告','level0:33400':'独立权益 · 每分钟增加1钻石','level0:32944':'独立权益 · 每分钟增加1钻石',...Object.fromEntries([[8799,26432,'removeAdsAll'],[8483,26130,'removeAdsForced']].flatMap(([a,b,flag])=>[a,b].map(id=>[`level0:${id}`,s.entitlements[flag as 'removeAdsAll'|'removeAdsForced']?'已拥有':s.pending?'等待回调':'本地测试'])))}});
  notice.text=['本地测试商店 · 不真实支付 · 线上未连接','H5本地单调时钟 · 未接源服务器信任/离线补发',s.notice].filter(Boolean).join('\n');
 };
 for(const id of [8067,26065])view.bindAction(id,e=>{e.stopPropagation();o.action('diapig-close');});
 view.bindAction(20232,e=>{e.stopPropagation();o.action('diapig-shop');});
 view.bindAction(17461,e=>{e.stopPropagation();o.action('diapig-collect');});
 for(const [id,product]of [[19876,'remove_all_ads'],[20297,'remove_forced_ads']] as [number,SourceRemoveAdsProduct][])view.bindAction(id,e=>{e.stopPropagation();o.action('diapig-purchase',product);});
 for(const n of sourceUiTree.nodes.filter(n=>n.path.startsWith(popup.path+'/')&&n.components.some(c=>c.kind==='Button')))if(!view.boundActions.has(n.id))view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);
 view.sync(o);return view;
}
