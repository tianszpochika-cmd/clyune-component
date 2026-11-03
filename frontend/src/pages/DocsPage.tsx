/* 「原理与代码」 per-demo docs page: /:category/:slug/docs. Data is generated at build time by
   scripts/docs/build-docs.mjs and fetched lazily from /docs-data/<cat>/<slug>.json (+ shared kit code). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { routes, type Category, type DemoMeta } from '../registry';
import { tr, useLang, translateTree } from '../lib/i18n';
import { Cover, thumbStyle } from '../lib/ux';

type L2 = { zh: string; en: string };
type Code = { title: string; file: string; url: string; a: number; b: number; html: string[]; raw: string };
type Walk = { file: string; a: number; b: number; zh: string; en: string; sub?: number };
type Api = { name: string; from: string; kind: string; zh: string; en: string; link: string };
type Dep = { name: string; kind: string; ver: string; npm?: string; docs?: string; gh?: string; cdn?: string };
type Pr = { title: string; tip: string; formula: string; explain: string; params: [string, string][]; example: string; rows: string[] };
type Doc = {
  cat: string; slug: string; mod: string; fam: string | null; file: string; fileUrl: string;
  title: L2; cat_name: L2; desc: L2; hint: L2; steps: L2[];
  env: { apis: { k: string; zh: string; en: string; link: string }[]; fw: Dep[]; mobile: L2 };
  deps: Dep[]; locals: { name: string; url: string; lines: number }[]; apis: Api[]; code: Code[];
  shared: { kit: string; names: string[] } | null; walk: Walk[]; principle: { zh: Pr; en: Pr };
};
type Shared = Record<string, Code & { walk: Walk[] }>;

const cache = new Map<string, Promise<Doc>>();
const kitCache = new Map<string, Promise<Shared>>();
const getJson = <T,>(u: string) => fetch(u).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<T>; });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** `code` spans in generated prose → <code>. */
const md = (s: string) => ({ __html: esc(s).replace(/`([^`]+)`/g, '<code>$1</code>') });

const SECS = [
  ['logic', '运行逻辑', 'Runtime logic'], ['env', '运行环境', 'Environment'], ['deps', '引入的组件名称和地址', 'Dependencies'],
  ['apis', '引入的组件函数', 'Imported APIs & functions'], ['code', '本 demo 代码', 'Source code'], ['walk', '代码解释', 'Code walkthrough'], ['theory', '原理', 'Principles'],
] as const;

function CodeBlock({ c, open = true }: { c: Code; open?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    const ok = () => { setDone(true); setTimeout(() => setDone(false), 1400); };
    navigator.clipboard?.writeText(c.raw).then(ok, () => {
      const t = document.createElement('textarea'); t.value = c.raw; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (_) { /* ignore */ } t.remove();
    });
  };
  const body = (
    <pre className="dc-pre" tabIndex={0}><code>{c.html.map((h, i) => (
      <span key={i} className="dc-ln"><span className="dc-no" aria-hidden>{c.a + i}</span><span dangerouslySetInnerHTML={{ __html: h || ' ' }} /></span>
    ))}</code></pre>
  );
  return (
    <figure className="dc-code">
      <figcaption className="dc-code-head">
        <span className="dc-code-title"><code>{c.title}</code></span>
        <a className="dc-code-src" href={c.url} target="_blank" rel="noopener noreferrer" title={tr('在 GitHub 上查看', 'View on GitHub')}>{c.file.replace(/^frontend\/src\//, '')} · L{c.a}–{c.b} ↗</a>
        <button type="button" className="btn dc-copy" onClick={copy}>{done ? tr('已复制', 'Copied') : tr('复制', 'Copy')}</button>
      </figcaption>
      {open ? body : null}
    </figure>
  );
}

function Lazy({ summary, children }: { summary: ReactNode; children: () => ReactNode }) {
  const [o, setO] = useState(false);
  return <details className="dc-more" onToggle={(e) => setO((e.target as HTMLDetailsElement).open)}><summary>{summary}</summary>{o ? children() : null}</details>;
}

function WalkList({ rows, l, base }: { rows: Walk[]; l: 'zh' | 'en'; base: string }) {
  return (
    <ol className="dc-walk">
      {rows.map((w, i) => (
        <li key={i} className={w.sub ? 'sub' : ''}>
          <a className="dc-lines" href={`${base}${w.file}#L${w.a}${w.b !== w.a ? `-L${w.b}` : ''}`} target="_blank" rel="noopener noreferrer">L{w.a}{w.b !== w.a ? `–${w.b}` : ''}</a>
          <span dangerouslySetInnerHTML={md(w[l] || w.zh)} />
        </li>
      ))}
    </ol>
  );
}

