import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceHuntProjectilePresentation} from '../hunt-projectile-presentation';
import {bindSourceHuntMovementStats} from '../hunt-movement-binding';
import {sourceMoveSpeedFromRawStatSlots} from '../cat-movement-source';
import {freshSourcePetState,sourcePetSelectedStats} from '../r5-pet';
const v=x=>({x,y:0,z:0});
const flight=(generation=1,active=true)=>({slot:0,generation,active,start:v(1),position:v(5),elapsedSeconds:.1,settings:{gunNum:20}});
function fixture(){const views=[],trace=[];const p=new SourceHuntProjectilePresentation({
 create:f=>{const view={generation:f.generation,complete:false};views.push(view);trace.push(['birth',f.generation,f.start.x]);return view;},
 advance:(view,age,point)=>{trace.push(['advance',view.generation,age,point.x]);},
 stop:(view,age,point)=>{trace.push(['stop',view.generation,age,point.x]);},completed:view=>view.complete,
 destroy:view=>{trace.push(['destroy',view.generation]);}});return {p,views,trace};}
test('birth and contact inside one subframe still sample initial/final paths and retain retired tail',()=>{
 const x=fixture(),f=flight(1,false);x.p.consume([f],[{slot:0,generation:1}],.1);
 assert.deepEqual(x.trace,[['birth',1,1],['advance',1,.1,5],['stop',1,.1,5]]);assert.equal(x.p.active.size,0);assert.equal(x.p.retired.size,1);
 x.p.consume([f],[{slot:0,generation:1}],.2);assert.equal(x.p.births,1);assert.deepEqual(x.trace.at(-1),['advance',1,.1+.2,5]);assert.equal(x.p.retired.size,1);
 x.views[0].complete=true;x.p.consume([f],[],.2);assert.deepEqual(x.trace.at(-1),['destroy',1]);assert.equal(x.p.retired.size,0);
});
test('slot reuse cannot transplant an old tail or endpoint; births are deduplicated',()=>{
 const x=fixture(),a=flight();x.p.consume([a],[{slot:0,generation:1},{slot:0,generation:1}],.1);assert.equal(x.p.births,1);
 const b=flight(2);b.position=v(20);x.p.consume([b],[{slot:0,generation:2}],.1);
 assert.equal(x.p.active.size,1);assert.equal(x.p.retired.size,1);assert.deepEqual(x.trace.find(t=>t[0]==='stop'),['stop',1,.1,5]);
 b.active=false;x.p.consume([b],[],0);assert.equal(x.p.retired.size,2);assert.equal(x.p.stops,2);
 x.p.destroy();x.p.destroy();assert.equal(x.trace.filter(t=>t[0]==='destroy').length,2);
 x.p.consume([b],[{slot:0,generation:2}],1);assert.equal(x.p.births,2);
});
test('reset/dispose clears active and retired generations exactly once; invalid births/delta fail visibly',()=>{
 const x=fixture(),f=flight();assert.throws(()=>x.p.consume([f],[{slot:0,generation:9}],0),/Stale/);
 for(const dt of [-1,NaN,Infinity])assert.throws(()=>x.p.consume([f],[],dt));
 x.p.consume([f],[{slot:0,generation:1}],0);x.p.reproject();assert.equal(x.p.births,1);x.p.destroy();x.p.destroy();assert.equal(x.trace.filter(t=>t[0]==='destroy').length,1);
});
test('Pet_Speed_Accum consumes selected pets, not bag/history; explicit Relic value is required',()=>{
 const pet=freshSourcePetState();pet.owned[0]=9;pet.collect[9]=true;let s=bindSourceHuntMovementStats(pet,0);
 assert.equal(s.slot5d5d4d0Static20,100);assert.equal(sourceMoveSpeedFromRawStatSlots(false,s),15);assert.equal(sourceMoveSpeedFromRawStatSlots(true,s),17);
 pet.selected=[0,-1,4];pet.selectedLocks=[5,-1,1];s=bindSourceHuntMovementStats(pet,7);
 assert.equal(s.slot5d5d4d0Static20,sourcePetSelectedStats(pet).moveSpeedMultiplierPercent);assert.equal(s.slot5d5d4d0Static20,124);
 assert.equal(s.slot5d5d4d8Static60,7);assert.equal(sourceMoveSpeedFromRawStatSlots(false,s),Math.fround(Math.fround(15*131)/100));
 for(const missing of [undefined,null,NaN,Infinity,.1,2147483648,-2147483649])assert.throws(()=>bindSourceHuntMovementStats(pet,missing));
 assert.equal(bindSourceHuntMovementStats(pet,-2147483648).slot5d5d4d8Static60,-2147483648);
});
