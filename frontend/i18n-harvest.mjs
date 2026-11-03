// en-mode i18n harvest: render every route with ?lang=en, record every tx() (zh→en) pair, leftover CJK in visible
// DOM text / attributes, and CJK drawn on canvas.  OUT=/path.json [W=1440] [ONLY=/x/y] node i18n-harvest.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import { registryCats } from './audit-cats.mjs';
import { BTN_CHECK } from './btn-check.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:4179', OUT = process.env.OUT || '/tmp/i18n-harvest.json';
const W = +(process.env.W || 1440), H = W < 900 ? 844 : 900, PAR = +(process.env.PAR || 4), WAIT = +(process.env.WAIT || 2200);
const cats = registryCats();
let routes = ['/', ...Object.keys(cats).map((c) => '/' + c), ...Object.entries(cats).flatMap(([c, ss]) => ss.map((s) => `/${c}/${s}`))];
if (process.env.ONLY) routes = process.env.ONLY.split(',');
const INIT = () => {
  window.__txlog = []; window.__cvzh = [];
  localStorage.setItem('cc-lang', 'en');
  const P = CanvasRenderingContext2D.prototype;
  for (const k of ['fillText', 'strokeText']) { const o = P[k]; P[k] = function (t, ...a) { if (typeof t === 'string' && /[\u3400-\u9fff]/.test(t) && window.__cvzh.length < 400) window.__cvzh.push(t); return o.call(this, t, ...a); }; }
};
const COLLECT = () => {
  const zh = /[\u3400-\u9fff]/;
  const dom = new Set(), attr = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const v = n.nodeValue || ''; if (!zh.test(v)) continue;
    const e = n.parentElement; if (!e || e.closest('script,style,noscript,[hidden]')) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    dom.add(v.trim().slice(0, 160) + (r.width < 1 ? ' {hidden}' : ''));
  }
  for (const e of document.querySelectorAll('[title],[placeholder],[aria-label],[alt],[data-tip]'))
    for (const a of ['title', 'placeholder', 'aria-label', 'alt', 'data-tip']) { const v = e.getAttribute(a); if (v && zh.test(v)) attr.add(a + '=' + v.slice(0, 120)); }
  return { tx: window.__txlog || [], cv: [...new Set(window.__cvzh || [])], dom: [...dom], attr: [...attr] };
};
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const res = {}; let i = 0;
async function worker() {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, locale: 'en-US', isMobile: W < 900, hasTouch: W < 900 });
  await ctx.addInitScript(INIT);
  let p = await ctx.newPage();
  while (i < routes.length) {
    const r = routes[i++];
    try {
      await p.goto(BASE + r + '?lang=en', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(WAIT);
      // nudge interactive demos: hover the stage centre and a corner
      const vp = await p.$('[data-demo-viewport]');
      if (vp) { const bb = await vp.boundingBox(); if (bb) { await p.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.height * 0.45); await p.waitForTimeout(300); await p.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height * 0.6); await p.waitForTimeout(400); } }
      // open every info-panel section (公式/说明/参数/用法) so their text is rendered too
      for (const ch of await p.$$('.mip-chip[aria-expanded="false"]')) { try { await ch.click({ timeout: 1500 }); } catch (_) {} }
      await p.waitForTimeout(350);
      res[r] = await p.evaluate(COLLECT);
      res[r].btn = await p.evaluate(BTN_CHECK);
    } catch (e) { res[r] = { err: String(e).slice(0, 200) }; try { await p.close(); } catch (_) {} p = await ctx.newPage(); }
    if (i % 25 === 0) process.stdout.write(`${i}/${routes.length}\n`);
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: PAR }, worker));
await b.close();
fs.writeFileSync(OUT, JSON.stringify(res));
const left = Object.entries(res).filter(([, v]) => v.err || v.dom?.length || v.cv?.length || v.attr?.length);
console.log('routes', routes.length, 'with CJK/err', left.length);
