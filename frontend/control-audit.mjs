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
async function cssVars(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.kit-inner') || document.querySelector('.fx-layout') || document.body;
    const s = getComputedStyle(el);
    return {
      c: s.getPropertyValue('--c').trim(),
      spd: s.getPropertyValue('--spd').trim(),
      sz: s.getPropertyValue('--sz').trim(),
      count: s.getPropertyValue('--count').trim(),
    };
  });
}

async function auditOne(browser, cat, slug, mobile) {
  const page = await browser.newPage(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1180, height: 740 } });
  const path = `/${cat}/${slug}`;
  const fails = [];
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 12000 });
    await page.waitForTimeout(700);
    try { await page.locator('.sidebar-close').click({ timeout: 400 }); } catch {}
    if (mobile) {
      try { await page.locator('.fx-ops-toggle').click({ timeout: 800 }); await page.waitForTimeout(200); } catch {}
    }

    const s0 = await canvasSig(page);
    await page.waitForTimeout(280);
    const s1 = await canvasSig(page);
    const drift = delta(s0, s1);

    // COLOR
    const col = await setParam(page, '颜色', '#ff2244');
    await page.waitForTimeout(350);
    const sCol = await canvasSig(page);
    const vCol = await cssVars(page);
    if (!col.ok) fails.push('color-missing');
    if (vCol.c && vCol.c.toLowerCase() !== '#ff2244') fails.push(`color-var:${vCol.c}`);
    if (delta(s1, sCol) < Math.max(1.8, drift * 0.9) && Math.abs((sCol?.r || 0) - (s1?.r || 0)) < 1.5) fails.push('color-visual');

    // SIZE
    await setParam(page, '尺寸', '0.5');
    await page.waitForTimeout(280);
    const z0 = await canvasSig(page);
    await setParam(page, '尺寸', '2');
    await page.waitForTimeout(350);
    const z1 = await canvasSig(page);
    const vz = await cssVars(page);
    if (vz.sz !== '2' && vz.sz !== '2.0') fails.push(`size-var:${vz.sz}`);
    if (delta(z0, z1) < Math.max(1.2, drift * 0.8) && z0?.h === z1?.h) fails.push('size-visual');

    // SPEED (CSS var must update; visual optional if demo uses tt)
    await setParam(page, '速度', '2.5');
    await page.waitForTimeout(200);
    const vs = await cssVars(page);
    if (vs.spd !== '2.5' && vs.spd !== '2.50') fails.push(`speed-var:${vs.spd}`);

    // COUNT
    await setParam(page, '数量', '5');
    await page.waitForTimeout(450);
    const c0 = await canvasSig(page);
    const vc0 = await cssVars(page);
    await setParam(page, '数量', '48');
    await page.waitForTimeout(550);
    const c1 = await canvasSig(page);
    const vc1 = await cssVars(page);
    if (vc1.count !== '48') fails.push(`count-var:${vc1.count}`);
    // trig-waves remounts on count but visual may be subtle; require var + (visual or remount side-effect)
    if (slug !== 'trig-waves' && delta(c0, c1) < 0.8 && c0?.h === c1?.h) fails.push('count-visual');
    if (slug === 'trig-waves' && vc0.count === vc1.count) fails.push('count-var-stuck');

    // PRESET
    const btns = page.locator('.preset-btn');
    const nBtn = await btns.count();
    if (nBtn > 1) {
      const p0 = await canvasSig(page);
      await btns.nth(Math.min(1, nBtn - 1)).click();
      await page.waitForTimeout(550);
      const p1 = await canvasSig(page);
      const vp = await cssVars(page);
      const on = (await page.locator('.preset-btn.on').first().textContent()) || '';
      // presetDefaults usually change size/speed/count — require var change OR visual
      const varsMoved = vp.sz !== '2' || vp.spd !== '2.5' || vp.count !== '48';
      if (!varsMoved && delta(p0, p1) < Math.max(1.0, drift) && p0?.h === p1?.h) fails.push(`preset:${on.trim()}`);
    }

    return { path, mobile, ok: fails.length === 0, fails };
  } catch (e) {
    return { path, mobile, ok: false, fails: [`ex:${String(e).slice(0, 140)}`] };
  } finally {
    await page.close();
  }
}

async function dragSmoke(browser) {
  const targets = [['math','pythagoras'],['math','unit-circle'],['math','vectors'],['math','linear']];
  const out = [];
  for (const [cat, slug] of targets) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    try {
      await page.goto(`${BASE}/${cat}/${slug}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForTimeout(800);
      const before = await canvasSig(page);
      const box = await page.locator('canvas').first().boundingBox();
      // aim near typical handle: vectors tip ~0.49/0.46, pythagoras A ~0.42/0.68, unit-circle right, linear pan anywhere
      const aim = {
        pythagoras: [0.42, 0.68],
        'unit-circle': [0.22, 0.42],
        vectors: [0.49, 0.46],
        linear: [0.55, 0.55],
      }[slug] || [0.4, 0.5];
      const x0 = box.x + box.width * aim[0], y0 = box.y + box.height * aim[1];
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x0 + 110, y0 - 70, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(350);
      const after = await canvasSig(page);
      out.push({ slug, ok: delta(before, after) > 0.6 || before?.h !== after?.h, d: delta(before, after) });
    } catch (e) {
      out.push({ slug, ok: false, fails: String(e).slice(0, 100) });
    } finally { await page.close(); }
  }
  return out;
}

async function redirectCheck(browser) {
  const page = await browser.newPage();
  await page.goto(`${BASE}/threejs/trig-waves`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const url = page.url();
  await page.close();
  return { ok: url.includes('/math/trig-waves'), url };
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const jobs = [];
for (const mobile of [false, true]) {
  for (const slug of MATH) jobs.push(['math', slug, mobile]);
  for (const slug of CONVERT) jobs.push(['convert', slug, mobile]);
}

const results = [];
const concurrency = 3;
let i = 0;
async function worker() {
  while (i < jobs.length) {
    const idx = i++;
    const [cat, slug, mobile] = jobs[idx];
    const r = await auditOne(browser, cat, slug, mobile);
    results.push(r);
    if (!r.ok) console.error('FAIL', r.path, mobile ? 'm390' : 'desk', r.fails.join(','));
    else process.stdout.write('.');
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log('');
const drags = await dragSmoke(browser);
const redirect = await redirectCheck(browser);
await browser.close();
const failed = results.filter((r) => !r.ok);
const summary = {
  total: results.length,
  failed: failed.length,
  pass: results.length - failed.length,
  failures: failed,
  drags,
  redirect,
};
console.log(JSON.stringify(summary, null, 2));
