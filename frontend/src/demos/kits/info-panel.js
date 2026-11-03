/**
 * MathInfoPanel — shared live-readout + explanation panel for math / convert demos.
 *
 * createInfoPanel(stage, { doc, onHover }) splits `stage` into a canvas box + a DOM panel:
 *   desktop (stage ≥ 640px wide): panel docked on the right (288px), canvas keeps the rest.
 *   narrow / phone: panel docked below the canvas as a bottom sheet (accordion sections),
 *   capped in height so the canvas is never covered.
 *
 * doc = {
 *   title: '勾股定理',
 *   rows(v)    -> [[label, value, hlKey?], ...]     live readout (updated every frame)
 *   formula    -> html string | (v)=>html             「公式」
 *   explain    -> html string | (v)=>html             「说明」
 *   params     -> [[name, desc], ...]                 「参数」
 *   example(v) -> html                                 「步骤」 worked example with live values
 *   tip        -> short interaction hint
 * }
 */
import { tx } from '../../lib/i18n';
const CSS = `
.mip-layout{position:absolute;inset:0;display:flex;flex-direction:row;min-height:0;min-width:0}
.mip-layout.mip-narrow{flex-direction:column}
.mip-canvas{position:relative;flex:1 1 auto;min-width:0;min-height:0}
.mip-canvas>canvas{position:absolute;inset:0}
.mip{flex:0 0 288px;width:288px;display:flex;flex-direction:column;min-height:0;overflow:hidden;
  border-left:1px solid rgba(148,163,184,.16);background:linear-gradient(180deg,#0e1628,#0a1120);
  color:#cbd5e1;font:12px/1.5 ui-sans-serif,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  touch-action:pan-y;z-index:3}
.mip-narrow .mip{flex:0 0 auto;width:auto;max-height:46%;border-left:0;border-top:1px solid rgba(148,163,184,.18);
  border-radius:14px 14px 0 0;box-shadow:0 -8px 24px rgba(0,0,0,.35)}
.mip-grip{display:none}
.mip-narrow .mip-grip{display:block;width:36px;height:4px;border-radius:2px;background:#334155;margin:6px auto 0}
.mip-scroll{overflow:auto;-webkit-overflow-scrolling:touch;padding:10px 12px 12px;min-height:0;flex:1 1 auto;touch-action:pan-y}
.mip-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.mip-dot{width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.18);animation:mipPulse 1.6s infinite}
@keyframes mipPulse{50%{box-shadow:0 0 0 6px rgba(52,211,153,0)}}
.mip-title{font-weight:700;color:#f1f5f9;font-size:13px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mip-live{font-size:10px;color:#34d399;letter-spacing:.06em}
.mip-rows{display:grid;grid-template-columns:1fr;gap:3px;margin:0}
.mip-narrow .mip-rows{grid-template-columns:1fr 1fr;column-gap:8px}
.mip-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:4px 8px;border-radius:7px;
  background:rgba(30,41,59,.55);border:1px solid transparent;cursor:default;min-width:0}
.mip-row.hl-able{cursor:pointer}
.mip-row.hl-able:hover,.mip-row.on{border-color:rgba(251,191,36,.55);background:rgba(251,191,36,.08)}
.mip-row dt{color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mip-row dd{margin:0;color:#f8fafc;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums;
  text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .25s}
.mip-row dd.chg{color:#fde68a}
.mip-row.wide{grid-column:1/-1}
.mip-tip{margin:8px 0 0;color:#64748b;font-size:11px}
.mip-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px}
.mip-chip{appearance:none;border:1px solid rgba(129,140,248,.4);background:rgba(129,140,248,.08);color:#c7d2fe;
  border-radius:999px;padding:4px 11px;font:600 12px/1.3 inherit;cursor:pointer;display:inline-flex;align-items:center;gap:4px;min-height:28px}
.mip-chip:hover{background:rgba(129,140,248,.18)}
.mip-chip[aria-expanded="true"]{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:transparent}
.mip-chip .car{transition:transform .2s;font-size:9px}
.mip-chip[aria-expanded="true"] .car{transform:rotate(180deg)}
.mip-sec{margin-top:6px;padding:9px 10px;border-radius:9px;background:rgba(15,23,42,.85);border:1px solid rgba(148,163,184,.14);
  color:#cbd5e1;line-height:1.65}
.mip-sec[hidden]{display:none}
.mip-sec h4{margin:0 0 4px;font-size:11px;color:#a5b4fc;letter-spacing:.04em}
.mip-f{font:500 14px/1.7 "Cambria Math","STIX Two Math","Times New Roman",serif;color:#f8fafc;background:rgba(99,102,241,.1);
  border-left:3px solid #818cf8;padding:6px 9px;border-radius:6px;margin:4px 0;overflow-x:auto;white-space:nowrap}
.mip-f+.mip-f{margin-top:4px}
.mip-sec ul{margin:2px 0;padding-left:16px}.mip-sec li{margin:2px 0}
.mip-sec b{color:#f1f5f9}.mip-sec code,.mip-sec .n{font-family:ui-monospace,monospace;color:#fde68a}
.mip-sec ol{margin:2px 0;padding-left:18px}
.mip-dbg{margin-top:8px;color:#475569;font:10px/1.4 ui-monospace,monospace;white-space:normal;word-break:break-all}
`;
let cssInjected = false;
function injectCss() {
  if (cssInjected || typeof document === 'undefined') return;
  if (document.getElementById('mip-css')) { cssInjected = true; return; }
  const s = document.createElement('style'); s.id = 'mip-css'; s.textContent = CSS;
  document.head.appendChild(s); cssInjected = true;
}

