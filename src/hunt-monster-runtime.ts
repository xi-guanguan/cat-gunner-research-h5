/** Original Monster manager/Enemy contract, no DPS estimate and no wallet mutation.
 * Source: round5 hunt-combat + round6 hunt-monster-config.json (native hash in data).
 * Mutable pool avoids allocating 240 entities per frame. The host owns clocks/rendering.
 * Discrete integration/contact queries below are an explicit H5 geometry adapter,
 * NOT a claim of PhysX, Unity coroutine phase or complete live Hunt equivalence.
 */
import source from './data/hunt-monster-source.json';
import {BigValue,type BigValueInput} from './big-value';
import {sourceHuntWaveHealth,SOURCE_HUNT_MONSTER_COUNTS,SOURCE_HUNT_SPAWN_INTERVALS} from './r5-hunt';
import type {SourceVector3} from './cat-movement-source';
export const SOURCE_HUNT_MONSTER_CONFIG=source;
const f=Math.fround,zero=():SourceVector3=>({x:0,y:0,z:0});
const center:SourceVector3={x:source.mapCenter[0],y:source.mapCenter[1],z:source.mapCenter[2]};
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
function finite(n:number,label:string):number {if(!Number.isFinite(n)||!Number.isFinite(f(n)))throw new RangeError(`Invalid ${label}`);return f(n);}
function vector(p:SourceVector3):SourceVector3{return {x:finite(p.x,'x'),y:finite(p.y,'y'),z:finite(p.z,'z')};}
function subtract(a:SourceVector3,b:SourceVector3):SourceVector3{return {x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)};}
function length(p:SourceVector3):number{return f(Math.sqrt(f(f(f(p.x*p.x)+f(p.y*p.y))+f(p.z*p.z))));}
function normalize(p:SourceVector3):SourceVector3 {const d=length(p);return d>f(.00001)?{x:f(p.x/d),y:f(p.y/d),z:f(p.z/d)}:zero();}
function scale(p:SourceVector3,n:number):SourceVector3{return {x:f(p.x*n),y:f(p.y*n),z:f(p.z*n)};}
function interpolate(a:SourceVector3,b:SourceVector3,t:number):SourceVector3 {const k=clamp01(t);return {x:f(a.x+f(f(b.x-a.x)*k)),y:f(a.y+f(f(b.y-a.y)*k)),z:f(a.z+f(f(b.z-a.z)*k))};}
/** Random.Range is injected by the host; do not claim the H5 PRNG equals Unity's. */
export function sourceHuntMonsterSpawnPosition(aspect:number,angleRoll:number,jitterRoll:number,spawn:SourceVector3=center):SourceVector3 {
 const a=60,b=Math.max(30,Math.min(60,f(finite(aspect,'camera aspect')*60)));if(aspect<=0)throw new RangeError('Invalid camera aspect');
 for(const n of [angleRoll,jitterRoll])if(!Number.isFinite(n)||n<0||n>1)throw new RangeError('Invalid spawn random roll');
 const p=vector(spawn),theta=f(f(angleRoll)*f(2*Math.PI)),cos=f(Math.cos(theta)),sin=f(Math.sin(theta));
 const ac=f(a*cos),bs=f(b*sin),radius=f(f(f(a*b)/f(Math.sqrt(f(f(ac*ac)+f(bs*bs)))))+f(-5+f(10*f(jitterRoll))));
 const u=f(f(cos*radius)*f(.70710677)),v=f(f(sin*radius)*f(.70710677));
 return {x:f(f(p.x+u)-v),y:p.y,z:f(f(p.z+u)+v)};
}
/** Velocity is chosen ONCE at spawn. No invented homing recomputation per frame. */
export function sourceHuntMonsterVelocity(position:SourceVector3,big:boolean):SourceVector3 {
 const p=vector(position),d=length(subtract(p,center)),k=f(Math.max(f(d-20),f(.1))/(big?50:f(37.5))),dir=normalize(subtract(center,p));
 return {x:f(k*dir.x),y:0,z:f(k*dir.z)};
}
export interface SourceHuntMonsterToken {id:number;generation:number}
export interface SourceHuntMonster {
 id:number;colliderID:number;generation:number;active:boolean;frozen:boolean;big:boolean;
 position:SourceVector3;moveVelocity:SourceVector3;velocity:SourceVector3;health:BigValue;maxHealth:BigValue;
 knockback:{outwardVelocity:SourceVector3;elapsed:number;duration:number}|null;
}
export type SourceHuntMonsterEvent =
 {kind:'spawn';token:SourceHuntMonsterToken;big:boolean;position:SourceVector3;replacement:boolean} |
 {kind:'death';token:SourceHuntMonsterToken;fxType:5;progress:number} |
 {kind:'invasion';token:SourceHuntMonsterToken;hp:number;fatal:boolean} |
 {kind:'level-clear';wave:number;level:number} |
 {kind:'pool-empty';replacement:boolean};
