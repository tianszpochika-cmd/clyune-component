import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { categories, routes, totalDemos, type Category, type DemoMeta } from './registry';
import { DemoHost } from './components/DemoHost';
import { CountUp, RouteView, catStyle, thumbStyle, useCatalog, useRipple } from './lib/ux';
import { isAutoDemo, setAutoDemo, onAutoDemoChange } from './lib/autoDemo';
import { setLang, syncUrlLang, tr, tx, useLang } from './lib/i18n';
import { useSeo, type SeoPage } from './lib/seo';
import { setMusic, setMusicVol, useMusic } from './lib/music';

const en = () => tr('zh', 'en') === 'en';
const cName = (c: Category) => (en() ? c.name_en || c.name : c.name);
const cIntro = (c: Category) => (en() ? c.intro_en || tx(c.intro) : c.intro);
const dTitle = (d: DemoMeta) => (en() ? d.title_en || d.title : d.title);
const dHint = (d: DemoMeta) => (en() ? d.hint_en || d.hint : d.hint);
const dDesc = (d: DemoMeta) => (en() ? d.desc_en || d.desc : d.desc);
const dTag = (d: DemoMeta) => tx(d.tag);
const hay = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(' ').toLowerCase();


/** 云澜 mark: an indigo→cyan "C" wrapping a 澜 ripple, with a droplet at the opening. Same geometry as /logo.svg. */
function BrandLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bl-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1b2150" /><stop offset="1" stopColor="#0a0f22" /></linearGradient>
        <linearGradient id="bl-c" x1="0.15" y1="0.1" x2="0.85" y2="0.95"><stop offset="0" stopColor="#a5b4fc" /><stop offset=".5" stopColor="#818cf8" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
        <linearGradient id="bl-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#67e8f9" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#bl-bg)" />
      <path className="logo-c" d="M47.6 19.4A20 20 0 1 0 47.6 44.6" fill="none" stroke="url(#bl-c)" strokeWidth="7.5" strokeLinecap="round" />
      <path className="logo-w" d="M20 34.5c4-6 8-6 12 0s8 6 12 0" fill="none" stroke="url(#bl-w)" strokeWidth="4.6" strokeLinecap="round" />
      <circle className="logo-d" cx="50.5" cy="32" r="3.2" fill="#22d3ee" />
    </svg>
  );
}

function LangSwitch() {
  const l = useLang();
  return (
    <button type="button" className="btn icon-btn lang-btn" onClick={() => setLang(l === 'en' ? 'zh' : 'en')}
      aria-label={l === 'en' ? '切换到中文' : 'Switch to English'} title={l === 'en' ? '切换到中文' : 'Switch to English'}>
      <span aria-hidden>{l === 'en' ? '中' : 'EN'}</span>
    </button>
  );
}

