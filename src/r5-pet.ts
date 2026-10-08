/** Pet_manager / Pet_Item_List / Pet_Slot source transactions.
 * Evidence: artifacts/evidence/round5-20261001/pet-hunt-source-contract.md.
 * Keep the fixed inventory holes and carry dispatch lock groups with each pet. */
import {BigValue} from './big-value';
export const SOURCE_PET_GRADE_COUNT=10;
export const SOURCE_PET_OWNED_SLOTS=16;
export const SOURCE_PET_SELECTED_SLOTS=3;
export const SOURCE_PET_UNLOCK_DISPLAY_STAGE=12;
export const SOURCE_PET_DRAW_COST=100;
export const SOURCE_PET_DAILY_AD_GRADE=1;
export const SOURCE_PET_SPRITE_IDS=[795,742,869,889,692,640,710,665,731,680,454,887,886] as const;
export interface SourcePetState {owned:number[];selected:number[];ownedLocks:number[];selectedLocks:number[];collect:boolean[];dailyLastDate:string;ownedIDs:(string|null)[];selectedIDs:(string|null)[];nextID:number}
export interface SourcePetWallet {petCoin:number;diamonds:number}
export type SourcePetResult={status:'supported';value:SourcePetState;petCoinDelta:number;diamondDelta:number;newGrade?:number;newCollection?:boolean;slot?:number}|{status:'blocked';reason:string};
const empty=(count:number):number[]=>Array(count).fill(-1);
export const freshSourcePetState=():SourcePetState=>({owned:empty(16),selected:empty(3),ownedLocks:empty(16),selectedLocks:empty(3),collect:Array(10).fill(false),dailyLastDate:'',ownedIDs:Array(16).fill(null),selectedIDs:Array(3).fill(null),nextID:1});
function boundedSlot(slot:number,count:number):boolean{return Number.isInteger(slot)&&slot>=0&&slot<count;}
function gradeValid(n:unknown):n is number{return typeof n==='number'&&Number.isInteger(n)&&n>=-1&&n<10;}
function clone(s:SourcePetState):SourcePetState{s=sourcePetWithIdentities(s);return {...s,owned:[...s.owned],selected:[...s.selected],ownedLocks:[...s.ownedLocks],selectedLocks:[...s.selectedLocks],collect:[...s.collect],ownedIDs:[...s.ownedIDs],selectedIDs:[...s.selectedIDs]};}
function ok(value:SourcePetState,extras:Partial<Extract<SourcePetResult,{status:'supported'}>>={}):SourcePetResult{return {status:'supported',value,petCoinDelta:0,diamondDelta:0,...extras};}
const blocked=(reason:string):SourcePetResult=>({status:'blocked',reason});
/** SaveData carries fixed arrays, history and date. Auto toggle/degree are not persisted in source. */
/** Stable IDs are an explicit H5 adapter, not source SaveData fields. No pet/resource grant. */
export function sourcePetWithIdentities(s:SourcePetState):SourcePetState {
 const ownedIDs=[...(s.ownedIDs??Array(16).fill(null))],selectedIDs=[...(s.selectedIDs??Array(3).fill(null))];
 let nextID=s.nextID??1;const seen=new Set<string>();
 if(!Number.isSafeInteger(nextID)||nextID<1)throw new TypeError('Invalid pet identity sequence');
 for(const [items,ids] of [[s.owned,ownedIDs],[s.selected,selectedIDs]] as const){
  if(ids.length!==items.length)throw new TypeError('Invalid pet identity array');
  for(let i=0;i<items.length;i++){
   const id=ids[i];if(items[i]===-1){ids[i]=null;continue;}
   if(id!==null){if(typeof id!=='string'||!/^pet:[1-9]\d*$/.test(id)||seen.has(id))throw new TypeError('Invalid pet identity');seen.add(id);const n=Number(id.slice(4));if(!Number.isSafeInteger(n))throw new TypeError('Invalid pet identity');nextID=Math.max(nextID,n+1);}
  }
 }
 for(const [items,ids] of [[s.owned,ownedIDs],[s.selected,selectedIDs]] as const)for(let i=0;i<items.length;i++)if(items[i]>=0&&ids[i]===null){if(!Number.isSafeInteger(nextID+1))throw new RangeError('Pet identity overflow');ids[i]=`pet:${nextID++}`;}
 if(!Number.isSafeInteger(nextID))throw new RangeError('Pet identity overflow');
 if(nextID===s.nextID&&JSON.stringify(ownedIDs)===JSON.stringify(s.ownedIDs)&&JSON.stringify(selectedIDs)===JSON.stringify(s.selectedIDs))return s;
 return {...s,ownedIDs,selectedIDs,nextID};
}
export function serializeSourcePetState(s:SourcePetState):string{s=sourcePetWithIdentities(s);return JSON.stringify({Pet_Selected_items:s.selected,Pet_Collect:s.collect,Owned_Pet_list:s.owned,Owned_Pet_LockGroup:s.ownedLocks,Selected_LockGroup:s.selectedLocks,AD_Daily_Pet_LastDate:s.dailyLastDate,H5_Identity:{owned:s.ownedIDs,selected:s.selectedIDs,next:s.nextID}});}

