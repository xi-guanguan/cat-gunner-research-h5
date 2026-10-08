/** Original FreeCash hierarchy and assets; disclosure replaces real-money claims in local tests. */
import {createSourceUiView,findSourceUiNode,type SourceUiView} from './source-ui';
import type {Texture} from 'pixi.js';
import type {SourceFreeCashClient} from './freecash-client';
import type {SourceFreeCashState} from './r6-freecash';
export const SOURCE_FREECASH_ROOT='/Canvas/FreeCash_manager/FreeCash_UI';
export function createSourceFreeCashPanel(textures:Record<string,Texture>,width:number,height:number,action:(name:string)=>void):SourceUiView {
 const active:Record<string,boolean>={};let n=findSourceUiNode('level0:2291');while(n){active[n.id]=true;n=n.parent?findSourceUiNode(n.parent):undefined;}
 const view=createSourceUiView({textures,viewport:{width,height},roots:['level0:2291'],active});
 for(const id of [1733,677])view.bindAction(id,()=>action('freecash-close'));
 view.bindAction(855,()=>action('freecash-check'));view.bindAction(587,()=>action('freecash-link'));return view;
}
export function syncSourceFreeCashPanel(view:SourceUiView,client:SourceFreeCashClient,state:SourceFreeCashState,notice:string){
 const summary=client.saveFailed?'存档失败 · 检查重试，不重复发奖':client.pending?'本地测试处理中 · 不真实链接':client.sdkStatus==='unavailable'?'线上 SDK 未连接 · 不发权益':notice.includes('取消')?'本地测试已取消 · 不发权益':notice.includes('失败')?'本地测试失败 · 可重试':'本地测试：'+(client.sdkStatus==='linked'?'已链接':'账户尚未链接');
 const text:Record<number,string>={1824:'FREE CASH',10272:'线上收益服务未连接',10378:'不支付真钱或礼品卡',10169:'明示本地 SDK 模拟',10324:'不会发放源文案中的 $5',10285:state.isRewardAdRemoved?'激励广告权益已保存':'链接权益：移除激励广告',10277:'仅本地测试链接，不影响强制广告权益',10157:client.saveFailed?'重试保存':client.pending?'处理中':'检查链接',10223:state.isLinkRewardReceived?'权益已领取':client.pending?'处理中':'本地测试链接',10239:summary};
 for(const [id,value]of Object.entries(text))view.setText(+id,value);
}
