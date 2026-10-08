import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSourceSkinState,validateSourceSkinState,sourceSkinRow,sourceSkinAction,sourceSkinTotals} from '../r6-skin';
import {createSession,serializeSession,deserializeSession,sessionCombatModifiers,sessionBossModifiers,sessionBossPower,sourceGun,step,confirmRebirth} from '../session';
import {BigValue} from '../big-value';
import {makeActor} from '../cat-actors';
import {tick,walletValue,createLevel} from '../rules';
import rig from '../data/r6-skin-rig.json';
const ready=()=>({...createSession(0xc47),overlay:'none',dailyClaimed:true});
test('25 source skin identities, prices, default ownership and accumulated percentages',()=>{
 const s=freshSourceSkinState();assert.equal(s.owned.length,25);assert.equal(s.owned.filter(Boolean).length,1);assert.equal(s.selected,0);assert.deepEqual(sourceSkinTotals(s),{damagePercent:100,speedPercent:100,moneyPercent:100});
 for(let i=0;i<25;i++)assert.deepEqual(sourceSkinRow(i),{index:i,damage:i*16,speed:i*10,money:i*5,price:i*100});
 const all={owned:Array(25).fill(true),selected:24};assert.deepEqual(sourceSkinTotals(all),{damagePercent:4900,speedPercent:3100,moneyPercent:1600});
});
test('skin purchase is immutable, exactly once, consumes diamonds and does not auto-select; selecting changes visuals only',()=>{
 const s=freshSourceSkinState(),snapshot=structuredClone(s),a=sourceSkinAction(s,1000,2,'purchase');assert.equal(a.status,'granted');assert.equal(a.diamonds,800);assert.equal(a.state.selected,0);assert.deepEqual(s,snapshot);
 const repeated=sourceSkinAction(a.state,a.diamonds,2,'purchase');assert.equal(repeated.status,'denied');assert.equal(repeated.diamonds,800);assert.equal(repeated.state,a.state);
 const selected=sourceSkinAction(a.state,800,2,'select');assert.equal(selected.state.selected,2);assert.equal(selected.diamonds,800);assert.deepEqual(sourceSkinTotals(a.state),sourceSkinTotals(selected.state));
 const b=sourceSkinAction(selected.state,800,1,'purchase');assert.equal(b.state.selected,2);assert.deepEqual(sourceSkinTotals(b.state),{damagePercent:148,speedPercent:130,moneyPercent:115});
});
test('skin locked/invalid/insufficient/already-selected denials never spend or grant; corrupt saves are not unlocked',()=>{
 const s=freshSourceSkinState();for(const [index,action,wallet,reason]of [[1,'select',100,'not-owned'],[1,'purchase',99,'insufficient-diamonds'],[-1,'purchase',999,'invalid-index'],[25,'select',999,'invalid-index'],[0,'purchase',999,'already-owned'],[0,'select',999,'already-selected']]){const r=sourceSkinAction(s,wallet,index,action);assert.equal(r.reason,reason);assert.equal(r.state,s);assert.equal(r.diamonds,wallet);}
 for(const patch of [{owned:[true]},{selected:1},{selected:25},{selected:.5},{owned:Array(25).fill(false)},{owned:[true,...Array(24).fill(1)]}])assert.throws(()=>validateSourceSkinState({...s,...patch}));
});
test('old schema2 migration only adds basic skin, roundtrip and rebirth preserve owned/selected',()=>{
 const s=ready(),legacy=JSON.parse(serializeSession(s));delete legacy.session.skin;const migrated=deserializeSession(JSON.stringify(legacy));assert.deepEqual(migrated.skin,freshSourceSkinState());assert.equal(migrated.diamonds,s.diamonds);
 const skin=sourceSkinAction(freshSourceSkinState(),2400,24,'purchase').state;skin.selected=24;const value={...s,skin,diamonds:123,historicMax:90,overlay:'rebirth'};const round=deserializeSession(serializeSession(value));assert.deepEqual(round.skin,skin);assert.equal(round.diamonds,123);assert.deepEqual(confirmRebirth(value).skin,skin);
 const invalid=JSON.parse(serializeSession(value));invalid.session.skin.selected=2;assert.throws(()=>deserializeSession(JSON.stringify(invalid)));
});
test('ordinary real projectiles and boss consume cumulative skin damage; selection is independent',()=>{
 let s={...ready(),equippedGuns:[sourceGun(0),null,null]};s.battle={...s.battle,autoMove:false,actors:[{...makeActor(0,s.battle.player),attackState:{spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:2}}],targets:s.battle.targets.map((t,i)=>({...t,position:i===0?{x:s.battle.player.x+2,y:s.battle.player.y}:{x:100,y:100}}))};
 const skin=sourceSkinAction(freshSourceSkinState(),100,1,'purchase').state;const a=step(s,1/60),b=step({...s,skin},1/60);assert.ok(a.battle.projectiles.length);assert.ok(b.battle.projectiles[0].damageValue.eq(a.battle.projectiles[0].damageValue.nativeMultiply(116).nativeDivide(100).truncateInteger()));
 const mods=sessionCombatModifiers({...s,skin});assert.equal(mods.skinDamagePercent,116);assert.equal(mods.skinSpeedPercent,110);assert.equal(mods.skinMoneyPercent,105);assert.equal(sessionBossModifiers({...s,skin}).skinDamagePercent,116);assert.equal(sessionBossModifiers({...s,skin}).skinSpeedPercent,110);assert.ok(sessionBossPower({...s,skin}).gt(sessionBossPower(s)));assert.ok(sessionBossPower({...s,skin:{...skin,selected:1}}).eq(sessionBossPower({...s,skin})));
});
test('each original skin mesh retains its own geometry, bindposes, weights, UVs and only hand color',()=>{
 assert.equal(rig.layers.length,25);assert.equal(rig.colors.length,25);assert.equal(rig.layers[0].sprite,620);assert.equal(rig.layers[24].sprite,394);
 for(const l of rig.layers){assert.equal(l.node,42416);assert.equal(l.positions.length*2,l.uvs.length);assert.equal(l.positions.length,l.skin.weights.length);assert.equal(l.skin.bindposes.length,9);assert.ok(l.indices.every(i=>i<l.positions.length));for(const w of l.skin.weights)assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-5);assert.ok(l.uvs.every(v=>v>=0&&v<=1));}
 assert.ok(new Set(rig.layers.map(l=>l.positions.length)).size>1);assert.notDeepEqual(rig.colors[0],rig.colors[1]);
});

