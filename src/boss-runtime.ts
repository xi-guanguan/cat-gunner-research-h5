/** Source Boss manager + real projectile battle bridge. See round5 boss source contracts.
 * RNG and physics stepping are explicit H5 adapters, not a replay of Unity's seed. */
import {BigValue} from './big-value';
import {candidateConfig,type RuleConfig} from './config';
import {createLevel,tick,healthValue,numericMirror,walletValue,type State,type ExtraGun,type TickInput,type MuzzleResolver} from './rules';
import {makeActor} from './cat-actors';
import {sourceBossDamageStats,sourceBossCooldown,sourceBossTeamPower,sourceBossEnemySpawn,sourceBossEnter,sourceBossWin,sourceBossTick,sourceBossExit,sourceBossSweep,sourceBossBonus,sourceBossPickWanderPoint,sourceBossMoveVelocity,freshSourceBossState,type SourceBossState,type SourceBossTeamModifiers,type SourceBossEntitlements,type SourceBossVector3} from './r5-boss';
import type {Gun,Session,GameEvent} from './session';
import {CHALLENGE_UNITS_PER_POINT,CHALLENGE_SPAWN} from './challenge-layout';
export interface BossMotionState {position:SourceBossVector3;destination:SourceBossVector3|null;waitSeconds:number;rng:number;moving:boolean;facing:'left'|'right';}
export const bossPoint=(v:SourceBossVector3)=>({x:4.5+(v.x+100)/12,y:8+v.z/6});
export const bossWorld=(p:{x:number;y:number}):SourceBossVector3=>({x:-100+(p.x-4.5)*12,y:0,z:(p.y-8)*6});
const boxYaw=-Math.PI/4,c=Math.cos(boxYaw),s=Math.sin(boxYaw),centerZ=-.1599999964237213*12;
/** level0:64999 Enemy_Coll box, transform39264 scale12 yaw-45°, direct Boss child. */
const bossBox={centerOffset:{x:-4.869999885559082+s*centerZ,y:-.03999999910593033+.5099999904632568*12,z:4.610000133514404+c*centerZ},halfExtents:{x:1.7300000190734863*6,y:6,z:1.149999976158142*6},yawRadians:boxYaw};
const config=(duration:number):RuleConfig=>({...candidateConfig,arena:{width:9,height:16},level:{...candidateConfig.level,seconds:duration,targetCount:1,targetHealth:1,targetCoin:1}});
function bossGuns(session:Session,modifiers:SourceBossTeamModifiers):ExtraGun[] {return session.equippedGuns.flatMap((gun,slot)=>{if(!gun)return [];const stats=sourceBossDamageStats({...modifiers,baseDamage:gun.damageValue??gun.damage,starLevel:session.bossSlotLevels?.[slot]??0});return [{...gun,slot,combatOverride:{normalDamage:stats.normalDamage,criticalDamage:stats.criticalDamage,criticalChance:stats.shotCriticalProbability,intervalSeconds:sourceBossCooldown({...modifiers,baseIntervalSeconds:gun.intervalSeconds})}}];});}
export function bossTeamPower(session:Session,modifiers:SourceBossTeamModifiers):BigValue {return sourceBossTeamPower(session.equippedGuns.map((gun,slot)=>({active:!!gun,baseDamage:gun?.damageValue??gun?.damage??0,baseIntervalSeconds:gun?.intervalSeconds??1,starLevel:session.bossSlotLevels?.[slot]??0})),modifiers);}
export function enterBossBattle(session:Session,e:SourceBossEntitlements):Session {
 if(session.mode!=='field'||session.fieldBattle)return session;
 const result=sourceBossEnter(session.boss??freshSourceBossState(),e);if(result.status!=='supported')return {...session,notice:result.reason};
 const enemy=sourceBossEnemySpawn(session.boss.stage),position={x:-115,y:0,z:15};
 const battle=createLevel(0,0,walletValue(session.battle),{power:0,money:0,speed:0},config(result.value.run!.remainingSec));
 battle.targets=[{id:1,position:bossPoint(position),health:numericMirror(enemy.healthNow),maxHealth:numericMirror(enemy.healthMax),healthValue:enemy.healthNow,maxHealthValue:enemy.healthMax,coin:0,coinValue:BigValue.ZERO,radius:1,strictNegativeDeath:true,boxHitbox:bossBox}];
 battle.player={...CHALLENGE_SPAWN};battle.actors=[makeActor(0,battle.player)];battle.autoMove=true;battle.autoStopWorldDistance=10;battle.targetBatchSize=0;battle.worldUnitsPerPoint={...CHALLENGE_UNITS_PER_POINT};
 return {...session,mode:'boss',overlay:'none',fieldBattle:session.battle,battle,boss:result.value,bossMotion:{position,destination:null,waitSeconds:0,rng:session.rngState,moving:false,facing:'left'},challengeSeconds:result.value.run!.remainingSec,events:[],notice:''};
}
function moveBoss(old:BossMotionState,dt:number,cat:SourceBossVector3):BossMotionState {
 const m={...old,position:{...old.position}};const random=()=>{m.rng=(Math.imul(m.rng,1664525)+1013904223)>>>0;return m.rng/0x100000000;};
 if(m.waitSeconds>0){m.waitSeconds=Math.max(0,Math.fround(m.waitSeconds-dt));m.moving=false;return m;}
 if(!m.destination)m.destination=sourceBossPickWanderPoint(m.position,cat,()=>{const radius=Math.sqrt(random()),angle=random()*Math.PI*2;return {x:radius*Math.cos(angle),y:radius*Math.sin(angle)};}).point;
 const v=sourceBossMoveVelocity(m.position,m.destination,true);m.moving=v.isMoving;if(v.facing)m.facing=v.facing;
 if(v.arrived){m.destination=null;m.waitSeconds=Math.fround(1+2*random());return m;}
 m.position.x=Math.fround(m.position.x+Math.fround(v.velocity.x*dt));m.position.z=Math.fround(m.position.z+Math.fround(v.velocity.z*dt));return m;
}
export function tickBossBattle(session:Session,dt:number,input:TickInput,resolveMuzzle:MuzzleResolver|undefined,e:SourceBossEntitlements,modifiers:SourceBossTeamModifiers):Session {
 if(session.mode!=='boss'||!session.boss.run||!session.bossMotion)return {...session,events:[]};
 const motion=moveBoss(session.bossMotion,dt,bossWorld(session.battle.player));const old=session.battle;
 const source={...old,targets:old.targets.map(t=>({...t,position:bossPoint(motion.position)}))};const guns=bossGuns(session,modifiers);
 const battle=tick({...source,primaryGun:guns[0]},dt,input,config(Number.MAX_SAFE_INTEGER),guns.slice(1),resolveMuzzle);
 const events:GameEvent[]=(battle.shotEvents??[]).map(event=>({...event,type:'shot',x:event.muzzle.x,y:event.muzzle.y}));events.push(...(battle.projectileLifecycleEvents??[]),...(battle.impactEvents??[]).map(event=>({...event,type:'projectileImpact' as const})));
 const before=old.targets[0],after=battle.targets[0];if(healthValue(after).lt(healthValue(before))){const damageValue=healthValue(before).nativeSubtract(healthValue(after));events.push({type:'hit',id:1,damage:numericMirror(damageValue),damageValue});}
 let result=after.health===0?sourceBossWin(session.boss,e):sourceBossTick(session.boss,dt);
 if(result.status!=='supported')return {...session,battle,bossMotion:motion,events};
 const settled=result.value.run?.phase!=='playing';if(after.health===0)events.push({type:'death',id:1,x:after.position.x,y:after.position.y},{type:'stageWon',stage:session.boss.stage});
 else if(settled)events.push({type:'stageFailed',stage:session.boss.stage});
 return {...session,battle,boss:result.value,bossMotion:motion,mode:settled?'boss-result':'boss',diamonds:session.diamonds+result.diamondGrant,challengeSeconds:result.value.run?.remainingSec??0,events};
}
export function leaveBossBattle(session:Session,bonusConfirmed=false):Session {
 if(!['boss','boss-result'].includes(session.mode)&&!session.boss.run)return session;
 const result=bonusConfirmed?sourceBossBonus(session.boss,true):sourceBossExit(session.boss);if(result.status!=='supported')return {...session,notice:result.reason};
 const battle=session.fieldBattle??session.battle;
 return {...session,mode:'field',overlay:'none',battle,fieldBattle:null,boss:result.value,bossMotion:null,diamonds:session.diamonds+result.diamondGrant,events:[],notice:''};
}
export function sweepBossBattle(session:Session,e:SourceBossEntitlements,power:BigValue,plus2:boolean):Session {
 if(session.mode!=='field'||!plus2)return {...session,notice:!plus2?'Plus2 权益未开通':'请先退出当前战斗'};
 const result=sourceBossSweep(session.boss,power,e);if(result.status!=='supported')return {...session,notice:result.reason};
 return {...session,mode:'boss-result',overlay:'none',fieldBattle:session.battle,boss:result.value,bossMotion:null,diamonds:session.diamonds+result.diamondGrant,events:[],notice:''};
}
