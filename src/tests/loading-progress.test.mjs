import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assetLoadPercent,setBootProgress,finishBoot,failBoot} from '../loading-progress.ts';

test('boot percentage follows resolved asset count and cannot claim completion early',()=>{
 assert.equal(assetLoadPercent(0),10);
 assert.equal(assetLoadPercent(.5),45);
 assert.equal(assetLoadPercent(1),80);
 assert.equal(assetLoadPercent(2),80);
 assert.equal(assetLoadPercent(-1),10);
 assert.equal(assetLoadPercent(NaN),10);
});
test('cold HTML displays accessible progress before its JS module, without an external CSS/font dependency',()=>{
 const html=readFileSync('index.html','utf8');
 assert.ok(html.indexOf('id="boot-loading"')<html.indexOf('type="module"'));
 assert.ok(html.indexOf('<style>')<html.indexOf('type="module"'));
 assert.match(html,/role="progressbar"[^>]*aria-valuenow="0"/);
 assert.match(html,/程序下载期间百分比可能暂不变动/);
 assert.match(html,/boot-sheen/);
});
test('stages only advance and finish waits for two animation frames before uncovering the game',()=>{
 const nodes=new Map(['boot-progress','boot-bar','boot-percent','boot-status','boot-retry','boot-loading'].map(id=>[id,{
  id,style:{},textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v},hidden:true,remove(){this.removed=true}
 }]));
 const previousDocument=globalThis.document,previousRAF=globalThis.requestAnimationFrame;
 const queue=[];globalThis.document={getElementById:id=>nodes.get(id)};globalThis.requestAnimationFrame=callback=>{queue.push(callback);return queue.length};
 try {
  setBootProgress(45,'素材加载中');setBootProgress(20,'继续加载中');
  assert.equal(nodes.get('boot-progress').attributes['aria-valuenow'],'45');
  assert.equal(nodes.get('boot-bar').style.width,'45%');
  assert.equal(nodes.get('boot-status').textContent,'继续加载中');
  setBootProgress(200,'收尾');assert.equal(nodes.get('boot-percent').textContent,'99%');
  const priorConsole=console.error; console.error=()=>{};
  try {failBoot(new Error('network'));} finally {console.error=priorConsole;}
  assert.equal(nodes.get('boot-retry').hidden,false);
  assert.match(nodes.get('boot-status').textContent,/加载失败/);
  finishBoot();
  assert.equal(nodes.get('boot-progress').attributes['aria-valuenow'],'100');
  assert.equal(nodes.get('boot-loading').removed,undefined);
  queue.shift()();assert.equal(nodes.get('boot-loading').removed,undefined);
  queue.shift()();assert.equal(nodes.get('boot-loading').removed,true);
 } finally {globalThis.document=previousDocument;globalThis.requestAnimationFrame=previousRAF;}
});
