import {SourceOfferWallClient} from './offerwall-client';
import {createOfferWallTestSurface} from './offerwall-test-surface';
import {SOURCE_OFFERWALL,freshSourceOfferWall,sourceOfferWallDebit,sourceOfferWallExposure,createLocalOfferWallProvider} from './r6-offerwall';
import {freshSourceFreeCash,sourceFreeCashExposure,createLocalFreeCashProvider,type FreeCashProvider} from './r6-freecash';
import {SourceFreeCashClient} from './freecash-client';
import {createSourceFreeCashPanel,syncSourceFreeCashPanel} from './source-freecash-panel';
import freeCashScene from './data/r6-freecash-ui.json';
import {syncFreeCashBackground} from './freecash-background';
import {SourcePassClient} from './pass-lifecycle-client';
import {localSourcePassClock,sourcePassProgress} from './r6-pass-lifecycle';
import type {SourcePassPopup} from './pass-popup-projection';
import {bindSourceHuntMovementStats} from './hunt-movement-binding';
import {sourceRelicTotals} from './r6-relic';
import {sourceWeekOffset} from './r6-weekly';
import {SourceRaidClientOwner} from './raid-client-owner';
import {SourceRaidCatClientScene} from './raid-cat-client-scene';
import {SourceRaidSceneView,RAID_SCENE_LIMITATIONS} from './raid-scene-view';
import {sourceRaidHUDCurrency} from './raid-hud-state';
import raidHudData from './data/source-raid-hud.json';
import {createLocalTestNotice} from './local-test-notice';
import {SourceRaidMissionClient} from './raid-mission-client';
import {createSourceRaidMissionPanel,type SourceRaidMissionPanelView} from './source-raid-mission-panel';
import {freshSourceRaidMission,sourceRaidMissionRefresh} from './r6-raid-mission';
import huntHudData from './data/source-hunt-hud.json';
import {SourceHuntClientOwner} from './hunt-client-owner';
import {SourceHuntSceneView,HUNT_SCENE_LIMITATIONS} from './hunt-scene-view';
import {SOURCE_HUNT_MONSTER_COUNTS} from './r5-hunt';
import {freshSourcePrism,sourcePrismGate,sourcePrismReward,SOURCE_PRISM,type SourcePrismRequest} from './r6-prism';
import {runtimeSourceRelic} from './source-meta-runtime';
import {sourceRelicDrawPresentation} from './source-relic-panel';
import {sourceHuntResultReward,type SourceHuntResultRewardRequest} from './r6-hunt-result';
import {sourceResultContext,sourceResultContextMatches} from './r6-result-context';
import {sourceMineResultReward,type SourceMineResultRewardRequest} from './r6-mine-result';
import {resolveSourceQARoute,isSourceQAScenario,createSourceQAStorage,type SourceQAScenario} from './r6-qa';
import {claimChallengeBonus,settleChallengeVictory,sweepChallenge,closeChallengeSweep} from './session';
import {sourceChallengePlusBannerVisible,type SourceChallengeAdRequest} from './r6-challenge';
import {createLocalMineTime,localMineTime} from './mine-time';
import {sourceEntryPlusPurchaseGate} from './r6-entry-plus';
import {sourceMinePlusBannerVisible,sourceMineSpeedEntryGate,sourceMineSpeedEntryReward} from './r6-mine-entry';
import {sourceRewardAdsRemoved} from './r6-shop';
import {syncSourceShopPanel} from './source-shop-panel';
import {freshSourceAdGun,sourceAdGunSlot,sourceAdGunOnLoaded,sourceAdGunCheckEvent,sourceAdGunTick,sourceAdGunWatchGate,sourceAdGunReward,sourceAddAdRewardGun,type SourceAdGunRequest} from './r6-adgun';
import {createSourceWeeklyPanel,type SourceWeeklyPanelView} from './source-weekly-panel';
import {freshSourceWeekly,freshSourcePlus,sourceWeeklyVisible,sourceWeeklyVIPUnlocked,sourceWeeklyDefaultMenu,sourceWeeklyVisit,sourceWeeklyRefresh,sourceWeeklyGun,sourcePlusEntitlements,SOURCE_PLUS_DURATION_MS} from './r6-weekly';
import {createSourceDiaPigPanel,type SourceDiaPigPanelView} from './source-diapig-panel';
import {SourceBossResultRewardClient} from './boss-result-reward-client';
import {SourceActivityPurchaseClient} from './activity-purchase-client';
import {SourceRemoveAdsPurchaseClient} from './remove-ads-purchase-client';
import {freshSourceDiaPig,sourceDiaPigInit,sourceDiaPigAccumulate,sourceDiaPigSeconds,sourceDiaPigCollect,type SourceDiaPigRuntime} from './r6-diapig';
import {createSourceStepUpPanel,type SourceStepUpPanelView} from './source-stepup-panel';
import {freshSourceStepUp,sourceStepUpReload,sourceStepUpVisible,SOURCE_STEPUP} from './r6-stepup';
import {createSourceGunInfoPanel,type SourceGunInfoPanelView} from './source-gun-info-panel';
import {sourceGunDetailRef,sourceGunProtection,sourceGunSafeUnlocked,sourceGunSafeDeposit,sourceGunSafeTakeOut,sourceGunSafePurchase,freshSourceGunSafe,type SourceGunDetailRef} from './r6-gun-storage';
import {createSourceSkinPanel,sourceSkinAssetURLs,type SourceSkinPanelView} from './source-skin-panel';
import {freshSourceSkinState,sourceSkinAction,sourceSkinReason} from './r6-skin';
import {createSourceStarPanel,type SourceStarPanelView} from './source-star-panel';
import {createSourceRaidPanel,sourceRaidAssetURLs,type SourceRaidPanelView} from './source-raid-panel';
import {createSourceRaidStarPigPanel,type SourceRaidStarPigPanelView} from './source-raid-star-pig-panel';
import {freshSourceRaidStarPig,sourceRaidStarPigSeason} from './r6-raid-star-pig';
import {SourceRaidHelperClient} from './raid-helper-client';
import {createSourceRaidHelperPanel,type SourceRaidHelperPanelView} from './source-raid-helper-panel';
import {SourceRaidStarPigClient} from './raid-star-pig-client';
import {sourceRaidSeason,sourceRaidTickets,sourceRaidWeakType,sourceRaidDamage,sourceRaidCandidates,sourceRaidAutoSelect,sourceRaidSelectionRefresh,sourceRaidSelect,sourceRaidEntryGate,type SourceRaidSelection,type SourceRaidGunRef} from './r6-raid';
import {sourceStarUnlocked} from './r6-star';
import {upgradeSessionStar} from './session';
import {createSourceAdventurePanel,freshAdventureNavigation,sourceAdventureAssetURLs,type SourceAdventurePanelView} from './source-adventure-panel';
import {sourceAdventureLocalClock,sourceAdventureDayCheck,sourceAdventureAutoSelect,sourceAdventureAdAble,sourceAdventureAdReward,encodeSourceAdventureState,type SourceAdventureAdRequest} from './r6-adventure';
import {adventureRefreshTickets,adventureIsOpenDay,adventurePetSlotCount,ADVENTURE_UNLOCK_LEVELS} from './r5-adventure';
import {freshSourcePetState,sourcePetCanDispatch,sourcePetWithIdentities} from './r5-pet';
import {createSourcePetInfoPanel} from './source-pet-info-panel';
import {createSourcePetDrawInfoPanel} from './source-pet-draw-info-panel';
import {freshSourcePetAutoState,sourcePetAutoEntryUnlocked} from './r6-pet-auto';
import {sourceTickBuffTimes,sourceClaimBuffReward,SOURCE_BUFF_KINDS} from './r6-buff';
import type {SourceRewardRequest,SourceProviderStatus} from './r6-reward-provider';
import {createSourceLocalRewardProvider} from './r6-reward-ad-policy';
import {SourceGunDailyClient,type SourceGunDailyRequest} from './gun-daily-client';
import {SourceAutoUpgradeAdClient,type SourceAutoUpgradeAdRequest} from './auto-upgrade-ad-client';
import {SourceShopPurchaseClient} from './shop-purchase-client';
import {sourceAutoAdRequestGate} from './r6-auto-upgrade-ad';
import {sourceGunDailyRequestGate} from './r6-gun-daily';
import {SourcePetDailyClient,type SourcePetDailyRequest} from './pet-daily-client';
import {syncSourceBuffPanel} from './source-buff-panel';
import {sourceRewardEntitlements,type SourceBuffKind} from './r5-entitlements';
import { AnimatedSprite, Application, Assets, Container, Graphics, Matrix, NineSlicePlane, Rectangle, RenderTexture, Sprite, Text, TextStyle, Texture, TilingSprite } from "pixi.js";
import "pixi-spine";
import {loadProjectileViewAssets,createProjectileView,createMuzzleView,createImpactView,advanceProjectileView,stopProjectileView,updateProjectileView,type ProjectileView} from "./projectile-view";
import { walletValue, healthValue, type MuzzleResolver, type Point, type State, type UpgradeKind, type ProjectileViewLifecycleEvent } from "./rules";
import { BigValue } from "./big-value";
import { upgradePriceValue, upgradeStatValue } from "./upgrade-tables";
import { createCatRigActor, getCatRigProjectionConfig, loadCatRigAssets, loadCatRigSkinAssets } from "./cat-rig";
import { runtimePolicy } from "./runtime-policy";
import { permanentUpgradeQuote, contentGate, mineHudValue } from "./meta-progression";
import { GUN_INVENTORY_CAPACITY, startBoss, exitBoss, claimBossBonus, sweepBoss, sessionBossPower, applyGunDrop, acknowledgeDefeat, claimVictory, closeOverlay, createSession, createFieldLevel, drawGun, equipGun, exitChallenge, openChallenge, openMine, startMine, exitMine, openGun, purchase, startChallenge, step, unequipGun, openRebirth, openPermanent, confirmRebirth, sessionRebirthReward, purchasePermanent, fuseInventory, sourceGun, serializeSession, deserializeSession, type Gun, type Session } from "./session";
import { FIELD_SPAWN, fieldToWorld } from "./field-space";
import { screenInputToWorld } from "./input";
import forestBorderData from "./data/forest-borders.json";
import mapSkins from "./data/map-skins.json";
import gunSource from "./data/guns.json";
import mapScene from "./data/map-scene.json";
import { getTreePresentation, getTreeHPPresentation, getMapGroundTileProjection, getMapSurfacePresentations, getMapBorderColor, mapColorToPixi, getBossTreePresentation,getBossHP,getChallengeTreePresentation,getChallengeHP,getMineOrePresentation,getMineOreHP,getMineGroundPresentation,getMineGroundTileProjection,getChallengeGroundPresentation,getChallengeGroundTileProjection } from "./map-presentation";
import { createBrowserFeedback, loadBrowserPreferences, type BrowserPreferences } from "./browser-preferences";
import { loadingPose, type SourceLoadingAnimation } from "./loading-animation";
import round2UILayout from "./data/round2-ui-layout.json";
import round3UI from "./data/round3-ui-contract.json";
import { SceneTransition } from "./scene-transition";
import { freshPlatformState, decodePlatformState, LOCAL_PLATFORM_KEY, localPurchaseSimulationEnabled, developerResource, developerShopPurchase, confirmedDeveloperGrant, type GrantResult } from "./local-platform";
import {ACTIVITY_STORAGE_KEY,createActivityState,decodeActivityState,serializeActivityState,claimDaily as claimSourceDaily,observeActivities,claimMission,passView,claimPass,developerActivityExp,ACTIVITY_MISSIONS,type ActivityCounter} from "./source-activities";
import {sourceUiAssetURLs,createSourceUiView,type SourceUiTree,type SourceUiView,type SourceUiViewport} from "./source-ui";
import {createSourceHud} from "./source-hud";
import {localizeSourceText,sourceLocalizationDiagnostics} from "./source-localization";
import {createSourcePanel,syncSourceMissionPanel} from "./source-panel-bindings";
import {gunEntityUID} from "./gun-drag";
import {createSourceBossPanel,sourceBossPanelAssetURLs} from "./source-boss-panel";
import {createSourceBossHud,updateSourceBossHud,sourceBossHudAssetURLs} from "./source-boss-hud";
import {loadSourceBossViewAssets,createSourceBossView} from "./source-boss-view";
import {sourceBossTimeMax} from "./r5-boss";
import {sourceGunSetAutoMerge,sourceGunAutoMergeOnce,type SourceGunAutoCommit} from "./r5-gun-auto";
import {createSourcePetPanel,sourcePetPanelAssetURLs,type SourcePetPanelView} from "./source-pet-panel";
import {sourcePetDailyUnlocked} from "./r5-pet";
import {createSourceHuntPanel,sourceHuntPanelAssetURLs} from "./source-hunt-panel";
import {createSourceGunPanel,type SourceGunPanelView} from "./source-gun-panel";
import {freshSourceMetaState,decodeSourceMetaState,serializeSourceMetaState,developerSourceMetaPass,developerSourceMetaEntitlement,developerSourceAdDailyGunServer,runtimeSourceMineSweep,developerSourceMineSweepBonus,closeSourceMineSweep,runtimeSourcePassClaim,runtimeSourceMissionClaim,runtimeSourceAutoUpgrade,runtimeSourceAutoUpgradeSet,runtimeSourceAutoUpgradeTick,developerSourcePackagePurchase,runtimeSourcePetAction,sourcePetLocalDate,runtimeSourceHuntPower,runtimeSourceHuntAction,runtimeSourceAdventure,runtimeSourceFishDraw,runtimeSourceFishFusion,runtimeSourceFishAutoMergeSet,runtimeSourceFishAutoMergeOnce,type SourceMetaRuntimeResult} from "./source-meta-runtime";
import {createLocalDevelopmentR5PlatformProvider,createUnavailableR5PlatformProvider,type R5PlatformAction,type R5PlatformRequest,type R5PlatformResult} from "./r5-platform-provider";
import {createSourceRedeemInputOverlay,type SourceRedeemInputOverlay} from "./source-redeem-input";
import {createSourceNewGunPopup} from "./source-newgun-popup";
import {installFrameClock} from "./frame-clock";
import "./style.css";
import {assetLoadPercent,setBootProgress} from "./loading-progress";

const qaRoute=resolveSourceQARoute(location.search);
let qaFixtureActive=qaRoute.isolated;
const gameStorage=createSourceQAStorage(localStorage,qaRoute.isolated);
const W = 540;
let H = W * Math.max(1920 / 1080, innerHeight / innerWidth);
let reflowScene:(()=>void)|undefined;
const textureUrl = (id: string) => `/assets/generated/texture2d/sharedassets0.assets__${id}.png`;
type Vec3 = { x: number; y: number; z: number };
const cameraRotation = { x: 0.27984518, y: -0.36470559, z: 0.11591566, w: 0.88047725 };
const groundRotation = { x: 0.6532815, y: -0.2705981, z: 0.2705981, w: 0.6532815 };
function rotate(q: typeof cameraRotation, v: Vec3): Vec3 {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + q.y * tz - q.z * ty,
    y: v.y + q.w * ty + q.z * tx - q.x * tz,
    z: v.z + q.w * tz + q.x * ty - q.y * tx };
}
function fieldWorld(point: Point): Vec3 {
  return { ...fieldToWorld(point), y: 0 };
}
function challengeWorld(point: Point): Vec3 {
  return { x: -100 + (point.x - 4.5) * 12, y: 0, z: (point.y - 8) * 6 };
}
function projectWorld(world: Vec3, catWorld: Vec3): Point {
  const camera = { x: catWorld.x + 73.5, y: catWorld.y + 72.11, z: catWorld.z - 73.4 };
  const local = rotate({ x: -cameraRotation.x, y: -cameraRotation.y,
    z: -cameraRotation.z, w: cameraRotation.w },
  { x: world.x - camera.x, y: world.y - camera.y, z: world.z - camera.z });
  return { x: W / 2 + local.x * 15, y: H / 2 - local.y * 15 };
}
function projectField(point: Point, player: Point): Point {
  return projectWorld(fieldWorld(point), fieldWorld(player));
}
function screenPoint(point: Point, battle: State, inChallenge: boolean): Point {
  return projectWorld(actorWorld(point,inChallenge),actorWorld(battle.player,inChallenge));
}
const url = (id: string) => `/assets/generated/sprite/sharedassets0.assets__${id}.png`;
const paths = {
  ground: url("00000755__0"), sand: url("00000497__1"), borderUp: url("00000870__0"),
  borderDown: url("00000727__0_e"), sandBorderUp: url("00000645__1"),
  sandBorderDown: url("00000444__1_1"), boss: url("00000720__3"),
  tree: url("00000894__1"), pine: url("00000826__0"), cherry: url("00000779__2"),
  palmCoconut: url("00000449__6"), palmPlain: url("00000662__5"), palmShort: url("00000420__4"),
  money: url("00000372__currency_dia_0"), diamond: url("00000901__currency_dia_1"),
  catIcon: url("00000821__Cat_icon"), winCat: url("00000696__Cat_Win"), failCat: url("00000846__Cat_Fail"),
  winRibbon: url("00000410__Title_Ribbon_Bg_Green"), failRibbon: url("00000661__Title_Ribbon_Bg_Green_1"),
  diaPig: url("00000728__Icon_DiaPig"), adIcon: url("00000882__Icon_ImageIcon_Ad_00_s_2"),
  adBanner: url("00000575__Panel_0"), adChest: url("00000745__replicate-prediction-rtckr502dhrmr0cwjen8d52vh4"),
  adPlus: url("00000816__Icon_Plus"),
  gun: url("00000844__0"), gun1: url("00000641__1"), gun2: url("00000734__2"),
  gun3: url("00000820__3"), gun4: url("00000512__4"),
  tutorialHand: url("00000796__Hand"), gunIcon: url("00000428__Icon_Gun"), setting: url("00000510__Setting"), close: url("00000750__Icon_CloseBtn"),
  timer: url("00000493__Icon_timer"),
  modalPanel: url("00000478__ui_2"), rewardPanel: url("00000884__ui_1_White_"),
  pawPattern: "/assets/generated/texture2d/sharedassets0.assets__00000112__Cat_Foot.png",
  power: url("00000907__Currency_2_1"), speed: url("00000383__Currency_2_2"),
  card: url("00000509__ui_1"), cardOutline: url("00000546__ui_1_Outline_"),
  price: url("00000891__ui_0"), moneyUpgrade: url("00000927__Currency_2_0"),
  play: url("00000808__Icon_ImageIcon_Knife_Battle"), target: url("00000642__target"),
  bulletFx: textureUrl("00000097__circle"), muzzleFx: textureUrl("00000128__magic_line"),
  muzzleGlow: textureUrl("00000131__glow1"), cashFx: textureUrl("00000136__Fx_Cash"),
  bossSparkle: textureUrl("00000130__sparkle3")
};

const app = new Application({ width: W, height: H, backgroundColor: 0xdce09a,
  resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true, antialias: true });
const canvas = app.view as HTMLCanvasElement;
const host = document.getElementById("game");
if (!host) throw new Error("Missing game mount");
host.appendChild(canvas);
function resize() {
  const height=W*Math.max(1920/1080,innerHeight/innerWidth);
  if(Math.abs(height-H)>.01){H=height;app.renderer.resize(W,H);reflowScene?.();}
  const scale = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
}
addEventListener("resize", resize);
resize();

setBootProgress(5,'加载字体中…');
await Promise.all([document.fonts.load('18px "MPLUS Rounded"'), document.fonts.load('700 20px "CatGunnerSC"')]);
setBootProgress(10,'加载游戏素材中…');
const loadState = window as Window & { __catPhase?: string };
loadState.__catPhase = "sprites";
const settingsAssets = {
  music:"/assets/round2-ui/sprite-415-icon_bgm.png",
  sound:"/assets/round2-ui/sprite-890-icon_sound.png",
  vibration:"/assets/round2-ui/sprite-655-phone-vibration.png",
  panel:"/assets/round2-ui/sprite-478-ui 2.png",
  button:"/assets/round2-ui/sprite-658-ui 1 (Small.png"
};
interface SourceUIImage {spritePathID:number;url?:string;slice:{left:number;right:number;top:number;bottom:number};sourceSize:{x:number;y:number};color:number[]}
const sourceUIImages=new Map<number,SourceUIImage>();
const round3AssetURLs=new Set<string>();
function indexSourceUI(value:unknown) {
  if(!value||typeof value!=="object")return;
  const image=value as SourceUIImage;
  if(image.url&&image.url.startsWith("/assets/"))round3AssetURLs.add(image.url);
  if(image.url&&image.slice&&image.sourceSize&&!sourceUIImages.has(image.spritePathID))sourceUIImages.set(image.spritePathID,image);
  for(const child of Object.values(value))indexSourceUI(child);
}
indexSourceUI(round3UI);
const loaded = await Assets.load([...sourceRaidAssetURLs,...sourceSkinAssetURLs,...sourceAdventureAssetURLs,...sourceHuntPanelAssetURLs,...sourcePetPanelAssetURLs,...sourceBossHudAssetURLs,...sourceBossPanelAssetURLs,...sourceUiAssetURLs,...round3AssetURLs,...new Set(round2UILayout.loading.nodes.map(n=>n.spriteURL).filter((url): url is string=>Boolean(url))), ...Object.values(round3UI.entries).map(entry=>entry.url), ...Object.values(settingsAssets), ...Object.values(paths), ...Object.values(mapSkins.sprites).map(s=>s.url), ...gunSource.guns.map(g=>g.spriteURL), ...Object.values(mapScene.extraSprites).map(s=>s.url), ...mapScene.mine.oreURLs], ratio => setBootProgress(assetLoadPercent(ratio),'加载游戏素材中…'));
setBootProgress(80,'整理素材中…');
const skinMeta=(id:number)=>mapSkins.sprites[String(id) as keyof typeof mapSkins.sprites];
const skinURL=(id:number)=>skinMeta(id).url;
const gunTexture = (gun: Gun): Texture => loaded[gunSource.guns[weaponIndex(gun.id)]?.spriteURL ?? paths.gun];
const cashCell = 128 / 3;
const cashFrames = Array.from({ length: 9 }, (_, index) => new Texture(loaded[paths.cashFx].baseTexture,
  new Rectangle((index % 3) * cashCell, Math.floor(index / 3) * cashCell, cashCell, cashCell)));
loadState.__catPhase = "frames";
const loadingAnimation:SourceLoadingAnimation=await (await fetch("/assets/round2-ui/loading-animation.json")).json();
setBootProgress(83,'加载角色模型中…');
const rigAssets = await loadCatRigAssets();
setBootProgress(88,'加载角色皮肤中…');
const rigSkinAssets = await loadCatRigSkinAssets();
loadState.__catPhase = "projectiles";
setBootProgress(91,'准备战斗效果中…');
await loadProjectileViewAssets();
setBootProgress(94,'准备战斗场景中…');
const bossAssets=await loadSourceBossViewAssets();
loadState.__catPhase = "scene";
setBootProgress(96,'进入战场中…');
const world = new Container(), hud = new Container(), modal = new Container();
// Retired prototype HUD: keep its diagnostic state, never its rendering/input.
// Menus, currencies and upgrade cards are owned by createSourceHud instead.
hud.visible=false;
hud.eventMode="none";
const loadingLayer = new Container();
const freeCashLayer=new Container();
// Opaque service page owns the entire hit surface, including blank margins.
freeCashLayer.eventMode="static";
freeCashLayer.hitArea=new Rectangle(0,0,W,H);
const huntWorldLayer=new Container(),huntHudLayer=new Container(),raidWorldLayer=new Container(),raidHudLayer=new Container();
app.stage.addChild(world,huntWorldLayer,raidWorldLayer,huntHudLayer,raidHudLayer,modal,freeCashLayer,loadingLayer);
const transition = new SceneTransition();
const loadingBackdrop=new Graphics().beginFill(0xe0d39b).drawRect(0,0,W,H).endFill();
loadingLayer.addChild(loadingBackdrop);
const loadingCat = new Container();
loadingCat.position.set(W/2,H/2);loadingCat.scale.set(W/980);
loadingLayer.addChild(loadingCat);
const loadingNodes = new Map<string,{view:Container;size:number[];pivot:number[];anchorBase?:number[]}>();
loadingNodes.set("/Loading_UI/Background",{view:loadingCat,size:[980,H/(W/980)],pivot:[.5,.5]});
for(const node of round2UILayout.loading.nodes) {
  if(!node.path.startsWith("/Loading_UI/Background/Cat")) continue;
  const parent=loadingNodes.get(node.parentPath!); if(!parent) continue;
  const r=node.rect!, width=r.sizeDelta[0]+(r.anchorMax[0]-r.anchorMin[0])*parent.size[0],
    height=r.sizeDelta[1]+(r.anchorMax[1]-r.anchorMin[1])*parent.size[1];
  const view=new Container();
  view.position.set(((r.anchorMin[0]+r.anchorMax[0])/2-parent.pivot[0])*parent.size[0]+r.anchoredPosition[0],
    -(((r.anchorMin[1]+r.anchorMax[1])/2-parent.pivot[1])*parent.size[1]+r.anchoredPosition[1]));
  const q=node.localRotation;
  view.scale.set(node.localScale[0]*(Math.abs(q[1])>.99?-1:1),node.localScale[1]);
  view.rotation=-Math.atan2(2*(q[3]*q[2]+q[0]*q[1]),1-2*(q[0]*q[0]+q[2]*q[2]));
  if(node.spriteURL) {
    const sprite=new Sprite(loaded[node.spriteURL]);sprite.anchor.set(r.pivot[0],1-r.pivot[1]);
    sprite.width=width;sprite.height=height;
    sprite.tint=(Math.round(node.color![0]*255)<<16)|(Math.round(node.color![1]*255)<<8)|Math.round(node.color![2]*255);
    sprite.alpha=node.color![3];view.addChild(sprite);
  }
  parent.view.addChild(view);loadingNodes.set(node.path,{view,size:[width,height],pivot:r.pivot,
    anchorBase:[view.x-r.anchoredPosition[0],view.y+r.anchoredPosition[1]]});
}
const loadingTextNode=loadingNodes.get("/Loading_UI/Background/Cat/Loading_Txt");
if(loadingTextNode) {
  const text=label("猫咪移动中…",50,0,0,0xffffff);text.style.strokeThickness=0;text.style.fontWeight="400";
  loadingTextNode.view.addChild(text);
}
function updateLoadingAnimation(elapsed=transition.elapsed) {
  for(const [path,properties] of loadingPose(loadingAnimation,elapsed)) {
    const node=loadingNodes.get(path);if(!node)continue;
    if(properties.rotationEulerDegrees)node.view.rotation=-properties.rotationEulerDegrees[2]*Math.PI/180;
    if(properties.localScale)node.view.scale.set(properties.localScale[0],properties.localScale[1]);
    if(properties.anchoredPositionX)node.view.x=(node.anchorBase?.[0]??0)+properties.anchoredPositionX[0];
    if(properties.anchoredPositionY)node.view.y=(node.anchorBase?.[1]??0)-properties.anchoredPositionY[0];
  }
}
loadingLayer.visible = false;
loadingLayer.eventMode = "static";
loadingLayer.hitArea = new Rectangle(0, 0, W, H);
function transitionScene(kind: "enter" | "exit", action: () => void) {
  if (transition.start(kind, () => { action(); if(kind === "enter") feedback.playEnter(); clearFleetingEffects(); saveProgress(); update(); })) {
    resetMovementInput(); update();
  }
}

/** Prepare once so rejected entries show their notice without a fake loading sequence. */
function enterScene(create: () => Session) {
  if (transition.active) return;
  const next = create();
  if (next.mode === session.mode) { session = next; update(); return; }
  transitionScene("enter", () => { session = next; });
}

function label(value: string, size: number, x: number, y: number, fill = 0xffffff) {
  value=localizeSourceText(value,"main-label");
  const result = new Text(value, new TextStyle({ fontFamily: /[\u3400-\u9fff]/.test(value) ? '"CatGunnerSC", "PingFang SC", "Microsoft YaHei", sans-serif' : '"MPLUS Rounded", "CatGunnerSC", sans-serif',
    fontWeight: /[\u3400-\u9fff]/.test(value) ? "700" : "400", fontSize: size, fill, stroke: 0x65442b, strokeThickness: size<=16?Math.max(1,size*.12):Math.max(3,size/5),
    lineJoin: "round", align: "center" }));
  result.anchor.set(0.5);
  result.position.set(x, y);
  return result;
}
function settingLabel(value:string,size:number,x:number,y:number) {
  const text=label(value,size,x,y,0x674724);
  text.style.strokeThickness=0;
  return text;
}
function box(x: number, y: number, w: number, h: number, fill: number, radius = 0) {
  return new Graphics().lineStyle(4, 0x65442b).beginFill(fill).drawRoundedRect(x, y, w, h, radius).endFill();
}
function picture(texture: Texture, x: number, y: number, w: number, h = w) {
  const result = new Sprite(texture);
  result.anchor.set(0.5);
  result.position.set(x, y);
  result.width = w;
  result.height = h;
  return result;
}
function sourceSurface(id:number,x:number,y:number,w:number,h:number,tint=0xffffff,sourceHeight=150) {
  const image=sourceUIImages.get(id);
  if(!image?.url)return box(x,y,w,h,tint,12);
  const b=image.slice,scale=Math.min(h/sourceHeight,w/Math.max(1,b.left+b.right),h/Math.max(1,b.top+b.bottom));
  const art=new NineSlicePlane(loaded[image.url],b.left,b.top,b.right,b.bottom);
  art.width=w/scale;art.height=h/scale;art.scale.set(scale);art.position.set(x,y);art.tint=tint;return art;
}
function control(name: string, x: number, y: number, w: number, h: number, color: number, press: () => void) {
  const result = new Container();
  result.position.set(x, y);
  result.addChild(sourceSurface(658,-w/2,-h/2,w,h,color), label(name, 21, 0, 0));
  result.eventMode = "static";
  result.cursor = "pointer";
  result.on("pointertap", press);
  return result;
}
function iconControl(name: string, icon: Texture, x: number, y: number, w: number, h: number, color: number, press: () => void) {
  const result = control(name, x, y, w, h, color, press);
  const entryKey=({"商店":"shop","转生":"rebirth","矿场":"mine","挑战":"challenge"} as const)[name as "商店"|"转生"|"矿场"|"挑战"];
  if(entryKey){
    const bg=round3UI.entries[entryKey].background,c=bg.color;
    result.removeChildAt(0).destroy();
    result.addChildAt(sourceSurface(bg.spritePathID,-w/2,-h/2,w,h,(Math.round(c[0]*255)<<16)|(Math.round(c[1]*255)<<8)|Math.round(c[2]*255),120),0);
  }
  const text = result.children[1] as Text;
  text.style.fontSize = 16;
  text.y = h / 2 - 14;
  result.addChildAt(picture(icon, 0, -9, name === "Play" ? 38 : 31, name === "Play" ? 34 : 24), 1);
  return result;
}
function closeControl(x: number, y: number, press: () => void) {
  const result = new Container();
  result.position.set(x, y);
  const art = picture(loaded[paths.close], 0, 0, 52);
  const clip = new Graphics().beginFill(0xffffff).drawCircle(0, 0, 26).endFill();
  art.mask = clip;
  result.addChild(art, clip);
  result.eventMode = "static";
  result.cursor = "pointer";
  result.on("pointertap", press);
  return result;
}
function settlementArt(won: boolean) {
  const panelY = won ? 457 : 470;
  const panel = box(26, panelY, 488, won ? 343 : 330, won ? 0xffe575 : 0xece8df, 25);
  const arch = box(170, 302, 200, 177, won ? 0xffb30c : 0x9b9892, 77);
  const reward = new NineSlicePlane(loaded[paths.rewardPanel], 30, 36, 30, 34);
  reward.position.set(71, won ? 543 : 545);
  reward.width = 398;
  reward.height = 126;
  reward.tint = won ? 0xf1d153 : 0xd4c9b2;
  const ribbon = picture(loaded[won ? paths.winRibbon : paths.failRibbon], 270, won ? 457 : 470, 343, 85);
  const actor = picture(loaded[won ? paths.winCat : paths.failCat], 270, 366, 179, 177);
  const price = box(354, 970, 99, 43, 0x6fea27, 15);
  modal.addChild(arch, panel, reward, actor, ribbon,
    label(won ? "VICTORY" : "Fail..", 35, 270, won ? 455 : 467, won ? 0xffec63 : 0xffffff),
    label("Reward", 20, 270, won ? 538 : 550),
    picture(loaded[paths.diamond], 270, 602, 50), label(won ? "30" : "0", 22, 270, 634),
    picture(loaded[paths.adBanner], 270, 981, 405, 100),
    picture(loaded[paths.adChest], 127, 981, 88), picture(loaded[paths.adPlus], 186, 983, 33),
    picture(loaded[paths.diaPig], 240, 978, 64),
    label("+", 17, 195, 1012), picture(loaded[paths.diamond], 212, 1012, 17), label("1/min", 14, 246, 1012),
    label("Remove All Ads", 17, 371, 949), price, label("$9.99", 18, 404, 991));
}

const exterior = new Graphics().beginFill(0x3a2a17).drawRect(0, 0, W, H).endFill();
const ground = new TilingSprite(loaded[paths.ground], W, H);
ground.tileScale.set(0.5);
const challengeGroundMask = new Graphics();
world.addChild(exterior, ground, challengeGroundMask);
const fieldBorderExterior = new Graphics();
const nearExteriorGrass = new Graphics();
world.addChild(fieldBorderExterior, nearExteriorGrass);
const fieldBorders = new Container();
world.addChild(fieldBorders);
const borders = forestBorderData.borders.map(border => {
  const image = new Sprite(loaded[border.sprite === 870 ? paths.borderUp : paths.borderDown]);
  const geometry = (meta: ReturnType<typeof skinMeta>) => {
    const corner = (pixelX: number, pixelY: number): Vec3 => {
      const local = rotate({ x: border.rotation[0], y: border.rotation[1], z: border.rotation[2], w: border.rotation[3] }, {
        x: (pixelX + meta.textureRectOffset[0] - meta.pivot[0] * meta.rect[0]) / meta.pixelsPerUnit * border.scale[0],
        y: (meta.texturePixels[1] - pixelY + meta.textureRectOffset[1] - meta.pivot[1] * meta.rect[1]) / meta.pixelsPerUnit * border.scale[1],
        z: 0
      });
      return { x: border.position[0] + local.x, y: border.position[1] + local.y, z: border.position[2] + local.z };
    };
    const outline = meta.physicsShape.map(([x, y]) => {
      const local = rotate({ x: border.rotation[0], y: border.rotation[1], z: border.rotation[2], w: border.rotation[3] },
        { x: x * border.scale[0], y: y * border.scale[1], z: 0 });
      return { x: border.position[0] + local.x, y: border.position[1] + local.y, z: border.position[2] + local.z };
    });
    return { corners: [corner(0, 0), corner(meta.texturePixels[0], 0), corner(0, meta.texturePixels[1])],
      outline, size: meta.texturePixels };
  };
  fieldBorders.addChild(image);
  return { image, sprite: border.sprite,
    themes: mapSkins.ground.map((_id,index)=>geometry(skinMeta((border.sprite===870 ? mapSkins.up : mapSkins.down)[index]))) };
});
function fillBorderExterior(catWorld: Vec3, theme: number) {
  fieldBorderExterior.clear(); nearExteriorGrass.clear();
  const surfaces=getMapSurfacePresentations(theme);
  for (const [graphics,list] of [[fieldBorderExterior,surfaces.far],[nearExteriorGrass,surfaces.near]] as const) {
    for (const surface of list) {
      const corners=surface.corners.map(p=>projectWorld(p,catWorld));
      graphics.beginFill(surface.tintRGB,surface.alpha).moveTo(corners[0].x,corners[0].y)
        .lineTo(corners[1].x,corners[1].y).lineTo(corners[3].x,corners[3].y)
        .lineTo(corners[2].x,corners[2].y).closePath().endFill();
    }
  }
}
function applyWorldSprite(sprite:Sprite, geometry:{corners:Vec3[];textureSize:{width:number;height:number}},
  cameraRoot:Vec3, parentOrigin:Point={x:0,y:0}, fraction=1) {
  const [tl,tr,bl]=geometry.corners.map(p=>projectWorld(p,cameraRoot));
  sprite.anchor.set(0);
  sprite.transform.setFromMatrix(new Matrix(
    (tr.x-tl.x)/geometry.textureSize.width*fraction,(tr.y-tl.y)/geometry.textureSize.width*fraction,
    (bl.x-tl.x)/geometry.textureSize.height,(bl.y-tl.y)/geometry.textureSize.height,
    tl.x-parentOrigin.x,tl.y-parentOrigin.y));
}
const scenery = new Container();
const sceneryLayout = [
  [-5, 300, 150, 155], [108, 282, 120, 180], [285, 290, 145, 170],
  [380, 275, 150, 165], [510, 255, 130, 155], [42, 450, 110, 185],
  [145, 345, 145, 165], [380, 365, 115, 175], [455, 425, 135, 160]
] as const;
const scenerySkins = [paths.cherry, paths.pine, paths.tree, paths.tree, paths.tree,
  paths.pine, paths.tree, paths.pine, paths.tree];