const SECTIONS = [
  ['formula', '公式', 'ƒ'],
  ['explain', '说明', 'ℹ'],
  ['params', '参数', '⚙'],
  ['example', '步骤', '✎'],
];

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function fmt(x, d = 2) {
  if (x == null || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e7 || a < 1e-4)) return x.toExponential(Math.max(1, d)).replace('e+', 'e');
  const s = x.toFixed(d);
  return s === `-${(0).toFixed(d)}` ? (0).toFixed(d) : s.replace('-', '−');
}

export function createInfoPanel(stage, { doc, onHover } = {}) {
  injectCss();
  const layout = document.createElement('div');
  layout.className = 'mip-layout';
  const canvasBox = document.createElement('div');
  canvasBox.className = 'mip-canvas';
  const aside = document.createElement('aside');
  aside.className = 'mip';
  aside.setAttribute('aria-label', '实时数据与说明');
  aside.innerHTML = `<div class="mip-grip"></div><div class="mip-scroll">
    <div class="mip-head"><span class="mip-dot"></span><span class="mip-title">${esc(doc?.title || '实时数据')}</span><span class="mip-live">LIVE</span></div>
    <dl class="mip-rows" data-mip-rows></dl>
    ${doc?.tip ? `<p class="mip-tip">☝ ${esc(doc.tip)}</p>` : ''}
    <div class="mip-chips" role="group" aria-label="解释">${SECTIONS.map(([k, label, ic]) => `<button type="button" class="mip-chip" data-mip-chip="${k}" aria-expanded="false"><span aria-hidden="true">${ic}</span>${label}<span class="car" aria-hidden="true">▼</span></button>`).join('')}</div>
    ${SECTIONS.map(([k, label]) => `<section class="mip-sec" data-mip-sec="${k}" hidden><h4>${label}</h4><div data-mip-body></div></section>`).join('')}
    <div class="mip-dbg" data-mip-dbg></div>
  </div>`;
  layout.appendChild(canvasBox);
  layout.appendChild(aside);
  stage.appendChild(layout);

  const rowsEl = aside.querySelector('[data-mip-rows]');
  const dbgEl = aside.querySelector('[data-mip-dbg]');
  const open = new Set();
  let rowEls = [];
  let lastV = {};
  let hlKey = null;
  let exampleAt = 0;

  const resolve = (x, v) => (typeof x === 'function' ? x(v || {}) : x);
  const bodyOf = (k) => aside.querySelector(`[data-mip-sec="${k}"] [data-mip-body]`);
  const renderSec = (k) => {
    const v = lastV;
    let html = '';
    try {
      if (k === 'formula') html = resolve(doc.formula, v);
      else if (k === 'explain') html = resolve(doc.explain, v);
      else if (k === 'params') html = `<ul>${(resolve(doc.params, v) || []).map(([n, d]) => `<li><b>${n}</b>：${d}</li>`).join('')}</ul>`;
      else if (k === 'example') html = resolve(doc.example, v);
    } catch (err) { html = `<em>（${esc(err.message)}）</em>`; }
    /* en: translate the whole HTML block at once (tags kept) instead of word fragments between <b> tags */
    if (html) html = tx(html);
    const b = bodyOf(k);
    if (b && b.innerHTML !== html) b.innerHTML = html || '—';
  };

  aside.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-mip-chip]');
    if (chip) {
      const k = chip.dataset.mipChip;
      const sec = aside.querySelector(`[data-mip-sec="${k}"]`);
      const isOpen = open.has(k);
      if (isOpen) open.delete(k); else open.add(k);
      chip.setAttribute('aria-expanded', String(!isOpen));
      sec.hidden = isOpen;
      if (!isOpen) {
        renderSec(k);
        const sc = aside.querySelector('.mip-scroll');
        const top = sec.offsetTop - sc.offsetTop - 8;
        if (top + sec.offsetHeight > sc.scrollTop + sc.clientHeight) sc.scrollTo?.({ top: Math.max(0, top - sc.clientHeight * 0.35), behavior: 'smooth' });
      }
      return;
    }
    const row = e.target.closest('.mip-row.hl-able');
    if (row) { setHl(hlKey === row.dataset.hl ? null : row.dataset.hl); }
  });
  aside.addEventListener('pointerover', (e) => {
    const row = e.target.closest('.mip-row.hl-able');
    if (row && e.pointerType === 'mouse') setHl(row.dataset.hl);
  });
  aside.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setHl(null); });
  ['pointerdown', 'wheel', 'touchstart'].forEach((ev) => aside.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));

  function setHl(k) {
    hlKey = k || null;
    rowEls.forEach((r) => r.el.classList.toggle('on', !!hlKey && r.hl === hlKey));
    onHover && onHover(hlKey);
  }

  const ro = new ResizeObserver(() => {
    const w = stage.getBoundingClientRect().width;
    layout.classList.toggle('mip-narrow', w < 640);
  });
  ro.observe(stage);
  layout.classList.toggle('mip-narrow', stage.getBoundingClientRect().width < 640);

  function buildRows(rows) {
    rowsEl.innerHTML = '';
    rowEls = rows.map((r) => {
      const el = document.createElement('div');
      el.className = 'mip-row';
      if (r[2]) { el.classList.add('hl-able'); el.dataset.hl = r[2]; el.title = '悬停/点按：在图上高亮'; }
      if (r[3] === 'wide') el.classList.add('wide');
      el.innerHTML = '<dt></dt><dd></dd>';
      rowsEl.appendChild(el);
      return { el, dt: el.firstChild, dd: el.lastChild, hl: r[2], last: '' , t: 0 };
    });
  }

  function update(v, extra = {}) {
    lastV = v || {};
    let rows;
    try { rows = doc.rows(lastV) || []; } catch (err) { rows = [['错误', err.message]]; }
    if (Array.isArray(extra.ctl)) rows = rows.concat(extra.ctl);
    if (rows.length !== rowEls.length || rows.some((r, i) => rowEls[i].dt.textContent !== String(r[0]))) {
      buildRows(rows);
      rows.forEach((r, i) => { rowEls[i].dt.textContent = String(r[0]); });
    }
    const now = performance.now();
    rows.forEach((r, i) => {
      const re = rowEls[i];
      const s = String(r[1]);
      if (re.last !== s) {
        re.dd.textContent = s; re.last = s;
        re.dd.classList.add('chg'); re.t = now;
      } else if (re.t && now - re.t > 260) { re.dd.classList.remove('chg'); re.t = 0; }
    });
    if (open.size && now - exampleAt > 150) {
      exampleAt = now;
      open.forEach((k) => { if (k === 'example' || typeof doc[k] === 'function') renderSec(k); });
    }
    if (extra.dbg != null) {
      const d = String(extra.dbg);
      if (dbgEl.textContent !== d) dbgEl.textContent = d;
    }
    if (extra.ix != null) aside.dataset.ix = String(extra.ix);
    if (extra.handle) aside.dataset.handle = extra.handle;
  }

  function destroy() { ro.disconnect(); layout.remove(); }
  return { canvasBox, aside, update, destroy, setHl, get hl() { return hlKey; } };
}

