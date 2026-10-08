import type {Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import scene from './data/r6-star-ui.json';
import {sourceStarQuote,sourceStarDamage} from './r6-star';
import type {BigValueInput} from './big-value';
import type {Session} from './session';
export interface SourceStarPanelOptions {textures:Record<string,Texture>;viewport:SourceUiViewport;session:Session;slot:number;notice:string;damageBase?:BigValueInput|null;context?:'field'|'raid';action(name:string,payload?:unknown):void}
export interface SourceStarPanelView extends SourceUiView {sync(options:Pick<SourceStarPanelOptions,'session'|'slot'|'notice'|'damageBase'|'context'>):void}
const root='/Canvas/Gun_manager/StarUpgrade_manager/SlotUpgrade_UI';
/** Original serialized StarUpgrade_popup fields, images, anchors and button identities. */
export function createSourceStarPanel(o:SourceStarPanelOptions):SourceStarPanelView {
 const active:Record<string,boolean>={},text:Record<string,string>={};const byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));let node=byID.get('level0:274');while(node){active[node.id]=true;node=node.parent?byID.get(node.parent):undefined;}
 active[scene.success_particle.id!]=false; // Source particles not yet reconstructed; never a replacement illustration.
 text[root+'/Panel/Upgrade_btn/I2_txt(Outline)']='强化';text[root+'/Panel/Explain/I2_txt']='失败不会降低星级；18–20星失败后成功率递增，最高5%。';
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[274],active,text}) as SourceStarPanelView;
 view.sync=next=>{
  const q=sourceStarQuote({levels:next.session.bossSlotLevels??[0,0,0],failCounts:next.session.starFailCounts??[0,0,0],starGem:next.session.starGem??0},next.slot,next.session.historicMax);
  const max=q.level===20,gun=next.session.equippedGuns[next.slot],base=next.context==='raid'?next.damageBase:gun?(gun.damageValue??gun.damage):null;
  const values:Record<string,string>={};const set=(key:keyof typeof scene,value:string)=>{const p=scene[key] as {id?:string|null};if(p?.id)values[p.id]=value;};
  set('SlotNum_txt',`枪槽 ${next.slot+1}`);set('StarGem_txt',String(next.session.starGem??0));set('StarLv_txt_Now',String(q.level));set('StarLv_txt_After',max?'MAX':String(q.nextLevel));
  set('StarValue_txt_Now',`+${q.currentDamagePercent.subtract(100).format()}%`);set('StarValue_txt_After',max?'MAX':`+${q.nextDamagePercent.subtract(100).format()}%`);
  set('DamageValue_txt_Now',base!=null?sourceStarDamage(base,q.level).format():'—');set('DamageValue_txt_After',base!=null&&!max?sourceStarDamage(base,q.nextLevel).format():'—');
  set('Percent_txt',max?'MAX':`${q.successRate}%`);set('UpgradePrice_txt',max?'MAX':String(q.cost));
  view.patch({text:values,active:{[scene.Damage_Value_obj.id!]:base!=null}});
  const enough=(next.session.starGem??0)>=q.cost;view.setColor(scene.Upgrade_Btn_img.id!,scene.UpgradeBtn_Colors[enough?1:0]);view.setColor(scene.UpgradePrice_txt.id!,scene.UpgradePrice_Colors[enough?1:0]);
  const reasons={'invalid-slot':'无效枪槽','stage-required':'普通第40大关开放','max-level':'已达20星','insufficient-star-gem':'星之宝石不足'};
  view.setText(root+'/Panel/Explain/I2_txt',next.notice||(q.reason?reasons[q.reason]:'失败不降星。18–20星失败后成功率递增，最高5%。'));
 };
 const actions=new Map([[root+'/Background','star-close'],[root+'/Panel/Close_Btn','star-close'],[root+'/Panel/Upgrade_btn','star-upgrade']]);
 for(const n of sourceUiTree.nodes.filter(n=>n.path.startsWith(root+'/')&&n.components.some(c=>c.kind==='Button'))){const action=actions.get(n.path);if(!action){view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);continue;}view.bindAction(n.id,e=>{e.stopPropagation();o.action(action);});}
 view.addDiagnostic('StarUpgrade success particle not reproduced; integer random adapter differs from Unity sequence. Raid mode1 uses its selected gun raw damage × weakness; no field equipment fallback.');view.sync(o);return view;
}