const sceneryTrees = sceneryLayout.map(([x, y, width, height], index) => {
  const sprite = picture(loaded[scenerySkins[index]], x, y, width, height);
  sprite.anchor.set(0.5, 1);
  scenery.addChild(sprite);
  return sprite;
});
world.addChild(scenery);
const actors = new Container();
actors.sortableChildren = true;
world.addChild(actors);
let bossCameraWorld={x:-100,y:0,z:0};
const bossView=createSourceBossView(bossAssets,{projectWorld:world=>projectWorld(world,bossCameraWorld),parent:actors,backgroundParent:world});
world.setChildIndex(bossView.backgroundView,world.getChildIndex(actors));
bossView.view.visible=bossView.backgroundView.visible=false;
const treeSprites: { group: Container; body: Sprite; bar: Graphics; hpBack:Sprite; hpFill:Sprite; sparkles: Sprite[] }[] = [];
function ensureTreeSprites(count: number) {
  while (treeSprites.length < count) {
  const group = new Container();
  const body = picture(loaded[paths.tree], 0, 0, 130, 154);
  const bar = new Graphics();
  const hpBack=new Sprite(),hpFill=new Sprite();
  group.addChild(body,bar,hpBack,hpFill);
  actors.addChild(group);
    treeSprites.push({ group, body, bar, hpBack, hpFill, sparkles: [] });
  }
}
const cameraForward = rotate(cameraRotation, {x:0,y:0,z:1});
const catRigs = Array.from({length:3}, () => createCatRigActor(rigAssets, {
  pixelsPerUnit:rigAssets.manifest.source.unityRootScale * 15,
  originSource:{x:0,y:0}
}));
const catShadows = catRigs.map(rig => {
  const shadow = new Graphics().beginFill(0x284321,0.23).drawEllipse(0,0,24,7).endFill();
  actors.addChild(shadow,rig.view);
  return shadow;
});
const cat = catRigs[0].view;
function weaponIndex(id: string | undefined) { return Number(id?.match(/^source-gun-(\d+)$/)?.[1] ?? 0); }
/** A sweep retains the field battle behind its result panel. */
function usesChallengeProjection(){return session.mode!=="field"&&!(session.mode==="boss-result"&&!session.bossMotion);}
function isMineMode() { return session.mode === "mine" || session.mode === "mine-result"; }
function actorWorld(point:Point, inChallenge:boolean):Vec3 {
  if(isMineMode())return {x:point.x,y:0,z:point.y};
  return inChallenge ? challengeWorld(point) : fieldWorld(point);
}
function pointFromWorld(world:Vec3, inChallenge:boolean):Point {
  if(isMineMode())return {x:world.x,y:world.z};
  return inChallenge ? {x:4.5+(world.x+100)/12,y:8+world.z/6} :
    {x:(world.x+125)/(50/9),y:16.3+world.z/(60/16)};
}
function positionRig(slot:number, battle:State, inChallenge:boolean, dtSeconds=0, uploadGeometry=true) {
  const actor=battle.actors?.find(a=>a.id===slot), rig=catRigs[slot];
  if (!actor || !rig) return;
  const root=actorWorld(actor.position,inChallenge), cameraRoot=actorWorld(battle.player,inChallenge);
  const camera={forward:cameraForward};
  const config=getCatRigProjectionConfig(rigAssets.manifest,root,camera,15);
  const location=projectWorld(config.originWorld,cameraRoot),m=config.viewMatrix;
  rig.view.transform.setFromMatrix(new Matrix(m.a,m.b,m.c,m.d,location.x,location.y));
  const target=battle.targets.find(t=>t.id===actor.aimTargetId && t.health>0);
  const targetWorld=target ? actorWorld(target.position,inChallenge) : null;
  rig.update({dtSeconds,uploadGeometry,moving:Math.hypot(actor.velocity.x,actor.velocity.y)>.02,
    rootWorld:root,camera,aimWorld:targetWorld ? {...targetWorld,y:2} : null,targetWorld,
    movementWorld:{x:actor.velocity.x,y:0,z:actor.velocity.y},
    weaponId:weaponIndex(session.equippedGuns[slot]?.id)});
  const feet=projectWorld(root,cameraRoot);
  rig.view.zIndex=feet.y; catShadows[slot].position.set(feet.x,feet.y);
  catShadows[slot].zIndex=feet.y-1;
}
const resolveMuzzle:MuzzleResolver=(actor,weapon,battle)=>{
  const inChallenge=usesChallengeProjection();
  positionRig(actor.id,battle,inChallenge,0,false);
  const rig=catRigs[actor.id];

  const muzzle=rig.getShootWorld(actorWorld(actor.position,inChallenge),cameraForward);
  return {position:pointFromWorld(muzzle,inChallenge),height:muzzle.y};
};
function aimingTarget(battle:State) {
  return battle.targets.find(t=>t.id===battle.actors?.[0]?.aimTargetId && t.health>0);
}
const projectiles = new Container(), effects = new Container();
// Keep readable H5 numeric feedback above source particle geometry.
effects.sortableChildren = true;
world.addChild(projectiles, effects);
const projectileViews=new Map<number,ProjectileView>();
const projectileAnchors=new Map<number,{world:Vec3;spawnTime:number;age:number;stopped:boolean}>();
const muzzleViews:{view:ProjectileView;actorId:number;age:number}[]=[];
function consumeProjectileLifecycle(event:ProjectileViewLifecycleEvent) {
  const inChallenge=usesChallengeProjection(),anchor={...actorWorld(event.position,inChallenge),y:event.height};
  const age=Math.max(0,event.time-event.spawnTime);
  let view=projectileViews.get(event.projectileId);
  if(event.type==="projectileBorn") {
    if(view)return;
    const wx=event.velocity.x*session.battle.worldUnitsPerPoint.x,wz=event.velocity.y*session.battle.worldUnitsPerPoint.y;
    const yaw=Math.atan2(wx,wz);
    view=createProjectileView(weaponIndex(event.weaponId),0,15,{seed:event.projectileId,rootWorldPosition:anchor,
      cameraRotation:[cameraRotation.x,cameraRotation.y,cameraRotation.z,cameraRotation.w],
      rootRotation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],velocityWorldPerSecond:Math.hypot(wx,wz)});
    projectileViews.set(event.projectileId,view);projectiles.addChild(view);
  }
  if(!view)return; // Resumed saves may contain an already-live projectile without its birth.
  const previous=projectileAnchors.get(event.projectileId);
  const nextAge=Math.max(age,previous?.age??0);
  if(event.type==="projectileStopped")stopProjectileView(view,nextAge,15,anchor);
  else advanceProjectileView(view,{ageSeconds:nextAge,rootWorldPosition:anchor},15);
  projectileAnchors.set(event.projectileId,{world:anchor,spawnTime:event.spawnTime,age:nextAge,stopped:event.type==="projectileStopped"});
}
function advanceRetiredParticles(dt:number) {
  for(const [id,anchor] of projectileAnchors)if(anchor.stopped){
    const view=projectileViews.get(id);if(!view)continue;
    anchor.age+=dt;advanceProjectileView(view,{ageSeconds:anchor.age,rootWorldPosition:anchor.world,emitting:false},15);
    if(view.presentation.completed){view.parent?.removeChild(view);view.destroy({children:true});projectileViews.delete(id);projectileAnchors.delete(id);}
  }
  for(let i=muzzleViews.length-1;i>=0;i--){
    const item=muzzleViews[i],rig=catRigs[item.actorId];item.age+=dt;
    advanceProjectileView(item.view,{ageSeconds:item.age,...rig.getMuzzleEmissionTransform()},15);
    if(item.view.presentation.completed){item.view.parent?.removeChild(item.view);item.view.destroy({children:true});muzzleViews.splice(i,1);}
  }
}
const reticle = picture(loaded[paths.target], 0, 0, 53);
world.addChild(reticle);
type Fleeting = { node: Container; time: number; speed: number; drift: number; spin: number; worldAnchor?:Vec3; offset?:Point; adapterAge?:number; adapterView?:ProjectileView };
const fleeting: Fleeting[] = [];
const recentShotChecks: {actorId:number;time:number;screenError:number}[]=[];
function flash(node: Container, time = 0.9, speed = -28, drift = 0, spin = 0, worldAnchor?:Vec3) {
  if (node instanceof Text) node.zIndex = 1;
  effects.addChild(node);
  const p=worldAnchor ? projectWorld(worldAnchor,actorWorld(session.battle.player,usesChallengeProjection())) : undefined;
  fleeting.push({ node, time, speed, drift, spin, worldAnchor, offset:p ? {x:node.x-p.x,y:node.y-p.y} : undefined });
}
function clearFleetingEffects() {
  for(const view of projectileViews.values()){view.parent?.removeChild(view);view.destroy({children:true});}
  projectileViews.clear();projectileAnchors.clear();
  for(const item of muzzleViews){item.view.parent?.removeChild(item.view);item.view.destroy({children:true});}muzzleViews.length=0;
  for (const item of fleeting) {
    item.node.parent?.removeChild(item.node);
    item.node.destroy({ children: true });
  }
  fleeting.length = 0;
}
function consumeEvents() {
  const events=session.events;
  session.events=[]; // A paused simulation must not replay the previous step’s events.
  for (const event of events) {
    if(!currentRuntimePolicy().worldPresentation&&["hit","death","currencyCollected","shot","projectileBorn","projectilePath","projectileStopped","projectileImpact"].includes(event.type))continue;
    if (event.type === "hit") {
      const target = treeSprites[event.id - 1];
      if (!target) continue;
      const entity=session.battle.targets.find(t=>t.id===event.id);
      const anchor=entity ? actorWorld(entity.position,usesChallengeProjection()) : undefined;
      const p=anchor ? projectWorld(anchor,actorWorld(session.battle.player,usesChallengeProjection())) : target.group.position;
      const damage = label(event.damageValue?.format() ?? String(Math.ceil(event.damage)), 20, p.x + 27, p.y - 56);
      flash(damage, 0.75, -40,0,0,anchor);
    } else if (event.type === "death") {
      if(isMineMode()) {
        const fragment=label("矿石",17,0,0,0xb9f3ff);
        flash(fragment,.7,-36,0,0,actorWorld({x:event.x,y:event.y},true));
        continue;
      }
      const deathPoint = screenPoint({ x: event.x, y: event.y }, session.battle, usesChallengeProjection());
      for (let i = 0; i < 3; i++) {
        const money = picture(cashFrames[(event.id * 3 + i) % cashFrames.length],
          deathPoint.x + (i - 1) * 12, deathPoint.y - 12, 30, 30);
        flash(money, 1.2 + i * 0.25, -58 - i * 8, (i - 1) * 42, (i - 1) * 0.8,actorWorld({x:event.x,y:event.y},usesChallengeProjection()));
      }
    } else if (event.type === "currencyCollected") {
      const earned = label(`+${event.amountValue?.format() ?? Math.floor(event.amount)}`, 18, cat.x + 61, cat.y - 42, 0x81f34d);
      flash(earned, 1.1, -40,0,0,actorWorld(session.battle.player,usesChallengeProjection()));
    } else if (event.type === "shot") {
      const rig = catRigs[event.actorId];
      if (!rig) continue;
      rig.fire(false);
      feedback.playShot();
      const inChallenge=usesChallengeProjection(), camera=actorWorld(session.battle.player,inChallenge);
      const muzzle=projectWorld({...actorWorld(event.muzzle,inChallenge),y:event.height},camera);
      const mount=rig.getShootScreen();
      const flashView=createMuzzleView(weaponIndex(event.weaponId),0,15,{seed:event.projectileIds[0]??event.actorId,
        cameraRotation:[cameraRotation.x,cameraRotation.y,cameraRotation.z,cameraRotation.w],...rig.getMuzzleEmissionTransform()});
      projectiles.addChild(flashView);muzzleViews.push({view:flashView,actorId:event.actorId,age:0});
      recentShotChecks.push({actorId:event.actorId,time:event.time,screenError:Math.hypot(mount.x-muzzle.x,mount.y-muzzle.y)});
      if(recentShotChecks.length>60)recentShotChecks.shift();
    } else if(event.type === "projectileBorn" || event.type === "projectilePath" || event.type === "projectileStopped") {
      consumeProjectileLifecycle(event);
    } else if(event.type === "projectileImpact") {
      const inChallenge=usesChallengeProjection(),anchor={...actorWorld(event.position,inChallenge),y:event.height};
      const location=projectWorld(anchor,actorWorld(session.battle.player,inChallenge));
      const impact=createImpactView(weaponIndex(event.weaponId),0,15,{seed:event.projectileId,
        cameraRotation:[cameraRotation.x,cameraRotation.y,cameraRotation.z,cameraRotation.w]});
      impact.position.set(location.x,location.y);
      // Each source particle owns its alpha and lifetime.
      flash(impact,impact.presentation.suggestedDurationSeconds,0,0,0,anchor);
      Object.assign(fleeting[fleeting.length-1],{adapterAge:0,adapterView:impact});
    } else if (event.type === "stageWon") {
      feedback.playWin();
      if(session.mode !== "field") continue;
      flash(label("Stage Clear!", 31, 270, 315, 0xffe77e), 1.4, -12);
    }
  }
}

hud.addChild(new Graphics().beginFill(0x6a4a2b).drawRect(0, 0, W, 60).endFill());
hud.addChild(box(-2, 60, W + 4, 15, 0x8f6d35));
const progressFill = new Graphics(), progressText = label("0%", 17, 270, 68);
hud.addChild(progressFill, progressText);
const stages = new Container();
stages.addChild(new Graphics().lineStyle(6, 0x674724).moveTo(145, 100).lineTo(380, 100));
for (let i = 0; i < 5; i++) {
  stages.addChild(new Graphics().lineStyle(4, 0x664524).beginFill(i === 0 ? 0xffe3ae : 0x8f713a).drawCircle(150 + i * 58, 100, 11).endFill());
}
const stageCat = picture(loaded[paths.catIcon], 150, 100, 28);
const stageText = label("Stage 1-1", 19, 270, 124);
stages.addChild(stageCat, stageText);
const settingIcon = picture(loaded[paths.setting], 26, 100, 32);
hud.addChild(stages, settingIcon);
function currency(icon: Texture, y: number) {
  const parent = new Container();
  parent.addChild(box(437, y - 14, 95, 28, 0xffe3b8, 14), picture(icon, 444, y, 37, 32));
  const amount = label("0", 19, 494, y);
  parent.addChild(amount);
  hud.addChild(parent);
  return { parent, amount };
}
const money = currency(loaded[paths.money], 100), diamond = currency(loaded[paths.diamond], 137);
const timer = new Container();
timer.addChild(box(116, 100, 286, 23, 0x315b75, 6));
const timerFill = new Graphics(), timerText = label("60s", 18, 260, 111);
timer.addChild(timerFill, picture(loaded[paths.timer], 119, 111, 45, 49), timerText);
hud.addChild(timer);

const kinds: UpgradeKind[] = ["power", "speed", "money"];
const cards = kinds.map((kind, i) => {
  const x = 105 + 160 * i;
  const parent = new Container();
  parent.position.set(x, 1125);
  const cardLayer = (texture: Texture) => {
    // Source RectTransform 300 × 201.2339, sliced border 67 on each side.
    const layer = new NineSlicePlane(texture, 67, 67, 67, 67);
    layer.width = 300;
    layer.height = 201.2339;
    layer.scale.set(144 / 300, 100 / 201.2339);
    layer.position.set(-72, -59);
    return layer;
  };
  const panel = cardLayer(loaded[paths.card]);
  panel.tint = 0x485b44;
  // SlicedFilledImage direction 2 clips Y from the bottom; the source sprite
  // and slices preserve the complete rounded panel silhouette.
  const meter = cardLayer(loaded[paths.card]);
  meter.tint = 0x8fff83;
  const meterMask = new Graphics();
  meter.mask = meterMask;
  const priceBack = picture(loaded[paths.price], 0, 18, 113, 28);
  priceBack.tint = 0x75512c;
  const available = cardLayer(loaded[paths.card]);
  available.tint = 0x88fff8;
  parent.addChild(panel, meter, meterMask, available, cardLayer(loaded[paths.cardOutline]), priceBack);
  const icon = kind === "power" ? paths.power : kind === "speed" ? paths.speed : paths.moneyUpgrade;
  parent.addChild(picture(loaded[icon], -61, -39, 32), picture(loaded[paths.money], -42, 19, 33, 27));
  parent.addChild(label({power:"攻击",speed:"攻速",money:"金币"}[kind], 16, 0, -69));
  const level = label("Lv.0", 13, 48, -57), status = label("还差 50", 11, 30, -38),
    percent = label("0%", 11, -25, -38, 0x9cff86),
    value = label("100", 26, 0, -10), cost = label("50", 16, 11, 19);
  parent.addChild(level, status, percent, value, cost);
  parent.eventMode = "static";
  parent.cursor = "pointer";
  parent.on("pointertap", () => { const before=session.battle.upgradeLevels[kind]; session = purchase(session, kind); if(session.battle.upgradeLevels[kind]>before) feedback.playUpgrade(); update(); });
  hud.addChild(parent);
  return { parent, kind, level, status, percent, value, cost, priceBack, meter, meterMask, panel, available, fillFraction:0, fillState:"", refreshedAt:-Infinity };
});

let settingsOpen = false;
let ecoMode = false;
let petAuto=freshSourcePetAutoState();
let petInfoGrade=0;
let adventureNavigation=freshAdventureNavigation();
let pendingPrismReward:SourcePrismRequest|null=null;
let prismStateOwner=0;
let pendingAdventureReward:SourceAdventureAdRequest|null=null;
let qaAdventureTime:{date:Date;started:number}|null=null;
function adventureClock(){return sourceAdventureLocalClock(qaAdventureTime?new Date(qaAdventureTime.date.getTime()+performance.now()-qaAdventureTime.started):new Date());}
function refreshAdventureClock(){
 const clock=adventureClock(),before=meta.adventure,tickets=adventureRefreshTickets(before,clock.nowTicks),day=sourceAdventureDayCheck(before,clock);
 if(tickets.tickets!==before.tickets||tickets.lastChargeTicks!==before.lastChargeTicks||day!==before){meta={...meta,adventure:{...day,...tickets}};saveProgress();}
 return clock;
}
let starSlot=0,starReturn:'none'|'raid'='none';
let raidSelection:SourceRaidSelection=[null,null,null],raidSelectingSlot:number|null=null;
function refreshRaidClock(){
 if(liveRaid){const now=new Date(stepUpClock());liveRaid.refreshClock(createLocalMineTime(()=>now),now);return;}
 const now=new Date(stepUpClock()),before=meta.raid,next=sourceRaidTickets(sourceRaidSeason(before,now),createLocalMineTime(()=>now));
 const pig=sourceRaidStarPigSeason(meta.raidStarPig??freshSourceRaidStarPig(),next.seasonIndex);
 const mission=sourceRaidMissionRefresh(meta.raidMission??freshSourceRaidMission(),next);
 if(next!==before||pig!==meta.raidStarPig||mission!==meta.raidMission){meta={...meta,raid:next,raidStarPig:pig,raidMission:mission};saveProgress();}
 raidSelection=sourceRaidSelectionRefresh(session,raidSelection);
}
function openRaidPanel(){refreshRaidClock();raidSelection=sourceRaidAutoSelect(session,sourceRaidWeakType(meta.raid.seasonIndex));raidSelectingSlot=null;showLocalPanel('raid');}
function raidPanelState(){return {session,state:meta.raid,selection:raidSelection,selectingSlot:raidSelectingSlot,nowUTC:stepUpClock(),notice:localNotice,ready:true,pig:meta.raidStarPig,mission:meta.raidMission};}
function starPanelState(){
 const ref=sourceRaidSelectionRefresh(session,raidSelection)[starSlot];
 return {session,slot:starSlot,notice:localNotice,context:starReturn==='raid'?'raid' as const:'field' as const,damageBase:starReturn==='raid'&&ref?sourceRaidDamage(ref.gunID,sourceRaidWeakType(meta.raid.seasonIndex)):null};
}
let skinIndex=0;
let gunDetail:SourceGunDetailRef|undefined,gunDetailReturn:'none'|'gun-collection'|'gun-safe'|'stepup'|'weekly'|'raid'='none';
let raidMissionTicketOpen=false;
let passPopup:SourcePassPopup='none';
let qaPassDate:string|null=null,qaPassSaveFailure=false;
let localPanel: "mine-pack"|"weekly"|"diapig"|"stepup"|"none"|"shop"|"activities"|"developer"|"missions"|"pass"|"fish"|"boss"|"pet"|"pet-info"|"pet-draw-info"|"gun-collection"|"gun-info"|"gun-safe"|"gun-guide"|"star"|"skin"|"skin-info"|"monster"|"adventure"|"raid"|"raid-star-pig"|"raid-helper"|"raid-mission"|"redeem"|"auto"|"buff" = "none";
let platform = decodePlatformState(gameStorage.getItem(LOCAL_PLATFORM_KEY));
const pagesPurchasePreview=import.meta.env.VITE_PREVIEW_FREE_PURCHASES === "true";
const purchaseSimulationEnabled=()=>localPurchaseSimulationEnabled(platform,pagesPurchasePreview);
let localNotice = "";
let activityPage=0;
const localControls: Container[] = [];
function savePlatform() {saveProgress();}
function showLocalPanel(panel: typeof localPanel) {
  cancelPlatformOperation();
  if(transition.active)return;
  if(panel!=="none"){pendingMineSpeedReward=null;pendingChallengeReward=null;}
  if(panel!==localPanel){passClient.invalidate();passPopup='none';}localPanel=panel;activityPage=0;settingsOpen=false;localNotice="";resetMovementInput();update();
}
function applyGrant(grant:GrantResult) {session=grant.session;platform=grant.platform;localNotice=grant.message;saveProgress();update();}
function panelSurface(x:number,y:number,w:number,h:number,tint=0xffe2ac) {
  return sourceSurface(478,x,y,w,h,tint,864);
}
function localTitle(title:string,subtitle:string) {
  modal.addChild(panelSurface(28,235,484,770),label(title,31,270,279),settingLabel(subtitle,16,270,326));
  modal.addChild(closeControl(475,270,()=>{localPanel="none";localNotice="";resetMovementInput();update();}));
}
function grantButton(text:string,y:number,run:()=>void,color=0x8edab0) {
  return control(text,270,y,390,56,color,run);
}
function drawLocalPanel() {
  if(localPanel==="developer") {
    const top=Math.max(40,(H-760)/2),bottom=Math.min(H-24,top+760);
    modal.addChild(panelSurface(28,top,484,bottom-top),label("开发者模式",28,270,top+40),settingLabel("用户扩展 · 本地测试操作会保存",15,270,top+74),closeControl(478,top+40,()=>{localPanel="none";localNotice="";update();}));
    modal.addChild(grantButton(platform.developerEnabled?"开发者模式：已开启":"开启开发者模式",top+120,()=>{platform={...platform,developerEnabled:!platform.developerEnabled};savePlatform();update();},platform.developerEnabled?0x9bd7aa:0xffcf66));
    (["freeAds","freePurchases"] as const).forEach((kind,i)=>modal.addChild(control(`${kind==="freeAds"?"免广告":"免费模拟内购"}：${platform[kind]?"开":"关"}`,163+i*214,top+180,196,48,platform[kind]?0xa8d9e6:0xcbbf9f,()=>{platform={...platform,[kind]:!platform[kind]};savePlatform();update();})));
    const bundle=()=>({session,activities,platform,meta});
    const actions:[string,()=>void][]=[
      ["钻石 +1000",()=>applyGrant(developerResource(session,platform,"diamonds"))],["金币 +100万",()=>applyGrant(developerResource(session,platform,"coins"))],
      ["红宝石 +1000",()=>applyGrant(developerResource(session,platform,"ruby"))],["开放后期入口",()=>applyGrant(developerResource(session,platform,"unlock"))],
      ["重置矿场次数",()=>applyGrant(developerResource(session,platform,"mineTickets"))],["通行证经验 +100",()=>{activities=developerActivityExp(activities,platform.developerEnabled);localNotice=platform.developerEnabled?"测试通行证经验 +100":"请先启用开发者模式";saveProgress();update();}],
      ["测试购买 VIP",()=>applyMetaGrant(developerSourceMetaPass(bundle(),"vip"))],["测试购买 Luxury",()=>applyMetaGrant(developerSourceMetaPass(bundle(),"luxury"))],
      [`Weapon02 临时枪本地配置：${meta.adTemporaryGunServer?'开':'关'}（非服务器）`,()=>{meta={...meta,adTemporaryGunServer:!meta.adTemporaryGunServer};saveProgress();update();}],
      [`广告枪开关：${meta.adDailyGun.serverWeapon01AdOn?"开":"关"}`,()=>applyMetaGrant(developerSourceAdDailyGunServer(bundle(),!meta.adDailyGun.serverWeapon01AdOn))],
      ...([['plusPack2Active','Plus2 扫荡'],['minePack','矿场六次'],['automaticBonus','自动四倍'],['adRemoved','去广告权益']] as const).map(([key,title]):[string,()=>void]=>[`${title}：${meta.entitlements[key]?"开":"关"}`,()=>applyMetaGrant(developerSourceMetaEntitlement(bundle(),key,!meta.entitlements[key]))])
    ];
    actions.forEach(([title,run],i)=>modal.addChild(control(title,163+(i%2)*214,top+238+Math.floor(i/2)*57,196,48,0xb8dfb0,run)));
    modal.addChild(settingLabel(localNotice||"免购买仅提供显式开发回执",14,270,bottom-62),settingLabel(`已记录 ${platform.sequence} 次测试操作`,13,270,bottom-30));return;
  }
  if(localPanel==="shop") {
    localTitle("商店",purchaseSimulationEnabled()?"免费模拟内购 · 不扣费 · 奖励保存在此浏览器":"钻石补给 · 免费模拟购买已关闭");
    modal.addChild(picture(loaded[paths.diamond],92,365,34),settingLabel(`持有 ${session.diamonds} 钻石`,19,270,365));
    round3UI.shop.offerings.forEach((offer,i)=>{
      const y=446+i*92,first=!platform.claims.some(id=>id.startsWith(`shop:${offer.id}:`));
      modal.addChild(sourceSurface(694,49,y-37,442,78,0xf8dea7,220),picture(loaded[offer.art.url],94,y,65),
        settingLabel(`${offer.reward.amount} 钻石`,22,233,y-13),
        settingLabel(first?`首次双倍 · ${offer.reward.amount*offer.firstPurchaseMultiplier}`:"钻石补给",14,231,y+17),
        control(purchaseSimulationEnabled()?"免费模拟":"启用测试",432,y,91,47,0xade3b0,()=>{
          void requestShopPurchase(offer.id);
        }));
    });
    modal.addChild(control("开发者通道",270,920,224,43,0xffcf75,()=>showLocalPanel("developer")),settingLabel(localNotice,15,270,969));return;
  }
  if(localPanel==="missions") {
    localTitle("成长任务",`通行证等级 ${passView(activities).level} · 累计经验 ${activities.passExp}`);
    ACTIVITY_MISSIONS.slice(activityPage*6,activityPage*6+6).forEach((mission,i)=>{
      const y=405+i*78,count=activities.counters[mission.counter as ActivityCounter],claimed=activities.missionClaims.includes(mission.id),ready=count>=mission.goal&&!mission.requiresVip&&!claimed;
      modal.addChild(sourceSurface(647,49,y-33,442,69,0xffeed0,150),settingLabel(`${mission.label} ${mission.goal}${mission.requiresVip?" · VIP":""}`,18,222,y-14),
        settingLabel(`${Math.min(count,mission.goal)} / ${mission.goal} · 经验 +${mission.reward.amount}`,14,222,y+12),
        control(claimed?"已领取":mission.requiresVip?"未开通":ready?"领取":"进行中",430,y,99,44,ready?0xa5e39a:0xcbbf9f,()=>{
          const r=claimMission(activities,mission.id);activities=r.state;localNotice=r.claimed?`通行证经验 +${mission.reward.amount}`:mission.requiresVip?"高级权益尚未开通":"完成目标后领取";saveProgress();update();
        }));
    });
    drawActivityPaging(Math.ceil(ACTIVITY_MISSIONS.length/6));return;
  }
  if(localPanel==="pass") {
    const view=passView(activities);
    localTitle("通行证",`等级 ${view.level} / 25 · 经验 ${view.level===25?100:view.exp} / 100`);
    view.rewards.slice(activityPage*6,activityPage*6+6).forEach((reward,i)=>{
      const index=reward.sourceIndex,y=405+i*78,claimed=activities.passClaims.includes(index),ready=view.level>index&&activities.passClaims.length===index;
      const text=reward.kind==="diamonds"?`${reward.amount} 钻石`:`武器 #${reward.amount+1}`;
      const icon=reward.kind==="diamonds"?loaded[paths.diamond]:loaded[gunSource.guns[reward.amount]?.spriteURL??paths.gun];
      modal.addChild(sourceSurface(647,49,y-33,442,69,0xffeed0,150),picture(icon,90,y,44),settingLabel(`Lv.${index+1} · ${text}`,18,242,y-14),
        settingLabel(reward.requiresAd?"广告奖励":"普通奖励",14,231,y+13),control(claimed?"已领取":ready?"领取":"未解锁",430,y,99,44,ready?0xa5e39a:0xcbbf9f,()=>{
          const r=claimPass(session,activities,index,{freeAdConfirmed:platform.developerEnabled&&platform.freeAds});
          session=r.session;activities=r.state;localNotice=r.claimed?`已领取 ${text}`:r.reason==="ad-confirmation"?"请在开发者模式开启免广":r.reason==="inventory-full"?"武器背包已满，请先合成腾出位置":r.reason==="sequence"?"请先领取前面的奖励":"达到等级后领取";saveProgress();update();
        }));
    });
    drawActivityPaging(Math.ceil(view.rewards.length/6));return;
  }
  localTitle("活动", "钻石与成长奖励");
  const rows=[{title:"每日签到",desc:canClaimSourceDaily()?"领取今天的签到奖励":"今日奖励已领取",icon:paths.diamond,run:()=>{localPanel="none";openSourceDaily();}},
    {title:"挑战清理",desc:`第 ${session.challengeStage} 关 · 胜利奖励 30 钻石`,icon:paths.play,run:()=>{localPanel="none";session=openChallenge(session);update();}},
    {title:"矿场",desc:contentGate(session.historicMax,"mine").unlocked?"清理矿石，结算钻石":"普通第 4 大关开放",icon:round3UI.entries.mine.url,run:()=>{if(contentGate(session.historicMax,"mine").unlocked){localPanel="none";session=openMine(session);update();}else {localNotice="可在开发者通道提前开放矿场";update();}}}];
  rows.forEach((r,i)=>{const y=414+i*136;modal.addChild(panelSurface(51,y-46,438,116,0xf4d69d),picture(loaded[r.icon],97,y,54),settingLabel(r.title,23,257,y-18),settingLabel(r.desc,15,265,y+21),control("前往",444,y,80,43,0xabe0a9,r.run));});
  modal.addChild(control("成长任务",157,811,200,52,0xabdfad,()=>showLocalPanel("missions")),control("通行证奖励",383,811,200,52,0xa8dbe3,()=>showLocalPanel("pass")),control("开发者通道",270,896,224,43,0xffcf75,()=>showLocalPanel("developer")),settingLabel(localNotice,16,270,954));
}
function drawActivityPaging(pages:number) {
  const pageButton=(text:string,x:number,delta:number)=>control(text,x,923,109,43,0xc2e2b3,()=>{activityPage=Math.max(0,Math.min(pages-1,activityPage+delta));localNotice="";update();});
  modal.addChild(pageButton("上一页",119,-1),settingLabel(`${activityPage+1} / ${pages}`,17,270,923),pageButton("下一页",421,1),
    control("活动入口",270,857,180,43,0xf7cb82,()=>showLocalPanel("activities")),settingLabel(localNotice,15,270,977));
}
let gunGuide: Sprite | null = null;
let preferences = loadBrowserPreferences(gameStorage);
const feedback = createBrowserFeedback(preferences,undefined,gameStorage);
function togglePreference(kind: keyof BrowserPreferences) {
  feedback.unlock();
  preferences = { ...preferences, [kind]: !preferences[kind] };
  feedback.setPreferences(preferences); feedback.playUI(); update();
}
settingIcon.eventMode="static";settingIcon.cursor="pointer";
settingIcon.on("pointertap",()=>{
  if (transition.active) return;
  feedback.unlock();feedback.playUI();settingsOpen=true;localPanel="none";resetMovementInput();update();
});
const SAVE_KEY="catgunner-h5-source-20260930";
let session:Session;
let savedEnvelope: {activities?:unknown;platform?:unknown;meta?:unknown}|null=null;
try {const saved=gameStorage.getItem(SAVE_KEY);session=saved?deserializeSession(saved):createSession();savedEnvelope=saved?JSON.parse(saved):null;}
catch {session=createSession();session.notice="本地存档无法读取，已新建进度";}
session=sourceAdGunOnLoaded(session,Date.now());
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
let activities=createActivityState(session,localDate());
try {const saved=savedEnvelope?.activities?JSON.stringify(savedEnvelope.activities):gameStorage.getItem(ACTIVITY_STORAGE_KEY);if(saved)activities=decodeActivityState(saved);}catch{localNotice="活动存档无法读取";}
if(savedEnvelope?.platform)platform=decodePlatformState(JSON.stringify(savedEnvelope.platform));
let meta=freshSourceMetaState();
try{meta=decodeSourceMetaState(savedEnvelope?.meta?JSON.stringify(savedEnvelope.meta):null);}catch{localNotice="后期状态无法读取";}
const unavailableProvider=createUnavailableR5PlatformProvider();
let developmentProvider=createLocalDevelopmentR5PlatformProvider({getLocalState:()=>platform,storage:gameStorage});
let platformOperation:AbortController|null=null;
let platformConfirmation:R5PlatformRequest|null=null;
let platformPreview:R5PlatformResult['preview'];
let platformPending=false;
let redeemValue="";
let redeemInput:SourceRedeemInputOverlay|null=null;
const selectedPlatformProvider=()=>platform.developerEnabled?developmentProvider:unavailableProvider;
function cancelPlatformOperation(){platformOperation?.abort();platformOperation=null;platformConfirmation=null;platformPreview=undefined;platformPending=false;}
function encodeGameEnvelope(){const envelope=JSON.parse(serializeSession(session));envelope.activities=JSON.parse(serializeActivityState(activities));envelope.platform=platform;envelope.meta=JSON.parse(serializeSourceMetaState(meta));return JSON.stringify(envelope);}
async function performPlatformAction(action:R5PlatformAction,extra:Partial<R5PlatformRequest>={}){
  platformOperation?.abort();const operation=new AbortController();platformOperation=operation;const provider=selectedPlatformProvider();platformPending=true;platformConfirmation=null;
  const request:R5PlatformRequest={action,requestId:crypto.randomUUID(),...extra,signal:operation.signal};
  if(action==='cloud-save'&&!extra.confirmed){saveProgress();request.snapshot={encodedSession:encodeGameEnvelope(),maxStage:Math.floor(session.historicMax/10)+1};}
  if(action==='support')request.supportBody=`Cat Gunner H5 本地测试反馈\n历史进度 ${session.historicMax}\n未发送`;
  update();
  try{
    const result=await provider.execute(request);
    if(platformOperation!==operation||operation.signal.aborted||provider!==selectedPlatformProvider())return;
    localNotice=result.message;
    if(result.status==='confirmation'){platformConfirmation={...request,signal:undefined};platformPreview=result.preview;}
    if(result.status==='success'&&result.snapshot){
      const envelope=JSON.parse(result.snapshot.encodedSession),loadedSession=deserializeSession(result.snapshot.encodedSession);
      const loadedActivities=decodeActivityState(JSON.stringify(envelope.activities)),loadedMeta=decodeSourceMetaState(JSON.stringify(envelope.meta));
      weeklyStateOwner++;bossResultRewardClient.invalidate();qaBossRewardSaveFailure=false;freeCashClient.reset();freeCashProvider=null;petDailyClient.invalidate();gunDailyClient.invalidate();autoAdClient.invalidate();shopPurchaseClient.invalidate();offerWallClient.reset();qaFreeCashSaveFailure=false;raidStarPigClient.invalidate();raidHelperClient.invalidate();raidMissionClient.invalidate();passClient.invalidate();passPopup='none';raidMissionTicketOpen=false;pendingBuffReward=null;pendingMineSpeedReward=null;pendingChallengeReward=null;pendingMineResultReward=null;activityPurchaseClient.invalidate();diaPigPurchaseClient.invalidate();pendingAdGunReward=null;adGunTimer=0;cancelLiveHunt();session=sourceAdGunOnLoaded(loadedSession,Date.now());activities=loadedActivities;meta=loadedMeta;observedSession=session;resetMovementInput();saveProgress();
      localNotice='已读取本地测试存档槽（未连接云端）';
    }
  }catch{if(platformOperation===operation&&!operation.signal.aborted)localNotice='平台操作失败，进度未替换';}
  finally{if(platformOperation===operation){platformPending=false;platformOperation=null;update();}}
}
let observedSession=session;

