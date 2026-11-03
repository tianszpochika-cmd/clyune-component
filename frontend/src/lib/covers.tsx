/* v10 cover system: one restrained palette (云澜 indigo→cyan logo, OKLCH-even category hues, muted),
   crisp vector motifs chosen per demo from its tag/slug, deterministic per slug. No blur, no images. */
import type { CSSProperties, ReactNode } from 'react';

const ORDER = ['threejs', 'charts', 'ui', 'css-fx', 'canvas', 'svg', 'gsap', 'webgl', 'physics', 'audio',
  'dataviz', 'micro', 'layout', 'filters', 'particles-fx', 'generative', 'text-fx', 'scroll-fx', 'math', 'convert'];
/** 20 evenly spaced OKLCH hues starting at the logo indigo (277°) and walking toward its cyan. */
export const catHue = (key: string) => { const i = ORDER.indexOf(key); return i < 0 ? 277 : (277 - i * 18 + 360) % 360; };

function oklch(L: number, C: number, h: number) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map((x) => { const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'); }).join('');
}
export type Pal = { a: string; b: string; bg: string; bg2: string; line: string };
const cache: Record<string, Pal> = {};
export function catPal(key: string): Pal {
  if (cache[key]) return cache[key];
  const h = catHue(key);
  return (cache[key] = { a: oklch(0.78, 0.105, h), b: oklch(0.72, 0.085, h - 22), bg: oklch(0.255, 0.032, h), bg2: oklch(0.185, 0.022, h + 10), line: oklch(0.5, 0.04, h) });
}
export function catStyle(key: string): CSSProperties {
  const p = catPal(key);
  return { ['--cat' as string]: p.a, ['--cat-2' as string]: p.b, ['--cat-bg' as string]: p.bg, ['--cat-h' as string]: String(catHue(key)) } as CSSProperties;
}

const hash = (s: string) => { let x = 2166136261; for (let k = 0; k < s.length; k++) x = Math.imul(x ^ s.charCodeAt(k), 16777619); return x >>> 0; };
const rngOf = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

type M = 'orbit' | 'sphere' | 'cube' | 'donut' | 'radar' | 'scatter' | 'line' | 'bars' | 'wave' | 'audio' | 'gauge' | 'spiral' | 'nodes' | 'particles' | 'tiles' | 'glyph' | 'scroll' | 'ui' | 'heart' | 'filter' | 'contour' | 'ballistic' | 'flow' | 'convert' | 'easing' | 'bezier' | 'timeline' | 'axes' | 'triangle' | 'vectors' | 'calculus' | 'bell' | 'unit' | 'lattice' | 'spring' | 'pendulum' | 'rain' | 'burst';
const TOK: Record<string, M> = {};
const put = (m: M, s: string) => s.split(' ').forEach((t) => (TOK[t] = m));
put('orbit', 'orbit solar planet torus ringcloud moons multigrav attractor');
put('sphere', 'sphere globe earth wire raymarch');
put('cube', 'cube box iso isometric geometry model instanced instancing 3d basics controls polycubes pillar lattice mirror character gallery tilt xform3d flipcard');
put('donut', 'pie doughnut donut chord polar sunburst rose pieexplode categorypie doughnutlegend');
put('radar', 'radar radarfill polar-flower');
put('scatter', 'scatter bubble bubbles bubblepack circles');
put('line', 'line area spark sparkline log trend stock multiline stepline stackedarea arearange realtime logline parallel');
put('bars', 'bar hbar bars column histogram waterfall stack stacked eq combo mixed dual stackedbar groupedbar horizstack sparkbar barline weekday boxplot funnel candle pixelsort');
put('wave', 'wave sine oscillator scope ripple wavy synth gridwave water scan interfere');
put('audio', 'fft stft spectrum mic beat waveform sequencer piano synth drum live');
put('gauge', 'gauge progress kpi loader meter ring spinner dial pulse longpress countup');
put('spiral', 'spiral tunnel kaleido vortex swirl helix knots spin blackhole galaxy');
put('nodes', 'graph tree network force sankey node constellation mindmap flowchart d3 hierarchy arc net lsystem shortest');
put('particles', 'particles particle points sparkle stars starfield flock boids trail dust density nebula firefly swarm repulsor quantum smoke fire dots hourglass sand lightning');
put('rain', 'rain snow goldrain leaves matrix');
put('burst', 'burst firework fireworks fountain explode confetti comet');
put('tiles', 'grid masonry flex bento kanban table cq layers columns cards treemap heatmap cal icicle mosaic subdiv gol checker crt pixelate pixel sprite holy aspect overlap subgrid container h');
put('glyph', 'neon text typewriter glitch letters font type ascii wordcloud drawtext');
put('scroll', 'scroll parallax reveal sticky marquee kenburns cover');
put('ui', 'menu input buttons btn command pagination breadcrumb empty banner send copy download badge slide drag press button switch toggle form tabs modal toast dropdown accordion stepper carousel tooltip notify sheet nav fab avatar chip dnd actions skeleton overlay tool step cursor follow hover shake');
put('heart', 'like heart heartfield lottie check success icons rating');
put('filter', 'glass filter blend mask clip color colorpick colorflash hue hsv blur duotone brightness contrast saturate invert grayscale sepia shadow vignette glow backdrop neumorph spotlight');
put('contour', 'shader plasma sdf noise rd reactdiff gradient grad aurora contour terrain metaball metaballs2d blob liquid lava julia mandelbrot voronoi diffuse inkdrop cellgrow softbody circle');
put('ballistic', 'physics matter gravity projectile collision bounce wall billiard');
put('spring', 'spring elastic');
put('pendulum', 'pendulum rope');
put('flow', 'gen flowfield flow perlin ink warp fog stripes oil fiber gravline stream magnetic magnet cloth');
put('convert', 'unit convert 单位');
put('easing', 'easing ease keyframes keyseq transition trans flip hover');
put('bezier', 'stroke path morph dash draw bezier follow smil');
put('timeline', 'timeline stagger sequence tween scrub');
put('triangle', 'sierpinski tri'); put('lattice', 'walk');
put('axes', '函数'); put('triangle', '几何'); put('vectors', '线代'); put('calculus', '微积分'); put('bell', '概率'); put('unit', '三角'); put('lattice', '离散');
const CAT: Record<string, M> = { threejs: 'cube', charts: 'bars', ui: 'ui', 'css-fx': 'easing', canvas: 'particles', svg: 'bezier', gsap: 'timeline', webgl: 'contour',
  physics: 'ballistic', audio: 'audio', dataviz: 'nodes', micro: 'heart', layout: 'tiles', filters: 'filter', 'particles-fx': 'particles', generative: 'flow',
  'text-fx': 'glyph', 'scroll-fx': 'scroll', math: 'axes', convert: 'convert' };
const TAG_FIRST = new Set(['math', 'convert', 'audio']);
const OV: Record<string, Record<string, M>> = { 'scroll-fx': { stack: 'scroll', h: 'scroll', path: 'bezier' }, audio: { bars: 'audio', polar: 'donut', waterfall: 'audio' },
  ui: { timeline: 'timeline', tree: 'nodes' }, 'text-fx': {}, micro: { controls: 'ui', toast: 'ui', skeleton: 'ui', shake: 'ui', toggle: 'ui' } };
export function motifFor(cat: string, slug: string, tag = ''): M {
  const sl = slug.toLowerCase(), tg = tag.toLowerCase(), parts = sl.split(/[-_]/);
  const toks = TAG_FIRST.has(cat) ? [tg, sl, ...parts] : [sl, ...parts, tg];
  if (cat === 'text-fx') return 'glyph';
  for (const t of toks) { const m = OV[cat]?.[t] || TOK[t]; if (m) return m; }
  return CAT[cat] || 'particles';
}

const f = (n: number) => Math.round(n * 10) / 10;
const pathOf = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
/* Motifs live in a 120×96 box; the lower-left corner stays quiet for the index number. */
const UNITS: Record<string, [string, string]> = { temperature: ['°C', '°F'], timezone: ['UTC', '+8'], mass: ['kg', 'lb'], length: ['m', 'ft'], 'area-volume': ['m³', 'L'], radix: ['10', '2'], speed: ['km/h', 'mph'], pressure: ['Pa', 'atm'], energy: ['J', 'cal'] };
function draw(m: M, r: () => number, p: Pal, slug = ''): ReactNode {
  const A = p.a, B = p.b, L = p.line;
  const sw = { strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (m) {
    case 'orbit': { const t = -10 - r() * 14; return <g transform={`rotate(${f(t)} 72 46)`}>{[16, 28, 40].map((rx, i) => { const an = r() * Math.PI * 2; return <g key={i}><ellipse cx={72} cy={46} rx={rx} ry={rx * 0.42} stroke={L} {...sw} strokeWidth={1} /><circle cx={f(72 + rx * Math.cos(an))} cy={f(46 + rx * 0.42 * Math.sin(an))} r={2.4 + i * 0.6} fill={i === 1 ? B : A} /></g>; })}<circle cx={72} cy={46} r={5.5} fill={A} /></g>; }
    case 'sphere': return <g>{[0, 1, 2].map((i) => <ellipse key={i} cx={72} cy={46} rx={28} ry={f(28 * (0.25 + i * 0.3))} stroke={i === 1 ? A : L} {...sw} strokeWidth={1} />)}{[0, 1].map((i) => <ellipse key={'v' + i} cx={72} cy={46} rx={f(28 * (0.35 + i * 0.35))} ry={28} stroke={L} {...sw} strokeWidth={1} />)}<circle cx={72} cy={46} r={28} stroke={A} {...sw} /></g>;
    case 'cube': { const s = 20 + r() * 6, cx = 72, cy = 48, dx = s * 0.87, dy = s * 0.5;
      const top: [number, number][] = [[cx, cy - s], [cx + dx, cy - s + dy], [cx, cy], [cx - dx, cy - s + dy]];
      return <g><path d={pathOf(top) + 'Z'} fill={A} fillOpacity={0.18} stroke={A} {...sw} /><path d={pathOf([[cx - dx, cy - s + dy], [cx - dx, cy + dy], [cx, cy + s], [cx + dx, cy + dy], [cx + dx, cy - s + dy]])} stroke={A} {...sw} /><path d={`M${cx} ${cy}V${f(cy + s)}`} stroke={B} {...sw} /></g>; }
    case 'donut': { const C = 2 * Math.PI * 22; const a1 = 0.3 + r() * 0.25, a2 = 0.15 + r() * 0.2; return <g transform="rotate(-90 72 46)"><circle cx={72} cy={46} r={22} stroke={L} strokeWidth={9} fill="none" opacity={0.6} /><circle cx={72} cy={46} r={22} stroke={A} strokeWidth={9} fill="none" strokeDasharray={`${f(C * a1)} ${f(C)}`} /><circle cx={72} cy={46} r={22} stroke={B} strokeWidth={9} fill="none" strokeDasharray={`${f(C * a2)} ${f(C)}`} strokeDashoffset={f(-C * a1 - 2)} /></g>; }
    case 'radar': { const n = 6, pt = (k: number, rr: number): [number, number] => [72 + rr * Math.sin((k / n) * 2 * Math.PI), 46 - rr * Math.cos((k / n) * 2 * Math.PI)];
      return <g>{[30, 18].map((rr) => <path key={rr} d={pathOf(Array.from({ length: n }, (_, k) => pt(k, rr))) + 'Z'} stroke={L} {...sw} strokeWidth={1} />)}<path d={pathOf(Array.from({ length: n }, (_, k) => pt(k, 12 + r() * 18))) + 'Z'} fill={A} fillOpacity={0.2} stroke={A} {...sw} /></g>; }
    case 'scatter': return <g><path d="M38 78H110M38 78V14" stroke={L} {...sw} strokeWidth={1} /><path d="M42 72L108 22" stroke={B} {...sw} strokeWidth={1} strokeDasharray="3 3" />{Array.from({ length: 14 }, (_, i) => { const x = 44 + r() * 62, y = 72 - (x - 42) * 0.72 + (r() - 0.5) * 22; return <circle key={i} cx={f(x)} cy={f(Math.min(74, Math.max(14, y)))} r={f(1.6 + r() * 2.4)} fill={A} fillOpacity={0.55 + r() * 0.4} />; })}</g>;
    case 'line': { let y = 60; const pts: [number, number][] = Array.from({ length: 8 }, (_, i) => { y = Math.min(70, Math.max(18, y + (r() - 0.55) * 22)); return [36 + i * 10, y]; });
      return <g><path d="M34 78H110" stroke={L} {...sw} strokeWidth={1} /><path d={pathOf(pts) + 'L106 78L36 78Z'} fill={A} fillOpacity={0.12} /><path d={pathOf(pts)} stroke={A} {...sw} /><circle cx={106} cy={f(pts[7][1])} r={3} fill={B} /></g>; }
    case 'bars': { const k = Math.floor(r() * 6); return <g><path d="M34 78H110" stroke={L} {...sw} strokeWidth={1} />{Array.from({ length: 6 }, (_, i) => { const h = 14 + r() * 46; return <rect key={i} x={38 + i * 12} y={f(78 - h)} width={8} height={f(h)} rx={2} fill={i === k ? A : B} fillOpacity={i === k ? 0.95 : 0.4} />; })}</g>; }
    case 'wave': { const ph = r() * 6, fq = 0.11 + r() * 0.06; const w = (amp: number, o: number) => pathOf(Array.from({ length: 41 }, (_, i) => [24 + i * 2.2, 46 + amp * Math.sin(i * 2.2 * fq + ph + o)]));
      return <g><path d="M24 46H114" stroke={L} {...sw} strokeWidth={1} strokeDasharray="2 3" /><path d={w(18, 0)} stroke={A} {...sw} /><path d={w(10, 1.6)} stroke={B} {...sw} strokeWidth={1.2} opacity={0.7} /></g>; }
    case 'audio': return <g>{Array.from({ length: 15 }, (_, i) => { const env = Math.sin(((i + 0.5) / 15) * Math.PI); const h = 4 + env * (10 + r() * 26); return <rect key={i} x={30 + i * 5.6} y={f(46 - h / 2)} width={3} height={f(h)} rx={1.5} fill={i % 4 === 1 ? B : A} fillOpacity={0.5 + env * 0.45} />; })}</g>;
    case 'gauge': { const v = 0.3 + r() * 0.6, C = 2 * Math.PI * 24, arc = 0.72; return <g><g transform="rotate(140 72 50)"><circle cx={72} cy={50} r={24} fill="none" stroke={L} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${f(C * arc)} ${f(C)}`} opacity={0.6} /><circle cx={72} cy={50} r={24} fill="none" stroke={A} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${f(C * arc * v)} ${f(C)}`} /></g><circle cx={72} cy={50} r={3} fill={B} /></g>; }
    case 'spiral': { const t0 = r() * 6; return <g><path d={pathOf(Array.from({ length: 90 }, (_, i) => { const t = i * 0.19; return [72 + t * 3 * Math.cos(t + t0), 46 + t * 3 * Math.sin(t + t0)]; }))} stroke={A} {...sw} /><circle cx={72} cy={46} r={2.5} fill={B} /></g>; }
    case 'nodes': { const pts: [number, number][] = Array.from({ length: 7 }, (_, i) => { const an = (i / 7) * 2 * Math.PI + r() * 0.6; const rr = i ? 18 + r() * 14 : 0; return [72 + rr * Math.cos(an), 46 + rr * Math.sin(an) * 0.85]; });
      return <g>{pts.slice(1).map((q, i) => <path key={i} d={pathOf([pts[i % 3 === 2 ? i : 0], q])} stroke={L} {...sw} strokeWidth={1.1} />)}{pts.map(([x, y], i) => <circle key={'n' + i} cx={f(x)} cy={f(y)} r={i ? 3.4 : 5} fill={p.bg} stroke={i ? (i % 2 ? A : B) : A} strokeWidth={1.6} />)}</g>; }
    case 'particles': { const pts = Array.from({ length: 30 }, () => { const an = r() * Math.PI * 2, rr = Math.pow(r(), 0.6) * 38; return [72 + rr * Math.cos(an), 44 + rr * Math.sin(an) * 0.8] as [number, number]; });
      return <g>{pts.map(([x, y], i) => <circle key={i} cx={f(x)} cy={f(y)} r={f(0.8 + r() * 1.8)} fill={i % 5 ? A : B} fillOpacity={f(0.35 + r() * 0.6)} />)}</g>; }
    case 'tiles': { const big = Math.floor(r() * 3); return <g>{[[36, 14, 34, 30], [74, 14, 36, 14], [74, 32, 36, 12], [36, 48, 22, 30], [62, 48, 48, 30]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx={3} fill={i === big ? A : 'none'} fillOpacity={0.35} stroke={i === big ? A : L} strokeWidth={1.2} />)}</g>; }
    case 'glyph': { const ch = ['Aa', 'Ab', '字', 'Tt', 'Ag', '文'][Math.floor(r() * 6)], v = Math.floor(r() * 3);
      const T = (dx: number, dy: number, props: Record<string, unknown>) => <text x={72 + dx} y={58 + dy} textAnchor="middle" fontFamily="Georgia, 'Songti SC', 'Noto Serif CJK SC', serif" fontSize={40} fontWeight={700} {...props}>{ch}</text>;
      return <g>{v === 0 ? T(0, 0, { fill: A }) : v === 1 ? T(0, 0, { fill: 'none', stroke: A, strokeWidth: 1.3 }) : <>{T(-2.5, 0, { fill: B, opacity: 0.55 })}{T(1.5, 0, { fill: A })}</>}<path d="M44 70H100" stroke={B} {...sw} strokeWidth={1.2} /><path d="M50 77H90" stroke={L} {...sw} strokeWidth={1} /></g>; }
    case 'scroll': return <g><rect x={50} y={8} width={44} height={80} rx={7} stroke={L} {...sw} strokeWidth={1.2} />{[18, 40, 62].map((y, i) => <rect key={y} x={56} y={y} width={28} height={16} rx={3} fill={i === 1 ? A : B} fillOpacity={i === 1 ? 0.55 : 0.18} />)}<rect x={88} y={f(16 + r() * 30)} width={2.4} height={22} rx={1.2} fill={A} /></g>;
    case 'ui': if (r() < 0.45) return <g><rect x={34} y={14} width={78} height={64} rx={8} stroke={L} {...sw} strokeWidth={1.2} />{[0, 1, 2].map((i) => <g key={i}><circle cx={46} cy={30 + i * 17} r={4.5} fill={i === 1 ? A : 'none'} stroke={i === 1 ? A : L} strokeWidth={1.2} /><path d={`M56 ${30 + i * 17}H${f(80 + r() * 22)}`} stroke={i === 1 ? A : L} {...sw} /></g>)}</g>;
      return <g><rect x={34} y={16} width={78} height={60} rx={8} stroke={L} {...sw} strokeWidth={1.2} /><path d="M44 30H80M44 38H70" stroke={L} {...sw} /><rect x={82} y={24} width={22} height={12} rx={6} fill={A} fillOpacity={0.35} stroke={A} strokeWidth={1.2} /><circle cx={98} cy={30} r={4} fill={A} /><rect x={44} y={52} width={36} height={14} rx={7} fill={A} /><rect x={84} y={52} width={20} height={14} rx={7} stroke={B} {...sw} strokeWidth={1.2} /></g>;
    case 'heart': return <g><path d="M72 66C56 54 50 46 50 38a10 10 0 0 1 22-4a10 10 0 0 1 22 4c0 8-6 16-22 28Z" fill={A} fillOpacity={0.22} stroke={A} {...sw} />{[[100, 24, 106, 18], [104, 34, 112, 34], [44, 24, 38, 18]].map(([a, b, c, d], i) => <path key={i} d={`M${a} ${b}L${c} ${d}`} stroke={B} {...sw} />)}</g>;
    case 'filter': if (r() < 0.5) return <g><rect x={46} y={18} width={52} height={52} rx={8} stroke={L} {...sw} strokeWidth={1.2} /><path d="M72 18V70" stroke={A} {...sw} /><rect x={46} y={18} width={26} height={52} rx={8} fill={A} fillOpacity={0.3} /><circle cx={72} cy={44} r={14} stroke={B} {...sw} strokeWidth={1.4} /></g>;
      return <g>{[[62, 38, A], [82, 38, B], [72, 56, A]].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r={18} fill={c as string} fillOpacity={0.16} stroke={c as string} strokeWidth={1.4} />)}</g>;
    case 'contour': { const ph = r() * 6, k = 3 + Math.floor(r() * 3); return <g>{[34, 26, 18, 10].map((R, i) => <path key={i} d={pathOf(Array.from({ length: 49 }, (_, j) => { const t = (j / 48) * 2 * Math.PI; const rr = R * (1 + 0.14 * Math.sin(k * t + ph + i)); return [72 + rr * Math.cos(t), 46 + rr * Math.sin(t) * 0.82]; })) + 'Z'} stroke={i % 2 ? B : A} {...sw} strokeWidth={1.2} opacity={0.45 + i * 0.17} />)}</g>; }
    case 'ballistic': { const h = 40 + r() * 16; const par = pathOf(Array.from({ length: 25 }, (_, i) => { const t = i / 24; return [36 + t * 72, 80 - 4 * h * t * (1 - t)]; }));
      return <g><path d="M30 80H114" stroke={L} {...sw} strokeWidth={1} /><path d={par} stroke={B} {...sw} strokeWidth={1.2} strokeDasharray="3 3" />{[0.18, 0.38].map((t, i) => <circle key={i} cx={f(36 + t * 72)} cy={f(80 - 4 * h * t * (1 - t))} r={4} fill="none" stroke={L} strokeWidth={1.2} />)}<circle cx={f(36 + 0.6 * 72)} cy={f(80 - 4 * h * 0.24)} r={6} fill={A} /></g>; }
    case 'flow': { const ph = r() * 6; return <g>{Array.from({ length: 8 }, (_, i) => { const y0 = 14 + i * 9; return <path key={i} d={pathOf(Array.from({ length: 31 }, (_, j) => { const x = 28 + j * 3; return [x, y0 + 8 * Math.sin(x * 0.06 + ph + i * 0.5)]; }))} stroke={i % 3 ? A : B} {...sw} strokeWidth={1.2} opacity={0.35 + (i % 4) * 0.18} />; })}</g>; }
    case 'convert': { const u = UNITS[slug]; const tx = (x: number, t: string, c: string) => <text x={x} y={50} textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={t.length > 3 ? 7.5 : 10} fontWeight={700} fill={c}>{t}</text>;
      return <g><rect x={30} y={30} width={30} height={32} rx={6} stroke={A} {...sw} /><rect x={84} y={30} width={30} height={32} rx={6} fill={A} fillOpacity={0.2} stroke={A} {...sw} /><path d="M64 40H80M76 36L80 40L76 44" stroke={B} {...sw} /><path d="M80 52H64M68 48L64 52L68 56" stroke={B} {...sw} />{u ? <>{tx(45, u[0], A)}{tx(99, u[1], A)}</> : null}</g>; }
    case 'easing': { const c1 = 0.2 + r() * 0.5, c2 = 0.5 + r() * 0.5; const X = (t: number) => 38 + t * 68, Y = (t: number) => 80 - t * 64;
      return <g><path d="M38 80H108M38 80V12" stroke={L} {...sw} strokeWidth={1} /><path d={`M${X(0)} ${Y(0)}L${f(X(c1))} ${f(Y(0))}M${X(1)} ${Y(1)}L${f(X(c2))} ${Y(1)}`} stroke={B} {...sw} strokeWidth={1} /><path d={`M${X(0)} ${Y(0)}C${f(X(c1))} ${Y(0)} ${f(X(c2))} ${Y(1)} ${X(1)} ${Y(1)}`} stroke={A} {...sw} /><circle cx={f(X(c1))} cy={Y(0)} r={2.6} fill={B} /><circle cx={f(X(c2))} cy={Y(1)} r={2.6} fill={B} /></g>; }
    case 'bezier': { const y1 = 14 + r() * 20, y2 = 60 + r() * 20; return <g><path d={`M36 66L58 ${f(y1)}M106 30L86 ${f(y2)}`} stroke={L} {...sw} strokeWidth={1} /><path d={`M36 66C58 ${f(y1)} 86 ${f(y2)} 106 30`} stroke={A} {...sw} strokeWidth={2} /><rect x={55} y={f(y1 - 3)} width={6} height={6} fill={B} /><rect x={83} y={f(y2 - 3)} width={6} height={6} fill={B} /><circle cx={36} cy={66} r={3} fill={A} /><circle cx={106} cy={30} r={3} fill={A} /></g>; }
    case 'timeline': { const ph = 46 + r() * 48; return <g>{[0, 1, 2, 3].map((i) => { const x = 36 + i * 8 + r() * 6, w = 26 + r() * 22; return <g key={i}><path d={`M32 ${22 + i * 16}H112`} stroke={L} strokeWidth={1} opacity={0.6} /><rect x={f(x)} y={18 + i * 16} width={f(w)} height={8} rx={4} fill={i % 2 ? B : A} fillOpacity={0.8} /></g>; })}<path d={`M${f(ph)} 12V82`} stroke={A} {...sw} strokeWidth={1.2} /></g>; }
    case 'axes': { const kind = Math.floor(r() * 3), ph = r() * 2; const fn = (x: number) => (kind === 0 ? 18 * Math.sin(x * 0.12 + ph) : kind === 1 ? ((x - 72) ** 2) / 70 - 24 : ((x - 72) ** 3) / 3000);
      return <g><path d="M30 46H114M72 10V84" stroke={L} {...sw} strokeWidth={1} />{[48, 60, 84, 96].map((x) => <path key={x} d={`M${x} 44V48`} stroke={L} strokeWidth={1} />)}<path d={pathOf(Array.from({ length: 41 }, (_, i) => { const x = 32 + i * 2; return [x, Math.max(10, Math.min(84, 46 - fn(x)))]; }))} stroke={A} {...sw} /></g>; }
    case 'triangle': { const v = [-90, 30, 150].map((d) => ((d + (r() - 0.5) * 50) * Math.PI) / 180).map((a) => [72 + 30 * Math.cos(a), 48 + 30 * Math.sin(a)] as [number, number]);
      return <g><circle cx={72} cy={48} r={30} stroke={L} {...sw} strokeWidth={1} /><path d={pathOf(v) + 'Z'} fill={A} fillOpacity={0.14} stroke={A} {...sw} />{v.map(([x, y], i) => <circle key={i} cx={f(x)} cy={f(y)} r={2.8} fill={B} />)}</g>; }
    case 'vectors': return <g>{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${36 + i * 18} 82L${50 + i * 18} 12`} stroke={L} strokeWidth={0.8} opacity={0.7} />)}{[0, 1, 2, 3].map((i) => <path key={'h' + i} d={`M30 ${22 + i * 18}H114`} stroke={L} strokeWidth={0.8} opacity={0.7} />)}<path d="M52 76L100 58M94 54L100 58L95 63" stroke={A} {...sw} strokeWidth={2} /><path d="M52 76L64 26M59 30L64 26L67 32" stroke={B} {...sw} strokeWidth={2} /></g>;
    case 'calculus': { const fn = (x: number) => 70 - 30 * Math.sin((x - 30) * 0.035) - (x - 30) * 0.08; return <g><path d="M30 80H114" stroke={L} {...sw} strokeWidth={1} />{Array.from({ length: 8 }, (_, i) => { const x = 38 + i * 9; return <rect key={i} x={x} y={f(fn(x + 4.5))} width={8} height={f(80 - fn(x + 4.5))} fill={A} fillOpacity={0.22} />; })}<path d={pathOf(Array.from({ length: 41 }, (_, i) => [30 + i * 2.1, fn(30 + i * 2.1)]))} stroke={A} {...sw} /></g>; }
    case 'bell': { const g = (x: number) => 80 - 58 * Math.exp(-((x - 72) ** 2) / 300); return <g><path d="M28 80H116" stroke={L} {...sw} strokeWidth={1} />{Array.from({ length: 9 }, (_, i) => { const x = 36 + i * 8.5; return <rect key={i} x={f(x)} y={f(g(x + 4) + (r() - 0.5) * 8)} width={7} height={f(80 - g(x + 4))} fill={B} fillOpacity={0.3} />; })}<path d={pathOf(Array.from({ length: 45 }, (_, i) => [28 + i * 2, g(28 + i * 2)]))} stroke={A} {...sw} /></g>; }
    case 'unit': { const an = 0.4 + r() * 0.9, x = 64 + 26 * Math.cos(an), y = 48 - 26 * Math.sin(an); return <g><path d="M30 48H112M64 14V82" stroke={L} {...sw} strokeWidth={1} /><circle cx={64} cy={48} r={26} stroke={A} {...sw} strokeWidth={1.2} /><path d={`M64 48L${f(x)} ${f(y)}`} stroke={A} {...sw} /><path d={`M${f(x)} ${f(y)}V48`} stroke={B} {...sw} strokeDasharray="2.5 2.5" /><circle cx={f(x)} cy={f(y)} r={3} fill={B} /></g>; }
    case 'spring': { const n = 7, top = 12, len = 34 + r() * 14; return <g><path d="M48 12H96" stroke={L} {...sw} strokeWidth={1} /><path d={pathOf([[72, top], ...Array.from({ length: n * 2 }, (_, i) => [72 + (i % 2 ? 10 : -10), top + 4 + (i + 0.5) * (len / (n * 2))] as [number, number]), [72, top + len + 8]])} stroke={A} {...sw} strokeWidth={1.4} /><rect x={60} y={f(top + len + 8)} width={24} height={16} rx={4} fill={B} fillOpacity={0.85} /></g>; }
    case 'pendulum': { const an = (r() - 0.5) * 1.1, x = 72 + 50 * Math.sin(an), y = 14 + 50 * Math.cos(an); return <g><path d="M50 14H94" stroke={L} {...sw} strokeWidth={1} /><path d={pathOf(Array.from({ length: 21 }, (_, i) => { const a = -0.55 + i * 0.055; return [72 + 50 * Math.sin(a), 14 + 50 * Math.cos(a)]; }))} stroke={L} {...sw} strokeWidth={1} strokeDasharray="2 3" /><path d={`M72 14L${f(x)} ${f(y)}`} stroke={A} {...sw} /><circle cx={f(x)} cy={f(y)} r={7} fill={A} /><circle cx={72} cy={14} r={2.4} fill={B} /></g>; }
    case 'rain': return <g>{Array.from({ length: 18 }, (_, i) => { const x = 34 + r() * 78, y = 8 + r() * 66, l = 6 + r() * 10; return <path key={i} d={`M${f(x)} ${f(y)}l-2 ${f(l)}`} stroke={i % 4 ? A : B} {...sw} strokeWidth={1.3} opacity={f(0.35 + r() * 0.6)} />; })}<path d="M34 86H114" stroke={L} {...sw} strokeWidth={1} /></g>;
    case 'burst': { const n = 14; return <g>{Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI + r() * 0.2, r0 = 8 + r() * 4, r1 = 22 + r() * 16; return <g key={i}><path d={`M${f(72 + r0 * Math.cos(a))} ${f(44 + r0 * Math.sin(a))}L${f(72 + r1 * Math.cos(a))} ${f(44 + r1 * Math.sin(a))}`} stroke={i % 3 ? A : B} {...sw} strokeWidth={1.3} /><circle cx={f(72 + (r1 + 4) * Math.cos(a))} cy={f(44 + (r1 + 4) * Math.sin(a))} r={1.4} fill={A} /></g>; })}<circle cx={72} cy={44} r={3} fill={B} /></g>; }
    case 'lattice': { const pts: [number, number][] = []; let cx = 0, cy = 0; for (let i = 0; i < 7; i++) { pts.push([40 + cx * 12, 22 + cy * 12]); if (r() < 0.5 && cx < 5) cx++; else if (cy < 4) cy++; else cx++; }
      return <g>{Array.from({ length: 30 }, (_, i) => <circle key={i} cx={40 + (i % 6) * 12} cy={22 + Math.floor(i / 6) * 12} r={1.4} fill={L} />)}<path d={pathOf(pts)} stroke={A} {...sw} />{pts.map(([x, y], i) => <circle key={'p' + i} cx={x} cy={y} r={2.4} fill={i === pts.length - 1 ? B : A} />)}</g>; }
  }
}

/** Crisp vector cover: tinted dark base, faint dot grid, one accent motif. Fills its positioned parent. */
export function Cover({ cat, slug, tag, bare }: { cat: string; slug: string; tag?: string; bare?: boolean }) {
  const p = catPal(cat), seed = hash(cat + '/' + slug), m = motifFor(cat, slug, tag), id = 'cv' + seed.toString(36);
  return (
    <svg className="cover-svg" viewBox="0 0 120 96" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false" data-motif={m}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.bg} /><stop offset="1" stopColor={p.bg2} /></linearGradient>
        <pattern id={id + 'd'} width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill={p.line} /></pattern>
      </defs>
      {bare ? null : <rect width="120" height="96" fill={`url(#${id})`} />}
      {bare ? null : <rect width="120" height="96" fill={`url(#${id}d)`} opacity=".45" />}
      <g fill="none">{draw(m, rngOf(seed), p, slug)}</g>
    </svg>
  );
}
