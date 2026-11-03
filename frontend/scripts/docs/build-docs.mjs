/**
 * Build per-demo docs data (「原理与代码」 pages) from the real source at build time.
 *   node scripts/docs/build-docs.mjs
 * Inputs : public/registry.json, src/demoLoader.ts, demo/kit sources (TypeScript AST), package-lock.json,
 *          src/lib/load.js (CDN libs), scripts/docs-runtime.json (evaluated info-panel docs), src/i18n/en.json.
 * Outputs: public/docs-data/<cat>/<slug>.json, public/docs-data/_kit/<kit>.json (shared code),
 *          ../backend/data/docs-seo.json (server-rendered title/description/sections for crawlers).
 */
import fs from 'node:fs';
import path from 'node:path';
import { load, graph, families, familyBlocks, members, idents, ts, SRC, ROOT } from './analyze.mjs';
import { highlight } from './highlight.mjs';
import * as D from './api-desc.mjs';
import { txScope, txStr, txHtml, hasCJK } from './tx-node.mjs';

const REPO = 'https://github.com/tianszpochika-cmd/clyune-component';
const BLOB = `${REPO}/blob/main/`;
const OUT = path.join(ROOT, 'public/docs-data');
const SEO_OUT = path.join(ROOT, '../backend/data/docs-seo.json');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const reg = rd('public/registry.json');
const lock = rd('package-lock.json');
const pkg = rd('package.json');
const runtime = rd('scripts/docs-runtime.json');
const EN = (() => { try { return rd('src/i18n/en.json'); } catch (_) { return {}; } })();
const CJK = /[\u3400-\u9fff]/;
const ver = (n) => lock.packages?.[`node_modules/${n}`]?.version || '';
const loaderSrc = fs.readFileSync(path.join(SRC, 'demoLoader.ts'), 'utf8');
const MODS = Object.fromEntries([...loaderSrc.matchAll(/'([\w-]+)': \(\) => import\('\.\/(demos\/[^']+)'\)/g)].map((x) => [x[1], path.join(SRC, x[2])]));
const loadJs = fs.readFileSync(path.join(SRC, 'lib/load.js'), 'utf8');
const CDN = Object.fromEntries([...loadJs.matchAll(/(\w+): (?:async )?\(\) => [^\n]*?cdn\('([\w-]+)', '([\d.]+)'/g)].map((x) => [x[1], { pkg: x[2], ver: x[3] }]));
const rel = (f) => path.relative(path.join(ROOT, '..'), f).split(path.sep).join('/');
const gh = (f, a, b) => `${BLOB}${rel(f)}${a ? `#L${a}${b && b !== a ? `-L${b}` : ''}` : ''}`;
const uniq = (a) => [...new Set(a)];
const en = (zh) => { if (!zh) return ''; const e = txHtml(String(zh)); return e && !hasCJK(e) ? e : ''; };
const enLoose = (zh) => (zh ? txHtml(String(zh)) : '');

/* three.js docs paths from the installed source tree */
const THREE_PATH = {};
(function walk(d, base) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p, `${base}${f}/`); else if (f.endsWith('.js')) THREE_PATH[f.slice(0, -3)] ??= `${base}${f.slice(0, -3)}`; } })(path.join(ROOT, 'node_modules/three/src'), '');
const THREE_CONST = { AdditiveBlending: 'constants/Materials', DoubleSide: 'constants/Materials', SRGBColorSpace: 'constants/Core', ACESFilmicToneMapping: 'constants/Renderer', ClampToEdgeWrapping: 'constants/Textures', DynamicDrawUsage: 'constants/BufferAttributeUsage' };
const threeLink = (n) => `https://threejs.org/docs/#api/en/${THREE_CONST[n] || THREE_PATH[n] || ''}`;

/* ---------- code extraction ---------- */
const lines = (m, a, b) => m.text.split('\n').slice(a - 1, b);
function codeBlock(m, start, end, title) {
  // extend to full lines; include leading comment lines directly above
  let a = m.lineOf(start), b = m.lineOf(Math.max(start, end - 1));
  const all = m.text.split('\n');
  while (a > 1 && /^\s*(\/\/|\/\*|\*)/.test(all[a - 2])) a--;
  const raw = all.slice(a - 1, b).join('\n');
  return { title, file: rel(m.file), url: gh(m.file, a, b), a, b, html: highlight(raw), raw };
}
const BIG_TABLES = /^(FAM|FAMILIES|FAMILY_CONTROLS|PRESET_DEFAULTS|TITLES|UN|SHN|MAT|[A-Z_]*DOCS|FAMILY_PRESETS)$/;
function helperDecls(m, ranges, skip = new Set()) {
  const used = new Set();
  for (const [a, b] of ranges) idents(m, a, b).forEach((x) => used.add(x));
  const out = [];
  for (const [name, d] of m.decls) {
    if (!used.has(name) || skip.has(name) || BIG_TABLES.test(name)) continue;
    if (ranges.some(([a, b]) => d.start <= a && d.end >= b)) continue; // the decl that contains a block
    out.push(d);
  }
  return out;
}

