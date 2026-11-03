/* v10 cover system: one restrained palette (云澜 indigo→cyan logo, OKLCH-even category hues, muted),
   crisp vector motifs chosen per demo from its tag/slug, deterministic per slug. No blur, no images. */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';

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
const UNITS: Record<string, [string, string]> = { temperature: ['°C', '°F'], timezone: ['UTC', '+8'], mass: ['kg', 'lb'], length: ['m', 'ft'], 'area-volume': ['m³', 'L'], radix: ['10', '2'], speed: ['km/h', 'mph'], pressure: ['Pa', 'atm'], energy: ['J', 'cal'] };
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length) % xs.length];
const has = (slug: string, re: RegExp) => re.test(slug);

/* Every motif is drawn upright around (60,48); <Cover> then re-centres it on its bounding box and scales it
   into a fixed safe area, so position and size never vary per demo. Per-demo variation = detail only
   (bar heights, point clouds, stroke dash, which sub-glyph), never rotation, skew or offset. */
function draw(m: M, r: () => number, p: Pal, slug = ''): ReactNode {
  const A = p.a, B = p.b, L = p.line, cx = 60, cy = 48;
  const sw = { strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const thin = { strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (m) {
    case 'orbit': return <g>{[14, 25, 36].map((rx, i) => { const an = [0.6, 2.4, 4.1][i] + (r() - 0.5) * 0.5; return <g key={i}><ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.42} stroke={L} {...thin} /><circle cx={f(cx + rx * Math.cos(an))} cy={f(cy + rx * 0.42 * Math.sin(an))} r={2.2 + i * 0.6} fill={i === 1 ? B : A} /></g>; })}<circle cx={cx} cy={cy} r={5.5} fill={A} /></g>;
    case 'sphere': return <g>{[0.3, 0.62].map((k, i) => <ellipse key={i} cx={cx} cy={cy} rx={28} ry={f(28 * k)} stroke={i ? A : L} {...thin} />)}{[0.35, 0.7].map((k, i) => <ellipse key={'v' + i} cx={cx} cy={cy} rx={f(28 * k)} ry={28} stroke={L} {...thin} />)}<path d={`M${cx - 28} ${cy}H${cx + 28}M${cx} ${cy - 28}V${cy + 28}`} stroke={L} {...thin} /><circle cx={cx} cy={cy} r={28} stroke={A} {...sw} /></g>;
    case 'cube': { const s = 22, dx = s * 0.87, dy = s * 0.5, y0 = cy - s / 2 + dy / 2 + 4; const top: [number, number][] = [[cx, y0 - s + dy - dy], [cx + dx, y0 - s + dy], [cx, y0 + dy], [cx - dx, y0 - s + dy]]; const fillTop = r() < 0.5;
      return <g><path d={pathOf(top) + 'Z'} fill={A} fillOpacity={fillTop ? 0.22 : 0.08} stroke={A} {...sw} /><path d={pathOf([[cx - dx, y0 - s + dy], [cx - dx, y0 + dy], [cx, y0 + s], [cx + dx, y0 + dy], [cx + dx, y0 - s + dy]])} stroke={A} {...sw} /><path d={`M${cx} ${f(y0 + dy)}V${f(y0 + s)}`} stroke={B} {...sw} /></g>; }
    case 'donut': { const C = 2 * Math.PI * 22; const a1 = 0.3 + r() * 0.25, a2 = 0.15 + r() * 0.2; return <g transform={`rotate(-90 ${cx} ${cy})`}><circle cx={cx} cy={cy} r={22} stroke={L} strokeWidth={9} opacity={0.6} /><circle cx={cx} cy={cy} r={22} stroke={A} strokeWidth={9} strokeDasharray={`${f(C * a1)} ${f(C)}`} /><circle cx={cx} cy={cy} r={22} stroke={B} strokeWidth={9} strokeDasharray={`${f(C * a2)} ${f(C)}`} strokeDashoffset={f(-C * a1 - 2)} /></g>; }
    case 'radar': { const n = 6, pt = (k: number, rr: number): [number, number] => [cx + rr * Math.sin((k / n) * 2 * Math.PI), cy - rr * Math.cos((k / n) * 2 * Math.PI)];
      return <g>{[30, 18].map((rr) => <path key={rr} d={pathOf(Array.from({ length: n }, (_, k) => pt(k, rr))) + 'Z'} stroke={L} {...thin} />)}<path d={pathOf(Array.from({ length: n }, (_, k) => pt(k, 14 + r() * 16))) + 'Z'} fill={A} fillOpacity={0.2} stroke={A} {...sw} /></g>; }
    case 'scatter': return <g><path d="M24 80H96M24 80V16" stroke={L} {...thin} /><path d="M28 74L94 24" stroke={B} {...thin} strokeDasharray="3 3" />{Array.from({ length: 14 }, (_, i) => { const x = 30 + (i / 13) * 62, y = 74 - (x - 28) * 0.72 + (r() - 0.5) * 20; return <circle key={i} cx={f(x)} cy={f(Math.min(76, Math.max(18, y)))} r={f(1.6 + r() * 2.2)} fill={A} fillOpacity={0.55 + r() * 0.4} />; })}</g>;
    case 'line': { let y = 56; const pts: [number, number][] = Array.from({ length: 8 }, (_, i) => { y = Math.min(70, Math.max(24, y + (r() - 0.55) * 20)); return [24 + i * 10, y]; });
      return <g><path d="M22 78H96" stroke={L} {...thin} /><path d={pathOf(pts) + 'L94 78L24 78Z'} fill={A} fillOpacity={0.12} /><path d={pathOf(pts)} stroke={A} {...sw} /><circle cx={94} cy={f(pts[7][1])} r={3} fill={B} /></g>; }
    case 'bars': { const k = Math.floor(r() * 6); return <g><path d="M22 78H98" stroke={L} {...thin} />{Array.from({ length: 6 }, (_, i) => { const h = 14 + r() * 44; return <rect key={i} x={26 + i * 12} y={f(78 - h)} width={8} height={f(h)} rx={2} fill={i === k ? A : B} fillOpacity={i === k ? 0.95 : 0.4} />; })}</g>; }
    case 'wave': { const amp2 = 8 + r() * 6; const w = (amp: number, o: number) => pathOf(Array.from({ length: 41 }, (_, i) => [20 + i * 2, cy + amp * Math.sin((i / 40) * 4 * Math.PI + o)]));
      return <g><path d={`M20 ${cy}H100`} stroke={L} {...thin} strokeDasharray="2 3" /><path d={w(18, 0)} stroke={A} {...sw} /><path d={w(amp2, Math.PI)} stroke={B} {...sw} strokeWidth={1.2} opacity={0.7} /></g>; }
    case 'audio': return <g>{Array.from({ length: 15 }, (_, i) => { const env = Math.sin(((i + 0.5) / 15) * Math.PI); const h = 4 + env * (12 + r() * 24); return <rect key={i} x={f(18.5 + i * 5.6)} y={f(cy - h / 2)} width={3} height={f(h)} rx={1.5} fill={i % 4 === 1 ? B : A} fillOpacity={0.5 + env * 0.45} />; })}</g>;
    case 'gauge': { const v = 0.3 + r() * 0.6, C = 2 * Math.PI * 24, arc = 0.75; return <g><g transform={`rotate(135 ${cx} ${cy})`}><circle cx={cx} cy={cy} r={24} stroke={L} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${f(C * arc)} ${f(C)}`} opacity={0.6} /><circle cx={cx} cy={cy} r={24} stroke={A} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${f(C * arc * v)} ${f(C)}`} /></g><circle cx={cx} cy={cy} r={3} fill={B} /></g>; }
    case 'spiral': { const turns = 3 + Math.floor(r() * 2); return <g><path d={pathOf(Array.from({ length: turns * 30 }, (_, i) => { const t = (i / 30) * 2 * Math.PI; const rr = (i / (turns * 30)) * 30; return [cx + rr * Math.cos(t - Math.PI / 2), cy + rr * Math.sin(t - Math.PI / 2)]; }))} stroke={A} {...sw} /><circle cx={cx} cy={cy} r={2.5} fill={B} /></g>; }
    case 'nodes': { const k = 5 + Math.floor(r() * 3); const pts: [number, number][] = [[cx, cy], ...Array.from({ length: k }, (_, i) => { const an = (i / k) * 2 * Math.PI - Math.PI / 2; return [cx + 28 * Math.cos(an), cy + 26 * Math.sin(an)] as [number, number]; })];
      return <g>{pts.slice(1).map((q, i) => <path key={i} d={pathOf([pts[0], q])} stroke={L} {...thin} />)}{pts.slice(1).map((q, i) => (i % 2 ? null : <path key={'r' + i} d={pathOf([q, pts[1 + ((i + 1) % k)]])} stroke={L} {...thin} />))}{pts.map(([x, y], i) => <circle key={'n' + i} cx={f(x)} cy={f(y)} r={i ? 3.4 : 5} fill={p.bg} stroke={i ? (i % 2 ? A : B) : A} strokeWidth={1.6} />)}</g>; }
    case 'particles': return <g>{Array.from({ length: 30 }, (_, i) => { const an = r() * Math.PI * 2, rr = Math.sqrt((i + 0.5) / 30) * 34; return <circle key={i} cx={f(cx + rr * Math.cos(an))} cy={f(cy + rr * Math.sin(an) * 0.8)} r={f(0.8 + r() * 1.8)} fill={i % 5 ? A : B} fillOpacity={f(0.35 + r() * 0.6)} />; })}</g>;
    case 'tiles': { const big = Math.floor(r() * 5); return <g>{[[24, 18, 34, 30], [62, 18, 34, 14], [62, 36, 34, 12], [24, 52, 22, 26], [50, 52, 46, 26]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx={3} fill={i === big ? A : 'none'} fillOpacity={0.35} stroke={i === big ? A : L} strokeWidth={1.2} />)}</g>; }
    case 'glyph': { const ch = pick(r, ['Aa', 'Ab', '字', 'Tt', 'Ag', '文']), v = Math.floor(r() * 3);
      const T = (props: Record<string, unknown>, key: string, dx = 0) => <text key={key} x={cx + dx} y={cy + 12} textAnchor="middle" fontFamily="Georgia, 'Songti SC', 'Noto Serif CJK SC', serif" fontSize={40} fontWeight={700} {...props}>{ch}</text>;
      return <g>{v === 0 ? T({ fill: A }, 'a') : v === 1 ? T({ fill: 'none', stroke: A, strokeWidth: 1.3 }, 'a') : [T({ fill: B, opacity: 0.5 }, 'b', -2), T({ fill: A }, 'a', 2)]}<path d={`M${cx - 26} ${cy + 22}H${cx + 26}`} stroke={B} {...thin} /></g>; }
    case 'scroll': { const hi = Math.floor(r() * 3); return <g><rect x={38} y={8} width={44} height={80} rx={7} stroke={L} {...thin} />{[18, 40, 62].map((y, i) => <rect key={y} x={44} y={y} width={28} height={16} rx={3} fill={i === hi ? A : B} fillOpacity={i === hi ? 0.55 : 0.18} />)}<rect x={76} y={18 + hi * 22} width={2.4} height={16} rx={1.2} fill={A} /></g>; }
    case 'ui': return uiMotif(slug, r, A, B, L, sw, thin);
    case 'heart': return <g><path d={`M${cx} ${cy + 16}C${cx - 16} ${cy + 4} ${cx - 22} ${cy - 4} ${cx - 22} ${cy - 12}a10 10 0 0 1 22-4a10 10 0 0 1 22 4c0 8-6 16-22 28Z`} fill={A} fillOpacity={0.22} stroke={A} {...sw} />{[[cx - 30, cy - 22, cx - 25, cy - 17], [cx + 30, cy - 22, cx + 25, cy - 17], [cx, cy - 30, cx, cy - 24]].map(([a, b, c, d], i) => <path key={i} d={`M${a} ${b}L${c} ${d}`} stroke={B} {...sw} />)}</g>;
    case 'filter': if (r() < 0.5) return <g><rect x={34} y={22} width={52} height={52} rx={8} stroke={L} {...thin} /><rect x={34} y={22} width={26} height={52} rx={8} fill={A} fillOpacity={0.3} /><path d="M60 22V74" stroke={A} {...sw} /><circle cx={60} cy={48} r={14} stroke={B} {...sw} strokeWidth={1.4} /></g>;
      return <g>{[[50, 40, A], [70, 40, B], [60, 57, A]].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r={18} fill={c as string} fillOpacity={0.16} stroke={c as string} strokeWidth={1.4} />)}</g>;
    case 'contour': { const k = 3 + Math.floor(r() * 3); return <g>{[34, 26, 18, 10].map((R, i) => <path key={i} d={pathOf(Array.from({ length: 61 }, (_, j) => { const t = (j / 60) * 2 * Math.PI; const rr = R * (1 + 0.12 * Math.cos(k * t)); return [cx + rr * Math.sin(t), cy - rr * Math.cos(t) * 0.82]; })) + 'Z'} stroke={i % 2 ? B : A} {...sw} strokeWidth={1.2} opacity={0.45 + i * 0.17} />)}</g>; }
    case 'ballistic': { const h = 46; const X = (t: number) => 22 + t * 76, Y = (t: number) => 78 - 4 * h * t * (1 - t); const t1 = 0.5 + (r() - 0.5) * 0.2;
      return <g><path d="M18 78H102" stroke={L} {...thin} /><path d={pathOf(Array.from({ length: 25 }, (_, i) => [X(i / 24), Y(i / 24)]))} stroke={B} {...sw} strokeWidth={1.2} strokeDasharray="3 3" />{[0.2, 0.8].map((t, i) => <circle key={i} cx={f(X(t))} cy={f(Y(t))} r={4} stroke={L} strokeWidth={1.2} />)}<circle cx={f(X(t1))} cy={f(Y(t1))} r={6} fill={A} /></g>; }
    case 'flow': { const ph = r() * 6; return <g>{Array.from({ length: 7 }, (_, i) => { const y0 = 24 + i * 8; return <path key={i} d={pathOf(Array.from({ length: 31 }, (_, j) => { const x = 18 + j * 2.8; return [x, y0 + 7 * Math.sin(x * 0.07 + ph + i * 0.4)]; }))} stroke={i % 3 ? A : B} {...sw} strokeWidth={1.2} opacity={0.35 + (i % 4) * 0.18} />; })}</g>; }
    case 'convert': { const u = UNITS[slug]; const tx = (x: number, t: string, c: string) => <text x={x} y={cy + 3.5} textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={t.length > 3 ? 7.5 : 10} fontWeight={700} fill={c}>{t}</text>;
      return <g><rect x={18} y={32} width={30} height={32} rx={6} stroke={A} {...sw} /><rect x={72} y={32} width={30} height={32} rx={6} fill={A} fillOpacity={0.2} stroke={A} {...sw} /><path d="M52 42H68M64 38L68 42L64 46" stroke={B} {...sw} /><path d="M68 54H52M56 50L52 54L56 58" stroke={B} {...sw} />{u ? <>{tx(33, u[0], A)}{tx(87, u[1], A)}</> : null}</g>; }
    case 'easing': { const c1 = 0.25 + r() * 0.4, c2 = 0.6 + r() * 0.35; const X = (t: number) => 28 + t * 64, Y = (t: number) => 80 - t * 64;
      return <g><path d="M28 80H92M28 80V16" stroke={L} {...thin} /><path d={`M${X(0)} ${Y(0)}L${f(X(c1))} ${Y(0)}M${X(1)} ${Y(1)}L${f(X(c2))} ${Y(1)}`} stroke={B} {...thin} /><path d={`M${X(0)} ${Y(0)}C${f(X(c1))} ${Y(0)} ${f(X(c2))} ${Y(1)} ${X(1)} ${Y(1)}`} stroke={A} {...sw} /><circle cx={f(X(c1))} cy={Y(0)} r={2.6} fill={B} /><circle cx={f(X(c2))} cy={Y(1)} r={2.6} fill={B} /></g>; }
    case 'bezier': { const k = 14 + r() * 10; return <g><path d={`M24 64L44 ${f(cy - k)}M96 32L76 ${f(cy + k)}`} stroke={L} {...thin} /><path d={`M24 64C44 ${f(cy - k)} 76 ${f(cy + k)} 96 32`} stroke={A} {...sw} strokeWidth={2} /><rect x={41} y={f(cy - k - 3)} width={6} height={6} fill={B} /><rect x={73} y={f(cy + k - 3)} width={6} height={6} fill={B} /><circle cx={24} cy={64} r={3} fill={A} /><circle cx={96} cy={32} r={3} fill={A} /></g>; }
    case 'timeline': { const ph = 46 + r() * 30; return <g>{[0, 1, 2, 3].map((i) => { const x = 24 + i * 9, w = 26 + r() * 18; return <g key={i}><path d={`M20 ${26 + i * 15}H100`} stroke={L} strokeWidth={1} opacity={0.6} /><rect x={x} y={22 + i * 15} width={f(w)} height={8} rx={4} fill={i % 2 ? B : A} fillOpacity={0.8} /></g>; })}<path d={`M${f(ph)} 16V80`} stroke={A} {...sw} strokeWidth={1.2} /></g>; }
    case 'axes': case 'triangle': case 'vectors': case 'calculus': case 'bell': case 'unit': case 'lattice': return mathMotif(m, slug, r, A, B, L, sw, thin, p.bg);
    case 'spring': { const n = 7, top = 14, len = 44; return <g><path d="M40 14H80" stroke={L} {...thin} /><path d={pathOf([[cx, top], ...Array.from({ length: n * 2 }, (_, i) => [cx + (i % 2 ? 10 : -10), top + 4 + (i + 0.5) * (len / (n * 2))] as [number, number]), [cx, top + len + 6]])} stroke={A} {...sw} strokeWidth={1.4} /><rect x={48} y={top + len + 6} width={24} height={16} rx={4} fill={B} fillOpacity={0.85} /></g>; }
    case 'pendulum': return <g><path d="M38 16H82" stroke={L} {...thin} /><path d={pathOf(Array.from({ length: 21 }, (_, i) => { const a = -0.5 + i * 0.05; return [cx + 50 * Math.sin(a), 16 + 50 * Math.cos(a)]; }))} stroke={L} {...thin} strokeDasharray="2 3" /><path d={`M${cx} 16V66`} stroke={A} {...sw} /><circle cx={cx} cy={66} r={7} fill={A} /><circle cx={cx} cy={16} r={2.4} fill={B} /></g>;
    case 'rain': return <g>{Array.from({ length: 18 }, (_, i) => { const x = 24 + (i % 9) * 9 + (i > 8 ? 4.5 : 0), y = 16 + r() * 50, l = 6 + r() * 9; return <path key={i} d={`M${f(x)} ${f(y)}v${f(l)}`} stroke={i % 4 ? A : B} {...sw} strokeWidth={1.3} opacity={f(0.35 + r() * 0.6)} />; })}<path d="M22 82H98" stroke={L} {...thin} /></g>;
    case 'burst': { const n = 14; return <g>{Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI, r0 = 8, r1 = 22 + r() * 12; return <g key={i}><path d={`M${f(cx + r0 * Math.cos(a))} ${f(cy + r0 * Math.sin(a))}L${f(cx + r1 * Math.cos(a))} ${f(cy + r1 * Math.sin(a))}`} stroke={i % 3 ? A : B} {...sw} strokeWidth={1.3} /><circle cx={f(cx + (r1 + 4) * Math.cos(a))} cy={f(cy + (r1 + 4) * Math.sin(a))} r={1.4} fill={A} /></g>; })}<circle cx={cx} cy={cy} r={3} fill={B} /></g>; }
  }
}

