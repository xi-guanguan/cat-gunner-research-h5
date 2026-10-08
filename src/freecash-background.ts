/** Patch service exposure only. SDK readiness is not a reason to rebuild a result page.
 * Native FreeCash.Banner_ShouldShow and BannerReward.Reload; no reward side effects. */
import type {SourceUiView} from './source-ui';
import {sourceChallengeRewardBanner} from './r6-challenge';
export const FREECASH_RESULT_ROOTS=[
 '/Canvas/Contents_UI/SpeedRun_UI/GameWin_obj','/Canvas/Contents_UI/SpeedRun_UI/GameFail_obj','/Canvas/Contents_UI/SpeedRun_UI/GameSweep_obj',
 '/Canvas/Contents_UI/Mine_UI/GameEnd_obj','/Canvas/Contents_UI/Mine_UI/GameSweep_obj',
 '/Canvas/Contents_UI/Boss_UI/GameWin_obj','/Canvas/Contents_UI/Boss_UI/GameFail_obj','/Canvas/Contents_UI/Boss_UI/GameSweep_obj',
 '/Canvas/Contents_UI/Monster_UI/GameEnd_obj ','/Canvas/Contents_UI/Monster_UI/GameSweep_obj',
] as const;
export interface FreeCashBackgroundState {removeAdsAll:boolean;buffPack:boolean;exposure:{featureEnabled:boolean;exposureTarget:boolean}}
export function freeCashBackgroundActivation(s:FreeCashBackgroundState):Record<string,boolean>{
 const active:Record<string,boolean>={},banner=sourceChallengeRewardBanner(s.removeAdsAll,s.exposure);
 for(const root of FREECASH_RESULT_ROOTS){const p=root+'/Remove Ads ALL (Inapp)';active[p]=banner.purchase||banner.freeCash;active[p+'/Remove_AD_All']=banner.purchase;active[p+'/FreeCash_Banner']=banner.freeCash;}
 active['/Canvas/SafeArea/Shop_UI/Panel/Scroll View/Viewport/Content/Free Reward/FreeCash_Banner']=s.exposure.featureEnabled&&s.exposure.exposureTarget;
 active['/Canvas/Buff_manager/Buff_UI/InApp & FREECASH/FreeCash']=!s.buffPack&&s.exposure.featureEnabled&&s.exposure.exposureTarget;
 return active;
}
export function syncFreeCashBackground(view:Pick<SourceUiView,'get'|'patch'>,s:FreeCashBackgroundState){
 const active=Object.fromEntries(Object.entries(freeCashBackgroundActivation(s)).filter(([p])=>!!view.get(p)));
 if(Object.keys(active).length)view.patch({active});
}
