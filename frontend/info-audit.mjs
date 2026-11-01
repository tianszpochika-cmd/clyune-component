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

async function canvasSig(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.kit-stage canvas, .kit-inner canvas, canvas');
    if (!canvas) return null;
    const w = Math.min(200, canvas.width), h = Math.min(140, canvas.height);
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const o = off.getContext('2d');
    try { o.drawImage(canvas, 0, 0, w, h); } catch { return null; }
    const d = o.getImageData(0, 0, w, h).data;
    let h1 = 2166136261, r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 20) {
      h1 ^= d[i]; h1 = Math.imul(h1, 16777619);
      h1 ^= d[i + 1]; h1 = Math.imul(h1, 16777619);
      h1 ^= d[i + 2]; h1 = Math.imul(h1, 16777619);
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    return { h: h1 >>> 0, r: r / n, g: g / n, b: b / n };
  });
}
function delta(a, b) {
  if (!a || !b) return 999;
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) + (a.h === b.h ? 0 : 6);
}
async function setParam(page, keyOrLabel, value) {
  return page.evaluate(({ keyOrLabel, value }) => {
    const nodes = [...document.querySelectorAll('.fx-ops .param, .fx-ops label, .fx-ops-body .param')];
    for (const p of nodes) {
      const text = p.textContent || '';
      const input = p.querySelector('input[data-k], input[type=range], input[type=color]');
      if (!input) continue;
      const k = input.getAttribute('data-k') || '';
      if (!text.includes(keyOrLabel) && k !== keyOrLabel) continue;
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      desc.set.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, k: k || keyOrLabel, v: input.value };
    }
    return { ok: false };
  }, { keyOrLabel, value });
}

const rowsText = (page) => page.evaluate(() => [...document.querySelectorAll('.mip [data-mip-rows] .mip-row')].map((r) => r.textContent.trim()).join(' | '));
const ixSig = (page) => page.evaluate(() => document.querySelector('.mip')?.dataset.ix || '');

