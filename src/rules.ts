import {sourceStarDamage} from './r6-star';
import { candidateConfig, validateConfig, type RuleConfig } from './config.js';
import { BigValue, type BigValueInput } from './big-value';
import { upgradePriceValue, upgradeStatValue, upgradeSpeedValue } from './upgrade-tables';
import {sourceProjectileState,sourceProjectileHit,sourceExplosionColliders,SourceGunType,sourceGunGenerationPolicy,sourceShotgunYawRadians,sourceMissileFlight,sourceMissileArc,type SourceProjectileState,sourceCatSpreadState,sourceCatSpreadBeforeAttack,sourceCatAttackTick,sourceCatAttackResult,sourceApplySpread,sourceMissileScatterTarget,SOURCE_CAT_SPREAD_SERIALIZED_CONFIG} from './gun-projectiles';
import {sourceSphereBoxSegmentEntry,type SourceBoxHitbox} from './source-hitbox';
import {sourceBulletRadius} from './source-bullet-colliders';
import { advanceActors, makeActor, type CatActor } from './cat-actors';

export type Phase = 'playing' | 'won' | 'lost';
export type UpgradeKind = 'power' | 'money' | 'speed';
export type Point = {x:number;y:number};
export type Target = { id:number; position:Point; health:number; maxHealth:number; coin:number; radius:number; boss?:boolean;
  healthValue?:BigValue; maxHealthValue?:BigValue; coinValue?:BigValue; boxHitbox?:SourceBoxHitbox; strictNegativeDeath?:boolean; tier?:number; grid?:number };
export type Projectile = {critical?:boolean;id:number;position:Point;velocity:Point;damage:number;damageValue?:BigValue;remainingRange:number;
  distanceTraveled:number;gunSlot:number;height?:number;spawnPosition?:Point;spawnTime?:number;targetId?:number;source?:SourceProjectileState;explosionRadius?:number;weaponType?:SourceGunType;weaponId?:string;lifetimeSeconds?:number;flight?:{start:{x:number;y:number;z:number};end:{x:number;y:number;z:number};durationSeconds:number;arcHeight:number;destroyAfterSeconds:number}};
export type ExtraGun = {combatOverride?:{normalDamage:BigValue;criticalDamage:BigValue;criticalChance:number;intervalSeconds:number};damage:number;damageValue?:BigValue;intervalSeconds:number;pelletCount?:number;spreadDegrees?:number;slot?:number;id?:string;sourceType?:number;explosionRadius?:number;missileExplosionRadius?:number;blastSniperExplosionRadius?:number;missileSpeed?:number;penetratingBulletLifetime?:number};
/** Shared live Cat damage consumer for actual projectiles and SpeedRun sweep power. */
export function sourceGunDamageStats(gun:ExtraGun,powerLevel:number,mods?:CombatModifiers,slot=0) {
 const normalDamage=gun.combatOverride?.normalDamage??sourceStarDamage((gun.damageValue??BigValue.from(gun.damage)).nativeMultiply(upgradeStatValue('power',powerLevel)).nativeDivide(100)
  .nativeMultiply(mods?.permanentDamagePercent??100).nativeDivide(100).nativeMultiply(mods?.skinDamagePercent??100).nativeDivide(100)
  .nativeMultiply(mods?.fishDamagePercent??100).nativeDivide(100).nativeMultiply(mods?.relicDamagePercent??100).nativeDivide(100).truncateInteger().nativeMultiply(mods?.damageBuffMultiplier??1),mods?.slotStarLevels?.[slot]??0);
 const criticalDamage=gun.combatOverride?.criticalDamage??normalDamage.nativeMultiply(mods?.criticalDamagePercent??125).nativeDivide(100).nativeMultiply(mods?.relicCriticalPercent??100).nativeDivide(100).truncateInteger();
 return {normalDamage,criticalDamage,criticalProbability:gun.combatOverride?.criticalChance??mods?.criticalChance??0};
}
/** CalculateAtkCoolMax: challenge uses (false,false,false), retaining upgrades but no stage penalty. */
export function sourceGunCooldown(gun:ExtraGun,speedLevel:number,mods?:CombatModifiers,stagePenalty=0):number {
 const rawPercent=upgradeSpeedValue(speedLevel)+(mods?.permanentSpeedPercent??100)+(mods?.skinSpeedPercent??100)-200-stagePenalty;
 const percent=Math.max(100,Math.min(10000,rawPercent));
 return gun.combatOverride?.intervalSeconds??Math.fround(Math.max(Math.fround(.05),Math.min(2,Math.fround(Math.fround(Math.fround(gun.intervalSeconds)/percent)*100)/(mods?.attackSpeedBuff??1))));
}
export interface ShotEvent { actorId:number;gunSlot:number;weaponId:string;targetId:number;muzzle:Point;direction:Point;
  time:number;height:number;projectileIds:number[];critical?:boolean }
