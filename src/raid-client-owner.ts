/** Single-save-context Raid lifecycle. Source coroutine references are in
 * raid-client-lifecycle-contract.json. No scene assets, Cat AI or fake DPS are
 * provided by this owner; a prepared scene must emit actual projectiles.
 * WaitForSeconds resumes once per H5 frame; overshoot does NOT spill into the
 * next wait. Unity Update/coroutine ordering remains an explicit H5 adapter.
 */
import {SourceRaidSessionBridge,type SourceRaidBridgeCommit} from './raid-session-bridge';
import type {SourceRaidBattleRuntime,SourceRaidBattleEvent} from './raid-battle-runtime';
import {sourceRaidSelectionRefresh,type SourceRaidEntryRequest,type SourceRaidSelection} from './r6-raid';
import type {SourceRewardResponse} from './r6-reward-provider';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceHuntFlightEvent} from './hunt-projectile-flight';
import type {MineTimeAdapter} from './mine-time';
export const SOURCE_RAID_CLIENT_WAITS=Object.freeze({enterSeconds:2,exitFieldSeconds:1.5,exitMaskSeconds:Math.fround(.2)});
export type SourceRaidClientPhase='preparing'|'provider'|'enter-loading'|'playing'|'ended'|'exit-field-wait'|'exit-mask-wait'|'disposed';
export type SourceRaidClientEvent={kind:'phase';phase:SourceRaidClientPhase}|{kind:'restore-field'}|{kind:'battle';event:SourceRaidBattleEvent};
export interface SourceRaidClientFrame {simulate:boolean;acceptInput:boolean;presentation:boolean;joystick:{x:number;y:number}}
export interface SourceRaidClientScene {
 prepare():Promise<void>;
 /** Advances actual Cats/sockets/attack clocks; only in playing. Host timer and
  * contacts advance exactly once in the owner, never a scene-owned second clock. */
 advanceCats(host:SourceRaidBattleRuntime,dt:number,input:SourceRaidClientFrame):void;
 consume(events:readonly SourceRaidBattleEvent[],flights:readonly SourceHuntFlightEvent[],dt:number):void;
 render(dt:number):void;destroy():void;setPresentationEnabled?(enabled:boolean):void;
}
export interface SourceRaidClientPorts {
 read():SourceMetaBundle;current():boolean;
 /** Atomic synchronous persistence: on throw, live bundle MUST remain unchanged. */
 write(bundle:SourceMetaBundle,reason:'admission'|'start'|'result'|'clock'|'progress'):void;
 scene(host:SourceRaidBattleRuntime,selection:SourceRaidSelection):SourceRaidClientScene;
 execute(request:SourceRaidEntryRequest):Promise<SourceRewardResponse>;
 notice(text:string):void;events?(events:readonly SourceRaidClientEvent[]):void;
}
type WriteReason='admission'|'start'|'result'|'clock'|'progress';
type NextPhase={phase:SourceRaidClientPhase;wait?:number};
interface PendingWrite {before:SourceMetaBundle;commit:SourceRaidBridgeCommit;reason:WriteReason;flights:SourceHuntFlightEvent[];dt:number;next?:NextPhase}
export class SourceRaidClientOwner {
 readonly bridge:SourceRaidSessionBridge;readonly scene:SourceRaidClientScene;
 phase:SourceRaidClientPhase='preparing';ready=false;restoredField=false;
 frameCount=0;renderCount=0;hitCount=0;
 private pendingWrite:PendingWrite|null=null;
 presentationFailure:string|null=null;simulationFailure:string|null=null;saveFailure:string|null=null;
 private invoked=false;private generation=0;private wait=0;private disposedScene=false;
 constructor(readonly runID:string,selection:SourceRaidSelection,private readonly ports:SourceRaidClientPorts){
  this.bridge=new SourceRaidSessionBridge(runID,ports.read(),selection);this.scene=ports.scene(this.bridge.host,this.bridge.selection);
 }
 get host(){return this.bridge.host;}get closed(){return this.phase==='disposed';}
 get ownsField(){return !this.closed&&!this.restoredField;}
 get pending(){return this.phase==='provider';}get waitSeconds(){return this.wait;}
 private current(){return !this.closed&&this.ports.current();}
 private notice(text:string):void {try{this.ports.notice(text);}catch{/* Diagnostics never own gameplay state. */}}
 private notify(events:readonly SourceRaidClientEvent[]):void {
  try{this.ports.events?.(events);}catch(error){this.notice(`突袭事件呈现失败：${String(error)}；已提交的存档不回滚`);}
 }
 private phaseTo(phase:SourceRaidClientPhase,wait=0):void {this.phase=phase;this.wait=wait;this.notify([{kind:'phase',phase}]);}
 private deliver(r:SourceRaidBridgeCommit,flights:SourceHuntFlightEvent[],dt:number,next?:NextPhase):void {
  // Presentations are best effort AFTER persistence. A scene/HUD error is not a
  // provider failure and cannot revoke debit, lose a valid result or re-grant it.
  try{this.scene.consume(r.events,flights,dt);}catch(error){this.presentationFailure=String(error);this.notice(`突袭画面消费失败：${String(error)}；结算状态已保留`);}
  this.hitCount+=flights.filter(e=>['direct-damage','blast-damage'].includes(e.event.kind)).length;
  if(r.events.length)this.notify(r.events.map(event=>({kind:'battle' as const,event})));
  if(next)this.phaseTo(next.phase,next.wait??0);
 }
 private apply(r:SourceRaidBridgeCommit,reason?:WriteReason,flights:SourceHuntFlightEvent[]=[],dt=0,next?:NextPhase,before=this.ports.read()):boolean {
  if(!this.current()){this.cancel();return false;}
  if(r.status==='blocked'){this.notice(r.reason);this.cancel();return false;}
  if(r.reason)this.notice(r.reason);
  if(reason){
   try{this.ports.write(r.bundle,reason);}catch(error){
    this.pendingWrite={before,commit:r,reason,flights,dt,next};this.saveFailure=String(error);
    this.notice(`突袭存档写入失败：${String(error)}；战斗暂停，等待重试保存，不重复扣费或结算`);return false;
   }
  }
  this.deliver(r,flights,dt,next);return true;
 }
 /** Explicit local storage recovery. Do NOT repeat a provider request or bridge
  * transaction. Merge only the committed Raid delta into the CURRENT wallet.
  * Another save/day/equipment identity invalidates this pending write. */
 retrySave():boolean {
  if(!this.current()){this.cancel();return false;}
  const p=this.pendingWrite;if(!p)return false;
  const current=this.ports.read(),refreshed=sourceRaidSelectionRefresh(current.session,this.bridge.selection);
  if(current.session.mode!=='field'||JSON.stringify(current.meta.raid)!==JSON.stringify(p.before.meta.raid)||JSON.stringify(current.meta.raidStarPig)!==JSON.stringify(p.before.meta.raidStarPig)||JSON.stringify(current.meta.raidMission)!==JSON.stringify(p.before.meta.raidMission)||
   this.bridge.selection.some((s,i)=>s&&(!refreshed[i]||refreshed[i]!.index!==s.index))){
   this.notice('突袭待保存身份已变化；不覆盖新存档或日期');this.cancel();return false;
  }
  const delta=(p.commit.bundle.session.starGem??0)-(p.before.session.starGem??0),balance=(current.session.starGem??0)+delta;
  if(!Number.isSafeInteger(balance)||balance<0){this.notice('突袭余额超过存档范围；等待修复，未部分发奖');return false;}
  const bundle={...current,session:{...current.session,starGem:balance},meta:{...current.meta,raid:p.commit.bundle.meta.raid,raidStarPig:p.commit.bundle.meta.raidStarPig,raidMission:p.commit.bundle.meta.raidMission}};
  try{this.ports.write(bundle,p.reason);}catch(error){this.saveFailure=String(error);this.notice(`突袭保存仍失败：${String(error)}`);return false;}
  this.pendingWrite=null;this.saveFailure=null;this.deliver({...p.commit,bundle},p.flights,p.dt,p.next);return true;
 }
 async start():Promise<boolean>{
  if(this.invoked||this.closed)return false;this.invoked=true;const generation=this.generation;
  try{
   await this.scene.prepare();
   if(generation!==this.generation||!this.current()){this.cancel();return false;}
   if(!this.apply(this.bridge.commit(this.ports.read())))return false;
   this.bridge.prepared();this.ready=true;
   const request=this.bridge.beginProvider(this.ports.read());
   let r:SourceRaidBridgeCommit;
   if(request){
    this.phaseTo('provider');
    const response=await this.ports.execute(request);
    if(generation!==this.generation||!this.current()){this.cancel();return false;}
    r=this.bridge.finishProvider(this.ports.read(),request,response,true);
   }else r=this.bridge.startFree(this.ports.read(),true);
   return this.apply(r,'admission',[],0,{phase:'enter-loading',wait:SOURCE_RAID_CLIENT_WAITS.enterSeconds});
  }catch(error){
   if(generation===this.generation&&this.current())this.notice(`突袭准备或本地服务失败：${String(error)}；未重复入场`);
   this.cancel();return false;
  }
 }
 advance(dt:number,input:SourceRaidClientFrame):void {
  if(!Number.isFinite(dt)||dt<0||!Number.isFinite(Math.fround(dt)))throw RangeError('Invalid Raid client delta');
  if(!this.current()){this.cancel();return;}if(!this.ready||this.pendingWrite)return;
  if(!this.presentationFailure){try{this.scene.setPresentationEnabled?.(input.presentation);}catch(error){this.presentationFailure=String(error);this.notice(`突袭表现切换失败：${String(error)}；战斗仍使用独立时钟`);}}
  if(input.simulate){
   if(this.phase==='enter-loading'||this.phase==='exit-field-wait'||this.phase==='exit-mask-wait'){
    this.wait=Math.fround(this.wait-Math.fround(dt));
    if(this.wait<=0){
     if(this.phase==='enter-loading'){
      if(!this.apply(this.bridge.activate(this.ports.read()),'start',[],0,{phase:'playing'}))return;
     }else if(this.phase==='exit-field-wait'){
      this.restoredField=true;this.notify([{kind:'restore-field'}]);
      this.phaseTo('exit-mask-wait',SOURCE_RAID_CLIENT_WAITS.exitMaskSeconds);
     }else {this.cancel();return;}
    }
   }else if(this.phase==='playing'&&!this.simulationFailure){
    let flights:SourceHuntFlightEvent[];
    try{this.scene.advanceCats(this.host,dt,input);flights=this.host.advanceFrame(dt);this.frameCount++;}
    catch(error){this.simulationFailure=String(error);this.notice(`突袭模拟停止：${String(error)}；已消耗入场不回滚，请退出，未生成虚假结算`);return;}
    const r=this.bridge.commit(this.ports.read());
    if(!this.apply(r,r.events.some(e=>e.kind==='end')?'result':r.events.some(e=>e.kind==='bar-cleared')?'progress':undefined,flights,dt,this.host.phase==='ended'?{phase:'ended'}:undefined))return;
   }
  }
  if(input.presentation&&!this.presentationFailure){try{this.scene.render(input.simulate?dt:0);this.renderCount++;}catch(error){this.presentationFailure=String(error);this.notice(`突袭绘制失败：${String(error)}；不重复推进或发奖`);}}
 }
 /** Native Game_Exit is not Game_End: unfinished games do not grant a score
  * or refund consumed entries. Ended results were already committed once. */
 exit():boolean {
  if(!this.current()||!this.ready||this.pendingWrite||!['playing','ended'].includes(this.phase))return false;
  this.bridge.cancel();this.phaseTo('exit-field-wait',SOURCE_RAID_CLIENT_WAITS.exitFieldSeconds);return true;
 }
 refreshClock(time:MineTimeAdapter,date:Date):boolean {
  if(!this.current()){this.cancel();return false;}
  // Exit invalidates the bridge immediately, but the two source waits still
  // belong to this owner. Field calendar ownership resumes after restoration.
  if(this.pendingWrite||['exit-field-wait','exit-mask-wait'].includes(this.phase))return false;
  const before=this.ports.read(),r=this.bridge.refreshClock(before,time,date);
  // Do not write a save every sampling frame when the native daily/weekly state is unchanged.
  return this.apply(r,JSON.stringify({raid:before.meta.raid,pig:before.meta.raidStarPig,mission:before.meta.raidMission})===JSON.stringify({raid:r.bundle.meta.raid,pig:r.bundle.meta.raidStarPig,mission:r.bundle.meta.raidMission})?undefined:'clock');
 }
 cancel():void {
  if(this.closed)return;this.generation++;this.ready=false;this.bridge.cancel();
  this.pendingWrite=null;this.phaseTo('disposed');if(!this.disposedScene){this.disposedScene=true;try{this.scene.destroy();}catch(error){this.notice(`突袭场景清理失败：${String(error)}`);}}
 }
}