function MusicToggle() {
  useLang();
  const m = useMusic();
  return (
    <div className={`music-ctl${m.on ? ' on' : ''}${m.ducked ? ' ducked' : ''}`}>
      <button type="button" className={`btn icon-btn music-btn${m.on ? ' on' : ''}`} aria-pressed={m.on}
        aria-label={tr(m.on ? '关闭背景音乐' : '开启背景音乐', m.on ? 'Turn background music off' : 'Turn background music on')}
        title={tr(m.on ? (m.ducked ? '背景音乐（演示发声中，已让路）' : '背景音乐：开') : '背景音乐：关', m.on ? (m.ducked ? 'Music (ducked for demo audio)' : 'Background music: on') : 'Background music: off')}
        onClick={() => setMusic(!m.on)}>
        <span aria-hidden>{m.on ? '♫' : '♪'}</span>
        {m.on && !m.ducked ? <i className="music-eq" aria-hidden><b /><b /><b /></i> : null}
      </button>
      {m.on && (
        <input type="range" className="music-vol" min={0} max={1} step={0.05} value={m.vol}
          aria-label={tr('音量', 'Volume')} onChange={(e) => setMusicVol(+e.target.value)} />
      )}
    </div>
  );
}

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
  const lang = useLang();
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
        demos: c.demos.filter((d) => hay(d.title, d.title_en, d.slug, d.tag, c.name, c.name_en).includes(q)),
      }))
      .filter((c) => c.demos.length > 0 || hay(c.name, c.name_en).includes(q) || c.key.includes(q));
  }, [q, lang]);

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
              <div className="brand-mark"><BrandLogo /></div>
              <div>
                <div className="brand-title">Component</div>
                <div className="brand-sub">Rust + React · {totalDemos} demos</div>
              </div>
            </Link>
            <button type="button" className="sidebar-close" aria-label={tr('关闭导航', 'Close navigation')} onClick={onClose}>✕</button>
          </div>
          <label className="sidebar-search">
            <span className="sr-only">{tr('筛选导航', 'Filter navigation')}</span>
            <input
              type="search"
              placeholder={tr('筛选分类 / Demo…', 'Filter categories / demos…')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label={tr('筛选侧栏', 'Filter sidebar')}
            />
            {filter && (
              <button type="button" className="sidebar-search-clear" onClick={() => setFilter('')} aria-label={tr('清除', 'Clear')}>✕</button>
            )}
          </label>
        </div>
        <nav className="nav" aria-label="Categories" ref={navRef as never}>
          <div className="nav-section-label">{tr('浏览', 'Browse')}</div>
          <Link to="/" className={`nav-item nav-home${r === '/' ? ' active' : ''}`}>
            <span className="icon">⌂</span>
            <span className="nav-label">{tr('首页', 'Home')}</span>
            <em className="count">{totalDemos}</em>
          </Link>
          <div className="nav-section-label">{tr('演示库', 'Library')}</div>
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
                    title={groupOpen ? tr(`折叠 ${c.name}`, `Collapse ${cName(c)}`) : tr(`展开 ${c.name}`, `Expand ${cName(c)}`)}
                    aria-expanded={groupOpen}
                    onClick={() => toggleGroup(c.key)}
                  >
                    <span className="icon">{c.icon}</span>
                    <span className="nav-label">{cName(c)}</span>
                    <em className="count">{c.demos.length}</em>
                    {!q && (
                      <span className={`nav-chevron-inline${groupOpen ? ' open' : ''}`} aria-hidden>▾</span>
                    )}
                  </button>
                </div>
                <AccordionPanel open={groupOpen} label={cName(c)}>
                    {c.demos.slice(0, q ? 80 : 48).map((d) => {
                      const path = `/${c.key}/${d.slug}`;
                      const on = r === path;
                      return (
                        <Link
                          key={d.slug}
                          to={path}
                          className={`nav-sub${on ? ' active' : ''}`}
                          title={dHint(d) || dDesc(d)}
                          tabIndex={groupOpen ? 0 : -1}
                          onClick={onClose}
                        >
                          <span className="nav-sub-dot" aria-hidden />
                          <span className="nav-sub-title">{dTitle(d)}</span>
                          <span className="nav-sub-tag">{dTag(d)}</span>
                        </Link>
                      );
                    })}
                    {c.demos.length > (q ? 80 : 48) && (
                      <Link to={`/${c.key}`} className="nav-sub more" tabIndex={groupOpen ? 0 : -1} onClick={onClose}>{tr(`查看全部 ${c.demos.length} →`, `View all ${c.demos.length} →`)}</Link>
                    )}
                </AccordionPanel>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="nav-empty">{tr('无匹配演示', 'No matching demos')}</div>}
        </nav>
        <div className="sidebar-foot">
          <span>component.clyune.com</span>
          <span className="sidebar-foot-meta">{tr(`${categories.length} 类`, `${categories.length} categories`)}</span>
        </div>
      </aside>
      <div className={`sidebar-backdrop${open ? ' show' : ''}`} onClick={onClose} />
    </>
  );
}