export function decodeSourcePetState(value:unknown):SourcePetState{
 const v=typeof value==='string'?JSON.parse(value):value;
 if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('Invalid Pet save');
 const data=v as Record<string,unknown>;
 const grades=(field:string,count:number):number[]=>{const x=data[field];if(!Array.isArray(x)||x.length!==count||!x.every(gradeValid))throw new TypeError('Invalid Pet '+field);return [...x];};
 const owned=grades('Owned_Pet_list',16),selected=grades('Pet_Selected_items',3);
 const locks=(field:string,items:number[]):number[]=>{const x=data[field];if(x===undefined||x===null)return empty(items.length);if(!Array.isArray(x)||!x.every(n=>Number.isInteger(n)&&n>=-1&&n<=2147483647))throw new TypeError('Invalid Pet '+field);return items.map((_,i)=>x[i]??-1);};
 const collect=data.Pet_Collect;if(!Array.isArray(collect)||collect.length!==10||collect.some(x=>typeof x!=='boolean'))throw new TypeError('Invalid Pet history');
 const date=data.AD_Daily_Pet_LastDate;if(date!==undefined&&date!==null&&typeof date!=='string')throw new TypeError('Invalid Pet date');
 const identity=data.H5_Identity as {owned:(string|null)[];selected:(string|null)[];next:number}|undefined;
 if(identity!==undefined&&(!identity||!Array.isArray(identity.owned)||!Array.isArray(identity.selected)||!Number.isSafeInteger(identity.next)||identity.next<1))throw new TypeError('Invalid H5 Pet identity');
 // New saves must be complete; only legacy saves may allocate identities on migration.
 if(identity)for(const [items,ids] of [[owned,identity.owned],[selected,identity.selected]] as const){if(ids.length!==items.length||items.some((g,i)=>g===-1?ids[i]!==null:typeof ids[i]!=='string'))throw new TypeError('Invalid H5 Pet identity slots');}
 return sourcePetWithIdentities({owned,selected,ownedLocks:locks('Owned_Pet_LockGroup',owned),selectedLocks:locks('Selected_LockGroup',selected),collect:[...collect],dailyLastDate:typeof date==='string'?date:'',ownedIDs:identity?.owned??Array(16).fill(null),selectedIDs:identity?.selected??Array(3).fill(null),nextID:identity?.next??1});
}
export function sourcePetEntryUnlocked(maxDisplayStage:number):boolean{return Number.isInteger(maxDisplayStage)&&maxDisplayStage>=12;}
/** Runtime Balance_Reload: H2(previous * InfVal(double 3.1)), then integer truncation.
 * Speeds are 2,4,8,14,...; source applies +2,+4,+6,... to the previous grade. */