const qaBadge=document.createElement('div');qaBadge.id='cat-qa-identity';Object.assign(qaBadge.style,{position:'fixed',left:'0',top:'0',zIndex:'100',font:'11px/1.3 system-ui',background:'#231d1de6',color:'#fff4ca',padding:'2px 6px',pointerEvents:'none',display:'none'});document.body.appendChild(qaBadge);
let lastSave=performance.now();
function saveProgress() {if(!qaFixtureActive) {try {
  // Gameplay balance and claim ledgers share one atomic localStorage write.
  const envelope=JSON.parse(serializeSession(session));
  envelope.activities=JSON.parse(serializeActivityState(activities));envelope.platform=platform;envelope.meta=JSON.parse(serializeSourceMetaState(meta));
  gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
} catch {session.notice="本地存档写入失败";}}}
function canClaimSourceDaily() {return activities.dailyClaims<7&&(!activities.lastDailyDate||activities.lastDailyDate<localDate());}
function openSourceDaily() {if(session.mode!=="field"||session.overlay!=="none")return;localPanel="none";session={...session,overlay:"daily",events:[]};update();}
function receiveSourceDaily() {
  if(session.mode!=="field"||session.overlay!=="daily")return;
  const r=claimSourceDaily(session,activities,localDate());session=r.session;activities=r.state;
  if(r.claimed){feedback.playReward();session.events=[{type:"dailyClaimed",diamonds:round3UI.activities.daily.rewards[activities.dailyClaims-1]}];consumeEvents();}
  saveProgress();update();
}
addEventListener("pagehide",saveProgress);
let renderedMode: Session["mode"] | null = null;
let metaControl: Container|null=null;
let permanentControl: Container|null=null;
let mineControl:Container|null=null;
let modeControl: Container | null = null, gunControl: Container | null = null, dailyControl: Container | null = null;
let draggingGun: number | null = null;
let autoUpgradeDirtyKey="";
function runAutoUpgradeIfDirty() {
  if(session.mode!=="field"||!meta.autoUpgrade.requested||(!meta.entitlements.autoUpgradePack&&meta.autoUpgrade.adRemainingSec<=0))return;
  const paused=!!liveHunt?.ownsField||!!liveRaid?.ownsField||qaFreeze||transition.active||settingsOpen||localPanel!=="none"||session.overlay!=="none";
  if(paused)return;
  const key=`${meta.autoUpgrade.requested}:${meta.entitlements.autoUpgradePack}:${meta.autoUpgrade.adRemainingSec>0}:${walletValue(session.battle).toString()}:${Object.values(session.battle.upgradeLevels).join(":")}`;
  if(key===autoUpgradeDirtyKey)return;
  const result=runtimeSourceAutoUpgrade({session,activities,platform,meta},false);
  if(result.session.battle!==session.battle){session={...result.session,events:[...session.events,...result.session.events]};activities=observeActivities(activities,observedSession,session);observedSession=session;}
  autoUpgradeDirtyKey=`${meta.autoUpgrade.requested}:${meta.entitlements.autoUpgradePack}:${meta.autoUpgrade.adRemainingSec>0}:${walletValue(session.battle).toString()}:${Object.values(session.battle.upgradeLevels).join(":")}`;
}
function applyMetaGrant(grant:SourceMetaRuntimeResult) {
  const before=session;session=grant.session;activities=grant.activities;platform=grant.platform;meta=grant.meta;
  if(localPanel==="pet"&&sourcePanel&&"resolveDrop"in sourcePanel)(sourcePanel as SourcePetPanelView).resolveDrop(grant.status==="granted",grant.message);
  localNotice=grant.message;saveProgress();feedback.playUI();update();playNewInventoryMotion(before);
}
function onSourceAction(name:string,payload?:any) {
  if(transition.active)return;
  if(name!=="unresolved")localNotice="";
  feedback.unlock();feedback.playUI();
  switch(name){
    case "eco-toggle":ecoMode=!ecoMode;clearFleetingEffects();resetMovementInput();update();return;
    case "eco-off":ecoMode=false;clearFleetingEffects();resetMovementInput();update();return;
    case "content-open":{
      const feature=payload as "fish"|"boss"|"pet"|"monster"|"adventure"|"raid";
      const gate=contentGate(session.historicMax,feature);
      if(!gate.unlocked){localNotice=`第${gate.required}大关开放`;flash(label(localNotice,18,W/2,250,0xffe5a5),2,0);return;}
      if(feature==="adventure"){refreshAdventureClock();adventureNavigation=freshAdventureNavigation();}
      if(feature==="raid"){openRaidPanel();return;}
      showLocalPanel(feature);return;
    }
    case 'prism-open':{
      if(localPanel!=='adventure'||!['main','relic'].includes(adventureNavigation.page))return;
      if(session.mode!=='field'||!contentGate(session.historicMax,'adventure').unlocked){localNotice='棱镜核心在第35大关的探索入口开放';update();return;}
      adventureNavigation={...adventureNavigation,page:'prism',prismReturn:adventureNavigation.page==='relic'?'relic':'main'};localNotice='本地测试商品 · 无真实支付';update();return;
    }
    case 'prism-close':if(localPanel==='adventure'&&adventureNavigation.page==='prism'){adventureNavigation={...adventureNavigation,page:adventureNavigation.prismReturn};localNotice='';update();}return;
    case 'prism-purchase':void requestPrismReward(Number(payload));return;
    case "adventure-main":adventureNavigation={...adventureNavigation,page:'main'};update();return;
    case "adventure-relic":adventureNavigation={...adventureNavigation,page:'relic'};update();return;
    case 'relic-core':{
      if(localPanel!=='adventure'||adventureNavigation.page!=='relic')return;
      const type=Number(payload);if(!Number.isInteger(type)||type<0||type>3)return;
      adventureNavigation={...adventureNavigation,relicCoreType:type};localNotice='';update();return;
    }
    case 'relic-info':{
      if(localPanel!=='adventure'||!adventureNavigation.page.startsWith('relic'))return;
      const index=Number(payload);if(!Number.isInteger(index)||index<0||index>=15)return;
      adventureNavigation={...adventureNavigation,page:'relic-info',relicIndex:index,relicReturn:adventureNavigation.page==='relic-info'?adventureNavigation.relicReturn:adventureNavigation.page==='relic-draw'?'relic-draw':'relic'};localNotice='';update();return;
    }
    case 'relic-info-close':adventureNavigation={...adventureNavigation,page:adventureNavigation.relicReturn};localNotice='';update();return;
    case 'relic-upgrade':case 'relic-draw':{
      if(localPanel!=='adventure'||adventureNavigation.page!==(name==='relic-draw'?'relic':'relic-info'))return;
      const grant=runtimeSourceRelic({session,activities,platform,meta},name==='relic-draw'?'draw':'upgrade',adventureNavigation.relicCoreType,payload==='max'?'max':1,adventureNavigation.relicIndex);
      ({session,activities,platform,meta}=grant);localNotice=grant.message;
      if(grant.status==='granted'&&name==='relic-draw')adventureNavigation={...adventureNavigation,page:'relic-draw',relicDraws:grant.draws,relicDrawPage:0,relicStartedMs:performance.now()};
      saveProgress();update();return;
    }
    case 'relic-result-close':case 'relic-result-page':{
      if(localPanel!=='adventure'||adventureNavigation.page!=='relic-draw')return;
      const p=sourceRelicDrawPresentation(adventureNavigation.relicDraws,adventureNavigation.relicDrawPage,(performance.now()-adventureNavigation.relicStartedMs)/1000);
      if(!p.ready)return;
      if(name==='relic-result-close'){adventureNavigation={...adventureNavigation,page:'relic',relicDraws:[],relicDrawPage:0};localNotice='';}
      else{const delta=Number(payload);if(delta!==-1&&delta!==1)return;if(delta<0&&!p.left||delta>0&&!p.right)return;adventureNavigation={...adventureNavigation,relicDrawPage:adventureNavigation.relicDrawPage+delta,relicStartedMs:performance.now()};}
      update();return;
    }
    case "adventure-maps":{
      const type=Number(payload);if(!Number.isInteger(type)||type<0||type>2)return;
      const clock=refreshAdventureClock();if(!adventureIsOpenDay(type,clock.dayOfWeek)){localNotice='该地区今日不开放；可查看已派遣进度';}
      adventureNavigation={...adventureNavigation,page:'maps',type,selected:[],reward:null};update();return;
    }
    case "adventure-enter":{
      const index=Number(payload),clock=refreshAdventureClock();if(!Number.isInteger(index)||index<0||index>4)return;
      if(!adventureIsOpenDay(adventureNavigation.type,clock.dayOfWeek)||meta.adventure.level<ADVENTURE_UNLOCK_LEVELS[index]||meta.adventure.maps[adventureNavigation.type][index].entered){localNotice='今日未开放、探索等级不足或该地图已在探索';update();return;}
      meta={...meta,pet:sourcePetWithIdentities(meta.pet)};
      adventureNavigation={...adventureNavigation,page:'enter',index,selected:sourceAdventureAutoSelect(meta.adventure,meta.pet)};update();return;
    }
    case "adventure-enter-return":adventureNavigation={...adventureNavigation,page:'enter'};update();return;
    case "adventure-pets":if(Number(payload)<adventurePetSlotCount(meta.adventure.level)){adventureNavigation={...adventureNavigation,page:'pets'};update();}return;
    case "adventure-unselect":adventureNavigation={...adventureNavigation,selected:adventureNavigation.selected.filter((_,i)=>i!==Number(payload))};update();return;
    case "adventure-select":{
      if(!payload||!['owned','selected'].includes(payload.source)||adventureNavigation.selected.length>=adventurePetSlotCount(meta.adventure.level))return;
      const p=sourcePetWithIdentities(meta.pet),id=(payload.source==='owned'?p.ownedIDs:p.selectedIDs)[payload.index];
      if(!sourcePetCanDispatch(p,payload.source,payload.index)||payload.uid!==id||adventureNavigation.selected.some(r=>r.uid===id)){localNotice='宠物已选、派遣锁定或所选身份失效';update();return;}
      adventureNavigation={...adventureNavigation,page:'enter',selected:[...adventureNavigation.selected,payload]};update();return;
    }
    case "adventure-start":{
      const clock=refreshAdventureClock();if(!adventureIsOpenDay(adventureNavigation.type,clock.dayOfWeek)){localNotice='该地区今日不开放';update();return;}
      if(adventureNavigation.selected.length>adventurePetSlotCount(meta.adventure.level))return;
      const grant=runtimeSourceAdventure({session,activities,platform,meta},'start',adventureNavigation.type,adventureNavigation.index,clock,adventureNavigation.selected);
      if(grant.status==='granted')adventureNavigation={...adventureNavigation,page:'maps',selected:[]};applyMetaGrant(grant);return;
    }
    case "adventure-exit":adventureNavigation={...adventureNavigation,page:'exit',index:Number(payload)};update();return;
    case "adventure-claim":{
      const index=Number(payload),grant=runtimeSourceAdventure({session,activities,platform,meta},'claim',adventureNavigation.type,index,refreshAdventureClock());
      if(grant.adventureResult.reward)adventureNavigation={...adventureNavigation,page:'reward',index,reward:grant.adventureResult.reward};applyMetaGrant(grant);return;
    }
    case "adventure-cancel":case "adventure-force-finish":{
      if(name==='adventure-force-finish'&&!qaFixtureActive){localNotice='原作此按钮禁用；强制结束仅独立QA夹具可用';update();return;}
      const grant=runtimeSourceAdventure({session,activities,platform,meta},name==='adventure-cancel'?'cancel':'force-finish',adventureNavigation.type,adventureNavigation.index,refreshAdventureClock());
      if(grant.status==='granted')adventureNavigation={...adventureNavigation,page:'maps',selected:[]};applyMetaGrant(grant);return;
    }
    case "adventure-ad":void requestAdventureReward(Number(payload));return;
    case "hunt-enter":void enterLiveHunt();return;
    case "hunt-sweep":applyMetaGrant(runtimeSourceHuntAction({session,activities,platform,meta},"sweep"));return;
    case "hunt-bonus":if(liveHunt){void requestLiveHuntBonus();return;}void requestHuntResultBonus();return;
    case "hunt-exit":{if(liveHunt){liveHunt.exit();resetMovementInput();update();return;}const sweepResult=meta.hunt.run?.mode==='sweep';pendingHuntResultReward=null;diaPigPurchaseClient.invalidate();if(meta.hunt.run){const grant=runtimeSourceHuntAction({session,activities,platform,meta},"exit");if(grant.status!=="granted"){applyMetaGrant(grant);return;}session=grant.session;activities=grant.activities;platform=grant.platform;meta=grant.meta;saveProgress();}localPanel=sweepResult?"monster":"none";localNotice="";resetMovementInput();update();return;}
    case "pet-drag-rejected":{const reasons:Record<string,string>={"pet-drop-outside":"已取消拖动","pet-merge-grade-mismatch":"只能合成同等级宠物","pet-max-grade":"已达最高宠物等级","pet-dispatch-locked":"派遣中的宠物不能合成","pet-inventory-full":"宠物库存已满"};localNotice=reasons[payload]??"此处不能放置宠物";update();return;}
    case "pet-info-grade":petInfoGrade=Number(payload);return;
    case "pet-info":if(!Number.isInteger(payload)||payload<0||payload>9)return;petInfoGrade=payload;showLocalPanel("pet-info");return;
    case "pet-draw-info":showLocalPanel("pet-draw-info");return;
    case "pet-draw-info-close":showLocalPanel("pet");return;
    case "pet-info-close":showLocalPanel("pet");return;
    case "pet-auto-toggle":if(!meta.entitlements.plusPack2Active){petAuto={...petAuto,requested:false};openWeeklyAuto("pet");return;}petAuto={...petAuto,requested:!petAuto.requested};update();return;
    case "pet-auto-fuse":if(petAuto.requested&&meta.entitlements.plusPack2Active&&localPanel==="pet")applyMetaGrant(runtimeSourcePetAction({session,activities,platform,meta},"merge",payload));return;
    case "pet-daily-ad":void petDailyClient.request();return;
    case "pet-draw":case "pet-merge":case "pet-equip":case "pet-unequip":case "pet-swap-selected":case "pet-move-owned":case "pet-swap-owned":applyMetaGrant(runtimeSourcePetAction({session,activities,platform,meta},name.slice(4) as Parameters<typeof runtimeSourcePetAction>[1],payload));return;
    case "fish-auto-set":applyMetaGrant(runtimeSourceFishAutoMergeSet({session,activities,platform,meta},Boolean(payload)));return;
    case "fish-auto-fuse":if(JSON.stringify(payload.inventory)===JSON.stringify(meta.fish.inventory))applyMetaGrant(runtimeSourceFishAutoMergeOnce({session,activities,platform,meta},payload.pool));return;
    case "fish-draw":applyMetaGrant(runtimeSourceFishDraw({session,activities,platform,meta},payload));return;
    case "fish-fusion":applyMetaGrant(runtimeSourceFishFusion({session,activities,platform,meta},payload.a,payload.b));return;
    case "auto":showLocalPanel("auto");return;
    case "buff":showLocalPanel("buff");return;
    case "buff-ad":void requestBuffReward(payload);return;
    case "mine-speed-ad":void requestMineSpeedReward();return;
    case "boss-plus-purchase":void requestWeeklyReward(0,true,"boss");return;
    case "hunt-plus-purchase":void requestWeeklyReward(2,true,"hunt");return;
    case "mine-plus-purchase":void requestWeeklyReward(1,true,true);return;
    case "auto-set":autoUpgradeDirtyKey="";applyMetaGrant(runtimeSourceAutoUpgradeSet({session,activities,platform,meta},Boolean(payload)));return;
    case "auto-ad":if(autoAdClient.saveFailed)autoAdClient.retrySave();else void autoAdClient.request();return;
    case "redeem-open":showLocalPanel("redeem");return;
    case "platform":if(payload==="redeem")void performPlatformAction("redeem",{code:redeemInput?.getValue()??redeemValue});else void performPlatformAction(payload);return;
    case "platform-confirm":{const pending=platformConfirmation;if(pending)void performPlatformAction(pending.action,{...pending,confirmed:true});return;}
    case "platform-cancel":cancelPlatformOperation();localNotice="已取消";update();return;
    case "settings":cancelPlatformOperation();settingsOpen=true;localPanel="none";break;
    case "close":passClient.invalidate();passPopup='none';pendingMineSpeedReward=null;pendingChallengeReward=null;cancelPlatformOperation();settingsOpen=false;localPanel="none";session=closeOverlay(session);break;
    case "preference":togglePreference(payload);return;
    case "developer":showLocalPanel("developer");return;
    case "daily":openSourceDaily();return;
    case "claim-daily":receiveSourceDaily();return;
    case "mine-pack-open":showLocalPanel("mine-pack");return;
    case "mine-pack-close":localPanel="none";localNotice="";update();return;
    case "missions":case "pass":case "shop":showLocalPanel(name);return;
    case "challenge":session=openChallenge(session);break;
    case "mine":if(contentGate(session.historicMax,"mine").unlocked)session=openMine(session);else localNotice="矿场在普通第4大关开放";break;
    case "skin":if(session.mode==='field'){skinIndex=(session.skin??freshSourceSkinState()).selected;showLocalPanel('skin');}return;
    case "skin-info":{const index=Number(payload);if(localPanel!=='skin'||!Number.isInteger(index)||index<0||index>24)return;skinIndex=index;localNotice='';localPanel='skin-info';update();return;}
    case "skin-next":case "skin-before":if(localPanel==='skin-info'){skinIndex=Math.min(24,Math.max(0,skinIndex+(name==='skin-next'?1:-1)));localNotice='';update();}return;
    case "skin-purchase":case "skin-select":{if(localPanel!=='skin-info')return;const result=sourceSkinAction(session.skin??freshSourceSkinState(),session.diamonds,skinIndex,name==='skin-purchase'?'purchase':'select');session={...session,skin:result.state,diamonds:result.diamonds};localNotice=sourceSkinReason[result.reason];saveProgress();update();return;}
    case "skin-info-close":localPanel='skin';localNotice='';update();return;
    case "skin-close":localPanel='none';localNotice='';update();return;
    case 'raid-close':if(localPanel==='raid'){raidSelectingSlot=null;showLocalPanel('none');}return;
    case 'raid-slot':{const slot=Number(payload);if(localPanel!=='raid'||!Number.isInteger(slot)||slot<0||slot>2)return;raidSelectingSlot=slot;localNotice='';update();return;}
    case 'raid-select-close':if(localPanel==='raid'){raidSelectingSlot=null;localNotice='';update();}return;
    case 'raid-unselect':{const slot=Number(payload);if(localPanel!=='raid'||!Number.isInteger(slot)||slot<0||slot>2)return;raidSelection=sourceRaidSelectionRefresh(session,raidSelection);raidSelection[slot]=null;localNotice='';update();return;}
    case 'raid-select':{if(localPanel!=='raid'||raidSelectingSlot===null)return;const result=sourceRaidSelect(session,raidSelection,raidSelectingSlot,payload as SourceRaidGunRef);raidSelection=result.selection;localNotice=result.reason??'';if(!result.reason)raidSelectingSlot=null;update();return;}
    case 'raid-empty-slot':if(localPanel==='raid'){localNotice='该源库存位置为空';update();}return;
    case 'raid-star':{const slot=Number(payload);if(localPanel!=='raid'||!Number.isInteger(slot)||slot<0||slot>2)return;if(!sourceStarUnlocked(session.historicMax)){localNotice='星级强化在普通第40大关开放';update();return;}starSlot=slot;starReturn='raid';localPanel='star';localNotice='';update();return;}
    case 'raid-enter':if(localPanel==='raid')void enterLiveRaid();return;
    case 'raid-live-retry':if(liveRaid){liveRaid.retrySave();update();}return;
    case 'raid-live-exit':if(liveRaid?.exit()){resetMovementInput();update();}return;
    case 'raid-star-pig':if(localPanel==='raid'){refreshRaidClock();showLocalPanel('raid-star-pig');}return;
    case 'raid-star-pig-close':if(localPanel==='raid-star-pig'){localPanel='raid';localNotice='';update();}return;
    case 'raid-star-pig-purchase':if(localPanel==='raid-star-pig')void requestRaidStarPigPurchase();return;
    case 'raid-mission':if(localPanel==='raid'){refreshRaidClock();raidMissionTicketOpen=false;showLocalPanel('raid-mission');}return;
    case 'raid-mission-close':if(localPanel==='raid-mission'){raidMissionTicketOpen=false;localPanel='raid';localNotice='';update();}return;
    case 'raid-mission-ticket-close':if(localPanel==='raid-mission'){raidMissionTicketOpen=false;update();}return;
    case 'raid-mission-claim':case 'raid-mission-reclaim':if(localPanel==='raid-mission'){refreshRaidClock();raidMissionClient.claim(Number(payload),name==='raid-mission-reclaim');update();}return;
    case 'raid-mission-purchase':if(localPanel==='raid-mission')void requestRaidMissionPurchase();return;
    case 'raid-mission-locked':case 'raid-mission-source-test':if(localPanel==='raid-mission'){localNotice='突袭任务条件未达成；源开发测试入口不启用';update();}return;
    case 'raid-helper':if(localPanel==='raid'){refreshRaidClock();showLocalPanel('raid-helper');}return;
    case 'raid-helper-close':if(localPanel==='raid-helper'){localPanel='raid';localNotice='';update();}return;
    case 'raid-helper-purchase':if(localPanel==='raid-helper')void requestRaidHelperPurchase();return;
    case 'raid-source-orphan':if(localPanel==='raid'){localNotice='原助手星级按钮事件目标为空；助手使用三个普通槽位星级的最小值，不存在独立第四强化槽（H5说明）';update();}return;
    case "star-open":{const slot=Number(payload);if(!Number.isInteger(slot)||slot<0||slot>2)return;if(!sourceStarUnlocked(session.historicMax)){localNotice='星级强化在普通第40大关开放';update();return;}starSlot=slot;starReturn='none';localNotice='';localPanel='star';update();return;}
    case "star-upgrade":{if(localPanel!=='star')return;const result=upgradeSessionStar(session,starSlot);session=result.session;localNotice=session.notice;saveProgress();update();return;}
    case "star-close":localPanel=starReturn;starReturn='none';localNotice='';session={...session,notice:''};update();return;
    case "gun-collection-open":if(session.overlay==='gun'){localPanel='gun-collection';localNotice='';update();}return;
    case "gun-guide-open":if(session.overlay==='gun'){localPanel='gun-guide';localNotice='';update();}return;
    case "gun-safe-open":if(session.overlay==='gun'){if(sourceGunSafeUnlocked(session.historicMax)){localPanel='gun-safe';localNotice='';}else localNotice='保险库在普通第40大关开放';update();}return;
    case "gun-info-open":{if(session.overlay!=='gun')return;const ref=payload as SourceGunDetailRef;if(!ref||!Number.isInteger(ref.sourceID)||ref.sourceID<0||ref.sourceID>64)return;if(!['catalogue','inventory','equipment','safe'].includes(ref.kind))return;gunDetail=ref;gunDetailReturn=localPanel==='gun-collection'?'gun-collection':localPanel==='gun-safe'?'gun-safe':'none';localPanel='gun-info';localNotice='';update();return;}
    case 'weekly-open':{weeklyReturn='none';weeklyScrollToAuto=false;refreshWeekly();if(!sourceWeeklyVisible(session)){localNotice='获得A级或以上武器后开放周商店';flash(label(localNotice,18,W/2,250,0xffe5a5),2,0);update();return;}weeklyMenu=sourceWeeklyDefaultMenu(session);session=sourceWeeklyVisit(session,weeklyMenu);saveProgress();showLocalPanel('weekly');return;}
    case 'weekly-close':showLocalPanel(weeklyReturn);weeklyReturn='none';return;
    case 'weekly-menu':{const menu=Number(payload);if(menu!==0&&menu!==1)return;if(menu===1&&!sourceWeeklyVIPUnlocked(session)){localNotice='到达20大关后开放Plus页';update();return;}weeklyMenu=menu;session=sourceWeeklyVisit(session,menu);localNotice='';saveProgress();update();return;}
    case 'weekly-purchase':void requestWeeklyReward(Number(payload),false);return;
    case 'plus-purchase':void requestWeeklyReward(Number(payload),true);return;
    case 'weekly-detail':{const item=Number(payload);if(localPanel!=='weekly'||!Number.isInteger(item)||item<0||item>2)return;gunDetail={kind:'catalogue',sourceID:sourceWeeklyGun(item,new Date(stepUpClock()))};gunDetailReturn='weekly';localPanel='gun-info';localNotice='';update();return;}
    case 'diapig-open':refreshDiaPig();showLocalPanel('diapig');return;
    case 'diapig-close':localPanel='none';localNotice='';update();return;
    case 'diapig-shop':showLocalPanel('shop');return;
    case 'diapig-collect':{if(localPanel!=='diapig')return;refreshDiaPig();const result=sourceDiaPigCollect(session.diaPig!,diaPigRuntime!,meta.entitlements,diaPigClock(),session.diamonds);session={...session,diaPig:result.state,diamonds:result.balance};diaPigRuntime=result.runtime;localNotice=result.reason;if(result.granted)feedback.playReward();saveProgress();update();return;}
    case 'diapig-purchase':void requestDiaPigPurchase(String(payload));return;
    case 'stepup-open':{refreshStepUp();if(!sourceStepUpVisible(session,stepUpClock())){localNotice='阶梯活动未开放：需历史获得B级以上武器，且活动未结束';flash(label(localNotice,18,W/2,250,0xffe5a5),2,0);update();return;}showLocalPanel('stepup');return;}
    case 'stepup-close':localPanel='none';localNotice='';update();return;
    case 'stepup-purchase':void requestStepUpReward(Number(payload));return;
    case 'stepup-detail':{const id=Number(payload);if(!SOURCE_STEPUP.gunRewards.includes(id))return;if(localPanel!=='stepup'&&session.overlay!=='gun')return;gunDetail={kind:'catalogue',sourceID:id};gunDetailReturn=localPanel==='stepup'?'stepup':'none';localPanel='gun-info';localNotice='';update();return;}
    case "gun-info-close":localPanel=gunDetailReturn;gunDetail=undefined;localNotice='';update();return;
    case "gun-sub-close":localPanel='none';localNotice='';update();return;
    case "gun-protection-locked":localNotice='合成保护在普通第40大关开放';update();return;
    case "gun-protect":{if(localPanel!=='gun-info'||!gunDetail)return;const r=sourceGunProtection(session,gunDetail,Boolean(payload));session=r.session;localNotice=r.reason;saveProgress();update();return;}
    case "gun-safe-deposit":{if(session.overlay!=='gun'||localPanel!=='none')return;const r=sourceGunSafeDeposit(session,payload);session=r.session;localNotice=r.reason;saveProgress();update();return;}
    case "gun-safe-takeout":{if(localPanel!=='gun-info'||!gunDetail)return;const r=sourceGunSafeTakeOut(session,gunDetail);session=r.session;localNotice=r.reason;if(r.status==='granted'){localPanel='gun-safe';gunDetail=undefined;}saveProgress();update();return;}
    case "gun-safe-slot":{if(localPanel!=='gun-safe')return;const index=Number(payload),safe=session.gunSafe??freshSourceGunSafe();if(index<6+safe.purchased){localNotice='空保险库槽位：从武器背包拖到保险库入口存入';update();return;}const r=sourceGunSafePurchase(session,index);session=r.session;localNotice=r.reason;saveProgress();update();return;}
    case "gun":session=openGun(session);break;
    case "draw-gun":{const before=session;session=drawGun(session);if(before===session)session={...session,notice:session.gunInventory.length>=GUN_INVENTORY_CAPACITY?"库存已满":"还需要100钻石"};saveProgress();update();playNewInventoryMotion(before);return;}
    case "ad-temporary-gun":void requestAdGunReward();return;
    case "gun-drop":{const from=payload?.from,to=payload?.to;const gun=(r:any)=>r?.kind==='inventory'?session.gunInventory[r.index]:r?.kind==='equipment'?session.equippedGuns[r.index]:null;if(gun(from)?.adReward||gun(to)?.adReward){(sourcePanel as SourceGunPanelView|null)?.resolveDrop(false,"临时广告武器需先领取");void requestAdGunReward();return;}const before=session;const result=applyGunDrop(session,payload);session=result.session;(sourcePanel as SourceGunPanelView|null)?.resolveDrop(result.accepted,result.notice);if(result.fused)feedback.playFusion();localNotice=result.notice;saveProgress();update();if(result.fused){playNewInventoryMotion(before);checkAdGunAfterFusion();}return;}
    case "gun-drag-rejected":localNotice=payload.reason??"无法移动武器";return;
    case "ad-daily-gun":if(gunDailyClient.saveFailed)gunDailyClient.retrySave();else void gunDailyClient.request();return;
    case "unequip":session=unequipGun(session,payload);break;
    case "gun-drag":draggingGun=payload;return;
    case "claim-victory":diaPigPurchaseClient.invalidate();pendingChallengeReward=null;transitionScene("exit",()=>{session=claimVictory(session);});return;
    case "acknowledge-defeat":diaPigPurchaseClient.invalidate();transitionScene("exit",()=>{session=acknowledgeDefeat(session);});return;
    case "challenge-bonus":void requestChallengeBonus();return;
    case "challenge-sweep":session=sweepChallenge(session,meta.entitlements,meta.fish,meta.buffTimes,meta.relic);saveProgress();update();return;
    case "challenge-sweep-close":diaPigPurchaseClient.invalidate();pendingChallengeReward=null;session=closeChallengeSweep(session);localNotice="";saveProgress();update();return;
    case "challenge-plus-purchase":void requestWeeklyReward(2,true,"challenge");return;
    case "result-remove-ads":
    case "challenge-remove-ads":void requestDiaPigPurchase("remove_all_ads");return;
    case "freecash-open":void freeCashClient.show(String(typeof payload==="string"?payload:"banner_reward"));update();return;
    case "freecash-close":freeCashClient.close();update();return;
    case "freecash-check":if(freeCashClient.saveFailed)freeCashClient.retrySave();else void freeCashClient.request("check");update();return;
    case "freecash-link":void freeCashClient.request("link");update();return;
    case "result-offerwall":
    case "challenge-offerwall":case "offerwall-open":{const gate=offerWallProjection();if(!gate.target){localNotice=gate.reason;update();return;}void offerWallClient.show(String(payload??"banner_reward"));update();return;}
    case "mine-bonus":void requestMineResultBonus("mine");return;
    case "rebirth":session=openRebirth(session);break;
    case "permanent":session=openPermanent(session);break;
    case "confirm-rebirth":transitionScene("exit",()=>{session=confirmRebirth(session,meta.relic);});return;
    case "upgrade":{const before=session.battle.upgradeLevels[payload as UpgradeKind];session=purchase(session,payload);if(session.battle.upgradeLevels[payload as UpgradeKind]>before)feedback.playUpgrade();break;}
    case "permanent-upgrade":{const before=session.permanentLevels[payload as "damage"|"speed"|"money"];session=purchasePermanent(session,payload);if(session.permanentLevels[payload as "damage"|"speed"|"money"]>before)feedback.playUpgrade();break;}
    case "start-challenge":transitionScene("enter",()=>{session=startChallenge(session);});return;
    case "start-mine":if(pendingMineSpeedReward){localNotice="矿场广告处理中，请等待或关闭入口";update();return;}enterScene(()=>startMine(session,undefined,meta.entitlements.minePack,meta.entitlements,meta.fish,meta.pet,meta.buffTimes,meta.relic));return;
    case "exit-challenge":transitionScene("exit",()=>{session=exitChallenge(session);});return;
    case "start-boss":transitionScene("enter",()=>{session=startBoss(session,meta.entitlements);if(session.mode==="boss")localPanel="none";});return;
    case "boss-sweep":{session=sweepBoss(session,meta.entitlements,meta.fish,meta.pet,meta.buffTimes,meta.relic);if(session.mode==="boss-result")localPanel="none";saveProgress();update();return;}
    case "boss-bonus":void requestBossResultBonus();return;
    case "exit-boss":bossResultRewardClient.invalidate();transitionScene("exit",()=>{session=exitBoss(session);localPanel="none";});return;
    case "gun-auto-set":meta={...meta,gunAutoMerge:sourceGunSetAutoMerge(meta.gunAutoMerge,Boolean(payload),meta.entitlements.plusPack2Active)};saveProgress();update();return;
    case "gun-auto-shop":meta={...meta,gunAutoMerge:{...meta.gunAutoMerge,autoMergeRequested:false}};openWeeklyAuto("none");return;
    case "gun-auto-fuse":{const before=session,result=sourceGunAutoMergeOnce(session,meta.gunAutoMerge,meta.entitlements.plusPack2Active,payload as SourceGunAutoCommit);if(result.status==="granted"){session=result.session;saveProgress();update();playNewInventoryMotion(before);checkAdGunAfterFusion();if(result.resultSlot!==undefined&&(sourcePanel as SourceGunPanelView|null)?.playSpawnBounceAtSlot)(sourcePanel as SourceGunPanelView).playSpawnBounceAtSlot(result.resultSlot);}else if(sourcePanel&&"resolveAutoMerge"in sourcePanel)(sourcePanel as SourceGunPanelView).resolveAutoMerge(false);return;}
    case "exit-mine":pendingMineResultReward=null;diaPigPurchaseClient.invalidate();transitionScene("exit",()=>{session=exitMine(session);});return;
    case "package-purchase":void requestShopPurchase(String(payload));return;
    case "shop-purchase":void requestShopPurchase(String(payload));return;
    case "mission-claim":passClient.mission(payload.id??payload,!!payload.luxury);update();return;
    case "pass-claim":if((payload.track??0)===1&&!meta.vip){passPopup='vip';update();return;}void passClient.claim(payload.track??0,payload.index??payload).finally(update);return;
    case "pass-purchase":void passClient.purchase(payload??'vip').finally(update);return;
    case 'pass-popup-open':passClient.refresh();passPopup=payload==='next'?'next':payload==='luxury'?'luxury':'vip';localNotice='';update();return;
    case 'pass-popup-close':passClient.invalidate();passPopup='none';localNotice='';update();return;
    case 'pass-banner-purchase':passPopup='none';void passClient.purchase('vip').finally(update);return;
    case 'pass-next':if(passClient.next())passPopup='none';update();return;
    case 'pass-retry-save':passClient.retrySave();update();return;
    case "mine-sweep":if(pendingMineSpeedReward){localNotice="矿场广告处理中，请等待或关闭入口";update();return;}applyMetaGrant(runtimeSourceMineSweep({session,activities,platform,meta}));return;
    case "sweep-bonus":void requestMineResultBonus("sweep");return;
    case "sweep-close":pendingMineResultReward=null;diaPigPurchaseClient.invalidate();({session,activities,platform,meta}=closeSourceMineSweep({session,activities,platform,meta}));break;
    case "unresolved":{const message=String(payload??"实现尚未闭合：未提供源动作路径"),names:Record<string,string>={skin:"皮肤",stepup:"阶梯活动",diapig:"钻石存钱罐"};localNotice=names[message]?`${names[message]}实现尚未闭合（非进度锁定）`:message;flash(label(localNotice,18,W/2,250,0xffe5a5),2,0);update();return;}
    default:localNotice=`实现尚未闭合：动作 ${name}`;console.error(localNotice,payload);break;
  }
  resetMovementInput();update();
}
const nativeHud=createSourceHud(loaded,W,H,onSourceAction);
hud.visible=false;
app.stage.addChildAt(nativeHud.view.root,app.stage.getChildIndex(modal));
let bossHud:ReturnType<typeof createSourceBossHud>=null;
function syncBossHud(){
  const active=session.mode==="boss"&&session.boss.run?.phase==="playing"&&!ecoMode;
  nativeHud.view.root.visible=!active;
  if(!active){bossHud?.destroy();bossHud=null;return;}
  if(!bossHud){bossHud=createSourceBossHud({textures:loaded,viewport:{width:W,height:H},session,timeMax:sourceBossTimeMax(meta.entitlements),action:onSourceAction});if(bossHud)app.stage.addChildAt(bossHud.root,app.stage.getChildIndex(modal));}
  if(bossHud)updateSourceBossHud(bossHud,session,sourceBossTimeMax(meta.entitlements));
}
let sourcePanel:ReturnType<typeof createSourcePanel>=null;
let newGunPopup:ReturnType<typeof createSourceNewGunPopup>|null=null;
const newGunQueue:Gun[]=[];
function clearNewGunQueue(){newGunPopup?.destroy();newGunPopup=null;newGunQueue.length=0;}
function openNextNewGun(){
  if(newGunPopup||!newGunQueue.length)return;
  newGunPopup=createSourceNewGunPopup({textures:loaded,viewport:{width:W,height:H},gun:newGunQueue.shift()!,close:()=>{newGunPopup?.destroy();newGunPopup=null;openNextNewGun();}});
  app.stage.addChild(newGunPopup.root);
}
function playNewInventoryMotion(before:Session) {
  const ids=new Set([...before.gunInventory,...before.equippedGuns.filter((g):g is Gun=>!!g)].map(gunEntityUID));
  const acquired=session.gunInventory.filter(g=>!g.adReward&&!ids.has(gunEntityUID(g)));
  if(sourcePanel&&'playSpawnBounceAtSlot' in sourcePanel)session.gunInventory.forEach((g,index)=>{if(!ids.has(gunEntityUID(g)))(sourcePanel as SourceGunPanelView).playSpawnBounceAtSlot(index);});
  const seen=new Set(session.catalogSeen??[0]);
  for(const gun of acquired){const id=weaponIndex(gun.id);if(!seen.has(id)){seen.add(id);newGunQueue.push(gun);}}
  session={...session,catalogSeen:[...seen].sort((a,b)=>a-b)};saveProgress();openNextNewGun();
}
let lastPanel = "";
const panelScrollMemory=new Map<string,import('./source-ui').SourceScrollSnapshot>();
let renderedPanelIdentity="";
function currentPanelIdentity(){return settingsOpen?"settings":localPanel==="adventure"?`adventure:${adventureNavigation.page}`:localPanel!=="none"?localPanel:session.overlay!=="none"?session.overlay:session.mode;}
const huntHudTree=huntHudData as unknown as SourceUiTree;
const HUNT_HUD='/Canvas/SafeArea/Monster_UI';
let liveHunt:SourceHuntClientOwner|null=null,huntScene:SourceHuntSceneView|null=null,huntHud:SourceUiView|null=null;
let huntContext=0,huntLoadingElapsed=0;
const huntClientHistory:{kind:string;phase:string;requestID?:string;amount?:number}[]=[];
let lastHuntClient:unknown=null;
function liveHuntDiagnostics(){return {active:!!liveHunt,phase:liveHunt?.phase??'idle',ready:liveHunt?.ready??false,pending:liveHunt?.pendingBonus??false,ownsField:liveHunt?.ownsField??false,restoredField:liveHunt?.restoredField??false,runID:liveHunt?.runID,frameCount:liveHunt?.frameCount??0,renderCount:liveHunt?.renderCount??0,elapsed:liveHunt?.host.elapsedSeconds??0,attacks:liveHunt?.attackCount??0,hits:liveHunt?.hitCount??0,cats:liveHunt?.host.cats.map(c=>({componentID:c.componentID,slot:c.slotNum,position:c.movement.position}))??[],wait:liveHunt?.host.waitSeconds??0,notice:localNotice,petCoin:meta.petCoin,hunt:meta.hunt,claims:meta.huntSettlementClaims??[],field:{elapsed:session.battle.elapsed,player:{...session.battle.player},mode:session.mode},monsters:liveHunt?[...liveHunt.host.monsters.activeMonsters()].map(m=>({id:m.id,health:m.health.toString(),position:m.position})):[],projectiles:liveHunt?.host.projectiles.activeCount??0,history:[...huntClientHistory],lastRun:lastHuntClient,limitations:HUNT_SCENE_LIMITATIONS,onlineConnected:false};}
function cancelLiveHunt(){
 cancelLiveRaid();huntContext++;if(liveHunt){lastHuntClient={runID:liveHunt.runID,phase:liveHunt.phase,frames:liveHunt.frameCount,renders:liveHunt.renderCount,elapsed:liveHunt.host.elapsedSeconds};liveHunt.cancel();}liveHunt=null;huntLoadingElapsed=0;resetMovementInput();
}
function syncLiveHuntHUD(){
 if(!liveHunt||!huntHud)return;
 const host=liveHunt.host,s=meta.hunt,playing=host.phase==='playing';
 huntHud.patch({active:{[HUNT_HUD]:!['ended','disposed','exit-field-wait','exit-mask-wait'].includes(host.phase),[HUNT_HUD+'/StageClear_obj']:host.phase==='next-level-wait',[HUNT_HUD+'/GameExplain_obj']:host.phase==='enter-loading'},text:{[HUNT_HUD+'/PetCoint_Value/Value_txt']:String(s.run?.accumulatedPetCoin??0),[HUNT_HUD+'/Monster_Game_Slider/Value_txt']:`${host.monsters.killedCount}/${SOURCE_HUNT_MONSTER_COUNTS[host.monsters.level]??90}`,[HUNT_HUD+'/Game_Slider/Wave_txt']:`Wave ${s.wave+1}-${s.level+1}`,[HUNT_HUD+'/Exit_Btn/I2_txt(Outline)']:'退出',[HUNT_HUD+'/GameExplain_obj/Panel/Explain_txt']:'击败史莱姆获得宠物币；退出会按源规则结算。',[HUNT_HUD+'/StageClear_obj/Panel/I2_txt(Outline)']:'关卡完成'},fills:{[HUNT_HUD+'/Monster_Game_Slider/Value_Fill']:playing?host.monsters.progress:0,[HUNT_HUD+'/Game_Slider/Fill_Basic/Fill']:(s.level+(playing?host.monsters.progress:0))/5}});
}
async function enterLiveHunt(){
 if(liveHunt||liveRaid||platformPending||transition.active||settingsOpen||session.overlay!=='none')return;
 const context=++huntContext;
 let owner:SourceHuntClientOwner;
 try{
  owner=new SourceHuntClientOwner(`hunt:${crypto.randomUUID()}`,{
   read:()=>({session,activities,platform,meta}),current:()=>huntContext===context&&liveHunt===owner,
   random:()=>Math.random(),notice:text=>{localNotice=text;},
   write:bundle=>{({session,activities,platform,meta}=bundle);saveProgress();},
   events:events=>{
    for(const e of events){if(e.kind==='phase'){if(e.phase==='ended'){localPanel='monster';resetMovementInput();}else localPanel='none';lastPanel='';}
     if(e.kind==='phase'||e.kind==='settlement'||e.kind==='restore-field')huntClientHistory.push({kind:e.kind==='settlement'?e.action:e.kind,phase:owner.host.phase,...(e.kind==='settlement'?{requestID:e.requestID,amount:e.result.petCoinGrant}:{})});}
    if(huntClientHistory.length>400)huntClientHistory.splice(0,huntClientHistory.length-400);
   },
   scene:host=>{
    const view=new SourceHuntSceneView(host,W,H);huntScene=view;huntWorldLayer.addChild(view.root);
    let ownedHud:SourceUiView|null=null;
    return {
     prepare:async()=>{
      const urls=huntHudTree.nodes.flatMap(n=>n.components.map(c=>c.data?.textureURL??huntHudTree.sprites[c.data?.spriteKey]?.url).filter((v):v is string=>!!v));
      const params=new URLSearchParams(location.search),delay=qaFixtureActive?Math.min(5000,Math.max(0,Number(params.get('hunt-prepare-delay'))||0)):0;
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      if(qaFixtureActive&&params.get('hunt-prepare-outcome')==='failure')throw Error('明示QA资源失败夹具');
      await Promise.all([view.prepare(),...Array.from(new Set(urls),async url=>{loaded[url]=await Assets.load<Texture>(url);})]);
      if(huntContext!==context||liveHunt!==owner||owner.closed||!view.ready)return;
      for(const rig of view.rigs.values())rig.setSkin(rigSkinAssets,(session.skin??freshSourceSkinState()).selected);
      ownedHud=createSourceUiView({tree:huntHudTree,roots:[HUNT_HUD],textures:loaded,viewport:{width:W,height:H},active:{[HUNT_HUD]:true,'/Canvas':true,'/Canvas/SafeArea':true}});
      ownedHud.bindAction(HUNT_HUD+'/Exit_Btn',()=>{if(liveHunt===owner){owner.giveUp();resetMovementInput();update();}});
      huntHud=ownedHud;huntHudLayer.addChild(ownedHud.root);
     },adapter:random=>view.adapter(random),consume:(events,dt)=>view.consume(events,dt),render:dt=>view.render(dt),setPresentationEnabled:enabled=>view.setPresentationEnabled(enabled),
     destroy:()=>{ownedHud?.destroy();if(huntHud===ownedHud)huntHud=null;if(huntScene===view)huntScene=null;view.destroy();}
    };
   }
  });
 }catch(error){localNotice=String(error);update();return;}
 liveHunt=owner;qaFreeze=false;huntLoadingElapsed=0;localPanel='none';localNotice='正在准备狩猎源资源；普通战斗暂停，尚未进入狩猎。';resetMovementInput();clearFleetingEffects();feedback.setMusicMode('contents');update();
 const started=await owner.start();
 if(huntContext!==context||liveHunt!==owner)return;
 if(!started){liveHunt=null;localPanel='monster';feedback.setMusicMode('main');}
 else localNotice='实时狩猎已接入；源2秒入场等待。音频与障碍层原机对照未闭合。';
 lastPanel='';update();
}
async function requestLiveHuntBonus(){
 const owner=liveHunt;if(!owner||settingsOpen)return;
 const pending=owner.bonus(localBuffResponse);localNotice='本地测试广告处理中 · 不播放真实广告';lastPanel='';update();
 await pending;if(liveHunt!==owner)return;lastPanel='';update();
}
const RAID_HUD='/Canvas/SafeArea/Raid_UI',raidHudTree=raidHudData as unknown as SourceUiTree;
let liveRaid:SourceRaidClientOwner|null=null,raidScene:SourceRaidSceneView|null=null,raidHud:SourceUiView|null=null;
let raidContext=0,raidLoadingElapsed=0,lastRaidClient:unknown=null;
const raidClientHistory:{kind:string;phase:string;reason?:string;id?:string}[]=[];
function liveRaidDiagnostics(){return {active:!!liveRaid,phase:liveRaid?.phase??'idle',ready:liveRaid?.ready??false,pending:liveRaid?.pending??false,ownsField:liveRaid?.ownsField??false,restoredField:liveRaid?.restoredField??false,runID:liveRaid?.runID,frameCount:liveRaid?.frameCount??0,renderCount:liveRaid?.renderCount??0,remaining:liveRaid?.host.remainingSeconds??0,score:liveRaid?.host.score??0,attacks:raidScene?.attackCount??0,hits:liveRaid?.hitCount??0,wait:liveRaid?.waitSeconds??0,raid:meta.raid,mission:meta.raidMission,pig:meta.raidStarPig,starGem:session.starGem,field:{elapsed:session.battle.elapsed},failures:{simulation:liveRaid?.simulationFailure,presentation:liveRaid?.presentationFailure,save:liveRaid?.saveFailure},history:[...raidClientHistory],hud:raidHud?[...raidHud.layout.values()]:[],hudTexts:raidHud?Object.fromEntries([...raidHud.texts].map(([id,t])=>[id,t.text])):{},last:lastRaidClient,limits:RAID_SCENE_LIMITATIONS};}
function cancelLiveRaid(){raidContext++;if(liveRaid){lastRaidClient={runID:liveRaid.runID,phase:liveRaid.phase,frames:liveRaid.frameCount,renders:liveRaid.renderCount,score:liveRaid.host.score,hits:liveRaid.hitCount,attacks:raidScene?.attackCount,remaining:liveRaid.host.remainingSeconds};liveRaid.cancel();}liveRaid=null;raidLoadingElapsed=0;resetMovementInput();}
function syncLiveRaidHUD(){if(!liveRaid||!raidHud)return;const host=liveRaid.host,enemy=host.boss.enemy,currency=sourceRaidHUDCurrency(session);
 raidHud.patch({text:{[RAID_HUD+'/Time_Slider/Time_txt']:String(Math.max(0,Math.ceil(host.remainingSeconds))),[RAID_HUD+'/HP_Slider/HP_txt']:`${enemy.health.format(3)} / ${enemy.maxHealth.format(3)}`,[RAID_HUD+'/HP_Slider/Score_txt']:String(host.score),[RAID_HUD+'/HighScore_txt']:String(meta.raid.bestLevel),[RAID_HUD+'/Currency/Dia/Price_txt']:currency.diamonds,[RAID_HUD+'/Currency/Money/Price_txt']:currency.money},fills:{[RAID_HUD+'/Time_Slider/Fill']:Math.max(0,host.remainingSeconds/host.maximumSeconds),[RAID_HUD+'/HP_Slider/Fill']:enemy.health.fractionOf(enemy.maxHealth)}});
}
async function enterLiveRaid(){
 if(liveRaid||liveHunt||platformPending||transition.active||settingsOpen||session.overlay!=='none'||raidMissionClient.pending||raidHelperClient.pending||raidStarPigClient.pending)return;
 refreshRaidClock();const gate=sourceRaidEntryGate(meta.raid,{historicMax:session.historicMax,ready:true,selectedCount:raidSelection.filter(Boolean).length,pending:false});if(gate){localNotice=gate;update();return;}
 const context=++raidContext;let owner:SourceRaidClientOwner;
 try{owner=new SourceRaidClientOwner(`raid:${crypto.randomUUID()}`,raidSelection,{
  read:()=>({session,meta,activities,platform}),current:()=>raidContext===context&&liveRaid===owner,
  // Publish only after serialization/storage succeeds. Owner retry uses same committed delta.
  write:(bundle,reason)=>{const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));({session,meta,activities,platform}=bundle);raidClientHistory.push({kind:'save',phase:owner.phase,reason});},
  notice:text=>{localNotice=text;},events:events=>{for(const e of events){raidClientHistory.push({kind:e.kind==='battle'?e.event.kind:e.kind,phase:owner.phase});if(e.kind==='phase'||e.kind==='restore-field'){resetMovementInput();lastPanel='';}}if(raidClientHistory.length>400)raidClientHistory.splice(0,raidClientHistory.length-400);},
  async execute(request){raidClientHistory.push({kind:'provider-request',phase:owner.phase,id:request.id});const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome');if(qaFixtureActive&&outcome==='delayed-success')await new Promise(resolve=>setTimeout(resolve,2000));const response=await createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||(request.kind==='ad'?platform.developerEnabled&&platform.freeAds:purchaseSimulationEnabled())),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);raidClientHistory.push({kind:'provider-'+response.status,phase:owner.phase,id:request.id});return response;},
  scene:(host,selection)=>{const view=new SourceRaidSceneView(host,{session,meta,activities,platform},selection,sourceWeekOffset(new Date(stepUpClock())),W,H);raidScene=view;raidWorldLayer.addChild(view.root);let ownedHud:SourceUiView|null=null;
   return new SourceRaidCatClientScene(host,selection,{read:()=>({session,meta,activities,platform}),
    prepare:async()=>{const params=new URLSearchParams(location.search),delay=qaFixtureActive?Math.min(5000,Math.max(0,Number(params.get('raid-prepare-delay'))||0)):0;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));if(qaFixtureActive&&params.get('raid-prepare-outcome')==='failure')throw Error('明示QA资源准备失败');
     const urls=raidHudTree.nodes.flatMap(n=>n.components.map(c=>c.data?.textureURL??raidHudTree.sprites[c.data?.spriteKey]?.url).filter((v):v is string=>!!v));await Promise.all([view.prepare(),...Array.from(new Set(urls),async url=>{loaded[url]=await Assets.load<Texture>(url);})]);
     if(raidContext!==context||liveRaid!==owner||owner.closed||!view.ready)return;
     for(const rig of view.rigs.values())rig.setSkin(rigSkinAssets,(session.skin??freshSourceSkinState()).selected);
     ownedHud=createSourceUiView({tree:raidHudTree,roots:[RAID_HUD],textures:loaded,viewport:{width:W,height:H},active:{[RAID_HUD]:true,'/Canvas':true,'/Canvas/SafeArea':true}});ownedHud.bindAction(RAID_HUD+'/Exit_Btn',()=>{if(liveRaid===owner&&owner.exit()){resetMovementInput();update();}});const disclosure=createLocalTestNotice(ownedHud.root);disclosure.text.text='H5适配 · 本地provider／线上未连接 · 战斗音频静音';const placeDisclosure=(v:SourceUiViewport)=>{disclosure.place(v);const scale=Math.min(v.width/390,v.height/844);const exit=ownedHud!.layout.get('level0:742');disclosure.root.y=(exit?.y??v.height)-disclosure.root.height-8*scale;};placeDisclosure({width:W,height:H});const reflow=ownedHud.reflow.bind(ownedHud);ownedHud.reflow=v=>{reflow(v);placeDisclosure(v??{width:W,height:H});};raidHud=ownedHud;raidHudLayer.addChild(ownedHud.root);
    },bindCats:c=>view.bindCats(c),movementStats:()=>bindSourceHuntMovementStats(meta.pet,sourceRelicTotals(meta.relic).moveSpeedValue),followSettings:()=>view.followSettings(),adapter:()=>view.adapter(),consume:(e,f,a,dt)=>view.consume(e,f,a,dt),render:(dt,c)=>view.render(dt,c),setPresentationEnabled:v=>view.setPresentationEnabled(v),
    destroy:()=>{ownedHud?.destroy();if(raidHud===ownedHud)raidHud=null;if(raidScene===view)raidScene=null;view.destroy();}
   });}
 });}catch(error){localNotice=String(error);update();return;}
 liveRaid=owner;qaFreeze=false;raidLoadingElapsed=0;localPanel='none';localNotice='突袭源资源准备中；普通场景暂停，未扣次数、未启动战斗';resetMovementInput();clearFleetingEffects();feedback.setMusicMode('contents');update();
 const admitted=await owner.start();if(raidContext!==context||liveRaid!==owner)return;
 if(!admitted&&!owner.saveFailure){cancelLiveRaid();localPanel='raid';feedback.setMusicMode('main');}else if(admitted)localNotice='源突袭入场等待2s；真实逐弹、当前钱包与周任务已接，原机对照未完成';lastPanel='';update();
}
function currentRuntimePolicy(){const policy=runtimePolicy({transition:transition.active||!!liveHunt?.ownsField||!!liveRaid?.ownsField,frozen:qaFreeze,settings:settingsOpen,panel:offerWallClient.open||freeCashClient.open||settingsOpen||localPanel!=="none"||session.overlay!=="none",eco:ecoMode,popup:!!newGunPopup});return {...policy,combatAudio:policy.combatAudio&&!liveHunt&&!liveRaid,input:policy.input&&!liveHunt&&!liveRaid};}
const gunAutoPanelState=()=>({state:meta.gunAutoMerge,plusPack2Active:meta.entitlements.plusPack2Active,weeklyVipUnlocked:session.historicMax>=190});
let pendingBuffReward:SourceRewardRequest|null=null;
let pendingMineSpeedReward:SourceRewardRequest|null=null;
let pendingHuntResultReward:SourceHuntResultRewardRequest|null=null;
let pendingMineResultReward:SourceMineResultRewardRequest|null=null;
let pendingChallengeReward:SourceChallengeAdRequest|null=null;
let qaFreeCashExposure=false;
let pendingAdGunReward:SourceAdGunRequest|null=null;
let adGunTimer=0;
let bossResultRewardClient:SourceBossResultRewardClient;
let qaBossRewardSaveFailure=false;
let activityPurchaseClient:SourceActivityPurchaseClient;
let qaActivityPurchaseSaveFailure=false;
let weeklyMenu:0|1=0;
let weeklyReturn:'none'|'pet'='none';
let weeklyScrollToAuto=false;
let weeklyStateOwner=0;
let diaPigPurchaseClient:SourceRemoveAdsPurchaseClient;
let petDailyClient:SourcePetDailyClient;
let gunDailyClient:SourceGunDailyClient;
let autoAdClient:SourceAutoUpgradeAdClient;
let shopPurchaseClient:SourceShopPurchaseClient;
let qaShopPurchaseSaveFailure=false;
let qaAutoAdSaveFailure=false,qaAutoAdDate:string|null=null;
const autoAdDate=()=>qaAutoAdDate??localMineTime.today();
let qaGunDailySaveFailure=false;
let qaGunDailyDate:string|null=null;
function createLocalRewardProvider(available:boolean,outcome:Exclude<SourceProviderStatus,'unavailable'>='success'){return createSourceLocalRewardProvider(meta.entitlements,available,outcome);}
const gunDailyDate=()=>qaGunDailyDate??`h5-local:${localDate()}`;

