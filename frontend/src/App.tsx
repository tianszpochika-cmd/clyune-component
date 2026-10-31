import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { categories, routes, totalDemos, type Category, type DemoMeta } from './registry';
import { DemoHost } from './components/DemoHost';

function useSidebar() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return { open, setOpen, close: () => setOpen(false) };
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loc = useLocation();
  const r = loc.pathname.length > 1 && loc.pathname.endsWith('/')
    ? loc.pathname.slice(0, -1)
    : loc.pathname || '/';

  return (
    <>
      <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-title">Component</div>
            <div className="brand-sub">Rust + React port</div>
          </div>
        </div>
        <nav className="nav">
          <Link to="/" className={`nav-item${r === '/' ? ' active' : ''}`}>
            <span className="icon">⌂</span> Home<em className="count">{totalDemos}</em>
          </Link>
          {categories.map((c) => {
            const groupOpen = r === `/${c.key}` || r.startsWith(`/${c.key}/`);
            return (
              <div key={c.key} className={`nav-group${groupOpen ? ' open' : ''}`}>
                <Link to={`/${c.key}`} className={`nav-item${r === `/${c.key}` || r.startsWith(`/${c.key}/`) ? ' active' : ''}`}>
                  <span className="icon">{c.icon}</span> {c.name}
                  <em className="count">{c.demos.length}</em>
                </Link>
                <div className="nav-children">
                  {c.demos.map((d) => (
                    <Link
                      key={d.slug}
                      to={`/${c.key}/${d.slug}`}
                      className={`nav-sub${r === `/${c.key}/${d.slug}` ? ' active' : ''}`}
                    >
                      {d.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">component.clyune.com</div>
      </aside>
      <div className={`sidebar-backdrop${open ? ' show' : ''}`} onClick={onClose} />
    </>
  );
}

function Home() {
  return (
    <>
      <section className="card hero">
        <h1>Component Gallery</h1>
        <p>
          管理后台风格的前端技术与 Web 特效演示站：{categories.length} 个分类、{totalDemos} 个可交互 Demo。
          本仓库为 <strong>Rust (Axum) + React (Vite)</strong> 移植版；演示逻辑沿用原站 mount() 函数，依赖仍按需走 CDN。
        </p>
        <div className="stats">
          <div><b>{categories.length}</b><span>分类</span></div>
          <div><b>{totalDemos}</b><span>Demos</span></div>
          <div><b>0</b><span>数据库</span></div>
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
              <tr><th>分类</th><th className="num">数量</th><th>Demos</th></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.key}>
                  <td><Link to={`/${c.key}`}>{c.icon} {c.name}</Link></td>
                  <td className="num">{c.demos.length}</td>
                  <td className="muted">{c.demos.map((d) => d.title).join(' · ')}</td>
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
  if (!c) return <NotFound />;
  return (
    <>
      <section className="card hero">
        <h1>{c.icon} {c.name}</h1>
        <p>{c.intro}</p>
        <div className="chips">
          {c.tech.map((t) => <span key={t} className="chip">{t}</span>)}
          <span className="chip accent">{c.demos.length} demos</span>
        </div>
      </section>
      <div className="grid">
        {c.demos.map((d) => (
          <Link key={d.slug} className="card tile" to={`/${c.key}/${d.slug}`}>
            <h3>{d.title}</h3>
            <p>{d.desc || d.hint}</p>
            <span className="tag">{d.tag}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function DemoPage() {
  const { category, slug } = useParams();
  const path = `/${category}/${slug}`;
  const demo = routes[path] as DemoMeta | undefined;
  const [resetKey, setResetKey] = useState(0);
  if (!demo) return <NotFound />;
  const cat = demo.cat as Category;
  return (
    <div className="demo-wrap">
      <div className="card demo-toolbar">
        <h2>{demo.title}</h2>
        <span className="hint">{demo.hint || ''}</span>
        <Link className="btn" to={`/${cat.key}`}>← {cat.name}</Link>
        <button type="button" className="btn" onClick={() => setResetKey((k) => k + 1)}>Reset</button>
      </div>
      <DemoHost key={resetKey} mod={demo.mod} fn={demo.fn} />
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
      <Sidebar open={open} onClose={close} />
      <main className="main">
        <header className="topbar">
          <button type="button" className="menu-toggle" aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}>☰</button>
          <div className="breadcrumb">{crumb}</div>
          <div className="topbar-right"><span className="pill">rust+react</span></div>
        </header>
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:category" element={<CategoryPage />} />
            <Route path="/:category/:slug" element={<DemoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
