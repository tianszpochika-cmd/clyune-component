// App-shell mobile audit (run via: MODE=shell node overlap-audit.mjs).
// Pages: home, home+search results, every category page, first demo of every category, menu-open (home + a demo).
// Viewports: 390x844, 375x667, 360x740, landscape 844x390, desktop 1280/1440/1920 (+ button-overflow check).
// Fails on: shell (topbar/search/menu/sidebar) covering content text/cards/canvas, topbar children overlapping
// each other, horizontal page overflow, elements off the right edge, clipped text (no ellipsis/line-clamp).
import { chromium } from 'playwright';
import { BTN_CHECK } from './btn-check.mjs';
import { registryCats } from './audit-cats.mjs';
import { enableAutoDemo } from './audit-auto.mjs';

export const SHELL_VPS = [[390, 844, '390'], [375, 667, '375'], [360, 740, '360'], [844, 390, 'land'], [1280, 800, '1280'], [1440, 900, '1440'], [1920, 1080, '1920']];

const SHELL_CHECK = (menuOpen) => {
  const out = [];
  const W = innerWidth, H = innerHeight;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const nm = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}${(el.textContent || '').trim() ? '「' + el.textContent.trim().slice(0, 10) + '」' : ''}`;
  const inDemo = (el) => !!el.closest('.demo-mount');
  const inScrollerX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true; if (o === 'hidden' || o === 'clip') { const pr = p.getBoundingClientRect(); if (pr.right <= W + 1) return true; } } return false; };
  // 1. horizontal overflow
  const se = document.scrollingElement;
  if (se.scrollWidth > W + 1) out.push(`page h-overflow ${se.scrollWidth}>${W}`);
  for (const sel of ['.main', '.content', '.topbar']) { const e = document.querySelector(sel); if (e && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible') out.push(`${sel} h-overflow ${e.scrollWidth}>${e.clientWidth}`); }
  for (const e of [...document.querySelectorAll('.topbar *, .content *')].filter((e) => !inDemo(e) && vis(e))) {
    const r = e.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !inScrollerX(e)) out.push(`off-edge ${nm(e)} [${Math.round(r.left)},${Math.round(r.right)}]`);
  }
  // 2. topbar children overlap each other
  const tb = document.querySelector('.topbar');
  if (tb) {
    const kids = [...tb.querySelectorAll(':scope > *, .topbar-right > *')].filter((k) => vis(k) && !k.classList.contains('topbar-right'));
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      if (kids[i].contains(kids[j]) || kids[j].contains(kids[i])) continue;
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 1 && iy > 1) out.push(`topbar overlap ${nm(kids[i])} × ${nm(kids[j])}`);
    }
  }
  // 3. covered content: sample points; topmost element must not be shell chrome
  const shellSel = '.topbar, .sidebar, .sidebar-backdrop, .menu-toggle';
  const sample = (el, area, okHit) => {
    const r = el.getBoundingClientRect();
    const L = Math.max(r.left, area.left), R = Math.min(r.right, area.right), T = Math.max(r.top, area.top), B = Math.min(r.bottom, area.bottom);
    if (R - L < 4 || B - T < 4) return null;
    for (const [fx, fy] of [[0.5, 0.5], [0.12, 0.2], [0.88, 0.2], [0.12, 0.8], [0.88, 0.8]]) {
      const h = document.elementFromPoint(L + (R - L) * fx, T + (B - T) * fy);
      if (h && !okHit(h, el)) return h;
    }
    return null;
  };
  if (!menuOpen) {
    const content = document.querySelector('.content');
    const cr = content.getBoundingClientRect();
    const area = { left: Math.max(0, cr.left), right: Math.min(W, cr.right), top: Math.max(0, cr.top), bottom: Math.min(H, cr.bottom) };
    const items = [...content.querySelectorAll('h1, h2, h3, p, .tile, .btn, .chip, .pill, input, .stats > *, .demo-toolbar, .demo-mount canvas, a')].filter((e) => vis(e) && (!inDemo(e) || e.tagName === 'CANVAS'));
    for (const e of items) { const h = sample(e, area, (h) => !h.closest(shellSel)); if (h) out.push(`covered ${nm(e)} by ${nm(h.closest(shellSel))}`); }
    if (tb) { const t = tb.getBoundingClientRect(); const s = tb.querySelector('.topbar-search'); const sr = s && vis(s) ? s.getBoundingClientRect() : null;
      if (cr.top < t.bottom - 1) out.push(`content top ${Math.round(cr.top)} < topbar bottom ${Math.round(t.bottom)}`);
      if (sr && sr.bottom > t.bottom + 1) out.push(`search spills out of topbar (${Math.round(sr.bottom)} > ${Math.round(t.bottom)})`); }
  } else {
    const sb = document.querySelector('.sidebar');
    const r = sb.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1) out.push(`sidebar off-screen [${Math.round(r.left)},${Math.round(r.right)}]`);
    const area = { left: Math.max(0, r.left), right: Math.min(W, r.right), top: Math.max(0, r.top), bottom: Math.min(H, r.bottom) };
    const items = [...sb.querySelectorAll('.brand, .brand-link, .sidebar-close, input, .nav-item, .nav-sub, h1, h2, h3, p')].filter(vis);
    for (const e of items) { const h = sample(e, area, (h) => !!h.closest('.sidebar')); if (h) out.push(`sidebar item covered ${nm(e)} by ${nm(h)}`); }
    for (const e of items) { const cs = getComputedStyle(e); if (e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !['auto', 'scroll'].includes(cs.overflowX)) out.push(`sidebar clipped ${nm(e)}`); }
  }
  // 4. clipped text in shell/content (demos have their own audits)
  const txt = [...document.querySelectorAll('.topbar *, .content h1, .content h2, .content h3, .content p, .content .btn, .content .pill, .content .chip, .content .tile *, .content .stats *, .content .demo-toolbar *')].filter((e) => !inDemo(e) && vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  for (const e of txt) {
    const cs = getComputedStyle(e);
    if (cs.display === 'inline') continue;
    if (e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !['auto', 'scroll'].includes(cs.overflowX)) out.push(`clipped-x ${nm(e)} ${e.scrollWidth}>${e.clientWidth}`);
    if (e.scrollHeight > e.clientHeight + 2 && ['hidden', 'clip'].includes(cs.overflowY) && cs.webkitLineClamp === 'none') out.push(`clipped-y ${nm(e)}`);
  }
  return [...new Set(out)].slice(0, 8);
};

export async function runShellAudit(BASE, SHOTS) {
  const cats = registryCats();
  const pages = [['/', 'home'], ['/', 'search'], ['/', 'menu']];
  for (const [c, l] of Object.entries(cats)) { pages.push([`/${c}`, 'cat']); if (l[0]) pages.push([`/${c}/${l[0]}`, 'demo']); }
  pages.push([`/${Object.keys(cats)[0]}/${Object.values(cats)[0][0]}`, 'menu']);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const queue = pages.flatMap((p) => SHELL_VPS.filter((v) => !(p[1] === 'menu' && v[0] >= 900)).map((v) => [...p, v])); const res = [];
  const one = async ([path, kind, [w, h, tag]]) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900, deviceScaleFactor: 1 });
    await enableAutoDemo(ctx);
    const p = await ctx.newPage(); const fails = [];
    try {
      await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector('.content', { timeout: 15000 }); await p.waitForTimeout(kind === 'demo' ? 1500 : 700);
      let menu = false;
      if (kind === 'search') { await p.fill('.topbar-search input', 'canvas').catch(() => {}); await p.waitForTimeout(500); }
      if (kind === 'menu') { await p.locator('.menu-toggle').tap({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); menu = true; }
      const states = [['top', async () => {}]];
      if (kind !== 'menu') states.push(['scrolled', async () => { await p.evaluate(() => { const c = document.querySelector('.content'); c.scrollTop = Math.min(c.scrollHeight, 360); }); await p.waitForTimeout(250); }]);
      for (const [nm, fn] of states) {
        await fn(); const r = [...await p.evaluate(SHELL_CHECK, menu), ...await p.evaluate(BTN_CHECK)];
        if (r.length) fails.push(`${nm}: ${r.join(', ')}`);
        if (SHOTS && (r.length || process.env.ALLSHOTS)) await p.screenshot({ path: `${SHOTS}/${path.replace(/\//g, '_')}-${kind}-${tag}-${nm}.png` });
      }
    } catch (e) { fails.push('exception: ' + String(e.message).split('\n')[0]); }
    await ctx.close();
    return { path, kind, tag, fails };
  };
  await Promise.all(Array.from({ length: +(process.env.W || 4) }, async () => { while (queue.length) res.push(await one(queue.shift())); }));
  res.sort((a, b) => (a.path + a.kind + a.tag).localeCompare(b.path + b.kind + b.tag));
  let n = 0; const byKind = {};
  for (const r of res) { byKind[r.kind] = (byKind[r.kind] || 0) + (r.fails.length ? 1 : 0); if (r.fails.length) { n++; console.log(`FAIL ${r.path} [${r.kind}] ${r.tag}: ${r.fails.join(' | ')}`); } }
  console.log('BYKIND ' + JSON.stringify(byKind));
  console.log(`\nSHELL ${pages.length} page-states x ${SHELL_VPS.length} viewports (menu: mobile only) = ${res.length} runs, ${n} failing runs`);
  await browser.close();
  return n;
}
