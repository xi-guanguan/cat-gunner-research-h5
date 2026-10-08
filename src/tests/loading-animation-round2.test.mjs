import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadingPose } from '../loading-animation';
const source=JSON.parse(readFileSync('public/assets/round2-ui/loading-animation.json','utf8'));
test('source loading cubic replay matches independently exported60Hz poses and loops',()=>{
 assert.equal(source.status,'SOURCE_CURVES_DECODED');
 for(const frame of source.clips.Walk.frames.slice(0,-1)) {
  const actual=loadingPose(source,frame.time);
  for(const [path,properties] of Object.entries(frame.nodes))
   for(const [property,expected] of Object.entries(properties)) {
    const values=actual.get(`${source.rootPath}/${path}`)[property];
    (Array.isArray(expected)?expected:[expected]).forEach((value,i)=>assert.ok(Math.abs(values[i]-value)<1e-5));
   }
 }
 assert.deepEqual(loadingPose(source,0),loadingPose(source,2));
 assert.deepEqual(loadingPose(source,0),loadingPose(source,-2));
});
