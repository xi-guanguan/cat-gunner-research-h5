/** Independent source Raid clock + Enemy bars + per-projectile contacts.
 * MODEL/HOST FOUNDATION ONLY: no scene loader or autonomous Cat host is implied.
 * Caller must supply actual source emission settings, muzzle and target points.
 * Frame order (timer resume -> H5 swept projectile step) is an explicit adapter,
 * not Unity Update/FixedUpdate/coroutine equivalence. No estimated DPS exists.
 */
import {raidBossHealth,raidStartTimer,raidTimerFrame,raidTimeBonus,raidStarGemReward} from './r5-raid';
import {SourceRaidBossRuntime} from './raid-boss-runtime';
import {SourceEnemyProjectileFlightRuntime,sourceEnemyEmitGun,type SourceHuntGunEmission,type SourceHuntFlightEvent,type SourceHuntFlightToken} from './hunt-projectile-flight';
import {SOURCE_HUNT_CAT_CONFIG} from './hunt-cat-runtime';
import type {SourceRaidState} from './r6-raid';
export interface SourceRaidBattleResult {readonly runID:string;readonly score:number;readonly weakType:number;readonly starGem:number}
export type SourceRaidBattleEvent={kind:'start'}|{kind:'bar-cleared';score:number}|{kind:'end';result:SourceRaidBattleResult}|{kind:'exit'};
export class SourceRaidBattleRuntime {
 phase:'prepared'|'running'|'ended'|'exited'='prepared';
 score=0;remainingSeconds:number;readonly maximumSeconds:number;
 readonly boss:SourceRaidBossRuntime;readonly projectiles=new SourceEnemyProjectileFlightRuntime();
 private readonly events:SourceRaidBattleEvent[]=[];
 private completed:SourceRaidBattleResult|null=null;
 get result():SourceRaidBattleResult|null {return this.completed;}
 constructor(readonly runID:string,readonly weakType:number,plusPack0Active:boolean){
  if(typeof runID!=='string'||!runID.trim()||!Number.isInteger(weakType)||weakType<0||weakType>6||typeof plusPack0Active!=='boolean')throw RangeError('Invalid Raid run');
  this.maximumSeconds=raidStartTimer(raidTimeBonus(plusPack0Active));this.remainingSeconds=this.maximumSeconds;
  this.boss=new SourceRaidBossRuntime(()=>{
   if(this.phase!=='running')return;
   this.score++;this.events.push({kind:'bar-cleared',score:this.score});this.boss.spawn(raidBossHealth(this.score));
  });
 }
 /** Start is once-only in the H5 host. Native sets active, then tryCount++,
  * refreshes missions/pig, spawns boss and starts coroutine. Events carry these
  * hook points; no claim that absent mission/pig consumers already run. */
 start(state:SourceRaidState):SourceRaidState {
  if(this.phase!=='prepared')return state;
  if(!Number.isInteger(state.tryCount)||state.tryCount<0||state.tryCount>=2147483647)throw RangeError('Raid attempt overflow');
  this.phase='running';this.boss.spawn(raidBossHealth(0));this.events.push({kind:'start'});
  return {...state,tryCount:state.tryCount+1};
 }
 emit(input:SourceHuntGunEmission):SourceHuntFlightToken[] {
  if(this.phase!=='running')return [];
  // Same serialized Cat.EnemyLayer is used by all Cat gun branches, not a Hunt collision mask assumption.
  return sourceEnemyEmitGun(this.projectiles,input,SOURCE_HUNT_CAT_CONFIG.serialized.EnemyLayer);
 }
 advanceFrame(deltaSeconds:number):SourceHuntFlightEvent[] {
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0||!Number.isFinite(Math.fround(deltaSeconds)))throw RangeError('Invalid Raid delta');
  if(this.phase!=='running')return [];
  const timer=raidTimerFrame(this.remainingSeconds,true,deltaSeconds);this.remainingSeconds=timer.remaining;
  if(timer.end){this.end();return [];}
  return this.projectiles.advanceFrame(deltaSeconds,this.boss);
 }
 private end():void {
  if(this.phase!=='running')return;
  this.phase='ended';this.boss.dispose();this.projectiles.dispose();
  this.completed=Object.freeze({runID:this.runID,score:this.score,weakType:this.weakType,starGem:raidStarGemReward(this.score)});
  this.events.push({kind:'end',result:this.completed});
 }
 /** Host disposal cancels an unfinished run; no fabricated result or ticket refund.
  * Native exit loading/tree/scene restoration still belongs to the scene host. */
 exit():void {if(this.phase==='exited')return;this.phase='exited';this.boss.dispose();this.projectiles.dispose();this.events.push({kind:'exit'});}
 drainEvents():SourceRaidBattleEvent[]{return this.events.splice(0);}
}
