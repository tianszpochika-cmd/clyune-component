/** Client-side head sync for SPA navigations. The Axum server renders the same tags for the first load
 *  (backend/src/seo.rs) — keep the title / description formulas below in sync with it. */
import { useEffect } from 'react';
import { categories, totalDemos, type Category, type DemoMeta } from '../registry';
import type { Lang } from './i18n';

export const SITE = 'https://component.clyune.com';
const ZH = '云澜组件库';
const EN = 'Clyune Component Gallery';

const clip = (t: string, max: number) => {
  const s = t.split(/\s+/).filter(Boolean).join(' ');
  return [...s].length <= max ? s : [...s].slice(0, max - 1).join('') + '…';
};
const cn = (c: Category, l: Lang) => (l === 'en' ? c.name_en || c.name : c.name);
const ci = (c: Category, l: Lang) => (l === 'en' ? c.intro_en || c.intro : c.intro);
const dt = (d: DemoMeta, l: Lang) => (l === 'en' ? d.title_en || d.title : d.title);

export type SeoPage = { kind: 'home' } | { kind: 'cat'; cat: Category } | { kind: 'demo'; cat: Category; demo: DemoMeta } | { kind: '404' };

export function seoTitle(p: SeoPage, l: Lang): string {
  if (p.kind === 'home') return l === 'en' ? `${EN} — ${totalDemos} Interactive Front-end Demos & Web Effects` : `${ZH} Clyune Component Gallery｜${totalDemos} 个前端特效与交互组件在线演示`;
  if (p.kind === 'cat') return l === 'en' ? `${cn(p.cat, l)} Demos (${p.cat.demos.length}) | ${EN}` : `${p.cat.name}在线演示（${p.cat.demos.length} 个）｜${ZH} Clyune`;
  if (p.kind === 'demo') return l === 'en' ? `${dt(p.demo, l)} – ${cn(p.cat, l)} Interactive Demo | Clyune` : `${p.demo.title} - ${p.cat.name}在线演示｜${ZH}`;
  return l === 'en' ? `Page not found | ${EN}` : `页面不存在｜${ZH}`;
}

export function seoDesc(p: SeoPage, l: Lang): string {
  if (p.kind === 'home') {
    const names = categories.slice(0, 12).map((c) => cn(c, l));
    return l === 'en'
      ? `${EN}: ${totalDemos} interactive front-end demos and web effects across ${categories.length} categories — ${names.join(', ')}. Live parameters, real-time readouts and plain-language formulas. Open source (MIT).`
      : `${ZH}（Clyune Component Gallery）：${totalDemos} 个可交互的前端特效与组件 Demo，覆盖${names.join('、')}等 ${categories.length} 个分类。每个 Demo 都有可调参数、实时数据读数和通俗的中文公式说明，MIT 开源。`;
  }
  if (p.kind === 'cat') {
    const ex = p.cat.demos.slice(0, 6).map((d) => dt(d, l));
    return l === 'en'
      ? clip(`${p.cat.demos.length} interactive ${cn(p.cat, l)} demos: ${ex.join(', ')} and more. ${ci(p.cat, l)}`, 200)
      : clip(`${p.cat.name}共 ${p.cat.demos.length} 个可交互 Demo：${ex.join('、')}等。${p.cat.intro}`, 160);
  }
  if (p.kind === 'demo') {
    const d = p.demo;
    if (l === 'en') {
      const h = d.hint_en || d.hint, ds = d.desc_en || d.desc;
      return clip(`${dt(d, l)}${h && h !== ds ? ` (${h})` : ''}: ${ds} Tweak live parameters and see real-time readouts and formulas — an interactive ${cn(p.cat, l)} demo from ${EN}.`, 220);
    }
    return clip(`${d.title}${d.hint && d.hint !== d.desc ? `（${d.hint}）` : ''}：${d.desc} 可拖动参数、实时查看数据读数与公式说明——${ZH}·${p.cat.name}在线演示。`, 160);
  }
  return '';
}

function upsert(sel: string, make: () => HTMLElement, attr: string, val: string | null) {
  let el = document.head.querySelector(sel) as HTMLElement | null;
  if (val === null) { el?.remove(); return; }
  if (!el) { el = make(); el.setAttribute('data-seo', ''); document.head.appendChild(el); }
  if (el.getAttribute(attr) !== val) el.setAttribute(attr, val);
}
const meta = (k: 'name' | 'property', key: string, v: string | null) =>
  upsert(`meta[${k}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(k, key); return m; }, 'content', v);
const link = (sel: string, rel: string, hreflang: string | null, v: string) =>
  upsert(sel, () => { const e = document.createElement('link'); e.rel = rel; if (hreflang) e.hreflang = hreflang; return e; }, 'href', v);

let firstPath: string | null = null;
export function useSeo(p: SeoPage, path: string, l: Lang) {
  const key = `${p.kind}|${path}|${l}`;
  useEffect(() => {
    const url = (lg: Lang) => `${SITE}${path}${lg === 'en' ? '?lang=en' : ''}`;
    const title = seoTitle(p, l), desc = seoDesc(p, l);
    document.title = title;
    document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN';
    const indexable = p.kind !== '404';
    meta('name', 'description', desc || null);
    meta('name', 'keywords', p.kind === 'home'
      ? (l === 'en' ? 'front-end effects,component gallery,Three.js,WebGL,Canvas,CSS animation,data visualization,interactive demos' : '前端特效,组件库,Three.js,WebGL,Canvas,CSS动画,数据可视化,在线演示,云澜')
      : null);
    meta('name', 'robots', indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow');
    if (indexable) {
      link('link[rel="canonical"]', 'canonical', null, url(l));
      link('link[rel="alternate"][hreflang="zh-CN"]', 'alternate', 'zh-CN', url('zh'));
      link('link[rel="alternate"][hreflang="en"]', 'alternate', 'en', url('en'));
      link('link[rel="alternate"][hreflang="x-default"]', 'alternate', 'x-default', url('zh'));
    } else {
      document.head.querySelectorAll('link[rel="canonical"],link[rel="alternate"][hreflang]').forEach((e) => e.remove());
    }
    meta('property', 'og:type', p.kind === 'home' ? 'website' : 'article');
    meta('property', 'og:title', title);
    meta('property', 'og:description', desc || null);
    meta('property', 'og:url', url(l));
    meta('property', 'og:locale', l === 'en' ? 'en_US' : 'zh_CN');
    meta('property', 'og:locale:alternate', l === 'en' ? 'zh_CN' : 'en_US');
    meta('name', 'twitter:title', title);
    meta('name', 'twitter:description', desc || null);
    /* JSON-LD is server-rendered for the landing URL only; drop it once the SPA navigates elsewhere. */
    if (firstPath === null) firstPath = path;
    else if (path !== firstPath) document.head.querySelectorAll('script[type="application/ld+json"][data-seo]').forEach((e) => e.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
