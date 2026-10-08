import scene from './data/r6-buff-ui.json';
import {SOURCE_BUFF_KINDS,sourceBuffTimeText} from './r6-buff';
import {sourceBuffMultiplier,type SourceBuffTimes,type SourceEntitlements} from './r5-entitlements';
import type {SourceUiView} from './source-ui';
const panels=scene.rows.filter(r=>r.kind==='Buff_Panel');
export function syncSourceBuffPanel(view:SourceUiView,times:SourceBuffTimes,e:SourceEntitlements){
 const all=SOURCE_BUFF_KINDS.every(k=>sourceBuffMultiplier(e,k,times)===4);
 for(const row of panels){
  const data=row.data as any,kind=SOURCE_BUFF_KINDS[data.type],active=sourceBuffMultiplier(e,kind,times)>1;
  view.setText(data.BuffTime_txt.id,sourceBuffTimeText(e.buffPack?-1:times[kind]));view.setFill(data.Fill.id,e.buffPack?1:times[kind]/900);
  for(const [key,on] of [['NonActive_obj',!active],['Active_obj',active],['NormalBuff_obj',!all],['SuperBuff_obj',all],['AD_Btn_obj',!e.buffPack]] as const)view.setActive(data[key].id,on);
 }
 view.setActive('/Canvas/Buff_manager/Buff_UI/Buff_list/Super_Buff_Panel/Active_obj',all);
 view.setActive('/Canvas/Buff_manager/Buff_UI/Buff_list/Super_Buff_Panel/NonActive_obj',!all);
}
export const SOURCE_BUFF_PANEL_ACTIONS=panels.map(row=>({path:(row.data as any).AD_Btn_obj.path as string,kind:SOURCE_BUFF_KINDS[(row.data as any).type]}));
