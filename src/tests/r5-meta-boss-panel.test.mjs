import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {BigValue} from '../big-value.ts';
import {sourceBossPanelProjection,sourceBossPanelTree,SOURCE_BOSS_PANEL_ROOTS} from '../source-boss-panel.ts';
import {freshSourceBossState,sourceBossEnter,sourceBossWin,sourceBossSweep,sourceBossFail,sourceBossSweepRequiredPower} from '../r5-boss.ts';
const e={plusPack0Active:false,plusPack1Active:false,plusPack2Active:false,automaticBonus:false};
const opts=(boss=freshSourceBossState(),entitlements=e)=>({boss,realPower:BigValue.fromInteger(1000000),historicMax:10,entitlements});
test('Boss Start preserves source inactive Power_My and uses actual power for the strict sweep gate',()=>{
 const o={...opts(),notice:''},p=sourceBossPanelProjection(o),r=SOURCE_BOSS_PANEL_ROOTS.start;assert.equal(sourceBossPanelTree.nodes.find(n=>n.path===r+'/Panel/Power_My').active,false);assert.equal(p.active[r+'/Panel/Power_My'],undefined);assert.ok(p.text[r+'/Panel/Explain/I2_txt'].length>0);assert.equal(p.kind,'start');assert.equal(p.text[r+'/Panel/Power_My/Value_txt'],undefined);assert.equal(p.active[r+'/Panel/Auto_obj'],false);assert.equal(p.bindings.find(b=>b.action==='boss-sweep').enabled,false);
 const auto={...e,plusPack2Active:true},equalPower=sourceBossSweepRequiredPower(0,auto),q=sourceBossPanelProjection({...opts(undefined,auto),realPower:equalPower});assert.equal(q.active[r+'/Panel/Auto_obj'],true);assert.equal(q.active[r+'/Panel/Auto_obj/Sweep_Btn/Active_obj'],false);assert.equal(q.text[r+'/Panel/Auto_obj/Sweep_Btn/NonActive_obj/Value_txt'],'100%');assert.equal(q.bindings.find(b=>b.action==='boss-sweep').enabled,false);
 const closed=sourceBossPanelProjection({...opts(),historicMax:9});assert.ok(closed.bindings.filter(b=>b.action==='start-boss').every(b=>!b.enabled));
 const pending=sourceBossPanelProjection({...opts(undefined,auto),pending:true});assert.ok(pending.bindings.every(b=>!b.enabled));
});
test('Boss result panel selects the source Win, Fail or Sweep roots without mutation or regrant',()=>{
 const entered=sourceBossEnter(freshSourceBossState(),e).value;assert.equal(sourceBossPanelProjection(opts(entered)),null);
 const won=sourceBossWin(entered,e).value,before=JSON.stringify(won),p=sourceBossPanelProjection(opts(won)),r=SOURCE_BOSS_PANEL_ROOTS.win;
 assert.equal(p.kind,'win');assert.equal(p.text[r+'/Panel/Reward/Dia/Reward_txt'],'450');assert.equal(p.text[r+'/Skip_obj/Exit_Btn/Dia/Reward_txt'],'150');assert.ok(p.bindings.some(b=>b.action==='boss-bonus'&&b.enabled));assert.equal(JSON.stringify(won),before);
 const failed=sourceBossPanelProjection(opts(sourceBossFail(entered).value));assert.equal(failed.kind,'fail');assert.equal(failed.text[SOURCE_BOSS_PANEL_ROOTS.fail+'/Panel/Reward/Dia/Reward_txt'],'0');assert.deepEqual(failed.bindings.filter(b=>!['result-remove-ads','freecash-open'].includes(b.action)).map(b=>b.action),['exit-boss']);
 const swept=sourceBossSweep(freshSourceBossState(),1000000,e).value,s=sourceBossPanelProjection(opts(swept));assert.equal(s.kind,'sweep');assert.equal(s.rootPath,SOURCE_BOSS_PANEL_ROOTS.sweep);
 const a={...e,plusPack1Active:true,automaticBonus:true},aw=sourceBossWin(sourceBossEnter(freshSourceBossState(),a).value,a).value,ap=sourceBossPanelProjection(opts(aw,a));assert.equal(ap.text[r+'/Panel/Reward/Dia/Reward_txt'],'900');assert.equal(ap.text[r+'/Skip_obj/Exit_Btn/Dia/Reward_txt'],'900');assert.equal(ap.active[r+'/Panel/Bonus_Objs'],false);assert.ok(ap.bindings.filter(b=>b.action==='boss-bonus').every(b=>!b.enabled));
});
test('all four Boss trees preserve original identity, RectTransform and mask components from full source',()=>{
 const full=JSON.parse(readFileSync('artifacts/evidence/round4-20261001/ui-complete-tree.json')),byId=new Map(full.nodes.map(n=>[n.id,n]));
 for(const path of Object.values(SOURCE_BOSS_PANEL_ROOTS))assert.ok(sourceBossPanelTree.nodes.some(n=>n.path===path));
 for(const n of sourceBossPanelTree.nodes)assert.deepEqual(n,byId.get(n.id));
 assert.ok(sourceBossPanelTree.nodes.some(n=>n.components.some(c=>c.kind==='Mask'||c.kind==='RectMask2D')));
});

