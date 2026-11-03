/** zh / en UI language. Default from navigator.language (zh* → zh, else en); sticky in localStorage. */
import { useEffect, useState } from 'react';

export type Lang = 'zh' | 'en';
const KEY = 'cc-lang';
const EVT = 'cc-lang';
const HAS_ZH = /[\u3400-\u9fff]/;
const ZH_RUN = /[\u3400-\u9fff][\u3400-\u9fff\u3000-\u303f\uff01-\uff5e·]*/g;

/** `?lang=en|zh` in the URL wins (and becomes sticky) — this is what canonical / hreflang URLs point at. */
function urlLang(): Lang | null {
  try { const v = new URLSearchParams(location.search).get('lang'); if (v) return /^en/i.test(v) ? 'en' : /^zh/i.test(v) ? 'zh' : null; } catch (_) { /* ignore */ }
  return null;
}
/* Crawlers must see the language the URL promises (no ?lang → 中文), not their own navigator.language. */
const IS_BOT = typeof navigator !== 'undefined' && /bot|spider|crawl|slurp|baidu|bingpreview|lighthouse/i.test(navigator.userAgent || '');
function detect(): Lang {
  const u = urlLang();
  if (u) { try { localStorage.setItem(KEY, u); } catch (_) { /* ignore */ } return u; }
  if (IS_BOT) return 'zh';
  try { const s = localStorage.getItem(KEY); if (s === 'zh' || s === 'en') return s; } catch (_) { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'zh';
  return /^zh/i.test(nav) ? 'zh' : 'en';
}
let lang: Lang = detect();
let dict: Record<string, string> | null = null;
let dictP: Promise<void> | null = null;
const cache = new Map<string, string>();
/* Context overrides: the same zh word means different things per demo (水 = Water in a palette, Mercury in the solar system).
   ctx.json maps a route ('/threejs/solar-system') or category ('/threejs/') to { zh: en }; checked before the global dict. */
let ctxAll: Record<string, Record<string, string>> | null = null;
let scope: Record<string, string> | null = null;
let scopePath = '';
function buildScope() {
  if (!ctxAll || !scopePath) { scope = null; return; }
  const cat = '/' + (scopePath.split('/')[1] || '') + '/';
  const a = ctxAll[cat], b = ctxAll[scopePath];
  scope = a || b ? { ...(a || {}), ...(b || {}) } : null;
}
/** Set the active demo route for context-aware translation. */
export function setTxScope(path: string) {
  if (path === scopePath) return;
  scopePath = path; buildScope(); cache.clear();
}

export const getLang = () => lang;
export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch (_) { /* ignore */ }
  applyDocLang();
  syncUrlLang();
  const fire = () => window.dispatchEvent(new CustomEvent(EVT, { detail: l }));
  if (l === 'en') loadDict().then(fire); else fire();
}
export function onLangChange(fn: (l: Lang) => void) {
  const h = () => fn(lang);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
/* Re-render on every cc-lang event, including the one fired when the en dictionary finishes loading
   (lang itself is unchanged then, so a plain useState(lang) would bail out and leave Chinese on screen). */
export function useLang(): Lang {
  const [, bump] = useState(0);
  useEffect(() => onLangChange(() => bump((n) => n + 1)), []);
  return lang;
}
/** Pick zh/en literal. */
export const tr = (zh: string, en: string) => (lang === 'en' ? en : zh);

/** Keep `?lang=en` in the address bar while English is active (zh = no param), without a router navigation. */
export function syncUrlLang() {
  try {
    const u = new URL(location.href);
    const want = lang === 'en' ? 'en' : null;
    if (u.searchParams.get('lang') === want) return;
    if (want) u.searchParams.set('lang', want); else u.searchParams.delete('lang');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch (_) { /* ignore */ }
}
function applyDocLang() { try { document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'; } catch (_) { /* ignore */ } }

export function loadDict(): Promise<void> {
  if (dict) return Promise.resolve();
  if (!dictP) dictP = Promise.all([import('../i18n/en.json'), import('../i18n/ctx.json')]).then(([m, c]) => {
    dict = (m.default || m) as Record<string, string>;
    ctxAll = (c.default || c) as Record<string, Record<string, string>>;
    buildScope(); cache.clear();
  }).catch(() => { dict = dict || {}; });
  return dictP;
}
export const dictReady = () => !!dict;

/* Full-width punctuation → ASCII once the Chinese around it is gone. */
const PUNCT: Record<string, string> = { '：': ': ', '，': ', ', '。': '. ', '；': '; ', '、': ', ', '（': ' (', '）': ') ', '【': '[', '】': '] ',
  '「': '“', '」': '”', '『': '“', '』': '”', '？': '? ', '！': '! ', '《': '“', '》': '”', '～': '~', '　': ' ', '·': '·' };
const FW = /[：，。；、（）【】「」『』？！《》～　]/g;
const NUM = /\d+(?:\.\d+)?/g;
function look(k: string): string | undefined {
  return (scope && scope[k]) ?? dict![k];
}
/* numbers are templated: "流行：1.5（12.7%）" hits the dictionary key "流行：{0}（{1}%）" */
function lookTpl(k: string): string | undefined {
  if (!/\d/.test(k)) return undefined;
  const nums: string[] = [];
  const key = k.replace(NUM, (m) => `{${nums.push(m) - 1}}`);
  const e = look(key);
  return e === undefined ? undefined : e.replace(/\{(\d+)\}/g, (_, i) => nums[+i] ?? '');
}
function runTx(m: string): string | undefined {
  const e = look(m);
  if (e !== undefined) return e;
  /* split a run at full-width punctuation and translate the pieces (keeps "流行：" → "Pop: ") */
  const parts = m.split(/([：，。；、（）【】「」『』？！《》～　·]+)/);
  if (parts.length < 2) return undefined;
  let hit = false;
  const out = parts.map((p) => { if (!p || !HAS_ZH.test(p)) return p; const w = look(p); if (w !== undefined) { hit = true; return w; } return p; }).join('');
  return hit ? out : undefined;
}
function tidy(o: string) {
  if (HAS_ZH.test(o)) return o;
  return o.replace(FW, (c) => PUNCT[c] ?? c).replace(/ +([,.;:!?)\]”])/g, '$1').replace(/([(\[“]) +/g, '$1').replace(/ {2,}/g, ' ').replace(/^ (?=\S)/, '').trimEnd() + (/\s$/.test(o) ? ' ' : '');
}

/** Translate an arbitrary zh string with the demo dictionary (scoped + exact hit, number template, else per-run replacement). */
export function tx(s: string): string {
  if (lang !== 'en' || !dict || typeof s !== 'string' || !HAS_ZH.test(s)) return s;
  const c = cache.get(s); if (c !== undefined) return c;
  const t = s.trim();
  let out = look(s) ?? look(t);
  if (out === undefined) { const v = lookTpl(t); if (v !== undefined) out = t !== s ? s.replace(t, v) : v; }
  else if (t !== s) out = s.replace(t, out);
  if (out === undefined) {
    /* Runwise only for short UI runs. Long theory/explain paragraphs must hit exact/template
       keys — partial replacement creates mixed zh/en garbage that is worse than leaving Chinese. */
    out = s.replace(ZH_RUN, (m, off: number) => {
      if (m.length > 20) return m;
      const e = runTx(m);
      if (e === undefined) return m;
      const pre = off > 0 && /[A-Za-z0-9)%]/.test(s[off - 1]) ? ' ' : '';
      const nx = s[off + m.length];
      const post = nx && /[A-Za-z0-9(]/.test(nx) ? ' ' : '';
      return pre + e + post;
    });
    out = tidy(out);
  }
  if (cache.size > 20000) cache.clear();
  cache.set(s, out);
  const lg = (globalThis as unknown as { __txlog?: [string, string, string][] }).__txlog;
  if (lg) lg.push([scopePath, s, out]);
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