let diaPigRuntime:SourceDiaPigRuntime|null=null;
let qaDiaPigOffset=0;
petDailyClient=new SourcePetDailyClient({
 read:()=>({bundle:{session,activities,platform,meta},contextID:`main:${weeklyStateOwner}`}),
 write(bundle){
  const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
  session=bundle.session;activities=bundle.activities;platform=bundle.platform;meta=bundle.meta;
 },
 todayKey:()=>sourcePetLocalDate(localDate()),
 requestID:()=>`pet-daily:${crypto.randomUUID()}`,
 async execute(request:SourcePetDailyRequest){
  const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('pet-ad-provider-delay'))||0)):0;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  const enabled=outcome!=='unavailable'&&(qaFixtureActive||platform.developerEnabled&&platform.freeAds||sourceRewardAdsRemoved(meta.entitlements));
  return createLocalRewardProvider(enabled,qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);
 },
 notice(message){localNotice=message;update();},
 granted(){feedback.playReward();update();}
});
gunDailyClient=new SourceGunDailyClient({
 read:()=>({bundle:{session,activities,platform,meta},contextID:`main:${weeklyStateOwner}`}),
 write(bundle){
  const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));
  if(qaFixtureActive&&qaGunDailySaveFailure)throw new Error('Explicit QA daily gun save failure');
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
  session=bundle.session;activities=bundle.activities;platform=bundle.platform;meta=bundle.meta;
 },
 todayKey:gunDailyDate,requestID:()=>`gun-daily:${crypto.randomUUID()}`,
 async execute(request:SourceGunDailyRequest){
  const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('gun-ad-provider-delay'))||0)):0;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||platform.developerEnabled&&platform.freeAds),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);
 },
 notice(message){localNotice=message;update();},
 granted(gun,slot){feedback.playReward();newGunQueue.push(gun);update();if(sourcePanel&&'playSpawnBounceAtSlot'in sourcePanel)(sourcePanel as SourceGunPanelView).playSpawnBounceAtSlot(slot);openNextNewGun();}
});
autoAdClient=new SourceAutoUpgradeAdClient({
 read:()=>({bundle:{session,activities,platform,meta},contextID:`main:${weeklyStateOwner}`}),
 write(bundle){
  bundle={...bundle,activities:observeActivities(bundle.activities,session,bundle.session)};
  const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));
  if(qaFixtureActive&&qaAutoAdSaveFailure)throw new Error('Explicit QA auto upgrade save failure');
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
  session=bundle.session;activities=bundle.activities;platform=bundle.platform;meta=bundle.meta;observedSession=session;
 },todayKey:autoAdDate,requestID:()=>`auto-ad:${crypto.randomUUID()}`,
 async execute(request:SourceAutoUpgradeAdRequest){
  const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('auto-ad-provider-delay'))||0)):0;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||platform.developerEnabled&&platform.freeAds),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);
 },notice(message){localNotice=message;update();},
 granted(){autoUpgradeDirtyKey="";feedback.playReward();update();}
});
bossResultRewardClient=new SourceBossResultRewardClient({
 read:()=>({bundle:{session,activities,platform,meta},contextID:`main:${weeklyStateOwner}`,resultVisible:session.mode==='boss-result'&&localPanel==='none'&&!settingsOpen&&!transition.active}),
 write(bundle){
  const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));
  if(qaFixtureActive&&qaBossRewardSaveFailure)throw new Error('Explicit QA Boss reward save failure');
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
  session=bundle.session;activities=bundle.activities;platform=bundle.platform;meta=bundle.meta;observedSession=session;
 },execute:localBuffResponse,requestID:()=>`boss-bonus:${crypto.randomUUID()}`,now:()=>new Date().toISOString(),
 notice(message){localNotice=message;update();},granted(){feedback.playReward();transitionScene('exit',()=>{localPanel='none';});}
});
activityPurchaseClient=new SourceActivityPurchaseClient({
 read:()=>({bundle:{session,activities,platform,meta},contextID:`main:${weeklyStateOwner}`}),
 write(bundle){
  const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));
  if(qaFixtureActive&&qaActivityPurchaseSaveFailure)throw new Error('Explicit QA activity purchase save failure');
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
  session=bundle.session;activities=bundle.activities;platform=bundle.platform;meta=bundle.meta;observedSession=session;
 },clock:stepUpClock,requestID:()=>`activity:${crypto.randomUUID()}`,
 async execute(request){
  const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('activity-provider-delay'))||0)):0;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||purchaseSimulationEnabled()),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);
 },notice(message){localNotice=message;update();},granted(gun){feedback.playReward();if(gun){newGunQueue.push(gun);openNextNewGun();}update();}
});
shopPurchaseClient=new SourceShopPurchaseClient({
 read:()=>({bundle:{session,activities,platform,meta},contextID:`main:${weeklyStateOwner}`}),
 write(bundle){
  const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));
  if(qaFixtureActive&&qaShopPurchaseSaveFailure)throw new Error('Explicit QA shop purchase save failure');
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
  session=bundle.session;activities=bundle.activities;platform=bundle.platform;meta=bundle.meta;observedSession=session;
 },requestID:()=>`shop:${crypto.randomUUID()}`,now:()=>new Date().toISOString(),
 async execute(request){
  const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('shop-provider-delay'))||0)):0;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||purchaseSimulationEnabled()),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);
 },notice(message){localNotice=message;update();},granted(){feedback.playReward();autoUpgradeDirtyKey='';update();}
});
// Explicit H5 adaptation: local UTC is not a trusted server clock. No offline catch-up
// is granted until the native Time_manager trust/pending ledger is implemented.
function diaPigClock(){return {nowUTC:stepUpClock()+qaDiaPigOffset*1000,monoSeconds:performance.now()/1000+qaDiaPigOffset,canGrantTimedReward:false,pendingCount:0};}
function refreshDiaPig(){const before=session.diaPig??freshSourceDiaPig(),result=diaPigRuntime?sourceDiaPigAccumulate(before,diaPigRuntime,meta.entitlements,diaPigClock()):sourceDiaPigInit(before,meta.entitlements,diaPigClock());diaPigRuntime=result.runtime;if(result.state!==before||!session.diaPig){session={...session,diaPig:result.state};saveProgress();}}
function diaPigPanelState(){return {session,entitlements:meta.entitlements,seconds:sourceDiaPigSeconds(session.diaPig??freshSourceDiaPig(),diaPigRuntime??{lastTickMono:performance.now()/1000},meta.entitlements,diaPigClock()),pending:!!diaPigPurchaseClient.pending,notice:localNotice};}
diaPigPurchaseClient=new SourceRemoveAdsPurchaseClient({
 read:()=>({bundle:{session,activities,platform,meta},runtime:diaPigRuntime,contextID:`main:${weeklyStateOwner}`}),
 write(bundle,runtime){
  const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));
  if(qaFixtureActive&&qaShopPurchaseSaveFailure)throw new Error('Explicit QA remove ads save failure');
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
  session=bundle.session;activities=bundle.activities;platform=bundle.platform;meta=bundle.meta;diaPigRuntime=runtime;observedSession=session;
 },clock:diaPigClock,
 captureScope(){const result=sourceResultContext(session,meta,localPanel==='monster');return ()=>result?sourceResultContextMatches(result,session,meta,transition.active,localPanel==='monster'):session.mode==='field'&&!transition.active;},
 requestID:()=>`diapig:${crypto.randomUUID()}`,now:()=>new Date().toISOString(),
 async execute(request){
  const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('shop-provider-delay'))||0)):0;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||purchaseSimulationEnabled()),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);
 },notice(message){localNotice=message;update();},granted(){feedback.playReward();update();}
});
async function requestDiaPigPurchase(product:string){
 if(diaPigPurchaseClient.saveFailed){diaPigPurchaseClient.retrySave(product);return;}
 if(diaPigPurchaseClient.pending||shopPurchaseClient.pending||activityPurchaseClient.pending||pendingChallengeReward||pendingMineResultReward||pendingHuntResultReward){localNotice='交易或奖励处理中，请等待回调';update();return;}
 await diaPigPurchaseClient.request(product);
}
async function requestShopPurchase(product:string){
 if(diaPigPurchaseClient.saveFailed){diaPigPurchaseClient.retrySave(product);return;}
 if(shopPurchaseClient.saveFailed){shopPurchaseClient.retrySave(product);return;}
 if(shopPurchaseClient.pending||diaPigPurchaseClient.pending||activityPurchaseClient.pending){localNotice='交易处理中，请等待回调';update();return;}
 if(product==='remove_forced_ads'||product==='remove_all_ads'){await requestDiaPigPurchase(product);return;}
 await shopPurchaseClient.request(product);
}
function checkAdGunAfterFusion(){
 const before=session,next=sourceAdGunCheckEvent(session,meta.adTemporaryGunServer===true,stepUpClock(),`ad-temp:${crypto.randomUUID()}`);
 if(next===before)return;session=next;saveProgress();update();const slot=sourceAdGunSlot(session);
 if(slot>=0&&sourcePanel&&'playSpawnBounceAtSlot'in sourcePanel)(sourcePanel as SourceGunPanelView).playSpawnBounceAtSlot(slot);
}
async function requestAdGunReward(){
 if(pendingAdGunReward||platformPending||pendingAdventureReward||pendingBuffReward)return;
 const reason=sourceAdGunWatchGate(session,stepUpClock());if(reason){localNotice=reason;update();return;}
 const temp=session.adGun!.temporary!,pending:SourceAdGunRequest={id:`ad-gun:${crypto.randomUUID()}`,purpose:'temporary-gun:9',kind:'ad',...temp},owner=weeklyStateOwner;
 pendingAdGunReward=pending;localNotice='本地测试广告处理中 · type9 · 不连接真实广告';update();
 const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),delay=qaFixtureActive?Math.min(5000,Math.max(0,Number(params.get('adgun-provider-delay'))||0)):0;
 if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 const response=await createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||platform.developerEnabled&&platform.freeAds),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(pending);
 if(pendingAdGunReward!==pending||owner!==weeklyStateOwner)return;pendingAdGunReward=null;
 const result=sourceAdGunReward(session,pending,response);session=result.session;localNotice=result.reason;
 if(result.status==='granted'){platform={...platform,claims:[...platform.claims,pending.id],sequence:platform.sequence+1,audit:[...platform.audit,{id:pending.id,kind:'ad' as const,amount:0,at:new Date().toISOString()}].slice(-100)};const gun=session.gunInventory.find(g=>gunEntityUID(g)===pending.uid);if(gun){newGunQueue.push(gun);openNextNewGun();}}
 saveProgress();update();
}
function stepUpClock(){return qaAdventureTime?Math.floor(qaAdventureTime.date.getTime()+performance.now()-qaAdventureTime.started):Date.now();}
function refreshWeekly(){
 const next=sourceWeeklyRefresh(session,new Date(stepUpClock())),rights=sourcePlusEntitlements(session.plusPack??freshSourcePlus(),meta.entitlements,stepUpClock());
 if(next!==session||rights!==meta.entitlements){session=next;meta={...meta,entitlements:rights};saveProgress();return true;}
 return false;
}
// Gun_manager/Pet_manager.AutoMerge_Change -> WeeklyShop.Open_Auto -> VIP + scroll bottom.
function openWeeklyAuto(returnPanel:'none'|'pet'){
 if(!sourceWeeklyVIPUnlocked(session)){localNotice='自动合成及Plus页在第20大关开放';update();return;}
 refreshWeekly();weeklyMenu=1;weeklyReturn=returnPanel;weeklyScrollToAuto=true;session=sourceWeeklyVisit(session,1);saveProgress();showLocalPanel('weekly');
}
function entryPlusPurchaseUI(){return {pending:!!activityPurchaseClient.pending||!!shopPurchaseClient.pending||!!diaPigPurchaseClient.pending,saveFailedProduct:activityPurchaseClient.saveFailed?activityPurchaseClient.pending?.request.purpose:undefined,localProvider:qaFixtureActive||purchaseSimulationEnabled()};}
function weeklyPanelState(){return {session,entitlements:meta.entitlements,nowUTC:stepUpClock(),menu:weeklyMenu,petCoin:meta.petCoin,pending:!!activityPurchaseClient.pending,saveFailedProduct:activityPurchaseClient.saveFailed?activityPurchaseClient.pending?.request.purpose:undefined,notice:localNotice};}
async function requestWeeklyReward(item:number,isPlus:boolean,fromEntry:false|true|'challenge'|'boss'|'hunt'=false){
 const family=isPlus?'plus':'weekly';
 if(activityPurchaseClient.saveFailed){activityPurchaseClient.retrySave(family,item);return;}
 if(activityPurchaseClient.pending||shopPurchaseClient.pending||diaPigPurchaseClient.pending){localNotice='交易处理中，请等待回调';update();return;}
 if(fromEntry==='boss'||fromEntry==='hunt'){const reason=!isPlus?'原Plus横幅不接受周枪交易':sourceEntryPlusPurchaseGate(fromEntry,item,{historicMax:session.historicMax,mode:session.mode,overlay:session.overlay,localPanel,running:fromEntry==='boss'?!!session.boss.run:!!meta.hunt.run||!!liveHunt},meta.entitlements);if(reason){localNotice=reason;update();return;}}else if(fromEntry==='challenge'){if(!isPlus||item!==2||session.mode!=='field'||session.overlay!=='challenge'||localPanel!=='none'||!sourceChallengePlusBannerVisible(session.historicMax,meta.entitlements.plusPack2Active)){localNotice='挑战Plus自动横幅条件不满足';update();return;}}else if(fromEntry){if(!isPlus||item!==1||session.mode!=='field'||session.overlay!=='mine'||localPanel!=='none'||!sourceMinePlusBannerVisible(session.historicMax,meta.entitlements)){localNotice='矿场Plus奖励横幅条件不满足';update();return;}}else if(localPanel!=='weekly')return;
 refreshWeekly();await activityPurchaseClient.request(family,item);
}

