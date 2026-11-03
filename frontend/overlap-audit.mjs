// Mobile overlap audit: no toolbar / search / button / panel may intersect the demo stage.
// [BASE=..] [CAT=a,b] [ONLY=slug] [SHOTS=dir] node overlap-audit.mjs
// MODE=shell [SHOTS=dir] node overlap-audit.mjs   (app shell: header/search/menu/cards, 4 mobile viewports)
import { auditCats, registryCats } from './audit-cats.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:4179';
// MODE=shell -> app-shell audit (home/search/category/demo/menu at 390x844, 375x667, 360x740, landscape 844x390)
if (process.env.MODE === 'shell') { const { runShellAudit } = await import('./shell-audit.mjs'); const n = await runShellAudit(BASE, process.env.SHOTS); process.exit(n ? 1 : 0); }
const VPS = [[390, 844, '390'], [375, 667, '375']];
const cats = process.env.CAT ? auditCats({}) : registryCats();
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SHOTS = process.env.SHOTS; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const jobs = Object.entries(cats).flatMap(([c, l]) => l.map((s) => [c, s])).filter(([c, s]) => !only || only.includes(s) || only.includes(`${c}/${s}`));

const CHECK = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.right > 0 && r.left < innerWidth; };
  const stage = document.querySelector('.demo-mount .kit-stage') || document.querySelector('.demo-mount');
  if (!stage) return { err: 'no stage' };
  const sr = stage.getBoundingClientRect();
  const sel = '.topbar, .topbar input, .sidebar-search, .demo-toolbar, .demo-toolbar button, .fx-toolbar, .fx-toolbar button, .fx-ops, .fx-params, .kit-panel, button, input, select, [role=button], [role=search]';
  const hits = [];
  for (const el of document.querySelectorAll(sel)) {
    if (stage.contains(el) || el.contains(stage) || !vis(el)) continue;
    if (el.closest('.sidebar') && !document.querySelector('.sidebar.open, .sidebar-open, body.nav-open')) continue;
    const r = el.getBoundingClientRect();
    const ix = Math.min(r.right, sr.right) - Math.max(r.left, sr.left), iy = Math.min(r.bottom, sr.bottom) - Math.max(r.top, sr.top);
    if (ix > 2 && iy > 2) hits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || ''}${el.textContent ? '「' + el.textContent.trim().slice(0, 8) + '」' : ''} ${Math.round(ix)}×${Math.round(iy)}`);
  }
  // controls living inside the stage must not float over a canvas either
  const cvs = [...stage.querySelectorAll('canvas')].filter(vis).map((c) => c.getBoundingClientRect()).filter((r) => r.width * r.height > 8000);
  for (const el of stage.querySelectorAll('button, input, select, [role=button], .fx-bar, .btn-group')) {
    if (!vis(el) || el.closest('.mip')) continue;
    const r = el.getBoundingClientRect();
    for (const cr of cvs) {
      const ix = Math.min(r.right, cr.right) - Math.max(r.left, cr.left), iy = Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top);
      if (ix > 2 && iy > 2) { hits.push(`in-stage ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || ''}${el.textContent ? '「' + el.textContent.trim().slice(0, 8) + '」' : ''} ${Math.round(ix)}×${Math.round(iy)}`); break; }
    }
  }
  return { hits: [...new Set(hits)].slice(0, 6), stage: [Math.round(sr.x), Math.round(sr.y), Math.round(sr.width), Math.round(sr.height)] };
};

async function one(browser, c, s, [w, h, tag]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const path = `/${c}/${s}`; const fails = [];
  try {
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.demo-mount', { timeout: 15000 }); await p.waitForTimeout(1200);
    const states = [['load', async () => {}],
      ['scrolled', async () => { await p.evaluate(() => { const st = document.querySelector('.demo-mount .kit-stage') || document.querySelector('.demo-mount'); st.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(300); }],
      ['params', async () => { const b = p.locator('.fx-toolbar button, .demo-controls button').filter({ hasText: '参数' }).first(); if (await b.count()) { await b.tap({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(400); } }]];
    for (const [nm, fn] of states) {
      await fn(); const r = await p.evaluate(CHECK);
      if (r.err) fails.push(`${nm}: ${r.err}`); else if (r.hits.length) fails.push(`${nm}: ${r.hits.join(', ')}`);
      if (SHOTS && (r.hits?.length || process.env.ALLSHOTS)) await p.screenshot({ path: `${SHOTS}/${c}-${s}-${tag}-${nm}.png` });
    }
  } catch (e) { fails.push('exception: ' + String(e.message).split('\n')[0]); }
  await ctx.close();
  return { path, tag, fails };
}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const queue = jobs.flatMap(([c, s]) => VPS.map((v) => [c, s, v])); const res = [];
await Promise.all(Array.from({ length: +(process.env.W || 4) }, async () => { while (queue.length) { const [c, s, v] = queue.shift(); res.push(await one(browser, c, s, v)); } }));
res.sort((a, b) => (a.path + a.tag).localeCompare(b.path + b.tag));
let n = 0; const byCat = {};
for (const r of res) { const cat = r.path.split('/')[1]; byCat[cat] = byCat[cat] || 0; if (r.fails.length) { n++; byCat[cat]++; console.log(`FAIL ${r.path} ${r.tag}: ${r.fails.join(' | ')}`); } }
console.log('BYCAT ' + JSON.stringify(byCat));
console.log(`\n${jobs.length} demos, ${res.length} runs, ${n} overlapping runs`);
await browser.close(); process.exit(n ? 1 : 0);
