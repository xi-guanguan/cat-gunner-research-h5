/** Presentation-only consumer. Birth is driven by attack tokens, not the next
 * render's active pool scan: a shot may be born and hit in one host subframe.
 * Released generations keep their last endpoint and stop body emission while
 * their existing trail particles retire. No presentation callback mutates HP. */
import type {SourceHuntFlightToken,SourceHuntProjectileFlight} from './hunt-projectile-flight';
import type {SourceVector3} from './cat-movement-source';
export interface SourceHuntProjectilePresenter<View> {
 create(flight:SourceHuntProjectileFlight):View;
 advance(view:View,age:number,point:SourceVector3):void;
 stop(view:View,age:number,point:SourceVector3):void;
 completed(view:View):boolean;
 destroy(view:View):void;
}
interface Item<View> {view:View;token:SourceHuntFlightToken;age:number;point:SourceVector3}
const key=(token:SourceHuntFlightToken)=>`${token.slot}:${token.generation}`;
export class SourceHuntProjectilePresentation<View> {
 readonly active=new Map<string,Item<View>>();
 readonly retired=new Set<Item<View>>();
 births=0;stops=0;private disposed=false;private lastBornGeneration=new Map<number,number>();
 constructor(private readonly presenter:SourceHuntProjectilePresenter<View>){}
 /** Invoke once after each simulated host subframe, before another pool reuse. */
 consume(slots:readonly SourceHuntProjectileFlight[],births:readonly SourceHuntFlightToken[],dt:number):void {
  if(this.disposed)return;
  if(!Number.isFinite(dt)||dt<0)throw RangeError('Invalid Hunt presentation delta');
  for(const item of this.retired){item.age+=dt;this.presenter.advance(item.view,item.age,item.point);
   if(this.presenter.completed(item.view)){this.presenter.destroy(item.view);this.retired.delete(item);}}
  for(const token of births){const flight=slots[token.slot];
   if(!flight||flight.generation!==token.generation)throw Error(`Stale Hunt projectile birth ${key(token)}`);
   if((this.lastBornGeneration.get(token.slot)??0)>=token.generation)continue;
   this.lastBornGeneration.set(token.slot,token.generation);
   const item={view:this.presenter.create(flight),token:{...token},age:0,point:{...flight.start}};
   this.active.set(key(token),item);this.births++;
  }
  for(const [id,item]of this.active){const flight=slots[item.token.slot];
   if(flight&&flight.generation===item.token.generation){item.age=flight.elapsedSeconds;item.point={...flight.position};this.presenter.advance(item.view,item.age,item.point);}
   if(!flight||flight.generation!==item.token.generation||!flight.active){this.presenter.stop(item.view,item.age,item.point);this.active.delete(id);this.stops++;
    if(this.presenter.completed(item.view))this.presenter.destroy(item.view);else this.retired.add(item);}
  }
 }
 /** Reproject both live bullets and retired world-space tails on resize. */
 reproject():void {if(this.disposed)return;for(const item of [...this.active.values(),...this.retired])this.presenter.advance(item.view,item.age,item.point);}
 /** Drop rendering work without cancelling the combat pool. Used by eco mode;
  * old trails never accumulate or replay when presentation is restored. */
 clear():void {for(const item of [...this.active.values(),...this.retired])this.presenter.destroy(item.view);this.active.clear();this.retired.clear();this.lastBornGeneration.clear();}
 destroy():void {if(this.disposed)return;this.clear();this.disposed=true;}
}
