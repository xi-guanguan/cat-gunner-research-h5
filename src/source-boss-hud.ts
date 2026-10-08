/** Original /Canvas/SafeArea/Boss_UI live HUD; host owns the exit transaction. */
import type {Texture} from 'pixi.js';
import type {Session} from './session';
import {BigValue} from './big-value';
import {healthValue,walletValue} from './rules';
import {createSourceUiView,type SourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import hudTree from './data/source-boss-hud.json';
export const sourceBossHudTree=hudTree as unknown as SourceUiTree;
export const SOURCE_BOSS_HUD_ROOT='/Canvas/SafeArea/Boss_UI';
export const sourceBossHudAssetURLs=[...new Set(sourceBossHudTree.nodes.flatMap(n=>n.components.map(c=>c.data?.textureURL??sourceBossHudTree.sprites[c.data?.spriteKey]?.url).filter((v):v is string=>!!v)))];
export interface SourceBossHudOptions {textures:Record<string,Texture>;viewport:SourceUiViewport;session:Session;action:(name:'exit-boss')=>void;/** Prefer sourceBossTimeMax(entitlements). Otherwise inferred from the current run and elapsed clock. */timeMax?:number}
export interface SourceBossHudProjection {active:Record<string,boolean>;text:Record<string,string>;fills:Record<string,number>;remainingSec:number;timeFraction:number;healthFraction:number;exitPath:string;limitations:string[]}
const path=(suffix:string)=>SOURCE_BOSS_HUD_ROOT+suffix;
const byId=new Map(sourceBossHudTree.nodes.map(n=>[n.id,n]));
/** Canvas Text is not the source TMP SDF shader. Retain the material's brown
 * outline, with a temporary three-Canvas-unit stroke floor for the small timer.
 * This is an explicit readability adapter, not a recovered native SDF metric. */
function keepTimerReadable(view:SourceUiView):void {
 const timer=view.getText(path('/Time_Slider/Time_txt'));
 if(timer)timer.style.strokeThickness=Math.max(timer.style.strokeThickness,3);
}
/** BigValue HP stays authoritative; fractions are bounded, explicitly lossy display values. */
export function sourceBossHudProjection(session:Session,timeMax?:number):SourceBossHudProjection|null {
 const run=session.boss.run;
 if(session.mode!=='boss'||run?.phase!=='playing')return null;
 const target=session.battle.targets[0];if(!target)throw new Error('Boss HUD requires the live boss target');
 const hp=healthValue(target),max=target.maxHealthValue??BigValue.from(target.maxHealth),remainingSec=Math.max(0,run.remainingSec);
 const duration=timeMax??Math.max(1,Math.round(run.remainingSec+session.battle.elapsed));
 if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(remainingSec))throw new Error('Invalid Boss HUD clock');
 const timeFraction=Math.min(1,Math.max(0,remainingSec/duration)),healthFraction=hp.fractionOf(max);
 const active:Record<string,boolean>={};let n=sourceBossHudTree.nodes.find(n=>n.path===SOURCE_BOSS_HUD_ROOT);
 if(!n)throw new Error('Original Boss HUD root missing');
 for(;n;n=n.parent?byId.get(n.parent):undefined)active[n.id]=true;
 return {active,text:{[path('/Time_Slider/Time_txt')]:`${Math.ceil(remainingSec)}s`,[path('/HP_Slider/HP_txt')]:hp.max(0).format(),[path('/Currency/Dia/Price_txt')]:String(session.diamonds),[path('/Currency/Money/Price_txt')]:walletValue(session.battle).format(),[path('/Exit_Btn/I2_txt(Outline)')]:'退出'},fills:{[path('/Time_Slider/Fill')]:timeFraction,[path('/HP_Slider/Fill')]:healthFraction},remainingSec,timeFraction,healthFraction,exitPath:path('/Exit_Btn'),limitations:['Source Boss_Slider component123248 and Exit Button123463 retain original layout; this adapter uses live session clock/target HP.','Time label rounds remaining seconds upward for H5 display; native TMP rounding parity is not established.','Source mask data retained; renderer rectangle clipping does not reproduce alpha silhouettes/softness.']};
}
export function updateSourceBossHud(view:SourceUiView,session:Session,timeMax?:number):boolean {
 const projection=sourceBossHudProjection(session,timeMax);if(!projection)return false;
 for(const [path,value]of Object.entries(projection.text))view.setText(path,value);
 for(const [path,value]of Object.entries(projection.fills))view.setFill(path,value);
 keepTimerReadable(view);
 return true;
}
export function createSourceBossHud(options:SourceBossHudOptions):SourceUiView|null {
 const projection=sourceBossHudProjection(options.session,options.timeMax);if(!projection)return null;
 const view=createSourceUiView({tree:sourceBossHudTree,textures:options.textures,viewport:options.viewport,roots:[SOURCE_BOSS_HUD_ROOT],active:projection.active,text:projection.text});
 for(const [path,value]of Object.entries(projection.fills))view.setFill(path,value);
 view.bindAction(projection.exitPath,event=>{event.stopPropagation();options.action('exit-boss');});view.diagnostics.push(...projection.limitations,'Timer outline uses a three-Canvas-unit readability floor until source TMP SDF/glyph metrics are recovered.');keepTimerReadable(view);return view;
}
