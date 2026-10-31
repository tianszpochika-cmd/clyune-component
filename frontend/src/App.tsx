import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { categories, routes, totalDemos, type Category, type DemoMeta } from './registry';
import { DemoHost } from './components/DemoHost';

type Health = { ok: boolean; db: string; service?: string; version?: string };

function useSidebar() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', open);
    return () => document.body.classList.remove('sidebar-open');
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return { open, setOpen, close: () => setOpen(false) };
}

function useHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch('/api/health')
        .then((r) => r.json())
        .then((j) => { if (alive) setHealth(j); })
        .catch(() => { if (alive) setHealth({ ok: false, db: 'unreachable' }); });
    };
    load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return health;
}


/** Reliable accordion: animate explicit height (works where grid 0fr/1fr does not). */
function AccordionPanel({
  open,
  label,
  children,
}: {
  open: boolean;
  label: string;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const setH = (px: number | 'auto') => {
      outer.style.height = px === 'auto' ? 'auto' : `${Math.max(0, px)}px`;
    };

    if (first.current) {
      first.current = false;
      setH(open ? 'auto' : 0);
      outer.style.opacity = open ? '1' : '0';
      outer.dataset.open = open ? '1' : '0';
      return;
    }

    if (reduce) {
      setH(open ? 'auto' : 0);
      outer.style.opacity = open ? '1' : '0';
      outer.dataset.open = open ? '1' : '0';
      return;
    }

    if (open) {
      // expand: 0 → scrollHeight → auto
      const target = inner.scrollHeight;
      setH(0);
      outer.style.opacity = '0';
      // force reflow
      void outer.offsetHeight;
      outer.dataset.open = '1';
      outer.style.opacity = '1';
      setH(target);
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== outer || e.propertyName !== 'height') return;
        if (outer.dataset.open === '1') setH('auto');
        outer.removeEventListener('transitionend', onEnd);
      };
      outer.addEventListener('transitionend', onEnd);
      return () => outer.removeEventListener('transitionend', onEnd);
    }

    // collapse: auto/current → 0
    const current = inner.scrollHeight;
    setH(current);
    void outer.offsetHeight;
    outer.dataset.open = '0';
    outer.style.opacity = '0';
    setH(0);
  }, [open]);

  // Keep height in sync while open if children grow/shrink (filter, etc.)
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || !open) return;
    const ro = new ResizeObserver(() => {
      if (outer.dataset.open !== '1') return;
      if (outer.style.height === 'auto' || outer.style.height === '') return;
      // only adjust if we are mid-transition with a px height after expand settled as auto
    });
    // When already auto, ResizeObserver not needed for height; content flows.
    // Re-measure if still locked to px (e.g. interrupted).
    const id = window.setTimeout(() => {
      if (outer.dataset.open === '1' && outer.style.height !== 'auto') {
        outer.style.height = 'auto';
      }
    }, 360);
    ro.observe(inner);
    return () => { ro.disconnect(); window.clearTimeout(id); };
  }, [open, children]);

  return (
    <div
      ref={outerRef}
      className={`nav-children${open ? ' open' : ''}`}
      role="group"
      aria-label={label}
      aria-hidden={!open}
    >
      <div ref={innerRef} className="nav-children-inner">
        {children}
      </div>
    </div>
  );
}

