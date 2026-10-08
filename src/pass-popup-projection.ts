/** Source popup/card projection; obsolete inactive panels remain inactive. */
import fields from './data/r6-pass-ui.json';
import guns from './data/guns.json';
import type {SourceUiTree} from './source-ui';
import type {SourceMetaBundle} from './source-meta-runtime';
import {sourceMetaPassView} from './source-meta-runtime';
import {sourcePassClaimGate} from './source-meta-actions';
export type SourcePassPopup='none'|'vip'|'luxury'|'next'|'forced';
const base='/Canvas/SafeArea/Mission_maanger/';
export const SOURCE_PASS_POPUP_ROOTS={vip:base+'VipPass_Purchase_UI',luxury:base+'LuxuryPass_Purchase_UI',next:base+'NewSeason_UI',forced:base+'NewSeason_UI (forced)'};
export function sourcePassPopupProjection(tree:SourceUiTree,b:SourceMetaBundle,popup:SourcePassPopup,pending=false){
 const active:Record<string,boolean>={},text:Record<string,string>={},sprites=new Map<string,string>(),bindings=new Map<string,{name:string;payload?:unknown}>();
 const nodes=new Map(tree.nodes.map(n=>[n.id,n]));
 const bind=(id:string,name:string,payload?:unknown)=>{const n=nodes.get(id);if(n)bindings.set(n.path,{name,payload});};
 for(const [key,path]of Object.entries(SOURCE_PASS_POPUP_ROOTS))active[path]=popup===key;
 for(const id of ['1266','2122','44','1964','1880','249','770','1292'])bind('level0:'+id,'pass-popup-close');
 for(const id of ['1571','1227'])bind('level0:'+id,'pass-next');
 // VIP_Purchase_popup -> Shop_manager.Purchase_VIP_Banner -> Purchase_VIP.
 for(const id of ['128','987'])bind('level0:'+id,'pass-banner-purchase');
 for(const record of fields){
  if(record.kind!=='VIP_Purchase_Ingame')continue;
  const d=record.data as unknown as {type:number;Purchase_Btn:{path:string};Purchased_obj:{path:string};Price_Normal_obj:{path:string|null};Price_Upgrade_obj:{path:string|null}};
  const owned=d.type===0?b.meta.vip:b.meta.luxury,product=d.type===0?'vip':b.meta.vip?'luxury-upgrade':'luxury';
  bindings.set(record.path,{name:'pass-purchase',payload:product});bindings.set(d.Purchase_Btn.path,{name:'pass-purchase',payload:product});
  active[d.Purchase_Btn.path]=!owned;active[d.Purchased_obj.path]=owned;
  if(d.Price_Normal_obj.path){active[d.Price_Normal_obj.path]=!b.meta.vip;text[d.Price_Normal_obj.path]=pending?'本地处理中…':'测试购买';}
  if(d.Price_Upgrade_obj.path){active[d.Price_Upgrade_obj.path]=b.meta.vip;text[d.Price_Upgrade_obj.path]=pending?'本地处理中…':'测试升级';}
  // VIP price's original store quote is not a live online quote.
  for(const n of tree.nodes)if(n.path.startsWith(d.Purchase_Btn.path+'/')&&n.name==='Price_txt')text[n.path]=pending?'本地处理中…':'测试购买';
 }
 const pass=sourceMetaPassView(b),first=Math.max(0,Math.min(pass.level,pass.epicRewards.length)-3);
 for(const key of ['next','forced']as const){
  const root=SOURCE_PASS_POPUP_ROOTS[key],promo=root+'/VIP Panel (Inapp)';active[promo]=!b.meta.vip;
  for(let i=0;i<3;i++){
   const p=promo+'/Panel/Reward_list/Mission_Reward_Epic'+(i?` (${i})`:''),index=first+i,reward=pass.epicRewards[index];
   active[p]=!!reward;if(!reward)continue;
   active[p+'/Dia']=reward.kind==='diamonds';active[p+'/Core']=reward.kind==='core';active[p+'/Gun']=reward.kind==='gunUnlock';
   text[p+'/Dia/Dia_Value']=String(reward.amount);text[p+'/Core/Core_Value']=String(reward.amount);
   const claimed=pass.epicClaims[index],gate=sourcePassClaimGate(pass,1,index,{adConfirmed:true,adRemoved:true});
   active[p+'/Get_obj']=claimed;active[p+'/Locked_obj']=!b.meta.vip;active[p+'/NonClear_obj']=pass.level<=index;
   active[p+'/GetAble_obj']=!claimed&&gate.status==='supported';active[p+'/SequenceLocked_obj']=gate.status!=='supported'&&gate.reason==='previous-reward-required';active[p+'/SequenceLocked_obj2']=active[p+'/SequenceLocked_obj'];active[p+'/AD_Icon']=false;
   if(reward.kind==='gunUnlock'){const gun=guns.guns.find(g=>g.sourceID===reward.amount);if(gun)sprites.set(p+'/Gun/Gun/Gun_img',gun.spriteURL);text[p+'/Gun/Type_txt']=`武器 #${reward.amount+1}`;const grades=['D','C','B','A','S','SS','SSS','X','XX','XXX','Z','ZZ','ZZZ'];grades.forEach((name,j)=>active[p+'/Gun/Degree (2)/'+name]=j===Math.floor(reward.amount/5));}
   // Serialized demo Buttons are disabled. Their fixed slot-5 event is audited,
   // not silently re-enabled or replaced with the visual window index.
  }
 }
 return {active,text,sprites,bindings};
}
