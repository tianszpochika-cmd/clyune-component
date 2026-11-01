// Motion health audit: flicker / freeze / jank / canvas clear-resize, desktop + 390.
// Usage: BASE=... ONLY=slug,slug MODE=d|m node motion-audit.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:4179';
const OUT_DIR = process.env.OUT || '/workspace/clyune-component/tmp/motion';
const DUR = Number(process.env.DUR || 6000);
const FPS = 30;
const MATH = ['pythagoras','similar-tri','circle-angles','area-volume','coord-geo','conics','linear','quadratic','exp-log','power','piecewise','parametric','polar','trig-waves','unit-circle','trig-id','law-sine','limit','derivative','integral','taylor','vectors','matrix-2d','determinant','eigen','venn','combinatorics','sequence','shortest-path','modular','binomial','normal','clt'];
const CONVERT = ['temperature','timezone','mass','length','area-volume','radix','speed','pressure','energy'];
const CATS = process.env.CATS ? JSON.parse(process.env.CATS) : { math: MATH, convert: CONVERT };

// injected before page scripts: rAF frame-time recorder + canvas resize/clear watcher
const INIT = () => {
  window.__mo = { ft: [], resizes: 0, rafPerFrame: [], last: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  let pending = 0;
  window.requestAnimationFrame = (cb) => { pending++; return raf((t) => { pending--; cb(t); }); };
  const tick = (t) => {
    const m = window.__mo;
    if (m.last) m.ft.push(t - m.last);
    m.last = t;
    m.rafPerFrame.push(pending);
    raf(tick);
  };
  raf(tick);
  const desc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
    get() { return desc.get.call(this); },
    set(v) { if (this.isConnected && desc.get.call(this) !== v && window.__mo.armed) window.__mo.resizes++; desc.set.call(this, v); },
  });
};

async function grab(page) {
  return page.evaluate(() => {
    const c = document.querySelector('.mip-canvas canvas') || document.querySelector('.kit-stage canvas') || document.querySelector('canvas');
    if (!c || !c.width) return null;
    const w = 64, h = 48;
    const o = (window.__moOff ||= document.createElement('canvas')); o.width = w; o.height = h;
    const x = o.getContext('2d', { willReadFrequently: true });
    try { x.drawImage(c, 0, 0, w, h); } catch { return null; }
    const d = x.getImageData(0, 0, w, h).data;
    let lum = 0, hsh = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; lum += l; hsh = (hsh * 31 + (l | 0)) >>> 0; }
    return { lum: lum / (w * h), hsh, cw: c.width, ch: c.height };
  });
}

async function runPhase(page, phase, box, sweep) {
  const frames = [];
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < DUR) {
    if (sweep) await sweep(i, (Date.now() - t0) / DUR);
    const f = await grab(page);
    if (f) frames.push({ ...f, t: Date.now() - t0 });
    i++;
    const wait = Math.max(0, i * (1000 / FPS) - (Date.now() - t0));
    if (wait) await page.waitForTimeout(wait);
  }
  return frames;
}

function analyze(frames, { expectMotion }) {
  const flags = [];
  if (frames.length < 20) { flags.push(`only ${frames.length} frames captured`); return flags; }
  // (a) flicker: luminance spike then recovery, or blank/white frames
  let spikes = 0, blanks = 0;
  for (let k = 1; k < frames.length - 1; k++) {
    const a = frames[k - 1].lum, b = frames[k].lum, c = frames[k + 1].lum;
    if (Math.abs(b - a) > 18 && Math.abs(c - a) < 6) spikes++;
    if ((b < 1.5 && a > 6) || (b > 240 && a < 200)) blanks++;
  }
  if (spikes) flags.push(`flicker: ${spikes} luminance spike(s)`);
  if (blanks) flags.push(`flicker: ${blanks} blank/white frame(s)`);
  // (b) freeze: identical hash > 1s while motion expected
  if (expectMotion) {
    let run = 0, maxRun = 0;
    for (let k = 1; k < frames.length; k++) {
      if (frames[k].hsh === frames[k - 1].hsh) { run += frames[k].t - frames[k - 1].t; maxRun = Math.max(maxRun, run); } else run = 0;
    }
    if (maxRun > 1000) flags.push(`freeze: ${(maxRun / 1000).toFixed(1)}s static`);
  }
  // (d) canvas size changes
  const sizes = new Set(frames.map((f) => `${f.cw}x${f.ch}`));
  if (sizes.size > 1) flags.push(`canvas resized mid-run: ${[...sizes].join(' → ')}`);
  return flags;
}

