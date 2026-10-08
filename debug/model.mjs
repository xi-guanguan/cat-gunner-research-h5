/** Static shell only: actions are guarded by both a known isolated route and the child handshake. */
export const FOCUS = [
  {route:'boss-reward-save-failure', title:'首领奖励 · 保存失败重试', steps:'点原结算「额外奖励」→确认余额未追加→解除保存失败→再点同一按钮。应只追加2×基础奖励一次。此夹具是扫荡结算，不证明实时首领战斗。'},
  {route:'boss-reward', title:'首领奖励 · 回调四态', steps:'点额外奖励；成功仅追加2×，失败/取消/不可用不发奖。延迟时退出结算，旧回调不得补奖。'},
  {route:'boss-reward-plus', title:'首领奖励 · Plus基础值', steps:'基础奖励300已入账；成功追加600，不能重领。重置后独立复验。'},
  {route:'boss-reward-auto', title:'首领奖励 · 自动权益', steps:'基础结算已按权益发奖，额外广告奖励不得再领。'},
  {route:'boss-plus', title:'首领 Plus 原横幅', steps:'点原横幅→本地测试购买→观察七天权益、横幅与余额；可注入保存失败，解除后点原商品重试。'},
  {route:'hunt-plus', title:'狩猎 Plus 原横幅', steps:'点原横幅购买；检查源权益消费者，不能把本地回执说成真实支付。'},
  {route:'boss-plus-locked', title:'Plus · 进度门禁', steps:'历史进度未达190，原购买横幅不应显露；测试直达不等于普通档解除门槛。'},
  {route:'hunt-plus-active', title:'Plus · 已拥有', steps:'已有权益时横幅不应重复购买；检查权益状态而非只看按钮。'},
  {route:'mine', title:'矿场 · 小数HUD', steps:'观察单枚矿石0.1等过程显示→结算；对照显示与实际钻石入账。'},
  {route:'permanent', title:'转生 · 永久强化', steps:'主入口应进入永久强化页；检查三类升级价格/余额/效果→转生确认→永久等级保留。'},
  {route:'buff-panel', title:'左上x3 · 增益', steps:'点击原增益入口→领取→观察倍数、时长和消费者。外部广告只用明示本地provider。'},
  {route:'pass-scroll', title:'通行证 · 连领不跳顶', steps:'滚到中段连续领双轨奖励；原面板位置应保留，重复领取不发奖。'},
  {route:'gun-auto', title:'武器 · 自动与抽取听感', steps:'开背包抽武器、合成/自动操作；开关省电与面板，实际听是否积压/重启。真人听感未自动通过。'},
  {route:'pet-auto', title:'宠物 · 自动合成', steps:'检查空/满/满级/锁组及取消恢复；不得误消费派遣宠物。'},
  {route:'adventure-dispatch', title:'探索 · 派遣与减时', steps:'从原宠物选择派遣→减时→到期领奖；核对扣票、锁组、经验和币种。时钟为明示测试夹具。'},
  {route:'hunt-client', title:'实时狩猎 · 普通宿主', steps:'原按钮进入狩猎→逐弹战斗→胜败/侵入→结算/退出；检查切场音频和时钟。'},
  {route:'raid-live', title:'实时突袭 · 独立宿主', steps:'三枪槽→弱点/计时/得分→结算返回；独立宿主可能无主程序诊断API，不应误报启动失败。'},
];
export function usesHostProviderControls(route) {return /^(raid-live|hunt-live)/.test(route);}
export function normalizedDelay(value) {const n=Number(value);return Number.isFinite(n)?Math.min(5000,Math.max(0,Math.trunc(n))):0;}
export function scenarioURL(base, known, outcome='success', delay=0) {
  const u=new URL(base,'http://debug.invalid');
  if(u.origin!=='http://debug.invalid'||u.pathname!=='/'||u.searchParams.getAll('qa').length!==1||!known.has(u.searchParams.get('qa')))throw Error('拒绝普通入口、未知场景或跨域地址');
  if(!['success','failure','cancelled','unavailable'].includes(outcome))throw Error('未知provider状态');
  if(usesHostProviderControls(u.searchParams.get('qa')))return u.pathname+u.search;
  u.searchParams.set('provider-outcome',outcome);
  // Individual source clients read their own explicit fixture keys. Clamp to the common 5s ceiling.
  for(const prefix of ['reward','activity','shop','pass','gun-ad','pet-ad','auto-ad','adgun','prism','offerwall','freecash'])u.searchParams.set(`${prefix}-provider-delay`,String(normalizedDelay(delay)));
  return u.pathname+u.search;
}
export function isIsolatedChild(expected, actual, known, handshake) {
  try {const a=new URL(actual),e=new URL(expected);return a.origin===e.origin&&a.pathname===e.pathname&&known.has(a.searchParams.get('qa'))&&a.search===e.search&&handshake?.qaFixtureActive===true;}
  catch {return false;}
}
export function fixtureAPI(route) {
  if(route.startsWith('boss-reward'))return '__catBossRewardFixture';
  if(/^(boss-plus|hunt-plus|weekly|plus-|stepup)/.test(route))return '__catActivityPurchaseFixture';
  if(/^(shop|mine-pack|diapig)/.test(route))return '__catShopPurchaseFixture';
  if(route.startsWith('pass-'))return '__catPassFixture';
  if(route.startsWith('auto-ad'))return '__catAutoAdFixture';
  if(route.startsWith('gun-daily'))return '__catGunDailyFixture';
  if(route.startsWith('offerwall'))return '__catOfferWallFixture';
  if(route.startsWith('freecash'))return '__catFreeCashFixture';
  return null;
}
export function viewportSize(value) {return value==='1080x1920'?{width:1080,height:1920}:{width:390,height:844};}
export function boundedRecord(records, record) {return [...records.slice(-99),record];}
