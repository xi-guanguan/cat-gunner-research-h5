/** Gun_Item values from serialized pool component 127434 and native coroutines.
 * PressBounceBackDuration remains recorded configuration; the recovered release
 * coroutine instead uses three hard-coded stages (0.19s total). */
export const SOURCE_GUN_PRESS = Object.freeze({scale:Math.fround(.9),pressSeconds:Math.fround(.08),releaseSeconds:Math.fround(.15)});
export interface SourcePressParameters {scale:number;pressSeconds:number;releaseSeconds:number}
export interface SourceScaleTarget {scale:{x:number;y:number;set(x:number,y?:number):unknown}}
export interface SourceScaleStage {scale:number;seconds:number}
const stage=(scale:number,seconds:number):Readonly<SourceScaleStage>=>Object.freeze({scale:Math.fround(scale),seconds:Math.fround(seconds)});
export const SOURCE_GUN_RELEASE_STAGES=Object.freeze([stage(1.05,.08),stage(.98,.06),stage(1,.05)]);
export const SOURCE_GUN_SPAWN_STAGES=Object.freeze([stage(1.1,.15),stage(.95,.08),stage(1.02,.06),stage(1,.05)]);
export const SOURCE_GUN_RELEASE_SECONDS=SOURCE_GUN_RELEASE_STAGES.reduce((sum,s)=>sum+s.seconds,0);
export const SOURCE_GUN_SPAWN_SECONDS=SOURCE_GUN_SPAWN_STAGES.reduce((sum,s)=>sum+s.seconds,0);
/** Recovered from PressScaleAnim / PressBounceBack / ScaleTo / SpawnBounceCoroutine:
 * clamp elapsed/duration, then 3t²−2t³, then Vector3.Lerp. */
