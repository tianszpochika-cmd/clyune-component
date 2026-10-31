import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE = process.env.BASE || 'https://component.clyune.com';
const OUT_DIR = '/workspace/clyune-component/tmp';
const REPORT = process.env.REPORT || path.join(OUT_DIR, 'control-qa-report.json');
const CONCURRENCY = Number(process.env.CONCURRENCY || 2);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()).filter(Boolean) : null;
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : null;

fs.mkdirSync(OUT_DIR, { recursive: true });

const registry = JSON.parse(fs.readFileSync('/tmp/registry.json', 'utf8'));
const demos = [];
for (const c of registry.categories) {
  for (const d of c.demos) {
    demos.push({
      cat: c.key,
      slug: d.slug,
      title: d.title,
      mod: d.mod,
      path: d.path || `/${c.key}/${d.slug}`,
    });
  }
}
let work = demos;
if (ONLY) work = demos.filter((d) => ONLY.some((x) => d.path.includes(x) || `${d.cat}/${d.slug}` === x));
if (LIMIT) work = work.slice(0, LIMIT);

function hashBuf(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
}

function analyze(buf) {
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data } = png;
  let dark = 0, bright = 0, nonBlack = 0;
  const uniq = new Set();
  const step = Math.max(1, Math.floor((w * h) / 8000));
  for (let i = 0; i < w * h; i += step) {
    const o = i * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
    if (a < 10) continue;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 18) dark++;
    else { bright++; nonBlack++; }
    uniq.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
  }
  const samples = dark + bright;
  const darkRatio = samples ? dark / samples : 1;
  const blank = samples === 0 || (darkRatio > 0.985 && uniq.size <= 2) || (nonBlack < 5 && uniq.size <= 1);
  return { w, h, darkRatio: +darkRatio.toFixed(3), uniq: uniq.size, nonBlack, blank, hash: hashBuf(buf) };
}

function pixelDelta(a, b) {
  if (!a || !b || a.length !== b.length) return 1;
  let diff = 0;
  const step = 16;
  for (let i = 0; i < a.length; i += step) {
    if (a[i] !== b[i]) diff++;
  }
  return diff / (a.length / step);
}

async function stageShot(page) {
  const stage = page.locator('.kit-stage, .demo-stage, .stage, .viewer').first();
  if (await stage.count()) {
    try {
      return await stage.screenshot({ type: 'png', timeout: 5000 });
    } catch (_) {}
  }
  return await page.screenshot({ type: 'png', clip: { x: 260, y: 70, width: 720, height: 500 } });
}

async function readControlFingerprint(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.fx-root') || document.body;
    const stage = document.querySelector('.kit-stage, .demo-stage, .stage');
    const css = stage
      ? {
          c: getComputedStyle(stage).getPropertyValue('--c').trim(),
          spd: getComputedStyle(stage).getPropertyValue('--spd').trim(),
          sz: getComputedStyle(stage).getPropertyValue('--sz').trim(),
          count: getComputedStyle(stage).getPropertyValue('--count').trim(),
          blur: getComputedStyle(stage).getPropertyValue('--blur').trim(),
        }
      : {};
    const presets = [...document.querySelectorAll('.preset-btn')].map((b) => ({
      t: b.textContent.trim(),
      on: b.classList.contains('on'),
      pressed: b.getAttribute('aria-pressed'),
    }));
    const ranges = [...document.querySelectorAll('.fx-ops input[type=range], .param input[type=range]')].map((i) => ({
      k: i.dataset.k || i.name || '',
      v: i.value,
    }));
    const colors = [...document.querySelectorAll('.fx-ops input[type=color], .param input[type=color]')].map((i) => ({
      k: i.dataset.k || '',
      v: i.value,
    }));
    const toggles = [...document.querySelectorAll('.fx-ops input[type=checkbox], .param input[type=checkbox]')].map((i) => ({
      k: i.dataset.k || '',
      v: i.checked,
    }));
    const selects = [...document.querySelectorAll('.fx-ops select, .param select')].map((i) => ({
      k: i.dataset.k || '',
      v: i.value,
    }));
    const html = stage ? stage.innerHTML.slice(0, 400) : '';
    const childCount = stage ? stage.querySelectorAll('*').length : 0;
    const err = !!document.querySelector('.loading.err, [role=alert]');
    return { css, presets, ranges, colors, toggles, selects, htmlLen: html.length, childCount, err, hasFx: !!root?.classList?.contains('fx-root') };
  });
}

