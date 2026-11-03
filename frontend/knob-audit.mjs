import { auditCats } from './audit-cats.mjs';
import { enableAutoDemo } from './audit-auto.mjs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4179';
const MATH = [
  'pythagoras','similar-tri','circle-angles','area-volume','coord-geo','conics',
  'linear','quadratic','exp-log','power','piecewise','parametric','polar',
  'trig-waves','unit-circle','trig-id','law-sine',
  'limit','derivative','integral','taylor',
  'vectors','matrix-2d','determinant','eigen',
  'venn','combinatorics','sequence','shortest-path','modular',
  'binomial','normal','clt',
];
const CONVERT = ['temperature','timezone','mass','length','area-volume','radix','speed','pressure','energy'];

const CLOCK = () => {
  const realNow = performance.now.bind(performance);
  const raf = window.requestAnimationFrame.bind(window);
  let vt = realNow(), lastReal = realNow();
  const adv = () => { const r = realNow(); if (!window.__freeze) vt += r - lastReal; lastReal = r; return vt; };
  performance.now = adv;
  window.requestAnimationFrame = (cb) => raf(() => cb(adv()));
};
async function canvasSig(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.mip-canvas canvas, .kit-stage canvas, canvas');
    if (!canvas || !canvas.width) return null;
    const w = 96, h = 64;
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const o = off.getContext('2d');
    try { o.drawImage(canvas, 0, 0, w, h); } catch { return null; }
    return Array.from(o.getImageData(0, 0, w, h).data.filter((_, i) => i % 4 !== 3));
  });
}
// mean abs channel diff ×10 (0..2550)
function delta(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return (s / a.length) * 10;
}
const freeze = (page, on) => page.evaluate((on) => { window.__freeze = on; }, on);
async function motion(page) { const a = await canvasSig(page); await page.waitForTimeout(350); const b = await canvasSig(page); return delta(a, b); }
const rowsArr = (page) => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.mip [data-mip-rows] .mip-row')];
  return rows.filter((r) => !/^控件/.test(r.querySelector('dt')?.textContent || ''))
    .map((r) => r.textContent.trim());
});

async function listControls(page) {
  return page.evaluate(() => [...document.querySelectorAll('.fx-ops .param [data-k]')].map((el) => {
    const label = el.closest('.param')?.querySelector('.param-label')?.textContent?.trim() || el.getAttribute('data-k');
    return {
      key: el.getAttribute('data-k'),
      label,
      type: el.type || el.tagName.toLowerCase(),
      value: el.type === 'checkbox' ? el.checked : el.value,
    };
  }));
}

async function setControl(page, c) {
  return page.evaluate((c) => {
    const el = document.querySelector(`.fx-ops .param [data-k="${c.key}"]`);
    if (!el) return { ok: false };
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (c.type === 'checkbox') {
      el.checked = !el.checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, v: el.checked };
    }
    if (c.type === 'color') {
      const cur = (el.value || '#818cf8').toLowerCase();
      const next = cur === '#f472b6' ? '#22d3ee' : '#f472b6';
      desc.set.call(el, next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, v: el.value };
    }
    const min = parseFloat(el.min), max = parseFloat(el.max), cur = parseFloat(el.value);
    const span = (max - min) || 1;
    let next = cur + span * 0.45;
    if (next > max - span * 0.05) next = min + span * 0.15;
    if (c.force === 'min') next = min;
    if (c.force === 'max') next = max;
    if (el.step && Number(el.step) >= 1) next = Math.round(next);
    next = Math.max(min, Math.min(max, next));
    desc.set.call(el, String(next));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, v: el.value };
  }, c);
}

async function auditOne(browser, cat, slug) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 740 } });
  await enableAutoDemo(ctx);
  await ctx.addInitScript(CLOCK);
  const page = await ctx.newPage();
  const path = `/${cat}/${slug}`;
  const fails = [];
  const knobs = [];
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.mip, canvas', { timeout: 12000 });
    await page.waitForTimeout(600);
    try { await page.locator('.sidebar-close').click({ timeout: 300 }); } catch {}
    const collapsed = await page.evaluate(() => document.querySelector('.fx-layout')?.classList.contains('ops-collapsed'));
    if (collapsed) { try { await page.locator('.fx-ops-toggle').click({ timeout: 800 }); await page.waitForTimeout(200); } catch {} }

    const controls = await listControls(page);
    if (!controls.length) fails.push('no visible controls');
    for (const c of controls) {
      knobs.push(`${c.key}:${c.label}`);
      // frozen clock: animation can't move pixels, so any change is the control's doing
      await freeze(page, true); await page.waitForTimeout(250);
      const r1 = await rowsArr(page); const s1 = await canvasSig(page);
      await page.waitForTimeout(200);
      const s1b = await canvasSig(page);
      const noise = delta(s1, s1b);
      let set;
      let moving = null;
      if (c.key === 'speed') {
        // speed: compare motion at low vs high speed with the clock running
        await freeze(page, false);
        await setControl(page, { ...c, force: 'min' });
        await page.waitForTimeout(300);
        const mLo = await motion(page);
        set = await setControl(page, { ...c, force: 'max' });
        await page.waitForTimeout(300);
        const mHi = await motion(page);
        moving = { mLo, mHi };
        await freeze(page, true);
      } else {
        set = await setControl(page, c);
      }
      await page.waitForTimeout(c.key === 'count' || c.type === 'checkbox' ? 700 : 450);
      const r2 = await rowsArr(page); const s2 = await canvasSig(page);
      await freeze(page, false);
      const rowsChanged = r2.length !== r1.length || r2.some((v, i) => v !== r1[i]);
      const d = delta(s1, s2);
      const canvasChanged = d > Math.max(0.3, noise * 3);
      const speedOk = moving && moving.mHi > Math.max(1, moving.mLo * 1.3);
      if (!set.ok) fails.push(`could not set ${c.key}`);
      else if (!(rowsChanged || canvasChanged || speedOk)) {
        fails.push(`dead control ${c.key} (${c.label}) Δ=${d.toFixed(1)} noise=${noise.toFixed(1)}${moving ? ` motion lo/hi=${moving.mLo.toFixed(1)}/${moving.mHi.toFixed(1)}` : ''}`);
      }
    }
    const hasCtl = await page.evaluate(() => [...document.querySelectorAll('.mip dt')].some((d) => d.textContent.trim() === '控件'));
    if (hasCtl) fails.push('legacy 控件 mirror row still present');
  } catch (e) {
    fails.push('exception: ' + e.message.split('\n')[0]);
  }
  await ctx.close();
  return { path, knobs, fails };
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const jobs = Object.entries(auditCats({ math: MATH, convert: CONVERT })).flatMap(([c, l]) => l.map((s) => [c, s]))
  .filter(([c, s]) => !only || only.includes(s) || only.includes(`${c}/${s}`));
const queue = [...jobs];
const results = [];
const W = 3;
await Promise.all(Array.from({ length: W }, async () => {
  while (queue.length) {
    const [c, s] = queue.shift();
    results.push(await auditOne(browser, c, s));
  }
}));
results.sort((a, b) => a.path.localeCompare(b.path));
let failed = 0;
const report = {};
for (const r of results) {
  report[r.path] = r.knobs;
  if (r.fails.length) { failed++; console.log(`FAIL ${r.path}: ${r.fails.join('; ')}`); }
  else console.log(`OK   ${r.path}: [${r.knobs.join(', ')}]`);
}
console.log(`\n${jobs.length} demos, ${failed} failing`);
console.log('REPORT_JSON ' + JSON.stringify(report));
await browser.close();
process.exit(failed ? 1 : 0);