export interface ProjectileImpactEvent {projectileId:number;weaponType:SourceGunType;weaponId:string;position:Point;height:number;radius:number;time:number}
export interface ProjectileLifecycleSnapshot {
  projectileId:number;weaponId:string;actorId:number;gunSlot:number;spawnTime:number;time:number;
  position:Point;height:number;velocity:Point;
}
export type ProjectileViewLifecycleEvent =
  | (ProjectileLifecycleSnapshot & {type:'projectileBorn'})
  | (ProjectileLifecycleSnapshot & {type:'projectilePath';fromPosition:Point;fromHeight:number;fromTime:number})
  | (ProjectileLifecycleSnapshot & {type:'projectileStopped';reason:'hit'|'range'|'lifetime'|'other'});
export type MuzzleResolver = (actor:CatActor,weapon:ExtraGun,state:State) => {position:Point;height:number};
export interface CombatModifiers {slotStarLevels?:number[];permanentDamagePercent:BigValue;permanentMoneyPercent:BigValue;
  skinDamagePercent?:number;skinMoneyPercent?:number;sourceMoneyRebirthPercent?:BigValue;sourceMoneyBuffPercent?:number;petMoneyPercent?:BigValue;petMoveSpeedPercent?:number;relicMoveSpeedValue?:number;
  permanentSpeedPercent:number;skinSpeedPercent:number;attackSpeedBuff:number;criticalChance?:number;criticalDamagePercent?:number;fishDamagePercent?:number;damageBuffMultiplier?:number;relicCriticalPercent?:BigValueInput;relicDamagePercent?:BigValueInput;relicMoneyPercent?:BigValueInput}
export type State = {combatModifiers?:CombatModifiers;phase:Phase;stage:number;level:number;elapsed:number;player:Point;coins:number;earned:number;
  coinsValue?:BigValue;earnedValue?:BigValue;upgradeLevels:Record<UpgradeKind,number>;targets:Target[];targetBatchSize:number;
  sourceStagePenalty?:boolean;autoMove:boolean;autoStopWorldDistance:number;worldUnitsPerPoint:Point;projectiles:Projectile[];shootCooldown:number;
  extraGunCooldowns:number[];nextId:number;actors?:CatActor[];shotEvents?:ShotEvent[];primaryGun?:ExtraGun;projectileRngState?:number;impactEvents?:ProjectileImpactEvent[];projectileLifecycleEvents?:ProjectileViewLifecycleEvent[]};
