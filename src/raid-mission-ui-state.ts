/** Serialized Item pool order, native state flags, source sorting and progress. */
import scene from './data/r6-raid-mission-ui.json';
import {SOURCE_RAID_MISSION,sourceRaidMissionRefresh,sourceRaidMissionState,sourceRaidMissionProgress,sourceRaidMissionReClaimableReward,sourceRaidMissionOrder,sourceRaidMissionHasClaimable,type SourceRaidMissionState} from './r6-raid-mission';
import type {SourceRaidState} from './r6-raid';
import {sourceWeeklyRemaining} from './r6-weekly';
export const SOURCE_RAID_MISSION_UI=scene.find(r=>r.kind==='Raid_Mission_UI')!;
export const SOURCE_RAID_MISSION_TICKET_POPUP='level0:1634';
export const SOURCE_RAID_MISSION_ITEMS=SOURCE_RAID_MISSION_UI.data.Mission_item_list!.map(p=>scene.find(r=>r.component===p.pathID)!);
const hud=scene.find(r=>r.kind==='Raid_Mission_HUD')!;
export const sourceRaidMissionHUD=(s:SourceRaidMissionState)=>({active:{[hud.data.Alert_obj!.id!]:sourceRaidMissionHasClaimable(s)}});
export const sourceRaidMissionBindings=SOURCE_RAID_MISSION.buttons.map(b=>{
 const c=b.calls[0],target=SOURCE_RAID_MISSION_ITEMS.findIndex(r=>r.component===c?.targetPathID);
 const sourceTest=b.path.includes('/Test_obj/');
 return {id:b.id,action:sourceTest?'raid-mission-source-test':!c?'raid-mission-locked':c.method==='onClick_Reward'?'raid-mission-claim':c.method==='onClick_ReReward'?'raid-mission-reclaim':c.method==='onClick_Ticket_Purchase'?'raid-mission-purchase':c.method==='onClick_Open'?'raid-mission':c.targetPathID===1634?'raid-mission-ticket-close':'raid-mission-close',payload:target<0?undefined:target};
});
export function sourceRaidMissionProjection(s:SourceRaidMissionState,raid:SourceRaidState,nowUTC:number,ticketOpen=false){
 const state=sourceRaidMissionRefresh(s,raid),active:Record<string,boolean>={[SOURCE_RAID_MISSION_TICKET_POPUP]:ticketOpen},text:Record<string,string>={},fills:Record<string,number>={};
 SOURCE_RAID_MISSION_ITEMS.forEach((r,i)=>{const d=r.data,m=SOURCE_RAID_MISSION.missions[i],v=sourceRaidMissionState(state,i),p=sourceRaidMissionProgress(state,raid,i);
  for(const [j,k]of (['Locked_obj','Claimable_obj','ReClaimable_obj','Done_obj'] as const).entries())active[d[k]!.id!]=v===j;
  text[d.Reward_txt!.id!]=String(m.reward);text[d.Explain_txt!.id!]=m.type===0?`本周参与突袭 ${m.goal} 次`:`本周突袭最高分达到 ${m.goal}`;
  text[d.Value_txt!.id!]=`${p.current} / ${p.goal}`;fills[d.Value_Fill!.id!]=Math.fround(Math.fround(p.current)/Math.fround(p.goal));
 });
 for(const r of scene.filter(r=>r.kind==='Raid_Mission_Ticket_UI')){const d=r.data;active[d.Ticket_Purchase_btn_obj!.id!]=!state.ticketPurchased;active[d.Ticket_Purchased_obj!.id!]=state.ticketPurchased;text[d.ReGet_Count_txt!.id!]=String(sourceRaidMissionReClaimableReward(state));}
 const seconds=Math.ceil(sourceWeeklyRemaining(new Date(nowUTC))/1000),days=Math.floor(seconds/86400);text[SOURCE_RAID_MISSION_UI.data.Season_Remain_txt!.id!]=`${days?days+'天 ':''}${String(Math.floor(seconds%86400/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 return {state,active,text,fills,order:sourceRaidMissionOrder(state)};
}