function fingerprintChanged(before, after) {
  if (!before || !after) return false;
  if (JSON.stringify(before.css) !== JSON.stringify(after.css)) return true;
  if (JSON.stringify(before.presets) !== JSON.stringify(after.presets)) return true;
  if (JSON.stringify(before.ranges) !== JSON.stringify(after.ranges)) return true;
  if (JSON.stringify(before.colors) !== JSON.stringify(after.colors)) return true;
  if (JSON.stringify(before.toggles) !== JSON.stringify(after.toggles)) return true;
  if (JSON.stringify(before.selects) !== JSON.stringify(after.selects)) return true;
  if (before.childCount !== after.childCount) return true;
  if (before.htmlLen !== after.htmlLen) return true;
  return false;
}

async function testDemo(browser, demo) {
  const page = await browser.newPage();
  const errors = [];
  const controlResults = [];
  let status = 'pass';
  let reason = '';
  let analysis = null;
  const url = `${BASE}${demo.path}`;

  const onConsole = (msg) => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 240));
  };
  const onPageError = (e) => errors.push('PAGE:' + String(e.message).slice(0, 240));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(900);

    // Wait for stage content
    await page.waitForFunction(() => {
      const stage = document.querySelector('.kit-stage, .demo-stage, .stage');
      if (!stage) return document.querySelector('canvas, svg, .loading.err');
      return stage.children.length > 0 || stage.querySelector('canvas, svg, img, video');
    }, { timeout: 8000 }).catch(() => {});

    await page.waitForTimeout(250);
    const shot0 = await stageShot(page);
    analysis = analyze(shot0);
    if (analysis.blank) {
      status = 'fail';
      reason = 'blank_stage_initial';
    }

    // Collect controls
    const controls = await page.evaluate(() => {
      const list = [];
      document.querySelectorAll('.preset-btn').forEach((el, i) => {
        list.push({ kind: 'preset', index: i, label: el.textContent.trim(), selector: `.preset-btn >> nth=${i}` });
      });
      document.querySelectorAll('.action-btn, .fx-toolbar .btn.action-btn, .fx-ops-actions .btn').forEach((el, i) => {
        const label = el.textContent.trim();
        const action = el.dataset.action || label;
        // skip duplicate ops-actions that mirror toolbar if same text already queued from action-btn
        list.push({ kind: 'action', index: i, label, action, selector: null, handle: true });
      });
      document.querySelectorAll('.fx-ops input[type=range], .param input[type=range]').forEach((el, i) => {
        list.push({
          kind: 'range',
          index: i,
          label: el.dataset.k || el.closest('.param')?.querySelector('.param-label')?.textContent?.trim() || `range-${i}`,
          key: el.dataset.k || '',
          min: el.min, max: el.max, step: el.step, value: el.value,
        });
      });
      document.querySelectorAll('.fx-ops input[type=color], .param input[type=color]').forEach((el, i) => {
        list.push({ kind: 'color', index: i, label: el.dataset.k || `color-${i}`, key: el.dataset.k || '' });
      });
      document.querySelectorAll('.fx-ops input[type=checkbox], .param input[type=checkbox]').forEach((el, i) => {
        list.push({ kind: 'toggle', index: i, label: el.dataset.k || `toggle-${i}`, key: el.dataset.k || '' });
      });
      document.querySelectorAll('.fx-ops select, .param select').forEach((el, i) => {
        list.push({ kind: 'select', index: i, label: el.dataset.k || `select-${i}`, key: el.dataset.k || '', options: [...el.options].map((o) => o.value) });
      });
      document.querySelectorAll('.param-step').forEach((el, i) => {
        list.push({ kind: 'step', index: i, label: el.getAttribute('aria-label') || el.textContent.trim(), dir: el.dataset.dir });
      });
      // stage-local buttons (UI demos etc.) excluding toolbar chrome / disabled / hidden / closed overlays
      document.querySelectorAll('.kit-stage button, .kit-inner button, [data-kit-root] button').forEach((el, i) => {
        const t = el.textContent.trim().slice(0, 40);
        if (!t && !el.getAttribute('aria-label')) return;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none' || Number(st.opacity) === 0) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        // skip buttons trapped in closed modal/drawer/sheet/menu
        const host = el.closest('.modal-b, .drawer, .sheet, .fab-menu, .menu, [data-m], dialog');
        if (host) {
          const open = host.classList.contains('open') || host.classList.contains('on') || host.hasAttribute('open') || host.getAttribute('aria-hidden') === 'false';
          const hs = getComputedStyle(host);
          if (!open && (hs.display === 'none' || hs.visibility === 'hidden' || Number(hs.opacity) === 0 || hs.pointerEvents === 'none')) return;
        }
        list.push({ kind: 'stage-btn', index: i, label: t || el.getAttribute('aria-label') || `stage-btn-${i}`, domIndex: i });
      });
      return list;
    });

    // Deduplicate actions: keep unique by label+kind for action buttons (toolbar + ops duplicate)
    const seenAction = new Set();
    const filtered = [];
    for (const c of controls) {
      if (c.kind === 'action') {
        const k = `action:${c.label}`;
        if (seenAction.has(k)) continue;
        seenAction.add(k);
      }
      filtered.push(c);
    }

    // Exercise presets — skip already-on to avoid remount false suspects
    for (const c of filtered.filter((x) => x.kind === 'preset')) {
      const btn = page.locator('.preset-btn').nth(c.index);
      try {
        const alreadyOn = await btn.evaluate((el) => el.classList.contains('on') || el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true' || el.dataset.on === '1');
        if (alreadyOn) {
          controlResults.push({ ...c, status: 'pass', reason: 'skip_already_on' });
          continue;
        }
      } catch (_) {}
      const beforeFp = await readControlFingerprint(page);
      const beforeShot = await stageShot(page);
      const beforeA = analyze(beforeShot);
      let threw = null;
      try {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(350);
      } catch (e) {
        threw = String(e.message).slice(0, 160);
      }
      const afterFp = await readControlFingerprint(page);
      const afterShot = await stageShot(page);
      const afterA = analyze(afterShot);
      const fpCh = fingerprintChanged(beforeFp, afterFp);
      const pixCh = pixelDelta(beforeShot, afterShot) > 0.002 || beforeA.hash !== afterA.hash;
      let s = 'pass';
      let r = '';
      if (threw) { s = 'fail'; r = 'click_throw:' + threw; }
      else if (afterA.blank && !beforeA.blank) { s = 'fail'; r = 'became_blank'; }
      else if (afterFp.err) { s = 'fail'; r = 'mount_error'; }
      else if (!fpCh && !pixCh) { s = 'suspect'; r = 'no_visible_or_state_change'; }
      else if (!fpCh && pixCh) { s = 'pass'; r = 'pixel_change_only'; }
      controlResults.push({ ...c, status: s, reason: r, blankAfter: afterA.blank });
      if (s === 'fail') status = 'fail';
      else if (s === 'suspect' && status === 'pass') status = 'suspect';
    }

    // Actions
    for (const c of filtered.filter((x) => x.kind === 'action')) {
      const beforeFp = await readControlFingerprint(page);
      const beforeShot = await stageShot(page);
      const beforeA = analyze(beforeShot);
      let threw = null;
      try {
        // Prefer toolbar action-btn with matching text, else ops
        const loc = page.locator(`.action-btn:has-text("${c.label}"), .fx-ops-actions .btn:has-text("${c.label}")`).first();
        await loc.click({ timeout: 2000 });
        await page.waitForTimeout(400);
      } catch (e) {
        threw = String(e.message).slice(0, 160);
      }
      const afterFp = await readControlFingerprint(page);
      const afterShot = await stageShot(page);
      const afterA = analyze(afterShot);
      const fpCh = fingerprintChanged(beforeFp, afterFp);
      const pixCh = pixelDelta(beforeShot, afterShot) > 0.002 || beforeA.hash !== afterA.hash;
      let s = 'pass';
      let r = '';
      // reset/replay often remounts — childCount or html may change; pause/play may only affect animation
      const softActions = /重置|reset|播放|暂停|replay|play|pause|随机|shuffle|刷新|refresh/i;
      if (threw) { s = 'fail'; r = 'click_throw:' + threw; }
      else if (afterA.blank && !beforeA.blank) { s = 'fail'; r = 'became_blank'; }
      else if (afterFp.err) { s = 'fail'; r = 'mount_error'; }
      else if (!fpCh && !pixCh) {
        if (softActions.test(c.label) || softActions.test(c.action || '')) {
          s = 'pass'; r = 'soft_action_no_pixel_delta';
        } else {
          s = 'suspect'; r = 'no_visible_or_state_change';
        }
      }
      controlResults.push({ ...c, status: s, reason: r, blankAfter: afterA.blank });
      if (s === 'fail') status = 'fail';
      else if (s === 'suspect' && status === 'pass') status = 'suspect';
    }

    // Ranges: set mid then near-max
    for (const c of filtered.filter((x) => x.kind === 'range')) {
      const input = page.locator(`.fx-ops input[type=range][data-k="${c.key}"], .param input[type=range][data-k="${c.key}"]`).first();
      // fallback by index
      const loc = (c.key && await input.count()) ? input : page.locator('.fx-ops input[type=range], .param input[type=range]').nth(c.index);
      for (const target of ['mid', 'high']) {
        const beforeFp = await readControlFingerprint(page);
        const beforeShot = await stageShot(page);
        const beforeA = analyze(beforeShot);
        let threw = null;
        let newVal = null;
        try {
          const box = await loc.boundingBox();
          const min = Number(c.min);
          const max = Number(c.max);
          const mid = min + (max - min) * (target === 'mid' ? 0.5 : 0.85);
          newVal = String(mid);
          await loc.evaluate((el, v) => {
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, newVal);
          await page.waitForTimeout(250);
        } catch (e) {
          threw = String(e.message).slice(0, 160);
        }
        const afterFp = await readControlFingerprint(page);
        const afterShot = await stageShot(page);
        const afterA = analyze(afterShot);
        const fpCh = fingerprintChanged(beforeFp, afterFp);
        const pixCh = pixelDelta(beforeShot, afterShot) > 0.002 || beforeA.hash !== afterA.hash;
        let s = 'pass';
        let r = '';
        if (threw) { s = 'fail'; r = 'set_throw:' + threw; }
        else if (afterA.blank && !beforeA.blank) { s = 'fail'; r = 'became_blank'; }
        else if (afterFp.err) { s = 'fail'; r = 'mount_error'; }
        else if (!fpCh && !pixCh) { s = 'suspect'; r = 'range_no_effect'; }
        controlResults.push({ kind: 'range', label: `${c.label}@${target}`, key: c.key, status: s, reason: r, value: newVal, blankAfter: afterA.blank });
        if (s === 'fail') status = 'fail';
        else if (s === 'suspect' && status === 'pass') status = 'suspect';
      }
    }

    // Colors
    for (const c of filtered.filter((x) => x.kind === 'color')) {
      const loc = page.locator(`.fx-ops input[type=color][data-k="${c.key}"], .param input[type=color][data-k="${c.key}"]`).first();
      const beforeFp = await readControlFingerprint(page);
      const beforeShot = await stageShot(page);
      let threw = null;
      try {
        await loc.evaluate((el) => {
          el.value = '#ff00aa';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForTimeout(250);
      } catch (e) {
        threw = String(e.message).slice(0, 160);
      }
      const afterFp = await readControlFingerprint(page);
      const afterShot = await stageShot(page);
      const afterA = analyze(afterShot);
      const beforeA = analyze(beforeShot);
      const fpCh = fingerprintChanged(beforeFp, afterFp);
      const pixCh = pixelDelta(beforeShot, afterShot) > 0.002 || beforeA.hash !== afterA.hash;
      let s = 'pass';
      let r = '';
      if (threw) { s = 'fail'; r = 'color_throw:' + threw; }
      else if (afterA.blank && !beforeA.blank) { s = 'fail'; r = 'became_blank'; }
      else if (!fpCh && !pixCh) { s = 'suspect'; r = 'color_no_effect'; }
      controlResults.push({ ...c, status: s, reason: r });
      if (s === 'fail') status = 'fail';
      else if (s === 'suspect' && status === 'pass') status = 'suspect';
    }

    // Toggles
    for (const c of filtered.filter((x) => x.kind === 'toggle')) {
      const loc = page.locator(`.fx-ops input[type=checkbox][data-k="${c.key}"], .param input[type=checkbox][data-k="${c.key}"]`).first();
      const beforeFp = await readControlFingerprint(page);
      let threw = null;
      try {
        await loc.click({ timeout: 2000 });
        await page.waitForTimeout(200);
      } catch (e) {
        threw = String(e.message).slice(0, 160);
      }
      const afterFp = await readControlFingerprint(page);
      const fpCh = fingerprintChanged(beforeFp, afterFp);
      let s = 'pass';
      let r = '';
      if (threw) { s = 'fail'; r = 'toggle_throw:' + threw; }
      else if (!fpCh) { s = 'suspect'; r = 'toggle_no_state_change'; }
      controlResults.push({ ...c, status: s, reason: r });
      if (s === 'fail') status = 'fail';
      else if (s === 'suspect' && status === 'pass') status = 'suspect';
    }

    // Selects — pick next option
    for (const c of filtered.filter((x) => x.kind === 'select')) {
      const loc = page.locator(`.fx-ops select[data-k="${c.key}"], .param select[data-k="${c.key}"]`).first();
      const beforeFp = await readControlFingerprint(page);
      let threw = null;
      try {
        const opts = c.options || [];
        const next = opts.find((o) => o !== beforeFp.selects.find((s) => s.k === c.key)?.v) || opts[1] || opts[0];
        if (next != null) await loc.selectOption(String(next));
        await page.waitForTimeout(250);
      } catch (e) {
        threw = String(e.message).slice(0, 160);
      }
      const afterFp = await readControlFingerprint(page);
      const fpCh = fingerprintChanged(beforeFp, afterFp);
      let s = 'pass';
      let r = '';
      if (threw) { s = 'fail'; r = 'select_throw:' + threw; }
      else if (!fpCh) { s = 'suspect'; r = 'select_no_state_change'; }
      controlResults.push({ ...c, status: s, reason: r });
      if (s === 'fail') status = 'fail';
      else if (s === 'suspect' && status === 'pass') status = 'suspect';
    }

    // Stage buttons (limited to first 8); click via DOM to avoid overlay intercept / strict text match
    const stageBtns = filtered.filter((x) => x.kind === 'stage-btn').slice(0, 8);
    for (const c of stageBtns) {
      const beforeShot = await stageShot(page);
      const beforeA = analyze(beforeShot);
      const beforeFp = await readControlFingerprint(page);
      let threw = null;
      try {
        const clicked = await page.evaluate((label) => {
          const roots = [...document.querySelectorAll('.kit-stage, .kit-inner, [data-kit-root]')];
          const scope = roots.length ? roots : [document.body];
          const buttons = scope.flatMap((r) => [...r.querySelectorAll('button')]);
          const el = buttons.find((b) => (b.textContent || '').trim().slice(0, 40) === label);
          if (!el) return { ok: false, why: 'not_found' };
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') return { ok: false, why: 'disabled' };
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return { ok: false, why: 'hidden' };
          el.scrollIntoView({ block: 'center', inline: 'center' });
          el.click();
          return { ok: true };
        }, c.label);
        if (!clicked?.ok) {
          controlResults.push({ ...c, status: 'pass', reason: 'skip_' + (clicked?.why || 'unclickable') });
          continue;
        }
        await page.waitForTimeout(350);
      } catch (e) {
        threw = String(e.message).slice(0, 160);
      }
      const afterShot = await stageShot(page);
      const afterA = analyze(afterShot);
      const afterFp = await readControlFingerprint(page);
      const fpCh = fingerprintChanged(beforeFp, afterFp);
      const pixCh = pixelDelta(beforeShot, afterShot) > 0.002 || beforeA.hash !== afterA.hash;
      let s = 'pass';
      let r = '';
      if (threw) { s = 'fail'; r = 'stage_btn_throw:' + threw; }
      else if (afterA.blank && !beforeA.blank) { s = 'fail'; r = 'became_blank'; }
      else if (!fpCh && !pixCh) { s = 'pass'; r = 'click_ok_no_delta'; }
      controlResults.push({ ...c, status: s, reason: r });
      if (s === 'fail') status = 'fail';
      else if (s === 'suspect' && status === 'pass') status = 'suspect';
    }

    // Final blank check
    const finalShot = await stageShot(page);
    const finalA = analyze(finalShot);
    analysis = finalA;
    if (finalA.blank && status === 'pass') {
      status = 'fail';
      reason = reason || 'blank_stage_final';
    }
    if (errors.length && status === 'pass') {
      // filter noisy 3rd-party
      const real = errors.filter((e) => !/favicon|Download the React DevTools|Failed to load resource: net::ERR_BLOCKED/i.test(e));
      if (real.length) {
        status = 'suspect';
        reason = reason || 'console_errors';
      }
    }
    if (!reason && status !== 'pass') {
      const bad = controlResults.find((c) => c.status === 'fail') || controlResults.find((c) => c.status === 'suspect');
      reason = bad ? `${bad.kind}:${bad.label}:${bad.reason}` : status;
    }
    if (!filtered.length && status === 'pass') {
      // pages with no controls — still OK if not blank
      reason = 'no_controls';
    }

    return {
      ...demo,
      url,
      status,
      reason,
      analysis,
      errors: errors.slice(0, 5),
      controlCount: filtered.length,
      controls: controlResults,
    };
  } catch (e) {
    return {
      ...demo,
      url,
      status: 'fail',
      reason: 'nav:' + String(e.message).slice(0, 180),
      analysis,
      errors: errors.concat(String(e.message)).slice(0, 5),
      controlCount: 0,
      controls: controlResults,
    };
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    await page.close().catch(() => {});
  }
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

const results = [];
let idx = 0;
async function worker(id) {
  while (true) {
    const i = idx++;
    if (i >= work.length) break;
    const demo = work[i];
    const r = await testDemo(browser, demo);
    results.push(r);
    if ((results.length % 10 === 0) || results.length === work.length) {
      const pass = results.filter((x) => x.status === 'pass').length;
      const fail = results.filter((x) => x.status === 'fail').length;
      const suspect = results.filter((x) => x.status === 'suspect').length;
      console.log(`progress ${results.length}/${work.length} pass=${pass} fail=${fail} suspect=${suspect} last=${demo.path}:${r.status}`);
      // incremental save
      fs.writeFileSync(REPORT, JSON.stringify({ updatedAt: new Date().toISOString(), summary: { pass, fail, suspect, total: results.length }, results }, null, 2));
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
await browser.close();

const pass = results.filter((x) => x.status === 'pass').length;
const fail = results.filter((x) => x.status === 'fail').length;
const suspect = results.filter((x) => x.status === 'suspect').length;
const summary = { pass, fail, suspect, total: results.length };
const report = {
  updatedAt: new Date().toISOString(),
  base: BASE,
  summary,
  fails: results.filter((x) => x.status === 'fail').map((x) => ({ path: x.path, reason: x.reason, errors: x.errors, badControls: x.controls?.filter((c) => c.status === 'fail') })),
  suspects: results.filter((x) => x.status === 'suspect').map((x) => ({ path: x.path, reason: x.reason, badControls: x.controls?.filter((c) => c.status !== 'pass').slice(0, 8) })),
  results,
};
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log('SUMMARY', summary);
console.log('REPORT', REPORT);
