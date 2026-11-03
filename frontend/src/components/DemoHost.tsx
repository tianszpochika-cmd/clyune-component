import { useEffect, useRef, useState } from 'react';
import { mountDemo } from '../demoLoader';
// @ts-ignore js module
import { onProgress, resetProgress } from '../lib/progress.js';

type Props = { mod: string; fn: string; variant?: string; slug?: string };
type Phase = 'engine' | 'scene' | 'frame' | 'done' | 'error';
const STEP: Record<string, string> = { engine: '加载引擎', scene: '初始化场景', frame: '编译着色器 / 绘制首帧' };
const SLOW_MS = 12000, TIMEOUT_MS = 45000;

/** Resolves once the stage has painted: 2 rAFs after mount, and (if present) a canvas with real size. */
function firstFrame(el: HTMLElement, cancelled: () => boolean) {
  return new Promise<void>((res) => {
    const t0 = performance.now();
    const tick = (n: number) => requestAnimationFrame(() => {
      if (cancelled()) return res();
      const c = el.querySelector('canvas') as HTMLCanvasElement | null;
      const ok = !c || (c.width > 0 && c.height > 0);
      if ((n >= 2 && ok) || performance.now() - t0 > 4000) res(); else tick(n + 1);
    });
    tick(0);
  });
}

export function DemoHost({ mod, fn, variant, slug }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('engine');
  const [pct, setPct] = useState(0);
  const [bytes, setBytes] = useState<{ loaded: number; total: number } | null>(null);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hide, setHide] = useState(false);
  const [mods, setMods] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;
    let disposer: void | (() => void) | undefined;
    setPhase('engine'); setError(null); setPct(0); setBytes(null); setSlow(false); setHide(false);
    el.innerHTML = '';
    resetProgress();
    const off = onProgress((s: { loaded: number; total: number }) => { if (!cancelled && s.loaded) setBytes({ loaded: s.loaded, total: s.total }); });
    // per-asset count: JS/wasm/font/audio resources finished since mount (lazy chunks can't be byte-streamed)
    let nMods = 0; setMods(0);
    let po: PerformanceObserver | null = null;
    try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (/\.(m?js|wasm|woff2?|mp3|ogg|json)(\?|$)/.test(e.name)) nMods++; if (!cancelled) setMods(nMods); }); po.observe({ type: 'resource', buffered: false }); } catch (_) { /* unsupported */ }
    const slowT = setTimeout(() => { if (!cancelled) setSlow(true); }, SLOW_MS);
    const failT = setTimeout(() => { if (!cancelled) { setError('加载超时（网络较慢或 CDN 不可用）'); setPhase('error'); } }, TIMEOUT_MS);
    // staged indeterminate progress: eases toward a phase ceiling; real CDN bytes override when known
    let p = 0; const t0 = performance.now();
    const ceil = { engine: 55, scene: 82, frame: 96, done: 100, error: 0 } as Record<Phase, number>;
    let cur: Phase = 'engine';
    const iv = setInterval(() => { if (cancelled) return; const c = ceil[cur]; p += (c - p) * 0.06; setPct(Math.max(1, Math.min(c, p))); }, 120);
    const go = (ph: Phase) => { cur = ph; if (!cancelled) setPhase(ph); };

    (async () => {
      try {
        const d = await mountDemo(mod, fn, el, { variant, slug }, (s: string) => go(s as Phase));
        if (cancelled) { if (typeof d === 'function') d(); return; }
        disposer = d;
        go('frame');
        await firstFrame(el, () => cancelled);
        if (cancelled) return;
        clearTimeout(failT); go('done'); setPct(100);
        setTimeout(() => { if (!cancelled) setHide(true); }, performance.now() - t0 < 250 ? 0 : 260);
      } catch (e) {
        console.error(e);
        if (!cancelled) { clearTimeout(failT); setError(e instanceof Error ? e.message : String(e)); go('error'); }
      }
    })();

    return () => {
      cancelled = true; off(); po?.disconnect(); clearInterval(iv); clearTimeout(slowT); clearTimeout(failT);
      try { if (typeof disposer === 'function') disposer(); } catch (err) { console.warn(err); }
      el.innerHTML = '';
    };
  }, [mod, fn, variant, slug, attempt]);

  const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const real = bytes && bytes.total ? Math.round((bytes.loaded / bytes.total) * 100) : null;
  const shown = phase === 'engine' && real != null ? Math.max(pct, real * 0.55) : pct;
  return (
    <div className="card canvas-host" id="viewport" data-demo-viewport>
      {!hide && !error && (
        <div className={`stage-loader${phase === 'done' ? ' out' : ''}`} aria-live="polite" role="status" data-phase={phase}>
          <div className="sl-ring" aria-hidden><i /></div>
          <div className="sl-step">{STEP[phase] || '就绪'}…</div>
          <div className="sl-bar" aria-hidden><i style={{ width: `${Math.round(shown)}%` }} /></div>
          <div className="sl-meta">
            <span>{Math.round(shown)}%</span>
            {mods ? <span>{mods} 个模块</span> : null}
            {bytes ? <span>{kb(bytes.loaded)}{bytes.total ? ` / ${kb(bytes.total)}` : ''}</span> : null}
          </div>
          {slow && <div className="sl-slow">网络较慢，仍在加载…</div>}
        </div>
      )}
      {error && (
        <div className="stage-loader err" role="alert">
          <div className="sl-step">加载失败</div>
          <div className="sl-slow">{error}</div>
          <button type="button" className="btn primary" onClick={() => setAttempt((a) => a + 1)}>重试</button>
        </div>
      )}
      <div ref={hostRef} className="demo-mount" />
    </div>
  );
}
