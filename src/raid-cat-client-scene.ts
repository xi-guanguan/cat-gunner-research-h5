/** Connect the selected Cat consumer to the existing single-save-context owner.
 * A source scene/presentation adapter is REQUIRED. No default camera, fake
 * sockets, helper omission disguised as complete, or replacement art is used.
 */
import {SourceRaidCatRuntime,type SourceRaidCatAdapter,type SourceRaidCatFollowSettings,type SourceRaidCatAttackEvent} from './raid-cat-runtime';
import type {SourceRaidBattleRuntime,SourceRaidBattleEvent} from './raid-battle-runtime';
import type {SourceRaidClientScene,SourceRaidClientFrame} from './raid-client-owner';
import type {SourceRawMovementStatSlots} from './cat-movement-source';
import type {SourceHuntFlightEvent} from './hunt-projectile-flight';
import type {SourceRaidSelection} from './r6-raid';
import type {SourceMetaBundle} from './source-meta-runtime';
export interface SourceRaidCatScenePorts {
 read():SourceMetaBundle;
 /** Prepare original world, camera, rig and sockets BEFORE admission. */
 prepare():Promise<void>;
 /** Attach the live leader before projection queries, including start-in-eco. */
 bindCats(cats:SourceRaidCatRuntime):void;
 movementStats():SourceRawMovementStatSlots;
 followSettings():ReadonlyMap<number,SourceRaidCatFollowSettings>;
 adapter():SourceRaidCatAdapter;
 consume(events:readonly SourceRaidBattleEvent[],flights:readonly SourceHuntFlightEvent[],attacks:readonly SourceRaidCatAttackEvent[],dt:number):void;
 render(dt:number,cats:SourceRaidCatRuntime):void;
 destroy():void;
 setPresentationEnabled(enabled:boolean):void;
}
export class SourceRaidCatClientScene implements SourceRaidClientScene {
 cats:SourceRaidCatRuntime|null=null;
 private disposed=false;
 private preparing:Promise<void>|null=null;
 constructor(private readonly host:SourceRaidBattleRuntime,private readonly selection:SourceRaidSelection,private readonly ports:SourceRaidCatScenePorts){}
 prepare():Promise<void> {
  if(this.preparing)return this.preparing;
  this.preparing=(async()=>{
   await this.ports.prepare();
   if(this.disposed)return;
   this.cats=new SourceRaidCatRuntime(this.host,this.ports.read(),this.selection,this.ports.movementStats(),this.ports.followSettings());
   this.ports.bindCats(this.cats);
  })();
  return this.preparing;
 }
 advanceCats(host:SourceRaidBattleRuntime,dt:number,input:SourceRaidClientFrame):void {
  if(this.disposed)return;
  if(host!==this.host)throw RangeError('Raid Cat scene received a foreign clock host');
  if(!this.cats)throw Error('Raid source Cat scene is not prepared');
  this.cats.advanceFrame(dt,input,this.ports.adapter());
 }
 consume(events:readonly SourceRaidBattleEvent[],flights:readonly SourceHuntFlightEvent[],dt:number):void {
  if(this.disposed)return;
  // Drain before presentation. Failed HUD/FX must not replay previous attacks.
  const attacks=this.cats?.drainEvents()??[];
  this.ports.consume(events,flights,attacks,dt);
 }
 render(dt:number):void {if(!this.disposed&&this.cats)this.ports.render(dt,this.cats);}
 setPresentationEnabled(enabled:boolean):void {if(!this.disposed)this.ports.setPresentationEnabled(enabled);}
 destroy():void {if(this.disposed)return;this.disposed=true;this.cats?.dispose();this.ports.destroy();}
}