let offerWallNotice='',offerWallInputOpen=false;let qaOfferWallSaveFailure:boolean|'reservation'|'wallet'=false;
function writeOfferWall(state:ReturnType<typeof freshSourceOfferWall>,diamonds:number){
 const nextSession={...session,diamonds},nextMeta={...meta,offerWall:state},envelope=JSON.parse(serializeSession(nextSession));
 envelope.activities=JSON.parse(serializeActivityState(activities));envelope.platform=platform;envelope.meta=JSON.parse(serializeSourceMetaState(nextMeta));
 if(qaFixtureActive&&(qaOfferWallSaveFailure===true||qaOfferWallSaveFailure==='reservation'&&!!state.pending&&!state.localDebits.some(d=>d.id===state.pending!.id)||qaOfferWallSaveFailure==='wallet'&&diamonds!==session.diamonds))throw Error(`明示QA存档失败：${qaOfferWallSaveFailure}`);
 if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));session=nextSession;meta=nextMeta;
}
function offerWallProjection(){return sourceOfferWallExposure(session.historicMax,true,offerWallClient.connected,qaFixtureActive||platform.developerEnabled?{minDisplayStage:SOURCE_OFFERWALL.type1MinDisplayStage}:null);}
const offerWallClient=new SourceOfferWallClient({
 read:()=>({state:meta.offerWall??freshSourceOfferWall(),diamonds:session.diamonds,contextID:`main:${weeklyStateOwner}`,saveLoaded:true}),
 write:writeOfferWall,requestID:()=>`offerwall:${crypto.randomUUID()}`,now:()=>performance.now(),notice:n=>{offerWallNotice=n;queueMicrotask(update);},
 async execute(q,contextID){
  const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),available=outcome!=='unavailable'&&(qaFixtureActive||platform.developerEnabled),epochOwner=weeklyStateOwner;
  const provider=createLocalOfferWallProvider({available,outcome:qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success',contentReady:params.get('offerwall-no-content')!=='1',
   read:()=>meta.offerWall??freshSourceOfferWall(),debit:request=>{if(contextID!==`main:${weeklyStateOwner}`||epochOwner!==weeklyStateOwner)throw Error('OfferWall stale provider context');writeOfferWall(sourceOfferWallDebit(meta.offerWall??freshSourceOfferWall(),request),session.diamonds);}});
  const delay=qaFixtureActive?Math.min(30000,Math.max(0,Number(params.get('offerwall-provider-delay'))||0)):0;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  if(contextID!==`main:${weeklyStateOwner}`||epochOwner!==weeklyStateOwner)throw Error('OfferWall replaced context');
  return provider.execute(q);
 }
});
const offerWallSurface=createOfferWallTestSurface({close:()=>{offerWallClient.dismiss();update();},claim:()=>{void offerWallClient.claim();update();},seed:()=>{
 if(!qaFixtureActive)throw Error('Explicit isolated QA only');const state=meta.offerWall??freshSourceOfferWall();if(state.localBalance>2147483647-17){offerWallNotice='QA余额达到源int32上限，未注入';update();return;}writeOfferWall({...state,localBalance:state.localBalance+17},session.diamonds);offerWallNotice='QA注入SDK已赚余额 +17；不代表原奖励或线上任务';update();
}});
function syncOfferWall(){
 if(offerWallInputOpen!==offerWallClient.open){resetMovementInput();offerWallInputOpen=offerWallClient.open;}
 offerWallSurface.sync({open:offerWallClient.open,connected:offerWallClient.connected,contentReady:offerWallClient.contentReady,pending:!!offerWallClient.pending||offerWallClient.claiming,balance:meta.offerWall?.localBalance??0,reserved:meta.offerWall?.pending?.amount??0,notice:offerWallNotice,qa:qaFixtureActive});
}
let freeCashProvider:FreeCashProvider|null=null,freeCashProviderKey='',freeCashNotice='';
let freeCashView:ReturnType<typeof createSourceFreeCashPanel>|null=null,qaFreeCashSaveFailure=false;
function freeCashBannerProjection(){
 const config=qaFixtureActive||platform.developerEnabled?freeCashScene.type1Defaults:null;
 const result=sourceFreeCashExposure(meta.freeCash??freshSourceFreeCash(),freeCashClient.sdkStatus,session.historicMax,config);
 // Existing result fixtures explicitly force SDK exposure, never ordinary progress.
 return qaFixtureActive&&qaFreeCashExposure&&!meta.freeCash?.isLinkRewardReceived?{...result,featureEnabled:true,exposureTarget:true}:result;
}
const freeCashClient=new SourceFreeCashClient({
 read:()=>({state:meta.freeCash??freshSourceFreeCash(),entitlements:meta.entitlements,contextID:`main:${weeklyStateOwner}`,saveLoaded:true}),
 write(state,entitlements){
  const nextMeta={...meta,freeCash:state,entitlements};const envelope=JSON.parse(serializeSession(session));envelope.activities=JSON.parse(serializeActivityState(activities));envelope.platform=platform;envelope.meta=JSON.parse(serializeSourceMetaState(nextMeta));
  if(qaFixtureActive&&qaFreeCashSaveFailure)throw Error('明示QA存档写入失败');
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));meta=nextMeta;
 },requestID:()=>`freecash:${crypto.randomUUID()}`,
 async execute(q){
  const params=new URLSearchParams(location.search),available=params.get('provider-outcome')!=='unavailable'&&(qaFixtureActive||platform.developerEnabled),outcome=params.get('provider-outcome'),key=String(available)+':'+outcome;
  if(!freeCashProvider||key!==freeCashProviderKey){freeCashProvider=createLocalFreeCashProvider(available,qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success');freeCashProviderKey=key;}
  const delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('freecash-provider-delay'))||0)):0;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  // Init success has its own explicit branch; failure/cancel fixtures target check/link.
  if(q.operation==='init'&&available)return {...q,status:'success',provider:'local-test',onlineVerified:false,sdkStatus:'linkable'};
  return freeCashProvider.execute(q);
 },notice(message){freeCashNotice=message;update();}
});
let freeCashInputOpen=false;
function syncFreeCashOverlay(){
 // Also covers provider-driven auto-close; held input must never resume behind a page.
 if(freeCashInputOpen!==freeCashClient.open){resetMovementInput();freeCashInputOpen=freeCashClient.open;}
 if(freeCashClient.open){if(!freeCashView){freeCashView=createSourceFreeCashPanel(loaded,W,H,onSourceAction);freeCashLayer.addChild(freeCashView.root);}syncSourceFreeCashPanel(freeCashView,freeCashClient,meta.freeCash??freshSourceFreeCash(),freeCashNotice);}
 else if(freeCashView){freeCashView.destroy();freeCashView=null;}
 freeCashLayer.visible=freeCashClient.open;
 // Prevent key/pointer forwarding while keeping original underlying panel instance/scroll.
 modal.eventMode=freeCashClient.open?'none':'auto';
}

function raidMissionPanelState(){return {state:meta.raidMission??freshSourceRaidMission(),raid:meta.raid,nowUTC:stepUpClock(),ticketOpen:raidMissionTicketOpen,pending:raidMissionClient.pending,notice:localNotice};}
function passClock(){const clock=localSourcePassClock(qaFixtureActive&&qaPassDate?new Date(qaPassDate):new Date());return {...clock,canRolloverDaily:session.mode==='field'&&!transition.active};}
const passClient=new SourcePassClient({
 read:()=>({bundle:{session,meta,activities,platform},contextID:`main:${weeklyStateOwner}`}),
 write(bundle){
  const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));
  if(qaFixtureActive&&qaPassSaveFailure)throw Error('明示QA存档失败夹具');
  if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));
  session=bundle.session;meta=bundle.meta;activities=bundle.activities;platform=bundle.platform;
 },
 clock:passClock,requestID:()=>`pass:${crypto.randomUUID()}`,
 async execute(request){
  const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome'),delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('pass-provider-delay'))||0)):0;
  const enabled=outcome!=='unavailable'&&(qaFixtureActive||(request.kind==='ad'?platform.developerEnabled&&platform.freeAds:purchaseSimulationEnabled()));
  const provider=createLocalRewardProvider(enabled,qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success');
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return provider.execute(request);
 },
 notice(message){localNotice=message;update();},
 allRewardsClaimed(){passPopup='forced';update();}
});
const raidMissionClient=new SourceRaidMissionClient({
 read:()=>({bundle:{session,meta,activities,platform},contextID:`main:${weeklyStateOwner}`}),
 write(bundle){const envelope=JSON.parse(serializeSession(bundle.session));envelope.activities=JSON.parse(serializeActivityState(bundle.activities));envelope.platform=bundle.platform;envelope.meta=JSON.parse(serializeSourceMetaState(bundle.meta));if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));session=bundle.session;meta=bundle.meta;},
 requestID:()=>`raid-mission:${crypto.randomUUID()}`,
 async execute(request){const outcome=new URLSearchParams(location.search).get('provider-outcome');return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||purchaseSimulationEnabled()),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);},
 notice(message){localNotice=message;update();},ticketPopup(){raidMissionTicketOpen=true;update();}
});
async function requestRaidMissionPurchase(){refreshRaidClock();const ok=raidMissionClient.saveFailed?raidMissionClient.retrySave():await raidMissionClient.purchase();if(ok)raidMissionTicketOpen=false;update();}
function raidHelperPanelState(){return {state:meta.raid,weakType:sourceRaidWeakType(meta.raid.seasonIndex),historicMax:session.historicMax,pending:raidHelperClient.pending,notice:localNotice};}
const raidHelperClient=new SourceRaidHelperClient({
 read:()=>({state:meta.raid,historicMax:session.historicMax,contextID:`main:${weeklyStateOwner}`}),
 write(state){const nextMeta={...meta,raid:state};const envelope=JSON.parse(serializeSession(session));envelope.activities=JSON.parse(serializeActivityState(activities));envelope.platform=platform;envelope.meta=JSON.parse(serializeSourceMetaState(nextMeta));if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));meta=nextMeta;},
 requestID:()=>`raid-helper:${crypto.randomUUID()}`,
 async execute(request){const outcome=new URLSearchParams(location.search).get('provider-outcome');return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||purchaseSimulationEnabled()),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);},
 notice(message){localNotice=message;update();}
});
async function requestRaidHelperPurchase(){refreshRaidClock();const ok=raidHelperClient.saveFailed?raidHelperClient.retrySave():await raidHelperClient.purchase();if(ok&&localPanel==='raid-helper')localPanel='raid';update();}
function raidStarPigPanelState(){return {state:meta.raidStarPig??freshSourceRaidStarPig(),historicMax:session.historicMax,pending:raidStarPigClient.pending,notice:localNotice};}
const raidStarPigClient=new SourceRaidStarPigClient({
 read:()=>({state:meta.raidStarPig??freshSourceRaidStarPig(),starGem:session.starGem??0,historicMax:session.historicMax,contextID:`main:${weeklyStateOwner}`}),
 write(state,starGem){const nextSession={...session,starGem},nextMeta={...meta,raidStarPig:state};const envelope=JSON.parse(serializeSession(nextSession));envelope.activities=JSON.parse(serializeActivityState(activities));envelope.platform=platform;envelope.meta=JSON.parse(serializeSourceMetaState(nextMeta));if(!qaFixtureActive)gameStorage.setItem(SAVE_KEY,JSON.stringify(envelope));session=nextSession;meta=nextMeta;},
 requestID:()=>`raid-pig:${crypto.randomUUID()}`,
 async execute(request){const outcome=new URLSearchParams(location.search).get('provider-outcome');return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||purchaseSimulationEnabled()),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);},
 notice(message){localNotice=message;update();}
});
async function requestRaidStarPigPurchase(){refreshRaidClock();if(raidStarPigClient.saveFailed)raidStarPigClient.retrySave();else await raidStarPigClient.purchase();update();}
function refreshStepUp(){const next=sourceStepUpReload(session,stepUpClock());if(next!==session){session=next;saveProgress();}}
async function requestStepUpReward(step:number){
 if(activityPurchaseClient.saveFailed){activityPurchaseClient.retrySave('stepup',step);return;}
 if(activityPurchaseClient.pending||shopPurchaseClient.pending||diaPigPurchaseClient.pending){localNotice='交易处理中，请等待回调';update();return;}
 if(localPanel!=='stepup')return;
 await activityPurchaseClient.request('stepup',step);
}

