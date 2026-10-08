/** Shared local-test receipt label; each source button supplies its own product identity. */
export function sourceActivityPurchasePrice(state:{pending:boolean;saveFailedProduct?:string},product:string):string {
 return state.saveFailedProduct===product?'重试保存':state.pending?'等待回调':'本地测试';
}
