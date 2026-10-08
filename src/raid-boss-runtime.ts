/** Raid's independent Enemy(type5), NOT an ordinary Boss or Hunt Monster.
 * Source Enemy.Spawn/Damaged/Die_Reload and Raid_Boss.Spawn/Reload:
 * round6 raid-enemy-native.txt + raid-foundation-native.txt. No wallet effects.
 * Source has one fixed collider. Reload retains collider identity but renews
 * H5 generation guards, so stale callbacks cannot damage the next health bar.
 */
import {BigValue,type BigValueInput} from './big-value';
import source from './data/r6-raid-world.json';
import type {SourceProjectileTargetPort,SourceProjectileTargetToken,SourceProjectileTargetContact} from './source-projectile-target';
import type {SourceVector3} from './cat-movement-source';
export const SOURCE_RAID_WORLD=source;
const f=Math.fround;
function point(p:SourceVector3):SourceVector3 {if(!p||[p.x,p.y,p.z].some(n=>!Number.isFinite(n)||!Number.isFinite(f(n))))throw RangeError('Invalid Raid point');return {x:f(p.x),y:f(p.y),z:f(p.z)};}
function radius(n:number):number {if(!Number.isFinite(n)||!Number.isFinite(f(n))||n<0)throw RangeError('Invalid Raid query radius');return f(n);}
/** Exact quadratic segment/sphere sweep including start-inside and tangency.
 * H5 CCD adapter; source radius/center/layer/identity are not guessed. */
export function sourceRaidSphereSegmentEntry(from:SourceVector3,to:SourceVector3,extraRadius:number):number|null {
 const a=point(from),b=point(to),r=radius(extraRadius)+source.sphere.radius,c=source.sphere.center;
 const ox=a.x-c[0],oy=a.y-c[1],oz=a.z-c[2],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
 const q=ox*ox+oy*oy+oz*oz-r*r;if(q<=0)return 0;
 const len=dx*dx+dy*dy+dz*dz;if(len===0)return null;
 const dot=ox*dx+oy*dy+oz*dz,disc=dot*dot-len*q;if(disc<0)return null;
 const t=(-dot-Math.sqrt(disc))/len;return t>=0&&t<=1?t:null;
}
export interface SourceRaidEnemy {id:number;generation:number;health:BigValue;maxHealth:BigValue;isDie:boolean}
export class SourceRaidBossRuntime implements SourceProjectileTargetPort {
 readonly projectileUiMode=5 as const;
 phase:'idle'|'running'|'stopped'='idle';
 readonly enemy:SourceRaidEnemy={id:source.enemyID,generation:0,health:BigValue.from(0),maxHealth:BigValue.from(0),isDie:true};
 constructor(private readonly destroyed:(token:SourceProjectileTargetToken)=>void){}
 token():SourceProjectileTargetToken {return {id:this.enemy.id,generation:this.enemy.generation};}
 current(t:SourceProjectileTargetToken):SourceRaidEnemy|null {return this.phase==='running'&&!this.enemy.isDie&&t.id===this.enemy.id&&t.generation===this.enemy.generation?this.enemy:null;}
 spawn(health:BigValueInput):void {
  const value=BigValue.from(health);if(!value.gt(0))throw RangeError('Raid Enemy needs positive health');
  this.enemy.generation++;this.enemy.health=value;this.enemy.maxHealth=value;this.enemy.isDie=false;this.phase='running';
 }
 damage(t:SourceProjectileTargetToken,damage:BigValueInput):boolean {
  const value=BigValue.from(damage);if(value.lt(0))throw RangeError('Negative Raid damage');const enemy=this.current(t);if(!enemy)return false;
  enemy.health=enemy.health.nativeSubtract(value);
  if(enemy.health.lte(0)){enemy.isDie=true;this.destroyed(t);} // callback may immediately call Reload/Spawn
  return true;
 }
 bulletContacts(from:SourceVector3,to:SourceVector3,extraRadius:number):(SourceProjectileTargetContact&{t:number})[] {
  const t=sourceRaidSphereSegmentEntry(from,to,extraRadius);return t!==null&&this.current(this.token())?[{token:this.token(),colliderID:source.colliderID,health:this.enemy.health,t}]:[];
 }
 explosionContacts(position:SourceVector3,extraRadius:number,layerMask:number):SourceProjectileTargetContact[] {
  point(position);radius(extraRadius);if(!Number.isInteger(layerMask)||layerMask<-2147483648||layerMask>4294967295)throw RangeError('Invalid Raid layer mask');
  if(extraRadius===0||!(layerMask&(1<<source.layer))||!this.current(this.token()))return [];
  return sourceRaidSphereSegmentEntry(position,position,extraRadius)!==null?[{token:this.token(),colliderID:source.colliderID,health:this.enemy.health}]:[];
 }
 dispose():void {this.phase='stopped';this.enemy.isDie=true;}
}
