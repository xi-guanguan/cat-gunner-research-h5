/** One live client owner for the ordinary field -> Hunt -> field route.
 * Preparing never enters the source host or debits/grants the current save.
 * The client owns the field clock until the source restore-field event (1.5s
 * exit wait), then retains the mask for the source's final 0.2s. A context
 * replacement cancels both resource preparation and delayed provider work.
 */
import {SourceHuntSessionBridge} from './hunt-session-bridge';
import {bindSourceHuntMovementStats} from './hunt-movement-binding';
import {sourceRelicTotals} from './r6-relic';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {SourceHuntBattleAdapter,SourceHuntBattleEvent,SourceHuntBattleRuntime} from './hunt-battle-runtime';
import type {SourceRewardRequest,SourceRewardResponse} from './r6-reward-provider';
export interface SourceHuntClientScene {
 prepare():Promise<void>;adapter(random:()=>number):SourceHuntBattleAdapter;
 consume(events:readonly SourceHuntBattleEvent[],dt:number):void;
 render(dt:number):void;destroy():void;
 setPresentationEnabled?(enabled:boolean):void;
}
export interface SourceHuntClientPorts {
 read():SourceMetaBundle;
 /** The captured save context remains current; independent of wallet equality. */
 current():boolean;
 write(bundle:SourceMetaBundle,events:readonly SourceHuntBattleEvent[]):void;
 scene(host:SourceHuntBattleRuntime):SourceHuntClientScene;
 random():number;
 notice(text:string):void;
 events?(events:readonly SourceHuntBattleEvent[]):void;
}
export class SourceHuntClientOwner {
 readonly bridge:SourceHuntSessionBridge;
 readonly scene:SourceHuntClientScene;
 ready=false;preparing=true;pendingBonus=false;closed=false;restoredField=false;
 frameCount=0;renderCount=0;attackCount=0;hitCount=0;
 private started=false;private generation=0;
 constructor(readonly runID:string,private readonly ports:SourceHuntClientPorts){
  const b=ports.read();
  this.bridge=new SourceHuntSessionBridge(runID,b,bindSourceHuntMovementStats(b.meta.pet,sourceRelicTotals(b.meta.relic).moveSpeedValue));
  this.scene=ports.scene(this.bridge.host);
 }
 get host(){return this.bridge.host;}
 get ownsField(){return !this.closed&&!this.restoredField;}
 get phase(){return this.closed?'disposed':this.preparing?'preparing':this.host.phase;}
 private current(){return !this.closed&&this.ports.current();}
 private commit(dt=0):boolean {
  if(!this.current()){this.cancel();return false;}
  const r=this.bridge.commit(this.ports.read());
  if(r.status==='blocked'){this.ports.notice(r.reason);this.cancel();return false;}
  // Write only native settlements, not every render frame. read() always reads
  // the latest bundle, so unrelated clocks/activities are not rolled back.
  if(r.events.some(e=>e.kind==='settlement'))this.ports.write(r.bundle,r.events);
  if(r.events.some(e=>e.kind==='restore-field'))this.restoredField=true;
  for(const e of r.events){if(e.kind==='attack')this.attackCount++;else if(e.kind==='projectile'&&['direct-damage','blast-damage'].includes(e.event.event.kind))this.hitCount++;}
  this.scene.consume(r.events,dt);this.ports.events?.(r.events);
  return true;
 }
 async start():Promise<boolean>{
  if(this.started||this.closed)return false;this.started=true;const generation=this.generation;
  try{
   await this.scene.prepare();
   if(generation!==this.generation||!this.current()){this.cancel();return false;}
   // Recheck identity BEFORE enter; failed/late preparation has no run receipt.
   if(!this.commit())return false;
   const entered=this.host.enter();
   if(entered.status!=='supported'){this.ports.notice(entered.reason);this.cancel();return false;}
   this.ready=true;this.preparing=false;
   return this.commit();
  }catch(error){if(generation===this.generation&&this.current())this.ports.notice(`狩猎资源准备失败：${String(error)}；未启动战斗`);this.cancel();return false;}
 }
 advance(dt:number,input:{simulate:boolean;acceptInput:boolean;presentation:boolean;joystick:{x:number;y:number}}):void {
  if(!this.current()){this.cancel();return;}if(!this.ready)return;
  this.scene.setPresentationEnabled?.(input.presentation);
  if(input.simulate){
   this.host.advanceFrame(dt,{resourcesReady:true,simulate:true,acceptInput:input.acceptInput,joystick:input.joystick},this.scene.adapter(()=>this.ports.random()));
   this.frameCount++;if(!this.commit(dt))return;
  }
  if(input.presentation){this.scene.render(input.simulate?dt:0);this.renderCount++;}
  if(this.host.phase==='disposed')this.cancel();
 }
 giveUp():boolean {if(!this.current()||!this.ready)return false;const r=this.host.giveUp();return r.status==='supported'&&this.commit();}
 exit():boolean {if(!this.current()||!this.ready)return false;const r=this.host.exit();if(r.status!=='supported')return false;this.pendingBonus=false;return this.commit();}
 async bonus(execute:(request:SourceRewardRequest)=>Promise<SourceRewardResponse>):Promise<boolean>{
  if(!this.current()||this.pendingBonus)return false;
  const ticket=this.bridge.beginBonus();if(!ticket)return false;
  const generation=this.generation;this.pendingBonus=true;
  try{
   const response=await execute(ticket.request);
   if(generation!==this.generation||!this.current())return false;
   const r=this.bridge.finishBonus(ticket,response);this.ports.notice(r.reason);
   return this.commit()&&r.status==='applied';
  }catch{
   // Release the source ticket as a failed callback, permitting a fresh request.
   if(generation===this.generation&&this.current()){
    this.bridge.finishBonus(ticket,{...ticket.request,status:'failure',provider:'local-test',onlineVerified:false});
    this.ports.notice('本地测试广告失败；未发奖');
   }
   return false;
  }finally{if(generation===this.generation)this.pendingBonus=false;}
 }
 cancel():void {if(this.closed)return;this.closed=true;this.generation++;this.preparing=false;this.ready=false;this.pendingBonus=false;this.bridge.cancel();this.scene.destroy();}
}