export function sourceSmoothStep(t:number){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
export class SourceMotion {
  private elapsed=0;
  private duration=0;
  private start=1;
  private end=1;
  private factor=1;
  private stages:Readonly<SourceScaleStage>[]=[];
  private completed:(()=>void)|undefined;
  private running=false;
  constructor(private target:SourceScaleTarget,private baseX=target.scale.x,private baseY=target.scale.y){}
  get value(){return this.factor;}
  get active(){return this.running;}
  private write(){this.target.scale.set(this.baseX*this.factor,this.baseY*this.factor);}
  private next(){const stage=this.stages.shift();if(!stage){this.running=false;const done=this.completed;this.completed=undefined;done?.();return false;}this.start=this.factor;this.end=stage.scale;this.elapsed=0;this.duration=Math.max(0,stage.seconds);return true;}
  private sequence(stages:readonly Readonly<SourceScaleStage>[],onComplete?:()=>void){this.stages=[...stages];this.completed=onComplete;this.running=true;this.next();this.update(0);}
  to(scale:number,seconds:number,onComplete?:()=>void){this.sequence([{scale,seconds}],onComplete);}
  press(parameters:SourcePressParameters=SOURCE_GUN_PRESS){this.to(parameters.scale,parameters.pressSeconds);}
  /** Native PressBounceBack ignores the serialized releaseSeconds field. */
  release(_parameters:SourcePressParameters=SOURCE_GUN_PRESS,onComplete?:()=>void){this.sequence(SOURCE_GUN_RELEASE_STAGES,onComplete);}
  /** Native spawn first sets zero scale, then skips array index zero (zero pair). */
  spawn(onComplete?:()=>void){this.factor=0;this.write();this.sequence(SOURCE_GUN_SPAWN_STAGES,onComplete);}
  update(dt:number){
    let remaining=Math.max(0,Number.isFinite(dt)?dt:0);
    while(this.running){
      const step=Math.min(remaining,Math.max(0,this.duration-this.elapsed));this.elapsed+=step;remaining-=step;
      const t=this.duration?this.elapsed/this.duration:1;
      this.factor=this.start+(this.end-this.start)*sourceSmoothStep(t);this.write();
      if(t<1)return;
      // Write exact endpoint and carry ticker remainder across recovered stages.
      this.factor=this.end;this.write();if(!this.next()||remaining<=0&&this.duration>0)return;
    }
  }
  reset(){this.stages=[];this.completed=undefined;this.running=false;this.elapsed=this.duration=0;this.factor=this.start=this.end=1;this.write();}
}

/** Serialized BounceBtn instances inside Gun_UI. Evidence:
 * interaction-bounce-serialized.json; each record consumed all 52 bytes.
 * Purchase_Btn is affordability/price colour logic, not an animation clip. */
export const SOURCE_GUN_PANEL_BOUNCE:Readonly<Record<number,number>>=Object.freeze({123143:Math.fround(.9),123932:Math.fround(.9),124677:Math.fround(.9),124748:Math.fround(.9),125154:Math.fround(.95),125382:Math.fround(.9),125419:Math.fround(.9),125716:Math.fround(.9),135250:Math.fround(.9),140958:Math.fround(.9),141569:Math.fround(.9),141570:Math.fround(.9)});
export const SOURCE_BOUNCE_SECONDS=Math.fround(.1);
/** BounceBtn <Btn_Down_Coroutine>d__14.MoveNext, 0x2a9b4cc.
 * Both transitions use the serialized UpTime and clamped linear interpolation
 * between cached base size and WantSize. A fresh press resets both timers. */
export class SourceBounceMotion {
  private downElapsed=0;private upElapsed=0;private active=false;
  pressed=false;
  constructor(private target:SourceScaleTarget,private wantSize:number,private seconds=SOURCE_BOUNCE_SECONDS,private baseX=target.scale.x,private baseY=target.scale.y){}
  pointerDown(){if(this.pressed)return;this.downElapsed=this.upElapsed=0;this.pressed=true;this.active=true;}
  pointerUp(){this.pressed=false;}
  update(dt:number){if(!this.active)return;const seconds=Math.max(0,Number.isFinite(dt)?dt:0);let factor:number;
    if(this.pressed){this.downElapsed=Math.fround(this.downElapsed+seconds);const t=Math.min(1,this.downElapsed/this.seconds);factor=1+(this.wantSize-1)*t;}
    else{this.upElapsed=Math.fround(this.upElapsed+seconds);const t=Math.min(1,this.upElapsed/this.seconds);factor=this.wantSize+(1-this.wantSize)*t;if(t===1)this.active=false;}
    this.target.scale.set(this.baseX*factor,this.baseY*factor);
  }
  reset(){this.active=this.pressed=false;this.downElapsed=this.upElapsed=0;this.target.scale.set(this.baseX,this.baseY);}
}

/** Open clip sharedassets0.assets:273 / NewGun controller:306, 2s non-looping.
 * Full streamed cubic coefficients recovered from all 1212 bytes / 9 curves.
 * The Pet_Item binding exists only in NewPet_UI. Gun_UI has no Animator;
 * these absolute local-scale curves must only target the separate item popups. */
export type SourceOpenPath='Panel'|'Panel/Glow'|'Panel/Pet_Item';
type SourceCubicKey=readonly [time:number,a:number,b:number,c:number,d:number];
const SOURCE_OPEN_CURVES:Readonly<Record<SourceOpenPath,readonly (readonly SourceCubicKey[])[]>>={"Panel":[[[0.0,-59.400001525878906,29.700000762939453,0.0,0.0],[0.3333333432674408,51.84001922607422,-12.960002899169922,0.0,1.100000023841858],[0.5,-8.63999080657959,2.1599977016448975,0.0,0.9800000190734863],[0.6666666865348816,0.0,0.0,0.0,1.0],[1.3333333730697632,0.0,0.0,0.0,1.0]],[[0.0,-59.400001525878906,29.700000762939453,0.0,0.0],[0.3333333432674408,51.84001922607422,-12.960002899169922,0.0,1.100000023841858],[0.5,-8.63999080657959,2.1599977016448975,0.0,0.9800000190734863],[0.6666666865348816,0.0,0.0,0.0,1.0],[1.3333333730697632,0.0,0.0,0.0,1.0]],[[0.0,-59.400001525878906,29.700000762939453,0.0,0.0],[0.3333333432674408,51.84001922607422,-12.960002899169922,0.0,1.100000023841858],[0.5,-8.63999080657959,2.1599977016448975,0.0,0.9800000190734863],[0.6666666865348816,0.0,0.0,0.0,1.0],[1.3333333730697632,0.0,0.0,0.0,1.0]]],"Panel/Glow":[[[0.0,-1.6000003814697266,1.200000286102295,0.0,1.0],[0.5,43.20000076293945,-10.80000114440918,0.0,1.100000023841858],[0.6666666865348816,0.0,0.0,0.0,1.0],[1.3333333730697632,-5.400005340576172,2.7000021934509277,0.0,1.0],[1.6666666269302368,59.399993896484375,-29.69999885559082,0.0,1.100000023841858],[2.0,0.0,0.0,0.0,0.0]],[[0.0,-1.6000003814697266,1.200000286102295,0.0,1.0],[0.5,43.20000076293945,-10.80000114440918,0.0,1.100000023841858],[0.6666666865348816,0.0,0.0,0.0,1.0],[1.3333333730697632,-5.400005340576172,2.7000021934509277,0.0,1.0],[1.6666666269302368,59.399993896484375,-29.69999885559082,0.0,1.100000023841858],[2.0,0.0,0.0,0.0,0.0]],[[0.0,0.0,0.0,0.0,1.0],[0.5,0.0,0.0,0.0,1.0],[0.6666666865348816,0.0,0.0,0.0,1.0],[1.3333333730697632,0.0,0.0,0.0,1.0],[1.6666666269302368,0.0,0.0,0.0,1.0],[2.0,0.0,0.0,0.0,1.0]]],"Panel/Pet_Item":[[[0.0,0.0,0.0,0.0,1.2000000476837158],[0.6666666865348816,0.0,0.0,0.0,1.2000000476837158],[1.3333333730697632,-5.399999141693115,2.6999988555908203,0.0,1.2000000476837158],[1.6666666269302368,70.19998168945312,-35.09999465942383,0.0,1.2999999523162842],[2.0,0.0,0.0,0.0,0.0]],[[0.0,0.0,0.0,0.0,1.2000000476837158],[0.6666666865348816,0.0,0.0,0.0,1.2000000476837158],[1.3333333730697632,-5.399999141693115,2.6999988555908203,0.0,1.2000000476837158],[1.6666666269302368,70.19998168945312,-35.09999465942383,0.0,1.2999999523162842],[2.0,0.0,0.0,0.0,0.0]],[[0.0,0.0,0.0,0.0,1.0],[0.6666666865348816,0.0,0.0,0.0,1.0],[1.3333333730697632,0.0,0.0,0.0,1.0],[1.6666666269302368,0.0,0.0,0.0,1.0],[2.0,0.0,0.0,0.0,1.0]]]};
export const SOURCE_NEW_ITEM_OPEN_SECONDS=2;
function sampleCubic(keys:readonly SourceCubicKey[],seconds:number){
  let key=keys[0];for(const candidate of keys){if(candidate[0]>seconds)break;key=candidate;}
  const dt=Math.max(0,seconds-key[0]);return ((key[1]*dt+key[2])*dt+key[3])*dt+key[4];
}
export function sourceOpenScale(path:SourceOpenPath,seconds:number):[number,number,number]{
  const t=Math.min(SOURCE_NEW_ITEM_OPEN_SECONDS,Math.max(0,Number.isFinite(seconds)?seconds:0));
  return SOURCE_OPEN_CURVES[path].map(keys=>sampleCubic(keys,t)) as [number,number,number];
}
/** Opt-in popup motion; never attached to the inventory panel. Pixi consumes XY. */
export class SourceNewItemOpenMotion {
  private elapsed=0;private running=false;private completed:(()=>void)|undefined;
  constructor(private targets:Partial<Record<SourceOpenPath,SourceScaleTarget>>){}
  get active(){return this.running;}
  get time(){return this.elapsed;}
  private write(){for(const [path,target]of Object.entries(this.targets)){const [x,y]=sourceOpenScale(path as SourceOpenPath,this.elapsed);target.scale.set(x,y);}}
  play(onComplete?:()=>void){this.elapsed=0;this.running=true;this.completed=onComplete;this.write();}
  update(dt:number){if(!this.running)return;this.elapsed=Math.min(SOURCE_NEW_ITEM_OPEN_SECONDS,this.elapsed+Math.max(0,Number.isFinite(dt)?dt:0));this.write();if(this.elapsed===SOURCE_NEW_ITEM_OPEN_SECONDS){this.running=false;const done=this.completed;this.completed=undefined;done?.();}}
  stop(){this.running=false;this.completed=undefined;}
}