function Sidebar({ open, onClose, filter, setFilter }: {
  open: boolean; onClose: () => void; filter: string; setFilter: (v: string) => void;
}) {
  const loc = useLocation();
  const r = loc.pathname.length > 1 && loc.pathname.endsWith('/')
    ? loc.pathname.slice(0, -1)
    : loc.pathname || '/';
  const q = filter.trim().toLowerCase();
  /** Accordion: only one category open; null = all collapsed. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const key = categories.find((c) => r === `/${c.key}` || r.startsWith(`/${c.key}/`))?.key ?? null;
    // Auto-expand the active route's category (does not lock it open).
    if (key) setOpenKey(key);
  }, [r]);

  const toggleGroup = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const filtered = useMemo(() => {
    if (!q) return categories;
    return categories
      .map((c) => ({
        ...c,
        demos: c.demos.filter((d) =>
          d.title.toLowerCase().includes(q)
          || d.slug.toLowerCase().includes(q)
          || d.tag.toLowerCase().includes(q)
          || c.name.toLowerCase().includes(q)),
      }))
      .filter((c) => c.demos.length > 0 || c.name.toLowerCase().includes(q) || c.key.includes(q));
  }, [q]);

  useEffect(() => {
    const el = navRef.current?.querySelector('.nav-sub.active') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [r]);

  return (
    <>
      <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
        <div className="brand sticky-brand">
          <div className="brand-top">
            <Link to="/" className="brand-link" onClick={onClose}>
              <div className="brand-mark">C</div>
              <div>
                <div className="brand-title">Component</div>
                <div className="brand-sub">Rust + React · {totalDemos} demos</div>
              </div>
            </Link>
            <button type="button" className="sidebar-close" aria-label="关闭导航" onClick={onClose}>✕</button>
          </div>
          <label className="sidebar-search">
            <span className="sr-only">筛选导航</span>
            <input
              type="search"
              placeholder="筛选分类 / Demo…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="筛选侧栏"
            />
            {filter && (
              <button type="button" className="sidebar-search-clear" onClick={() => setFilter('')} aria-label="清除">✕</button>
            )}
          </label>
        </div>
        <nav className="nav" aria-label="Categories" ref={navRef as never}>
          <div className="nav-section-label">浏览</div>
          <Link to="/" className={`nav-item nav-home${r === '/' ? ' active' : ''}`}>
            <span className="icon">⌂</span>
            <span className="nav-label">Home</span>
            <em className="count">{totalDemos}</em>
          </Link>
          <div className="nav-section-label">演示库</div>
          {filtered.map((c) => {
            const routeActive = r === `/${c.key}` || r.startsWith(`/${c.key}/`);
            // Search keeps matches open; otherwise pure accordion via openKey (collapse always works).
            const groupOpen = !!q || openKey === c.key;
            return (
              <div key={c.key} className={`nav-group${groupOpen ? ' open' : ''}${routeActive ? ' route-active' : ''}`}>
                <div className="nav-item-row">
                  <button
                    type="button"
                    className={`nav-item nav-item-toggle${routeActive ? ' active' : ''}${groupOpen ? ' expanded' : ''}`}
                    title={groupOpen ? `折叠 ${c.name}` : `展开 ${c.name}`}
                    aria-expanded={groupOpen}
                    onClick={() => toggleGroup(c.key)}
                  >
                    <span className="icon">{c.icon}</span>
                    <span className="nav-label">{c.name}</span>
                    <em className="count">{c.demos.length}</em>
                    {!q && (
                      <span className={`nav-chevron-inline${groupOpen ? ' open' : ''}`} aria-hidden>▾</span>
                    )}
                  </button>
                </div>
                <AccordionPanel open={groupOpen} label={c.name}>
                    {c.demos.slice(0, q ? 80 : 48).map((d) => {
                      const path = `/${c.key}/${d.slug}`;
                      const on = r === path;
                      return (
                        <Link
                          key={d.slug}
                          to={path}
                          className={`nav-sub${on ? ' active' : ''}`}
                          title={d.hint || d.desc}
                          tabIndex={groupOpen ? 0 : -1}
                          onClick={onClose}
                        >
                          <span className="nav-sub-dot" aria-hidden />
                          <span className="nav-sub-title">{d.title}</span>
                          <span className="nav-sub-tag">{d.tag}</span>
                        </Link>
                      );
                    })}
                    {c.demos.length > (q ? 80 : 48) && (
                      <Link to={`/${c.key}`} className="nav-sub more" tabIndex={groupOpen ? 0 : -1} onClick={onClose}>查看全部 {c.demos.length} →</Link>
                    )}
                </AccordionPanel>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="nav-empty">无匹配演示</div>}
        </nav>
        <div className="sidebar-foot">
          <span>component.clyune.com</span>
          <span className="sidebar-foot-meta">{categories.length} 类</span>
        </div>
      </aside>
      <div className={`sidebar-backdrop${open ? ' show' : ''}`} onClick={onClose} />
    </>
  );
}

function DbBadge({ health }: { health: Health | null }) {
  if (!health) return <><b>…</b><span>数据库</span></>;
  const ok = health.ok && health.db === 'postgres';
  return (
    <>
      <b className={ok ? 'ok' : 'bad'}>{ok ? 'ON' : health.db === 'fallback-json' ? 'JSON' : 'OFF'}</b>
      <span>{ok ? 'Postgres' : health.db}</span>
    </>
  );
}

function Home({ health }: { health: Health | null }) {
  return (
    <>
      <section className="card hero">
        <h1>Component Gallery</h1>
        <p>
          管理后台风格的前端技术与 Web 特效演示站：{categories.length} 个分类、{totalDemos} 个可交互 Demo。
          本仓库为 <strong>Rust (Axum) + React (Vite)</strong> 移植版；演示逻辑按需走 CDN / 本地 kit。
        </p>
        <div className="stats">
          <div><b>{categories.length}</b><span>分类</span></div>
          <div><b>{totalDemos}</b><span>Demos</span></div>
          <div><DbBadge health={health} /></div>
        </div>
      </section>
      <div className="grid">
        {categories.map((c) => (
          <Link key={c.key} className="card tile" to={`/${c.key}`}>
            <div className="tile-head">
              <span className="tile-icon">{c.icon}</span>
              <h3>{c.name}</h3>
            </div>
            <p>{c.intro}</p>
            <span className="tag">{c.demos.length} demos</span>
          </Link>
        ))}
      </div>
      <section className="card overview">
        <h2>分类总览</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>分类</th><th className="num">数量</th><th>Demos（节选）</th></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.key}>
                  <td><Link to={`/${c.key}`}>{c.icon} {c.name}</Link></td>
                  <td className="num">{c.demos.length}</td>
                  <td className="muted">{c.demos.slice(0, 8).map((d) => d.title).join(' · ')}{c.demos.length > 8 ? ' …' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CategoryPage() {
  const { category } = useParams();
  const c = categories.find((x) => x.key === category);
  const [q, setQ] = useState('');
  if (!c) return <NotFound />;
  const demos = q.trim()
    ? c.demos.filter((d) => d.title.toLowerCase().includes(q.toLowerCase()) || d.tag.toLowerCase().includes(q.toLowerCase()) || d.slug.includes(q.toLowerCase()))
    : c.demos;
  return (
    <>
      <section className="card hero">
        <h1>{c.icon} {c.name}</h1>
        <p>{c.intro}</p>
        <div className="chips">
          {c.tech.map((t) => <span key={t} className="chip">{t}</span>)}
          <span className="chip accent">{c.demos.length} demos</span>
        </div>
        <div className="cat-search">
          <input
            type="search"
            placeholder={`在 ${c.name} 中筛选…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="筛选演示"
          />
          <span className="muted">{demos.length} / {c.demos.length}</span>
        </div>
      </section>
      {demos.length === 0 ? (
        <section className="card placeholder"><h2>无结果</h2><p>换个关键词试试</p></section>
      ) : (
        <div className="grid">
          {demos.map((d) => (
            <Link key={d.slug} className="card tile" to={`/${c.key}/${d.slug}`}>
              <h3>{d.title}</h3>
              <p>{d.desc || d.hint}</p>
              <span className="tag">{d.tag}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function DemoPage() {
  const { category, slug } = useParams();
  const path = `/${category}/${slug}`;
  const demo = routes[path] as DemoMeta | undefined;
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) return;
      if (e.key === 'Escape') history.back();
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) {
        setResetKey((k) => k + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!demo) return <NotFound />;
  const cat = demo.cat as Category;
  const list = cat.demos;
  const idx = list.findIndex((d) => d.slug === demo.slug);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  return (
    <div className="demo-wrap">
      <div className="card demo-toolbar">
        <div className="demo-title-block">
          <h2>{demo.title}</h2>
          <div className="demo-meta">
            <span className="tag">{demo.tag}</span>
            <span className="hint">{demo.hint || demo.desc}</span>
          </div>
        </div>
        <div className="demo-actions">
          <Link className="btn" to={`/${cat.key}`} title={cat.name}>
            <span className="btn-full">← {cat.name}</span>
            <span className="btn-short" aria-hidden>← 返回</span>
          </Link>
          {prev && (
            <Link className="btn" to={`/${cat.key}/${prev.slug}`} title={prev.title}>
              <span className="btn-full">‹ 上一个</span>
              <span className="btn-short" aria-hidden>‹</span>
            </Link>
          )}
          {next && (
            <Link className="btn" to={`/${cat.key}/${next.slug}`} title={next.title}>
              <span className="btn-full">下一个 ›</span>
              <span className="btn-short" aria-hidden>›</span>
            </Link>
          )}
          <button type="button" className="btn primary" onClick={() => setResetKey((k) => k + 1)} title="快捷键 R">Reset</button>
        </div>
      </div>
      <DemoHost key={resetKey} mod={demo.mod} fn={demo.fn} variant={demo.variant} slug={demo.slug} />
    </div>
  );
}

function NotFound() {
  return (
    <section className="card placeholder">
      <h2>404</h2>
      <p>未找到该页面</p>
      <p><Link to="/">返回首页</Link></p>
    </section>
  );
}

export default function App() {
  const { open, setOpen, close } = useSidebar();
  const health = useHealth();
  const [filter, setFilter] = useState('');
  const loc = useLocation();
  const r = loc.pathname.length > 1 && loc.pathname.endsWith('/')
    ? loc.pathname.slice(0, -1)
    : loc.pathname || '/';
  const cat = categories.find((c) => `/${c.key}` === r);
  const demo = routes[r];
  const crumb = r === '/' ? 'Home' : cat ? cat.name : demo ? `${demo.cat!.name} / ${demo.title}` : r;
  const title = (demo ? demo.title + ' · ' : cat ? cat.name + ' · ' : '') + 'Clyune Component Gallery';
  useEffect(() => { document.title = title; }, [title]);

  return (
    <div id="app">
      <Sidebar open={open} onClose={close} filter={filter} setFilter={setFilter} />
      <main className="main">
        <header className="topbar">
          <button type="button" className={`menu-toggle${open ? ' open' : ''}`} aria-label="打开或关闭导航" aria-controls="sidebar" aria-expanded={open} onClick={() => setOpen((v) => !v)}>☰</button>
          <div className="breadcrumb">{crumb}</div>
          <div className="topbar-search">
            <input
              type="search"
              placeholder="搜索演示…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="搜索演示"
            />
          </div>
          <div className="topbar-right">
            <span className={`pill db ${health?.db === 'postgres' ? 'ok' : ''}`}>
              {health ? (health.db === 'postgres' ? 'DB · Postgres' : `DB · ${health.db}`) : 'DB · …'}
            </span>
            <span className="pill">rust+react</span>
          </div>
        </header>
        <div className={`content${demo ? ' content--demo' : ''}`} id="main-scroll">
          <Routes>
            <Route path="/" element={<Home health={health} />} />
            <Route path="/:category" element={<CategoryPage />} />
            <Route path="/threejs/trig-waves" element={<Navigate to="/math/trig-waves" replace />} />
            <Route path="/:category/:slug" element={<DemoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