export interface SourceHuntMonsterSpawnInput {aspect:number;random:()=>number;spawnPosition?:SourceVector3}
export type SourceHuntMonsterPhase='idle'|'running'|'cleared'|'failed'|'stopped';
interface PreparedSpawn {position:SourceVector3;velocity:SourceVector3;big:boolean;health:BigValue}
/** Native pool array order is serialized, NOT object ID order. Tokens guard H5
 * stale asynchronous contacts only; they are neither save IDs nor source fields. */
export class SourceHuntMonsterRuntime {
 readonly projectileUiMode=4 as const;
 readonly entities:readonly SourceHuntMonster[];
 readonly nonSpawned:number[];
 readonly spawned:number[]=[];
 private readonly byID:Map<number,SourceHuntMonster>;
 wave=0;level=0;hp=1;hpMax=1;killedCount=0;invasionPending=0;regularSpawnCounter=0;
 phase:SourceHuntMonsterPhase='idle';spawnWait=0;
 private readonly events:SourceHuntMonsterEvent[]=[];
 constructor(){
  this.entities=source.poolIDs.map((id,i)=>({id,colliderID:source.monsterColliderIDs[i],generation:0,active:false,frozen:false,big:false,position:zero(),moveVelocity:zero(),velocity:zero(),health:BigValue.ZERO,maxHealth:BigValue.ZERO,knockback:null}));
  this.nonSpawned=[...source.poolIDs];this.byID=new Map(this.entities.map(m=>[m.id,m]));
 }
 get total():number{return SOURCE_HUNT_MONSTER_COUNTS[this.level];}
 get progress():number{return clamp01(f(this.killedCount/this.total));}
 get hpDiscDegrees():number{return f(f(this.hp/this.hpMax)*360);}
 token(m:SourceHuntMonster):SourceHuntMonsterToken{return {id:m.id,generation:m.generation};}
 current(t:SourceHuntMonsterToken):SourceHuntMonster|undefined {const m=this.byID.get(t.id);return m?.generation===t.generation&&m.active?m:undefined;}
 /** This starts one source level, not loading/transition/reward. Caller must
  * close the prior level first. Only first enter initializes HP to source1. */
 startLevel(wave:number,level:number,input:SourceHuntMonsterSpawnInput):void {
  sourceHuntWaveHealth(wave);if(!Number.isInteger(level)||level<0||level>=5)throw new RangeError('Invalid Hunt level');
  if(this.phase==='running'||this.spawned.length)throw new Error('Hunt level/pool still in use');
  // H5 exception safety only: a faulty injected RNG must not half-start a run.
  const prepared=this.prepareSpawn(wave,level,input);
  this.wave=wave;this.level=level;this.killedCount=0;this.invasionPending=0;this.regularSpawnCounter=0;this.spawnWait=0;this.phase='running';
  this.applySpawnSchedule(prepared,false);
 }
 /** Coroutine wait: at most one resume per supplied rendered frame. Large delta
  * does NOT produce a batch of instant spawns or grant offline progression. */
 advanceSpawnFrame(deltaSeconds:number,input:SourceHuntMonsterSpawnInput):void {
  const dt=finite(deltaSeconds,'spawn frame delta');if(dt<0)throw new RangeError('Negative frame delta');
  if(this.phase!=='running'||dt===0)return;
  const nextWait=f(this.spawnWait-dt);
  if(nextWait<=0)this.resumeSpawn(input);else this.spawnWait=nextWait;
 }
 private resumeSpawn(input:SourceHuntMonsterSpawnInput):void {
  if(this.killedCount>=this.total){this.phase='cleared';this.events.push({kind:'level-clear',wave:this.wave,level:this.level});return;}
  const replacement=this.invasionPending>=1;
  if(!replacement&&this.regularSpawnCounter>=this.total){this.spawnWait=f(.1);return;}
  const prepared=this.prepareSpawn(this.wave,this.level,input);
  this.applySpawnSchedule(prepared,replacement);
 }
 private prepareSpawn(wave:number,level:number,input:SourceHuntMonsterSpawnInput):PreparedSpawn|null {
  // Source pool-empty return consumes no random values, but the scheduler still advances.
  if(!this.nonSpawned.length)return null;
  const position=sourceHuntMonsterSpawnPosition(input.aspect,input.random(),input.random(),input.spawnPosition??center),roll=finite(input.random(),'big random roll');
  if(roll<0||roll>1)throw new RangeError('Invalid big random roll');
  const big=roll<=f(level*f(.2)),base=sourceHuntWaveHealth(wave),health=big?base.nativeMultiply(3).significant(2):base;
  return {position,big,health,velocity:vector(sourceHuntMonsterVelocity(position,big))};
 }
 private applySpawnSchedule(prepared:PreparedSpawn|null,replacement:boolean):void {
  if(replacement)this.invasionPending--;else this.regularSpawnCounter++;
  if(!prepared)this.events.push({kind:'pool-empty',replacement});
  else {
   const {position,big,health,velocity}=prepared,m=this.byID.get(this.nonSpawned[0])!;
   m.generation++;m.position=position;m.big=big;m.health=health;m.maxHealth=health;m.active=true;m.frozen=false;m.knockback=null;m.moveVelocity=velocity;m.velocity=m.moveVelocity;
   this.nonSpawned.shift();this.spawned.push(m.id);this.events.push({kind:'spawn',token:this.token(m),big,position:{...position},replacement});
  }
  this.spawnWait=this.spawned.length<3?f(.04):SOURCE_HUNT_SPAWN_INTERVALS[this.level];
 }
 /** Actual damage event from a bullet/overlap consumer; never power/time damage. */
 damage(t:SourceHuntMonsterToken,damage:BigValueInput):boolean {
  const value=BigValue.from(damage);if(value.lt(0))throw new RangeError('Negative monster damage');
  const m=this.current(t);if(this.phase!=='running'||!m)return false;
  m.health=m.health.nativeSubtract(value);
  // Enemy.Damaged: native InfInt division -> float before Apply_Knockback.
  this.knockback(t,value.gte(m.maxHealth)?1:f(value.nativeDivide(m.maxHealth).toNumber()));
  if(m.health.lte(0))this.kill(t);
  return true;
 }
 knockback(t:SourceHuntMonsterToken,amount:number):boolean {
  const m=this.current(t),a=clamp01(finite(amount,'knockback amount'));if(this.phase!=='running'||!m)return false;
  m.frozen=false;m.knockback={outwardVelocity:scale(normalize(subtract(m.position,center)),f(20*a)),elapsed:0,duration:f(f(f(.299999982)*a)+f(.05))};
  return true;
 }
 /** Source coroutine advances before setting Rigidbody velocity. New hits replace
  * old knockback; freeze/death/barrier stop it without pool allocation. */
 advanceKnockbackFrame(deltaSeconds:number):void {
  const dt=finite(deltaSeconds,'knockback frame delta');if(dt<0)throw new RangeError('Negative frame delta');if(this.phase!=='running'||dt===0)return;
  for(const id of this.spawned){const m=this.byID.get(id)!;if(!m.active||m.frozen||!m.knockback)continue;
   const k=m.knockback;if(k.elapsed>=k.duration){m.velocity=m.moveVelocity;m.knockback=null;continue;}
   k.elapsed=f(k.elapsed+dt);m.velocity=interpolate(k.outwardVelocity,m.moveVelocity,f(k.elapsed/k.duration));
  }
 }
 /** Explicit H5 Euler step, separates simulation from presentation/audio. This
  * method does not claim Unity contact ordering or Rigidbody solver equivalence. */
 integrateH5(deltaSeconds:number,detectBarrier=true):void {
  const dt=finite(deltaSeconds,'physics delta');if(dt<0)throw new RangeError('Negative physics delta');if(this.phase!=='running'||dt===0)return;
  for(const id of [...this.spawned]){if(this.phase!=='running')break;const m=this.byID.get(id)!;if(!m.active||m.frozen)continue;
   m.position={x:f(m.position.x+f(m.velocity.x*dt)),y:f(m.position.y+f(m.velocity.y*dt)),z:f(m.position.z+f(m.velocity.z*dt))};
   if(detectBarrier&&sourceHuntBarrierContact(m.position))this.invade(this.token(m));
  }
 }
 kill(t:SourceHuntMonsterToken):boolean {
  const m=this.current(t);if(this.phase!=='running'||!m)return false;
  this.stopEntity(m);this.returnToPool(m);this.killedCount++;this.events.push({kind:'death',token:t,fxType:5,progress:this.progress});return true;
 }
 invade(t:SourceHuntMonsterToken):boolean {
  const m=this.current(t);if(this.phase!=='running'||!m)return false;
  this.stopEntity(m);this.hp--;const fatal=this.hp<=0;this.events.push({kind:'invasion',token:t,hp:this.hp,fatal});
  if(fatal){this.phase='failed';return true;} // Source fatal branch does NOT return to pool / add pending / count kill.
  this.returnToPool(m);this.invasionPending++;return true;
 }
 private stopEntity(m:SourceHuntMonster):void {m.knockback=null;m.velocity=zero();m.active=false;m.frozen=false;}
 private returnToPool(m:SourceHuntMonster):void {const i=this.spawned.indexOf(m.id);if(i>=0)this.spawned.splice(i,1);this.nonSpawned.push(m.id);}
 freeze(t:SourceHuntMonsterToken):boolean {const m=this.current(t);if(!m)return false;m.knockback=null;m.velocity=zero();m.frozen=true;return true;}
 /** H5 host disposal, not a claim that native Game_Exit reorders the pool this way.
  * New run builds a fresh pool from the serialized source order. */
 dispose():void {this.phase='stopped';for(const m of this.entities)this.stopEntity(m);this.spawned.length=0;this.nonSpawned.splice(0,this.nonSpawned.length,...source.poolIDs);this.spawnWait=0;this.events.length=0;}
 drainEvents():SourceHuntMonsterEvent[]{return this.events.splice(0);}
 /** Iterate without an array/search per ray; retain source Spawned ordering. */
 *activeMonsters():IterableIterator<SourceHuntMonster> {for(const id of this.spawned){const m=this.byID.get(id)!;if(m.active)yield m;}}
 /** Physics.OverlapSphere adapter: serialized Spawned order, exact capsule
  * geometry and caller-supplied source layer mask. NOT PhysX query ordering. */
 explosionContacts(position:SourceVector3,radius:number,layerMask:number):{token:SourceHuntMonsterToken;colliderID:number;health:BigValue}[] {
  vector(position);finite(radius,'explosion radius');if(radius<0)throw new RangeError('Negative explosion radius');
  if(!Number.isInteger(layerMask)||layerMask<-2147483648||layerMask>4294967295)throw new RangeError('Invalid layer mask');
  if(this.phase!=='running'||radius===0||!(layerMask&(1<<source.colliderFilter.monsterLayer)))return [];
  const out=[];for(const id of this.spawned){const m=this.byID.get(id)!;if(!m.active)continue;
   if(sourceHuntCapsuleSegmentEntry(position,position,m.position,radius)!==null)out.push({token:this.token(m),colliderID:m.colliderID,health:m.health});
  }return out;
 }
 /** Active non-trigger Enemy capsule contacts, deduped later by original collider
  * identity. Within equal contact time, serialized Spawned order is retained.
  * The query order is an H5 adaptation, not a source PhysX ordering assertion. */
 bulletContacts(from:SourceVector3,to:SourceVector3,bulletRadius:number):{token:SourceHuntMonsterToken;colliderID:number;t:number;health:BigValue}[] {
  if(this.phase!=='running')return [];
  const out=[];for(const id of this.spawned){const m=this.byID.get(id)!;if(!m.active)continue;const t=sourceHuntCapsuleSegmentEntry(from,to,m.position,bulletRadius);if(t!==null)out.push({token:this.token(m),colliderID:m.colliderID,t,health:m.health});}
  return out.sort((a,b)=>a.t-b.t);
 }
}
/** Genuine sphere vs vertical capsule geometry, not point-in-circle radius15.
 * Uniform source scale5, directionY, child identity transform, original height2.
 * Contact offset/solver/trigger dispatch require separate PhysX evidence. */
