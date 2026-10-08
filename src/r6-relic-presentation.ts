import scene from './data/r6-relic-ui.json';
import type {SourceRelicDrawItem} from './r6-relic';
/** Host presentation clock. Native delays copied from serialized fields;
 * browser scheduling/bounce motion is an explicit H5 adapter, not Unity replay. */
export function sourceRelicDrawPresentation(draws:readonly SourceRelicDrawItem[],page:number,elapsed:number) {
 const r=scene.find(r=>r.kind==='Relic_Draw_Panel')!.data as any,size=r.Relic_Item_List.length,start=page*size,count=Math.min(size,Math.max(0,draws.length-start));
 const single=draws.length===1,ready=elapsed>=(single?r.Single_CloseDelay:Math.max(0,count-1)*r.Multi_Interval+r.Page_Delay);
 return {single,size,start,count,visible:single?1:Math.min(count,Math.max(0,Math.floor(elapsed/r.Multi_Interval)+1)),ready,left:ready&&page>0,right:ready&&(page+1)*size<draws.length};
}