async function auditOne(browser, cat, slug, mobile) {
  const tag = `${cat}-${slug}-${mobile ? 'm390' : 'desk'}`;
  const vidDir = path.join(OUT_DIR, '_raw', tag);
  fs.mkdirSync(vidDir, { recursive: true });
  const vp = mobile ? { width: 390, height: 844 } : { width: 1180, height: 740 };
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, recordVideo: { dir: vidDir, size: { width: Math.round(vp.width / 2) * 2 > 800 ? 800 : vp.width, height: mobile ? 844 : 500 } } });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const flags = [];
  try {
    await page.goto(`${BASE}/${cat}/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 12000 });
    await page.waitForTimeout(900);
    await page.locator('.mip-canvas, .kit-stage').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.evaluate(() => { window.__mo.ft = []; window.__mo.rafPerFrame = []; window.__mo.armed = true; window.__mo.resizes = 0; });
    // idle
    const idle = await runPhase(page, 'idle', null, null);
    const idleHashes = new Set(idle.map((f) => f.hsh)).size;
    const expectMotion = idleHashes > idle.length * 0.3; // animated demo
    flags.push(...analyze(idle, { expectMotion }).map((f) => `idle ${f}`));
    // interaction: drag across canvas + sweep the first range param
    const box = await page.locator('.mip-canvas, .kit-stage').first().boundingBox();
    const hd = await page.evaluate(() => document.querySelector('.mip')?.dataset.handle || '');
    let [hx, hy] = hd.split(',').map(Number);
    if (!Number.isFinite(hx)) { hx = box.width / 2; hy = box.height / 2; }
    let down = false;
    const sweep = async (i, f) => {
      if (f < 0.5) {
        const x = box.x + hx + Math.sin(f * Math.PI * 4) * Math.min(80, box.width * 0.2);
        const y = box.y + hy + Math.cos(f * Math.PI * 4) * Math.min(40, box.height * 0.1);
        if (!down) { await page.mouse.move(box.x + hx, box.y + hy); await page.mouse.down(); down = true; }
        await page.mouse.move(x, y);
      } else {
        if (down) { await page.mouse.up(); down = false; }
        if (i % 3 === 0) await page.evaluate((f) => {
          const el = [...document.querySelectorAll('.fx-ops .param input[type=range]')][0];
          if (!el) return;
          const min = +el.min, max = +el.max;
          const v = min + (max - min) * (0.5 + 0.5 * Math.sin(f * Math.PI * 4));
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, f);
      }
    };
    await page.evaluate(() => { window.__moCv = document.querySelector('.mip-canvas canvas, .kit-stage canvas, canvas'); window.__moSwaps = 0; window.__moT = setInterval(() => { const c = document.querySelector('.mip-canvas canvas, .kit-stage canvas, canvas'); if (c !== window.__moCv) { window.__moSwaps++; window.__moCv = c; } }, 50); });
    const act = await runPhase(page, 'interact', box, sweep);
    const swaps = await page.evaluate(() => { clearInterval(window.__moT); return window.__moSwaps; });
    if (swaps > 2) flags.push(`canvas remounted ${swaps}x during slider sweep (state reset / flash)`);
    if (down) await page.mouse.up();
    flags.push(...analyze(act, { expectMotion: false }).map((f) => `interact ${f}`));
    var stat = { idleFrames: idle.length, actFrames: act.length, idleDistinct: idleHashes, expectMotion };
    // (c) jank + double loops + (d) resizes from instrumented page
    const mo = await page.evaluate(() => ({ ft: window.__mo.ft, resizes: window.__mo.resizes, rp: window.__mo.rafPerFrame }));
    const ft = mo.ft.filter((x) => x > 0);
    const spikes = ft.filter((x) => x > 50).length;
    const pct = ft.length ? spikes / ft.length : 0;
    // headless swiftshader is noisy: flag only sustained jank
    if (spikes > 6 && pct > 0.03) flags.push(`jank: ${spikes}/${ft.length} rAF frames >50ms (max ${Math.max(...ft).toFixed(0)}ms)`);
    const sorted = [...mo.rp].sort((a, b) => a - b);
    const medPending = sorted[Math.floor(sorted.length / 2)] || 0;
    if (medPending > 1) flags.push(`possible duplicate rAF loops: median ${medPending} pending callbacks/frame`);
    if (mo.resizes > 2) flags.push(`canvas width reset ${mo.resizes}x during run (clears canvas)`);
    if (errs.length) flags.push('pageerror: ' + errs.slice(0, 2).join(' / '));
    stat.rafFrames = ft.length; stat.maxFt = Math.round(Math.max(0, ...ft)); stat.p95 = Math.round([...ft].sort((a, b) => a - b)[Math.floor(ft.length * 0.95)] || 0); stat.resizes = mo.resizes; stat.pending = medPending;
    if (process.env.DEBUG) console.log('STAT', `/${cat}/${slug}`, mobile ? '390' : 'desk', JSON.stringify(stat));
  } catch (e) {
    flags.push('exception: ' + e.message.split('\n')[0]);
  }
  const video = page.video();
  await ctx.close();
  let clip = null;
  try {
    const src = await video.path();
    if (flags.length) {
      clip = path.join(OUT_DIR, `${tag}.webm`);
      fs.copyFileSync(src, clip);
    }
  } catch {}
  fs.rmSync(vidDir, { recursive: true, force: true });
  return { path: `/${cat}/${slug}`, mobile, flags, clip };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const modes = process.env.MODE === 'd' ? [false] : process.env.MODE === 'm' ? [true] : [false, true];
const queue = [];
for (const [cat, list] of Object.entries(CATS)) for (const s of list) if (!only || only.includes(s) || only.includes(`${cat}/${s}`)) for (const m of modes) queue.push([cat, s, m]);
const total = queue.length;
const results = [];
const W = Number(process.env.W || 3);
await Promise.all(Array.from({ length: W }, async () => { while (queue.length) { const [c, s, m] = queue.shift(); results.push(await auditOne(browser, c, s, m)); } }));
results.sort((a, b) => a.path.localeCompare(b.path) || a.mobile - b.mobile);
let flagged = 0;
for (const r of results) if (r.flags.length) { flagged++; console.log(`FLAG ${r.path} ${r.mobile ? '390' : 'desk'}: ${r.flags.join('; ')}${r.clip ? `  [${r.clip}]` : ''}`); }
console.log(`\n${total} runs, ${flagged} flagged`);
await browser.close();
