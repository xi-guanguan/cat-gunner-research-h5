/** Same-build isolation: live Hunt QA must not bootstrap/read the ordinary save. */
import {isSourceHuntLiveQARoute} from './hunt-qa-routes';
import {isSourceRaidLiveQARoute} from './raid-live-qa-routes';
const route=new URLSearchParams(location.search).get('qa');
if(isSourceHuntLiveQARoute(route)) {
 import('./hunt-live-qa').then(m=>m.startHuntLiveQA(route)).catch(error=>{
  document.getElementById('game')!.textContent=`狩猎测试加载失败（普通存档未读取）：${String(error)}`;console.error(error);
 });
}else if(isSourceRaidLiveQARoute(route)){
 import('./raid-live-qa').then(m=>m.startRaidLiveQA(route)).catch(error=>{document.getElementById('game')!.textContent=`突袭隔离测试加载失败（普通档未读取）：${String(error)}`;console.error(error);});
}else import('./main');
