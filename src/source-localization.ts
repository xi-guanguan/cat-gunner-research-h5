import catalog from './data/source-zh-cn.json';

/** Display-only H5 adaptation. Never rewrite source node paths, stable item IDs,
 * stored weapon names, balances, native templates or provider results. */
export const SOURCE_UI_LANGUAGE = 'zh-CN' as const;
export const sourceChineseTranslations:Readonly<Record<string,string>> = Object.freeze(catalog.entries);
const translations=new Map(Object.entries(sourceChineseTranslations));
const hangul=/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
export const hasKoreanText=(value:string)=>hangul.test(value);
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const fragments=Object.keys(sourceChineseTranslations).filter(hasKoreanText).sort((a,b)=>b.length-a.length);
const fragmentPattern=new RegExp(fragments.map(escapeRegExp).join('|'),'g');
const templates=fragments.filter(value=>/\{\d+\}/.test(value)).map(source=>{
  const tokens=[...source.matchAll(/\{(\d+)\}/g)].map(match=>Number(match[1]));
  // Only whole-template matches; never alter a numeric suffix or partial user text.
  const pattern=source.split(/\{\d+\}/).map(escapeRegExp).join('([^\\r\\n]+?)');
  return {pattern:new RegExp(`^${pattern}$`),tokens,target:sourceChineseTranslations[source]};
});
const cache=new Map<string,string>();
const unresolved=new Map<string,{text:string;context:string}>();
const CACHE_LIMIT=1024,DIAGNOSTIC_LIMIT=64;

/** Translate exact source labels, substituted source templates, and known Korean
 * fragments in mixed labels. Unknown Korean remains visible + diagnosed, never
 * silently deleted or replaced with a misleading generic Chinese message. */
export function localizeSourceText(value:string,context='display'):string {
  let translated=translations.get(value);
  if(translated===undefined){
    if(!hasKoreanText(value))return value;
    translated=cache.get(value);
    if(translated===undefined){
      for(const template of templates){
        const match=template.pattern.exec(value);
        if(match){
          translated=template.target.replace(/\{(\d+)\}/g,(token,index)=>{
            const slot=template.tokens.indexOf(Number(index));return slot<0?token:match[slot+1];
          });break;
        }
      }
      translated??=value.replace(fragmentPattern,source=>sourceChineseTranslations[source]);
      if(cache.size>=CACHE_LIMIT)cache.delete(cache.keys().next().value!);
      cache.set(value,translated);
    }
  }
  if(hasKoreanText(translated)&&unresolved.size<DIAGNOSTIC_LIMIT){
    const key=`${context}\0${value}`;if(!unresolved.has(key))unresolved.set(key,{text:value,context});
  }
  return translated;
}

/** Same localized content for canvas rendering AND TextMetrics. Rich TMP tags
 * retain the existing H5 plain-text adapter; Korean pseudo-tag <경고> is localized
 * into a visible warning before stripping. Source literal \\n becomes a line break. */
export function sourceDisplayText(value:string,rich=true,context='source-ui'):string {
  const text=localizeSourceText(value,context).replace(/\\n/g,'\n');
  return rich?text.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,''):text;
}
export function sourceChineseFontFamily(value:string,sourceFamily:string):string {
  return /[\u3400-\u9fff]/.test(value)?`CatGunnerSC, ${sourceFamily}`:sourceFamily;
}
export function sourceLocalizationDiagnostics(){
  return {language:SOURCE_UI_LANGUAGE,catalogEntries:Object.keys(sourceChineseTranslations).length,
    unresolved:[...unresolved.values()],diagnosticLimit:DIAGNOSTIC_LIMIT,cacheEntries:cache.size,cacheLimit:CACHE_LIMIT};
}