export default function DocsPage() {
  const { category, slug } = useParams();
  const lang = useLang();
  const l: 'zh' | 'en' = lang === 'en' ? 'en' : 'zh';
  const demoPath = `/${category}/${slug}`;
  const demo = routes[demoPath] as DemoMeta | undefined;
  const [doc, setDoc] = useState<Doc | null>(null);
  const [err, setErr] = useState('');
  const [shared, setShared] = useState<Shared | null>(null);
  const theoryRef = useRef<HTMLDivElement>(null);
  const lq = l === 'en' ? '?lang=en' : '';

  useEffect(() => {
    if (!demo) return;
    let dead = false; setDoc(null); setErr(''); setShared(null);
    const k = `${category}/${slug}`;
    if (!cache.has(k)) cache.set(k, getJson<Doc>(`/docs-data/${k}.json`));
    cache.get(k)!.then((d) => {
      if (dead) return; setDoc(d);
      if (d.shared) {
        if (!kitCache.has(d.shared.kit)) kitCache.set(d.shared.kit, getJson<Shared>(`/docs-data/_kit/${d.shared.kit}.json`));
        kitCache.get(d.shared.kit)!.then((s) => { if (!dead) setShared(s); }).catch(() => {});
      }
    }).catch((e) => { cache.delete(k); if (!dead) setErr(String(e)); });
    return () => { dead = true; };
  }, [category, slug, demo]);
  // English fallback: anything the build-time translator left in Chinese goes through the live dictionary
  useEffect(() => (doc && theoryRef.current ? translateTree(theoryRef.current) : undefined), [doc, l]);
  useEffect(() => { document.getElementById('main-scroll')?.scrollTo(0, 0); }, [demoPath]);

  const base = 'https://github.com/tianszpochika-cmd/clyune-component/blob/main/';
  const sharedRows = useMemo(() => (doc?.shared && shared ? doc.shared.names.map((n) => shared[n]).filter(Boolean) : []), [doc, shared]);
  if (!demo) return <section className="card placeholder"><h2>404</h2><p><Link to="/">{tr('返回首页', 'Back to home')}</Link></p></section>;
  const cat = demo.cat as Category;
  const title = l === 'en' ? demo.title_en || demo.title : demo.title;
  const catName = l === 'en' ? cat.name_en || cat.name : cat.name;
  const desc = l === 'en' ? demo.desc_en || demo.desc : demo.desc;
  const idx = cat.demos.findIndex((d) => d.slug === demo.slug);
  const P = doc ? { ...doc.principle.zh, ...Object.fromEntries(Object.entries(doc.principle[l]).filter(([, v]) => (Array.isArray(v) ? v.some((x) => (Array.isArray(x) ? x[0] : x)) : v))) } as Pr : null;
  const go = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(`dc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const toc = (
    <ol>{SECS.map(([id, zh, en], i) => <li key={id}><a href={`#dc-${id}`} onClick={go(id)}><span className="dc-toc-n">{i + 1}</span>{l === 'en' ? en : zh}</a></li>)}</ol>
  );
  const sec = (i: number, body: ReactNode) => {
    const [id, zh, en] = SECS[i];
    return <section className="card dc-sec" id={`dc-${id}`} aria-labelledby={`dc-h-${id}`}><h2 id={`dc-h-${id}`}><span className="dc-sec-n">{i + 1}</span>{l === 'en' ? en : zh}{l === 'zh' ? <small>{en}</small> : null}</h2>{body}</section>;
  };
  const depLinks = (d: Dep) => (
    <span className="dc-links">
      {d.npm ? <a href={d.npm} target="_blank" rel="noopener noreferrer">npm</a> : null}
      {d.docs ? <a href={d.docs} target="_blank" rel="noopener noreferrer">{tr('文档', 'Docs')}</a> : null}
      {d.gh ? <a href={d.gh} target="_blank" rel="noopener noreferrer">GitHub</a> : null}
      {d.cdn ? <a href={d.cdn} target="_blank" rel="noopener noreferrer">CDN</a> : null}
    </span>
  );

  return (
    <div className="docs-wrap">
      <header className="card dc-hero">
        <Link className="dc-thumb" to={demoPath + lq} style={thumbStyle(cat.key, demo.slug, Math.max(0, idx))} aria-label={tr('打开演示', 'Open the demo')}>
          <Cover cat={cat.key} slug={demo.slug} tag={demo.tag} />
          <span className="dc-thumb-play" aria-hidden>▶</span>
          <span className="dc-thumb-num">{String(idx + 1).padStart(2, '0')}</span>
        </Link>
        <div className="dc-hero-body">
          <div className="dc-crumbs"><Link to={`/${cat.key}${lq}`}>{catName}</Link><span aria-hidden> / </span><Link to={demoPath + lq}>{title}</Link></div>
          <h1 className="dc-h1">{title}<span className="dc-h1-sub">{tr('原理与代码', 'How it works & code')}</span></h1>
          {desc ? <p className="dc-desc">{desc}</p> : null}
          <div className="dc-actions">
            <Link className="btn primary" to={demoPath + lq}>{tr('← 返回演示', '← Back to demo')}</Link>
            {doc ? <a className="btn" href={doc.fileUrl} target="_blank" rel="noopener noreferrer">GitHub ↗</a> : null}
            <span className="chip">{catName}</span>
            {doc ? <span className="chip dc-mod"><code>{doc.mod}{doc.fam ? ` · ${doc.fam}` : ''}</code></span> : null}
          </div>
        </div>
      </header>

      <div className="dc-grid">
        <aside className="dc-toc-side" aria-label={tr('目录', 'Contents')}><div className="dc-toc-title">{tr('目录', 'Contents')}</div>{toc}</aside>
        <div className="dc-main">
          <details className="card dc-toc-mobile"><summary>{tr('目录', 'Contents')}</summary>{toc}</details>
          {err ? <section className="card placeholder"><p>{tr('文档加载失败', 'Failed to load docs')}: {err}</p></section> : null}
          {!doc && !err ? <section className="card dc-sec"><div className="skel" style={{ height: 14, width: '60%' }} /><div className="skel" style={{ height: 14, width: '85%', marginTop: 10 }} /></section> : null}
          {doc && P ? (<>
            {sec(0, <ol className="dc-steps">{doc.steps.map((s, i) => <li key={i} dangerouslySetInnerHTML={md(s[l] || s.zh)} />)}</ol>)}
            {sec(1, <>
              <table className="dc-table"><tbody>
                {doc.env.apis.map((a) => <tr key={a.k}><th><a href={a.link} target="_blank" rel="noopener noreferrer">{a.k}</a></th><td>{a[l]}</td></tr>)}
              </tbody></table>
              <p className="dc-sub">{tr('框架与构建（版本取自 package-lock.json）', 'Framework & build (versions from package-lock.json)')}</p>
              <ul className="dc-tags">{doc.env.fw.map((f) => <li key={f.name}><code>{f.name}@{f.ver}</code>{depLinks(f)}</li>)}</ul>
              <p className="dc-note">📱 {doc.env.mobile[l]}</p>
            </>)}
            {sec(2, <>
              {doc.deps.length ? (
                <table className="dc-table"><thead><tr><th>{tr('包', 'Package')}</th><th>{tr('版本', 'Version')}</th><th>{tr('来源', 'Source')}</th><th>{tr('链接', 'Links')}</th></tr></thead><tbody>
                  {doc.deps.map((d) => <tr key={d.name}><td><code>{d.name}</code></td><td>{d.ver}</td><td>{d.kind === 'cdn' ? tr('CDN 按需加载', 'CDN, on demand') : 'npm'}</td><td>{depLinks(d)}</td></tr>)}
                </tbody></table>
              ) : <p>{tr('没有第三方库，只用浏览器原生 API。', 'No third-party library — browser APIs only.')}</p>}
              <p className="dc-sub">{tr('项目内模块（import 依赖图）', 'Project modules (import graph)')}</p>
              <ul className="dc-files">{doc.locals.map((f) => <li key={f.name}><a href={f.url} target="_blank" rel="noopener noreferrer"><code>{f.name}</code></a><span>{f.lines} {tr('行', 'lines')}</span></li>)}</ul>
            </>)}
            {sec(3, <table className="dc-table dc-apis"><thead><tr><th>{tr('名称', 'Name')}</th><th>{tr('来自', 'From')}</th><th>{tr('作用', 'What it does')}</th></tr></thead><tbody>
              {doc.apis.map((a, i) => <tr key={i}><td>{a.link ? <a href={a.link} target="_blank" rel="noopener noreferrer"><code>{a.name}</code></a> : <code>{a.name}</code>}</td><td><code>{a.from}</code></td><td>{a[l] || a.zh}</td></tr>)}
            </tbody></table>)}
            {sec(4, <>
              <p className="dc-note">{tr('以下代码在构建时从仓库源码中提取；本 demo 专属的部分在前，共享辅助代码可展开查看。', 'Extracted from the repository at build time: the demo-specific parts first, shared helpers expandable below.')} <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">{doc.file} ↗</a></p>
              {doc.code.map((c, i) => <CodeBlock key={i} c={c} />)}
              {sharedRows.length ? <>
                <p className="dc-sub">{tr(`共享辅助代码（${sharedRows.length} 段，同文件）`, `Shared helpers (${sharedRows.length}, same file)`)}</p>
                {sharedRows.map((c) => <Lazy key={c.title} summary={<><code>{c.title}</code> <span className="dc-dim">L{c.a}–{c.b}</span></>}>{() => <CodeBlock c={c} />}</Lazy>)}
              </> : null}
            </>)}
            {sec(5, <>
              <WalkList rows={doc.walk} l={l} base={base} />
              {sharedRows.length ? <>
                <p className="dc-sub">{tr('用到的共享代码', 'Shared code it uses')}</p>
                <WalkList rows={sharedRows.flatMap((c) => c.walk.map((w) => ({ ...w, file: c.file })))} l={l} base={base} />
              </> : null}
            </>)}
            {sec(6, <div ref={theoryRef} className="dc-theory">
              {P.formula ? <><h3>{tr('公式', 'Formula')}</h3><div className="mip-formula dc-formula" dangerouslySetInnerHTML={{ __html: P.formula }} /></> : null}
              {P.explain ? <><h3>{tr('说明', 'Explanation')}</h3><div className="dc-prose" dangerouslySetInnerHTML={{ __html: P.explain }} /></> : null}
              {P.params?.length ? <><h3>{tr('参数', 'Parameters')}</h3><table className="dc-table"><tbody>{P.params.map(([a, b], i) => <tr key={i}><th>{a || doc.principle.zh.params[i]?.[0]}</th><td>{b || doc.principle.zh.params[i]?.[1]}</td></tr>)}</tbody></table></> : null}
              {P.example ? <><h3>{tr('用法', 'How to use')}</h3><div className="dc-prose" dangerouslySetInnerHTML={{ __html: P.example }} /></> : null}
              {P.tip ? <p className="dc-note">💡 {P.tip}</p> : null}
            </div>)}
          </>) : null}
          <nav className="dc-foot"><Link className="btn" to={demoPath + lq}>{tr('← 返回演示', '← Back to demo')}</Link></nav>
        </div>
      </div>
    </div>
  );
}
