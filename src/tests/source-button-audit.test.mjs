import test from 'node:test';
import assert from 'node:assert/strict';
import tree from '../data/source-ui-tree.json' with {type:'json'};
import {sourceUnboundActiveButtons,sourceViewButtonCandidates} from '../source-button-audit';
test('active source button audit identifies full source path; excludes disabled/non-buttons',()=>{
 const nodes=[{id:'a',path:'/root/A',components:[{kind:'Button',enabled:true}]},{id:'b',path:'/root/B',components:[{kind:'Button',enabled:false}]},{id:'c',path:'/root/C',components:[{kind:'Image'}]},{id:'d',path:'/root/D',components:[{kind:'Button'}]}];
 assert.deepEqual(sourceUnboundActiveButtons(nodes,new Set(['a','b','c','d']),new Set(['d'])),['/root/A']);
 assert.deepEqual(sourceUnboundActiveButtons(nodes,new Set(['d']),new Set(['d'])),[]);
 assert.deepEqual(sourceUnboundActiveButtons(nodes,new Set(['a','d']),new Set()),['/root/A','/root/D']);
});
test('pet inactive Collection_Btn is not a fake pet progress lock; exposing it requires a binding',()=>{
 const n=tree.nodes.find(n=>n.id==='level0:1561');assert.equal(n.active,false);assert.equal(n.name,'Collection_Btn');assert.deepEqual(sourceUnboundActiveButtons([n],new Set(),new Set()),[]);assert.deepEqual(sourceUnboundActiveButtons([n],new Set([n.id]),new Set()),[n.path]);
});

test('view button candidates exclude unrelated roots and keep inactive buttons for future runtime activation',()=>{
 const nodes=tree.nodes;const selected=new Map([['level0:1561',{}],['level0:1351',{}]]);
 const candidates=sourceViewButtonCandidates(nodes,selected);
 assert.deepEqual(candidates.map(n=>n.id).sort(),['level0:1351','level0:1561']);
 assert.equal(candidates.find(n=>n.id==='level0:1561').active,false);
 assert.deepEqual(sourceUnboundActiveButtons(candidates,new Set(['level0:1561']),new Set()),[nodes.find(n=>n.id==='level0:1561').path]);
});
