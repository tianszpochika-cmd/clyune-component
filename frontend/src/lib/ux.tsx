/* v9 UX layer: per-category theme, count-up, catalog loading, route transitions, press ripple. */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, type Location } from 'react-router-dom';

const HUE: Record<string, number> = {
  threejs: 265, charts: 200, ui: 230, 'css-fx': 320, canvas: 28, svg: 160, gsap: 95, webgl: 290,
  physics: 12, audio: 340, dataviz: 185, micro: 350, layout: 210, filters: 275, 'particles-fx': 45,
  generative: 140, 'text-fx': 55, 'scroll-fx': 175, math: 245, convert: 20,
};
export const catHue = (key: string) => HUE[key] ?? 240;
export function catStyle(key: string): CSSProperties {
  const h = catHue(key);
  return { ['--cat' as string]: `hsl(${h} 85% 66%)`, ['--cat-2' as string]: `hsl(${(h + 40) % 360} 80% 60%)`, ['--cat-h' as string]: String(h) } as CSSProperties;
}
/** Deterministic preview gradient per demo (category hue +/- a slug hash). */
export function thumbStyle(key: string, slug: string, i: number): CSSProperties {
  let x = 0; for (let k = 0; k < slug.length; k++) x = (x * 31 + slug.charCodeAt(k)) | 0;
  const h = catHue(key), a = (h + ((x & 63) - 32)) % 360, b = (h + 50 + ((x >> 6) & 63)) % 360, ang = (x >>> 12) % 360;
  return { background: `radial-gradient(circle at ${20 + ((x >>> 3) % 60)}% ${25 + ((x >>> 9) % 50)}%, hsl(${b} 90% 70% / .55), transparent 55%), linear-gradient(${ang}deg, hsl(${a} 70% 34%), hsl(${b} 75% 22%))`, ['--i' as string]: String(Math.min(i, 14)) } as CSSProperties;
}

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(target: number, ms = 650) {
  const [v, setV] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion()) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
export function CountUp({ n }: { n: number }) { return <>{useCountUp(n)}</>; }

/** Live catalog from the API (Postgres); the bundled registry stays the routing source. */
type Live = { demos: number; cats: number; byCat: Record<string, number> };
let live: Live | null = null; let pending: Promise<void> | null = null;
export function useCatalog() {
  const [state, setState] = useState<Live | null>(live);
  useEffect(() => {
    if (live) return;
    let done = false;
    pending ??= fetch('/api/categories').then((r) => r.json()).then((j) => {
      const cs = (j.categories || []) as { key?: string; name?: string; demos?: unknown[] }[];
      const byCat: Record<string, number> = {}; let n = 0;
      cs.forEach((c) => { const k = c.key || ''; byCat[k] = (c.demos || []).length; n += byCat[k]; });
      live = { demos: n, cats: cs.length, byCat };
    }).catch(() => { live = { demos: 0, cats: 0, byCat: {} }; });
    const to = setTimeout(() => { if (!done) { done = true; setState(live || { demos: 0, cats: 0, byCat: {} }); } }, 900);
    pending.then(() => { if (!done) { done = true; setState(live); } });
    return () => { done = true; clearTimeout(to); };
  }, []);
  return { ready: !!state, live: state };
}

const depth = (p: string) => p.split('/').filter(Boolean).length;
/** Keeps the old route for a short exit, then mounts the new one with a directional enter. */
export function RouteView({ render }: { render: (loc: Location) => ReactNode }) {
  const loc = useLocation();
  const [shown, setShown] = useState(loc);
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [dir, setDir] = useState<'fwd' | 'back' | 'fade'>('fade');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loc.pathname === shown.pathname) { if (loc.search !== shown.search || loc.key !== shown.key) setShown(loc); return; }
    const d = depth(loc.pathname) - depth(shown.pathname);
    setDir(d > 0 ? 'fwd' : d < 0 ? 'back' : 'fade');
    if (reducedMotion()) { setShown(loc); setPhase('idle'); return; }
    setPhase('exit');
    const t = setTimeout(() => { setShown(loc); setPhase('enter'); }, 140);
    return () => clearTimeout(t);
  }, [loc]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (phase !== 'enter') return;
    const sc = document.getElementById('main-scroll'); if (sc) sc.scrollTop = 0;
    const t = setTimeout(() => setPhase('idle'), 340);
    return () => clearTimeout(t);
  }, [phase, shown]);
  return <div ref={ref} className={`route-view rv-${phase} rv-${dir}`} data-depth={depth(shown.pathname)}>{render(shown)}</div>;
}

/** Material-style press ripple on any .ripple element (pointer position aware). */
export function useRipple() {
  useEffect(() => {
    const on = (e: PointerEvent) => {
      if (reducedMotion()) return;
      const host = (e.target as Element | null)?.closest?.('.ripple') as HTMLElement | null; if (!host) return;
      const r = host.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
      const dot = document.createElement('span'); dot.className = 'ripple-dot';
      dot.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
      host.appendChild(dot); setTimeout(() => dot.remove(), 520);
    };
    document.addEventListener('pointerdown', on, { passive: true });
    return () => document.removeEventListener('pointerdown', on);
  }, []);
}
