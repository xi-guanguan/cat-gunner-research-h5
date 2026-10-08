import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER_SOURCE_AUDIO, createBrowserFeedback } from '../browser-preferences';

function harness(run) {
  const names=['Audio','performance','requestAnimationFrame','navigator','localStorage'];
  const old=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  let time=0; const frames=[]; const players=[];
  class FakeAudio {
    constructor(url){this.url=url;this.currentTime=0;this.plays=0;this.pauses=0;players.push(this);}
    play(){this.plays++;return Promise.resolve();}
    pause(){this.pauses++;}
    removeAttribute(){} load(){}
  }
  for(const [name,value] of Object.entries({Audio:FakeAudio,performance:{now:()=>time},requestAnimationFrame:fn=>frames.push(fn),navigator:{userActivation:{isActive:true}},localStorage:{setItem(){}}}))
    Object.defineProperty(globalThis,name,{value,configurable:true});
  const feedback=createBrowserFeedback({music:true,sound:true,vibration:false});
  const player=id=>players.find(value=>value.url.endsWith(`clip-${id}.wav`));
  try {run({feedback,players,player,advance:ms=>{time+=ms;frames.splice(0).forEach(fn=>fn());},setTime:ms=>{time=ms;}});}
  finally {feedback.dispose();for(const [name,descriptor] of old) {if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}

test('original shot binding uses source clip291, volume .3, pitch1 and mute/unlock gates',()=>harness(({feedback,player})=>{
  assert.equal(BROWSER_SOURCE_AUDIO.shot.sourcePathID,291);
  const shot=player(291);assert.ok(Math.abs(shot.volume-.3)<1e-7);assert.equal(shot.playbackRate,1);assert.equal(shot.loop,false);
  feedback.playShot();assert.equal(shot.plays,0);
  feedback.unlock();feedback.playShot();assert.equal(shot.plays,1);
  feedback.setPreferences({sound:false});feedback.playShot();assert.equal(shot.plays,1);
}));

test('source duplicate policy blocks same type in frame and .05 seconds, allows distinct types sharing clip',()=>harness(({feedback,players,advance,setTime})=>{
  feedback.unlock();feedback.playShot();feedback.playShot();
  const shot=players.find(p=>p.url.endsWith('clip-291.wav'));assert.equal(shot.plays,1);
  advance(20);feedback.playShot();assert.equal(shot.plays,1);
  advance(31);feedback.playShot();assert.equal(shot.plays,2);
  setTime(151);feedback.playShot();assert.equal(shot.plays,2,'same browser frame blocked even after wall-clock cooldown');
  advance(0);feedback.playShot();assert.equal(shot.plays,3);
  feedback.playFusion();feedback.playReward();
  const sameClip=players.filter(p=>p.url.endsWith('clip-294.wav'));assert.deepEqual(sameClip.map(p=>p.plays),[1,1]);
}));

test('BGM switches original clips and mute persists across mode selection',()=>harness(({feedback,player})=>{
  const main=player(287),contents=player(289);assert.equal(main.loop,true);assert.equal(contents.loop,true);
  feedback.unlock();assert.equal(main.plays,1);
  feedback.setMusicMode('contents');assert.equal(contents.plays,1);assert.equal(main.pauses,1);
  feedback.setMusicMode('contents');assert.equal(contents.plays,1,'same mode does not restart');
  feedback.setPreferences({music:false});feedback.setMusicMode('main');assert.equal(main.plays,1);
  feedback.setPreferences({music:true});assert.equal(main.plays,2);
  feedback.dispose();feedback.playWin();assert.equal(player(285).plays,0);
}));

 test('round6 hidden combat is stopped and discarded, UI survives, restoration has no queue',()=>harness(({feedback,player,advance})=>{
  feedback.unlock();feedback.playShot();const shot=player(291);assert.equal(shot.plays,1);
  feedback.setCombatEnabled(false);assert.equal(shot.pauses,1);assert.equal(shot.currentTime,0);
  for(let i=0;i<80;i++){advance(60);feedback.playShot();}assert.equal(shot.plays,1);
  feedback.playUI();assert.ok(player(BROWSER_SOURCE_AUDIO.ui.sourcePathID).plays>0);feedback.setCombatEnabled(true);
  assert.equal(shot.plays,1,'unmuting does not replay discarded shots');advance(60);feedback.playShot();assert.equal(shot.plays,2);
 }));