export function sourcePetStats(grade:number):{money:BigValue;moveSpeed:number}{
 if(!boundedSlot(grade,10))throw new RangeError('Invalid source Pet grade');
 let money=BigValue.fromInteger(2),speed=2;
 for(let i=1;i<=grade;i++){money=money.nativeMultiply(BigValue.fromNumber(3.1)).significant(2);money=money.truncateInteger();speed+=i*2;}
 return {money,moveSpeed:speed};
}
export function sourcePetSelectedStats(s:SourcePetState):{moneyMultiplierPercent:BigValue;moveSpeedMultiplierPercent:number}{
 let money=BigValue.ZERO,speed=0;for(const grade of s.selected)if(grade!==-1){const row=sourcePetStats(grade);money=money.nativeAdd(row.money);speed+=row.moveSpeed;}return {moneyMultiplierPercent:money.nativeAdd(BigValue.fromInteger(100)),moveSpeedMultiplierPercent:speed+100};
}
function granted(s:SourcePetState,grade:number):SourcePetResult{
 const slot=s.owned.indexOf(-1);if(slot<0)return blocked('pet-inventory-full');
 const value=clone(s),newCollection=!value.collect[grade];if(!Number.isSafeInteger(value.nextID+1))throw new RangeError('Pet identity overflow');value.owned[slot]=grade;value.ownedIDs[slot]=`pet:${value.nextID++}`;value.ownedLocks[slot]=-1;value.collect[grade]=true;
 return ok(value,{newGrade:grade,newCollection,slot});
}
/** DrawPet_Normal / DrawPet_Dia both call DrawPet(0); no random roll. Caller commits delta with value. */
export function sourcePetDraw(s:SourcePetState,wallet:SourcePetWallet,currency:'petCoin'|'diamonds'):SourcePetResult{
 const balance=wallet[currency];if(!Number.isSafeInteger(balance)||balance<0)throw new TypeError('Invalid Pet wallet');
 if(balance<100)return blocked('pet-'+currency+'-insufficient');
 const r=granted(s,0);return r.status==='supported'?{...r,petCoinDelta:currency==='petCoin'?-100:0,diamondDelta:currency==='diamonds'?-100:0}:r;
}
/** UI daily gate reads Monster_manager Wave_Now/Lv_Now; clear one hunt level to unlock. */
export function sourcePetDailyUnlocked(wave:number,level:number):boolean{return wave>0||level>0;}
/** confirmed and date from Time_manager-equivalent adapter; canceled/full requests do not consume the day. */
export function sourcePetDailyAd(s:SourcePetState,options:{wave:number;level:number;todayKey:string;confirmed:boolean}):SourcePetResult{
 if(!options.confirmed)return blocked('pet-ad-unconfirmed');if(!sourcePetDailyUnlocked(options.wave,options.level))return blocked('pet-daily-ad-locked');
 return sourcePetDailyReward(s,options.todayKey);
}
/** AD_Daily_Pet_RewardGet re-reads the CURRENT day, checks used/full, then DrawPet(1).
 * The hunt-unlock check belongs to AD_Draw_Btn_Click, not this callback. */
export function sourcePetDailyReward(s:SourcePetState,todayKey:string):SourcePetResult{
 if(!todayKey)return blocked('pet-daily-date-unavailable');if(s.dailyLastDate===todayKey)return blocked('pet-daily-ad-used');
 const r=granted(s,SOURCE_PET_DAILY_AD_GRADE);return r.status==='supported'?{...r,value:{...r.value,dailyLastDate:todayKey}}:r;
}
/** FuseItems resets both source locks and keeps the upgraded pet at the anchor index.
 * Same-grade requirement is the drag/auto adapter guard; native helper assumes its caller checked it. */
export function sourcePetMerge(s:SourcePetState,mover:number,anchor:number):SourcePetResult{
 if(!boundedSlot(mover,16)||!boundedSlot(anchor,16)||mover===anchor)return blocked('pet-merge-slot-invalid');
 const grade=s.owned[mover];if(grade<0||grade!==s.owned[anchor])return blocked('pet-merge-grade-mismatch');
 if(s.ownedLocks[mover]!==-1||s.ownedLocks[anchor]!==-1)return blocked('pet-merge-locked');if(grade>=9)return blocked('pet-merge-max-grade');
 const value=clone(s),newGrade=grade+1,newCollection=!s.collect[newGrade];value.owned[mover]=-1;value.ownedIDs[mover]=null;value.owned[anchor]=newGrade;value.ownedLocks[mover]=-1;value.ownedLocks[anchor]=-1;value.collect[newGrade]=true;
 return ok(value,{newGrade,newCollection,slot:anchor});
}
/** MoveToClosestSlot: grade + lockGroup move to the empty position. Stable ID
 * is an H5 guard, and follows the same entity; no new identity or resource grant. */
export function sourcePetMoveOwned(s:SourcePetState,from:number,to:number):SourcePetResult {
 if(!boundedSlot(from,16)||!boundedSlot(to,16)||from===to||s.owned[from]<0||s.owned[to]!==-1)return blocked('pet-owned-move-invalid');
 const value=clone(s);value.owned[to]=value.owned[from];value.ownedLocks[to]=value.ownedLocks[from];value.ownedIDs[to]=value.ownedIDs[from];value.owned[from]=-1;value.ownedLocks[from]=-1;value.ownedIDs[from]=null;return ok(value,{slot:to});
}
/** FinalizeSwap: a8=-1 -> two-slot swap; otherwise target moves into the
 * preview destination (empty or mover original), and mover into target. */
