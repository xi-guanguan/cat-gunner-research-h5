/** H5 async callback ownership. Does not persist references or invent source run IDs. */
import type {Session} from './session';
import type {SourceMetaState} from './source-meta-runtime';
import {sourceChallengeResultRun} from './r6-challenge';
export type SourceResultContext = {kind:'boss';run:NonNullable<Session['boss']['run']>} | {kind:'hunt';run:NonNullable<SourceMetaState['hunt']['run']>} | {kind:'challenge';runID:string} |
 {kind:'mine';settlement:NonNullable<Session['mine']['settlement']>} |
 {kind:'mine-sweep';sequence:number;settlement:NonNullable<SourceMetaState['sweep']>};
export function sourceResultContext(session:Session,meta:SourceMetaState,huntPanelActive=false):SourceResultContext|null {
 const runID=sourceChallengeResultRun(session.mode,session.overlay,session.challengeRunID);
 if(runID)return {kind:'challenge',runID};
 if(session.mode==='boss-result'&&session.boss.run&&session.boss.run.phase!=='playing')return {kind:'boss',run:session.boss.run};
 if(session.mode==='mine-result'&&session.mine.settlement)return {kind:'mine',settlement:session.mine.settlement};
 if(session.mode==='field'&&session.overlay==='mine'&&meta.sweep?.pending)return {kind:'mine-sweep',sequence:meta.sweepSequence,settlement:meta.sweep};
 if(huntPanelActive&&session.mode==='field'&&meta.hunt.run?.phase==='ended')return {kind:'hunt',run:meta.hunt.run};
 return null;
}
export function sourceResultContextMatches(expected:SourceResultContext,session:Session,meta:SourceMetaState,transitionActive:boolean,huntPanelActive=false):boolean {
 if(transitionActive)return false;
 const current=sourceResultContext(session,meta,huntPanelActive);
 if(!current||current.kind!==expected.kind)return false;
 if(current.kind==='boss'&&expected.kind==='boss')return current.run===expected.run;
 if(current.kind==='hunt'&&expected.kind==='hunt')return current.run===expected.run;
 if(current.kind==='challenge'&&expected.kind==='challenge')return current.runID===expected.runID;
 if(current.kind==='mine'&&expected.kind==='mine')return current.settlement===expected.settlement;
 return current.kind==='mine-sweep'&&expected.kind==='mine-sweep'&&current.sequence===expected.sequence&&current.settlement===expected.settlement;
}