async function localBuffResponse(pending:SourceRewardRequest){
 const query=new URLSearchParams(location.search),outcome=query.get('provider-outcome');
 const delay=qaFixtureActive?Math.min(5000,Math.max(0,Number(query.get('reward-provider-delay'))||0)):0;
 if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 return createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||platform.developerEnabled&&platform.freeAds||sourceRewardAdsRemoved(meta.entitlements)),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(pending);
}
async function requestBuffReward(kind:SourceBuffKind){
 if(!SOURCE_BUFF_KINDS.includes(kind)||pendingBuffReward||pendingMineSpeedReward||meta.entitlements.buffPack)return;
 const pending:SourceRewardRequest={id:`buff:${crypto.randomUUID()}`,purpose:`buff:${kind}`,kind:'ad'},owner=weeklyStateOwner;
 pendingBuffReward=pending;localNotice='本地测试 provider：不会播放真实广告';update();
 const response=await localBuffResponse(pending);
 if(pendingBuffReward!==pending||weeklyStateOwner!==owner)return;
 const claim=sourceClaimBuffReward({times:meta.buffTimes,claimedRequestIDs:meta.buffRewardClaims},pending,response,kind);
 if(claim.status==='granted')meta={...meta,buffTimes:claim.state.times,buffRewardClaims:claim.state.claimedRequestIDs};
 pendingBuffReward=null;localNotice=claim.status==='granted'?'本地测试广告奖励：增益 +5分钟（最多15分钟）':response.status==='unavailable'?'广告服务未连接；开发者通道可启用明示本地测试':`本地测试回调：${response.status}，未发奖励`;
 saveProgress();update();
}
async function requestBossResultBonus(){
 if(platformPending||shopPurchaseClient.pending||diaPigPurchaseClient.pending||activityPurchaseClient.pending||settingsOpen||transition.active)return;
 if(bossResultRewardClient.saveFailed)bossResultRewardClient.retrySave();else await bossResultRewardClient.request();
 update();
}
async function requestHuntResultBonus(){
 const run=meta.hunt.run;
 if(localPanel!=='monster'||session.mode!=='field'||run?.phase!=='ended'||run.automaticBonus||run.bonusClaimed||pendingHuntResultReward||diaPigPurchaseClient.pending||settingsOpen||transition.active)return;
 const pending:SourceHuntResultRewardRequest={id:`hunt-bonus:${crypto.randomUUID()}`,purpose:'hunt:bonus',kind:'ad',run},owner=weeklyStateOwner;
 pendingHuntResultReward=pending;localNotice='本地测试广告处理中 · 不播放真实广告';update();
 const response=await localBuffResponse(pending);
 if(pendingHuntResultReward!==pending||weeklyStateOwner!==owner)return;pendingHuntResultReward=null;
 if(localPanel!=='monster'||settingsOpen||transition.active){localNotice='狩猎结算上下文已改变；未发宠物币';update();return;}
 const result=sourceHuntResultReward({hunt:meta.hunt,petCoin:meta.petCoin,claims:platform.claims},pending,response);localNotice=result.reason;
 if(result.status==='granted'){
  meta={...meta,hunt:result.state.hunt,petCoin:result.state.petCoin};
  platform={...platform,claims:result.state.claims,sequence:platform.sequence+1,audit:[...platform.audit,{id:pending.id,kind:'ad' as const,amount:result.amount,at:new Date().toISOString()}].slice(-100)};
  if(run.mode==='fight')localPanel='none';feedback.playReward();
 }
 saveProgress();update();
}
async function requestMineResultBonus(resultKind:'mine'|'sweep'){
 const context=sourceResultContext(session,meta,localPanel==='monster');
 if(!context||context.kind!==(resultKind==='mine'?'mine':'mine-sweep')||pendingMineResultReward||diaPigPurchaseClient.pending||localPanel!=='none'||settingsOpen||transition.active)return;
 const settlement=resultKind==='mine'?session.mine.settlement:meta.sweep;if(!settlement||settlement.bonusClaimed)return;
 const pending:SourceMineResultRewardRequest={id:`${resultKind}-bonus:${crypto.randomUUID()}`,purpose:resultKind==='mine'?'mine:bonus':'mine-sweep:bonus',kind:'ad',resultKind,sweepSequence:meta.sweepSequence},owner=weeklyStateOwner;
 pendingMineResultReward=pending;localNotice='本地测试广告处理中 · 不播放真实广告';update();
 const response=await localBuffResponse(pending);
 if(pendingMineResultReward!==pending||weeklyStateOwner!==owner)return;pendingMineResultReward=null;
 if(!sourceResultContextMatches(context,session,meta,transition.active)){localNotice='结算已关闭或改变；未发奖';update();return;}
 const result=sourceMineResultReward({diamonds:session.diamonds,settlement:session.mine.settlement,sweep:meta.sweep,sweepSequence:meta.sweepSequence,claims:platform.claims},pending,response);localNotice=result.reason;
 if(result.status==='granted'){
  session={...session,diamonds:result.state.diamonds,mine:{...session.mine,settlement:result.state.settlement}};meta={...meta,sweep:result.state.sweep};
  platform={...platform,claims:result.state.claims,sequence:platform.sequence+1,audit:[...platform.audit,{id:pending.id,kind:'ad' as const,amount:result.amount,at:new Date().toISOString()}].slice(-100)};feedback.playReward();
 }
 saveProgress();
 if(result.status==='granted'&&resultKind==='mine')transitionScene("exit",()=>{session=exitMine(session);});else update();
}
async function requestChallengeBonus(){
 const settlement=session.challengeSettlement;
 if(pendingChallengeReward||diaPigPurchaseClient.pending||!settlement||settlement.bonusClaimed||settlement.automaticBonus)return;
 if(localPanel!=='none'||settingsOpen||transition.active)return;
 const pending:SourceChallengeAdRequest={id:`challenge-bonus:${crypto.randomUUID()}`,purpose:'challenge:bonus',kind:'ad',runID:settlement.runID},owner=weeklyStateOwner;
 pendingChallengeReward=pending;localNotice='本地测试广告处理中 · 不播放真实广告';update();
 const response=await localBuffResponse(pending);
 if(pendingChallengeReward!==pending||weeklyStateOwner!==owner)return;
 if(localPanel!=='none'||settingsOpen||transition.active){pendingChallengeReward=null;localNotice='结算上下文已变化，未发追加奖励';update();return;}
 const result=claimChallengeBonus(session,pending,response);pendingChallengeReward=null;
 if(result.status!=='granted'){localNotice=response.status==='unavailable'?'广告服务未连接；明示开发者通道可本地测试':`本地测试回调：${response.status}，未发追加奖励`;update();return;}
 session=result.session;localNotice='本地测试广告追加90钻；共120钻';saveProgress();
 if(settlement.kind==='sweep'){session=closeChallengeSweep(session);saveProgress();update();}
 else transitionScene('exit',()=>{session=claimVictory(session);});
}
async function requestMineSpeedReward(){
 if(pendingMineSpeedReward||pendingBuffReward)return;
 const reason=sourceMineSpeedEntryGate(session,meta.entitlements,meta.buffTimes);
 if(reason){localNotice=reason;update();return;}
 const pending:SourceRewardRequest={id:`mine-speed:${crypto.randomUUID()}`,purpose:'buff:speed',kind:'ad'},owner=weeklyStateOwner;
 pendingMineSpeedReward=pending;localNotice='本地测试广告处理中 · 成功后获得速度增益并开采';update();
 const response=await localBuffResponse(pending);
 if(pendingMineSpeedReward!==pending||weeklyStateOwner!==owner)return;
 if(localPanel!=='none'||settingsOpen||transition.active){pendingMineSpeedReward=null;localNotice='矿场入口上下文已变化；未扣次数或发增益';update();return;}
 const before={session,reward:{times:meta.buffTimes,claimedRequestIDs:meta.buffRewardClaims}},result=sourceMineSpeedEntryReward(before,meta.entitlements,pending,response,undefined,meta.fish,meta.pet);
 if(result.status!=='granted'){pendingMineSpeedReward=null;localNotice=result.reason;update();return;}
 transitionScene('enter',()=>{
  if(pendingMineSpeedReward!==pending||weeklyStateOwner!==owner)return;
  session=result.state.session;meta={...meta,buffTimes:result.state.reward.times,buffRewardClaims:result.state.reward.claimedRequestIDs};pendingMineSpeedReward=null;localNotice=result.reason;
 });
}
async function requestPrismReward(item:number){
 if(pendingPrismReward||localPanel!=='adventure'||adventureNavigation.page!=='prism')return;
 const reason=sourcePrismGate(meta.coreShop,item,stepUpClock(),session.historicMax);if(reason){localNotice=reason;update();return;}
 const request:SourcePrismRequest={id:`prism:${crypto.randomUUID()}`,kind:'purchase',purpose:SOURCE_PRISM.products[item],item},owner=prismStateOwner,sourceState=meta.coreShop;
 pendingPrismReward=request;localNotice='本地测试交易处理中 · 不真实支付';update();
 const params=new URLSearchParams(location.search),outcome=params.get('provider-outcome');
 const delay=qaFixtureActive?Math.min(10000,Math.max(0,Number(params.get('prism-provider-delay')??0)||0)):0;
 if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 const response=await createLocalRewardProvider(outcome!=='unavailable'&&(qaFixtureActive||purchaseSimulationEnabled()),qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(request);
 if(pendingPrismReward!==request||prismStateOwner!==owner)return;pendingPrismReward=null;
 if(meta.coreShop!==sourceState){localNotice='存档上下文已变更；旧交易回调未发奖';update();return;}
 const grant=sourcePrismReward(meta.coreShop,meta.adventure.cores,request,response,stepUpClock(),session.historicMax);
 if(grant.status==='granted'){meta={...meta,coreShop:grant.state,adventure:{...meta.adventure,cores:grant.cores}};platform={...platform,audit:[...platform.audit,{id:request.id,kind:'purchase' as const,amount:SOURCE_PRISM.amounts[item],at:new Date(stepUpClock()).toISOString()}].slice(-100)};}
 localNotice=grant.reason;saveProgress();update();
}
async function requestAdventureReward(index:number){
 const type=adventureNavigation.type,clock=refreshAdventureClock();
 if(pendingAdventureReward||!sourceAdventureAdAble(meta.adventure,type,index,clock,meta.entitlements.plusPack2Active)){localNotice='该地图不可减时、已享Plus2或今日次数不足';update();return;}
 const pending:SourceAdventureAdRequest={id:`adventure:${crypto.randomUUID()}`,purpose:`adventure:13:${type}:${index}`,kind:'ad',type,index,enteredTicks:meta.adventure.maps[type][index].enteredTicks};
 const owner=meta.adventure.rewardClaims;pendingAdventureReward=pending;localNotice='本地测试 provider：不会播放真实广告';update();
 const outcome=new URLSearchParams(location.search).get('provider-outcome');
 const response=await createLocalRewardProvider(qaFixtureActive||platform.developerEnabled&&platform.freeAds,qaFixtureActive&&(outcome==='failure'||outcome==='cancelled')?outcome:'success').execute(pending);
 if(pendingAdventureReward!==pending||meta.adventure.rewardClaims!==owner)return;
 pendingAdventureReward=null; // clear before validating source callback
 const claim=sourceAdventureAdReward(meta.adventure,meta.pet,pending,response,adventureClock());
 if(claim.status==='granted')meta={...meta,adventure:claim.state,pet:claim.pet};
 localNotice=response.status==='unavailable'?'真实广告服务未连接；开发者模式可启用明示本地测试':claim.reason;saveProgress();update();
}
function panelKey() { return `${bossResultRewardClient.pending?.id??""}:${bossResultRewardClient.saveFailed}:${autoAdDate()}:${qaFreeCashExposure}:${autoAdClient.pending?.id??""}:${autoAdClient.saveFailed}:${shopPurchaseClient.saveFailed}:${activityPurchaseClient.pending?.request.id??""}:${activityPurchaseClient.saveFailed}:${passPopup}:${passClient.pending}:${passClient.saveFailed}:${liveRaid?.phase??""}:${liveRaid?.saveFailure??""}:${liveHunt?.phase??""}:${liveHunt?.pendingBonus??false}:${pendingHuntResultReward?.id??""}:${pendingChallengeReward?.id??""}:${shopPurchaseClient.pending?.id??""}:${diaPigPurchaseClient.pending?.id??""}:${platformPending}:${platformConfirmation?.action??""}:${selectedPlatformProvider().isSignedIn()}:${H}:${JSON.stringify({...meta,adventure:encodeSourceAdventureState(meta.adventure),buffTimes:Object.fromEntries(Object.entries(meta.buffTimes).map(([k,t])=>[k,t>0?1:0])),autoUpgrade:{...meta.autoUpgrade,adRemainingSec:meta.autoUpgrade.adRemainingSec>0?1:0}})}:${JSON.stringify(adventureNavigation)}:${pendingAdventureReward?.id??""}:${activityPage}:${activities.dailyClaims}:${activities.lastDailyDate}:${activities.passExp}:${activities.passClaims.join(",")}:${activities.missionClaims.join(",")}:${Object.values(activities.counters).join(",")}:${localPanel}:${localNotice}:${platform.sequence}:${platform.developerEnabled}:${platform.freeAds}:${platform.freePurchases}:${settingsOpen}:${Object.values(preferences).join(",")}:${session.mode}:${session.overlay}:${session.challengeStage}:${session.boss.stage}:${session.boss.run?.phase??""}:${session.dailyClaimed}:${session.gunUnlocked}:${session.gunInventory.length}:${session.gunDraws}:${session.equippedGuns.map(gun => gun?.id ?? "empty").join(",")}:${session.diamonds}:${session.notice}:${session.historicMax}:${session.rebirthCount}:${JSON.stringify(session.ruby.toJSON())}:${Object.values(session.permanentLevels).join(",")}:${session.mine.tickets.used}:${session.mine.bestReward}:${session.mine.settlement?.initialReward ?? ""}`; }
const petPanelState=()=>({autoMerge:{state:petAuto,plus2:meta.entitlements.plusPack2Active,weeklyVipUnlocked:sourcePetAutoEntryUnlocked(session.historicMax)},state:meta.pet,wallet:{petCoin:meta.petCoin,diamonds:session.diamonds},moneyText:walletValue(session.battle).format(),notice:localNotice||session.notice,dailyAdVisible:sourcePetDailyUnlocked(meta.hunt.wave,meta.hunt.level)&&meta.pet.dailyLastDate!==sourcePetLocalDate(localDate())});
function drawPanel() {
  if(sourcePanel)syncFreeCashBackground(sourcePanel,{removeAdsAll:meta.entitlements.removeAdsAll,buffPack:meta.entitlements.buffPack,exposure:freeCashBannerProjection()});
  if(sourcePanel&&localPanel==='raid'&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){
    (sourcePanel as SourceRaidPanelView).sync(raidPanelState());return;
  }
  if(sourcePanel&&localPanel==='star'&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){
    (sourcePanel as SourceStarPanelView).sync(starPanelState());return;
  }
  if(sourcePanel&&localPanel==='shop'&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){syncSourceShopPanel(sourcePanel,{diamonds:session.diamonds,entitlements:meta.entitlements,claims:platform.claims,shopFirstBuy:meta.shopFirstBuy,offerWallBanner:offerWallProjection(),freeCashBanner:freeCashBannerProjection(),localProvider:qaFixtureActive||purchaseSimulationEnabled(),pending:!!shopPurchaseClient.pending||!!diaPigPurchaseClient.pending,saveFailedProduct:diaPigPurchaseClient.saveFailed?diaPigPurchaseClient.pending?.purpose:shopPurchaseClient.saveFailed?shopPurchaseClient.pending?.purpose:undefined,notice:localNotice||session.notice});lastPanel=panelKey();return;}
  if(sourcePanel&&localPanel==='weekly'&&'sync'in sourcePanel&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourceWeeklyPanelView).sync(weeklyPanelState());lastPanel=panelKey();return;}
  if(sourcePanel&&localPanel==='diapig'&&'sync'in sourcePanel&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourceDiaPigPanelView).sync(diaPigPanelState());lastPanel=panelKey();return;}
  if(sourcePanel&&localPanel==='stepup'&&'sync'in sourcePanel&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourceStepUpPanelView).sync({session,nowUTC:stepUpClock(),pending:!!activityPurchaseClient.pending,saveFailedProduct:activityPurchaseClient.saveFailed?activityPurchaseClient.pending?.request.purpose:undefined,notice:localNotice});lastPanel=panelKey();return;}
  if(sourcePanel&&localPanel==='raid-mission'&&'sync'in sourcePanel&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourceRaidMissionPanelView).sync(raidMissionPanelState());lastPanel=panelKey();return;}
  if(sourcePanel&&localPanel==='raid-helper'&&'sync'in sourcePanel&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourceRaidHelperPanelView).sync(raidHelperPanelState());lastPanel=panelKey();return;}
  if(sourcePanel&&localPanel==='raid-star-pig'&&'sync'in sourcePanel&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourceRaidStarPigPanelView).sync(raidStarPigPanelState());lastPanel=panelKey();return;}
  if(sourcePanel&&['gun-collection','gun-info','gun-safe','gun-guide'].includes(localPanel)&&'sync'in sourcePanel&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourceGunInfoPanelView).sync({session,detail:gunDetail,notice:localNotice});lastPanel=panelKey();return;}
  if(sourcePanel&&(localPanel==='skin'||localPanel==='skin-info')&&'sync'in sourcePanel&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourceSkinPanelView).sync({session,index:skinIndex,notice:localNotice});lastPanel=panelKey();return;}
  if(sourcePanel&&(localPanel==='pass'||localPanel==='missions')&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){
    syncSourceMissionPanel(sourcePanel,{textures:loaded,viewport:{width:W,height:H},panel:localPanel,session,activities,platform,preferences,meta,passPopup,passPending:passClient.pending,passSaveFailed:passClient.saveFailed,notice:localNotice||session.notice,action:onSourceAction});lastPanel=panelKey();return;
  }
  if(sourcePanel&&"sync"in sourcePanel&&localPanel==="pet"&&!settingsOpen&&renderedPanelIdentity===currentPanelIdentity()){(sourcePanel as SourcePetPanelView).sync(petPanelState());return;}
  if(sourcePanel&&"sync"in sourcePanel&&session.overlay==="gun"&&!settingsOpen&&localPanel==="none"&&renderedPanelIdentity===currentPanelIdentity()){
    (sourcePanel as SourceGunPanelView).sync({session,nowUTC:stepUpClock(),autoMerge:gunAutoPanelState(),notice:localNotice||session.notice,adDailyGunVisible:meta.adDailyGun.serverWeapon01AdOn&&session.historicMax>=30&&meta.adDailyGun.lastDailyGunKey!==gunDailyDate()});return;
  }
  const key = panelKey();
  if (key === lastPanel) return;
  lastPanel = key;
  redeemInput?.destroy();redeemInput=null;
  if(sourcePanel)panelScrollMemory.set(renderedPanelIdentity,sourcePanel.captureScroll());
  renderedPanelIdentity=currentPanelIdentity();
  sourcePanel?.destroy();sourcePanel=null;
  for (const child of modal.removeChildren()) child.destroy({ children: true });
  if (modeControl) hud.removeChild(modeControl).destroy({ children: true });
  if (gunControl) hud.removeChild(gunControl).destroy({ children: true });
  if (dailyControl) hud.removeChild(dailyControl).destroy({ children: true });
  if(metaControl)hud.removeChild(metaControl).destroy({children:true});
  if(permanentControl)hud.removeChild(permanentControl).destroy({children:true});
  if(mineControl)hud.removeChild(mineControl).destroy({children:true});
  for(const control of localControls.splice(0))hud.removeChild(control).destroy({children:true});
  if(session.mode==="field") {
    localControls.push(iconControl("商店",loaded[round3UI.entries.shop.url],46,743,82,62,0xffd678,()=>showLocalPanel("shop")),
      iconControl("活动",loaded[round3UI.entries.activity.url],46,816,82,62,0xf8bf83,()=>showLocalPanel("activities")));
    if(platform.developerEnabled)localControls.push(control("DEV",48,210,72,32,0xffdc73,()=>showLocalPanel("developer")));
    for(const control of localControls)hud.addChild(control);
  }
  const metaUnlocked=session.mode==="field"&&contentGate(session.historicMax,"rebirth").unlocked;
  metaControl=metaUnlocked ? iconControl("转生",loaded[round3UI.entries.rebirth.url],488,900,82,58,0xffce61,()=>{session=openRebirth(session);update();}):null;
  permanentControl=metaUnlocked ? iconControl("永久强化",loaded[round3UI.entries.rebirth.url],488,967,98,58,0xaee8d3,()=>{session=openPermanent(session);update();}):null;
  if(metaControl)hud.addChild(metaControl);if(permanentControl)hud.addChild(permanentControl);
  const mineAvailable=contentGate(session.historicMax,"mine").unlocked;
  mineControl=session.mode==="field"
    ?iconControl(mineAvailable?"矿场":"矿场·4大关",loaded[round3UI.entries.mine.url],475,833,mineAvailable?82:112,58,mineAvailable?0x9bcde3:0xb4a88a,()=>{
      if(mineAvailable){session=openMine(session);update();}
      else flash(label("矿场在普通第 4 大关开放",20,270,280,0xffe5a5),2,0);
    }):null;
  if(mineControl&&!mineAvailable)(mineControl.children[2] as Text).style.fontSize=15;
  if(mineControl)hud.addChild(mineControl);
  if (session.mode === "field") modeControl = iconControl("挑战", loaded[paths.play], 488, 1034, 95, 58, 0xf88e4e, () => { session = openChallenge(session); update(); });
  else if (session.mode === "mine") modeControl=control("退出",48,1008,90,47,0xf58888,()=>{transitionScene("exit",()=>{session=exitMine(session);});});
  else if (session.mode === "challenge") modeControl = control("退出", 30, 1008, 90, 47, 0xf58888, () => { transitionScene("exit",()=>{session = exitChallenge(session);}); });
  else modeControl = null;
  if (modeControl) hud.addChild(modeControl);
  gunControl = session.gunUnlocked && session.mode === "field" ? iconControl("Gun", loaded[paths.gunIcon], 42, 940, 82, 50, 0xf3c64c,
    () => { session = openGun(session); update(); }) : null;
  if (gunControl) hud.addChild(gunControl);
  if (gunGuide) { hud.removeChild(gunGuide).destroy(); gunGuide=null; }
  // Source Hand 796 + .823529 alpha; placement follows the H5 adapted button.
  // Native DOTween timing remains unknown, so this hint is static.
  if(gunControl && session.gunDraws===0 && session.overlay==="none" && !settingsOpen && localPanel==="none") {
    gunGuide=picture(loaded[paths.tutorialHand],78,980,104,104);
    gunGuide.alpha=.8235294223;gunGuide.eventMode="none";hud.addChild(gunGuide);
  }
  dailyControl = canClaimSourceDaily() && session.mode === "field" && session.overlay === "none"
    ? iconControl("签到",loaded[round3UI.entries.daily.url], 46, 887, 83, 58, 0xffd65a, () => { openSourceDaily(); }) : null;
  if (dailyControl) hud.addChild(dailyControl);
  if(liveRaid?.saveFailure){modal.addChild(label('突袭保存失败，战斗已暂停',22,W/2,H*.62,0xffe0a0),control('重试保存（不重复扣费）',W/2,H*.68,300,60,0x8cc96b,()=>onSourceAction('raid-live-retry')),label(localNotice,16,W/2,H*.74));return;}
  if (localPanel==="none" && !settingsOpen && session.overlay === "none" && session.mode !== "victory" && session.mode !== "defeat" && session.mode !== "mine-result" && session.mode !== "boss-result") return;
  const backdrop = new Graphics().beginFill(0x483a2c, 0.55).drawRect(0, 0, W, H).endFill();
  backdrop.eventMode = "static";
  modal.addChild(backdrop);
  if(localPanel==='weekly'){sourcePanel=createSourceWeeklyPanel({...weeklyPanelState(),textures:loaded,viewport:{width:W,height:H},action:onSourceAction});modal.addChild(sourcePanel.root);sourcePanel.restoreScroll(panelScrollMemory.get('weekly')??{});if(weeklyScrollToAuto){const opened=sourcePanel;requestAnimationFrame(()=>{if(sourcePanel===opened&&localPanel==='weekly'&&weeklyMenu===1)opened.restoreScroll({'level0:841':{x:0,y:-1000000}});});}weeklyScrollToAuto=false;return;}
  if(localPanel==='diapig'){refreshDiaPig();sourcePanel=createSourceDiaPigPanel({...diaPigPanelState(),textures:loaded,viewport:{width:W,height:H},action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==='stepup'){sourcePanel=createSourceStepUpPanel({textures:loaded,viewport:{width:W,height:H},session,nowUTC:stepUpClock(),pending:!!activityPurchaseClient.pending,saveFailedProduct:activityPurchaseClient.saveFailed?activityPurchaseClient.pending?.request.purpose:undefined,notice:localNotice,action:onSourceAction});modal.addChild(sourcePanel.root);sourcePanel.restoreScroll(panelScrollMemory.get('stepup')??{});return;}
  if(localPanel==='gun-collection'||localPanel==='gun-info'||localPanel==='gun-safe'||localPanel==='gun-guide'){sourcePanel=createSourceGunInfoPanel({textures:loaded,viewport:{width:W,height:H},session,panel:localPanel,detail:gunDetail,notice:localNotice,action:onSourceAction});modal.addChild(sourcePanel.root);sourcePanel.restoreScroll(panelScrollMemory.get(localPanel)??{});return;}
  if(localPanel==='skin'||localPanel==='skin-info'){sourcePanel=createSourceSkinPanel({textures:loaded,viewport:{width:W,height:H},session,panel:localPanel,index:skinIndex,notice:localNotice,action:onSourceAction});modal.addChild(sourcePanel.root);sourcePanel.restoreScroll(panelScrollMemory.get(localPanel)??{});return;}
  if(localPanel==='raid-mission'){sourcePanel=createSourceRaidMissionPanel({...raidMissionPanelState(),textures:loaded,viewport:{width:W,height:H},action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==='raid-helper'){sourcePanel=createSourceRaidHelperPanel({...raidHelperPanelState(),textures:loaded,viewport:{width:W,height:H},action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==='raid-star-pig'){sourcePanel=createSourceRaidStarPigPanel({...raidStarPigPanelState(),textures:loaded,viewport:{width:W,height:H},action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==='raid'){sourcePanel=createSourceRaidPanel({...raidPanelState(),textures:loaded,viewport:{width:W,height:H},action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==="star"){sourcePanel=createSourceStarPanel({...starPanelState(),textures:loaded,viewport:{width:W,height:H},action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==="adventure"){
    sourcePanel=createSourceAdventurePanel({textures:loaded,viewport:{width:W,height:H},state:meta.adventure,relic:meta.relic,coreShop:meta.coreShop,nowUTC:stepUpClock(),pet:meta.pet,clock:adventureClock(),navigation:adventureNavigation,plus2:meta.entitlements.plusPack2Active,pending:!!pendingAdventureReward||!!pendingPrismReward,notice:localNotice,fixture:qaFixtureActive,action:onSourceAction});modal.addChild(sourcePanel.root);sourcePanel.restoreScroll(panelScrollMemory.get(`adventure:${adventureNavigation.page}`)??{});
    // Fixture/provider identity is already visible in qaBadge. Never place a
    // duplicate footer on top of the source draw prices/touch zones.
    const message=pendingAdventureReward||pendingPrismReward?'等待本地测试回调':localNotice;
    if(message){const status=settingLabel(message,14,W/2,H*.20);status.style.wordWrap=true;status.style.wordWrapWidth=W-40;status.eventMode='none';modal.addChild(status);}return;
  }
  if(localPanel==="pet-draw-info"){sourcePanel=createSourcePetDrawInfoPanel({textures:loaded,viewport:{width:W,height:H},action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==="pet-info"){sourcePanel=createSourcePetInfoPanel({textures:loaded,viewport:{width:W,height:H},grade:petInfoGrade,action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==="pet"){sourcePanel=createSourcePetPanel({...petPanelState(),textures:loaded,viewport:{width:W,height:H},pointerSurface:canvas,clientToUi:(x,y)=>{const r=canvas.getBoundingClientRect();return {x:(x-r.left)*W/r.width,y:(y-r.top)*H/r.height};},action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if(localPanel==="monster"){sourcePanel=createSourceHuntPanel({textures:loaded,viewport:{width:W,height:H},hunt:meta.hunt,historicMax:session.historicMax,plusPurchase:entryPlusPurchaseUI(),teamPower:runtimeSourceHuntPower({session,activities,platform,meta}),maxDisplayStage:Math.floor(session.historicMax/10)+1,entitlements:sourceRewardEntitlements(meta.entitlements),notice:localNotice||session.notice,pending:platformPending||!!pendingHuntResultReward||!!liveHunt?.pendingBonus||!!liveHunt?.preparing,purchasePending:!!diaPigPurchaseClient.pending,purchaseSaveFailed:diaPigPurchaseClient.saveFailed,removeAdsAll:meta.entitlements.removeAdsAll,localProvider:qaFixtureActive||purchaseSimulationEnabled(),freeCashBanner:{...freeCashBannerProjection()},entryAvailable:true,action:onSourceAction});if(sourcePanel)modal.addChild(sourcePanel.root);return;}
  if(localPanel==="boss"||session.mode==="boss-result"){sourcePanel=createSourceBossPanel({textures:loaded,viewport:{width:W,height:H},boss:session.boss,bonusPending:!!bossResultRewardClient.pending,bonusSaveFailed:bossResultRewardClient.saveFailed,plusPurchase:entryPlusPurchaseUI(),realPower:sessionBossPower(session,meta.entitlements,meta.fish,meta.buffTimes,meta.relic),historicMax:session.historicMax,entitlements:sourceRewardEntitlements(meta.entitlements),notice:localNotice||session.notice,pending:platformPending,purchasePending:!!diaPigPurchaseClient.pending,purchaseSaveFailed:diaPigPurchaseClient.saveFailed,removeAdsAll:meta.entitlements.removeAdsAll,localProvider:qaFixtureActive||purchaseSimulationEnabled(),freeCashBanner:{...freeCashBannerProjection()},action:onSourceAction});if(sourcePanel)modal.addChild(sourcePanel.root);return;}
  const featurePanels=new Set(["mine-pack","fish","boss","pet","monster","adventure","redeem","auto","buff"]);
  const originalPanel=featurePanels.has(localPanel)?localPanel:settingsOpen?"settings":localPanel==="shop"?"shop":localPanel==="missions"?"missions":localPanel==="pass"?"pass":session.overlay==="challenge-sweep"?"challenge-sweep":session.overlay==="challenge"?"challenge":session.overlay==="mine"?"mine":session.overlay==="rebirth"?"rebirth":session.overlay==="permanent"?"permanent":session.overlay==="daily"?"daily":session.mode==="victory"?"challenge-win":session.mode==="defeat"?"challenge-fail":session.mode==="mine-result"?"mine-result":null;
  if(originalPanel){
    sourcePanel=createSourcePanel({textures:loaded,viewport:{width:W,height:H},panel:originalPanel,session,activities,platform,preferences,meta,autoAdUI:{today:autoAdDate(),pending:!!autoAdClient.pending,saveFailed:autoAdClient.saveFailed},passPopup,passPending:passClient.pending,passSaveFailed:passClient.saveFailed,purchaseSaveFailed:shopPurchaseClient.saveFailed||diaPigPurchaseClient.saveFailed,purchaseSaveFailedProduct:diaPigPurchaseClient.saveFailed?diaPigPurchaseClient.pending?.purpose:shopPurchaseClient.saveFailed?shopPurchaseClient.pending?.purpose:undefined,purchasePending:!!shopPurchaseClient.pending||!!diaPigPurchaseClient.pending,rewardPending:!!pendingMineResultReward||!!pendingChallengeReward,qaLocalProvider:qaFixtureActive,purchaseLocalProvider:purchaseSimulationEnabled(),platformUI:{signedIn:selectedPlatformProvider().isSignedIn(),pending:platformPending,freeCashBanner:{...freeCashBannerProjection()},confirmation:platformConfirmation?.action as "cloud-save"|"cloud-load"|undefined,preview:platformPreview},notice:localNotice||session.notice,action:onSourceAction});
    if(sourcePanel){sourcePanel.restoreScroll(panelScrollMemory.get(renderedPanelIdentity)??{});modal.addChild(sourcePanel.root);
      if(originalPanel==="settings"||originalPanel==="redeem"){
        const close=sourcePanel.get(originalPanel==="settings"?"/Canvas/Setting/Setting_UI/Close_Btn":"/Canvas/Setting/Redeem_UI/Close_Btn")?.getBounds();
        const extensionY=Math.min(H-116,(close?.y??H*.65)+(close?.height??40)+38);
        if(originalPanel==="settings"&&!platformConfirmation)modal.addChild(control("开发者模式 · 用户扩展",270,extensionY,282,42,0xffd47b,()=>showLocalPanel("developer")));
        if(localNotice){const status=settingLabel(localNotice,14,270,extensionY+48);status.style.fill=0xffe3b4;status.style.wordWrap=true;status.style.wordWrapWidth=480;modal.addChild(status);}
      }
      if(originalPanel==="redeem")redeemInput=createSourceRedeemInputOverlay({view:sourcePanel,canvas,viewport:()=>({width:W,height:H}),value:redeemValue,disabled:platformPending,onChange:value=>{redeemValue=value;},onSubmit:code=>{void performPlatformAction("redeem",{code});},onCancel:()=>onSourceAction("close")});return;}
  }
  if(localPanel!=="none") {drawLocalPanel();return;}
  if(session.overlay==="gun") {sourcePanel=createSourceGunPanel({nowUTC:stepUpClock(),autoMerge:gunAutoPanelState(),textures:loaded,viewport:{width:W,height:H},pointerSurface:canvas,clientToUi:(x,y)=>{const r=canvas.getBoundingClientRect();return {x:(x-r.left)*W/r.width,y:(y-r.top)*H/r.height};},session,notice:localNotice||session.notice,adDailyGunVisible:meta.adDailyGun.serverWeapon01AdOn&&session.historicMax>=30&&meta.adDailyGun.lastDailyGunKey!==gunDailyDate(),action:onSourceAction});modal.addChild(sourcePanel.root);return;}
  if (settingsOpen) {
    const panel = new NineSlicePlane(loaded[settingsAssets.panel],48,48,48,48);
    panel.width=641.16998;panel.height=685.64893;panel.scale.set(.7);
    panel.position.set(45.5905,320);panel.tint=0xe7bf7f;
    modal.addChild(panel,settingLabel("设置",32,270,361));
    const preferenceKinds: (keyof BrowserPreferences)[]=["music","sound","vibration"];
    const names={music:"音乐",sound:"音效",vibration:"震动"};
    preferenceKinds.forEach((kind,i)=>{
      const x=128+i*142;
      const button=new Container();button.position.set(x,467);
      const buttonArt=new NineSlicePlane(loaded[settingsAssets.button],32,44,32,34);
      buttonArt.width=150;buttonArt.height=150;buttonArt.scale.set(.7);buttonArt.position.set(-52.5,-52.5);
      buttonArt.tint=preferences[kind]?0xffffff:0xa6a6a6;
      button.addChild(buttonArt,settingLabel(preferences[kind]?"开":"关",16,0,31));
      button.eventMode="static";button.cursor="pointer";button.on("pointertap",()=>togglePreference(kind));
      const icon=picture(loaded[settingsAssets[kind]],0,-13,48,42);icon.tint=0x75512c;
      button.addChild(icon);
      modal.addChild(button,settingLabel(names[kind],18,x,400));
    });
    modal.addChild(settingLabel("进度自动保存",20,270,569),
      control("开发者模式",270,651,282,59,0xffd47b,()=>showLocalPanel("developer")),
      settingLabel(platform.developerEnabled?"免广 / 免购买测试可用":"测试资源 · 免广 · 免购买",16,270,708),
      closeControl(270,808,()=>{settingsOpen=false;resetMovementInput();feedback.playUI();update();}));
    return;
  }
  if (session.overlay === "daily") {
    const awning=picture(loaded[sourceUIImages.get(613)!.url!],W/2,106,W,W*166/742);
    modal.addChild(awning, sourceSurface(658,221,79,98,39,0xffe5ad,76),
      picture(loaded[paths.diamond], 242, 98, 29), label(String(session.diamonds), 19, 279, 98));
    const rewards = round3UI.activities.daily.rewards;
    for (let i = 0; i < rewards.length; i++) {
      const wide = i === 6;
      const x = wide ? 43 : 45 + i % 3 * 155;
      const y = wide ? 710 : 365 + Math.floor(i / 3) * 170;
      const w = wide ? 454 : 140;
      const card = new Container();
      card.position.set(x, y);
      card.addChild(sourceSurface(658,0,0,w,145, i < activities.dailyClaims ? 0xa5a29a : 0xfff5e2, 300),
        sourceSurface(881,0,0,w,40,i === activities.dailyClaims && canClaimSourceDaily() ? 0xf1ed23 : 0xc566ff,84.2169),
        label(`第 ${i + 1} 天`, 20, w / 2, 23), picture(loaded[paths.diamond], w / 2, 88, 48),
        label(String(rewards[i]), 20, w / 2, 114));
      if (i < activities.dailyClaims || (i === activities.dailyClaims && canClaimSourceDaily())) {
        if (i < activities.dailyClaims) {
          const check=picture(loaded[sourceUIImages.get(690)!.url!],w/2,88,32);check.tint=0x41ff28;card.addChild(check);
        }
        else {
          card.eventMode = "static";
          card.cursor = "pointer";
          card.on("pointertap", () => { receiveSourceDaily(); });
        }
      }
      modal.addChild(card);
    }
    modal.addChild(closeControl(270, 965, () => { session = closeOverlay(session); update(); }));
  } else if (session.overlay === "mine") {
    modal.addChild(panelSurface(30,350,480,510),label("矿场",32,270,394),
      picture(loaded[sourceUIImages.get(830)!.url!],270,486,117,104),
      label("60秒内击碎矿石，收集钻石",20,270,582),
      picture(loaded[round3UI.entries.mine.url],141,628,33),label(`今日剩余 ${Math.max(0,2-session.mine.tickets.used)} / 2`,21,283,628),
      label(`历史最高 ${session.mine.bestReward}`,19,270,669),
      label(session.notice || "提前退出消耗次数，不领取奖励",16,270,712,0x78523c),
      control("进入矿场",270,786,180,58,0x75cfaa,()=>{enterScene(()=>startMine(session,undefined,meta.entitlements.minePack,meta.entitlements,meta.fish,meta.pet,meta.buffTimes,meta.relic));}),
      closeControl(478,380,()=>{session=closeOverlay(session);update();}));
  } else if (session.overlay === "challenge") {
    const panel = new NineSlicePlane(loaded[paths.modalPanel], 126, 126, 126, 126);
    panel.width = 500 / 0.3;
    panel.height = 430 / 0.3;
    panel.scale.set(0.3);
    panel.position.set(20, 417);
    panel.tint = 0xffdea6;
    const paws = new TilingSprite(loaded[paths.pawPattern], 480, 405);
    paws.position.set(30, 430);
    paws.tileScale.set(0.48);
    paws.tint = 0xc98838;
    paws.alpha = 0.24;
    modal.addChild(panel, paws);
    const previewTheme = (session.challengeStage-1)%10;
    const previewTree = previewTheme===0 ? paths.pine : previewTheme===1 ? paths.palmPlain : paths.tree;
    const rewardPanel = picture(loaded[paths.rewardPanel], 270, 664, 386, 84);
    rewardPanel.tint = 0xf6cf8c;
    modal.addChild(picture(loaded[previewTree], 270, 411, 106, 125),
      label(`Stage ${session.challengeStage}`, 24, 270, 504), box(22, 522, 496, 66, 0xdfcfaa),
      label("在 1 分钟内清理全部树木", 17, 270, 555),
      rewardPanel, label("奖励", 18, 270, 625),
      picture(loaded[paths.diamond], 270, 667, 45), label("30", 19, 270, 690),
      control("开始挑战", 270, 772, 154, 64, 0xffd65a, () => { enterScene(()=>startChallenge(session)); }),
      closeControl(500, 428, () => { session = closeOverlay(session); update(); }));
  } else if(session.overlay==="rebirth") {
    modal.addChild(panelSurface(30,365,480,450));
    modal.addChild(label("转生",32,270,405),picture(loaded[paths.catIcon],270,475,96),
      picture(loaded[round3UI.entries.rebirth.url],98,554,35),label(`获得红宝石 ${sessionRebirthReward(session,meta.relic).format()}`,23,294,554,0xce514f),
      label("普通等级与金币重置，返回 1-1",18,270,598,0x6c533b),
      label("保留武器、永久强化与历史最高关卡",16,270,630,0x6c533b),
      control("确认转生",270,702,180,62,0xffcc61,()=>{session=confirmRebirth(session,meta.relic);clearFleetingEffects();saveProgress();update();}),
      closeControl(479,383,()=>{session=closeOverlay(session);update();}));
  } else if(session.overlay==="permanent") {
    modal.addChild(panelSurface(20,300,500,610),label("永久强化",29,270,342),
      picture(loaded[round3UI.permanentUpgrade.currency.url],119,391,35),label(`红宝石 ${session.ruby.format()}`,22,281,391,0xc94854));
    [...round3UI.permanentUpgrade.cards].sort((a,b)=>a.typeIndex-b.typeIndex).forEach((card,index)=>{
      const kind=card.kind as "damage"|"speed"|"money";
      const quoted=permanentUpgradeQuote(kind,session.permanentLevels[kind],session.ruby);
      if(quoted.status!=="supported")return;
      const q=quoted.value,y=490+index*125;
      const name={damage:"攻击",money:"金币",speed:"攻速"}[kind];
      const buy=control(q.atMaximum?"已满级":"",409,y,142,58,q.canPurchase?0x8edec0:0xd2b99a,
        ()=>{const before=session.permanentLevels[kind];session=purchasePermanent(session,kind);if(session.permanentLevels[kind]>before)feedback.playUpgrade();saveProgress();update();});
      if(!q.atMaximum)buy.addChild(label(q.price.format(),21,-17,0),picture(loaded[round3UI.permanentUpgrade.currency.url],48,0,26));
      modal.addChild(sourceSurface(card.background.spritePathID,39,y-40,461,105,0xfff1da,200),picture(loaded[card.icon.url],82,y+9,45),label(`${name} Lv.${q.level}`,20,213,y-15),
        label(`${q.currentPercent.format()}% → ${q.nextPercent.format()}%`,16,213,y+20),buy);
    });
    modal.addChild(label(session.notice,16,270,870,0xcb4c33),closeControl(492,319,()=>{session=closeOverlay(session);update();}));
  } else if (session.mode === "mine-result") {
    modal.addChild(box(35,385,470,345,0xfff3d8,24),label("矿场结算",32,270,432),
      picture(loaded[paths.diamond],270,502,62),
      label(`钻石 +${session.mine.settlement?.initialReward ?? 0}`,27,270,562),
      label(`本轮矿石积分 ${session.mine.run?.score ?? 0}`,19,270,606),
      control(session.mine.settlement?.bonusClaimed?"奖励已领取":qaFixtureActive||platform.developerEnabled&&platform.freeAds?"本地测试 ×4":"广告 ×4（未连接）",270,639,220,38,0xffd478,()=>{
        void requestMineResultBonus("mine");
      }),
      control("返回",270,693,180,46,0x80d2ac,()=>{onSourceAction("exit-mine");}));
  } else if (session.mode === "victory") {
    settlementArt(true);
    const adClaim = control(platform.developerEnabled&&platform.freeAds?"免广领取":"领取 ×4", 270, 745, 171, 62, 0xffd453, () => {
      void requestChallengeBonus();
    });
    const baseClaim = control(String(session.challengeSettlement?.totalReward??30), 270, 866, 138, 54, 0xc9c2b6, () => { transitionScene("exit",()=>{session = claimVictory(session);}); });
    (baseClaim.children[1] as Text).y = 12;
    baseClaim.addChild(picture(loaded[paths.diamond], 0, -10, 24));
    modal.addChild(adClaim, picture(loaded[paths.adIcon], 190, 722, 34), label("x4", 23, 363, 717),
      label("No Thanks", 19, 270, 823), baseClaim);
  } else {
    settlementArt(false);
    modal.addChild(control("Ok", 270, 746, 171, 62, 0xffc35a, () => { transitionScene("exit",()=>{session = acknowledgeDefeat(session);}); }));
  }
}

function format(value: number) {
  if (value < 1000) return String(Math.floor(value));
  return `${(value / 1000).toFixed(2)}a`;
}
function update() {
  offerWallClient.tick();void offerWallClient.initialize(qaFixtureActive||platform.developerEnabled);syncOfferWall();
  void freeCashClient.ensureInitialized(qaFixtureActive||platform.developerEnabled);
  syncFreeCashOverlay();passClient.refresh();refreshWeekly();refreshStepUp();
  for(const rig of catRigs)rig.setSkin(rigSkinAssets,(session.skin??freshSourceSkinState()).selected);
  feedback.setCombatEnabled(currentRuntimePolicy().combatAudio);
  activities=observeActivities(activities,observedSession,session);observedSession=session;
  if(liveHunt?.closed){liveHunt=null;huntLoadingElapsed=0;localPanel='none';lastPanel='';feedback.setMusicMode('main');}
  if(liveRaid?.closed){cancelLiveRaid();localPanel='raid';lastPanel='';feedback.setMusicMode('main');}
  const huntOwned=!!liveHunt?.ownsField,raidOwned=!!liveRaid?.ownsField,externalOwned=huntOwned||raidOwned;
  // Leaving an external battle must restore only the source HUD, not the prototype.
  hud.visible=false;
  world.visible=!externalOwned&&!ecoMode;nativeHud.view.root.visible=!externalOwned;if(bossHud)bossHud.root.visible=!externalOwned;
  huntWorldLayer.visible=huntOwned&&!ecoMode;
  raidWorldLayer.visible=raidOwned&&!ecoMode;raidHudLayer.visible=raidOwned;
  syncLiveHuntHUD();syncLiveRaidHUD();
  const huntMask=!!liveHunt&&['preparing','enter-loading','exit-field-wait','exit-mask-wait'].includes(liveHunt.phase);
  const raidMask=!!liveRaid&&['preparing','provider','enter-loading','exit-mask-wait'].includes(liveRaid.phase)&&!liveRaid.saveFailure;
  loadingLayer.visible = transition.active||huntMask||raidMask;
  loadingLayer.alpha = huntMask||raidMask?1:transition.alpha;
  if(transition.active||huntMask||raidMask)updateLoadingAnimation(huntMask?huntLoadingElapsed:raidMask?raidLoadingElapsed:transition.elapsed);
  if(externalOwned){drawPanel();return;}
  if (session.mode !== renderedMode) {
    clearFleetingEffects();
    feedback.setMusicMode(session.mode === "field" ? "main" : "contents");
    if(session.mode === "defeat") feedback.playFail();
    renderedMode = session.mode;
  }
  const battle = session.battle;
  if(ecoMode){world.visible=false;nativeHud.update(session,true,meta.buffTimes,meta.entitlements,stepUpClock(),freeCashBannerProjection().hud,offerWallProjection().visible);syncBossHud();drawPanel();return;}
  ensureTreeSprites(battle.targets.length);
  const progress = Math.trunc(battle.targets.filter(target => target.health <= 0).length / battle.targets.length * 100);
  progressFill.clear().beginFill(0xffd398).drawRect(0, 66, W * progress / 100, 6).endFill();
  progressText.text = `${progress}%`;
  stageText.text = `Stage ${battle.stage + 1}-${battle.level + 1}`;
  stageCat.x = 150 + Math.min(4, battle.level) * 58;
  const mining=isMineMode();
  const bossScene=(session.mode==="boss"||session.mode==="boss-result")&&!!session.bossMotion;
  bossView.view.visible=bossView.backgroundView.visible=bossScene;
  bossCameraWorld=actorWorld(battle.player,true);
  if(bossScene)bossView.update({dtSeconds:0,stage:session.boss.run?.playedStage??session.boss.stage,worldPosition:session.bossMotion!.position,facing:session.bossMotion!.facing,isMoving:session.bossMotion!.moving,isDead:session.boss.run?.phase==="won"});
  const inChallenge = usesChallengeProjection();
  const theme=(inChallenge ? session.challengeStage-1 : battle.stage)%10;
  const desert=theme===1;
  const mineGround=mining?getMineGroundPresentation():null;
  const challengeGround=inChallenge&&!mining?getChallengeGroundPresentation():null;
  const themeGround=loaded[mineGround?.url ?? challengeGround?.url ?? skinURL(mapSkins.ground[theme])];
  ground.texture=themeGround;
  const catWorld = actorWorld(battle.player,inChallenge);
  const camera={forward:cameraForward,right:rotate(cameraRotation,{x:1,y:0,z:0}),up:rotate(cameraRotation,{x:0,y:1,z:0})};
  const cameraPosition={x:catWorld.x+73.5,y:catWorld.y+72.11,z:catWorld.z-73.4};
  const tile=mining?getMineGroundTileProjection(camera,15,undefined,cameraPosition,{x:W/2,y:H/2}):
    inChallenge?getChallengeGroundTileProjection(camera,15,undefined,cameraPosition,{x:W/2,y:H/2}):
    getMapGroundTileProjection(theme,camera,15,undefined,cameraPosition,{x:W/2,y:H/2});
  const m=tile.transform;
  ground.tileTransform.setFromMatrix(new Matrix(m.a,m.b,m.c,m.d,m.tx,m.ty));
  ground.tint=tile.tintRGB;ground.alpha=tile.alpha;
  exterior.visible = inChallenge&&!bossScene;
  ground.visible = !bossScene;
  ground.mask = inChallenge ? challengeGroundMask : null;
  challengeGroundMask.clear();
  if(inChallenge) {
    const corners=mining&&mineGround?[0,1,3,2].map(i=>projectWorld(mineGround.corners[i],catWorld)):
      challengeGround!.boundaryWorld.map(p=>projectWorld(p,catWorld));
    challengeGroundMask.beginFill(0xffffff).moveTo(corners[0].x,corners[0].y);
    for(const corner of corners.slice(1))challengeGroundMask.lineTo(corner.x,corner.y);
    challengeGroundMask.closePath().endFill();
  }
  fieldBorders.visible = !inChallenge;
  fieldBorderExterior.visible = fieldBorders.visible;
  nearExteriorGrass.visible = fieldBorders.visible;
  if (fieldBorders.visible) {
    fillBorderExterior(catWorld, theme);
    for (const border of borders) {
      const geometry = border.themes[theme];
      const texture=loaded[skinURL((border.sprite===870 ? mapSkins.up : mapSkins.down)[theme])];
      if (border.image.texture !== texture) border.image.texture = texture;
      const color=getMapBorderColor(forestBorderData.borders[borders.indexOf(border)].renderer);
      border.image.tint=color.tintRGB;border.image.alpha=color.alpha;
      const [topLeft, topRight, bottomLeft] = geometry.corners.map(corner => projectWorld(corner, catWorld));
      border.image.transform.setFromMatrix(new Matrix(
        (topRight.x - topLeft.x) / geometry.size[0], (topRight.y - topLeft.y) / geometry.size[0],
        (bottomLeft.x - topLeft.x) / geometry.size[1], (bottomLeft.y - topLeft.y) / geometry.size[1],
        topLeft.x, topLeft.y));
      const bottomRight = { x: topRight.x + bottomLeft.x - topLeft.x, y: topRight.y + bottomLeft.y - topLeft.y };
      const xs = [topLeft.x, topRight.x, bottomLeft.x, bottomRight.x];
      const ys = [topLeft.y, topRight.y, bottomLeft.y, bottomRight.y];
      border.image.visible = Math.max(...xs) >= 0 && Math.min(...xs) <= W &&
        Math.max(...ys) >= 0 && Math.min(...ys) <= H;
    }
  }
  scenery.visible = false;
  stages.visible = !inChallenge;
  settingIcon.visible = !inChallenge;
  timer.visible = inChallenge;
  diamond.parent.visible = !inChallenge||mining;
  timerFill.clear().beginFill(0x5ed4e5).drawRect(120, 106, 278 * Math.max(0, session.challengeSeconds) / 60, 11).endFill();
  timerText.text = `${Math.ceil(session.challengeSeconds)}s`;
  if(mining) {progressText.text=`钻石 ${mineHudValue(session.mine.run?.score ?? 0)}`;stageText.text="矿场";}
  money.amount.text = walletValue(battle).format();
  diamond.amount.text = format(session.diamonds);
  const firstAlive = battle.targets.find(target => target.health > 0);
  if (!inChallenge) {
    sceneryTrees.forEach((tree, index) => {
      tree.x = sceneryLayout[index][0] + (battle.level % 2 ? 0 : index % 2 ? 9 : -8);
      const skin = battle.level >= 2 && [0, 2, 3, 6].includes(index) ? paths.cherry : scenerySkins[index];
      tree.texture = loaded[skin];
    });
  }
  const batchSize = battle.targetBatchSize;
  const visibleOffset = batchSize && firstAlive
    ? Math.floor((firstAlive.id - 1) / batchSize) * batchSize : 0;
  for (let i = 0; i < treeSprites.length; i++) {
    const target = battle.targets[i];
    const view = treeSprites[i];
    if (!target) { view.group.visible = false; continue; }
    const location=screenPoint(target.position,battle,inChallenge);
    view.group.visible = !bossScene && target.health > 0 && location.x > -100 && location.x < W + 100 &&
      location.y > 55 && location.y < H + 100 &&
      (!batchSize || (i >= visibleOffset && i < visibleOffset + batchSize));
    if(!view.group.visible)continue;
    const rootWorld=actorWorld(target.position,inChallenge);
    const oreType=(target as typeof target & {oreType?:number}).oreType ?? 0;
    const presentation=mining?getMineOrePresentation(oreType,rootWorld):target.boss?getBossTreePresentation(theme,rootWorld):inChallenge?getChallengeTreePresentation(theme,target.tier??0,rootWorld):getTreePresentation(theme,target.tier??0,rootWorld);
    view.body.texture = loaded[presentation.url];
    const origin=screenPoint(target.position,battle,inChallenge);
    applyWorldSprite(view.body,presentation,catWorld,origin);
    const color=mapColorToPixi(presentation.color);view.body.tint=color.tintRGB;view.body.alpha=color.alpha;
    if (target.boss && view.sparkles.length === 0) {
      for (const [x, y] of [[-65, -224], [3, -251], [82, -232], [93, -172], [-50, -189]]) {
        const sparkle = picture(loaded[paths.bossSparkle], x, y, 30, 30);
        view.group.addChild(sparkle);
        view.sparkles.push(sparkle);
      }
    }
    view.sparkles.forEach((sparkle, index) => {
      sparkle.visible = Boolean(target.boss);
      sparkle.alpha = 0.55 + 0.4 * Math.sin(performance.now() / 360 + index * 1.8) ** 2;
    });
    view.group.position.set(location.x, location.y);
    view.group.zIndex = projectWorld(presentation.depthWorld,catWorld).y;
    view.bar.clear();
    const hp=mining?getMineOreHP(rootWorld):target.boss?getBossHP(rootWorld):inChallenge?getChallengeHP(rootWorld):getTreeHPPresentation(rootWorld);
    view.hpBack.texture=loaded[hp.slider.url];view.hpFill.texture=loaded[hp.fill.url];
    applyWorldSprite(view.hpBack,hp.slider,catWorld,location);
    const fraction=healthValue(target).fractionOf(target.maxHealthValue ?? BigValue.from(target.maxHealth));
    applyWorldSprite(view.hpFill,hp.fill,catWorld,location,fraction);
    view.hpBack.tint=hp.slider.tintRGB;view.hpBack.alpha=hp.slider.alpha;
    view.hpFill.tint=hp.fill.tintRGB;view.hpFill.alpha=hp.fill.alpha;

  }
  const aimed = aimingTarget(battle);
  reticle.visible = Boolean(aimed);
  if (aimed) {
    const location = screenPoint(aimed.position, battle, inChallenge);
    reticle.visible = location.x >= 0 && location.x <= W && location.y >= 80 && location.y <= H - 150;
    reticle.position.set(location.x, location.y - (aimed.boss ? 25 : 19));
  }
  for (let slot=0;slot<catRigs.length;slot++) {
    const visible=Boolean(session.equippedGuns[slot]);
    catRigs[slot].view.visible=catShadows[slot].visible=visible;
    if(visible&&currentRuntimePolicy().worldPresentation) positionRig(slot,battle,inChallenge);
  }
  // Event paths determine distance emission; the survivor list only seeds restored saves.
  for(const shot of battle.projectiles)if(!projectileViews.has(shot.id)){
    const base={projectileId:shot.id,weaponId:shot.weaponId??"unknown",actorId:shot.gunSlot,gunSlot:shot.gunSlot,
      spawnTime:shot.spawnTime??battle.elapsed,time:shot.spawnTime??battle.elapsed,position:shot.spawnPosition??shot.position,height:shot.height??2,velocity:shot.velocity};
    consumeProjectileLifecycle({...base,type:"projectileBorn"});
    consumeProjectileLifecycle({...base,type:"projectilePath",time:battle.elapsed,position:shot.position,fromPosition:base.position,fromHeight:base.height,fromTime:base.time});
  }
  for(const [id,view] of projectileViews){const anchor=projectileAnchors.get(id);if(!anchor)continue;const p=projectWorld(anchor.world,catWorld);view.position.set(p.x,p.y);}
  for(const item of muzzleViews){const p=projectWorld(catRigs[item.actorId].getMuzzleRawWorld(),catWorld);item.view.position.set(p.x,p.y);}
  for (const card of cards) {
    const level = battle.upgradeLevels[card.kind];
    const maxed=level>=10000, price=upgradePriceValue(level), wallet=walletValue(battle);
    const affordable=!maxed && wallet.gte(price);
    card.level.text=`Lv.${level}`;
    card.value.text=upgradeStatValue(card.kind,level).format();
    card.cost.text=maxed ? "MAX" : price.format();
    card.status.text=maxed ? "已满级" : affordable ? "可升级" : `还差 ${price.sub(wallet).format()}`;
    const completion=wallet.fractionOf(price);
    card.percent.text=maxed || affordable ? "" : `${Math.floor(completion*100)}%`;
    const uiTime = performance.now() / 1000;
    const fillState = `${level}:${affordable}:${maxed}`;
    if (fillState !== card.fillState || uiTime - card.refreshedAt >= .1) {
      card.meter.visible = !maxed && !affordable;
      card.fillFraction = card.meter.visible ? completion : 0;
      card.meterMask.clear().beginFill(0xffffff)
        .drawRect(-72, 41 - 100 * card.fillFraction, 144, 100 * card.fillFraction).endFill();
      card.fillState = fillState;
      card.refreshedAt = uiTime;
    }
    card.cost.tint=affordable || maxed ? 0xffffff : 0xff6257;
    card.status.tint=affordable ? 0x9dffb4 : 0xffffff;
    card.panel.tint=0x485b44;
    card.available.visible=affordable;
    card.priceBack.tint=affordable ? 0x287d68 : 0x75512c;
    card.parent.alpha=maxed ? .65 : 1;
  }
  nativeHud.update(session,ecoMode,meta.buffTimes,meta.entitlements,stepUpClock(),freeCashBannerProjection().hud,offerWallProjection().visible);syncBossHud();
  world.visible=!ecoMode;
  drawPanel();
}

let origin: { x: number; y: number } | null = null;
let pointerId: number | null = null;
let move = { moveX: 0, moveY: 0 };
const pressed = new Set<string>();
canvas.addEventListener("pointerdown", event => {
  const rect = canvas.getBoundingClientRect();
  const y = (event.clientY - rect.top) * H / rect.height;
  const huntInput=liveHunt?.phase==='playing'||liveRaid?.phase==='playing';
  if (offerWallClient.open || freeCashClient.open || newGunPopup || ecoMode || (!huntInput&&(y < 160 || y > 990)) || (huntInput&&y<160) || session.overlay !== "none" || settingsOpen || localPanel!=="none" || transition.active || ((liveHunt||liveRaid)&&!huntInput)) return;
  pointerId = event.pointerId;
  origin = { x: event.clientX, y: event.clientY };
  feedback.unlock();
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", event => {
  if (offerWallClient.open || freeCashClient.open || event.pointerId !== pointerId || !origin) return;
  move = { moveX: Math.max(-1, Math.min(1, (event.clientX - origin.x) / 55)),
    moveY: Math.max(-1, Math.min(1, (event.clientY - origin.y) / 55)) };
});
canvas.addEventListener("pointerup", event => {
  pointerId = null;
  origin = null;
  move = { moveX: 0, moveY: 0 };
});
const movementKeys = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if (!movementKeys.has(key)) return;
  event.preventDefault();
  if (offerWallClient.open || freeCashClient.open) return;
  pressed.add(key);
});
addEventListener("keyup", event => {
  const key = event.key.toLowerCase();
  if (!movementKeys.has(key)) return;
  event.preventDefault();
  pressed.delete(key);
});
function resetMovementInput() {
  pressed.clear();
  const captured=pointerId;
  pointerId = null;
  origin = null;
  move = { moveX: 0, moveY: 0 };
  if(captured!==null&&canvas.hasPointerCapture(captured))canvas.releasePointerCapture(captured);
}
canvas.addEventListener("pointercancel", resetMovementInput);
canvas.addEventListener("lostpointercapture", resetMovementInput);
addEventListener("blur", resetMovementInput);
document.addEventListener("visibilitychange", () => { if (document.hidden) resetMovementInput();else offerWallClient.resume(); });

let qaFreeze = !!qaRoute.error;
let accumulator = 0;
let lastTick = performance.now();
const frameSamples:{gap:number;cpu:number;steps:number;eco:boolean;draw:number}[]=[];
let renderCPU=0;
if(import.meta.env.DEV){const render=app.renderer.render.bind(app.renderer);app.renderer.render=(...args:Parameters<typeof app.renderer.render>)=>{const start=performance.now();try{return render(...args);}finally{renderCPU=performance.now()-start;}};}

let adventureClockSample=0;
app.ticker.add(() => {
  const now = performance.now();
  const wallDelta = Math.min((now - lastTick) / 1000, 1);
  lastTick = now;
  // Check timed rights before simulation and auto motion, not at the one-second UI sample.
  if(refreshWeekly())update();
  const adTick=sourceAdGunTick(session,adGunTimer,wallDelta,stepUpClock(),!!pendingAdGunReward||platformPending||!!pendingAdventureReward||!!pendingBuffReward);adGunTimer=adTick.timer;if(adTick.session!==session){session=adTick.session;saveProgress();update();}
  if(localPanel==='adventure'&&sourcePanel&&'syncFrame'in sourcePanel)(sourcePanel as SourceAdventurePanelView).syncFrame?.();
  if(now-adventureClockSample>=1000){adventureClockSample=now;if(liveRaid||localPanel==='raid'||localPanel==='raid-star-pig'||localPanel==='raid-helper'||localPanel==='raid-mission'||starReturn==='raid'||gunDetailReturn==='raid'&&localPanel==='gun-info'){refreshRaidClock();if(localPanel==='raid-mission'&&sourcePanel&&'sync'in sourcePanel)(sourcePanel as SourceRaidMissionPanelView).sync(raidMissionPanelState());if(localPanel==='raid-helper'&&sourcePanel&&'sync'in sourcePanel)(sourcePanel as SourceRaidHelperPanelView).sync(raidHelperPanelState());if(localPanel==='raid-star-pig'&&sourcePanel&&'sync'in sourcePanel)(sourcePanel as SourceRaidStarPigPanelView).sync(raidStarPigPanelState());if(localPanel==='raid'&&sourcePanel&&'sync'in sourcePanel)(sourcePanel as SourceRaidPanelView).sync(raidPanelState());}refreshWeekly();if(localPanel==='weekly'&&sourcePanel&&'sync'in sourcePanel)(sourcePanel as SourceWeeklyPanelView).sync(weeklyPanelState());refreshDiaPig();if(localPanel==='diapig'&&sourcePanel&&'sync'in sourcePanel)(sourcePanel as SourceDiaPigPanelView).sync(diaPigPanelState());const clock=refreshAdventureClock();if(localPanel==='adventure'&&sourcePanel&&'syncClock'in sourcePanel)(sourcePanel as SourceAdventurePanelView).syncClock(meta.adventure,clock);}
  if(liveRaid){const owner=liveRaid;raidLoadingElapsed+=wallDelta;owner.advance(Math.min(wallDelta,.1),{simulate:!qaFreeze&&!settingsOpen&&!document.hidden,acceptInput:!ecoMode&&!settingsOpen&&!newGunPopup,presentation:!ecoMode&&!document.hidden,joystick:{x:move.moveX+Number(pressed.has('d')||pressed.has('arrowright'))-Number(pressed.has('a')||pressed.has('arrowleft')),y:-move.moveY+Number(pressed.has('w')||pressed.has('arrowup'))-Number(pressed.has('s')||pressed.has('arrowdown'))}});if(owner.closed){cancelLiveRaid();localPanel='raid';lastPanel='';feedback.setMusicMode('main');}}
  const policy=currentRuntimePolicy();
  if(liveHunt){
    const owner=liveHunt;
    huntLoadingElapsed+=wallDelta;
    owner.advance(Math.min(wallDelta,.1),{simulate:!qaFreeze&&!settingsOpen&&!document.hidden,acceptInput:!ecoMode&&!settingsOpen&&!newGunPopup,presentation:!ecoMode&&!document.hidden,
      joystick:{x:move.moveX+Number(pressed.has('d')||pressed.has('arrowright'))-Number(pressed.has('a')||pressed.has('arrowleft')),y:-move.moveY+Number(pressed.has('w')||pressed.has('arrowup'))-Number(pressed.has('s')||pressed.has('arrowdown'))}});
    if(owner.closed){cancelLiveHunt();localPanel='none';lastPanel='';feedback.setMusicMode('main');}
  }
  feedback.setCombatEnabled(policy.combatAudio);
  newGunPopup?.update(wallDelta);
  if(!transition.active&&!qaFreeze)meta={...meta,buffTimes:sourceTickBuffTimes(meta.buffTimes,wallDelta,meta.entitlements.buffPack)};
  meta=runtimeSourceAutoUpgradeTick({session,activities,platform,meta},wallDelta,autoAdClient.adShowing||!!petDailyClient.pending&&!petDailyClient.saveFailed||!!gunDailyClient.pending&&!gunDailyClient.saveFailed||!!pendingBuffReward||!!pendingMineSpeedReward||!!pendingAdGunReward).meta;
  accumulator += wallDelta;
  let steps = 0;
  while (accumulator >= 1 / 60 && steps++ < 60) {
    const screenInput = {
      moveX: !liveHunt && !liveRaid && !newGunPopup && session.overlay === "none" && !settingsOpen && localPanel==="none" && !transition.active && !ecoMode ? move.moveX + Number(pressed.has("d") || pressed.has("arrowright")) - Number(pressed.has("a") || pressed.has("arrowleft")) : 0,
      moveY: !liveHunt && !liveRaid && !newGunPopup && session.overlay === "none" && !settingsOpen && localPanel==="none" && !transition.active && !ecoMode ? move.moveY + Number(pressed.has("s") || pressed.has("arrowdown")) - Number(pressed.has("w") || pressed.has("arrowup")) : 0
    };
    if(policy.animateWorld)for(const actor of session.battle.actors ?? []) positionRig(actor.id,session.battle,usesChallengeProjection(),1/60,false);
    if (policy.simulate) {
      // Feedback uses the same fixed clock as combat. A throttled render frame
      // must not stretch .75s numbers or 1.2s cash into ten-second piles.
      for (let i=fleeting.length-1;i>=0;i--) {
        const item=fleeting[i],dt=1/60;
        if(item.adapterView) {item.adapterAge=(item.adapterAge??0)+dt;updateProjectileView(item.adapterView,item.adapterAge,15);}
        else item.time-=dt;
        if(item.offset) {item.offset.y+=item.speed*dt;item.offset.x+=item.drift*dt;}
        else {item.node.y+=item.speed*dt;item.node.x+=item.drift*dt;}
        item.node.rotation+=item.spin*dt;
        item.node.alpha=item.adapterView?1:Math.min(1,Math.max(0,item.time*2));
        if(item.adapterView?item.adapterView.presentation.completed:item.time<=0) {
          item.node.parent?.removeChild(item.node);item.node.destroy({children:true});fleeting.splice(i,1);
        }
      }
      if(policy.worldPresentation)advanceRetiredParticles(1/60);
      passClient.refresh();const previous=session;
      session = step(session, 1 / 60, screenInputToWorld(screenInput), resolveMuzzle,meta.entitlements,meta.fish,meta.pet,meta.buffTimes,meta.relic);
      activities=observeActivities(activities,previous,session);observedSession=session;
    }
    if(policy.worldPresentation&&!liveHunt?.ownsField&&!liveRaid?.ownsField)for(const actor of session.battle.actors ?? []) positionRig(actor.id,session.battle,usesChallengeProjection(),0,false);
    consumeEvents();
    runAutoUpgradeIfDirty();
    accumulator -= 1 / 60;
  }
  nativeHud.view.update(wallDelta);bossHud?.update(wallDelta);huntHud?.update(wallDelta);raidHud?.update(wallDelta);sourcePanel?.update(wallDelta);
  if(localPanel==="buff"&&sourcePanel)syncSourceBuffPanel(sourcePanel,meta.buffTimes,meta.entitlements);
  if(localPanel==="auto"&&sourcePanel)sourcePanel.setText("/Canvas/Shop_manager/AutoUpgrade_UI/Panel/Purchase_obj/Time_txt",meta.entitlements.autoUpgradePack?"永久权益已开通":`${Math.ceil(meta.autoUpgrade.adRemainingSec)} 秒`);
  if(session.bossMotion&&(session.mode==="boss"||session.mode==="boss-result"))bossView.update({dtSeconds:transition.active||qaFreeze?0:wallDelta});
  transition.advance(wallDelta);
  for(const item of fleeting)if(item.worldAnchor&&item.offset) {
    const p=projectWorld(item.worldAnchor,actorWorld(session.battle.player,usesChallengeProjection()));
    item.node.position.set(p.x+item.offset.x,p.y+item.offset.y);
  }
  if(now-lastSave>2000){saveProgress();lastSave=now;}
  update();
  if(import.meta.env.DEV){frameSamples.push({gap:wallDelta*1000,cpu:performance.now()-now,steps,eco:ecoMode,draw:renderCPU});if(frameSamples.length>300)frameSamples.shift();}
});
update();
const frameClock=installFrameClock(app);
loadState.__catPhase = "running";
setBootProgress(99,'画面准备完毕…');
if (import.meta.env.DEV && new URLSearchParams(location.search).has("spine")) {
  import("./spine-probe").then(({ startSpineProbe }) => startSpineProbe(app)).then(slime => {
    (window as Window & { __spineProbe?: string }).__spineProbe = slime.state.tracks[0] ? "Walk playing" : "missing animation";
  }).catch(error => {
    (window as Window & { __spineProbe?: string }).__spineProbe = String(error);
  });
}
reflowScene=()=>{
  ground.width=W;ground.height=H;
  loadingBackdrop.clear().beginFill(0xe0d39b).drawRect(0,0,W,H).endFill();loadingCat.position.set(W/2,H/2);
  raidScene?.resize(W,H);raidHud?.reflow({width:W,height:H});huntScene?.resize(W,H);huntHud?.reflow({width:W,height:H});nativeHud.view.reflow({width:W,height:H});bossHud?.reflow({width:W,height:H});sourcePanel?.reflow({width:W,height:H});freeCashView?.reflow({width:W,height:H});redeemInput?.sync();newGunPopup?.reflow({width:W,height:H});lastPanel="";update();
};
if (import.meta.env.DEV||new URLSearchParams(location.search).has('qa')) {
  // Explicit standalone QA entry ships with the same build; ordinary entry has no fixture API.
  Object.assign(window, { __catEngine: app,__catSourceUI:()=>({localization:sourceLocalizationDiagnostics(),hudLayers:{legacy:{visible:hud.visible,attached:hud.parent!==null,eventMode:hud.eventMode},source:{visible:nativeHud.view.root.visible,attached:nativeHud.view.root.parent===app.stage},boss:{visible:bossHud?.root.visible??false}},freeCash:freeCashView?.layout,freeCashTexts:freeCashView?Object.fromEntries([...freeCashView.texts].map(([id,text])=>[id,text.text])):undefined,hud:raidHud?.layout??huntHud?.layout??bossHud?.layout??nativeHud.view.layout,newGun:newGunPopup?.layout,panel:sourcePanel?.layout,panelRoot:sourcePanel?.instanceId,panelTexts:sourcePanel?Object.fromEntries([...sourcePanel.texts].map(([id,text])=>[id,text.text])):undefined,panelScroll:sourcePanel?.captureScroll(),panelDiagnostics:sourcePanel?.diagnostics,petDrag:localPanel==="pet"&&sourcePanel?{state:(sourcePanel as SourcePetPanelView).dragState,preview:(sourcePanel as SourcePetPanelView).dragPreview,pending:(sourcePanel as SourcePetPanelView).pendingDrop}:null,gunDrag:session.overlay==="gun"&&sourcePanel?{state:(sourcePanel as SourceGunPanelView).dragState,pending:(sourcePanel as SourceGunPanelView).pendingDrop}:null,diagnostics:nativeHud.diagnostics(),frameClock:frameClock.diagnostics}),__catRaidClient:()=>liveRaidDiagnostics(),__catRaidRoundtrip:()=>{if(!qaFixtureActive)throw Error('Explicit isolated QA only');const saved={session:serializeSession(session),meta:serializeSourceMetaState(meta),activities:serializeActivityState(activities),platform:JSON.stringify(platform)};cancelLiveHunt();session=deserializeSession(saved.session);meta=decodeSourceMetaState(saved.meta);activities=decodeActivityState(saved.activities);platform=decodePlatformState(saved.platform);localPanel='raid';qaFreeze=true;raidSelection=sourceRaidAutoSelect(session,sourceRaidWeakType(meta.raid.seasonIndex));localNotice='独立档内存codec往返；次数/任务/星宝石保留，未完成战斗不补奖';lastPanel='';feedback.setMusicMode('main');update();},__catHuntClient:()=>liveHuntDiagnostics(),__catHuntRoundtrip:()=>{if(!qaFixtureActive)throw Error('Explicit isolated QA only');const saved={session:serializeSession(session),meta:serializeSourceMetaState(meta),activities:serializeActivityState(activities),platform:JSON.stringify(platform)};cancelLiveHunt();session=deserializeSession(saved.session);meta=decodeSourceMetaState(saved.meta);activities=decodeActivityState(saved.activities);platform=decodePlatformState(saved.platform);localPanel='monster';qaFreeze=true;localNotice='独立档内存codec往返：Wave、宠物币、收据保留；源临时run不保存。';qaBadge.textContent+=' · 内存codec往返（非普通档）';lastPanel='';feedback.setMusicMode('main');update();},__catSourceBounds:(id:string)=>{const view=freeCashView?.get(id)?freeCashView:sourcePanel?.get(id)?sourcePanel:nativeHud.view;const n=view?.get(id);return n?{...n.getBounds(),active:view?.layout.get(id)?.active}:null;},__catSourceAction:onSourceAction,__catBossView:()=>bossView.debugPose(),__catPerformance:()=>{const sorted=(key:"gap"|"cpu"|"draw")=>frameSamples.map(s=>s[key]).sort((a,b)=>a-b);const quant=(key:"gap"|"cpu"|"draw",p:number)=>{const v=sorted(key);return v[Math.min(v.length-1,Math.floor(v.length*p))]??0;};return {samples:frameSamples.length,fps:frameSamples.length/(frameSamples.reduce((n,s)=>n+s.gap,0)/1000),gapP50:quant("gap",.5),gapP95:quant("gap",.95),cpuP50:quant("cpu",.5),cpuP95:quant("cpu",.95),drawP50:quant("draw",.5),drawP95:quant("draw",.95),eco:ecoMode};} });
  const diagnostic = window as Window & { __catCapture?: () => Promise<string>; __catState?: () => Session };
  diagnostic.__catCapture = async () => {
    const target = RenderTexture.create({ width: W, height: H, resolution: app.renderer.resolution });
    app.renderer.render(app.stage, { renderTexture: target, clear: true });
    const image = await app.renderer.extract.base64(target);
    target.destroy(true);
    return image;
  };
  diagnostic.__catState = () => session;
  const qa=window as Window & {__catQA?:(scenario:SourceQAScenario)=>void;__catPresentation?:()=>unknown};
  qa.__catQA=scenario=>{
    cancelLiveHunt();
    if(!isSourceQAScenario(scenario))throw new Error(`未知测试场景：${scenario}`);
    gameStorage.isolate();
    petDailyClient.invalidate();gunDailyClient.invalidate();autoAdClient.invalidate();shopPurchaseClient.invalidate();
    cancelPlatformOperation();newGunQueue.length=0;newGunPopup?.destroy();newGunPopup=null;
    qaActivityPurchaseSaveFailure=false;qaShopPurchaseSaveFailure=false;qaOfferWallSaveFailure=false;qaPassDate=null;qaPassSaveFailure=false;qaFreeCashExposure=false;clearNewGunQueue();starReturn='none';starSlot=0;raidSelection=[null,null,null];raidSelectingSlot=null;gunDetail=undefined;gunDetailReturn='none';panelScrollMemory.clear();renderedPanelIdentity="";transition.reset();settingsOpen=false;localPanel="none";qaFreeze=false;qaFixtureActive=true;qaGunDailyDate=null;qaGunDailySaveFailure=false;qaAutoAdDate=null;qaAutoAdSaveFailure=false;qaAdventureTime=null;pendingBuffReward=null;pendingMineSpeedReward=null;pendingChallengeReward=null;pendingMineResultReward=null;pendingHuntResultReward=null;pendingAdGunReward=null;adGunTimer=0;petAuto=freshSourcePetAutoState();activityPurchaseClient.invalidate();weeklyStateOwner++;bossResultRewardClient.invalidate();qaBossRewardSaveFailure=false;freeCashClient.reset();freeCashProvider=null;offerWallClient.reset();qaFreeCashSaveFailure=false;raidStarPigClient.invalidate();raidHelperClient.invalidate();raidMissionClient.invalidate();passClient.invalidate();passPopup='none';raidMissionTicketOpen=false;weeklyMenu=0;weeklyReturn='none';weeklyScrollToAuto=false;pendingAdventureReward=null;pendingPrismReward=null;prismStateOwner++;diaPigPurchaseClient.invalidate();diaPigRuntime=null;qaDiaPigOffset=0;adventureNavigation=freshAdventureNavigation();petInfoGrade=0; session=createSession(0xc47);meta=freshSourceMetaState();platform=freshPlatformState();developmentProvider=createLocalDevelopmentR5PlatformProvider({getLocalState:()=>platform,storage:gameStorage});qaBadge.textContent=`QA 独立档 · ${scenario} · 不写普通存档 · 本地测试 provider`;qaBadge.style.display='block';session.overlay="none";session.dailyClaimed=true;activities=createActivityState();observedSession=session;
    if(scenario.startsWith('offerwall-')){qaFreeze=true;session.historicMax=scenario==='offerwall-locked'?89:90;session.diamonds=1234;
      if(scenario==='offerwall-pending'){meta.offerWall={localBalance:0,pending:{id:'fixture:debit',amount:17,place:'qa'},localDebits:[{id:'fixture:debit',amount:17,place:'qa'}],localGrants:[]};}
      if(scenario==='offerwall-shop')localPanel='shop';if(scenario==='offerwall-page')void offerWallClient.show('qa');qaBadge.textContent+=' · 明示type1曝光10大关 · QA余额非源奖励';
    }
    if(scenario.startsWith('freecash-')){qaFreeze=true;session.historicMax=scenario==='freecash-locked'?139:scenario==='freecash-over-hud'?350:140;session.diamonds=123456789;meta.petCoin=987654321;if(scenario==='freecash-owned'){meta.freeCash={...freshSourceFreeCash(),isLinkRewardReceived:true,isRewardAdRemoved:true,localReceipts:['fixture:linked']};meta.entitlements.adRemoved=true;}if(scenario==='freecash-shop')localPanel='shop';if(scenario==='freecash-buff')localPanel='buff';if(scenario==='freecash-page'||scenario==='freecash-owned')void freeCashClient.show('qa');else void freeCashClient.request('init');qaBadge.textContent+=' · 明示type1曝光配置15–35／非线上配置';}
    if(['shop','shop-owned','shop-old-save'].includes(scenario)){qaFreeze=true;session.diamonds=123456789;localPanel='shop';if(scenario==='shop-owned')meta.entitlements={...meta.entitlements,autoUpgradePack:true,buffPack:true,diaPack:true,removeAdsForced:true,removeAdsAll:true};if(scenario==='shop-old-save'){const old=JSON.parse(serializeSourceMetaState(meta));delete old.entitlements.diaPack;meta=decodeSourceMetaState(JSON.stringify(old));}qaBadge.textContent+=' · 商城本地测试provider · 不真实支付';}
    if(['mine-speed','mine-speed-auto','mine-speed-empty','mine-plus'].includes(scenario)){qaFreeze=true;session.historicMax=190;session.overlay='mine';session.diamonds=500;session.mine.tickets={...session.mine.tickets,storedDate:localMineTime.today(),used:scenario==='mine-speed-empty'?2:0};if(scenario==='mine-speed-auto')meta.entitlements.plusPack2Active=true;if(scenario==='mine-plus')meta.entitlements.minePack=true;}
    if(scenario==='mine-pack'){qaFreeze=true;session.historicMax=40;session.overlay='mine';session.mine.tickets.used=2;session.diamonds=500;localPanel='mine-pack';}
    if(scenario.startsWith('adgun')){qaFreeze=true;qaAdventureTime={date:new Date('2026-10-02T12:00:00Z'),started:performance.now()};session.gunUnlocked=true;session.overlay='gun';session.historicMax=190;session.catalogSeen=scenario==='adgun-catalog'?[0,10]:[0,4];session.gunInventory=scenario==='adgun-full'?Array.from({length:16},(_,i)=>({...sourceGun(i%2===0?0:4),uid:`fixture:full:${i}`})):[{...sourceGun(0),uid:'fixture:normal:0'},{...sourceGun(4),uid:'fixture:normal:1'}];meta.adTemporaryGunServer=scenario!=='adgun-disabled';session.adGun=freshSourceAdGun();if(['adgun','adgun-expire'].includes(scenario)){session.adGun.hasMerged=true;session=sourceAddAdRewardGun(session,14,scenario==='adgun-expire'?10:1800,stepUpClock(),'fixture:temp');session.adGun!.eventGiven=true;}qaBadge.textContent+=` · Weapon02本地配置${meta.adTemporaryGunServer?'开':'关'} · provider延迟${new URLSearchParams(location.search).get('adgun-provider-delay')??0}ms`;}
    if(new URLSearchParams(location.search).get('activity-save-failure')==='1'){qaActivityPurchaseSaveFailure=true;qaBadge.textContent+=' · 活动交易保存失败夹具（点原商品重试同回执）';}
    const activityDelay=Math.min(10000,Math.max(0,Number(new URLSearchParams(location.search).get('activity-provider-delay'))||0));if(activityDelay)qaBadge.textContent+=` · 活动provider延迟夹具 ${activityDelay}ms`;
    if(scenario.startsWith('boss-plus')||scenario.startsWith('hunt-plus')){qaFreeze=true;session.historicMax=scenario.endsWith('-locked')?189:190;session.plusPack=freshSourcePlus();localPanel=scenario.startsWith('boss-')?'boss':'monster';if(scenario.endsWith('-active')){const item=scenario.startsWith('boss-')?0:2;session.plusPack.purchasedUTC[item]=stepUpClock();meta.entitlements={...meta.entitlements,[item===0?'plusPack0Active':'plusPack2Active']:true};}}
    if(scenario.startsWith('weekly')||scenario.startsWith('plus-')){qaFreeze=true;qaAdventureTime={date:new Date(2026,9,4,23,59,0),started:performance.now()};session.gunUnlocked=true;session.historicMax=scenario==='weekly-vip-locked'?189:190;session.catalogSeen=scenario==='weekly-locked'?[0,14]:[0,15];session.gunInventory=scenario==='weekly-full'?Array.from({length:GUN_INVENTORY_CAPACITY},(_,i)=>({...sourceGun(0),uid:`fixture:${i}`})):[];session.weeklyShop=freshSourceWeekly();session.plusPack=freshSourcePlus();meta.petCoin=123456789;weeklyMenu=scenario.startsWith('plus-')?1:0;if(scenario==='weekly-cap'){session=sourceWeeklyRefresh(session,new Date(stepUpClock()));session.weeklyShop!.purchaseCounts=[2,2,1];}if(['plus-active','plus-expire'].includes(scenario)){session.plusPack!.purchasedUTC=[stepUpClock()-(SOURCE_PLUS_DURATION_MS-(scenario==='plus-expire'?10000:86400000)),null,null];}if(scenario==='plus-legacy')meta.entitlements.plusPack2Active=true;if(!['weekly-hud','weekly-locked'].includes(scenario))localPanel='weekly';}
    if(scenario.startsWith('diapig')){qaFreeze=true;session.diamonds=123456789;const unlocked=['diapig-one','diapig-both','diapig-full'].includes(scenario);meta.entitlements.removeAdsAll=unlocked;meta.entitlements.removeAdsForced=scenario==='diapig-both';session.diaPig={diamonds:scenario==='diapig-full'?500:unlocked?23:0,lastTickUTC:null};refreshDiaPig();if(scenario!=='diapig-hud')localPanel='diapig';}
    if(scenario.startsWith('stepup')){qaFreeze=true;qaAdventureTime={date:new Date('2026-10-02T12:00:00Z'),started:performance.now()};session.gunUnlocked=true;session.catalogSeen=scenario==='stepup-locked'?[0,9]:[0,10];session.gunInventory=scenario==='stepup-full'?Array.from({length:GUN_INVENTORY_CAPACITY},(_,i)=>({...sourceGun(0),uid:`fixture:${i}`})):[];session.stepUp=freshSourceStepUp();if(scenario==='stepup-expired')session.stepUp.startedUTC=stepUpClock()-7*86400000;if(scenario==='stepup-complete'){session.stepUp.startedUTC=stepUpClock()-1000;session.stepUp.purchased=Array(5).fill(true);}if(scenario==='stepup-banner')session.overlay='gun';else if(!['stepup-hud','stepup-locked'].includes(scenario))localPanel='stepup';}
    if(scenario.startsWith('challenge-')) {
      session.challengeStage=3;session.gunUnlocked=true;session.historicMax=190;session=openChallenge(session);
      if(['challenge-auto','challenge-sweep','challenge-sweep-low','challenge-sweep-auto'].includes(scenario))meta.entitlements.plusPack2Active=true;
      if(['challenge-victory-auto','challenge-sweep-auto'].includes(scenario))meta.entitlements.removeAdsAll=true;
      if(['challenge-sweep','challenge-sweep-auto','challenge-fight'].includes(scenario))session.equippedGuns=[sourceGun(25),sourceGun(25),sourceGun(25)];
      if(scenario==='challenge-victory'||scenario==='challenge-victory-auto'||scenario==='challenge-freecash') {
        qaFreeCashExposure=scenario==='challenge-freecash';
        session=startChallenge(session);session.battle.targets=session.battle.targets.map(t=>({...t,health:0,healthValue:BigValue.ZERO}));session=settleChallengeVictory(session,meta.entitlements);
      }
      if(scenario==='challenge-defeat'||scenario==='challenge-defeat-freecash'){qaFreeCashExposure=scenario==='challenge-defeat-freecash';session=startChallenge(session);session.mode='defeat';}
    }
    if(scenario==="third-stage") session.battle=createFieldLevel(2,4);
    if(scenario==="third-layout")session.battle=createFieldLevel(2,0);
    if(scenario==="mine"||scenario.startsWith("mine-result")) {
      session.historicMax=30;session=startMine(openMine(session));
      if(scenario.startsWith("mine-result")&&session.mine.run) {
        session.mine.run.score=300;session.mine.run.elapsed=59.99;session.battle.elapsed=59.99;
        if(scenario==="mine-result-auto")meta.entitlements.removeAdsAll=true;session=step(session,.02,undefined,undefined,meta.entitlements);
      }
    }
    if(scenario==="mine-result-freecash")qaFreeCashExposure=true;
    if(scenario==="mine-sweep-result"){qaFreeze=true;session.historicMax=30;session.mine.bestReward=30;meta.entitlements.plusPack2Active=true;session=openMine(session);({session,activities,platform,meta}=runtimeSourceMineSweep({session,activities,platform,meta}));}
    if(scenario==="rebirth"||scenario==="permanent") {
      session.historicMax=20;session.battle=createFieldLevel(2,1,10000);session.ruby=BigValue.fromInteger(300);
      session=scenario==="rebirth"?openRebirth(session):openPermanent(session);
    }
    if(scenario==="special-guns")session.equippedGuns=[sourceGun(21),sourceGun(24),sourceGun(29)];
    if(scenario.startsWith("upgrade-")) {
      const coins=Number(scenario.slice(8));session.battle=createFieldLevel(0,0,coins);
      // Freeze only the fixture's combat so the affordability boundary can be inspected.
      session.overlay="none";qaFreeze=true;
    }
    if(scenario==="three-cats") {
      session.equippedGuns=[sourceGun(0),sourceGun(1),sourceGun(3)];
    }
    if(scenario==="gun-drag") {session.gunUnlocked=true;session.overlay="gun";session.diamonds=3000;session.gunInventory=[sourceGun(0),sourceGun(4),sourceGun(5),sourceGun(6)];qaFreeze=true;}
    if(["gun-auto","gun-auto-shop","gun-auto-expire"].includes(scenario)){session.historicMax=190;session.gunUnlocked=true;session.overlay="gun";session.diamonds=3000;session.catalogSeen=[0,30];session.gunInventory=[sourceGun(0),sourceGun(3),sourceGun(5),sourceGun(8)];meta.entitlements.plusPack2Active=scenario==="gun-auto";qaFreeze=true;}
    if(scenario.startsWith('auto-ad')){qaFreeze=true;localPanel='auto';session.battle={...session.battle,coins:10000,coinsValue:BigValue.from(10000)};qaAutoAdDate='h5-local:2026-10-04';session.historicMax=190;meta.autoUpgrade={requested:scenario!=='auto-ad-off',lastAdDate:scenario==='auto-ad-used'?'h5-local:2026-10-04':null,adRemainingSec:scenario==='auto-ad-active'?600:0};meta.entitlements.autoUpgradePack=scenario==='auto-ad-permanent';meta.entitlements.removeAdsAll=scenario==='auto-ad-remove-all';meta.entitlements.removeAdsForced=scenario==='auto-ad-remove-forced';meta.entitlements.adRemoved=scenario==='auto-ad-freecash';}
    if(scenario.startsWith('gun-daily')){session.historicMax=scenario==='gun-daily-locked'?29:30;session.gunUnlocked=true;session.overlay='gun';session.gunInventory=scenario==='gun-daily-full'?Array.from({length:16},(_,i)=>({...sourceGun(i),uid:`qa-daily-${i}`})):[{...sourceGun(0),uid:'qa-daily-owned'}];meta.adDailyGun={serverWeapon01AdOn:scenario!=='gun-daily-disabled',lastDailyGunKey:scenario==='gun-daily-used'?'h5-local:2026-10-04':null};qaGunDailyDate='h5-local:2026-10-04';meta.entitlements.removeAdsAll=scenario==='gun-daily-remove-all';meta.entitlements.removeAdsForced=scenario==='gun-daily-remove-forced';meta.entitlements.adRemoved=scenario==='gun-daily-freecash';qaFreeze=true;}
    if(['gun-storage','gun-storage-locked','gun-storage-full','gun-safe','gun-safe-empty','gun-safe-full','gun-collection'].includes(scenario)){session.historicMax=scenario==='gun-storage-locked'?389:390;session.gunUnlocked=true;session.overlay='gun';session.diamonds=3000;session.gunInventory=[sourceGun(0),sourceGun(3),sourceGun(5)];session.gunSafe=freshSourceGunSafe();session.catalogSeen=[0,5];gunDetail=undefined;gunDetailReturn='none';qaFreeze=true;if(scenario==='gun-safe'){session.gunSafe.guns[0]=sourceGun(20);localPanel='gun-safe';}if(scenario==='gun-storage-full'){session.gunInventory=Array.from({length:16},(_,i)=>sourceGun(i%65));session.gunSafe.guns[0]=sourceGun(20);localPanel='gun-safe';}if(scenario==='gun-safe-empty'){session.diamonds=49;localPanel='gun-safe';}if(scenario==='gun-safe-full'){session.gunSafe.purchased=10;session.gunSafe.guns=Array.from({length:16},(_,i)=>sourceGun(i));}if(scenario==='gun-collection')localPanel='gun-collection';}
    if(scenario.startsWith('skin-')){session.diamonds=scenario==='skin-empty'?99:5000;session.skin=freshSourceSkinState();skinIndex=1;localPanel=scenario==='skin-list'?'skin':'skin-info';if(scenario==='skin-owned')session.skin.owned[1]=true;qaFreeze=true;}
    if(scenario==='buff-panel'){localPanel='buff';platform={...platform,developerEnabled:true,freeAds:true};qaFreeze=false;}
    if(scenario.startsWith('raid-')){
      qaFreeze=true;qaAdventureTime={date:new Date('2026-10-05T12:00:00Z'),started:performance.now()};session.historicMax=scenario==='raid-locked'?389:390;session.gunUnlocked=true;session.starGem=3000;
      session.equippedGuns=[{...sourceGun(0),uid:'raid:eq0'},{...sourceGun(30),uid:'raid:eq1'},null];session.gunInventory=[{...sourceGun(30),uid:'raid:in0'},{...sourceGun(5),uid:'raid:in1'}];
      session.gunSafe={...freshSourceGunSafe(),guns:[{...sourceGun(31),uid:'raid:safe0'},{...sourceGun(64),uid:'raid:safe1'},...Array(14).fill(null)]};
      if(scenario==='raid-empty'){session.equippedGuns=[null,null,null];session.gunInventory=[];session.gunSafe=freshSourceGunSafe();}
      openRaidPanel();if(scenario==='raid-ad')meta.raid={...meta.raid,freeUseCount:2};if(scenario==='raid-iap')meta.raid={...meta.raid,freeUseCount:2,adUsed:true};if(scenario==='raid-used')meta.raid={...meta.raid,freeUseCount:2,adUsed:true,iapUsed:true};
    }
    if(scenario.startsWith('star-')){session.historicMax=scenario==='star-locked'?389:390;session.gunUnlocked=true;session.overlay='gun';session.starGem=scenario==='star-empty'?0:3000;session.equippedGuns=[sourceGun(25),sourceGun(0),null];qaFreeze=true;starSlot=0;if(scenario==='star-max')session.bossSlotLevels=[20,0,0];if(scenario==='star-pity'){session.bossSlotLevels=[17,0,0];session.starFailCounts=[3,0,0];}if(scenario!=='star-slots'&&scenario!=='star-locked')localPanel='star';}
    if(scenario.startsWith('pass-')){qaPassDate='2026-01-31T12:00:00+08:00';passClient.refresh();}
    if(scenario==='pass-final'||scenario==='pass-final-vip'){
      localPanel='pass';qaFreeze=true;activities={...activities,passExp:2500,passClaims:Array.from({length:scenario==='pass-final-vip'?25:24},(_,i)=>i)};
      meta.vip=scenario==='pass-final-vip';meta.epicClaims=Array.from({length:scenario==='pass-final-vip'?24:0},(_,i)=>i);
    }
    if(scenario==='pass-scroll'){localPanel='pass';activities={...activities,passExp:2400,passClaims:Array.from({length:10},(_,i)=>i)};meta.vip=true;meta.epicClaims=Array.from({length:10},(_,i)=>i);qaFreeze=true;}
    if(['pass-initial','pass-later','pass-core','pass-next','pass-provider','pass-full'].includes(scenario)){
      localPanel='pass';qaFreeze=true;activities={...activities,passExp:scenario==='pass-next'?2500:600};
      if(scenario==='pass-provider')passPopup='vip';
      if(scenario==='pass-later'||scenario==='pass-core'){activities={...activities,season:'later'};meta={...meta,passLifecycle:{...meta.passLifecycle!,seasonNumber:1,gunSeason:scenario!=='pass-core'}};}
      if(scenario==='pass-next'){activities.passClaims=Array.from({length:25},(_,i)=>i);meta.vip=true;meta.epicClaims=Array.from({length:25},(_,i)=>i);}
      if(scenario==='pass-full'){activities.passClaims=[0,1];session.gunInventory=Array.from({length:16},(_,i)=>({...sourceGun(0),uid:`pass-full:${i}`}));}
    }

    if(scenario==="fish-panel") {session.historicMax=50;session.diamonds=3000;meta.fish.inventory=[0,0,1,2];localPanel="fish";qaFreeze=true;}
    if(scenario.startsWith('boss-reward')){qaFreeze=true;session.historicMax=190;session.diamonds=3000;session.equippedGuns=[sourceGun(25),null,null];meta.entitlements={...meta.entitlements,plusPack2Active:true,plusPack1Active:scenario==='boss-reward-plus',removeAdsAll:scenario==='boss-reward-auto'};session=sweepBoss(session,meta.entitlements);qaBossRewardSaveFailure=scenario==='boss-reward-save-failure';qaBadge.textContent+=' · 首领结算直达夹具／本地广告／未真实播放'+(qaBossRewardSaveFailure?'／保存失败可解除':'');}
    if(scenario==='boss-result-freecash'){session.historicMax=190;session.equippedGuns=[sourceGun(25),null,null];meta.entitlements.plusPack2Active=true;session=sweepBoss(session,meta.entitlements);qaFreeCashExposure=true;qaFreeze=true;}
    if(scenario==="boss-panel"||scenario==="boss-battle"||scenario==="boss-bonus"){session.historicMax=90;session.diamonds=3000;session.equippedGuns=[sourceGun(25),null,null];if(scenario==="boss-panel"){localPanel="boss";qaFreeze=true;}else session=startBoss(session,meta.entitlements);if(scenario==="boss-bonus")platform={...platform,developerEnabled:true,freeAds:true};}
    if(["pet-panel","pet-drag"].includes(scenario)||["pet-auto","pet-auto-shop","pet-auto-expire"].includes(scenario)||["pet-info","pet-draw-info"].includes(scenario)){session.historicMax=110;session.diamonds=3000;meta.petCoin=300;meta.pet.owned=[0,0,1,2,...Array(12).fill(-1)];meta.hunt.level=1;meta.pet.dailyLastDate="";meta.pet.collect[3]=true;meta.pet=sourcePetWithIdentities(meta.pet);meta.entitlements.plusPack2Active=scenario==="pet-auto";if(scenario.startsWith("pet-auto"))session.historicMax=190;petAuto=freshSourcePetAutoState();localPanel=scenario==="pet-info"?"pet-info":scenario==="pet-draw-info"?"pet-draw-info":"pet";qaFreeze=true;}
    if(['gun-auto-shop','gun-auto-expire','pet-auto-shop','pet-auto-expire'].includes(scenario)){
      qaAdventureTime={date:new Date(2026,9,4,23,59,0),started:performance.now()};session.plusPack=freshSourcePlus();
      if(scenario.endsWith('-expire'))session.plusPack.purchasedUTC[2]=stepUpClock()-SOURCE_PLUS_DURATION_MS+10000;
    }
    if(scenario.startsWith('relic-')||scenario.startsWith('prism-')){
      qaFreeze=true;qaAdventureTime={date:new Date(2026,9,4,12,0,0),started:performance.now()};session.historicMax=390;localPanel='adventure';adventureNavigation={...freshAdventureNavigation(),page:'relic'};
      meta.adventure.cores=[400,400,400,400];
      if(scenario==='relic-upgrade'||scenario==='relic-boundary'){
        meta.relic.items[0]={lv:scenario==='relic-boundary'?299:0,count:100,unlocked:true};adventureNavigation={...adventureNavigation,page:'relic-info',relicIndex:0};
      }
      if(scenario==='relic-empty')meta.adventure.cores=[0,0,0,0];
      if(scenario.startsWith('prism-')){
        adventureNavigation={...adventureNavigation,page:'prism',prismReturn:'relic'};
        if(scenario==='prism-cooldown')meta.coreShop={...freshSourcePrism(),lastPurchasedUTC:[stepUpClock()-86390000,stepUpClock()-1000,stepUpClock()-1000]};
        if(scenario==='prism-overflow')meta.adventure.cores[3]=0x7fffffff;
      }
      if(scenario==='relic-consumers'){
        meta.relic.items=meta.relic.items.map(()=>({lv:2,count:100,unlocked:true}));session.historicMax=390;session.battle=createFieldLevel(2,1,10000);session.ruby=BigValue.fromInteger(300);localPanel='none';session=openPermanent(session);
      }
    }
    if(scenario.startsWith('adventure-')){
      session.historicMax=390;qaFreeze=true;qaAdventureTime={date:new Date(2026,9,4,12,0,0),started:performance.now()};
      meta.pet.owned=[0,1,2,3,4,5,...Array(10).fill(-1)];meta.pet.collect[5]=true;meta.pet=sourcePetWithIdentities(meta.pet);
      localPanel='adventure';adventureNavigation=freshAdventureNavigation();
      if(scenario!=='adventure-panel'){
        const grant=runtimeSourceAdventure({session,activities,platform,meta},'start',0,0,adventureClock(),[{source:'owned',index:0,uid:meta.pet.ownedIDs[0]!}]);meta=grant.meta;
        if(scenario==='adventure-finish')meta=runtimeSourceAdventure({session,activities,platform,meta},'force-finish',0,0,adventureClock()).meta;
        adventureNavigation={...adventureNavigation,page:'maps'};
        if(scenario==='adventure-locked')localPanel='pet';
      }
    }
    if(scenario.startsWith("hunt-sweep-result")){session.historicMax=110;session.equippedGuns=[sourceGun(25),null,null];meta.entitlements.plusPack2Active=true;meta.entitlements.removeAdsAll=scenario.endsWith("-auto");({session,activities,platform,meta}=runtimeSourceHuntAction({session,activities,platform,meta},"sweep"));qaFreeCashExposure=scenario.endsWith("-freecash");localPanel="monster";qaFreeze=true;}
    if(scenario==="hunt-panel"||scenario==="hunt-sweep"||scenario.startsWith("hunt-client")){session.historicMax=110;session.equippedGuns=[sourceGun(25),null,null];meta.entitlements.plusPack2Active=scenario==="hunt-sweep";localPanel="monster";qaFreeze=true;
      if(scenario.startsWith('hunt-client')){session.equippedGuns=(scenario==='hunt-client-defeat'?[0,null,null]:[64,64,64]).map((id,i)=>id===null?null:{...sourceGun(id),uid:`qa-hunt-client-${i}`});if(scenario==='hunt-client-locked')session.historicMax=109;platform={...platform,developerEnabled:true,freeAds:true};}
    }
    if(scenario==="late-content") {session.historicMax=390;session.diamonds=3000;}
    if(scenario==="last-gun") {session.gunUnlocked=true;session.overlay="gun";}
    if(scenario==="eight-aim") {
      const point={...session.battle.player};
      session.battle.autoMove=false;
      session.battle.targets=session.battle.targets.slice(0,8).map((t,i)=>({...t,
        position:{x:point.x+Math.cos(i*Math.PI/4)*20/session.battle.worldUnitsPerPoint.x,
          y:point.y+Math.sin(i*Math.PI/4)*20/session.battle.worldUnitsPerPoint.y}}));
    }
    renderedMode=null;lastPanel="";for(const card of cards)card.refreshedAt=-Infinity;recentShotChecks.length=0;clearFleetingEffects();update();
  };
  Object.assign(qa,{__catPetDragQA:()=>({isolated:qaFixtureActive,pet:meta.pet,diamonds:session.diamonds,petCoin:meta.petCoin,notice:localNotice,localPanel,petInfoGrade,petDaily:{pending:petDailyClient?.pending?.id??null,saveFailed:petDailyClient?.saveFailed===true},inventorySlots:(sourcePanel as SourcePetPanelView)?.inventorySlots,inventoryPositions:localPanel==='pet'?(sourcePanel as SourcePetPanelView)?.inventorySlots.map(id=>{const n=sourcePanel!.get(id)!,l=sourcePanel!.layout.get(id)!;const p=n.toGlobal({x:0,y:0});return {id,active:l.active,x:p.x,y:p.y,expectedX:l.matrix.tx,expectedY:l.matrix.ty};}):undefined,emptySlots:(sourcePanel as SourcePetPanelView)?.emptySlots,equipmentSlots:(sourcePanel as SourcePetPanelView)?.equipmentSlots,panelRoot:sourcePanel?.instanceId,auto:petAuto}),__catPetDragFixture:(action:string)=>{
    if(!qaFixtureActive)throw Error('Explicit isolated QA only');
    if(action==='reload'){meta=decodeSourceMetaState(serializeSourceMetaState(meta));}
    else if(action==='lock-change'){meta.pet={...meta.pet,ownedLocks:meta.pet.ownedLocks.map((g,i)=>i===0?2:g)};}
    else if(action==='full'||action==='locked-same'||action==='max'||action==='reset'){
      if(localPanel==='pet') (sourcePanel as SourcePetPanelView)?.cancelDrag();
      const p=freshSourcePetState();p.owned=action==='full'?Array.from({length:16},(_,i)=>i%10):[action==='max'?9:0,action==='max'?9:0,1,2,...Array(12).fill(-1)];if(action==='locked-same')p.ownedLocks[0]=0;
      meta={...meta,pet:sourcePetWithIdentities(p)};petAuto=freshSourcePetAutoState();qaBadge.textContent+=` · 宠物拖动夹具:${action}（非自然档）`;
    }else throw Error('Unknown pet drag QA action');update();
  }});
  Object.assign(window,{__catBossRewardQA:()=>({pending:bossResultRewardClient.pending,saveFailed:bossResultRewardClient.saveFailed,saveFailureFixture:qaBossRewardSaveFailure,run:session.boss.run,mode:session.mode,diamonds:session.diamonds,claims:platform.claims,notice:localNotice}),__catBossRewardFixture:(action:string,value?:boolean)=>{
   if(!qaFixtureActive)return {status:'ordinary-save-rejected'};
   if(action==='save-failure'){qaBossRewardSaveFailure=value===true;qaBadge.textContent=`QA 独立档 · 首领奖励保存失败夹具 ${qaBossRewardSaveFailure?'开':'关'} · 不写普通存档 · 本地测试provider`;}
   if(action==='close')onSourceAction('exit-boss');
   if(action==='reset')qa.__catQA?.('boss-reward');
   update();return {saveFailureFixture:qaBossRewardSaveFailure};
  }});
  Object.assign(window,{__catShopQA:()=>({diamonds:session.diamonds,shopFirstBuy:meta.shopFirstBuy,mine:session.mine,entitlements:meta.entitlements,claims:platform.claims,audit:platform.audit,challenge:{stage:session.challengeStage,runID:session.challengeRunID,settlement:session.challengeSettlement,claims:session.challengeRewardClaims},hunt:meta.hunt,petCoin:meta.petCoin,pending:pendingHuntResultReward??pendingMineResultReward??pendingChallengeReward??shopPurchaseClient.pending??diaPigPurchaseClient.pending??pendingMineSpeedReward??pendingBuffReward??activityPurchaseClient.pending?.request,mode:session.mode,buffClaims:meta.buffRewardClaims,notice:localNotice,pig:session.diaPig,buffTimes:meta.buffTimes}),__catShopRoundtrip:()=>{if(!qaFixtureActive)throw Error('QA only');cancelLiveHunt();session=deserializeSession(serializeSession(session));meta=decodeSourceMetaState(serializeSourceMetaState(meta));saveProgress();update();}});
  Object.assign(window,{__catRaidQA:()=>({isolated:qaFixtureActive,state:meta.raid,selection:raidSelection,candidates:sourceRaidCandidates(session),selectingSlot:raidSelectingSlot,notice:localNotice,localPanel,starSlot,starReturn,star:{context:starPanelState().context,base:starPanelState().damageBase?.format()??null},diamonds:session.diamonds,starGem:session.starGem,slotLevels:session.bossSlotLevels,diagnostics:sourcePanel?.diagnostics,onlineConnected:false}),__catRaidAdvance:(seconds:number)=>{if(!qaFixtureActive||!qaAdventureTime||!Number.isSafeInteger(seconds)||seconds<0)throw Error('Explicit isolated QA clock only');qaAdventureTime.date=new Date(qaAdventureTime.date.getTime()+seconds*1000);qaBadge.textContent+=` · Raid QA时钟+${seconds}s`;refreshRaidClock();update();}});
  Object.assign(window,{__catRelicQA:()=>({isolated:qaFixtureActive,relic:meta.relic,cores:meta.adventure.cores,coreShop:meta.coreShop,navigation:adventureNavigation,notice:localNotice,pending:pendingPrismReward?.id??null,clock:stepUpClock(),scroll:sourcePanel?.captureScroll(),diagnostics:sourcePanel?.diagnostics}),__catRelicRoundtrip:()=>{if(!qaFixtureActive)throw Error('Explicit isolated QA only');cancelLiveHunt();session=deserializeSession(serializeSession(session));meta=decodeSourceMetaState(serializeSourceMetaState(meta));platform=decodePlatformState(JSON.stringify(platform));prismStateOwner++;pendingPrismReward=null;qaBadge.textContent+=' · 内存codec往返（非普通存档恢复）';update();},__catRelicAdvance:(seconds:number)=>{if(!qaFixtureActive||!qaAdventureTime||!Number.isSafeInteger(seconds)||seconds<0)throw Error('Explicit QA clock only');qaAdventureTime.date=new Date(qaAdventureTime.date.getTime()+seconds*1000);qaBadge.textContent+=` · QA时钟+${seconds}s`;update();}});
  Object.assign(window,{__catAdGunQA:()=>({state:session.adGun,slot:sourceAdGunSlot(session),pending:pendingAdGunReward,clock:stepUpClock(),inventory:session.gunInventory,catalog:session.catalogSeen,diamonds:session.diamonds,serverLocal:meta.adTemporaryGunServer,notice:localNotice}),__catAdGunAdvance:(seconds:number)=>{if(!qaFixtureActive||!qaAdventureTime||!Number.isFinite(seconds)||seconds<0)throw Error('Explicit QA clock only');qaAdventureTime.date=new Date(qaAdventureTime.date.getTime()+seconds*1000);qaBadge.textContent+=` · 临时枪QA时钟+${seconds}s`;update();},__catAdGunRoundtrip:()=>{if(!qaFixtureActive)throw Error('QA only');cancelLiveHunt();session=sourceAdGunOnLoaded(deserializeSession(serializeSession(session)),stepUpClock());adGunTimer=0;saveProgress();update();}});
  Object.assign(window,{__catWeeklyQA:()=>({...weeklyPanelState(),week:session.weeklyShop,plus:session.plusPack,inventory:session.gunInventory,gunAuto:meta.gunAutoMerge,petAuto}),__catWeeklyAdvance:(seconds:number)=>{if(!qaFixtureActive||!Number.isFinite(seconds)||seconds<0||!qaAdventureTime)return;qaAdventureTime.date=new Date(qaAdventureTime.date.getTime()+seconds*1000);qaBadge.textContent+=` · 周/Plus夹具时钟+${seconds}s`;refreshWeekly();update();},__catWeeklyRoundtrip:()=>{if(!qaFixtureActive)return;cancelLiveHunt();session=deserializeSession(serializeSession(session));saveProgress();update();}});
  Object.assign(window,{__catDiaPigQA:()=>({...diaPigPanelState(),runtime:diaPigRuntime,clock:diaPigClock(),claims:platform.claims}),__catDiaPigAdvance:(seconds:number)=>{if(!qaFixtureActive||!Number.isSafeInteger(seconds)||seconds<0)throw Error('Explicit QA clock only');qaDiaPigOffset+=seconds;qaBadge.textContent+=` · 本地夹具时钟+${seconds}s`;refreshDiaPig();update();},__catWeaponQA:(id:number)=>{if(!Number.isInteger(id)||id<0||id>64)throw new RangeError("Source weapon ID");qa.__catQA!("three-cats");session.equippedGuns=[sourceGun(id),null,null];session.battle.autoMove=false;session.battle.targets=session.battle.targets.filter(t=>t.health>0).slice(0,1).map(t=>({...t,position:{x:session.battle.player.x+7/session.battle.worldUnitsPerPoint.x,y:session.battle.player.y+4/session.battle.worldUnitsPerPoint.y},health:1e12,maxHealth:1e12,healthValue:BigValue.fromInteger(1000000000000),maxHealthValue:BigValue.fromInteger(1000000000000)}));update();}});
  Object.assign(qa,{__catPassQA:()=>({popup:passPopup,pending:passClient.pending,saveFailed:passClient.saveFailed,date:passClock(),lifecycle:meta.passLifecycle,progress:sourcePassProgress({session,activities,platform,meta}),missions:{counters:{...activities.counters},normal:[...activities.missionClaims],vip:[...meta.vipMissionClaims],luxury:[...meta.luxuryMissionClaims]},petCoin:meta.petCoin,diamonds:session.diamonds,cores:[...meta.adventure.cores],inventory:session.gunInventory.map(g=>({id:g.id,uid:gunEntityUID(g)})),claims:[...platform.claims],audit:[...platform.audit],notice:localNotice,panelRoot:sourcePanel?.instanceId})});
  Object.assign(qa,{__catAutoAdQA:()=>({pending:autoAdClient.pending,adShowing:autoAdClient.adShowing,saveFailed:autoAdClient.saveFailed,day:autoAdDate(),auto:meta.autoUpgrade,platform,entitlements:meta.entitlements,localPanel,notice:localNotice,panelRoot:sourcePanel?.instanceId,gate:sourceAutoAdRequestGate({session,activities,platform,meta},autoAdDate()),levels:session.battle.upgradeLevels,wallet:walletValue(session.battle).toString(),diamonds:session.diamonds,purchasePending:shopPurchaseClient.pending,purchaseSaveFailed:shopPurchaseClient.saveFailed}),__catAutoAdFixture:(action:string,value?:string|boolean)=>{
   if(!qaFixtureActive)throw Error('Explicit isolated QA only');
   if(action==='purchase-save-failure')qaShopPurchaseSaveFailure=!!value;else if(action==='save-failure')qaAutoAdSaveFailure=!!value;else if(action==='date'){qaAutoAdDate=String(value);qaBadge.textContent+=` · 本地自动强化日期 ${qaAutoAdDate}`;}else if(action==='close')localPanel='none';else if(action==='open')localPanel='auto';else if(action==='retry')autoAdClient.retrySave();else if(action==='permanent')meta={...meta,entitlements:{...meta.entitlements,autoUpgradePack:!!value}};else if(action==='expire')meta={...meta,autoUpgrade:{...meta.autoUpgrade,adRemainingSec:0}};else if(action==='toggle')meta={...meta,autoUpgrade:{...meta.autoUpgrade,requested:!!value}};else if(action==='reload'){autoAdClient.invalidate();shopPurchaseClient.invalidate();weeklyStateOwner++;meta=decodeSourceMetaState(serializeSourceMetaState(meta));platform=decodePlatformState(JSON.stringify(platform));session=deserializeSession(serializeSession(session));}else if(action==='reset')qa.__catQA?.('auto-ad');update();return (qa as any).__catAutoAdQA();
  }});
  Object.assign(qa,{__catActivityPurchaseQA:()=>({pending:activityPurchaseClient.pending,saveFailed:activityPurchaseClient.saveFailed,saveFailureFixture:qaActivityPurchaseSaveFailure,nowUTC:stepUpClock(),diamonds:session.diamonds,petCoin:meta.petCoin,weekly:session.weeklyShop,plus:session.plusPack,stepup:session.stepUp,entitlements:meta.entitlements,inventory:session.gunInventory,platform,notice:localNotice,localPanel,panelRoot:sourcePanel?.instanceId}),__catActivityPurchaseFixture:(action:string,value?:string|boolean)=>{
   if(!qaFixtureActive)throw Error('Explicit isolated QA only');
   if(action==='save-failure'){qaActivityPurchaseSaveFailure=!!value;qaBadge.textContent+=` · 活动保存失败夹具 ${qaActivityPurchaseSaveFailure?'开':'关'}`;}
   else if(action==='close')localPanel='none';else if(action==='open')localPanel=value==='boss'?'boss':value==='hunt'?'monster':value==='stepup'?'stepup':'weekly';
   else if(action==='date'){const date=new Date(String(value));if(!Number.isFinite(date.getTime()))throw Error('Invalid QA date');qaAdventureTime={date,started:performance.now()};qaBadge.textContent+=` · 明示活动时钟 ${date.toISOString()}`;}
   else if(action==='reload'){activityPurchaseClient.invalidate();weeklyStateOwner++;session=deserializeSession(serializeSession(session));meta=decodeSourceMetaState(serializeSourceMetaState(meta));platform=decodePlatformState(JSON.stringify(platform));observedSession=session;}
   else if(action==='reset')qa.__catQA?.(value==='boss'?'boss-plus':value==='hunt'?'hunt-plus':value==='stepup'?'stepup':'weekly');
   update();return (qa as any).__catActivityPurchaseQA();
  }});
  Object.assign(qa,{__catShopPurchaseQA:()=>({pending:shopPurchaseClient.pending??diaPigPurchaseClient.pending,saveFailed:shopPurchaseClient.saveFailed||diaPigPurchaseClient.saveFailed,pig:session.diaPig,runtime:diaPigRuntime,diamonds:session.diamonds,entitlements:meta.entitlements,firstBuy:meta.shopFirstBuy,platform,notice:localNotice,localPanel,panelRoot:sourcePanel?.instanceId}),__catShopPurchaseFixture:(action:string,value?:string|boolean)=>{
   if(!qaFixtureActive)throw Error('Explicit isolated QA only');
   if(action==='save-failure')qaShopPurchaseSaveFailure=!!value;else if(action==='close')localPanel='none';else if(action==='open')localPanel='shop';else if(action==='reload'){shopPurchaseClient.invalidate();diaPigPurchaseClient.invalidate();weeklyStateOwner++;session=deserializeSession(serializeSession(session));meta=decodeSourceMetaState(serializeSourceMetaState(meta));platform=decodePlatformState(JSON.stringify(platform));}else if(action==='reset')qa.__catQA?.('shop');update();return (qa as any).__catShopPurchaseQA();
  }});
  Object.assign(qa,{__catGunDailyQA:()=>({pending:gunDailyClient.pending,saveFailed:gunDailyClient.saveFailed,day:gunDailyDate(),daily:meta.adDailyGun,inventory:session.gunInventory.map(g=>({id:g.id,uid:gunEntityUID(g)})),gunDraws:session.gunDraws,rngState:session.rngState,catalog:session.catalogSeen,platform,entitlements:meta.entitlements,notice:localNotice,gate:sourceGunDailyRequestGate({session,activities,platform,meta},gunDailyDate()),panelRoot:sourcePanel?.instanceId,newGun:!!newGunPopup}),__catGunDailyFixture:(action:string,value?:string|boolean)=>{
   if(!qaFixtureActive)throw Error('Explicit isolated QA only');
   if(action==='save-failure')qaGunDailySaveFailure=!!value;else if(action==='date'){qaGunDailyDate=String(value);qaBadge.textContent+=` · 本地每日枪日期 ${qaGunDailyDate}`;}else if(action==='full')session={...session,gunInventory:Array.from({length:16},(_,i)=>({...sourceGun(i),uid:`qa-daily-full-${i}`}))};else if(action==='close')session=closeOverlay(session);else if(action==='retry')gunDailyClient.retrySave();else if(action==='reload'){gunDailyClient.invalidate();weeklyStateOwner++;const next=deserializeSession(serializeSession(session));meta=decodeSourceMetaState(serializeSourceMetaState(meta));platform=decodePlatformState(JSON.stringify(platform));session=next;}else if(action==='reset')qa.__catQA?.('gun-daily');update();return (qa as any).__catGunDailyQA();
  }});
  Object.assign(qa,{__catOfferWallQA:()=>({input:{pointerId,origin,move:{...move},pressed:[...pressed],policy:currentRuntimePolicy()},open:offerWallClient.open,connected:offerWallClient.connected,contentReady:offerWallClient.contentReady,pending:offerWallClient.pending,claiming:offerWallClient.claiming,saveFailed:offerWallClient.saveFailed,notice:offerWallNotice,state:meta.offerWall,diamonds:session.diamonds,exposure:offerWallProjection(),panelRoot:sourcePanel?.instanceId}),__catOfferWallFixture:(action:string,value?:boolean|'reservation'|'wallet')=>{
   if(!qaFixtureActive)throw Error('Explicit isolated QA only');if(action==='save-failure')qaOfferWallSaveFailure=value??false;else if(action==='reload'){offerWallClient.reset();meta=decodeSourceMetaState(serializeSourceMetaState(meta));}update();
  }});
  Object.assign(qa,{__catFreeCashQA:()=>({input:{pointerId,origin,move:{...move},pressed:[...pressed],policy:currentRuntimePolicy(),blocker:freeCashLayer.eventMode},open:freeCashClient.open,sdkStatus:freeCashClient.sdkStatus,pending:freeCashClient.pending,saveFailed:freeCashClient.saveFailed,notice:freeCashNotice,state:meta.freeCash,entitlements:meta.entitlements,exposure:freeCashBannerProjection(),localPanel,overlay:session.overlay,diamonds:session.diamonds,petCoin:meta.petCoin}),__catFreeCashFixture:(action:string,value?:boolean)=>{if(!qaFixtureActive)throw Error('Explicit isolated QA only');if(action==='save-failure')qaFreeCashSaveFailure=!!value;else if(action==='reload'){freeCashClient.reset();meta=decodeSourceMetaState(serializeSourceMetaState(meta));freeCashProvider=null;}else if(action==='reset'){freeCashClient.reset();freeCashProvider=null;offerWallClient.reset();}update();}});
  Object.assign(qa,{__catPassFixture:(action:string,value?:string|boolean)=>{if(!qaFixtureActive)throw Error('Explicit isolated QA only');if(action==='daily-missions'){
      // Visible isolated fixture derived from the actual source mission contract.
      const normal=ACTIVITY_MISSIONS.find(m=>!m.requiresVip)!,vip=ACTIVITY_MISSIONS.find(m=>m.requiresVip)!;
      for(const m of [normal,vip])activities.counters[m.counter as ActivityCounter]=Math.max(activities.counters[m.counter as ActivityCounter],m.goal);
      activities.missionClaims=[normal.id];meta.vipMissionClaims=[vip.id];meta.luxuryMissionClaims=[normal.id];meta.vip=meta.luxury=true;
      activities.passClaims=[0];meta.epicClaims=[0];qaBadge.textContent+=' · 已领取日任务夹具';
    }else if(action==='date'){qaPassDate=String(value);passClient.refresh();}else if(action==='save-failure')qaPassSaveFailure=!!value;else if(action==='reload'){passClient.invalidate();const envelope={session:serializeSession(session),activities:serializeActivityState(activities),meta:serializeSourceMetaState(meta),platform:JSON.stringify(platform)};session=deserializeSession(envelope.session);activities=decodeActivityState(envelope.activities);meta=decodeSourceMetaState(envelope.meta);platform=decodePlatformState(envelope.platform);observedSession=session;}update();return (qa as any).__catPassQA();}});
  if(qaRoute.scenario)qa.__catQA(qaRoute.scenario);
  if(qaRoute.error){
    qaBadge.textContent=qaRoute.error;qaBadge.style.display='block';localNotice=qaRoute.error;
    const error=document.createElement('section');error.id='cat-qa-route-error';
    Object.assign(error.style,{position:'fixed',inset:'0',zIndex:'110',background:'#191919',color:'#fff4ca',padding:'32px',font:'18px system-ui'});
    const title=document.createElement('p');title.textContent=qaRoute.error;error.appendChild(title);
    const link=document.createElement('a');link.href='/qa.html';link.textContent='返回全功能测试选择页';link.style.color='#fff4ca';error.appendChild(link);document.body.appendChild(error);
  }
  (window as Window & {__catRigDebug?:()=>unknown}).__catRigDebug=()=>catRigs.map(rig=>rig.debugPose());
  qa.__catPresentation=()=>({transition:{active:transition.active,elapsed:transition.elapsed,alpha:transition.alpha,kind:transition.kind},settingsOpen,localPanel,qaFixtureActive,pagesPurchasePreview,purchaseSimulationEnabled:purchaseSimulationEnabled(),platformUI:{pending:platformPending,confirmation:platformConfirmation?.action,signedIn:selectedPlatformProvider().isSignedIn(),notice:localNotice},newGunPopup:!!newGunPopup,activities:{dailyClaims:activities.dailyClaims,lastDailyDate:activities.lastDailyDate,counters:activities.counters,passExp:activities.passExp,passLevel:passView(activities).level,passClaims:activities.passClaims},platform:{developerEnabled:platform.developerEnabled,freeAds:platform.freeAds,freePurchases:platform.freePurchases,sequence:platform.sequence,audit:platform.audit},preferences,feedback:feedback.diagnostics,shots:recentShotChecks,projectiles:[...projectileViews.values()].map(view=>view.presentation),muzzles:muzzleViews.map(item=>item.view.presentation),ecoMode,meta:{...meta,adventure:encodeSourceAdventureState(meta.adventure)},adventure:{navigation:adventureNavigation,clock:{...adventureClock(),nowTicks:adventureClock().nowTicks.toString()},pending:pendingAdventureReward?.id??null,diagnostics:sourcePanel?.diagnostics},feedbackCount:fleeting.filter(item=>!item.adapterView).length,impacts:fleeting.filter(item=>item.adapterView).map(item=>item.adapterView!.presentation),cards:cards.map(c=>({kind:c.kind,status:c.status.text,
    percent:c.percent.text,price:c.cost.text,fillHeight:100*c.fillFraction,fillFraction:c.fillFraction,fillMode:"source-sliced-sprite-bottom-to-top"})),rigs:catRigs.map(r=>r.debugPose())});
}