test('skin money reaches real kill payout in source order: upgrade, rebirth, skin, buff, pet',()=>{
 const s=ready(),skin=sourceSkinAction(freshSourceSkinState(),100,1,'purchase').state,mods=sessionCombatModifiers({...s,skin});
 const state=createLevel(0,0,0);state.autoMove=true;state.combatModifiers={...mods,sourceMoneyRebirthPercent:BigValue.fromInteger(105),sourceMoneyBuffPercent:300,petMoneyPercent:BigValue.fromInteger(123)};state.targets=[{id:1,position:{...state.player},health:1,maxHealth:1,coin:100,radius:1,healthValue:BigValue.fromInteger(1),maxHealthValue:BigValue.fromInteger(1),coinValue:BigValue.fromInteger(100)}];state.projectiles=[{id:777,position:{...state.player},velocity:{x:0,y:0},damage:1,damageValue:BigValue.fromInteger(1),remainingRange:1,distanceTraveled:0,gunSlot:0}];
 const paid=tick(state,0),expected=BigValue.fromInteger(100).nativeMultiply(100).nativeDivide(100).nativeMultiply(105).nativeDivide(100).nativeMultiply(105).nativeDivide(100).nativeMultiply(300).nativeDivide(100).nativeMultiply(123).nativeDivide(100);assert.ok(walletValue(paid).eq(expected));assert.equal(paid.targets[0].health,0);
});
