/** Admob.ShowRewardAd@0x2a89b0c: reward removal → Set_RewardContext → Reward_Get,
 * before any SDK availability/loading checks. removeAdsForced alone does not qualify.
 * This adapter delivers ONLY local-test receipts; it never claims an online ad completion. */
import {sourceRewardAdsRemoved} from './r6-shop';
import type {SourceEntitlements} from './r5-entitlements';
import {createLocalRewardProvider,type SourceRewardProvider,type SourceProviderStatus} from './r6-reward-provider';
export function createSourceLocalRewardProvider(entitlements:SourceEntitlements,available:boolean,outcome:Exclude<SourceProviderStatus,'unavailable'>='success'):SourceRewardProvider {
 const ordinary=createLocalRewardProvider(available,outcome),removed=createLocalRewardProvider(true);
 const bypass=sourceRewardAdsRemoved(entitlements),identities=new Map<string,{purpose:string;kind:string}>();
 return {execute(request){
  const previous=identities.get(request.id);
  if(previous&&(previous.purpose!==request.purpose||previous.kind!==request.kind))throw new Error('Provider request identity conflict');
  const response=(request.kind==='ad'&&bypass?removed:ordinary).execute(request);
  identities.set(request.id,{purpose:request.purpose,kind:request.kind});return response;
 }};
}
