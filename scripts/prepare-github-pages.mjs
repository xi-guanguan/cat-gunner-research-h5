/** Deployment-only adapter: never modifies the research runtime or its save rules. */
import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[2] ?? 'dist');
const base = process.argv[3] ?? '/cat-gunner-research-h5/';
if (!/^\/[a-zA-Z0-9_-]+\/$/.test(base)) throw Error('Expected a single project Pages base path');
const files = async dir => (await Promise.all((await readdir(dir, {withFileTypes:true})).map(e => e.isDirectory() ? files(join(dir,e.name)) : join(dir,e.name)))).flat();
let rewritten = 0;
for (const path of await files(root)) {
  if (!/\.(?:js|mjs|json|html|css)$/.test(path)) continue;
  const text = await readFile(path, 'utf8');
  // Handles serialized JSON, quoted URLs, CSS URLs, and template literals.
  // Preserve source identity paths such as /Canvas; only rewrite delivery resources.
  let next = text.replace(/(["'`(])(?:\.\/|\/)assets\//g, `$1${base}assets/`);
  next = next.replace(/(["'`])\/(debug(?:\/|\.html)|qa\.html)/g, `$1${base}$2`);
  if (relative(root,path).startsWith('debug/') || /(?:debug|qa)\.html$/.test(path)) {
    next = next.replace(/(["'])\/\?qa=/g, `$1${base}?qa=`);
    // QA path checks and the debug catalog operate on this same project entry.
    next = next.replace(/(['"])\/\1/g, `$1${base}$1`);
  }
  // Live QA controls embed links in HTML template literals.
  next = next.replace(/href="\/qa\.html"/g, `href="${base}qa.html"`);
  if (next !== text) { await writeFile(path,next); rewritten++; }
}
// Re-key compiled chunks after URL rewriting so early visitors cannot retain a
// cached broken bundle under the old Vite content-hash name.
const renamed = new Map();
for (const path of await files(join(root,'assets'))) {
  if (relative(join(root,'assets'),path).includes('/') || !/\.(?:js|css)$/.test(path)) continue;
  const name = relative(join(root,'assets'),path);
  const hash = createHash('sha256').update(await readFile(path)).digest('hex').slice(0,10);
  const next = name.replace(/\.(js|css)$/, `-pages-${hash}.$1`);
  renamed.set(name,next);
  await rename(path,join(root,'assets',next));
}
for (const path of await files(root)) {
  if (!/\.(?:js|mjs|html|css)$/.test(path)) continue;
  const text = await readFile(path,'utf8');
  let next = text;
  for (const [oldName,newName] of renamed) next = next.replaceAll(oldName,newName);
  if (next !== text) await writeFile(path,next);
}
await writeFile(join(root,'.nojekyll'),'');
const manifest = [];
for (const path of (await files(root)).sort()) {
  if (path.endsWith('/deployment-manifest.json')) continue;
  const data = await readFile(path);
  manifest.push({path:relative(root,path),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
const record = {schemaVersion:1,mode:'online-research-preview / WIP',base,sourceRevision:process.env.CATGUNNER_SOURCE_REVISION??null,sourceRepositoryRevision:process.env.GITHUB_SHA??null,files:manifest};
await writeFile(join(root,'deployment-manifest.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({mode:record.mode,base,rewrittenFiles:rewritten,fileCount:manifest.length,bytes:manifest.reduce((s,f)=>s+f.bytes,0),sourceRevision:record.sourceRevision}));
