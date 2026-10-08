import test from 'node:test';
import assert from 'node:assert/strict';
import {mineHudValue,mineSettlement} from '../meta-progression';
import {runtimePolicy} from '../runtime-policy';
import {createSession,openPermanent,purchasePermanent,closeOverlay,openRebirth,confirmRebirth} from '../session';
import {BigValue} from '../big-value';
test('ore HUD uses tenths, independently of final truncation',()=>{
 for(const [score,text] of [[0,'0.0'],[1,'0.1'],[3,'0.3'],[10,'1.0'],[19,'1.9'],[1231,'123.1']])assert.equal(mineHudValue(score),text);
 assert.throws(()=>mineHudValue(1.2));assert.throws(()=>mineHudValue(-1));
});
test('runtime policy separates simulation, input, combat audio and animation',()=>{
 const base={transition:false,frozen:false,settings:false,panel:false,eco:false,popup:false};
 assert.deepEqual(runtimePolicy(base),{simulate:true,input:true,combatAudio:true,worldPresentation:true,animateWorld:true});
 const panel=runtimePolicy({...base,panel:true});assert.equal(panel.simulate,true);assert.equal(panel.combatAudio,false);assert.equal(panel.input,false);
 const eco=runtimePolicy({...base,eco:true});assert.equal(eco.simulate,true);assert.equal(eco.animateWorld,false);assert.equal(eco.worldPresentation,false);
 assert.equal(runtimePolicy({...base,transition:true}).simulate,false);
 assert.equal(runtimePolicy({...base,settings:true}).simulate,false);
});
test('permanent page is reachable and upgrades remain after rebirth',()=>{
 let s=closeOverlay(createSession());s.battle.stage=2;s.historicMax=20;s.ruby=BigValue.fromInteger(10000);s=openPermanent(s);assert.equal(s.overlay,'permanent');
 for(const kind of ['damage','speed','money'])s=purchasePermanent(s,kind);
 const levels={...s.permanentLevels};assert.ok(Object.values(levels).every(n=>n===1));
 s=openRebirth(closeOverlay(s));s=confirmRebirth(s);assert.equal(s.rebirthCount,1);assert.deepEqual(s.permanentLevels,levels);
});