export function sourcePetSwapOwned(s:SourcePetState,from:number,target:number,destination=-1):SourcePetResult {
 if(!boundedSlot(from,16)||!boundedSlot(target,16)||from===target||s.owned[from]<0||s.owned[target]<0)return blocked('pet-owned-swap-invalid');
 if(destination!==-1&&(!boundedSlot(destination,16)||destination===target||(destination!==from&&s.owned[destination]!==-1)))return blocked('pet-owned-swap-destination-invalid');
 const value=clone(s),to=destination===-1?from:destination;
 const mover={grade:value.owned[from],lock:value.ownedLocks[from],uid:value.ownedIDs[from]},other={grade:value.owned[target],lock:value.ownedLocks[target],uid:value.ownedIDs[target]};
 for(const i of [from,target]){value.owned[i]=-1;value.ownedLocks[i]=-1;value.ownedIDs[i]=null;}
 value.owned[to]=other.grade;value.ownedLocks[to]=other.lock;value.ownedIDs[to]=other.uid;value.owned[target]=mover.grade;value.ownedLocks[target]=mover.lock;value.ownedIDs[target]=mover.uid;return ok(value,{slot:target});
}
/** EquipToSlot swaps inventory and equipped pets INCLUDING their lock IDs, even when locked. */
export function sourcePetEquip(s:SourcePetState,ownedSlot:number,selectedSlot:number):SourcePetResult{
 if(!boundedSlot(ownedSlot,16)||!boundedSlot(selectedSlot,3)||s.owned[ownedSlot]===-1)return blocked('pet-equip-slot-invalid');
 const value=clone(s);[value.owned[ownedSlot],value.selected[selectedSlot]]=[value.selected[selectedSlot],value.owned[ownedSlot]];
 [value.ownedIDs[ownedSlot],value.selectedIDs[selectedSlot]]=[value.selectedIDs[selectedSlot],value.ownedIDs[ownedSlot]];
 [value.ownedLocks[ownedSlot],value.selectedLocks[selectedSlot]]=[value.selectedLocks[selectedSlot],value.ownedLocks[ownedSlot]];
 if(value.owned[ownedSlot]===-1)value.ownedLocks[ownedSlot]=-1;return ok(value);
}
/** Unequip preserves dispatch locks; full inventory is a no-op. */
export function sourcePetUnequip(s:SourcePetState,selectedSlot:number):SourcePetResult{
 if(!boundedSlot(selectedSlot,3)||s.selected[selectedSlot]===-1)return blocked('pet-unequip-slot-invalid');
 const slot=s.owned.indexOf(-1);if(slot<0)return blocked('pet-inventory-full');const value=clone(s);
 value.owned[slot]=value.selected[selectedSlot];value.ownedLocks[slot]=value.selectedLocks[selectedSlot];value.selected[selectedSlot]=-1;value.selectedLocks[selectedSlot]=-1;value.ownedIDs[slot]=value.selectedIDs[selectedSlot];value.selectedIDs[selectedSlot]=null;return ok(value,{slot});
}
export function sourcePetSwapSelected(s:SourcePetState,from:number,to:number):SourcePetResult{
 if(!boundedSlot(from,3)||!boundedSlot(to,3)||from===to||s.selected[from]===-1)return blocked('pet-selected-swap-invalid');const value=clone(s);
 [value.selected[from],value.selected[to]]=[value.selected[to],value.selected[from]];[value.selectedIDs[from],value.selectedIDs[to]]=[value.selectedIDs[to],value.selectedIDs[from]];[value.selectedLocks[from],value.selectedLocks[to]]=[value.selectedLocks[to],value.selectedLocks[from]];return ok(value);
}
export function sourcePetCanDispatch(s:SourcePetState,location:'owned'|'selected',slot:number):boolean{
 const items=location==='owned'?s.owned:s.selected,locks=location==='owned'?s.ownedLocks:s.selectedLocks;return boundedSlot(slot,items.length)&&items[slot]!==-1&&locks[slot]===-1;
}
/** Source LockOwned/LockSelected overwrite the supplied group for a nonempty slot. */
export function sourcePetLock(s:SourcePetState,location:'owned'|'selected',slot:number,group:number):SourcePetResult{
 if(!Number.isInteger(group)||group<0||group>2147483647)throw new RangeError('Invalid Pet lock group');
 const items=location==='owned'?s.owned:s.selected;if(!boundedSlot(slot,items.length)||items[slot]===-1)return blocked('pet-lock-slot-invalid');const value=clone(s);(location==='owned'?value.ownedLocks:value.selectedLocks)[slot]=group;return ok(value);
}
export function sourcePetUnlockGroup(s:SourcePetState,group:number):SourcePetResult{
 if(!Number.isInteger(group)||group<0||group>2147483647)throw new RangeError('Invalid Pet lock group');const value=clone(s);value.ownedLocks=value.ownedLocks.map(g=>g===group?-1:g);value.selectedLocks=value.selectedLocks.map(g=>g===group?-1:g);return ok(value);
}
