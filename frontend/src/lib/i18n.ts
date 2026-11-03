/** zh / en UI language. Default from navigator.language (zh* → zh, else en); sticky in localStorage. */
import { useEffect, useState } from 'react';

export type Lang = 'zh' | 'en';
const KEY = 'cc-lang';
const EVT = 'cc-lang';
const HAS_ZH = /[\u3400-\u9fff]/;
const ZH_RUN = /[\u3400-\u9fff][\u3400-\u9fff\u3000-\u303f\uff01-\uff5e·]*/g;

function detect(): Lang {
  try { const s = localStorage.getItem(KEY); if (s === 'zh' || s === 'en') return s; } catch (_) { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'zh';
  return /^zh/i.test(nav) ? 'zh' : 'en';
}
let lang: Lang = detect();
let dict: Record<string, string> | null = null;
let dictP: Promise<void> | null = null;
const cache = new Map<string, string>();

export const getLang = () => lang;
export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch (_) { /* ignore */ }
  applyDocLang();
  const fire = () => window.dispatchEvent(new CustomEvent(EVT, { detail: l }));
  if (l === 'en') loadDict().then(fire); else fire();
}
export function onLangChange(fn: (l: Lang) => void) {
  const h = () => fn(lang);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
export function useLang(): Lang {
  const [l, set] = useState(lang);
  useEffect(() => onLangChange(set), []);
  return l;
}
/** Pick zh/en literal. */
export const tr = (zh: string, en: string) => (lang === 'en' ? en : zh);

function applyDocLang() { try { document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'; } catch (_) { /* ignore */ } }

export function loadDict(): Promise<void> {
  if (dict) return Promise.resolve();
  if (!dictP) dictP = import('../i18n/en.json').then((m) => { dict = (m.default || m) as Record<string, string>; cache.clear(); }).catch(() => { dict = {}; });
  return dictP;
}
export const dictReady = () => !!dict;

/** Translate an arbitrary zh string with the demo dictionary (exact hit, else per-run replacement). */
export function tx(s: string): string {
  if (lang !== 'en' || !dict || typeof s !== 'string' || !HAS_ZH.test(s)) return s;
  const c = cache.get(s); if (c !== undefined) return c;
  const t = s.trim();
  let out = dict[s] ?? dict[t];
  if (out === undefined) {
    out = s.replace(ZH_RUN, (m, off: number) => {
      const e = dict![m];
      if (e === undefined) return m;
      const pre = off > 0 && /[A-Za-z0-9)]/.test(s[off - 1]) ? ' ' : '';
      const nx = s[off + m.length];
      const post = nx && /[A-Za-z0-9(]/.test(nx) ? ' ' : '';
      return pre + e + post;
    });
  } else if (t !== s) out = s.replace(t, out);
  if (cache.size > 20000) cache.clear();
  cache.set(s, out);
  return out;
}

/* ---------- canvas text: translate fillText / strokeText / measureText in en mode ---------- */
let canvasPatched = false;
function patchCanvas() {
  if (canvasPatched || typeof CanvasRenderingContext2D === 'undefined') return;
  canvasPatched = true;
  const P = CanvasRenderingContext2D.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const oMeasure = P.measureText as (t: string) => TextMetrics;
  const capCache = new Map<string, number>();
  /* English is often much wider than the Chinese it replaces; kits lay text out in fixed boxes, so cap the
     translated width at ~1.3x the original (canvas condenses via maxWidth) and report the same width from measureText. */
  const cap = (ctx: CanvasRenderingContext2D, zh: string, en: string): number => {
    const key = ctx.font + '\u0001' + zh;
    let c = capCache.get(key);
    if (c === undefined) {
      const zw = oMeasure.call(ctx, zh).width, ew = oMeasure.call(ctx, en).width;
      const px = parseFloat((/(\d+(?:\.\d+)?)px/.exec(ctx.font) || [])[1] || '12');
      const lim = Math.max(zw * 1.3, zw + px * 1.5);
      c = ew > lim ? lim : -1;
      if (capCache.size > 4000) capCache.clear();
      capCache.set(key, c);
    }
    return c;
  };
  for (const k of ['fillText', 'strokeText']) {
    const orig = P[k];
    P[k] = function (this: CanvasRenderingContext2D, text: unknown, x: unknown, y: unknown, maxW?: unknown) {
      if (lang !== 'en' || typeof text !== 'string') return orig.call(this, text, x, y, ...(maxW === undefined ? [] : [maxW]));
      const t = tx(text);
      if (t === text) return orig.call(this, t, x, y, ...(maxW === undefined ? [] : [maxW]));
      let c = cap(this, text, t);
      /* never run past the canvas right edge (left-aligned text only) */
      const al = this.textAlign;
      if ((al === 'left' || al === 'start') && typeof x === 'number' && this.canvas) {
        const m2 = this.getTransform(), sx = Math.hypot(m2.a, m2.b) || 1;
        if (Math.abs(m2.b) < 1e-6) {
          const room = (this.canvas.width - (m2.a * x + m2.c * (y as number) + m2.e)) / sx - 4;
          const w = c < 0 ? oMeasure.call(this, t).width : c;
          if (room > 20 && w > room) c = room;
        }
      }
      const m = c < 0 ? maxW : (typeof maxW === 'number' ? Math.min(maxW, c) : c);
      return orig.call(this, t, x, y, ...(m === undefined ? [] : [m]));
    };
  }
  P.measureText = function (this: CanvasRenderingContext2D, text: unknown) {
    if (lang !== 'en' || typeof text !== 'string') return oMeasure.call(this, text as string);
    const t = tx(text);
    const r = oMeasure.call(this, t);
    if (t === text) return r;
    const c = cap(this, text, t);
    if (c < 0) return r;
    const f = c / (r.width || 1);
    return { width: c, actualBoundingBoxLeft: r.actualBoundingBoxLeft * f, actualBoundingBoxRight: r.actualBoundingBoxRight * f,
      actualBoundingBoxAscent: r.actualBoundingBoxAscent, actualBoundingBoxDescent: r.actualBoundingBoxDescent,
      fontBoundingBoxAscent: r.fontBoundingBoxAscent, fontBoundingBoxDescent: r.fontBoundingBoxDescent } as TextMetrics;
  };
}

/* ---------- DOM: translate text nodes + a few attributes inside a demo root ---------- */
const ATTRS = ['title', 'placeholder', 'aria-label', 'data-tip', 'alt'];
function fixNode(n: Node) {
  if (n.nodeType === 3) {
    const v = n.nodeValue || '';
    if (HAS_ZH.test(v)) { const t = tx(v); if (t !== v) n.nodeValue = t; }
    return;
  }
  if (n.nodeType !== 1) return;
  const el = n as Element;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && HAS_ZH.test(v)) { const t = tx(v); if (t !== v) el.setAttribute(a, t); }
  }
  if (tag === 'INPUT') {
    const i = el as HTMLInputElement;
    if ((i.type === 'button' || i.type === 'submit') && HAS_ZH.test(i.value)) i.value = tx(i.value);
  }
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let c = w.nextNode();
  while (c) {
    if (c.nodeType === 3) { const v = c.nodeValue || ''; if (HAS_ZH.test(v)) { const t = tx(v); if (t !== v) c.nodeValue = t; } }
    else {
      const e = c as Element;
      for (const a of ATTRS) { const v = e.getAttribute(a); if (v && HAS_ZH.test(v)) { const t = tx(v); if (t !== v) e.setAttribute(a, t); } }
    }
    c = w.nextNode();
  }
}
/** Live-translate a subtree while lang === 'en'. Returns disposer. */
export function translateTree(root: HTMLElement): () => void {
  if (lang !== 'en') return () => {};
  patchCanvas();
  let mo: MutationObserver | null = null;
  let dead = false;
  loadDict().then(() => {
    if (dead) return;
    fixNode(root);
    mo = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') fixNode(m.target);
        else if (m.type === 'attributes') fixNode(m.target);
        else m.addedNodes.forEach(fixNode);
      }
    });
    mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  });
  return () => { dead = true; mo?.disconnect(); };
}

applyDocLang();
if (lang === 'en') { patchCanvas(); loadDict().then(() => window.dispatchEvent(new CustomEvent(EVT, { detail: lang }))); }
