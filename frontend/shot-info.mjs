import { chromium } from 'playwright';
const [,, slug = 'math/pythagoras', tag = 'x'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
for (const [name, vp, mobile] of [['d', { width: 1280, height: 800 }, false], ['m', { width: 390, height: 844 }, true]]) {
  const p = await b.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:4179/${slug}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.mip', { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(800);
  const chip = p.locator('.mip-chip').nth(3); if (await chip.count()) await chip.click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `/workspace/clyune-component/tmp/info-${tag}-${name}.png` });
  const info = await p.evaluate(() => { const s = document.querySelector('.kit-stage')?.getBoundingClientRect(); const c = document.querySelector('.mip-canvas')?.getBoundingClientRect(); const m = document.querySelector('.mip')?.getBoundingClientRect(); return { s: s && [s.width, s.height], c: c && [c.width, c.height], m: m && [m.width, m.height] }; });
  console.log(name, JSON.stringify(info), errs.join('|'));
  await p.close();
}
await b.close();