/* tiny formula helpers */
/** Phones: lift an in-canvas control overlay into its own row above the canvas so it never covers it. */
export function dockControls(ui, canvasBox) {
  try {
    if (!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches)) return false;
    const layout = canvasBox.parentElement; if (!layout) return false;
    ui.classList.add('mip-dock'); layout.insertBefore(ui, canvasBox);
    if (!document.getElementById('mip-dock-css')) {
      const st = document.createElement('style'); st.id = 'mip-dock-css';
      st.textContent = '.mip-layout>.mip-dock{flex-direction:row!important;flex-wrap:nowrap!important;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;position:relative!important;inset:auto!important;left:auto!important;top:auto!important;right:auto!important;width:auto!important;max-width:none!important;flex:0 0 auto;padding:4px 6px;gap:4px;pointer-events:auto;background:#0b1222;border-bottom:1px solid rgba(148,163,184,.16)}'
        + '.mip-dock::-webkit-scrollbar{display:none}.mip-dock>*{width:auto!important;max-width:none!important;flex:0 0 auto!important;flex-wrap:nowrap!important}'
        + '.mip-dock button{flex:0 0 auto!important;white-space:nowrap}.mip-dock .ss-hint{display:none}';
      document.head.appendChild(st);
    }
    return true;
  } catch (_) { return false; }
}
export const F = (s) => `<div class="mip-f">${s}</div>`;
export const frac = (a, b) => `<span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:.9em;line-height:1.15"><span style="border-bottom:1px solid currentColor;padding:0 3px">${a}</span><span style="padding:0 3px">${b}</span></span>`;
export const sq = (s) => `√<span style="border-top:1px solid currentColor;padding:0 2px">${s}</span>`;

/** Rewrite a doc's generic 速度/尺寸/数量/颜色 param names to the knob labels a demo really shows; drop hidden knobs. */
export function alignDocParams(doc, spec = {}) {
  if (!doc || !doc.params) return doc;
  const lab = (k, dflt) => { const f = spec[k]; if (!f) return null; return (typeof f === 'object' && f.label) || dflt; };
  const MAP = { '速度': lab('speed', '速度'), '尺寸': lab('size', '尺寸'), '数量': lab('count', '数量'), '颜色': lab('color', '颜色') };
  const fix = (list) => {
    const seen = new Set(); const out = [];
    for (const [name, desc] of list || []) {
      const parts = String(name).split(/\s*\/\s*/).map((p) => (p in MAP ? MAP[p] : p)).filter(Boolean);
      if (!parts.length) continue;
      const nm = parts.join(' / ');
      if (seen.has(nm)) continue;
      seen.add(nm); out.push([nm, desc]);
    }
    return out;
  };
  const p = doc.params;
  return { ...doc, params: typeof p === 'function' ? (v) => fix(p(v)) : fix(p) };
}
