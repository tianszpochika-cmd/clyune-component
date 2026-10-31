import { useEffect, useRef, useState } from 'react';
import { mountDemo } from '../demoLoader';

type Props = { mod: string; fn: string; variant?: string; slug?: string };

export function DemoHost({ mod, fn, variant, slug }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;
    let disposer: void | (() => void) | undefined;
    setLoading(true);
    setError(null);
    el.innerHTML = '';

    (async () => {
      try {
        const d = await mountDemo(mod, fn, el, { variant, slug });
        if (cancelled) {
          if (typeof d === 'function') d();
          return;
        }
        disposer = d;
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLoading(false);
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (typeof disposer === 'function') disposer();
      } catch (err) {
        console.warn(err);
      }
      el.innerHTML = '';
    };
  }, [mod, fn, variant, slug]);

  return (
    <div className="card canvas-host" id="viewport">
      {loading && !error && (
        <div className="loading" aria-live="polite">加载中…</div>
      )}
      {error && (
        <div className="loading err" role="alert">
          加载失败：{error}
          <br />
          <small>可能是 CDN 暂时不可用，请点击 Reset 重试。</small>
        </div>
      )}
      <div ref={hostRef} className="demo-mount" />
    </div>
  );
}
