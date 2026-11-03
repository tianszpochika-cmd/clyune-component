// Throttled-network stage audit: no demo stage may sit blank/black while loading.
// [BASE=..] [KBPS=400] [LAT=400] [VPS=390,1440] [ONLY=cat/slug,..] [SHOTS=dir] node slow-audit.mjs
// Per demo: goto under CDP throttling, sample every 250ms until the loader is gone (max 60s).
// Fail if any sample shows neither a visible .stage-loader nor a painted stage (non-dark pixels in the stage screenshot).
import { chromium } from 'playwright';
import { registryCats } from './audit-cats.mjs';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:4179';
const KBPS = +(process.env.KBPS || 400), LAT = +(process.env.LAT || 400);
const VPS = (process.env.VPS || '390,1440').split(',').map((k) => ({ 390: [390, 844], 1440: [1440, 900] })[k]);
const SHOTS = process.env.SHOTS; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const cats = registryCats();
const jobs = process.env.ONLY ? process.env.ONLY.split(',') : Object.entries(cats).map(([c, l]) => `${c}/${l[0]}`);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
let fails = 0; const rows = [];
for (const path of jobs) for (const [w, h] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LAT, downloadThroughput: KBPS * 1024 / 8, uploadThroughput: KBPS * 1024 / 8 });
  const t0 = Date.now(); const bad = []; let sawLoader = false, done = -1, maxPct = 0, steps = new Set();
  p.goto(BASE + '/' + path).catch(() => {});
  let i = 0;
  while (Date.now() - t0 < 60000) {
    await p.waitForTimeout(250); i++;
    const st = await p.evaluate(() => {
      const host = document.querySelector('.canvas-host'); const l = document.querySelector('.stage-loader');
      const boot = !!document.getElementById('boot');
      const lv = !!l && !l.classList.contains('out');
      return { mounted: !!document.querySelector('.demo-mount')?.children.length, host: !!host, boot, loader: !!lv, err: !!document.querySelector('.stage-loader.err'), step: l?.querySelector('.sl-step')?.textContent || '', pct: parseInt(l?.querySelector('.sl-meta span')?.textContent || '0') };
    }).catch(() => ({ host: false, boot: true, loader: false }));
    if (st.loader) { sawLoader = true; steps.add(st.step); maxPct = Math.max(maxPct, st.pct || 0); }
    if (st.err) { bad.push('error state'); break; }
    if (st.host && !st.loader && st.mounted) { done = Date.now() - t0; break; }
    if (!st.boot && !st.host && !st.loader && Date.now() - t0 > 400) bad.push('no boot splash and no stage');
    if (st.host && !st.loader && !st.mounted) bad.push(`blank stage at ${Date.now() - t0}ms (no loader, nothing mounted)`);
    if (SHOTS && (i === 4 || i % 12 === 0)) await p.screenshot({ path: `${SHOTS}/${path.replace('/', '_')}-${w}-t${String(Date.now() - t0).padStart(5, '0')}.png` }).catch(() => {});
  }
  if (done < 0 && !bad.length) bad.push('loader never finished in 60s');
  // painted check: stage screenshot must not be (near) uniformly dark
  let lit = 0;
  if (done >= 0) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await p.waitForTimeout(600);
    const bb = await p.evaluate(() => { const r = document.querySelector('.canvas-host')?.getBoundingClientRect(); return r && r.width > 4 ? { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, innerWidth - Math.max(0, r.x)), height: Math.min(r.height, innerHeight - Math.max(0, r.y)) } : null; });
    if (process.env.DBG) console.log("bb", JSON.stringify(bb));
    const buf = bb && bb.height > 4 ? await p.screenshot({ clip: bb, timeout: 10000 }).catch((e) => { console.log("shot err", String(e.message).slice(0, 120)); return null; }) : null;
    if (SHOTS && buf) fs.writeFileSync(`${SHOTS}/${path.replace('/', '_')}-${w}-final.png`, buf);
    lit = await p.evaluate(async (b64) => {
      if (!b64) return 0; const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = 120; c.height = Math.max(1, Math.round(120 * img.height / img.width));
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] > 90) n++; return n / (d.length / 4);
    }, buf ? buf.toString('base64') : '');
    if (lit < 0.01) bad.push(`blank stage after load (lit ${(lit * 100).toFixed(2)}%)`);
  }
  if (!sawLoader && done > 1200) bad.push('no loader shown during a slow load');
  if (bad.length) fails++;
  const line = `${bad.length ? 'FAIL' : 'ok  '} /${path} ${w}: ready ${done < 0 ? '—' : (done / 1000).toFixed(1) + 's'} loader=${sawLoader} steps=[${[...steps].join('|')}] max=${maxPct}% lit=${(lit * 100).toFixed(1)}% ${bad.join('; ')}`;
  console.log(line); rows.push(line);
  await ctx.close();
}
console.log(`\nSLOW ${KBPS}kbps/${LAT}ms: ${rows.length} runs, ${fails} failing`);
await b.close(); process.exit(fails ? 1 : 0);
