import {FOCUS, scenarioURL, isIsolatedChild, fixtureAPI, viewportSize, normalizedDelay, boundedRecord, usesHostProviderControls} from './model.mjs';
const $=id=>document.getElementById(id), frame=$('game-frame');
let catalog=[], known=new Set(), active=null, records=[], last=null, before=null, build=null, started=0, lastText='', ready=false, navigating=false;
const clone=value=>JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='bigint'?String(v):v));
const notice=text=>{$('action-status').textContent=text;};
function disableMutations() {for(const id of ['fail-save','allow-save','close-result'])$(id).disabled=true;}
function fit() {
 const size=viewportSize($('viewport').value),area=$('preview-area');
 const scale=Math.min(1,Math.max(.1,(area.clientWidth-24)/size.width),Math.max(.1,(area.clientHeight-24)/size.height));
 frame.style.width=`${size.width}px`;frame.style.height=`${size.height}px`;frame.style.transform=`scale(${scale})`;
 $('frame-holder').style.width=`${size.width*scale}px`;$('frame-holder').style.height=`${size.height*scale}px`;
 $('size-status').textContent=`CSS ${size.width}×${size.height} · 外壳 ${(scale*100).toFixed(0)}%`;
}
new ResizeObserver(fit).observe($('preview-area'));$('viewport').addEventListener('change',()=>{fit();poll();});
function renderCatalog() {
 const term=$('search').value.trim().toLowerCase(),selected=$('scenario').value;
 $('scenario').replaceChildren();
 for(const item of catalog.filter(c=>`${c.title} ${c.url}`.toLowerCase().includes(term))) {
  const option=new Option(item.title,item.url);$('scenario').append(option);
 }
 if([...$('scenario').options].some(o=>o.value===selected))$('scenario').value=selected;
 $('launch').disabled=!$('scenario').value;
 $('catalog-status').textContent=`${$('scenario').options.length} / ${catalog.length}种入口（含回调变体）；不是完成率。`;
 providerScope();
 for(const button of $('focus').children)button.hidden=!`${button.textContent} ${button.dataset.route}`.toLowerCase().includes(term);
}
function providerScope() {const route=new URL($('scenario').value||'/',location.origin).searchParams.get('qa'),host=usesHostProviderControls(route);$('outcome').disabled=host;$('delay').disabled=host;$('provider-scope').textContent=host?'独立战斗宿主：此处回调控件不生效。请用游戏内自己的provider选择器；右侧只读状态显示实际结果。':'主程序：外壳只设置本地provider回调夹具；无外部服务的动作不受这些控件影响。';}
function cardSelection(route) {
 $('search').value='';renderCatalog();const item=catalog.find(c=>new URL(c.url,location.origin).searchParams.get('qa')===route);
 if(!item){notice('此场景未在同构建选择页中登记，拒绝启动。');return;}
 $('scenario').value=item.url;providerScope();launch();
}
async function refreshBuild() {
 try {const r=await fetch('/debug/build.json',{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);build=await r.json();}
 catch(error){build={status:'NOT_AVAILABLE',reason:String(error)};}
 $('build').textContent=JSON.stringify(build,null,2);
}
function launch() {
 try {
 const url=scenarioURL($('scenario').value,known,$('outcome').value,$('delay').value);
 active={url:new URL(url,location.origin).href,route:new URL(url,location.origin).searchParams.get('qa'),outcome:$('outcome').value,delay:normalizedDelay($('delay').value)};
 if(usesHostProviderControls(active.route)){active.outcome='host-controls';active.delay=null;}
 providerScope();
 const focus=FOCUS.find(f=>f.route===active.route),item=catalog.find(c=>c.url===$('scenario').value);
 $('title').textContent=focus?.title??item?.title??active.route;
 $('steps').textContent=focus?.steps??item?.description??'请点原游戏按钮；以实际消耗、收益、返回与存档效果判断，不以按钮能点判通过。';
 for(const button of $('focus').children)button.setAttribute('aria-pressed',String(button.dataset.route===active.route));
 last=null;before=null;lastText='';ready=false;navigating=true;started=performance.now();disableMutations();
 $('state').textContent='正在准备真实游戏资源…';$('runtime-status').textContent='资源准备中；尚未取得独立档握手';
 $('standalone').href=active.url;$('standalone').hidden=false;$('reset').disabled=false;
 notice('已重建独立夹具。保存失败开关以游戏当前状态为准；回调设置只在重建时应用。');
 frame.src=active.url;fit();void refreshBuild();
 }catch(error){notice(String(error));}
}
function childState() {
 const w=frame.contentWindow;if(!w||!active||navigating)return null;
 const actual=w.location.href;
 if(actual!==active.url)throw Error('游戏地址已变化；停止读取及故障注入，不接触普通档。');
 const presentation=typeof w.__catPresentation==='function'?w.__catPresentation():null;
 if(!isIsolatedChild(active.url,actual,known,presentation)) {
  // Independent combat hosts are read-only here, never receive main-program fixture actions.
  const live=active.route.startsWith('raid-live')?w.__catRaidLiveQA:active.route.startsWith('hunt-live')?w.__catHuntLiveQA:null;
  if(typeof live==='function')return {readOnlyHost:true,route:active.route,live:clone(live()),viewport:{width:w.innerWidth,height:w.innerHeight},proof:'独立白盒宿主；未注入主程序故障。'};
  const error=w.document.getElementById('cat-qa-route-error')?.textContent;
  if(error)throw Error(error);
  return {loading:true,phase:w.__catPhase??'bootstrap',elapsedSeconds:Math.round((performance.now()-started)/1000),documentStatus:w.document.readyState};
 }
 const s=w.__catState?.(), shop=w.__catShopQA?.();
 const result={isolated:true,route:active.route,viewport:{width:w.innerWidth,height:w.innerHeight},mode:s?.mode,overlay:s?.overlay,
  localPanel:presentation.localPanel,transition:presentation.transition,
  wallet:{diamonds:s?.diamonds,petCoin:shop?.petCoin,starGem:s?.starGem},notice:shop?.notice,
  policy:w.__catOfferWallQA?.()?.input?.policy,eco:presentation.ecoMode,audio:presentation.feedback,preferences:presentation.preferences,
  plus:s?.plusPack,proof:'只读状态：不是自动验收通过。'};
 const api=fixtureAPI(active.route),stateAPI=api?.replace('Fixture','QA');
 if(stateAPI&&typeof w[stateAPI]==='function')result.client=clone(w[stateAPI]());
 else if(active.route.startsWith('adventure'))result.system={adventure:presentation.adventure,state:presentation.meta?.adventure,pet:w.__catPetDragQA?.()?.pet};
 else if(active.route.startsWith('pet'))result.system=clone(w.__catPetDragQA?.());
 else if(active.route.startsWith('mine'))result.system={mine:s?.mine};
 else if(active.route==='permanent'||active.route==='rebirth')result.system={rebirthCount:s?.rebirthCount,permanentLevels:s?.permanentLevels,ruby:s?.ruby};
 else if(active.route==='buff-panel')result.system={buffTimes:shop?.buffTimes,buffClaims:shop?.buffClaims};
 else if(active.route.startsWith('raid'))result.system=clone(w.__catRaidQA?.());
 else if(active.route.startsWith('hunt-client'))result.system=clone(w.__catHuntClient?.());
 return clone(result);
}
function poll() {
 if(!active)return;
 try {
 const snapshot=childState();if(!snapshot)return;
 ready=snapshot.isolated===true;disableMutations();
 if(ready) {
  const api=fixtureAPI(active.route),available=api&&typeof frame.contentWindow[api]==='function';
  $('fail-save').disabled=!available;$('allow-save').disabled=!available;$('close-result').disabled=!active.route.startsWith('boss-reward');
 }
 $('runtime-status').textContent=snapshot.loading?`资源准备 · ${snapshot.phase} · ${snapshot.elapsedSeconds}s${snapshot.elapsedSeconds>60?'（较慢，请查看游戏画面／控制台；未宣称启动成功）':''}`:snapshot.readOnlyHost?'独立战斗宿主 · 只读诊断':'独立档握手已确认 · 等你实际验收';
 if(!snapshot.loading&&!before)before=clone(snapshot);
 last=snapshot;const text=JSON.stringify(snapshot,null,2);if(text!==lastText){$('state').textContent=text;lastText=text;}
 }catch(error){ready=false;last=null;disableMutations();$('runtime-status').textContent='诊断不可用 / 已停止注入';$('state').textContent=String(error);}
}
function inject(value) {
 try {
 const snapshot=childState();if(!snapshot?.isolated)throw Error('未确认隔离主程序，拒绝注入');
 const api=fixtureAPI(active.route);if(!api||typeof frame.contentWindow[api]!=='function')throw Error('当前场景没有保存失败注入接口');
 frame.contentWindow[api]('save-failure',value);notice(value?'明示白盒：保存失败已开启。请点击游戏原按钮。':'保存失败已解除；回到游戏点同一按钮重试。未自动发起支付或领奖。');poll();
 }catch(error){notice(String(error));}
}
$('fail-save').addEventListener('click',()=>inject(true));$('allow-save').addEventListener('click',()=>inject(false));
$('close-result').addEventListener('click',()=>{
 try {if(!childState()?.isolated||!active.route.startsWith('boss-reward'))throw Error('未确认首领独立结算，拒绝关闭');frame.contentWindow.__catBossRewardFixture('close');notice('已退出首领结算；可等待旧回调，观察不得补发奖励。');poll();}catch(error){notice(String(error));}
});
$('launch').addEventListener('click',launch);$('reset').addEventListener('click',()=>{
 if(!active)return;
 // Reload EXACT active configuration, not a not-yet-applied selection. Reset discards old in-memory callbacks.
 before=null;last=null;ready=false;navigating=true;disableMutations();started=performance.now();$('runtime-status').textContent='正在重建独立场景…';$('state').textContent='旧快照已失效，等待新场景。';frame.src=active.url;notice('重建当前独立夹具（不是存档恢复）。旧内存回执丢弃；跨刷新回执恢复仍未闭合。');
});
$('search').addEventListener('input',renderCatalog);
$('scenario').addEventListener('change',()=>{providerScope();notice('选择已改变；点击「应用设置并重置场景」后生效，当前游戏未切换。');});
$('record').addEventListener('click',()=>{
 poll();if(!active||!last||last.loading){notice('游戏尚未就绪，不能记录成验收结果。');return;}
 records=boundedRecord(records,{recordedAt:new Date().toISOString(),inputBuild:clone(build),configuration:clone(active),viewport:clone(last.viewport),fixture:'isolated-memory/local-test-provider',before:clone(before),after:clone(last),observation:$('note').value.trim(),verdict:'USER_OBSERVATION_ONLY',proofGates:{originalDevice:'NOT_RUN',automatedGUI:'NOT_RUN',naturalPath:'NOT_RUN'}});
 $('record-status').textContent=`${records.length}条（最多100）；本页内存。请及时导出。`;$('note').value='';notice('已记录实际快照与人工备注；没有自动把本项标为通过。');
});
$('export').addEventListener('click',()=>{
 const payload={schemaVersion:1,exportedAt:new Date().toISOString(),normalSaveIncluded:false,records};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`catgunner-acceptance-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
});
async function init() {
 try {
 const r=await fetch('/qa.html',{cache:'no-store'});if(!r.ok)throw Error(`场景目录HTTP ${r.status}`);
 const doc=new DOMParser().parseFromString(await r.text(),'text/html'),seen=new Set();
 for(const a of doc.querySelectorAll('a[href]')) {
  const u=new URL(a.getAttribute('href'),location.origin);const route=u.searchParams.get('qa');
  if(u.origin!==location.origin||u.pathname!=='/'||!route||seen.has(u.pathname+u.search))continue;
  seen.add(u.pathname+u.search);known.add(route);
  catalog.push({url:u.pathname+u.search,title:[...a.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim()||route,description:a.querySelector('small')?.textContent??''});
 }
 if(!catalog.length)throw Error('目录为空，拒绝回退到普通存档');
 for(const f of FOCUS) {
  if(!known.has(f.route))continue;
  const button=document.createElement('button');button.textContent=f.title;button.dataset.route=f.route;button.addEventListener('click',()=>cardSelection(f.route));$('focus').append(button);
 }
 $('scenario').disabled=false;renderCatalog();
 const initial=catalog.find(c=>c.url==='/?qa=boss-reward-save-failure');if(initial)$('scenario').value=initial.url;
 await refreshBuild();launch();
 }catch(error){$('catalog-status').textContent=`加载失败：${String(error)}；不会加载普通入口。`;notice('场景目录不可用，请刷新本页或检查预览服务。');}
}
frame.addEventListener('load',()=>{try{if(active&&frame.contentWindow.location.href===active.url){navigating=false;poll();}}catch(error){notice(String(error));}});
setInterval(()=>{if(!document.hidden)poll();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
fit();void init();