function DbBadge({ health }: { health: Health | null }) {
  if (!health) return <><b>…</b><span>{tr('数据库', 'Database')}</span></>;
  const ok = health.ok && health.db === 'postgres';
  return (
    <>
      <b className={ok ? 'ok' : 'bad'}>{ok ? 'ON' : health.db === 'fallback-json' ? 'JSON' : 'OFF'}</b>
      <span>{ok ? 'Postgres' : health.db}</span>
    </>
  );
}

function Home({ health }: { health: Health | null }) {
  useLang();
  return (
    <>
      <section className="card hero">
        <h1>{tr('云澜组件库 · Component Gallery', 'Clyune Component Gallery')}</h1>
        {en() ? (
          <p>
            An admin-dashboard-style showcase of front-end techniques and web effects: {categories.length} categories, {totalDemos} interactive demos.
            This is the <strong>Rust (Axum) + React (Vite)</strong> port; demo code loads on demand from CDN / local kits.
          </p>
        ) : (
          <p>
            管理后台风格的前端技术与 Web 特效演示站：{categories.length} 个分类、{totalDemos} 个可交互 Demo。
            本仓库为 <strong>Rust (Axum) + React (Vite)</strong> 移植版；演示逻辑按需走 CDN / 本地 kit。
          </p>
        )}
        <div className="stats">
          <div><b><CountUp n={categories.length} /></b><span>{tr('分类', 'Categories')}</span></div>
          <div><b><CountUp n={totalDemos} /></b><span>Demos</span></div>
          <div><DbBadge health={health} /></div>
        </div>
      </section>
      <div className="grid stagger">
        {categories.map((c, i) => (
          <Link key={c.key} className="card tile ripple press" to={`/${c.key}`} style={{ ...catStyle(c.key), ['--i' as string]: Math.min(i, 14) }}>
            <div className="tile-head">
              <span className="tile-icon">{c.icon}</span>
              <h3>{cName(c)}</h3>
            </div>
            <p>{cIntro(c)}</p>
            <span className="tag">{c.demos.length} demos</span>
          </Link>
        ))}
      </div>
      <section className="card overview">
        <h2>{tr('分类总览', 'Overview')}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{tr('分类', 'Category')}</th><th className="num">{tr('数量', 'Count')}</th><th>{tr('Demos（节选）', 'Demos (sample)')}</th></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.key}>
                  <td><Link to={`/${c.key}`}>{c.icon} {cName(c)}</Link></td>
                  <td className="num">{c.demos.length}</td>
                  <td className="muted">{c.demos.slice(0, 8).map((d) => dTitle(d)).join(' · ')}{c.demos.length > 8 ? ' …' : ''}</td>
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
  useLang();
  const { ready, live } = useCatalog();
  if (!c) return <NotFound />;
  const ql = q.trim().toLowerCase();
  const demos = ql
    ? c.demos.filter((d) => hay(d.title, d.title_en, d.tag, d.slug).includes(ql))
    : c.demos;
  const tags = new Set(c.demos.map((d) => d.tag)).size;
  const n = (live?.byCat[c.key] || c.demos.length);
  return (
    <div className="cat-page" style={catStyle(c.key)}>
      <section className="card cat-hero">
        <div className="cat-hero-glow" aria-hidden />
        <nav className="cat-crumb" aria-label={tr('面包屑', 'Breadcrumb')}>
          <Link to="/" className="cat-back ripple press" aria-label={tr('返回首页', 'Back to home')}>←</Link>
          <Link to="/" className="cat-crumb-home">{tr('首页', 'Home')}</Link>
          <span className="cat-crumb-sep">/</span>
          <span className="cat-crumb-cur">{cName(c)}</span>
        </nav>
        <div className="cat-hero-main">
          <span className="cat-icon" aria-hidden>{c.icon}</span>
          <div className="cat-hero-text">
            <span className="cat-kicker">{tr('分类 · Level 2', 'Category · Level 2')}</span>
            <h1>{cName(c)}</h1>
            <p>{cIntro(c)}</p>
          </div>
        </div>
        <div className="cat-stats">
          <div><b>{ready ? <CountUp n={n} /> : <i className="skel skel-num" />}</b><span>Demos</span></div>
          <div><b><CountUp n={tags} /></b><span>{tr('标签', 'Tags')}</span></div>
          <div><b><CountUp n={c.tech.length} /></b><span>{tr('技术栈', 'Tech')}</span></div>
        </div>
        <div className="chips">
          {c.tech.map((t) => <span key={t} className="chip">{tx(t)}</span>)}
        </div>
        <div className="cat-search">
          <input
            type="search"
            placeholder={tr(`在 ${c.name} 中筛选…`, `Filter ${cName(c)}…`)}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={tr('筛选演示', 'Filter demos')}
          />
          <span className="muted">{demos.length} / {c.demos.length}</span>
        </div>
      </section>
      {!ready ? (
        <div className="demo-list" aria-busy="true">
          {Array.from({ length: Math.min(8, c.demos.length) }, (_, i) => (
            <div key={i} className="card demo-row skel-row"><span className="skel skel-thumb" /><span className="skel-lines"><i className="skel" /><i className="skel" /></span></div>
          ))}
        </div>
      ) : demos.length === 0 ? (
        <section className="card placeholder fade-in"><h2>{tr('无结果', 'No results')}</h2><p>{tr('换个关键词试试', 'Try another keyword')}</p></section>
      ) : (
        <div className="demo-list stagger" key={ql}>
          {demos.map((d, i) => {
            const idx = c.demos.indexOf(d) + 1;
            return (
              <Link key={d.slug} className="card demo-row ripple press" to={`/${c.key}/${d.slug}`} style={{ ['--i' as string]: Math.min(i, 14) }}>
                <span className="demo-thumb" style={thumbStyle(c.key, d.slug, i)} aria-hidden>
                  <span className="demo-num">{String(idx).padStart(2, '0')}</span>
                </span>
                <span className="demo-body">
                  <span className="demo-row-title">{dTitle(d)}</span>
                  <span className="demo-row-desc">{dDesc(d) || dHint(d)}</span>
                  <span className="demo-row-tags"><span className="chip">{dTag(d)}</span>{d.hint && d.desc ? <span className="demo-row-hint">{dHint(d)}</span> : null}</span>
                </span>
                <span className="demo-go" aria-hidden>›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DemoPage() {
  const { category, slug } = useParams();
  const path = `/${category}/${slug}`;
  const demo = routes[path] as DemoMeta | undefined;
  const [resetKey, setResetKey] = useState(0);
  const [autoDemo, setAuto] = useState(() => isAutoDemo());
  const lang = useLang();
  useEffect(() => onAutoDemoChange(setAuto), []);
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
          <h1 className="demo-h1">{dTitle(demo)}</h1>
          <div className="demo-meta">
            <span className="tag">{dTag(demo)}</span>
            <span className="hint">{dHint(demo) || dDesc(demo)}</span>
          </div>
        </div>
        <div className="demo-actions">
          <Link className="btn" to={`/${cat.key}`} title={cName(cat)}>
            <span className="btn-full">← {cName(cat)}</span>
            <span className="btn-short" aria-hidden>{tr('← 返回', '← Back')}</span>
          </Link>
          {prev && (
            <Link className="btn" to={`/${cat.key}/${prev.slug}`} title={dTitle(prev)}>
              <span className="btn-full">{tr('‹ 上一个', '‹ Prev')}</span>
              <span className="btn-short" aria-hidden>‹</span>
            </Link>
          )}
          {next && (
            <Link className="btn" to={`/${cat.key}/${next.slug}`} title={dTitle(next)}>
              <span className="btn-full">{tr('下一个 ›', 'Next ›')}</span>
              <span className="btn-short" aria-hidden>›</span>
            </Link>
          )}
          <button type="button" className={`btn auto-demo-btn${autoDemo ? ' on' : ''}`} aria-pressed={autoDemo}
            title={tr('开启后演示会自动滑动指针/滚动/示范操作；关闭后仅响应真实触摸或鼠标', 'When on, demos drive a synthetic pointer / scroll / walkthrough; when off they respond only to real touch or mouse')}
            onClick={() => setAuto(setAutoDemo(!autoDemo))}>
            <span className="btn-full">{autoDemo ? tr('自动演示 开', 'Auto demo: on') : tr('自动演示 关', 'Auto demo: off')}</span>
            <span className="btn-short" aria-hidden>{autoDemo ? tr('自动开', 'Auto on') : tr('自动关', 'Auto off')}</span>
          </button>
          <button type="button" className="btn primary" onClick={() => setResetKey((k) => k + 1)} title={tr('快捷键 R', 'Shortcut: R')}>{tr('重置', 'Reset')}</button>
        </div>
      </div>
      <DemoHost key={`${resetKey}-${lang}`} mod={demo.mod} fn={demo.fn} variant={demo.variant} slug={demo.slug} />
    </div>
  );
}

function NotFound() {
  return (
    <section className="card placeholder">
      <h2>404</h2>
      <p>{tr('未找到该页面', 'Page not found')}</p>
      <p><Link to="/">{tr('返回首页', 'Back to home')}</Link></p>
    </section>
  );
}

export default function App() {
  const { open, setOpen, close } = useSidebar();
  const health = useHealth();
  useRipple();
  const [filter, setFilter] = useState('');
  const lang = useLang();
  const loc = useLocation();
  const r = loc.pathname.length > 1 && loc.pathname.endsWith('/')
    ? loc.pathname.slice(0, -1)
    : loc.pathname || '/';
  const cat = categories.find((c) => `/${c.key}` === r);
  const demo = routes[r];
  const crumb = r === '/' ? tr('首页', 'Home') : cat ? cName(cat) : demo ? `${cName(demo.cat!)} / ${dTitle(demo)}` : r;
  const seoPage: SeoPage = r === '/' ? { kind: 'home' } : cat ? { kind: 'cat', cat } : demo ? { kind: 'demo', cat: demo.cat!, demo } : { kind: '404' };
  useSeo(seoPage, r, lang);
  useEffect(() => { syncUrlLang(); }, [loc.pathname, loc.search, lang]);

  return (
    <div id="app">
      <Sidebar open={open} onClose={close} filter={filter} setFilter={setFilter} />
      <main className="main">
        <header className="topbar">
          <button type="button" className={`menu-toggle${open ? ' open' : ''}`} aria-label={tr('打开或关闭导航', 'Toggle navigation')} aria-controls="sidebar" aria-expanded={open} onClick={() => setOpen((v) => !v)}>☰</button>
          <div className="breadcrumb">{crumb}</div>
          <div className="topbar-search">
            <input
              type="search"
              placeholder={tr('搜索演示…', 'Search demos…')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label={tr('搜索演示', 'Search demos')}
            />
          </div>
          <div className="topbar-right">
            <span className={`pill db ${health?.db === 'postgres' ? 'ok' : ''}`}>
              {health ? (health.db === 'postgres' ? 'DB · Postgres' : `DB · ${health.db}`) : 'DB · …'}
            </span>
            <span className="pill">rust+react</span>
            <MusicToggle />
            <LangSwitch />
          </div>
        </header>
        <div className={`content${demo ? ' content--demo' : ''}`} id="main-scroll">
          <RouteView render={(l) => (
            <Routes location={l}>
              <Route path="/" element={<Home health={health} />} />
              <Route path="/:category" element={<CategoryPage />} />
              <Route path="/threejs/trig-waves" element={<Navigate to="/math/trig-waves" replace />} />
              <Route path="/:category/:slug" element={<DemoPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )} />
        </div>
      </main>
    </div>
  );
}