type St = Record<string, unknown>;
/** UI components: the sketch follows the component family (tabs, modal, input, toast, …), not one generic card. */
function uiMotif(slug: string, r: () => number, A: string, B: string, L: string, sw: St, thin: St): ReactNode {
  const kind = has(slug, /tab/) ? 'tabs' : has(slug, /mod|sheet|overlay|cards|empty/) ? 'modal' : has(slug, /input|form|command|colorpick|search/) ? 'input'
    : has(slug, /toast|notify|banner|send|copy|download|badge/) ? 'toast' : has(slug, /switch|toggle|controls/) ? 'toggle' : has(slug, /rating|like/) ? 'stars'
    : has(slug, /car|slide|verify/) ? 'carousel' : has(slug, /pagination|breadcrumb|stepper|step|nav/) ? 'steps' : has(slug, /drop|acc|tree|menu/) ? 'list'
    : has(slug, /avatar|chip/) ? 'avatar' : has(slug, /skel|longpress|drag|press|shake|tip|fab|hover|dbl/) ? pick(r, ['button', 'skeleton']) : pick(r, ['button', 'list', 'toggle', 'input']);
  const frame = <rect x={22} y={18} width={76} height={60} rx={8} stroke={L} {...thin} />;
  switch (kind) {
    case 'tabs': return <g>{frame}{[0, 1, 2].map((i) => <rect key={i} x={28 + i * 22} y={24} width={18} height={9} rx={4.5} fill={i === 0 ? A : 'none'} stroke={i === 0 ? A : L} strokeWidth={1} />)}<path d="M30 46H88M30 55H78M30 64H84" stroke={L} {...sw} /></g>;
    case 'modal': return <g><rect x={16} y={14} width={88} height={68} rx={8} fill={L} fillOpacity={0.12} /><rect x={30} y={26} width={60} height={44} rx={6} stroke={A} {...sw} /><path d="M38 38H70M38 46H62" stroke={L} {...sw} /><rect x={62} y={56} width={22} height={8} rx={4} fill={A} /><path d="M81 31l4 4M85 31l-4 4" stroke={B} {...thin} /></g>;
    case 'input': return <g><rect x={20} y={36} width={60} height={24} rx={6} stroke={A} {...sw} /><path d="M28 48H50" stroke={L} {...sw} /><path d="M54 42V54" stroke={B} {...sw} /><rect x={84} y={36} width={16} height={24} rx={6} fill={A} /></g>;
    case 'toast': return <g><rect x={20} y={34} width={80} height={28} rx={8} stroke={A} {...sw} fill={A} fillOpacity={0.1} /><circle cx={34} cy={48} r={6} fill={A} /><path d="M31 48l2.2 2.2L37.4 45.8" stroke={p0} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><path d="M46 44H86M46 53H72" stroke={L} {...sw} /></g>;
    case 'toggle': return <g>{[0, 1, 2].map((i) => { const on = i !== 1; return <g key={i}><path d={`M26 ${30 + i * 18}H56`} stroke={L} {...sw} /><rect x={72} y={24 + i * 18} width={22} height={12} rx={6} fill={on ? A : 'none'} fillOpacity={0.35} stroke={on ? A : L} strokeWidth={1.2} /><circle cx={on ? 88 : 78} cy={30 + i * 18} r={4} fill={on ? A : L} /></g>; })}</g>;
    case 'stars': return <g>{[0, 1, 2, 3, 4].map((i) => { const x = 28 + i * 16; const pts = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * 2 * Math.PI - Math.PI / 2, rr = k % 2 ? 3 : 7; return [x + rr * Math.cos(a), 48 + rr * Math.sin(a)] as [number, number]; }); return <path key={i} d={pathOf(pts) + 'Z'} fill={i < 4 ? A : 'none'} fillOpacity={0.85} stroke={A} strokeWidth={1.1} strokeLinejoin="round" />; })}</g>;
    case 'carousel': return <g><rect x={36} y={22} width={48} height={40} rx={6} fill={A} fillOpacity={0.3} stroke={A} {...sw} /><rect x={16} y={28} width={14} height={28} rx={4} stroke={L} {...thin} /><rect x={90} y={28} width={14} height={28} rx={4} stroke={L} {...thin} />{[0, 1, 2].map((i) => <circle key={i} cx={52 + i * 8} cy={72} r={2.2} fill={i === 1 ? A : L} />)}</g>;
    case 'steps': return <g><path d="M24 48H96" stroke={L} {...sw} /><path d="M24 48H60" stroke={A} {...sw} />{[0, 1, 2, 3].map((i) => <circle key={i} cx={24 + i * 24} cy={48} r={6} fill={i < 2 ? A : '#0b1020'} stroke={i < 3 ? A : L} strokeWidth={1.4} />)}</g>;
    case 'list': return <g>{frame}{[0, 1, 2].map((i) => <g key={i}><circle cx={34} cy={32 + i * 16} r={4} fill={i === 1 ? A : 'none'} stroke={i === 1 ? A : L} strokeWidth={1.2} /><path d={`M44 ${32 + i * 16}H${[84, 76, 80][i]}`} stroke={i === 1 ? A : L} {...sw} /></g>)}</g>;
    case 'avatar': return <g>{[0, 1, 2].map((i) => <g key={i}><circle cx={40 + i * 20} cy={44} r={12} fill={i === 1 ? A : B} fillOpacity={i === 1 ? 0.5 : 0.2} stroke={i === 1 ? A : B} strokeWidth={1.4} /><circle cx={40 + i * 20} cy={40} r={4} fill={i === 1 ? A : B} fillOpacity={0.9} /></g>)}<rect x={36} y={64} width={48} height={10} rx={5} stroke={L} {...thin} /></g>;
    case 'skeleton': return <g>{frame}<rect x={30} y={26} width={18} height={18} rx={4} fill={L} fillOpacity={0.5} /><rect x={54} y={28} width={36} height={6} rx={3} fill={L} fillOpacity={0.5} /><rect x={54} y={38} width={24} height={6} rx={3} fill={L} fillOpacity={0.35} /><rect x={30} y={52} width={60} height={6} rx={3} fill={A} fillOpacity={0.45} /><rect x={30} y={63} width={44} height={6} rx={3} fill={L} fillOpacity={0.35} /></g>;
    default: return <g><rect x={26} y={36} width={68} height={24} rx={12} fill={A} /><path d="M44 48H76" stroke="#0b1020" strokeWidth={2} strokeLinecap="round" /><rect x={20} y={30} width={80} height={36} rx={18} stroke={B} strokeWidth={1} opacity={0.5} /></g>;
  }
}
const p0 = '#0b1020';