/* ---------- detection inside a range ---------- */
const MATHF = new Set(['sin', 'cos', 'tan', 'atan2', 'hypot', 'sqrt', 'exp', 'log', 'pow', 'floor', 'round', 'abs', 'min', 'max', 'random', 'asin', 'acos', 'atan', 'sign', 'log2', 'log10', 'cbrt', 'ceil', 'trunc']);
function detect(m, a, b) {
  const mem = members(m, a, b, new Set(['ctx', 'gl', 'THREE', 'S', 'M', 'Math', 'A', 'ac', 'x', 'g', 'c']));
  const r = { canvas: new Set(), gl: new Set(), three: new Set(), stage: new Set(), matter: new Set(), math: new Set(), audio: new Set(), ret: new Set() };
  for (const v of mem.values()) {
    const o = v.obj;
    if ((o === 'ctx' || o === 'x' || o === 'g' || o === 'c') && v.call && D.CANVAS[v.name]) r.canvas.add(v.name);
    else if (o === 'gl' && v.call) r.gl.add(v.name);
    else if (o === 'THREE') r.three.add(v.name);
    else if (o === 'S' && D.STAGE[v.name]) r.stage.add(v.name);
    else if (o.startsWith('M.') && D.MATTER[`${o.slice(2)}.${v.name}`]) r.matter.add(`${o.slice(2)}.${v.name}`);
    else if (o === 'Math' && v.call && MATHF.has(v.name)) r.math.add(v.name);
    else if (o === 'A' && ['voices', 'hit', 'noise', 'startMic', 'micBuf'].includes(v.name)) r.audio.add(v.name);
  }
  const visit = (n) => {
    if (n.end < a || n.pos > b) return;
    if (ts.isReturnStatement(n) && n.expression && ts.isObjectLiteralExpression(n.expression) && n.getStart(m.sf) >= a && n.end <= b)
      n.expression.properties.forEach((p) => { const k = p.name?.getText?.(); if (k && !['hx', 'hy', 'ix'].includes(k)) r.ret.add(k); });
    ts.forEachChild(n, visit);
  };
  visit(m.sf);
  return r;
}
const list = (s, n = 8) => { const a = [...s]; return a.slice(0, n).map((x) => `\`${x}\``).join(', ') + (a.length > n ? ' …' : ''); };
function behaviour(r) {
  const zh = [], en2 = [];
  if (r.stage.has('onDown') || r.stage.has('onMove') || r.stage.has('onUp')) { const h = ['onDown', 'onMove', 'onUp'].filter((x) => r.stage.has(x)); zh.push(`注册指针事件 ${list(h.map((x) => 'S.' + x))}`); en2.push(`registers pointer handlers ${list(h.map((x) => 'S.' + x))}`); }
  if (r.canvas.size) { zh.push(`用 Canvas 2D 的 ${list(r.canvas, 6)} 绘制`); en2.push(`draws with Canvas 2D ${list(r.canvas, 6)}`); }
  if (r.three.size) { zh.push(`创建 three.js 对象 ${list(r.three, 6)}`); en2.push(`creates three.js objects ${list(r.three, 6)}`); }
  if (r.matter.size) { zh.push(`调用 Matter.js ${list(r.matter, 5)}`); en2.push(`calls Matter.js ${list(r.matter, 5)}`); }
  if (r.audio.size) { zh.push(`通过 ${list([...r.audio].map((x) => 'A.' + x))} 发声/取样`); en2.push(`produces/reads sound via ${list([...r.audio].map((x) => 'A.' + x))}`); }
  if (r.math.size) { zh.push(`数学计算用到 ${list([...r.math].map((x) => 'Math.' + x), 6)}`); en2.push(`math via ${list([...r.math].map((x) => 'Math.' + x), 6)}`); }
  if (r.ret.size) { zh.push(`返回读数 ${list(r.ret, 7)} 给信息面板`); en2.push(`returns readouts ${list(r.ret, 7)} to the info panel`); }
  return [zh.join('；'), en2.join('; ')];
}

