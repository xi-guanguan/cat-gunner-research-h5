import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceChineseTranslations,localizeSourceText,sourceDisplayText,hasKoreanText,sourceChineseFontFamily,sourceLocalizationDiagnostics} from '../source-localization.ts';
const read=name=>JSON.parse(readFileSync(`src/data/${name}`,'utf8'));
const trees=['source-ui-tree.json','source-hunt-panel.json','source-hunt-hud.json','source-raid-hud.json'];
const unique=new Set();
for(const name of trees)test(`every exported TMP Korean label is Chinese: ${name} (includes hidden subpanels)`,()=>{
 const tree=read(name);let count=0;
 for(const node of tree.nodes)for(const component of node.components){
  const source=component.data?.text;
  if(typeof source!=='string'||!hasKoreanText(source))continue;
  count++;unique.add(source);
  assert.equal(typeof sourceChineseTranslations[source],'string',`${name} ${node.path}`);
  const text=sourceDisplayText(source,component.data.isRichText!==false,node.path);
  assert.ok(text.trim().length>0,`${node.path}: blank translation`);
  assert.equal(hasKoreanText(text),false,`${node.path}: ${text}`);
 }
 assert.ok(count>0);
});
test('all 65 source weapon names translate without changing source/stored identities',()=>{
 const guns=read('guns.json').guns,original=JSON.stringify(guns);
 assert.equal(guns.length,65);
 for(const gun of guns){assert.equal(hasKoreanText(gun.name),true);const text=localizeSourceText(gun.name);assert.notEqual(text,gun.name);assert.equal(hasKoreanText(text),false);}
 assert.equal(JSON.stringify(guns),original);
 for(const name of ['Beginner Pistol','Pistol','Light SMG','Short SG','Double SG'])assert.match(localizeSourceText(name),/[\u3400-\u9fff]/);
});
test('all task source names and loading serialized text have Chinese display forms',()=>{
 for(const task of read('round3-ui-contract.json').activities.missions)assert.equal(hasKoreanText(localizeSourceText(task.sourceName)),false);
 assert.equal(sourceDisplayText(read('round2-ui-layout.json').loading.textSource.serializedText),'猫咪移动中…');
});
test('catalog has no Korean in target values, and dynamic placeholders keep their identity',()=>{
 for(const [source,target] of Object.entries(sourceChineseTranslations)){
  assert.ok(target.trim());assert.equal(hasKoreanText(target),false,source);
  assert.deepEqual(target.match(/\{\d+\}/g)??[],source.match(/\{\d+\}/g)??[],source);
  const trueTags=/<\/?(?:sprite|color|size|b|i|u)(?:[^>]*)>/g;
  assert.deepEqual(target.match(trueTags)??[],source.match(trueTags)??[],source);
 }
 assert.equal(Object.isFrozen(sourceChineseTranslations),true);
});
test('source numbers, ranks and days retain the source meaning instead of changing rules',()=>{
 assert.equal(localizeSourceText('다이아 16000개를 획득합니다'),'获得16000颗钻石');
 assert.match(localizeSourceText('일일 다이아 광산 티켓이 6회로 증가'),/6/);
 assert.equal(localizeSourceText('입장 가능 요일 : 화, 금, 일'),'开放日：周二、周五、周日');
 assert.equal(localizeSourceText('입장 가능 요일 : 수, 토, 일'),'开放日：周三、周六、周日');
 assert.equal(localizeSourceText('폭발레이저 ZZZ'),'爆破激光 ZZZ');
 assert.equal(localizeSourceText('관통 X '),'穿透 X');
 assert.match(localizeSourceText('주간 보스 체력바 1개를 깍을 때마다\\n저금통에 강화석 25개가 채워집니다!'),/1.*\n.*25/s);
});
test('rich tags localize before stripping; warning survives and real/literal newlines agree',()=>{
 assert.equal(sourceDisplayText('<경고> 현제 게임 데이터가 사라집니다.'),'【警告】当前游戏数据将被覆盖。');
 assert.equal(sourceDisplayText('<color=yellow>(폭발)</color>을 사용하면 데미지 10배 적용'),'使用（爆破）武器造成10倍伤害');
 assert.equal(sourceDisplayText('모든 버프 활성화!\\n효과가 강화되었어요!'),'全部增益已激活！\n效果已增强！');
 assert.equal(sourceDisplayText('모든 버프 활성화!\n효과가 강화되었어요!'),'全部增益已激活！\n效果已增强！');
 assert.equal(sourceDisplayText('<b>中文</b><br>下一行'),'中文\n下一行');
 assert.equal(sourceDisplayText('<b>中文</b>',false),'<b>中文</b>');
});
test('already substituted templates keep values, rich icon tags and percent',()=>{
 assert.equal(localizeSourceText('1분마다 <sprite=1> 2.5개씩 획득합니다.'),'每分钟获得<sprite=1> 2.5颗钻石。');
 assert.equal(sourceDisplayText('스테이지 재클리어시 다음 스테이지를 스킵하는 확률이 12.75% 증가합니다!'),'重复通关后，跳过下一关的几率增加12.75%！');
 assert.equal(sourceDisplayText('1분마다 <sprite=1> {0}개씩 획득합니다.'),'每分钟获得 {0}颗钻石。');
});
test('mixed gun captions prefer longest known fragment and preserve level/value',()=>{
 assert.equal(localizeSourceText('Lv.115 · 폭발레이저 SSS · 5.95e17'),'Lv.115 · 爆破激光 SSS · 5.95e17');
 assert.equal(sourceDisplayText('이번주 최고기록 : <size=45>Lv.73'),'本周最高纪录：Lv.73');
 assert.equal(localizeSourceText('slot2 · 관통 XX'),'slot2 · 穿透 XX');
});
test('Chinese/Latin/numeric content is not translated twice or numerically reformatted',()=>{
 for(const text of ['攻击力 1.45e9','PetCoin 100','x4','MAX','<sprite=0>5.95e17','本地测试 · 线上未连接','__proto__','constructor','toString',''])assert.equal(localizeSourceText(text),text);
 for(const text of Object.values(sourceChineseTranslations))assert.equal(localizeSourceText(text),text);
});
test('CJK uses original extracted SC font; unchanged numeric source typography is preserved',()=>{
 assert.equal(sourceChineseFontFamily('自动合成','CatGunnerJP, sans-serif'),'CatGunnerSC, CatGunnerJP, sans-serif');
 assert.equal(sourceChineseFontFamily('5.95e17','MPLUS Rounded, sans-serif'),'MPLUS Rounded, sans-serif');
 assert.equal(sourceChineseFontFamily(sourceDisplayText('최고기록!'),'Arial, sans-serif'),'CatGunnerSC, Arial, sans-serif');
});
test('renderer and measureText share localized display content and SC font selection',()=>{
 const ui=readFileSync('src/source-ui.ts','utf8'),main=readFileSync('src/main.ts','utf8');
 assert.match(ui,/t\.text=sourceDisplayText\(override\?\?d\.text\?\?'',d\.isRichText!==false,n\.path\)/);
 assert.match(ui,/text=sourceDisplayText\(textOverrides\.get\(n\.id\)\?\?d\.text\?\?'',d\.isRichText!==false,n\.path\)/);
 assert.match(ui,/TextMetrics\.measureText\(text,style\)/);
 assert.match(ui,/fontFamily:sourceChineseFontFamily\(displayText,fontFamily\(n,tree,families\)\)/);
 assert.match(main,/value=localizeSourceText\(value,"main-label"\)/);
 assert.match(main,/localization:sourceLocalizationDiagnostics\(\)/);
});
test('unknown Korean is explicitly diagnosed, not removed or faked as translated',()=>{
 const source='미등록 한국어';assert.equal(localizeSourceText(source,'test-unknown'),source);
 assert.ok(sourceLocalizationDiagnostics().unresolved.some(row=>row.text===source&&row.context==='test-unknown'));
});
test('mixed-label cache and missing diagnostics stay bounded',()=>{
 for(let i=0;i<1200;i++)assert.equal(localizeSourceText(`Lv.${i} · 레이저 XXX`),`Lv.${i} · 激光 XXX`);
 for(let i=0;i<90;i++)localizeSourceText(`미등록 ${i}`,`unknown-${i}`);
 const d=sourceLocalizationDiagnostics();assert.equal(d.language,'zh-CN');assert.ok(d.cacheEntries<=d.cacheLimit);assert.ok(d.unresolved.length<=d.diagnosticLimit);
});
test('localization adapter has no storage/provider or source identity writes',()=>{
 const source=readFileSync('src/source-localization.ts','utf8');
 assert.doesNotMatch(source,/\b(?:localStorage|sessionStorage|setItem|serializeSession|deserializeSession)\b/);
 assert.doesNotMatch(source,/fetch\(|sourceUiTree\.|gun\.name\s*=/);
});
test('Debug input provenance includes JSON display catalogs and source data',()=>{
 const source=readFileSync('artifacts/evidence/tools/write-debug-provenance.mjs','utf8');
 assert.match(source,/p\.endsWith\('\.json'\)/);
 assert.match(source,/JSON源数据与翻译目录/);
});

test('ordinary entry declares Simplified Chinese without changing its isolated bootstrap',()=>{
 const html=readFileSync('index.html','utf8');assert.match(html,/<html lang="zh-CN">/);assert.match(html,/src="\/src\/bootstrap\.ts"/);
});
