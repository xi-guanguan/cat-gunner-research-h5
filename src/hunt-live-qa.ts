/** Isolated same-build live Hunt QA. All fixtures, PRNG, raw movement stat
 * slots, time acceleration and local provider identity remain visible.
 * In-memory save roundtrip only: never reads/writes player localStorage.
 */
import {Application,Assets,Texture} from 'pixi.js';
import hudData from './data/source-hunt-hud.json';
import {SourceHuntSessionBridge} from './hunt-session-bridge';
import {SourceHuntSceneView,HUNT_SCENE_LIMITATIONS} from './hunt-scene-view';
import {createSession,sourceGun,serializeSession,deserializeSession} from './session';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState,type SourceMetaBundle} from './source-meta-runtime';
import {createActivityState,decodeActivityState,serializeActivityState} from './source-activities';
import {freshPlatformState,decodePlatformState} from './local-platform';
import {createSourceUiView,loadSourceUiFonts,type SourceUiTree,type SourceUiView} from './source-ui';
import {createSourceHuntPanel,sourceHuntPanelAssetURLs,type SourceHuntPanelAction} from './source-hunt-panel';
import {sourceRewardEntitlements} from './r5-entitlements';
import {createLocalRewardProvider,type SourceProviderStatus} from './r6-reward-provider';
import {runtimeSourceHuntPower} from './source-meta-runtime';
import {bindSourceHuntMovementStats} from './hunt-movement-binding';
import {sourceRelicTotals} from './r6-relic';
import {SOURCE_HUNT_MONSTER_COUNTS} from './r5-hunt';
import type {SourceHuntBattleEvent} from './hunt-battle-runtime';
const hudTree=hudData as unknown as SourceUiTree,HUD='/Canvas/SafeArea/Monster_UI';
function fixture(route:string):SourceMetaBundle {
 const ids=route==='hunt-live-victory'?[64,64,64]:route==='hunt-live-defeat'?[0,null,null]:route==='hunt-live-holes'?[20,null,24]:[20,24,29];
 const session={...createSession(60102),historicMax:110,equippedGuns:ids.map((id,i)=>id===null?null:{...sourceGun(id),uid:`qa-hunt-gun-${i}`}),bossSlotLevels:route==='hunt-live-holes'?[1,2,3] as [number,number,number]:[0,0,0] as [number,number,number]};
 return {session,meta:freshSourceMetaState(),activities:createActivityState(),platform:{...freshPlatformState(),developerEnabled:true}};
}
export async function startHuntLiveQA(route:string):Promise<void> {
 const page=document.getElementById('game')!,style=document.createElement('style');style.textContent=`*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#252520;font-family:system-ui;color:white}#game{height:100%;width:100%}.hunt-stage{position:absolute;inset:0}.hunt-stage canvas{display:block;width:100%;height:100%;touch-action:none}.hunt-controls{position:absolute;z-index:4;left:8px;right:8px;top:8px;background:#171a16e8;border:1px solid #b2bba2;border-radius:8px;padding:7px;font-size:11px;line-height:1.4;max-height:37vh;overflow:auto}.hunt-controls strong{color:#ffc774}.hunt-controls button,.hunt-controls select{font:inherit;margin:3px 2px;padding:5px 7px;min-height:30px;border:1px solid #69745c;border-radius:4px;background:#d5ddc6;color:#1a2515}.hunt-controls button:disabled{opacity:.5}.hunt-controls a{color:#c8eab0}.hunt-controls details{margin-top:3px}.hunt-controls pre{white-space:pre-wrap;margin:3px 0}.hunt-message{color:#ffe891}.hunt-stick{position:absolute;z-index:3;bottom:8%;left:6%;width:100px;height:100px;border:1px solid #fff8;border-radius:50%;background:#21282180;touch-action:none;display:grid;place-items:center;color:#fff8;font-size:12px}.hunt-stick:active{background:#535f3580}`;document.head.append(style);
 page.innerHTML=`<div class="hunt-stage"></div><section class="hunt-controls"><strong>第六轮 · 实时狩猎 · 隔离夹具 ${route}</strong><br>原资源／逐弹接触；H5 调度与源 Follow 实时相机投影，非原机等价。普通档不读不写。<div><button id="hunt-start">进入源狩猎</button><button id="hunt-pause">暂停测试时钟</button><button id="hunt-giveup">放弃并结算</button><button id="hunt-bonus">本地测试广告追加</button><button id="hunt-exit">退出／返回入口</button><button id="hunt-roundtrip">保存重载测试档</button><button id="hunt-reset">重置本夹具</button><a href="/qa.html">全功能选择页</a></div><label>测试时钟 <select id="hunt-rate"><option value="1">1×</option><option value="5">5×（H5 子帧）</option><option value="10">10×（H5 子帧）</option></select></label> <label>本地 provider <select id="hunt-provider"><option value="success">成功</option><option value="failure">失败</option><option value="cancelled">取消</option><option value="unavailable">未连接</option></select></label><div class="hunt-message">正在准备原场景、HUD、角色与弹丸资源；模拟未启动。</div><pre class="hunt-state"></pre><details><summary>夹具与证明边界</summary><div class="hunt-limits"></div></details></section><div class="hunt-stick">拖动方向</div>`;
 page.querySelector('.hunt-limits')!.textContent=`原枪夹具、PRNG seed60102；移动stat20读取已装备宠物；遗物移速从当前独立档已获得遗物累计读取（初始未拥有=0）。${HUNT_SCENE_LIMITATIONS.join(' ')}`;
 const app=new Application({width:innerWidth,height:innerHeight,resolution:Math.min(devicePixelRatio,2),backgroundColor:0x4d5543,antialias:true,autoDensity:true});page.querySelector('.hunt-stage')!.appendChild(app.view as HTMLCanvasElement);
 const textures:Record<string,Texture>={};
 const hudURLs=hudTree.nodes.flatMap(n=>n.components.map(c=>c.data?.textureURL??hudTree.sprites[c.data?.spriteKey]?.url).filter((v):v is string=>!!v));
 await Promise.all([loadSourceUiFonts(),...Array.from(new Set([...sourceHuntPanelAssetURLs,...hudURLs]),async url=>{textures[url]=await Assets.load<Texture>(url);})]);
 let bundle=fixture(route),bridge:SourceHuntSessionBridge|null=null,scene:SourceHuntSceneView|null=null,hud:SourceUiView|null=null,panel:SourceUiView|null=null;
 let paused=false,pending=false,generation=0,rate=1,providerOutcome:SourceProviderStatus='success',notice='资源准备完成；点击源入口或测试入场。';
 let rngState=60102,stepCount=0,renderCount=0,attackCount=0,hitCount=0,saveCount=0,encodedSave:string|null=null;
 const history:{step:number;phase:string;kind:string;requestID?:string;amount?:number}[]=[];
 let joystick={x:0,y:0},pointer:number|null=null,origin={x:0,y:0};
 const random=()=>{rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/4294967296;};
 const save=()=>{encodedSave=JSON.stringify({session:JSON.parse(serializeSession(bundle.session)),meta:JSON.parse(serializeSourceMetaState(bundle.meta)),activities:JSON.parse(serializeActivityState(bundle.activities)),platform:bundle.platform});saveCount++;};
 const log=(events:readonly SourceHuntBattleEvent[])=>{for(const e of events){if(e.kind==='attack')attackCount++;else if(e.kind==='projectile'&&['direct-damage','blast-damage'].includes(e.event.event.kind))hitCount++;if(e.kind==='settlement'||e.kind==='phase'||e.kind==='restore-field'){history.push({step:stepCount,phase:bridge?.host.phase??'idle',kind:e.kind==='settlement'?e.action:e.kind,...(e.kind==='settlement'?{requestID:e.requestID,amount:e.result.petCoinGrant}:{})});}}if(history.length>400)history.splice(0,history.length-400);};
 const commit=(dt=0)=>{if(!bridge)return;const r=bridge.commit(bundle);if(r.status==='blocked'){paused=true;notice=r.reason;return;}bundle=r.bundle;log(r.events);scene?.consume(r.events,dt);if(r.events.some(e=>e.kind==='settlement'))save();if(r.granted)notice=`原结算入账：宠物币 +${r.granted}（测试档）`;};
 function closeViews(){hud?.destroy();panel?.destroy();scene?.destroy();hud=null;panel=null;scene=null;}
 function discard(){generation++;bridge?.cancel();bridge=null;closeViews();joystick={x:0,y:0};pending=false;}
 function updatePanel(){
  const shouldPanel=!bridge||bridge.host.phase==='ended';
  if(!shouldPanel){panel?.destroy();panel=null;return;}
  panel?.destroy();panel=createSourceHuntPanel({viewport:{width:innerWidth,height:innerHeight},textures,hunt:bundle.meta.hunt,teamPower:runtimeSourceHuntPower(bundle),maxDisplayStage:Math.floor(bundle.session.historicMax/10)+1,entitlements:sourceRewardEntitlements(bundle.meta.entitlements),entryAvailable:true,pending,notice,localProvider:true,action:action=>void onAction(action)});if(panel)app.stage.addChild(panel.root);
 }
 function updateHUD(){
  if(!hud||!bridge)return;const h=bridge.host,s=bundle.meta.hunt,playing=h.phase==='playing';
  hud.patch({active:{[HUD]:!['ended','disposed'].includes(h.phase),[HUD+'/StageClear_obj']:h.phase==='next-level-wait',[HUD+'/GameExplain_obj']:h.phase==='enter-loading'},text:{[HUD+'/PetCoint_Value/Value_txt']:String(s.run?.accumulatedPetCoin??0),[HUD+'/Monster_Game_Slider/Value_txt']:`${h.monsters.killedCount}/${SOURCE_HUNT_MONSTER_COUNTS[h.monsters.level]??90}`,[HUD+'/Game_Slider/Wave_txt']:`Wave ${s.wave+1}-${s.level+1}`,[HUD+'/Exit_Btn/I2_txt(Outline)']:'退出',[HUD+'/GameExplain_obj/Panel/Explain_txt']:'原资源准备完成后才启动狩猎。击败史莱姆获得宠物币。',[HUD+'/StageClear_obj/Panel/I2_txt(Outline)']:'关卡完成'},fills:{[HUD+'/Monster_Game_Slider/Value_Fill']:playing?h.monsters.progress:0,[HUD+'/Game_Slider/Fill_Basic/Fill']:(s.level+(playing?h.monsters.progress:0))/5}});
 }
 async function enter(){
  if(pending||bridge)return;pending=true;const token=++generation;updatePanel();renderState();
  try{
   const owner=new SourceHuntSessionBridge(`qa:${route}:${crypto.randomUUID()}`,bundle,bindSourceHuntMovementStats(bundle.meta.pet,sourceRelicTotals(bundle.meta.relic).moveSpeedValue));bridge=owner;
   const view=new SourceHuntSceneView(owner.host,innerWidth,innerHeight);scene=view;app.stage.addChildAt(view.root,0);await view.prepare();
   if(generation!==token||bridge!==owner){view.destroy();return;}
   hud=createSourceUiView({tree:hudTree,roots:[HUD],textures,viewport:{width:innerWidth,height:innerHeight},active:{[HUD]:true,'/Canvas':true,'/Canvas/SafeArea':true}});hud.bindAction(HUD+'/Exit_Btn',()=>{owner.host.giveUp();commit();updatePanel();renderState();});app.stage.addChild(hud.root);
   owner.host.enter();commit();notice='资源已就绪；源入场等待2秒，遮罩期间不生成、不射击。';
  }catch(error){if(generation===token){discard();notice=String(error);updatePanel();renderState();}}finally{if(generation===token){pending=false;updatePanel();renderState();}}
 }
 async function bonus(){
  if(!bridge||pending)return;const owner=bridge,ticket=owner.beginBonus();if(!ticket){notice='没有可追加的狩猎结果或自动奖励已生效';renderState();return;}
  pending=true;const token=generation;updatePanel();renderState();
  const params=new URLSearchParams(location.search),delay=Math.min(10000,Math.max(0,Number(params.get('hunt-provider-delay')??0)||0));
  const provider=createLocalRewardProvider(providerOutcome!=='unavailable',providerOutcome==='success'||providerOutcome==='failure'||providerOutcome==='cancelled'?providerOutcome:'success');
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  const response=await provider.execute(ticket.request);
  if(generation!==token||bridge!==owner)return;
  notice=owner.finishBonus(ticket,response).reason;commit();pending=false;updatePanel();renderState();
 }
 async function onAction(action:SourceHuntPanelAction){
  if(action==='hunt-enter')await enter();
  else if(action==='hunt-bonus')await bonus();
  else if(action==='hunt-exit'){if(bridge){bridge.host.exit();commit();notice='源退出等待1.5秒，再撤遮罩0.2秒；原普通战斗未被本页启动。';}else notice='测试入口上下文已保留；可返回全功能选择页';updatePanel();}
  else if(action==='hunt-sweep')notice='本夹具未启用Plus2；扫荡可在全功能选择页单独验收';
  else notice='该结果服务线上未连接；本页只验收狩猎实时消费者，不伪造购买或OfferWall成功';renderState();
 }
 const state=()=>({route,isolated:true,fixture:{guns:bundle.session.equippedGuns.map(g=>g?.id??null),star:bundle.session.bossSlotLevels,rawStats:bindSourceHuntMovementStats(bundle.meta.pet,sourceRelicTotals(bundle.meta.relic).moveSpeedValue),movementBinding:{pet:'Pet_Speed_Accum from selected pets',relic:'sourceRelicTotals(meta.relic).moveSpeedValue; fixture defaults to no ownership'},seed:60102,rate,provider:'local-test',providerOutcome,onlineConnected:false},ready:scene?.ready??true,phase:bridge?.host.phase??'idle',pending,paused,notice,wave:bundle.meta.hunt.wave,level:bundle.meta.hunt.level,run:bundle.meta.hunt.run,petCoin:bundle.meta.petCoin,receipts:bundle.meta.huntSettlementClaims??[],
  camera:scene?.ready?scene.projectionState():null,elapsed:bridge?.host.elapsedSeconds??0,wait:bridge?.host.waitSeconds??0,projectilePresentation:scene?{births:scene.projectilePresentation.births,stops:scene.projectilePresentation.stops,active:scene.projectilePresentation.active.size,retired:scene.projectilePresentation.retired.size}:null,stepCount,renderCount,attackCount,hitCount,saveCount,joystick,monsters:bridge?[...bridge.host.monsters.activeMonsters()].map(m=>({id:m.id,generation:m.generation,big:m.big,health:m.health.toString(),position:m.position})):[],projectiles:bridge?.host.projectiles.activeCount??0,cats:bridge?.host.cats.map(c=>({componentID:c.componentID,slotNum:c.slotNum,starLevel:c.gun.starLevel,gun:c.gun.gunNum,position:c.movement.position,screenPosition:scene?.ready?scene.project(c.movement.position):null})),history:[...history],hudDiagnostics:hud?.diagnostics??[],panelDiagnostics:panel?.diagnostics??[],layouts:{hud:hud?[...hud.layout.values()]:[],panel:panel?[...panel.layout.values()]:[]},limitations:HUNT_SCENE_LIMITATIONS});
 function renderState(){
  const s=state();page.querySelector('.hunt-message')!.textContent=notice;page.querySelector('.hunt-state')!.textContent=`${s.phase} · Wave ${s.wave+1}-${s.level+1} · 余额 ${s.petCoin} 宠物币\n逐弹命中 ${hitCount} / 射击 ${attackCount} · 活跃怪 ${s.monsters.length} / 弹 ${s.projectiles}\n模拟 ${s.elapsed.toFixed(2)}s · 帧 ${stepCount} / 绘制 ${renderCount} · 时钟 ${rate}×${paused?' [测试暂停]':''}`;
  (page.querySelector('#hunt-start') as HTMLButtonElement).disabled=!!bridge||pending;(page.querySelector('#hunt-bonus') as HTMLButtonElement).disabled=bridge?.host.phase!=='ended'||pending;(page.querySelector('#hunt-giveup') as HTMLButtonElement).disabled=!bridge||pending||!['playing','enter-loading','next-level-wait'].includes(bridge.host.phase);
 }
 const click=(id:string,fn:()=>void)=>page.querySelector(id)!.addEventListener('click',fn);
 click('#hunt-start',()=>void enter());click('#hunt-giveup',()=>{bridge?.host.giveUp();commit();updatePanel();renderState();});click('#hunt-exit',()=>void onAction('hunt-exit'));click('#hunt-bonus',()=>void bonus());
 click('#hunt-pause',()=>{paused=!paused;joystick={x:0,y:0};renderState();});
 click('#hunt-reset',()=>{discard();bundle=fixture(route);encodedSave=null;saveCount=0;attackCount=0;hitCount=0;stepCount=0;history.length=0;paused=false;rngState=60102;notice='测试档已重置；没有读取或覆盖普通档';updatePanel();renderState();});
 click('#hunt-roundtrip',()=>{save();const raw=JSON.parse(encodedSave!);discard();bundle={session:deserializeSession(JSON.stringify(raw.session)),meta:decodeSourceMetaState(JSON.stringify(raw.meta)),activities:decodeActivityState(JSON.stringify(raw.activities)),platform:decodePlatformState(JSON.stringify(raw.platform))};notice='隔离测试档保存重载：余额／Wave／收据保留，源临时run不保存。';updatePanel();renderState();});
 page.querySelector('#hunt-rate')!.addEventListener('change',e=>{rate=Number((e.target as HTMLSelectElement).value);renderState();});page.querySelector('#hunt-provider')!.addEventListener('change',e=>{providerOutcome=(e.target as HTMLSelectElement).value as SourceProviderStatus;renderState();});
 const stick=page.querySelector('.hunt-stick') as HTMLElement;
 stick.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};stick.setPointerCapture(pointer);});
 stick.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;let x=(e.clientX-origin.x)/38,y=-(e.clientY-origin.y)/38;const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}joystick={x,y};});
 const release=()=>{pointer=null;joystick={x:0,y:0};};stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release);
 const keys=new Set<string>();addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();keys.add(e.key);}});addEventListener('keyup',e=>keys.delete(e.key));addEventListener('blur',()=>{keys.clear();release();});
 addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();release();}});
 addEventListener('resize',()=>{app.renderer.resize(innerWidth,innerHeight);scene?.resize(innerWidth,innerHeight);hud?.reflow({width:innerWidth,height:innerHeight});updatePanel();});
 const qaWindow=window as typeof window&{__catHuntLiveQA?:()=>ReturnType<typeof state>};qaWindow.__catHuntLiveQA=state;
 let panelPhase='idle',statusClock=0;
 app.ticker.add(()=>{
  const owner=bridge,dt=Math.min(.1,app.ticker.deltaMS/1000);
  if(owner&&scene?.ready&&!paused&&!document.hidden){const a=scene.adapter(random);
   for(let i=0;i<rate;i++){const joy=keys.size?{x:(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),y:(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0)}:joystick;owner.host.advanceFrame(dt,{joystick:joy,resourcesReady:true,simulate:true,acceptInput:true},a);stepCount++;commit(dt);if(paused)break;}
   scene.render(dt*rate);renderCount++;updateHUD();hud?.update(dt);
   if(owner.host.phase!==panelPhase){panelPhase=owner.host.phase;updatePanel();}
   if(owner.host.phase==='disposed'){discard();notice='已退出，返回同一测试档入口；普通场景与普通档未运行。';updatePanel();}
  }
  statusClock+=dt;if(statusClock>.15){renderState();statusClock=0;}
 });
 updatePanel();renderState();
}
