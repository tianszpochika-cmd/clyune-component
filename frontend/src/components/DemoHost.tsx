import { useEffect, useRef, useState } from 'react';
import { mountDemo } from '../demoLoader';

type Props = { mod: string; fn: string };

export function DemoHost({ mod, fn }: Props) {
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
        const d = await mountDemo(mod, fn, el);
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
  }, [mod, fn]);

  return (
    <div className="card canvas-host" id="viewport" style={{ position: 'relative' }}>
      {loading && !error && (
        <div className="loading" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          加载中…
        </div>
      )}
      {error && (
        <div className="loading err" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          加载失败：{error}
          <br />
          <small>可能是 CDN 暂时不可用，请点击 Reset 重试。</small>
        </div>
      )}
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
