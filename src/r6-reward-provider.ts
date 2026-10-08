/** Explicit local provider: no real ad, transaction, or online receipt is produced. */
export type SourceProviderStatus='success'|'failure'|'cancelled'|'unavailable';
export interface SourceRewardRequest {id:string;purpose:string;kind:'ad'|'purchase'}
export interface SourceRewardResponse extends SourceRewardRequest {status:SourceProviderStatus;provider:'local-test';onlineVerified:false}
export interface SourceRewardProvider {execute(request:SourceRewardRequest):Promise<SourceRewardResponse>}
export function createLocalRewardProvider(available:boolean,outcome:Exclude<SourceProviderStatus,'unavailable'>='success'):SourceRewardProvider {
 const requests=new Map<string,{purpose:string;kind:string;response:Promise<SourceRewardResponse>}>();
 return {execute(request){
  if(!request.id||!request.purpose||!['ad','purchase'].includes(request.kind))throw new RangeError('Invalid provider request');
  const previous=requests.get(request.id);
  if(previous){if(previous.purpose!==request.purpose||previous.kind!==request.kind)throw new Error('Provider request identity conflict');return previous.response;}
  const response=Promise.resolve<SourceRewardResponse>({...request,status:available?outcome:'unavailable',provider:'local-test',onlineVerified:false});
  requests.set(request.id,{purpose:request.purpose,kind:request.kind,response});return response;
 }};
}
export function sourceRewardMatches(request:SourceRewardRequest,response:SourceRewardResponse):boolean {
 return request.id===response.id&&request.purpose===response.purpose&&request.kind===response.kind&&response.provider==='local-test'&&response.onlineVerified===false;
}
