import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceInputClientRect} from '../source-redeem-input.ts';

test('overlay aligns logical viewport pixels with a scaled canvas at an arbitrary screen offset',()=>{
 assert.deepEqual(sourceInputClientRect({x:180,y:400,width:360,height:80},{left:91,top:37,width:360,height:640},{width:720,height:1280}),{left:181,top:237,width:180,height:40});
});
test('nonuniform CSS scale is applied independently on each axis',()=>{
 assert.deepEqual(sourceInputClientRect({x:10,y:20,width:30,height:40},{left:-40,top:100,width:200,height:300},{width:100,height:100}),{left:-20,top:160,width:60,height:120});
});
test('hidden or invalid canvas geometry does not produce a clickable overlay',()=>{
 const b={x:1,y:2,width:3,height:4},c={left:0,top:0,width:100,height:100},v={width:100,height:100};
 for(const [bounds,canvas,viewport] of [[{...b,width:0},c,v],[b,{...c,width:0},v],[b,c,{...v,height:0}],[{...b,x:NaN},c,v],[b,{...c,top:Infinity},v]])assert.equal(sourceInputClientRect(bounds,canvas,viewport),null);
});
