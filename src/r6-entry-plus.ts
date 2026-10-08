/** Boss_Start_UI / Monster_Start_UI Banner_Reload and PlusPack.Banner_ShouldShow.
 * Native object-not-null guard is structural, not a second progress gate.
 * Evidence: round6 entry-plus-disasm.txt / entry-plus-methods.json. */
import type {SourceEntitlements} from './r5-entitlements';
import {SOURCE_WEEKLY} from './r6-weekly';
import {sourceActivityPurchasePrice} from './source-activity-purchase-projection';
export type SourceEntryPlusKind='boss'|'hunt';
export const SOURCE_ENTRY_PLUS_ITEM={boss:0,hunt:2} as const;
export interface SourceEntryPlusPurchaseUI {pending:boolean;saveFailedProduct?:string;localProvider?:boolean}
export function sourceEntryPlusVisible(kind:SourceEntryPlusKind,historicMax:number,e:Pick<SourceEntitlements,'plusPack0Active'|'plusPack2Active'>):boolean {
 return historicMax>=190&&!(kind==='boss'?e.plusPack0Active:e.plusPack2Active);
}
/** The entry identity is admission only. Manager-owned callbacks survive closing this panel. */
export function sourceEntryPlusPurchaseGate(kind:SourceEntryPlusKind,item:number,context:{historicMax:number;mode:string;overlay:string;localPanel:string;running:boolean},e:Pick<SourceEntitlements,'plusPack0Active'|'plusPack2Active'>):string|undefined {
 if(item!==SOURCE_ENTRY_PLUS_ITEM[kind])return 'Plus商品与原入口不匹配';
 if(context.mode!=='field'||context.overlay!=='none'||context.localPanel!==(kind==='boss'?'boss':'monster')||context.running)return '原玩法入口已关闭或战斗已开始；未发起交易';
 if(context.historicMax<190)return '普通第20大关开放Plus横幅';
 if(!sourceEntryPlusVisible(kind,context.historicMax,e))return '此Plus权益仍在有效期内';
}
/** Price is explicit local test / unconnected service; never invent an online store price. */
export function sourceEntryPlusPurchaseProjection(kind:SourceEntryPlusKind,state:SourceEntryPlusPurchaseUI={pending:false}):{price:string;enabled:boolean} {
 const product=SOURCE_WEEKLY.plusProducts[SOURCE_ENTRY_PLUS_ITEM[kind]],retry=state.saveFailedProduct===product;
 return {price:state.pending||retry?sourceActivityPurchasePrice(state,product):state.localProvider?'本地测试购买':'服务未连接',enabled:!state.pending||retry};
}