/* ---------- walkthrough of one family definition ---------- */
const KEY = {
  title: ['标题（信息面板与控件面板显示）', 'Title shown in the info and control panels'],
  explain: ['「说明」正文', 'Body of the “Notes” section'], formula: ['「公式」主公式', 'Main formula of the “Formula” section'], formula2: ['第二条公式', 'Second formula line'],
  count: ['「数量」类滑块的范围与默认值', 'Range/default of the count slider'], size: ['「大小」类滑块的范围与默认值', 'Range/default of the size slider'],
  extra: ['本 demo 专属的额外滑块/开关', 'Extra demo-specific slider/toggle'], extras: ['额外控件列表', 'List of extra controls'],
  countDoc: ['数量参数的说明文字', 'Help text of the count parameter'], sizeDoc: ['大小参数的说明文字', 'Help text of the size parameter'], extraDoc: ['额外参数的说明文字', 'Help text of the extra parameter'],
  color: ['默认主色', 'Default main colour'], presets: ['预设按钮：名称 → 参数覆盖值', 'Preset buttons: name → parameter overrides'],
  spec: ['控件定义（颜色/速度/大小/数量/额外参数）', 'Control definitions (colour/speed/size/count/extras)'],
  doc: ['信息面板内容：实时读数行 rows(v)、公式、说明、参数、步骤', 'Info-panel content: live rows(v), formula, notes, params, steps'],
  build: ['初始化函数：建立状态并返回每帧回调', 'Init function: sets up state and returns the per-frame callback'],
  draw: ['每帧绘制函数', 'Per-frame draw function'], frag: ['GLSL 片元着色器源码（GPU 上每个像素执行一次）', 'GLSL fragment shader source (runs once per pixel on the GPU)'],
  period: ['动画周期（秒）', 'Animation period (s)'], radius: ['3D 取景半径', '3D framing radius'], label: ['舞台上的输入按钮文字', 'Label of the on-stage input pill'],
  css: ['对应的 CSS 写法（展示用）', 'Equivalent CSS (for reference)'], cursor: ['画布鼠标指针样式', 'Canvas cursor style'], tip: ['交互提示', 'Interaction hint'],
  target: ['相机注视点', 'Camera target'], res: ['离屏渲染分辨率上限', 'Offscreen render resolution cap'], spdLabel: ['速度滑块名称', 'Speed slider label'],
  fill: ['取景占比', 'Framing fill ratio'], camDir: ['初始相机方向', 'Initial camera direction'], noPhoto: ['不显示示例图片', 'Hide sample photo'],
  onDown: ['指针按下处理', 'Pointer-down handler'], onUp: ['指针抬起处理', 'Pointer-up handler'],
  min: ['最小值', 'Minimum'], max: ['最大值', 'Maximum'], step: ['步长', 'Step'], value: ['默认值', 'Default value'],
};
function objOfDef(n) {
  let r = n.expression ? n.expression.right : n.initializer;
  let factory = '';
  if (r && ts.isCallExpression(r)) { factory = r.expression.getText(); r = r.arguments.find((a) => ts.isObjectLiteralExpression(a)); }
  return { obj: r && ts.isObjectLiteralExpression(r) ? r : null, factory };
}
function strings(n, prop) { const s = []; const v = (x) => { if (ts.isPropertyAssignment(x) && x.name.getText() === prop && (ts.isStringLiteral(x.initializer) || ts.isNoSubstitutionTemplateLiteral(x.initializer))) s.push(x.initializer.text); if (ts.isCallExpression(x)) x.arguments.forEach((a, i) => { if (i === 1 && ts.isStringLiteral(a)) s.push(a.text); }); ts.forEachChild(x, v); }; v(n); return s; }
function walkDef(m, b) {
  const { obj, factory } = objOfDef(b.node);
  const out = [];
  if (factory) out.push({ a: m.lineOf(b.start), b: m.lineOf(b.end), zh: `调用工厂函数 \`${factory}()\` 生成本 demo 的完整定义（spec + doc + build），传入下面这些配置。`, en: `Calls the factory \`${factory}()\` to produce the full definition (spec + doc + build) from the options below.` });
  if (!obj) return out;
  for (const p of obj.properties) {
    const k = p.name?.getText?.().replace(/['"]/g, '') || '';
    const a = m.lineOf(p.getStart(m.sf)), z = m.lineOf(p.end);
    let [zh, e] = KEY[k] || [`属性 \`${k}\``, `Property \`${k}\``];
    if (k === 'spec' || k === 'count' || k === 'size' || k === 'extra' || k === 'extras') { const labs = uniq(strings(p, 'label')).slice(0, 6); if (labs.length) { zh += `：${labs.join('、')}`; const el = labs.map(en).filter(Boolean); if (el.length === labs.length) e += `: ${el.join(', ')}`; } }
    if (k === 'presets' && p.initializer && ts.isObjectLiteralExpression(p.initializer)) { const names = p.initializer.properties.map((q) => q.name?.getText().replace(/['"]/g, '')).filter(Boolean); zh += `（${names.length} 个：${names.slice(0, 6).join('、')}${names.length > 6 ? '…' : ''}）`; e += ` (${names.length})`; }
    if (k === 'title' && p.initializer && ts.isStringLiteral(p.initializer)) { zh += `：「${p.initializer.text}」`; const t = en(p.initializer.text); if (t) e += `: “${t}”`; }
    if (k === 'frag' || k === 'css') { const u = uniq((p.getText().match(/\bu_\w+/g) || [])); if (u.length) { zh += `；使用 uniform ${list(u)}`; e += `; uses uniforms ${list(u)}`; } }
    if (['build', 'draw', 'onDown', 'onUp'].includes(k) || (p.initializer && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) || ts.isMethodDeclaration(p)) {
      const [bz, be] = behaviour(detect(m, p.getStart(m.sf), p.end)); if (bz) { zh += `：${bz}`; e += `: ${be}`; }
    }
    out.push({ a, b: z, zh: zh + '。', en: e + '.' });
  }
  return out;
}
function walkBlock(m, b) {
  const a = m.lineOf(b.start), z = m.lineOf(b.end);
  const [bz, be] = behaviour(detect(m, b.start, b.end));
  if (b.kind === 'def') return walkDef(m, b);
  if (b.kind === 'table') return [{ a, b: z, zh: `\`${b.owner}\` 表中本 demo 的条目（${b.owner === 'TITLES' ? '标题' : b.owner.endsWith('DOCS') ? '信息面板文案：公式/说明/参数/步骤' : '控件配置'}）。`, en: `This demo's entry in the \`${b.owner}\` table (${b.owner === 'TITLES' ? 'title' : b.owner.endsWith('DOCS') ? 'info-panel text: formula/notes/params/steps' : 'control config'}).` }];
  if (b.kind === 'case') return [{ a, b: z, zh: `\`${b.fn || 'switch'}()\` 中 \`case\` 分支：本 demo 每帧的绘制代码${bz ? '，' + bz : ''}。`, en: `\`case\` branch in \`${b.fn || 'switch'}()\`: this demo's per-frame drawing${be ? ', ' + be : ''}.` }];
  return [{ a, b: z, zh: `\`${b.fn || '…'}()\` 中针对本 demo 的分支${bz ? '：' + bz : ''}。`, en: `Branch for this demo inside \`${b.fn || '…'}()\`${be ? ': ' + be : ''}.` }];
}
function cmt(node, text) {
  const rs = ts.getLeadingCommentRanges(text, node.pos) || [];
  if (!rs.length) return '';
  return rs.map((r) => text.slice(r.pos, r.end).replace(/^\/\*\*?|\*\/$/g, '').replace(/^\s*\*\s?/gm, '').replace(/^\/\/\s?/gm, '').trim()).join(' ').replace(/\s+/g, ' ').replace(/[-=─━*]{3,}/g, '').trim().slice(0, 240);
}
const bil = (c) => { const zh = c; const e = !c ? '' : CJK.test(c) ? txStr(c) : c; return [zh, CJK.test(e) ? '' : e]; };
function fnBody(st) {
  if (ts.isFunctionDeclaration(st)) return st.body;
  if (ts.isVariableStatement(st)) { const i = st.declarationList.declarations[0]?.initializer; if (i && (ts.isArrowFunction(i) || ts.isFunctionExpression(i)) && i.body && ts.isBlock(i.body)) return i.body; }
  return null;
}
function stmtSummary(m, st) {
  if (ts.isVariableStatement(st)) { const n = st.declarationList.declarations.map((d) => d.name.getText(m.sf)).filter((x) => x.length < 40).slice(0, 5); return [`定义 ${list(n, 5)}`, `defines ${list(n, 5)}`]; }
  if (ts.isFunctionDeclaration(st) && st.name) return [`内部函数 \`${st.name.text}()\``, `inner function \`${st.name.text}()\``];
  if (ts.isReturnStatement(st)) return ['返回结果/清理函数', 'returns the result / cleanup'];
  if (ts.isIfStatement(st)) return ['条件分支', 'conditional branch'];
  if (ts.isForStatement(st) || ts.isForOfStatement(st) || ts.isForInStatement(st) || ts.isWhileStatement(st)) return ['循环', 'loop'];
  if (ts.isExpressionStatement(st) && ts.isCallExpression(st.expression)) { const c = st.expression.expression.getText(m.sf).slice(0, 40); return [`调用 \`${c}()\``, `calls \`${c}()\``]; }
  if (ts.isExpressionStatement(st)) return ['赋值/表达式', 'assignment/expression'];
  return ['', ''];
}
function walkHelper(m, d) {
  const st = d.node;
  const kind = ts.isFunctionDeclaration(st) || fnBody(st) ? ['函数', 'function'] : ts.isClassDeclaration(st) ? ['类', 'class'] : ['常量/表', 'constant/table'];
  const [dz, de] = bil(d.doc && d.doc.length < 240 ? d.doc : '');
  const body = fnBody(st);
  const big = body && d.line1 - d.line0 > 40;
  const [bz, be] = big ? ['', ''] : behaviour(detect(m, d.start, d.end));
  const rows = [{ a: d.line0, b: d.line1, zh: `\`${d.name}\`（${kind[0]}）${dz ? '：' + dz : ''}${bz ? '；' + bz : ''}。`.replace(/。。$/, '。'), en: `\`${d.name}\` (${kind[1]})${de ? ': ' + de : ''}${be ? '; ' + be : ''}.`.replace(/\.\.$/, '.') }];
  if (big) {
    let seg = null; const segs = [];
    for (const x of body.statements) {
      const c = cmt(x, m.text); const a = m.lineOf(x.getStart(m.sf)), b = m.lineOf(x.end);
      if (!seg || c || (b - seg.a > 30 && seg.n > 0)) { seg = { a, b, c, first: x, n: 0, start: x.getStart(m.sf), end: x.end }; segs.push(seg); }
      seg.b = b; seg.end = x.end; seg.n++;
    }
    for (const g of segs) {
      const [cz, ce] = bil(g.c); const [sz, se] = stmtSummary(m, g.first); const [hz, he] = behaviour(detect(m, g.start, g.end));
      rows.push({ a: g.a, b: g.b, sub: 1, zh: [cz || sz, hz].filter(Boolean).join('；') + '。', en: [ce || se, he].filter(Boolean).join('; ') + '.' });
    }
  }
  return rows;
}

/* ---------- per-module facts ---------- */
const kitShared = new Map(); // file → { id, blocks: Map(name → block) }
function stageKind(files) {
  const has = (n) => [...files].some((f) => path.basename(f) === n);
  if (has('three-stage.js')) return 'three';
  if (has('canvas-stage.js')) return 'canvas';
  return 'custom';
}
function envFor(files, code) {
  const all = [...files].map((f) => load(f).text).join('\n') + code;
  const apis = [];
  const add = (k, zh, en2, link) => apis.push({ k, zh, en: en2, link });
  if (/getContext\('2d'\)/.test(all)) add('Canvas 2D', '2D 画布绘图', '2D canvas drawing', 'https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D');
  if (/WebGLRenderer/.test(all)) add('WebGL (three.js)', 'three.js 通过 WebGLRenderer 使用 WebGL', 'WebGL through three.js WebGLRenderer', 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API');
  if (/getContext\('webgl'/.test(code) || /makeGL/.test(code)) add('WebGL 1', '离屏 WebGL 画布运行 GLSL 片元着色器', 'Offscreen WebGL canvas running a GLSL fragment shader', 'https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext');
  if (/getAudio\(|AudioContext/.test(code)) add('Web Audio API', '共享 AudioContext 合成声音（受右上角声音开关控制）', 'Shared AudioContext synthesis (follows the top-right sound switch)', 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API');
  if (/getUserMedia|startMic/.test(code)) add('MediaDevices.getUserMedia', '麦克风输入（需 HTTPS 与用户授权）', 'Microphone input (HTTPS + permission required)', 'https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia');
  if (/requestAnimationFrame/.test(all)) add('requestAnimationFrame', '与屏幕刷新同步的动画循环', 'Display-synced animation loop', 'https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame');
  if (/ResizeObserver/.test(all)) add('ResizeObserver', '画布随容器尺寸自适应', 'Canvas follows container size', 'https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver');
  if (/pointerdown/.test(all) || /OrbitControls/.test(all)) add('Pointer Events', '鼠标/触摸/触控笔统一事件', 'Unified mouse/touch/pen events', 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events');
  if (/devicePixelRatio/.test(all)) add('devicePixelRatio', 'HiDPI 清晰渲染（上限 2×）', 'Crisp HiDPI rendering (capped at 2×)', 'https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio');
  return apis;
}

/* ---------- main ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, '_kit'), { recursive: true });
const seo = {};
const stats = { demos: 0, blocks: 0, walk: 0, apis: 0, enMissing: 0 };
const FW = [
  { name: 'react', ver: ver('react'), npm: 'https://www.npmjs.com/package/react', docs: 'https://react.dev/', gh: 'https://github.com/facebook/react' },
  { name: 'react-router-dom', ver: ver('react-router-dom'), npm: 'https://www.npmjs.com/package/react-router-dom', docs: 'https://reactrouter.com/', gh: 'https://github.com/remix-run/react-router' },
  { name: 'vite', ver: ver('vite'), npm: 'https://www.npmjs.com/package/vite', docs: 'https://vitejs.dev/', gh: 'https://github.com/vitejs/vite' },
];
const NPM = {
  three: { npm: 'https://www.npmjs.com/package/three', docs: 'https://threejs.org/docs/', gh: 'https://github.com/mrdoob/three.js' },
  'three/addons/controls/OrbitControls.js': { pkg: 'three', npm: 'https://www.npmjs.com/package/three', docs: 'https://threejs.org/docs/#examples/en/controls/OrbitControls', gh: 'https://github.com/mrdoob/three.js/blob/r170/examples/jsm/controls/OrbitControls.js' },
};
const CDN_LINKS = { 'matter-js': { docs: 'https://brm.io/matter-js/docs/', gh: 'https://github.com/liabru/matter-js' }, gsap: { docs: 'https://gsap.com/docs/v3/', gh: 'https://github.com/greensock/GSAP' }, echarts: { docs: 'https://echarts.apache.org/', gh: 'https://github.com/apache/echarts' }, d3: { docs: 'https://d3js.org/', gh: 'https://github.com/d3/d3' }, 'lottie-web': { docs: 'https://airbnb.io/lottie/', gh: 'https://github.com/airbnb/lottie-web' } };

for (const cat of reg.categories) for (const d of cat.demos) {
  const file = MODS[d.mod]; if (!file) { console.warn('no module', d.mod); continue; }
  const m = load(file);
  const files = graph(file);
  const isKit = d.mod.startsWith('kit-');
  const fam = isKit ? (families(m).has(d.slug) ? d.slug : d.slug.replace(/-\d+$/, '')) : null;
  const rt = runtime[`/${cat.key}/${d.slug}`] || {};
  txScope(`/${cat.key}/${d.slug}`);

  // demo-specific blocks
  let blocks = [];
  if (isKit) {
    blocks = familyBlocks(m, fam).map((b) => ({ m, b }));
    for (const im of m.imports) if (im.file && /docs\.js$/.test(im.file)) blocks.push(...familyBlocks(load(im.file), fam).map((b) => ({ m: load(im.file), b })));
  } else {
    blocks = [{ m, b: { kind: 'file', start: 0, end: m.text.length } }];
  }
  const code = [], walk = [];
  for (const { m: mm, b } of blocks) {
    const t = b.kind === 'file' ? path.basename(mm.file) : b.kind === 'def' ? `FAM.${fam}` : b.kind === 'table' ? `${b.owner}['${fam}']` : b.kind === 'case' ? `${b.fn}() · case '${fam}'` : `${b.fn}() · if (family === '${fam}')`;
    code.push(codeBlock(mm, b.start, b.end, t));
    if (b.kind === 'file') {
      for (const st of mm.sf.statements) { if (ts.isImportDeclaration(st)) continue; const nm = st.name?.text || st.declarationList?.declarations?.[0]?.name?.text || ''; if (!nm) continue; const dd = mm.decls.get(nm); if (dd) walk.push(...walkHelper(mm, dd).map((w) => ({ file: rel(mm.file), ...w }))); }
    } else walk.push(...walkBlock(mm, b).map((w) => ({ file: rel(mm.file), ...w })));
  }
  // shared code (same kit file) referenced by the blocks, one level + the mount glue
  const shared = [];
  if (isKit) {
    const ranges = blocks.filter((x) => x.m === m).map((x) => [x.b.start, x.b.end]);
    const helpers = helperDecls(m, ranges);
    for (let depth = 0, front = helpers.slice(); depth < 3 && front.length; depth++) {
      const nx = helperDecls(m, front.map((h) => [h.start, h.end])).filter((h) => !helpers.includes(h) && !/^mount/.test(h.name));
      helpers.push(...nx); front = nx;
    }
    for (const nm of ['mountFamily', 'mountLegacy', 'mount']) { const g = m.decls.get(nm); if (g && !helpers.includes(g)) helpers.push(g); }
    let K = kitShared.get(file); if (!K) { K = { id: d.mod, blocks: new Map() }; kitShared.set(file, K); }
    for (const h of helpers.sort((a, b) => a.start - b.start)) {
      if (!K.blocks.has(h.name)) K.blocks.set(h.name, { ...codeBlock(m, h.start, h.end, h.name), walk: walkHelper(m, h) });
      shared.push(h.name);
    }
  }

  // imported APIs actually used
  const allRanges = blocks.map((x) => [x.m, x.b.start, x.b.end]);
  const usedIds = new Set();
  for (const [mm, a, b] of allRanges) idents(mm, a, b).forEach((x) => usedIds.add(x));
  const sharedDecls = isKit ? shared.map((n) => m.decls.get(n)) : [];
  for (const h of sharedDecls) idents(m, h.start, h.end).forEach((x) => usedIds.add(x));
  const apis = [];
  for (const im of m.imports) for (const nmo of im.names) {
    if (!usedIds.has(nmo.name) && !(nmo.name === 'THREE')) continue;
    const ds = D.LOCAL[nmo.imported] || D.LOCAL[nmo.name];
    const target = im.file ? load(im.file).decls.get(nmo.imported) : null;
    apis.push({ name: nmo.imported === '*' ? nmo.name : nmo.imported, from: im.from, kind: im.file ? 'local' : 'npm',
      zh: ds?.[0] || target?.doc || '', en: ds?.[1] || (target?.doc && !CJK.test(target.doc) ? target.doc : ''),
      link: im.file ? gh(im.file, target?.line0, target?.line1) : (NPM[im.from]?.docs || NPM[im.from.split('/')[0]]?.docs || '') });
  }
  const det = { canvas: new Set(), gl: new Set(), three: new Set(), stage: new Set(), matter: new Set(), audio: new Set() };
  const scan = (mm, a, b) => { const r = detect(mm, a, b); for (const k of Object.keys(det)) r[k].forEach((x) => det[k].add(x)); };
  for (const [mm, a, b] of allRanges) scan(mm, a, b);
  for (const h of sharedDecls) scan(m, h.start, h.end);
  for (const n of det.stage) apis.push({ name: `S.${n}`, from: 'canvas-stage', kind: 'stage', zh: D.STAGE[n][0], en: D.STAGE[n][1], link: gh(path.join(SRC, 'demos/kits/canvas-stage.js'), load(path.join(SRC, 'demos/kits/canvas-stage.js')).decls.get('createCanvasStage').line0) });
  for (const n of det.three) { const t = D.THREE_D[n]; apis.push({ name: `THREE.${n}`, from: 'three', kind: 'npm', zh: t?.[0] || 'three.js API', en: t?.[1] || 'three.js API', link: threeLink(n) }); }
  for (const n of det.matter) { const t = D.MATTER[n]; apis.push({ name: `Matter.${n}`, from: 'matter-js', kind: 'cdn', zh: t[0], en: t[1], link: `https://brm.io/matter-js/docs/classes/${t[2]}` }); }
  for (const n of det.canvas) { const t = D.CANVAS[n]; apis.push({ name: `ctx.${n}()`, from: 'Canvas 2D', kind: 'web', zh: t[0], en: t[1], link: `https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/${n}` }); }
  for (const n of det.gl) { const t = D.WEBGL[n]; if (t) apis.push({ name: `gl.${n}()`, from: 'WebGL', kind: 'web', zh: t[0], en: t[1], link: `https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/${n}` }); }
  if (det.audio.size || /getAudio/.test(code.map((c) => c.raw).join('\n') + sharedDecls.map((h) => m.text.slice(h.start, h.end)).join('\n'))) {
    const src = load(path.join(SRC, 'demos/kits/kit-audio.js')).text;
    for (const [n, t] of Object.entries(D.AUDIO)) if (new RegExp(`\\.${n}\\(`).test(src) && (n !== 'getUserMedia' && n !== 'createAnalyser' && n !== 'createMediaStreamSource' || fam === 'mic')) apis.push({ name: n === 'getUserMedia' ? 'navigator.mediaDevices.getUserMedia()' : `AudioContext.${n}()`, from: 'Web Audio', kind: 'web', zh: t[0], en: t[1], link: `https://developer.mozilla.org/en-US/docs/Web/API/${t[2]}` });
  }

  // dependencies
  const deps = [];
  const extern = new Map();
  for (const f of files) for (const im of load(f).imports) if (!im.file) extern.set(im.from, f);
  const usesThree = [...extern.keys()].some((k) => k.startsWith('three'));
  for (const [from] of extern) { const L = NPM[from] || NPM[from.split('/')[0]]; const p = L?.pkg || from.split('/')[0]; deps.push({ name: from, kind: 'npm', ver: ver(p), npm: L?.npm || `https://www.npmjs.com/package/${p}`, docs: L?.docs || '', gh: L?.gh || '' }); }
  const allCode = code.map((c) => c.raw).join('\n') + sharedDecls.map((h) => m.text.slice(h.start, h.end)).join('\n');
  for (const [k, c] of Object.entries(CDN)) if (new RegExp(`libs\\.${k}\\(`).test(allCode)) deps.push({ name: c.pkg, kind: 'cdn', ver: c.ver, npm: `https://www.npmjs.com/package/${c.pkg}`, docs: CDN_LINKS[c.pkg]?.docs || '', gh: CDN_LINKS[c.pkg]?.gh || '', cdn: `https://cdn.jsdelivr.net/npm/${c.pkg}@${c.ver}/` });
  const locals = [...files].map((f) => ({ name: rel(f).replace(/^frontend\/src\//, ''), kind: 'local', url: gh(f), lines: load(f).text.split('\n').length }));

  // runtime logic
  const kind = d.mod === 'solar-system' || d.mod === 'trig-waves' ? 'three-own' : ['kit-math', 'kit-convert'].includes(d.mod) ? 'panel' : stageKind(files);
  const hasPtr = det.stage.has('onDown') || det.stage.has('onMove') || /onPointerDown|hitTargets|applyDrag/.test(allCode);
  const steps = [];
  const S = (zh, e) => steps.push({ zh, en: e });
  S(`访问 \`/${cat.key}/${d.slug}\` 时，DemoHost 按 registry 的 \`mod: '${d.mod}'\` 懒加载 \`${rel(file).replace('frontend/src/', '')}\`，调用 \`${d.fn}(host, { variant: '${d.slug}' })\`。`, `Visiting \`/${cat.key}/${d.slug}\`, DemoHost lazy-loads \`${rel(file).replace('frontend/src/', '')}\` (registry \`mod: '${d.mod}'\`) and calls \`${d.fn}(host, { variant: '${d.slug}' })\`.`);
  if (isKit) S(`mount 把 variant 解析为家族 \`${fam}\`，\`withControls\` 生成控件面板（${(d.presets || []).length || '若干'} 个预设 + 参数滑块）。`, `mount resolves the variant to family \`${fam}\`; \`withControls\` builds the control panel (${(d.presets || []).length || 'several'} presets + sliders).`);
  if (kind === 'canvas') S('`createCanvasStage` 创建 `<canvas>`（HiDPI 上限 2×、ResizeObserver 自适应）和右侧信息面板。', '`createCanvasStage` creates the `<canvas>` (HiDPI ≤ 2×, ResizeObserver) and the info panel.');
  if (kind === 'three') S('`createThreeStage` 创建 WebGLRenderer、Scene、PerspectiveCamera 与 OrbitControls，并接上信息面板。', '`createThreeStage` sets up WebGLRenderer, Scene, PerspectiveCamera and OrbitControls, plus the info panel.');
  if (kind === 'panel') S('`createInfoPanel` 把舞台分成画布区与信息面板，`makeCanvas` 创建 HiDPI 画布。', '`createInfoPanel` splits the stage into canvas + info panel; `makeCanvas` creates a HiDPI canvas.');
  if (kind === 'three-own') S('模块自行创建 three.js 渲染器、场景、相机和 OrbitControls，并用 `createInfoPanel` 挂上信息面板。', 'The module creates its own three.js renderer, scene, camera and OrbitControls, and attaches the info panel with `createInfoPanel`.');
  if (deps.some((x) => x.kind === 'cdn')) { const c = deps.filter((x) => x.kind === 'cdn'); S(`按需从 CDN 加载 ${c.map((x) => `${x.name}@${x.ver}`).join('、')}（jsDelivr → npmmirror → unpkg 回退）。`, `Loads ${c.map((x) => `${x.name}@${x.ver}`).join(', ')} from CDN on demand (jsDelivr → npmmirror → unpkg).`); }
  if (/makeGL|frag/.test(allCode) && d.mod === 'kit-webgl') S('`makeGL` 编译本 demo 的 GLSL 片元着色器到离屏 WebGL 画布；每帧传入 u_t / u_m / u_col 等 uniform，`drawArrays` 画全屏四边形，再 `drawImage` 贴回 2D 舞台。', '`makeGL` compiles this demo’s GLSL fragment shader on an offscreen WebGL canvas; each frame sets uniforms (u_t, u_m, u_col…), `drawArrays` renders a full-screen quad, then `drawImage` copies it onto the 2D stage.');
  if (kind === 'canvas' || kind === 'three') S(isKit ? '家族的 `build(S)` 初始化本 demo 的状态并返回每帧回调。' : '模块用 `S.onFrame` 注册每帧回调。', isKit ? 'The family’s `build(S)` initialises state and returns the per-frame callback.' : 'The module registers its per-frame callback with `S.onFrame`.');
  S(kind === 'panel' ? '每个 `requestAnimationFrame`：读取控件值，`drawFamily` 进入本 demo 的分支绘制，并刷新信息面板读数。' : '每个 `requestAnimationFrame`：读取控件值，按速度缩放模拟时钟（dt 上限 50 ms），执行帧回调绘制；返回的读数写入信息面板。', kind === 'panel' ? 'Every `requestAnimationFrame`: read controls, `drawFamily` runs this demo’s branch, and the info panel readout refreshes.' : 'Every `requestAnimationFrame`: read controls, advance a speed-scaled clock (dt ≤ 50 ms), run the frame callback; returned readouts go to the info panel.');
  if (hasPtr) S('指针按下/拖动/移动时更新交互状态（拖拽手柄、悬停读数）；未触碰且开启「自动演示」时指针沿 Lissajous 路径自动移动。', 'Pointer down/drag/move updates the interaction (drag handles, hover readouts); when untouched and auto-demo is on, the pointer follows a Lissajous path.');
  if (det.audio.size || fam === 'mic') S(fam === 'mic' ? '点舞台右上角「麦克风」后通过 getUserMedia 取得实时波形（独立分析用 AudioContext，不发声）。' : '右上角「声音」总开关打开时，经共享 AudioContext 实时发声；关闭时静音。', fam === 'mic' ? 'Tapping the on-stage “Mic” pill gets the live waveform via getUserMedia (separate analysis-only AudioContext, no output).' : 'With the top-right Sound switch on, sound plays through the shared AudioContext; off = muted.');
  S('改变参数：颜色/速度/大小等即时生效，需要重建的参数触发重新挂载；离开页面时取消 rAF、移除监听并释放资源。', 'Changing parameters: colour/speed/size apply live; structural ones remount; leaving the page cancels rAF, removes listeners and frees resources.');

  // principle (evaluated doc) + translations
  const pr = { title: rt.title || '', tip: rt.tip || '', formula: rt.formula || '', explain: rt.explain || '', params: rt.params || [], example: rt.example || '', rows: rt.rows || [] };
  const prEn = { title: d.title_en || enLoose(pr.title), tip: enLoose(pr.tip), formula: enLoose(pr.formula), explain: enLoose(pr.explain), params: pr.params.map(([a, b]) => [enLoose(a), enLoose(b)]), example: enLoose(pr.example), rows: pr.rows.map(enLoose) };
  for (const k of ['formula', 'explain', 'tip', 'example']) if (hasCJK(prEn[k])) { stats.enMissing++; (stats.miss ||= []).length < 40 && stats.miss.push(prEn[k].replace(/<[^>]+>/g, ' ').match(/[\u3400-\u9fff][^a-zA-Z]{0,12}/g)?.slice(0, 3).join('|')); }
  for (const w of walk) if (hasCJK(w.en)) stats.walkCJK = (stats.walkCJK || 0) + 1;

  const env = { apis: envFor(files, allCode), fw: [...FW, ...(usesThree ? [{ name: 'three', ver: ver('three'), npm: NPM.three.npm, docs: NPM.three.docs, gh: NPM.three.gh }] : [])],
    mobile: { zh: `支持手机：指针事件统一处理触摸（画布 touch-action:none），窄屏时信息面板停靠在画布下方${usesThree ? '；3D 场景在移动端降低像素比' : ''}${fam === 'mic' ? '；麦克风需要 HTTPS 与授权' : ''}。`, en: `Mobile-ready: Pointer Events handle touch (canvas touch-action:none); on narrow screens the info panel docks below the canvas${usesThree ? '; 3D scenes lower the pixel ratio on mobile' : ''}${fam === 'mic' ? '; the microphone needs HTTPS and permission' : ''}.` } };

  const doc = {
    cat: cat.key, slug: d.slug, mod: d.mod, fam, file: rel(file), fileUrl: gh(file),
    title: { zh: d.title, en: d.title_en || '' }, cat_name: { zh: cat.name, en: cat.name_en || '' }, desc: { zh: d.desc, en: d.desc_en || '' }, hint: { zh: d.hint, en: d.hint_en || '' },
    steps, env, deps, locals, apis, code, shared: isKit ? { kit: d.mod, names: shared } : null, walk, principle: { zh: pr, en: prEn },
  };
  fs.mkdirSync(path.join(OUT, cat.key), { recursive: true });
  fs.writeFileSync(path.join(OUT, cat.key, `${d.slug}.json`), JSON.stringify(doc));
  stats.demos++; stats.blocks += code.length; stats.walk += walk.length; stats.apis += apis.length;

  const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const sec = (l) => {
    const P = l === 'zh' ? pr : prEn;
    const T = l === 'zh' ? ['运行逻辑', '运行环境', '引入的组件与依赖', '引入的组件函数', '本 demo 代码', '代码解释', '原理'] : ['Runtime logic', 'Environment', 'Dependencies', 'Imported APIs', 'Source code', 'Code walkthrough', 'Principles'];
    return [
      [T[0], steps.map((s) => s[l]).join(' ')],
      [T[1], env.apis.map((a) => `${a.k}: ${a[l]}`).join('; ') + ' · ' + env.fw.map((f) => `${f.name} ${f.ver}`).join(', ')],
      [T[2], deps.map((x) => `${x.name}${x.ver ? ' ' + x.ver : ''}`).join(', ') || (l === 'zh' ? '无第三方库，仅浏览器原生 API' : 'No third-party library, browser APIs only')],
      [T[3], apis.slice(0, 24).map((a) => `${a.name}${a[l] ? ' — ' + a[l] : ''}`).join('; ')],
      [T[4], `${doc.file}: ${code.map((c) => `${c.title} (L${c.a}-L${c.b})`).join(', ')}`],
      [T[5], walk.slice(0, 16).map((w) => `L${w.a}-${w.b}: ${w[l]}`).join(' ')],
      [T[6], [strip(P.formula), strip(P.explain)].filter(Boolean).join(' ')],
    ];
  };
  seo[`/${cat.key}/${d.slug}/docs`] = { zh: { title: d.title, cat: cat.name, desc: strip(pr.explain).slice(0, 150) || d.desc, sections: sec('zh') }, en: { title: d.title_en || '', cat: cat.name_en || '', desc: strip(prEn.explain).slice(0, 150) || d.desc_en || '', sections: sec('en') } };
}
for (const K of kitShared.values()) fs.writeFileSync(path.join(OUT, '_kit', `${K.id}.json`), JSON.stringify(Object.fromEntries(K.blocks)));
fs.writeFileSync(SEO_OUT, JSON.stringify(seo));
const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(JSON.stringify(stats), 'bytes', size(OUT), 'seo', fs.statSync(SEO_OUT).size);