export function sourceHuntBarrierContact(position:SourceVector3):boolean {
 const p=vector(position),cap=source.capsule,cx=p.x,cz=p.z,lo=p.y+cap.centerOffset[1]-cap.halfSegment,hi=p.y+cap.centerOffset[1]+cap.halfSegment;
 const [bx,by,bz]=source.barrier.center,y=Math.max(lo,Math.min(hi,by)),dx=bx-cx,dz=bz-cz,r=source.barrier.radius+cap.radius;
 return dx*dx+(by-y)**2+dz*dz<=r*r;
}
/** Earliest sphere-swept segment vs capsule; exact analytic rounded endpoints.
 * Capsule coordinates remain 3D, preserving vertical near misses. */
export function sourceHuntCapsuleSegmentEntry(from:SourceVector3,to:SourceVector3,position:SourceVector3,bulletRadius:number):number|null {
 const a=vector(from),b=vector(to),p=vector(position),br=finite(bulletRadius,'bullet radius');if(br<0)throw new RangeError('Negative bullet radius');
 const cap=source.capsule,lo=p.y+cap.centerOffset[1]-cap.halfSegment,hi=p.y+cap.centerOffset[1]+cap.halfSegment,r=cap.radius+br;
 const x=a.x-p.x,z=a.z-p.z,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,cuts=[0,1];
 if(dy!==0)for(const y of [lo,hi]){const t=(y-a.y)/dy;if(t>0&&t<1)cuts.push(t);}cuts.sort((a,b)=>a-b);
 for(let i=0;i<cuts.length-1;i++){const start=cuts[i],end=cuts[i+1],mid=a.y+dy*(start+end)/2,out=mid<lo?lo:mid>hi?hi:undefined,vy=out===undefined?0:a.y-out,ddy=out===undefined?0:dy;
  const aa=dx*dx+dz*dz+ddy*ddy,bb=2*(x*dx+z*dz+vy*ddy),cc=x*x+z*z+vy*vy-r*r;
  if(aa*start*start+bb*start+cc<=0)return start;if(aa===0)continue;const disc=bb*bb-4*aa*cc;if(disc<0)continue;
  const entry=(-bb-Math.sqrt(disc))/(2*aa);if(entry>=start&&entry<=end)return entry;
 }
 return null;
}
