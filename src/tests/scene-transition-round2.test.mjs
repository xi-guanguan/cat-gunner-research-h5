import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneTransition } from '../scene-transition';
test('source enter fade and minimum barrier block duplicate activation',()=>{
 const t=new SceneTransition();let entries=0;
 assert.equal(t.start('enter',()=>entries++),true);
 assert.equal(t.start('enter',()=>entries++),false);
 assert.equal(entries,1);t.advance(.3);assert.equal(t.alpha,.5);
 t.advance(.3);assert.equal(t.alpha,1);assert.equal(t.active,true);
 t.advance(.89);assert.equal(t.active,true);t.advance(.02);
 assert.equal(t.active,false);assert.equal(t.alpha,0);assert.equal(entries,1);
});
test('source exit resumes field at1.5, hides after additional0.2, applies only once',()=>{
 const t=new SceneTransition();let resumes=0;t.start('exit',()=>resumes++);
 t.advance(1.49);assert.equal(resumes,0);t.advance(.02);assert.equal(resumes,1);
 assert.equal(t.active,true);t.advance(.2);assert.equal(t.active,false);
 t.advance(50);assert.equal(resumes,1);
});