export type TickInput = {moveX?:number;moveY?:number};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Finite legacy/UI mirrors only. All authority below stays decimal. */
export function numericMirror(value:BigValue):number {
  const n=value.toNumber();
  if(!Number.isFinite(n)) return value.sign*Number.MAX_VALUE;
  return n===0 && !value.isZero ? value.sign*Number.MIN_VALUE : n;
}
export function mirroredValue(value:BigValue|undefined, mirror:number):BigValue {
  return value && numericMirror(value)===mirror ? value : BigValue.from(mirror);
}
export function walletValue(s:State):BigValue {return mirroredValue(s.coinsValue,s.coins);}
export function healthValue(t:Target):BigValue {return t.strictNegativeDeath&&t.healthValue?t.healthValue:mirroredValue(t.healthValue,t.health);}
export function upgradePrice(level:number,c:RuleConfig=candidateConfig):number {
  if(level>c.upgrades.maxLevel)throw new RangeError('upgrade level out of range');
  return numericMirror(upgradePriceValue(level));
}
export function upgradeValue(kind:UpgradeKind,level:number):number {return numericMirror(upgradeStatValue(kind,level));}
export function createLevel(stage=0,level=0,coins:BigValueInput=0,upgradeLevels:Record<UpgradeKind,number>={power:0,money:0,speed:0},c:RuleConfig=candidateConfig):State {
  validateConfig(c);
  const money=BigValue.from(coins);
  if(!Number.isInteger(stage)||!Number.isInteger(level)||stage<0||level<0||level>=c.stage.levelsPerStage||money.lt(0))throw new Error('invalid level state');
  const columns=Math.min(5,c.level.targetCount),rows=Math.ceil(c.level.targetCount/columns);
  const targets=Array.from({length:c.level.targetCount},(_,i)=>({id:i+1,
    position:{x:c.arena.width*(0.13+0.74*((i%columns+0.5)/columns)),y:c.arena.height*(0.2+0.5*(Math.floor(i/columns)+0.5)/rows)},
    health:c.level.targetHealth,maxHealth:c.level.targetHealth,coin:c.level.targetCoin,radius:c.level.targetRadius,
    healthValue:BigValue.from(c.level.targetHealth),maxHealthValue:BigValue.from(c.level.targetHealth),coinValue:BigValue.from(c.level.targetCoin)}));
  const player={x:c.arena.width/2,y:c.arena.height/2};
  return {phase:'playing',stage,level,elapsed:0,player,coins:numericMirror(money),coinsValue:money,earned:0,earnedValue:BigValue.ZERO,
    upgradeLevels:{...upgradeLevels},targets,targetBatchSize:5,autoMove:false,autoStopWorldDistance:0,worldUnitsPerPoint:{x:1,y:1},
    projectiles:[],shootCooldown:0,extraGunCooldowns:[],nextId:targets.length+1,actors:[makeActor(0,player)],shotEvents:[],projectileLifecycleEvents:[]};
}
export function buyUpgrade(state:State,kind:UpgradeKind,c:RuleConfig=candidateConfig):State {
  const level=state.upgradeLevels[kind];if(level>=c.upgrades.maxLevel)return state;
  const price=upgradePriceValue(level),wallet=walletValue(state);if(wallet.lt(price))return state;
  const coinsValue=wallet.nativeSubtract(price);
  return {...state,coins:numericMirror(coinsValue),coinsValue,upgradeLevels:{...state.upgradeLevels,[kind]:level+1}};
}
function crossesCircle(from:Point,to:Point,center:Point,radius:number):boolean {
  const vx=to.x-from.x,vy=to.y-from.y,l=vx*vx+vy*vy;
  const t=l?clamp(((center.x-from.x)*vx+(center.y-from.y)*vy)/l,0,1):0;
  return Math.hypot(from.x+t*vx-center.x,from.y+t*vy-center.y)<=radius;
}
export function tick(state:State,dt:number,input:TickInput={},c:RuleConfig=candidateConfig,extraGuns:ExtraGun[]=[],resolveMuzzle?:MuzzleResolver):State {
  if(state.phase!=='playing')return {...state,shotEvents:[],impactEvents:[],projectileLifecycleEvents:[]};
  if(!Number.isFinite(dt)||dt<0||dt>0.25)throw new RangeError('tick requires 0..0.25 seconds');
  const s:State={...state,player:{...state.player},targets:state.targets.map(t=>({...t,healthValue:healthValue(t)})),
    coinsValue:walletValue(state),earnedValue:mirroredValue(state.earnedValue,state.earned),
    projectiles:state.projectiles.map(p=>({...p,position:{...p.position}})),extraGunCooldowns:[...state.extraGunCooldowns],shotEvents:[],impactEvents:[],projectileLifecycleEvents:[]};
  const snapshot=(bullet:Projectile,position=bullet.position,time=s.elapsed):ProjectileLifecycleSnapshot=>({
    projectileId:bullet.id,weaponId:bullet.weaponId??'starter-single-d',actorId:bullet.gunSlot,gunSlot:bullet.gunSlot,
    spawnTime:bullet.spawnTime??state.elapsed,time,position:{...position},height:bullet.height??2,velocity:{...bullet.velocity},
  });
  const guns:ExtraGun[]=[s.primaryGun??{damage:c.player.baseDamage,intervalSeconds:1/c.player.shotsPerSecond,id:'starter-single-d',slot:0},
    ...extraGuns.map((g,i)=>({...g,slot:g.slot??i+1}))];
  s.actors=advanceActors(s,dt,input,c,guns.map(g=>g.slot??0));
  s.player={...s.actors[0].position};s.elapsed+=dt;
  // H5 deterministic RNG adapter; original Unity seed/sequence remains unverified.
  const random01=()=>{s.projectileRngState=(Math.imul(s.projectileRngState??0xc47,1664525)+1013904223)>>>0;return s.projectileRngState/0x100000000;};
  for(let i=0;i<guns.length;i++) {
    const gun=guns[i],slot=gun.slot??i,actor=s.actors.find(a=>a.id===slot)!;
    const native=gun.sourceType!==undefined,type=(gun.sourceType??0) as SourceGunType;
    const previous=i===0?s.shootCooldown:s.extraGunCooldowns[slot-1]??0;
    let cooldown=previous-dt;
    const target=s.targets.find(t=>t.id===actor.aimTargetId&&t.health>0);
    const mods=s.combatModifiers;
    const interval=sourceGunCooldown(gun,s.upgradeLevels.speed,mods,s.autoMove&&s.sourceStagePenalty!==false?30*s.stage:0);
    let sourceAttempt=false;
    if(native) {
      const prepared=sourceCatSpreadBeforeAttack(actor.attackState??sourceCatSpreadState(),Boolean(target),dt,interval,SOURCE_CAT_SPREAD_SERIALIZED_CONFIG);
      const update=sourceCatAttackTick(prepared,Boolean(target),dt,interval);
      actor.attackState=update.state;sourceAttempt=update.attemptAttack;
    }
    if(target) {
      let shots=0;
      // Source Cat attempts at most once per update. Candidate guns retain the legacy adapter.
      while((native?sourceAttempt&&shots===0:cooldown<=1e-10)&&shots++<64) {
        const spawn=resolveMuzzle?.(actor,gun,s)??{position:{...actor.position},height:2};
        const aimX=target.position.x-spawn.position.x,aimY=target.position.y-spawn.position.y,d=Math.hypot(aimX,aimY)||1;
        const direction={x:aimX/d,y:aimY/d},projectileIds:number[]=[];
        // Native Cat.Attack rolls once before spread; all pellets inherit that result.
        const roll=native?random01():0;
        const critical=native&&(gun.combatOverride?Math.fround(roll):roll)<(gun.combatOverride?.criticalChance??mods?.criticalChance??0);
        const stats=sourceGunDamageStats(gun,s.upgradeLevels.power,mods,slot);
        const damageValue=critical?stats.criticalDamage:stats.normalDamage;
        const units=s.worldUnitsPerPoint,wx=aimX*units.x,wz=aimY*units.y,wd=Math.hypot(wx,wz)||1;
        const policy=sourceGunGenerationPolicy({type,pelletCount:gun.pelletCount??1,spreadDegrees:gun.spreadDegrees??0,
          explosionRadius:gun.explosionRadius??0,missileExplosionRadius:gun.missileExplosionRadius??0,
          blastSniperExplosionRadius:gun.blastSniperExplosionRadius??0,penetratingBulletLifetime:gun.penetratingBulletLifetime??2});
        const angles=native&&type===SourceGunType.Shotgun
          ?sourceShotgunYawRadians(policy.pelletCount,gun.spreadDegrees??0,random01)
          :Array.from({length:native?1:gun.pelletCount??1},(_,pellet)=>native?0:(pellet-((gun.pelletCount??1)-1)/2)*(gun.spreadDegrees??0)*Math.PI/180);
        for(const angle of angles) {
          const cos=Math.cos(angle),sin=Math.sin(angle),id=s.nextId++;
          const base={x:(wx*cos+wz*sin)/wd,y:0,z:(-wx*sin+wz*cos)/wd};
          const spread=native&&type!==SourceGunType.Shotgun&&type!==SourceGunType.Missile
            ?sourceApplySpread(base,actor.attackState!.spreadAngleDegrees,random01):base;
          const velocity=native?{x:spread.x*70/units.x,y:spread.z*70/units.y}:
            {x:(direction.x*cos-direction.y*sin)*c.player.projectileSpeed,y:(direction.x*sin+direction.y*cos)*c.player.projectileSpeed};
          let flight:Projectile['flight'];
          if(native&&type===SourceGunType.Missile) {
            const start={x:spawn.position.x*units.x,y:spawn.height,z:spawn.position.y*units.y};
            const end=sourceMissileScatterTarget(start,{x:target.position.x*units.x,y:0,z:target.position.y*units.y},actor.attackState!.spreadAngleDegrees,random01);
            flight={start,end,...sourceMissileFlight(start,end,gun.missileSpeed??35)};
          }
          projectileIds.push(id);
          const bullet:Projectile={id,critical,position:{...spawn.position},spawnPosition:{...spawn.position},spawnTime:native?s.elapsed:s.elapsed+Math.min(0,cooldown),targetId:target.id,
            velocity,weaponId:gun.id,source:sourceProjectileState(type),explosionRadius:policy.explosionRadius,weaponType:type,
            lifetimeSeconds:native?flight?.destroyAfterSeconds??policy.linearLifetimeSeconds:undefined,flight,
            damage:numericMirror(damageValue),damageValue,remainingRange:native?50:c.player.attackRange,distanceTraveled:0,gunSlot:slot,height:spawn.height};
          s.projectiles.push(bullet);
          s.projectileLifecycleEvents!.push({...snapshot(bullet,bullet.position,bullet.spawnTime),type:'projectileBorn'});
        }
        s.shotEvents!.push({actorId:actor.id,gunSlot:slot,weaponId:gun.id??'unknown',targetId:target.id,muzzle:{...spawn.position},direction,
          time:native?s.elapsed:s.elapsed+Math.min(0,cooldown),height:spawn.height,projectileIds,critical});
        if(native)actor.attackState=sourceCatAttackResult(actor.attackState!,type,true,dt,interval,SOURCE_CAT_SPREAD_SERIALIZED_CONFIG);
        cooldown+=interval;
      }
    } else cooldown=Math.max(0,cooldown);
    if(native)cooldown=Math.max(0,interval-actor.attackState!.attackTimerSeconds);
    if(i===0)s.shootCooldown=cooldown;else s.extraGunCooldowns[slot-1]=cooldown;
  }
  const surviving:Projectile[]=[];
  const firstAlive=s.targets.find(t=>t.health>0),batch=s.targetBatchSize,active=batch&&firstAlive?Math.floor((firstAlive.id-1)/batch):0;
  for(const bullet of s.projectiles) {
    const from={...bullet.position},fromHeight=bullet.height??2,age=Math.max(0,s.elapsed-(bullet.spawnTime??state.elapsed));
    const previousAge=Math.max(0,age-dt);
    const deltaSeconds=Math.min(dt,age,Math.max(0,(bullet.lifetimeSeconds??Infinity)-previousAge)),flight=bullet.flight;
    let arrived=false;
    if(flight) {
      const p=sourceMissileArc(flight.start,flight.end,flight.arcHeight,age,flight.durationSeconds);
      bullet.position={x:p.x/s.worldUnitsPerPoint.x,y:p.z/s.worldUnitsPerPoint.y};bullet.height=p.y;
      arrived=age>=flight.durationSeconds;
    } else {
      const speed=Math.hypot(bullet.velocity.x,bullet.velocity.y),nativeSpeed=bullet.lifetimeSeconds!==undefined;
      const travel=Math.min((nativeSpeed?70:speed)*deltaSeconds,bullet.remainingRange);
      const seconds=travel/(nativeSpeed?70:speed||1);
      bullet.position.x+=bullet.velocity.x*seconds;bullet.position.y+=bullet.velocity.y*seconds;
      bullet.distanceTraveled+=travel;bullet.remainingRange-=travel;
    }
    // Missile height collisions await a Unity collider adapter; endpoint detonation is restored.
    const originalGun=/^source-gun-(\d+)$/.exec(bullet.weaponId??'');
    const sphereRadius=originalGun?sourceBulletRadius(Number(originalGun[1])):0;
    const boxEntry=(t:Target)=>t.boxHitbox?sourceSphereBoxSegmentEntry({x:(from.x-t.position.x)*s.worldUnitsPerPoint.x,y:fromHeight,z:(from.y-t.position.y)*s.worldUnitsPerPoint.y},{x:(bullet.position.x-t.position.x)*s.worldUnitsPerPoint.x,y:bullet.height??fromHeight,z:(bullet.position.y-t.position.y)*s.worldUnitsPerPoint.y},t.boxHitbox,sphereRadius):null;
    const hits=flight?[]:s.targets.filter(t=>t.health>0&&(!batch||Math.floor((t.id-1)/batch)===active)&&(t.boxHitbox?boxEntry(t)!==null:crossesCircle(from,bullet.position,t.position,t.radius)))
      .sort((a,b)=>Math.hypot(a.position.x-from.x,a.position.y-from.y)-Math.hypot(b.position.x-from.x,b.position.y-from.y));
    const damage=mirroredValue(bullet.damageValue,bullet.damage);
    const applyDamage=(hit:Target)=>{
      if(hit.health<=0)return;
      const next=healthValue(hit).nativeSubtract(damage);
      hit.healthValue=hit.strictNegativeDeath?next:(next.lt(0)?BigValue.fromInteger(0):next);
      const dead=hit.strictNegativeDeath?next.lt(0):hit.healthValue.isZero;
      hit.health=dead?0:hit.strictNegativeDeath&&next.isZero?Number.MIN_VALUE:numericMirror(hit.healthValue);
      if(dead) {
        const amount=mirroredValue(hit.coinValue,hit.coin).nativeMultiply(upgradeStatValue('money',s.upgradeLevels.money)).nativeDivide(100)
          .nativeMultiply(s.combatModifiers?.sourceMoneyRebirthPercent??s.combatModifiers?.permanentMoneyPercent??100).nativeDivide(100)
          .nativeMultiply(s.combatModifiers?.skinMoneyPercent??100).nativeDivide(100)
          .nativeMultiply(s.combatModifiers?.sourceMoneyBuffPercent??100).nativeDivide(100)
          .nativeMultiply(s.combatModifiers?.relicMoneyPercent??100).nativeDivide(100)
          .nativeMultiply(s.combatModifiers?.petMoneyPercent??100).nativeDivide(100);
        s.coinsValue=s.coinsValue!.nativeAdd(amount);s.earnedValue=s.earnedValue!.nativeAdd(amount);
      }
    };
    let endpoint={...bullet.position};
    let source=bullet.source??sourceProjectileState(bullet.weaponType??SourceGunType.Single);
    const impactAt=(position:Point)=>s.impactEvents!.push({projectileId:bullet.id,weaponType:bullet.weaponType??SourceGunType.Single,weaponId:bullet.weaponId??"starter-single-d",
      position:{...position},height:bullet.height??2,radius:bullet.explosionRadius??0,time:s.elapsed});
    const explodeAt=(center:Point)=>{
      const radius=bullet.explosionRadius??0,units=s.worldUnitsPerPoint;
      const overlaps=s.targets.filter(t=>(!batch||Math.floor((t.id-1)/batch)===active)&&
        Math.hypot((t.position.x-center.x)*units.x,(t.position.y-center.y)*units.y)<=radius)
        .map(t=>({colliderId:t.id,active:t.health>0}));
      const explosion=sourceExplosionColliders(source,overlaps,radius);source=explosion.state;
      for(const colliderId of explosion.damageColliderIds)applyDamage(s.targets.find(t=>t.id===colliderId)!);
    };
    // H5 collision adapter: one collider per target, target ID is the local collider ID.
    // Swept circles and stable target-list sphere queries do not replay Unity Physics.
    for(const hit of hits) {
      if(source.dead)break;
      const action=sourceProjectileHit(source,{colliderId:hit.id,enemyTagged:true,enemyAlive:hit.health>0,
        healthBeforeHit:healthValue(hit)},damage,0);
      source=action.state;
      if(action.directDamage)applyDamage(hit);
      if(action.explode)explodeAt(hit.position);
      if(action.spawnFx||source.dead) {
        const dx=bullet.position.x-from.x,dy=bullet.position.y-from.y,dd=dx*dx+dy*dy,
          ox=from.x-hit.position.x,oy=from.y-hit.position.y,b=ox*dx+oy*dy,
          discriminant=b*b-dd*(ox*ox+oy*oy-hit.radius*hit.radius);
        const t=hit.boxHitbox?(boxEntry(hit)??0):dd&&discriminant>=0?clamp((-b-Math.sqrt(discriminant))/dd,0,1):0;
        const contact={x:from.x+dx*t,y:from.y+dy*t};
        if(action.spawnFx)impactAt(contact);
        if(source.dead)endpoint=contact;
      }
    }
    if(arrived&&!source.dead){explodeAt(bullet.position);if(!source.fxSpawned)impactAt(bullet.position);source={...source,dead:true,fxSpawned:true};}
    bullet.source=source;
    s.projectileLifecycleEvents!.push({...snapshot(bullet,endpoint),type:'projectilePath',fromPosition:from,fromHeight,
      fromTime:Math.max(state.elapsed,bullet.spawnTime??state.elapsed)});
    if(!source.dead&&bullet.remainingRange>0&&(bullet.lifetimeSeconds===undefined||age<bullet.lifetimeSeconds))surviving.push(bullet);
    else s.projectileLifecycleEvents!.push({...snapshot(bullet,endpoint),type:'projectileStopped',
      reason:source.dead?'hit':bullet.remainingRange<=0?'range':bullet.lifetimeSeconds!==undefined&&age>=bullet.lifetimeSeconds?'lifetime':'other'});
  }
  s.coins=numericMirror(s.coinsValue!);s.earned=numericMirror(s.earnedValue!);s.projectiles=surviving;
  if(s.targets.every(t=>t.health===0))s.phase='won';else if(s.elapsed+1e-9>=c.level.seconds)s.phase='lost';
  return s;
}
export function continueAfterWin(state:State,c:RuleConfig=candidateConfig):State {
  if(state.phase!=='won')throw new Error('level is not won');const next=state.level+1;
  return createLevel(state.stage+Math.floor(next/c.stage.levelsPerStage),next%c.stage.levelsPerStage,walletValue(state),state.upgradeLevels,c);
}
export function restartAfterLoss(state:State,c:RuleConfig=candidateConfig):State {
  if(state.phase!=='lost')throw new Error('level is not lost');return createLevel(state.stage,state.level,walletValue(state),state.upgradeLevels,c);
}
