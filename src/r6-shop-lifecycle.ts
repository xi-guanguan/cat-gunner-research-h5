/** Source 1.1.61 Shop_manager.LoadFromSaveData @0x2b9b3b0.
 * DiaFirstBuy_Season_Current is the build constant 1, NOT a calendar month.
 * A mismatching saved season starts five false flags; no receipts/balances are reset.
 * H5 older envelopes stored only shop:dia-N: receipts; migrate those conservatively.
 */
export const SOURCE_DIA_FIRST_BUY_SEASON=1;
export const SOURCE_DIA_PRODUCT_COUNT=5;
export interface SourceDiaFirstBuyState {season:number;used:boolean[]}
export function freshSourceDiaFirstBuyState():SourceDiaFirstBuyState {return {season:SOURCE_DIA_FIRST_BUY_SEASON,used:Array<boolean>(SOURCE_DIA_PRODUCT_COUNT).fill(false)};}
export function validateSourceDiaFirstBuyState(value:unknown):SourceDiaFirstBuyState {
 const v=value as SourceDiaFirstBuyState;
 if(!v||!Number.isSafeInteger(v.season)||v.season<-2147483648||v.season>2147483647||!Array.isArray(v.used)||v.used.length!==SOURCE_DIA_PRODUCT_COUNT||v.used.some(x=>typeof x!=='boolean'))throw Error('Invalid diamond first-buy season');
 return {season:v.season,used:[...v.used]};
}
export function sourceDiaFirstBuyLoaded(saved:SourceDiaFirstBuyState|undefined,claims:readonly string[]):SourceDiaFirstBuyState {
 if(saved!==undefined){const s=validateSourceDiaFirstBuyState(saved);return s.season===SOURCE_DIA_FIRST_BUY_SEASON?s:freshSourceDiaFirstBuyState();}
 const s=freshSourceDiaFirstBuyState();s.used=s.used.map((_,i)=>claims.some(c=>c.startsWith(`shop:dia-${i}:`)));return s;
}
export function sourceDiaProductIndex(product:string){return /^dia-[0-4]$/.test(product)?Number(product.slice(4)):-1;}
