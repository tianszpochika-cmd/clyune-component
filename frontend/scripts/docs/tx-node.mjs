/** Run the site's own runtime translator (src/lib/i18n.ts tx + en.json + ctx.json) in Node, so docs/SEO English
 *  is exactly what the browser shows. HTML is translated per text node, like translateTree() does in the DOM. */
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ROOT } from './analyze.mjs';
const ev = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
Object.assign(globalThis, { window: ev, location: { search: '?lang=en', pathname: '/' } });
globalThis.localStorage = { getItem: () => 'en', setItem() {} };
globalThis.document = { documentElement: {} };
globalThis.CustomEvent ??= class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
const r = await build({ entryPoints: [path.join(ROOT, 'src/lib/i18n.ts')], bundle: true, format: 'esm', platform: 'node', write: false, external: ['react'], logLevel: 'silent' });
const tmp = path.join(ROOT, 'node_modules/.cache/i18n-node.mjs');
fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, r.outputFiles[0].text);
const I = await import(pathToFileURL(tmp).href + '?' + Date.now());
await I.loadDict();
const CJK = /[\u3400-\u9fff]/;
export function txScope(p) { I.setTxScope(p); }
export function txStr(s) { return typeof s === 'string' && CJK.test(s) ? I.tx(s) : s; }
export function txHtml(h) {
  if (typeof h !== 'string' || !CJK.test(h)) return h;
  return h.replace(/(^|>)([^<]+)(?=<|$)/g, (m, a, t) => a + (CJK.test(t) ? I.tx(t) : t));
}
export const hasCJK = (s) => CJK.test(String(s || '').replace(/<[^>]+>/g, ''));