import {sourceBossHudTree,sourceBossHudProjection,SOURCE_BOSS_HUD_ROOT} from '../source-boss-hud.ts';
import {createSession} from '../session.ts';
test('Boss live HUD uses original slider and exit nodes, including unchanged RectTransform/masks',()=>{
 const full=JSON.parse(readFileSync('artifacts/evidence/round4-20261001/ui-complete-tree.json')),byId=new Map(full.nodes.map(n=>[n.id,n]));
 for(const n of sourceBossHudTree.nodes)assert.deepEqual(n,byId.get(n.id));
 assert.ok(sourceBossHudTree.nodes.some(n=>n.components.some(c=>c.pathID===123248)));
 assert.ok(sourceBossHudTree.nodes.some(n=>n.components.some(c=>c.pathID===123463)));
});
test('Boss HUD timer/HP ratios stay bounded with huge BigValue HP; result hides live HUD',()=>{
 const session=createSession(4),boss=sourceBossEnter(freshSourceBossState(),e).value;
 boss.run.remainingSec=15.2;
 const live={...session,mode:'boss',boss,battle:{...session.battle,elapsed:44.8,targets:[{...session.battle.targets[0],strictNegativeDeath:true,healthValue:new BigValue(25n,999),maxHealthValue:new BigValue(100n,999)}]}};
 const p=sourceBossHudProjection(live,60),r=SOURCE_BOSS_HUD_ROOT;
 assert.equal(p.healthFraction,.25);assert.equal(p.timeFraction,15.2/60);assert.equal(p.text[r+'/Time_Slider/Time_txt'],'16s');assert.equal(p.exitPath,r+'/Exit_Btn');
 assert.equal(sourceBossHudProjection({...live,mode:'boss-result'}),null);
 assert.equal(sourceBossHudProjection(live).timeFraction,p.timeFraction);
 live.battle.targets[0].healthValue=BigValue.fromInteger(-1);boss.run.remainingSec=-.1;
 const q=sourceBossHudProjection(live,60);assert.equal(q.healthFraction,0);assert.equal(q.timeFraction,0);assert.equal(q.text[r+'/HP_Slider/HP_txt'],'0');
});

test('Boss Win/Fail/Sweep FreeCash exposure, all-ad purchase and owned gates use real source parent buttons',()=>{
 const entered=sourceBossEnter(freshSourceBossState(),e).value;
 for(const boss of [sourceBossWin(entered,e).value,sourceBossFail(entered).value,sourceBossSweep(freshSourceBossState(),1000000,e).value]){
  const o={...opts(boss),freeCashBanner:{featureEnabled:true,exposureTarget:true}},p=sourceBossPanelProjection(o),r=p.rootPath;
  assert(p.active[r+'/Remove Ads ALL (Inapp)/FreeCash_Banner']);assert(!p.active[r+'/Remove Ads ALL (Inapp)/Remove_AD_All']);
  assert(p.bindings.some(b=>b.action==='freecash-open'&&b.enabled));
  const locked=sourceBossPanelProjection({...o,freeCashBanner:{featureEnabled:false,exposureTarget:false}});assert(locked.active[r+'/Remove Ads ALL (Inapp)/Remove_AD_All']);assert(!locked.active[r+'/Remove Ads ALL (Inapp)/FreeCash_Banner']);
  assert(!sourceBossPanelProjection({...o,removeAdsAll:true}).active[r+'/Remove Ads ALL (Inapp)']);
 }
});

test('Boss remove-ads failed persistence enables original parent button for same-receipt retry',()=>{
 const boss=sourceBossWin(sourceBossEnter(freshSourceBossState(),e).value,e).value;
 const waiting=sourceBossPanelProjection({...opts(boss),purchasePending:true});
 const retry=sourceBossPanelProjection({...opts(boss),purchasePending:true,purchaseSaveFailed:true});
 assert(waiting.bindings.filter(b=>b.action==='result-remove-ads').every(b=>!b.enabled));
 assert(retry.bindings.filter(b=>b.action==='result-remove-ads').every(b=>b.enabled));
 assert.equal(retry.text[retry.rootPath+'/Remove Ads ALL (Inapp)/Remove_AD_All/Purchase_Btn/Price_txt'],'重试保存');
});
