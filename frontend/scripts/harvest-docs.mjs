/**
 * Harvest the evaluated info-panel doc (公式/说明/参数/步骤/提示) of every demo from a running build.
 * Usage: BASE=http://127.0.0.1:4180 node scripts/harvest-docs.mjs  → scripts/docs-runtime.json
 * The doc objects are partly functions of live values, so they are read from the real page (zh UI).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:4180', PAR = +(process.env.PAR || 3);
const OUT = new URL('./docs-runtime.json', import.meta.url);
const reg = JSON.parse(fs.readFileSync(new URL('../public/registry.json', import.meta.url)));
const routes = reg.categories.flatMap((c) => c.demos.map((d) => `/${c.key}/${d.slug}`));
const only = process.env.ONLY ? routes.filter((r) => r.includes(process.env.ONLY)) : routes;
const res = fs.existsSync(OUT) && !process.env.FRESH ? JSON.parse(fs.readFileSync(OUT)) : {};
const b = await chromium.launch();
const todo = only.filter((r) => !res[r]);
let i = 0;
async function worker() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('cc-lang', 'zh'); globalThis.__ccDocHook = (f) => { globalThis.__ccDocGet = f; }; });
  const p = await ctx.newPage();
  while (i < todo.length) {
    const r = todo[i++];
    try {
      await p.goto(BASE + r, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => typeof globalThis.__ccDocGet === 'function', null, { timeout: 15000 });
      await p.waitForTimeout(900);
      res[r] = await p.evaluate(() => { const d = globalThis.__ccDocGet(); globalThis.__ccDocGet = null; return d; });
    } catch (e) { console.log('ERR', r, String(e).slice(0, 120)); }
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: PAR }, worker));
await b.close();
fs.writeFileSync(OUT, JSON.stringify(res, null, 0));
console.log('docs', Object.keys(res).length, '/', routes.length);
