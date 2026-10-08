import test from 'node:test';
import assert from 'node:assert/strict';
import {installFrameClock} from '../frame-clock';
function setup(){
 let now=0,hidden=false,next=0,frame,timer,visibility;
 const updates=[];const ticker={started:true,starts:0,stops:0,start(){this.started=true;this.starts++;},stop(){this.started=false;this.stops++;},update(t){assert.equal(this.started,false,'manual update must have no automatic ticker');updates.push(t);}};
 const clock=installFrameClock({ticker},{now:()=>now,isHidden:()=>hidden,requestFrame:fn=>{frame=fn;return ++next;},cancelFrame:()=>{frame=null;},setTimer:fn=>{timer=fn;return ++next;},clearTimer:()=>{timer=null;},onVisibility:fn=>{visibility=fn;return()=>{visibility=null;};}});
 return {clock,ticker,updates,tick:t=>{now=t;timer?.();},raf:t=>{now=t;frame?.(t);},hide:value=>{hidden=value;visibility?.();}};
}
test('normal RAF never manually advances and fallback starts only after visible >600ms starvation',()=>{
 const h=setup();h.tick(600);assert.equal(h.clock.diagnostics.mode,'raf');assert.equal(h.updates.length,0);
 h.tick(601);assert.equal(h.clock.diagnostics.mode,'timer');assert.deepEqual(h.updates,[601]);
 h.tick(617);assert.deepEqual(h.updates,[601,617]);assert.equal(h.ticker.stops,1);h.clock.dispose();
});
test('fallback recovery requires continuous timely RAF and 1s cooldown, then no dual updates',()=>{
 const h=setup();h.tick(601);for(let i=1;i<=12;i++)h.raf(601+i*16);
 assert.equal(h.clock.diagnostics.mode,'timer','cooldown blocks early recovery');
 h.raf(1590);assert.equal(h.clock.diagnostics.stableFrames,0,'long gap resets recovery');
 for(let i=1;i<=12;i++)h.raf(1590+i*16);
 assert.equal(h.clock.diagnostics.mode,'raf');assert.equal(h.clock.diagnostics.recoveryCount,1);
 const count=h.updates.length;h.tick(1800);assert.equal(h.updates.length,count);assert.equal(h.ticker.started,true);h.clock.dispose();
});
test('hidden state pauses both clocks; visible resets starvation grace; dispose clears all scheduling',()=>{
 const h=setup();h.tick(601);h.hide(true);h.tick(5000);h.raf(5001);assert.deepEqual(h.updates,[601]);assert.equal(h.clock.diagnostics.mode,'hidden');
 h.hide(false);h.tick(5601);assert.equal(h.clock.diagnostics.mode,'raf');h.tick(5602);assert.equal(h.clock.diagnostics.mode,'timer');
 h.clock.dispose();const count=h.updates.length;h.tick(7000);h.raf(7000);assert.equal(h.updates.length,count);assert.equal(h.clock.diagnostics.mode,'disposed');
});
