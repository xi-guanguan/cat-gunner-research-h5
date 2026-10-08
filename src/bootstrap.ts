/** Same-build isolation: live Hunt QA must not bootstrap/read the ordinary save. */
import {isSourceHuntLiveQARoute} from './hunt-qa-routes';
import {isSourceRaidLiveQARoute} from './raid-live-qa-routes';
import {failBoot,finishBoot,setBootProgress} from './loading-progress';
const route=new URLSearchParams(location.search).get('qa');
setBootProgress(3,'下载游戏程序中…');
if(isSourceHuntLiveQARoute(route)) import('./hunt-live-qa').then(m=>m.startHuntLiveQA(route)).then(finishBoot).catch(failBoot);
else if(isSourceRaidLiveQARoute(route)) import('./raid-live-qa').then(m=>m.startRaidLiveQA(route)).then(finishBoot).catch(failBoot);
else import('./main').then(finishBoot).catch(failBoot);
