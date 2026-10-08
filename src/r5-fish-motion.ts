/** Fish_Item/Fish_Tank native consumers. Coordinates are tank-centered, Unity y-up.
 * Evidence: artifacts/evidence/round5-20261001/meta-fish-tank-config.json.
 * Random provider is explicit; the local adapter does not claim Unity PRNG parity. */
export interface SourceFishPoint {x:number;y:number}
export interface SourceFishTankSize {width:number;height:number}
export interface SourceFishRectSize extends SourceFishTankSize {scaleX:number;scaleY:number}
export interface SourceFishMotionRandom {value():number;range(min:number,max:number):number}
export interface SourceFishMotion {position:SourceFishPoint;direction:SourceFishPoint;speed:number;directionTimer:number;active:boolean;dragging:boolean;autoMerging:boolean}
export const SOURCE_FISH_TANK_SIZE:SourceFishTankSize={width:988,height:1133};
export const SOURCE_FISH_REAL_SPRITE_KEYS:readonly string[]=[813,866,585,470,631,419,581,525,744,747,469,788,682].map(id=>`sharedassets0.assets:${id}`);
export const SOURCE_FISH_OUTLINE_SPRITE_KEYS:readonly string[]=[455,431,792,507,757,626,724,836,437,547,407,607,799].map(id=>`sharedassets0.assets:${id}`);
export const SOURCE_FISH_REAL_SIZES:readonly SourceFishTankSize[]=[{width:115,height:96},{width:140,height:119},{width:165,height:139},{width:190,height:161},{width:215,height:210},{width:240,height:171},{width:265,height:230},...Array.from({length:6},()=>({width:290,height:203}))];
export const SOURCE_FISH_SPAWN_MIN_DISTANCE=100;
export const SOURCE_FISH_SPAWN_MAX_ATTEMPTS=30;
export const SOURCE_FISH_AUTO_MERGE_MOVE_SECONDS=Math.fround(.4);
export const SOURCE_FISH_AUTO_MERGE_DISTANCE=20;
export const SOURCE_FISH_AUTO_MERGE_PAIR_SECONDS=Math.fround(.15);
const f=Math.fround;
function unit(v:number):number {if(!Number.isFinite(v)||v<0||v>1)throw new RangeError('Invalid fish motion random value');return f(v);}
/** Linear H5 range adapter; pass a native-compatible provider separately if available. */
export function sourceFishMotionRandom(random01:()=>number):SourceFishMotionRandom {return {value:()=>unit(random01()),range:(min,max)=>f(min+f(f(max-min)*unit(random01()))) };}
function dimensions(tank:SourceFishTankSize,item:SourceFishRectSize):void {if(![tank.width,tank.height,item.width,item.height,item.scaleX,item.scaleY].every(Number.isFinite)||tank.width<0||tank.height<0||item.width<0||item.height<0||item.scaleX<0||item.scaleY<0)throw new RangeError('Invalid fish motion dimensions');}
function bounds(tank:SourceFishTankSize,item:SourceFishRectSize,clampUsesScaleX:boolean):SourceFishPoint {dimensions(tank,item);return {x:Math.max(0,f(f(tank.width*.5)-f(f(item.width*item.scaleX)*.5))),y:Math.max(0,f(f(tank.height*.5)-f(f(item.height*(clampUsesScaleX?item.scaleX:item.scaleY))*.5)))};}
/** ClampToTank uses outer localScale.x for BOTH dimensions; GetScaledSize uses x/y independently. */
export function sourceClampFishToTank(position:SourceFishPoint,tank:SourceFishTankSize,item:SourceFishRectSize):SourceFishPoint {const b=bounds(tank,item,true);return {x:f(Math.max(-b.x,Math.min(b.x,position.x))),y:f(Math.max(-b.y,Math.min(b.y,position.y)))};}
function pickDirection(random:SourceFishMotionRandom):SourceFishPoint {const x=random.value()>.5?1:-1,y=f(random.range(f(-.3),f(.3))),length=f(Math.sqrt(f(1+f(y*y))));return {x:f(x/length),y:f(y/length)};}
/** Reload calls this BEFORE FindEmptyPosition: speed, direction sign, y tilt, interval. */
export function sourceInitFishMotion(random:SourceFishMotionRandom,position:SourceFishPoint={x:0,y:0}):SourceFishMotion {const speed=f(random.range(15,35)),direction=pickDirection(random),directionTimer=f(random.range(2,5));return {position:{...position},direction,speed,directionTimer,active:true,dragging:false,autoMerging:false};}
/** Pass active OTHER fish only. Initial fallback consumes x/y but is not scored; best trial wins on strict greater distance. */
export function sourceFindFishSpawnPosition(tank:SourceFishTankSize,item:SourceFishRectSize,otherActivePositions:readonly SourceFishPoint[],random:SourceFishMotionRandom,minDistance=SOURCE_FISH_SPAWN_MIN_DISTANCE,maxAttempts=SOURCE_FISH_SPAWN_MAX_ATTEMPTS):SourceFishPoint {
 const b=bounds(tank,item,false);if(!Number.isFinite(minDistance)||!Number.isSafeInteger(maxAttempts)||maxAttempts<0)throw new RangeError('Invalid fish spawn config');
 const candidate=()=>({x:f(random.range(-b.x,b.x)),y:f(random.range(-b.y,b.y))});let chosen=candidate(),best=-1;
 for(let i=0;i<maxAttempts;i++){const p=candidate();let nearest=3.4028234663852886e38;for(const q of otherActivePositions){const dx=f(p.x-q.x),dy=f(p.y-q.y),distance=f(Math.sqrt(f(f(dx*dx)+f(dy*dy))));nearest=Math.min(nearest,distance);}if(nearest>=minDistance)return p;if(nearest>best){chosen=p;best=nearest;}}
 return chosen;
}
/** Native Update has active/drag/automerge gates, no separate pending-delete gate, no delta cap. */
export function sourceTickFishMotion(s:SourceFishMotion,deltaSec:number,tank:SourceFishTankSize,item:SourceFishRectSize,random:SourceFishMotionRandom):SourceFishMotion {
 if(!Number.isFinite(deltaSec)||deltaSec<0)throw new RangeError('Invalid fish swim delta');if(!s.active||s.dragging||s.autoMerging)return s;
 const dt=f(deltaSec),unclamped={x:f(s.position.x+f(f(s.direction.x*s.speed)*dt)),y:f(s.position.y+f(f(s.direction.y*s.speed)*dt))},position=sourceClampFishToTank(unclamped,tank,item);
 let direction={...s.direction};if(f(Math.abs(position.x-unclamped.x))>f(.1))direction.x=-direction.x;if(f(Math.abs(position.y-unclamped.y))>f(.1))direction.y=-direction.y;
 let directionTimer=f(s.directionTimer-dt),speed=s.speed;if(directionTimer<=0){direction=pickDirection(random);directionTimer=f(random.range(2,5));speed=f(random.range(15,35));}
 return {...s,position,direction,directionTimer,speed};
}
/** UpdateFlip rotates the skin by y=0 or180, leaving the outer rect scale positive. */
export function sourceFishFacesRight(s:SourceFishMotion):boolean {return s.direction.x>0;}