async function auditOne(browser, cat, slug, mobile) {
  const page = await browser.newPage(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1180, height: 740 } });
  const path = `/${cat}/${slug}`;
  const fails = [];
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.mip', { timeout: 12000 });
    await page.waitForTimeout(700);
    try { await page.locator('.sidebar-close').click({ timeout: 300 }); } catch {}
    await page.locator('.mip-canvas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const r0 = await rowsText(page);
    const nRows = await page.locator('.mip [data-mip-rows] .mip-row').count();
    if (nRows < 2 || r0.length < 8) fails.push(`readout empty (${nRows} rows)`);
    if (/NaN|undefined|null/.test(r0)) fails.push(`readout has NaN/undefined: ${r0.slice(0, 120)}`);
    // layout
    const geo = await page.evaluate(() => {
      const c = document.querySelector('.mip-canvas').getBoundingClientRect();
      const m = document.querySelector('.mip').getBoundingClientRect();
      const cv = document.querySelector('.mip-canvas canvas')?.getBoundingClientRect();
      return { c: [c.left, c.top, c.right, c.bottom], m: [m.left, m.top, m.right, m.bottom], cv: cv && [cv.width, cv.height] };
    });
    const ov = Math.max(0, Math.min(geo.c[2], geo.m[2]) - Math.max(geo.c[0], geo.m[0])) * Math.max(0, Math.min(geo.c[3], geo.m[3]) - Math.max(geo.c[1], geo.m[1]));
    if (ov > 4) fails.push(`panel overlaps canvas (${Math.round(ov)}px²)`);
    if (!geo.cv || geo.cv[0] < 150 || geo.cv[1] < 150) fails.push(`canvas too small ${JSON.stringify(geo.cv)}`);
    if (mobile && geo.m[2] - geo.m[0] > 391) fails.push('panel wider than viewport');
    // drag
    const ix0 = await ixSig(page);
    const hd = await page.evaluate(() => document.querySelector('.mip')?.dataset.handle || '');
    const [hx, hy] = hd.split(',').map(Number);
    const box = await page.locator('.mip-canvas').boundingBox();
    if (!Number.isFinite(hx)) fails.push('no data-handle');
    else {
      const sx = box.x + hx, sy = box.y + hy;
      const r1 = await rowsText(page);
      await page.mouse.move(sx, sy); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(sx + i * 7, sy - i * 3.5); await page.waitForTimeout(30); }
      const mid = await rowsText(page);
      await page.mouse.up();
      await page.waitForTimeout(250);
      const ix1 = await ixSig(page);
      const r2 = await rowsText(page);
      if (ix1 === ix0) fails.push(`drag did not change interaction state (handle ${hd})`);
      if (r2 === r1 && mid === r1) fails.push('drag did not change readout');
    }
    // slider
    if (mobile) { try { await page.locator('.fx-ops-toggle').click({ timeout: 800 }); await page.waitForTimeout(200); } catch {} }
    const before = await rowsText(page);
    const sp = await setParam(page, '尺寸', 1.7);
    await page.waitForTimeout(450);
    const after = await rowsText(page);
    if (!sp.ok) fails.push('no size slider');
    else if (after === before) fails.push('size slider did not change readout');
    if (mobile) { try { await page.locator('.fx-ops-toggle').click({ timeout: 800 }); await page.waitForTimeout(200); } catch {} }
    // chips
    const chips = page.locator('.mip .mip-chip');
    const nc = await chips.count();
    if (nc < 4) fails.push(`only ${nc} chips`);
    for (let i = 0; i < nc; i++) {
      const ch = chips.nth(i);
      const k = await ch.getAttribute('data-mip-chip');
      await ch.click();
      await page.waitForTimeout(120);
      const st = await page.evaluate((k) => {
        const s = document.querySelector(`.mip [data-mip-sec="${k}"]`);
        const c = document.querySelector(`.mip [data-mip-chip="${k}"]`);
        return { open: s && !s.hidden && s.offsetHeight > 0, len: (s?.querySelector('[data-mip-body]')?.textContent || '').trim().length, aria: c.getAttribute('aria-expanded'), bad: /NaN|undefined/.test(s?.textContent || '') };
      }, k);
      if (!st.open || st.aria !== 'true') fails.push(`chip ${k} did not open`);
      if (st.len < 10) fails.push(`chip ${k} body empty`);
      if (st.bad) fails.push(`chip ${k} has NaN/undefined`);
      await ch.click();
      await page.waitForTimeout(100);
      const closed = await page.evaluate((k) => document.querySelector(`.mip [data-mip-sec="${k}"]`)?.hidden, k);
      if (!closed) fails.push(`chip ${k} did not close`);
    }
    if (errs.length) fails.push('pageerror: ' + errs.slice(0, 2).join(' / '));
  } catch (e) {
    fails.push('exception: ' + e.message.split('\n')[0]);
  }
  await page.close();
  return { path, mobile, fails };
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const jobs = [...MATH.map((s) => ['math', s]), ...CONVERT.map((s) => ['convert', s])].filter(([c, s]) => !only || only.includes(s) || only.includes(`${c}/${s}`));
const modes = process.env.MODE === 'd' ? [false] : process.env.MODE === 'm' ? [true] : [false, true];
let total = 0, failed = 0;
const queue = [];
for (const [c, s] of jobs) for (const m of modes) queue.push([c, s, m]);
const results = [];
const W = 4;
await Promise.all(Array.from({ length: W }, async () => {
  while (queue.length) { const [c, s, m] = queue.shift(); results.push(await auditOne(browser, c, s, m)); }
}));
results.sort((a, b) => a.path.localeCompare(b.path) || a.mobile - b.mobile);
for (const r of results) {
  total++;
  if (r.fails.length) { failed++; console.log(`FAIL ${r.path} ${r.mobile ? '390' : 'desk'}: ${r.fails.join('; ')}`); }
}
console.log(`\n${jobs.length} demos, ${total} runs, ${failed} failing runs, ${results.reduce((a, r) => a + r.fails.length, 0)} fails`);
await browser.close();