/** Maths: one sketch per topic (Pythagoras, conics, derivative, eigenvectors, Venn, CLT …). */
function mathMotif(m: M, slug: string, r: () => number, A: string, B: string, L: string, sw: St, thin: St, bg: string): ReactNode {
  const ax = <path d="M18 48H102M60 12V84" stroke={L} {...thin} />;
  const curve = (fn: (x: number) => number, x0 = 20, x1 = 100, st = A) => <path d={pathOf(Array.from({ length: 49 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / 48; return [x, Math.max(12, Math.min(84, 48 - fn(x - 60)))]; }))} stroke={st} {...sw} />;
  const dot = (x: number, y: number, c = B, k?: string | number) => <circle key={k} cx={f(x)} cy={f(y)} r={2.8} fill={c} />;
  // geometry
  if (has(slug, /pythagoras/)) return <g><rect x={24} y={40} width={24} height={24} fill={B} fillOpacity={0.14} stroke={B} {...thin} /><rect x={48} y={64} width={32} height={32} fill={A} fillOpacity={0.12} stroke={A} {...thin} /><path d="M36 40V64M24 52H48M56 64V96M64 64V96M72 64V96M48 72H80M48 80H80M48 88H80" stroke={L} {...thin} /><path d="M48 40V64H80Z" fill={A} fillOpacity={0.22} stroke={A} {...sw} /><path d="M48 58H54V64" stroke={L} {...thin} /></g>;
  if (has(slug, /similar/)) return <g><path d="M24 76L60 20L96 76Z" stroke={L} {...sw} /><path d="M42 76L60 48L78 76Z" fill={A} fillOpacity={0.2} stroke={A} {...sw} /><path d="M36 48H84" stroke={B} {...thin} strokeDasharray="3 3" /></g>;
  if (has(slug, /circle-angles|law-sine/)) return <g><circle cx={60} cy={48} r={30} stroke={L} {...sw} /><path d="M36 66L60 18L84 66" stroke={A} {...sw} /><path d="M36 66L60 48L84 66" stroke={B} {...sw} />{dot(60, 48, A, 'c')}{[[36, 66], [84, 66], [60, 18]].map(([x, y], i) => dot(x, y, B, i))}</g>;
  if (has(slug, /area-volume/)) return <g><path d="M30 38L60 24L90 38L60 52Z" fill={A} fillOpacity={0.22} stroke={A} {...sw} /><path d="M30 38V64L60 78L90 64V38M60 52V78" stroke={A} {...sw} /><path d="M30 64L60 50L90 64" stroke={L} {...thin} strokeDasharray="2 3" /></g>;
  if (has(slug, /coord/)) return <g>{ax}<path d="M24 76L96 22" stroke={A} {...sw} />{dot(42, 62.5)}{dot(78, 35.5)}<path d="M42 62.5H78V35.5" stroke={L} {...thin} strokeDasharray="2 3" /></g>;
  if (has(slug, /conic/)) return <g>{ax}<ellipse cx={60} cy={48} rx={30} ry={18} stroke={A} {...sw} />{curve((x) => (x * x) / 40 - 30, 26, 94, B)}</g>;
  if (has(slug, /sierpinski/)) return <g><path d="M24 78L60 18L96 78Z" stroke={A} {...sw} /><path d="M42 48H78L60 78Z" fill={A} fillOpacity={0.25} stroke={A} {...thin} /><path d="M33 63H51L42 78ZM69 63H87L78 78ZM51 33H69L60 48Z" stroke={B} {...thin} /></g>;
  if (m === 'triangle') { const v: [number, number][] = [[60, 18], [88, 70], [32, 70]]; return <g><path d={pathOf(v) + 'Z'} fill={A} fillOpacity={0.14} stroke={A} {...sw} /><path d="M60 18L60 70M32 70L74 44M88 70L46 44" stroke={L} {...thin} />{v.map(([x, y], i) => dot(x, y, B, i))}</g>; }
  // functions
  if (m === 'axes') { const g = has(slug, /linear/) ? (x: number) => x * 0.6 : has(slug, /quadratic/) ? (x: number) => (x * x) / 40 - 24 : has(slug, /exp/) ? (x: number) => Math.exp(x / 14) * 3 - 20
      : has(slug, /power/) ? (x: number) => (x * x * x) / 2400 : has(slug, /piecewise/) ? (x: number) => (x < -12 ? -16 : x < 14 ? x * 0.9 : 14) : has(slug, /polar/) ? null : has(slug, /parametric/) ? null : (x: number) => 20 * Math.sin(x / 9);
    if (has(slug, /polar/)) return <g>{ax}<path d={pathOf(Array.from({ length: 121 }, (_, i) => { const t = (i / 120) * 2 * Math.PI, rr = 30 * Math.cos(2 * t); return [60 + rr * Math.cos(t), 48 + rr * Math.sin(t)]; }))} stroke={A} {...sw} /></g>;
    if (has(slug, /parametric/)) return <g>{ax}<path d={pathOf(Array.from({ length: 121 }, (_, i) => { const t = (i / 120) * 2 * Math.PI; return [60 + 32 * Math.sin(3 * t), 48 + 28 * Math.sin(2 * t)]; }))} stroke={A} {...sw} /></g>;
    return <g>{ax}{curve(g!)}{has(slug, /exp/) ? curve((x) => 14 * Math.log(Math.max(0.01, (x + 40) / 14)) - 10, -0 + 21, 100, B) : null}</g>; }
  if (m === 'calculus') { const g = (x: number) => 18 * Math.sin(x / 14) + x * 0.15;
    if (has(slug, /derivative/)) { const x0 = 6, k = (18 / 14) * Math.cos(x0 / 14) + 0.15; return <g>{ax}{curve(g)}<path d={`M${60 + x0 - 26} ${f(48 - g(x0) + 26 * k)}L${60 + x0 + 26} ${f(48 - g(x0) - 26 * k)}`} stroke={B} {...sw} />{dot(60 + x0, 48 - g(x0))}</g>; }
    if (has(slug, /limit/)) return <g>{ax}{curve((x) => (x === 0 ? 0 : 200 / (x - 30)) * 0 + 24 * (1 - Math.exp(-(x + 40) / 18)), 20, 100)}<path d="M18 24H102" stroke={B} {...thin} strokeDasharray="3 3" /></g>;
    if (has(slug, /taylor/)) return <g>{ax}{curve((x) => 22 * Math.sin(x / 12))}{curve((x) => 22 * (x / 12 - (x / 12) ** 3 / 6), 30, 90, B)}</g>;
    const h = (x: number) => 20 + 16 * Math.sin((x - 20) / 18); return <g><path d="M18 78H102" stroke={L} {...thin} />{Array.from({ length: 8 }, (_, i) => { const x = 24 + i * 9; return <rect key={i} x={x} y={f(78 - h(x + 4.5))} width={8} height={f(h(x + 4.5))} fill={A} fillOpacity={0.22} />; })}<path d={pathOf(Array.from({ length: 41 }, (_, i) => { const x = 20 + i * 2; return [x, 78 - h(x)]; }))} stroke={A} {...sw} /></g>; }
  if (m === 'vectors') { const grid = <g>{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${28 + i * 16} 16V80M24 ${16 + i * 16}H96`} stroke={L} strokeWidth={0.8} opacity={0.7} />)}</g>;
    if (has(slug, /matrix|determinant/)) return <g>{grid}<path d="M44 64L76 56L84 24L52 32Z" fill={A} fillOpacity={has(slug, /determinant/) ? 0.3 : 0.12} stroke={A} {...sw} /><rect x={44} y={48} width={16} height={16} stroke={B} {...thin} /></g>;
    if (has(slug, /eigen/)) return <g>{grid}<path d="M28 80L92 16" stroke={B} {...thin} strokeDasharray="3 3" /><path d="M44 64L76 32M70 33L76 32L75 38" stroke={A} {...sw} strokeWidth={2} /><path d="M44 64L84 60M79 57L84 60L79 63" stroke={L} {...sw} /></g>;
    return <g>{grid}<path d="M44 64L84 48M78 45L84 48L79 52" stroke={A} {...sw} strokeWidth={2} /><path d="M44 64L56 24M52 28L56 24L59 30" stroke={B} {...sw} strokeWidth={2} /><path d="M56 24L96 8" stroke={L} {...thin} strokeDasharray="2 3" /></g>; }
  if (m === 'bell') { const g = (x: number) => 78 - 56 * Math.exp(-((x - 60) ** 2) / 300);
    const bars = Array.from({ length: 9 }, (_, i) => { const x = 22 + i * 8.6; return <rect key={i} x={f(x)} y={f(g(x + 4) + (has(slug, /clt/) ? (r() - 0.5) * 8 : 0))} width={7} height={f(78 - g(x + 4))} fill={has(slug, /binomial/) ? A : B} fillOpacity={has(slug, /binomial/) ? 0.6 : 0.3} />; });
    return <g><path d="M16 78H104" stroke={L} {...thin} />{has(slug, /normal/) ? null : bars}{has(slug, /binomial/) ? null : <path d={pathOf(Array.from({ length: 45 }, (_, i) => [16 + i * 2, g(16 + i * 2)]))} stroke={A} {...sw} />}{has(slug, /normal/) ? <path d="M60 22V78" stroke={B} {...thin} strokeDasharray="3 3" /> : null}</g>; }
  if (m === 'unit') { if (has(slug, /wave/)) return <g>{ax}{curve((x) => 20 * Math.sin(x / 9.5))}{curve((x) => 20 * Math.cos(x / 9.5), 20, 100, B)}</g>;
    const an = Math.PI / 4, x = 60 + 28 * Math.cos(an), y = 48 - 28 * Math.sin(an);
    return <g>{ax}<circle cx={60} cy={48} r={28} stroke={A} {...sw} strokeWidth={1.2} /><path d={`M60 48L${f(x)} ${f(y)}`} stroke={A} {...sw} /><path d={`M${f(x)} ${f(y)}V48${has(slug, /id/) ? `H60` : ''}`} stroke={B} {...sw} strokeDasharray="2.5 2.5" /><path d="M70 48A10 10 0 0 0 67 41" stroke={B} {...thin} />{dot(x, y)}</g>; }
  // discrete
  if (has(slug, /venn/)) return <g><circle cx={48} cy={48} r={22} fill={A} fillOpacity={0.15} stroke={A} {...sw} /><circle cx={72} cy={48} r={22} fill={B} fillOpacity={0.15} stroke={B} {...sw} /></g>;
  if (has(slug, /modular/)) return <g><circle cx={60} cy={48} r={28} stroke={L} {...thin} />{Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * 2 * Math.PI - Math.PI / 2; return dot(60 + 28 * Math.cos(a), 48 + 28 * Math.sin(a), i % 3 ? L : A, i); })}<path d="M60 20L84.2 62L35.8 62Z" stroke={A} {...sw} /></g>;
  if (has(slug, /sequence/)) return <g><path d="M18 80H102" stroke={L} {...thin} />{Array.from({ length: 8 }, (_, i) => dot(24 + i * 10, 76 - (i * i) * 0.95, i % 2 ? B : A, i))}</g>;
  if (has(slug, /shortest/)) { const pts: [number, number][] = [[24, 60], [44, 30], [60, 62], [78, 34], [96, 54]]; return <g><path d="M24 60L60 62L96 54M44 30L78 34" stroke={L} {...thin} /><path d={pathOf([pts[0], pts[1], pts[2], pts[3], pts[4]])} stroke={A} {...sw} />{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill={bg} stroke={A} strokeWidth={1.4} />)}</g>; }
  const pts: [number, number][] = []; let gx = 0, gy = 0; for (let i = 0; i < 9; i++) { pts.push([30 + gx * 12, 24 + gy * 12]); if ((r() < 0.5 && gx < 5) || gy >= 4) gx++; else gy++; }
  return <g>{Array.from({ length: 30 }, (_, i) => <circle key={i} cx={30 + (i % 6) * 12} cy={24 + Math.floor(i / 6) * 12} r={1.4} fill={L} />)}<path d={pathOf(pts)} stroke={A} {...sw} />{pts.map(([x, y], i) => dot(x, y, i === pts.length - 1 ? B : A, 'p' + i))}</g>;
}

/** Safe area the motif is fitted into (viewBox units): centred, same padding for every card. */
const SAFE = { w: 62, h: 42, cx: 60, cy: 48 };
const SAFE_BARE = { w: 112, h: 88, cx: 60, cy: 48 };
/** Crisp vector cover: tinted dark base, faint dot grid, one accent motif centred by its bounding box. */
export function Cover({ cat, slug, tag, bare }: { cat: string; slug: string; tag?: string; bare?: boolean }) {
  const p = catPal(cat), seed = hash(cat + '/' + slug), m = motifFor(cat, slug, tag), id = 'cv' + seed.toString(36);
  const g = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const el = g.current; if (!el) return;
    try {
      el.removeAttribute('transform');
      const b = el.getBBox(); if (!b.width || !b.height) return;
      const S = bare ? SAFE_BARE : SAFE, k = Math.min(S.w / b.width, S.h / b.height, 1.6);
      el.setAttribute('transform', `translate(${f(S.cx - (b.x + b.width / 2) * k)} ${f(S.cy - (b.y + b.height / 2) * k)}) scale(${Math.round(k * 1000) / 1000})`);
    } catch { /* not rendered yet */ }
  }, [cat, slug, tag, bare]);
  return (
    <svg className={'cover-svg' + (bare ? ' cover-bare' : '')} viewBox="0 0 120 96" preserveAspectRatio={bare ? 'xMidYMid meet' : 'xMidYMid slice'} aria-hidden focusable="false" data-motif={m}>
      {bare ? null : <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.bg} /><stop offset="1" stopColor={p.bg2} /></linearGradient>
        <pattern id={id + 'd'} width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill={p.line} /></pattern>
      </defs>}
      {bare ? null : <rect width="120" height="96" fill={`url(#${id})`} />}
      {bare ? null : <rect width="120" height="96" fill={`url(#${id}d)`} opacity=".45" />}
      <g ref={g} className="cover-motif" fill="none">{draw(m, rngOf(seed), p, slug)}</g>
    </svg>
  );
}
