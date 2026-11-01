/**
 * kit-three — 14 Three.js scene families, each with only the knobs it really uses,
 * a live readout + 公式/说明/参数/步骤 info panel (beginner Chinese) and auto-framing.
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createThreeStage, addLights, THREE, fmt, deg, triCount } from './three-stage.js';
import { F } from './info-panel.js';

const FAMILIES = [
  'lattice', 'torus', 'nebula', 'polycubes', 'helix', 'glass', 'wire',
  'instanced', 'terrain-3', 'ringcloud', 'pillar', 'mirror-floor', 'knots', 'orbit-moons',
];
const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const spin = { label: '自转速度', min: 0, max: 3, step: 0.1, value: 1 };
const metal = R('metal', '金属度', 0, 1, 0.05, 0.35);
const W = 0.6; // base spin rad/s
const spinRows = (v) => [['自转角 θ', deg(v.th ?? 0), 'th'], ['角速度 ω', `${fmt(v.w ?? 0)} rad/s`]];
const spinF = F('θ(t) = θ₀ + ω·t，ω = 0.6 × 自转速度');
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

const FAM = {
  lattice: {
    spec: { color: { label: '基础色相', value: '#818cf8' }, speed: spin, size: { label: '方块大小', min: 0.4, max: 1.6, step: 0.05, value: 1 }, count: { label: '每边个数 n', min: 2, max: 5, step: 1, value: 3, buttons: true }, extras: [metal], remountKeys: ['count'] },
    presets: { 疏: { count: 3 }, 密: { count: 5 }, 快转: { speed: 2 }, 慢转: { speed: 0.45 }, 金属: { metal: 0.9 }, 哑光: { metal: 0.05 } },
    radius: 1.55,
    doc: {
      title: '立方晶格 · 三维网格',
      rows: (v) => [...spinRows(v), ['每边 n', String(v.n ?? 0)], ['方块总数 n³', String((v.n ?? 0) ** 3)], ['间距 d', fmt(v.d ?? 0)], ['金属度', fmt(v.metal ?? 0)]],
      formula: () => F('位置 = ((i − (n−1)/2)·d, (j − (n−1)/2)·d, (k − (n−1)/2)·d)') + F('总数 = n × n × n') + spinF,
      explain: '<p>用三重循环 i、j、k 在 x、y、z 三个方向各放 n 个小方块，就得到一个<b>立方晶格</b>（像盐的晶体结构）。减去 (n−1)/2 是为了让整个晶格的中心落在原点。</p><p>每个方块的颜色随 i、j 略微偏移色相，方便你分辨行与列。整体作为一个 Group 一起旋转。</p>',
      params: [['基础色相', '晶格起始颜色，其它方块在此基础上偏移色相'], ['自转速度', '整体旋转快慢'], ['方块大小', '单个方块相对间距的大小'], ['每边个数 n', '每条边方块数，总数 n³ 增长很快（重建）'], ['金属度', '0 哑光 → 1 金属']],
      example: (v) => `<ol><li>n = ${v.n}，总数 ${v.n}³ = ${(v.n ?? 0) ** 3}</li><li>间距 d = 1.6/(n−1) = ${fmt(v.d ?? 0)}</li><li>中心偏移 (n−1)/2 = ${fmt(((v.n ?? 1) - 1) / 2, 1)}</li></ol>`,
      tip: '拖动旋转视角观察三个方向的排列；调 n 看数量按立方增长。',
    },
    build(S, C0) {
      const n = Math.max(2, Math.min(5, Math.round(C0.count || 3)));
      const d = 1.6 / (n - 1), half = (n - 1) / 2;
      const g = new THREE.Group(); const cubes = [];
      const geo = new THREE.BoxGeometry(1, 1, 1);
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
        const c = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.35 }));
        c.position.set((x - half) * d, (y - half) * d, (z - half) * d); c.userData.o = x * 20 + y * 15; g.add(c); cubes.push(c);
      }
      S.scene.add(g); const base = new THREE.Color(); const hsl = {};
      return ({ t, C }) => {
        g.rotation.set(0.35, W * t, 0);
        base.set(C.color || '#818cf8').getHSL(hsl);
        const sz = d * 0.32 * (C.size || 1);
        cubes.forEach((c) => { c.scale.setScalar(sz); c.material.color.setHSL((hsl.h + c.userData.o / 360) % 1, Math.max(0.4, hsl.s), Math.min(0.65, Math.max(0.35, hsl.l))); c.material.metalness = Number(C.metal ?? 0.35); c.material.roughness = 0.6 - 0.45 * Number(C.metal ?? 0.35); });
        return { th: W * t, n, d, metal: Number(C.metal ?? 0.35) };
      };
    },
  },
  torus: {
    spec: { color: { label: '颜色', value: '#818cf8' }, speed: spin, size: { label: '缩放', min: 0.5, max: 1.4, step: 0.05, value: 1 }, count: false, extras: [R('tube', '管半径 r', 0.08, 0.5, 0.02, 0.32), { ...metal, value: 0.35 }, R('rough', '粗糙度', 0, 1, 0.05, 0.35)], remountKeys: ['tube'] },
    presets: { 细管: { tube: 0.12 }, 粗管: { tube: 0.46 }, 快: { speed: 2 }, 慢: { speed: 0.45 }, 金属: { metal: 0.95, rough: 0.12 }, 玻璃感: { metal: 0, rough: 0.04 } },
    radius: 1.5,
    doc: {
      title: '圆环 Torus · 曲面参数',
      rows: (v) => [...spinRows(v), ['主半径 R', fmt(v.Rr ?? 1)], ['管半径 r', fmt(v.r ?? 0)], ['表面积 4π²Rr', fmt(v.A ?? 0)], ['体积 2π²Rr²', fmt(v.V ?? 0, 3)], ['三角形数', String(v.tris ?? 0)]],
      formula: () => F('x = (R + r·cos v)·cos u，y = (R + r·cos v)·sin u，z = r·sin v') + F('S = 4π²Rr，V = 2π²Rr²'),
      explain: '<p>圆环（甜甜圈）可以看成一个半径为 r 的小圆，绕着距离 R 的轴转一圈扫出来的曲面。参数 u 控制绕大圈的位置，v 控制绕小圆的位置。</p><p>它的表面积和体积公式非常整齐：等于“小圆周长/面积 × 大圆周长”（帕普斯定理）。</p><p><b>金属度</b>和<b>粗糙度</b>是 PBR 材质的两个关键参数：粗糙度低时高光又小又亮。</p>',
      params: [['颜色', '材质颜色'], ['自转速度', '旋转快慢'], ['缩放', '整体缩放（R 与 r 一起放大）'], ['管半径 r', '小圆半径；改动后重建几何体'], ['金属度', '0 塑料 → 1 金属'], ['粗糙度', '0 镜面 → 1 磨砂']],
      example: (v) => `<ol><li>R = ${fmt(v.Rr ?? 1)}，r = ${fmt(v.r ?? 0)}</li><li>S = 4π²×${fmt(v.Rr ?? 1)}×${fmt(v.r ?? 0)} = ${fmt(v.A ?? 0)}</li><li>V = 2π²×${fmt(v.Rr ?? 1)}×${fmt(v.r ?? 0)}² = ${fmt(v.V ?? 0, 3)}</li></ol>`,
      tip: '拖动旋转、滚轮缩放；把粗糙度拉到 0 看锐利高光。',
    },
    build(S, C0) {
      const r = Number(C0.tube ?? 0.32);
      const geo = new THREE.TorusGeometry(1, r, 32, 96);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial()); S.scene.add(m);
      return ({ t, C }) => {
        const s = Number(C.size || 1); m.scale.setScalar(s); m.rotation.order = 'YXZ'; m.rotation.set(-0.55 + 0.12 * Math.sin(t * 0.4), 0.85 * Math.sin(W * t), 0);
        m.material.color.set(C.color || '#818cf8'); m.material.metalness = Number(C.metal ?? 0.35); m.material.roughness = Number(C.rough ?? 0.35);
        const RR = s, rr = r * s;
        return { th: W * t, Rr: RR, r: rr, A: 4 * Math.PI ** 2 * RR * rr, V: 2 * Math.PI ** 2 * RR * rr * rr, tris: triCount(geo) };
      };
    },
  },
  nebula: {
    spec: { color: { label: '星点颜色', value: '#a5b4fc' }, speed: spin, size: { label: '点大小', min: 0.3, max: 3, step: 0.1, value: 1 }, count: { label: '经纬分段', min: 12, max: 64, step: 4, value: 32, buttons: true }, extras: [R('breath', '呼吸幅度', 0, 0.3, 0.01, 0.08)], remountKeys: ['count'] },
    presets: { 密点: { count: 56 }, 疏点: { count: 16 }, 大点: { size: 2.2 }, 小点: { size: 0.5 }, 快: { speed: 2 }, 慢: { speed: 0.45 } },
    radius: 1.3,
    doc: {
      title: '星云球 · 球面点阵',
      rows: (v) => [...spinRows(v), ['分段 N', String(v.seg ?? 0)], ['点数 (N+1)²', String(v.pts ?? 0)], ['点大小', fmt(v.ps ?? 0, 3)], ['当前半径 ρ', fmt(v.rho ?? 1, 3)]],
      formula: () => F('x = ρ·sinφ·cosθ，y = ρ·cosφ，z = ρ·sinφ·sinθ') + F('ρ(t) = 1 + b·sin(1.5·t)（呼吸）'),
      explain: '<p>把球面按经线、纬线切成 N×N 格，每个格点放一个发光的点，就成了“星云球”。这就是<b>球坐标</b>：用角度 θ（经度）和 φ（纬度）加半径 ρ 描述空间中的点。</p><p>靠近两极的点会挤在一起，因为每一圈纬线都分了同样多的点——这是经纬网格的特点。</p><p>“呼吸”让半径随时间正弦变化，整个球一胀一缩。</p>',
      params: [['星点颜色', '点的颜色'], ['自转速度', '绕 Y 轴旋转快慢'], ['点大小', '每个点的显示尺寸'], ['经纬分段', '分段 N，越大点越密（重建）'], ['呼吸幅度', '半径起伏 b，0 = 不呼吸']],
      example: (v) => `<ol><li>N = ${v.seg} → 点数 (${v.seg}+1)² = ${v.pts}</li><li>此刻半径 ρ = ${fmt(v.rho ?? 1, 3)}</li><li>观察两极：点比赤道更密集</li></ol>`,
      tip: '拖动旋转，从顶部看两极的点如何挤在一起。',
    },
    build(S, C0) {
      const seg = Math.max(12, Math.min(64, Math.round(C0.count || 32)));
      const geo = new THREE.SphereGeometry(1, seg, seg);
      const mat = new THREE.PointsMaterial({ size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
      const p = new THREE.Points(geo, mat); S.scene.add(p);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }));
      S.scene.add(core);
      return ({ t, C }) => {
        core.material.color.set(C.color || '#a5b4fc'); core.scale.setScalar(1 + 0.5 * Number(C.breath ?? 0.08) * Math.cos(1.5 * t));
        const rho = 1 + Number(C.breath ?? 0.08) * Math.cos(1.5 * t);
        p.scale.setScalar(rho); p.rotation.set(0.3, W * t, 0);
        mat.size = 0.05 * Number(C.size || 1); mat.color.set(C.color || '#a5b4fc');
        return { th: W * t, seg, pts: (seg + 1) ** 2, ps: mat.size, rho };
      };
    },
  },
  polycubes: {
    spec: { color: { label: '颜色', value: '#818cf8' }, speed: spin, size: { label: '方块边长', min: 0.2, max: 0.8, step: 0.02, value: 0.45 }, count: { label: '方块数 n', min: 3, max: 16, step: 1, value: 8, buttons: true }, extras: [metal], remountKeys: ['count'] },
    presets: { 少: { count: 4 }, 多: { count: 14 }, 快: { speed: 2 }, 慢: { speed: 0.45 }, 金属: { metal: 0.9 }, 哑光: { metal: 0.05 } },
    radius: 1.9,
    doc: {
      title: '环绕立方 · 圆周均分',
      rows: (v) => [...spinRows(v), ['方块数 n', String(v.n ?? 0)], ['夹角 Δθ = 360°/n', `${fmt(360 / (v.n || 1), 1)}°`], ['环半径 R', '1.40'], ['边长 a', fmt(v.a ?? 0)], ['1 号高度 y₁', fmt(v.y1 ?? 0, 3)]],
      formula: () => F('θᵢ = 2π·i / n') + F('xᵢ = R·cos(θᵢ + ωt)，zᵢ = R·sin(θᵢ + ωt)') + F('yᵢ = 0.3·sin(2t + θᵢ)'),
      explain: '<p>把一个圆周平均分成 n 份，每份放一个方块，就是<b>圆周均分</b>：第 i 个方块的角度 θᵢ = 2πi/n。再用 cos、sin 把角度换成 x、z 坐标。</p><p>每个方块的高度按正弦起伏，且相位错开 θᵢ，于是一圈方块像“人浪”一样依次起伏。</p>',
      params: [['颜色', '方块颜色'], ['自转速度', '方块绕中心公转的快慢'], ['方块边长', '每个方块大小 a'], ['方块数 n', '圆周上放几个（重建）'], ['金属度', '材质金属感']],
      example: (v) => `<ol><li>n = ${v.n}，每两个相邻方块相差 ${fmt(360 / (v.n || 1), 1)}°</li><li>1 号方块此刻高度 y₁ = ${fmt(v.y1 ?? 0, 3)}</li><li>周长 2πR ≈ ${fmt(2 * Math.PI * 1.4)}，平均每块间距 ≈ ${fmt((2 * Math.PI * 1.4) / (v.n || 1))}</li></ol>`,
      tip: '从正上方看圆周均分最清楚；从侧面看“人浪”起伏。',
    },
    build(S, C0) {
      const n = Math.max(3, Math.min(16, Math.round(C0.count || 8)));
      const g = new THREE.Group(); const geo = new THREE.BoxGeometry(1, 1, 1);
      const cubes = Array.from({ length: n }, () => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.4 })); g.add(m); return m; });
      S.scene.add(g);
      return ({ t, C }) => {
        let y1 = 0;
        cubes.forEach((m, i) => { const a = (2 * Math.PI * i) / n + W * t; const y = 0.3 * Math.sin(2 * t + (2 * Math.PI * i) / n); if (i === 0) y1 = y; m.position.set(1.4 * Math.cos(a), y, 1.4 * Math.sin(a)); m.rotation.set(t, a, 0); m.scale.setScalar(Number(C.size || 0.45)); m.material.color.set(C.color || '#818cf8'); m.material.metalness = Number(C.metal ?? 0.35); });
        return { th: W * t, n, a: Number(C.size || 0.45), y1 };
      };
    },
  },
  helix: {
    spec: { color: { label: '颜色', value: '#22d3ee' }, speed: spin, size: { label: '缩放', min: 0.5, max: 1.3, step: 0.05, value: 1 }, count: false, extras: [R('turns', '圈数', 1, 6, 0.5, 3), R('tube', '管粗细', 0.03, 0.2, 0.01, 0.08)], remountKeys: ['turns', 'tube'] },
    presets: { 紧螺: { turns: 5 }, 松螺: { turns: 1.5 }, 细管: { tube: 0.04 }, 粗管: { tube: 0.16 }, 快: { speed: 2 }, 慢: { speed: 0.45 } },
    radius: 1.45,
    doc: {
      title: '螺旋线 · 参数曲线',
      rows: (v) => [...spinRows(v), ['圈数 k', fmt(v.k ?? 0, 1)], ['半径 R', '1.20'], ['总高 h', '2.00'], ['螺距 p = h/k', fmt(v.pitch ?? 0, 3)], ['弧长 L', fmt(v.L ?? 0)]],
      formula: () => F('x = R·cos(2πk·u)，y = h·(u − ½)，z = R·sin(2πk·u)，u∈[0,1]') + F('L = k · √((2πR)² + p²)'),
      explain: '<p>螺旋线是一条<b>参数曲线</b>：参数 u 从 0 走到 1，x、z 绕圆转 k 圈，同时 y 均匀上升 h。把它展开，每一圈就像斜坡上的一段直线，所以弧长可以用勾股定理算。</p><p>TubeGeometry 沿着这条曲线“套”上一根圆管，就变成了看得见的弹簧/DNA 形状。</p>',
      params: [['颜色', '管子颜色'], ['自转速度', '绕竖直轴旋转'], ['缩放', '整体大小'], ['圈数', '绕几圈 k（重建）'], ['管粗细', '圆管半径（重建）']],
      example: (v) => `<ol><li>k = ${fmt(v.k ?? 0, 1)}，螺距 p = 2/${fmt(v.k ?? 1, 1)} = ${fmt(v.pitch ?? 0, 3)}</li><li>每圈长度 = √((2π×1.2)² + p²) = ${fmt((v.L ?? 0) / (v.k || 1), 3)}</li><li>总弧长 L = ${fmt(v.L ?? 0)}</li></ol>`,
      tip: '拖动从侧面看螺距，从顶部看是一个圆。',
    },
    build(S, C0) {
      const k = Number(C0.turns ?? 3), rad = Number(C0.tube ?? 0.08);
      class Helix extends THREE.Curve { getPoint(u, out = new THREE.Vector3()) { return out.set(1.2 * Math.cos(2 * Math.PI * k * u), 2 * (u - 0.5), 1.2 * Math.sin(2 * Math.PI * k * u)); } }
      const geo = new THREE.TubeGeometry(new Helix(), Math.round(80 * k), rad, 10, false);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.35 })); S.scene.add(m);
      const pitch = 2 / k, L = k * Math.hypot(2 * Math.PI * 1.2, pitch);
      return ({ t, C }) => { m.rotation.y = W * t; m.scale.setScalar(Number(C.size || 1)); m.material.color.set(C.color || '#22d3ee'); return { th: W * t, k, pitch, L }; };
    },
  },
  glass: {
    spec: { color: { label: '玻璃色调', value: '#c7d2fe' }, speed: spin, size: { label: '球半径', min: 0.5, max: 1.3, step: 0.05, value: 1 }, count: false, extras: [R('trans', '透射率', 0, 1, 0.05, 0.85), R('ior', '折射率 n', 1, 2.4, 0.05, 1.5)] },
    presets: { 高透: { trans: 0.95 }, 低透: { trans: 0.25 }, 大: { size: 1.25 }, 小: { size: 0.65 }, 快转: { speed: 2 }, 慢转: { speed: 0.45 } },
    radius: 1.6,
    doc: {
      title: '玻璃球 · 透射与折射',
      rows: (v) => [...spinRows(v), ['透射率', `${fmt((v.tr ?? 0) * 100, 0)}%`], ['折射率 n', fmt(v.n ?? 1.5)], ['临界角 arcsin(1/n)', v.n > 1 ? `${fmt(Math.asin(1 / v.n) * 180 / Math.PI, 1)}°` : '无'], ['球半径', fmt(v.r ?? 1)]],
      formula: () => F('斯涅尔定律：n₁·sinθ₁ = n₂·sinθ₂') + F('临界角 θc = arcsin(1/n)（从玻璃射向空气）'),
      explain: '<p>MeshPhysicalMaterial 的 <b>transmission（透射）</b>让光穿过物体，<b>ior（折射率）</b>决定光线拐弯多少：空气 n≈1，水 1.33，玻璃约 1.5，钻石 2.42。</p><p>球后面放了一圈彩色小方块，透过玻璃球看它们会被放大、颠倒、扭曲——这就是折射。折射率越大，扭曲越强。</p>',
      params: [['玻璃色调', '玻璃本身的颜色'], ['自转速度', '背景方块环绕的速度'], ['球半径', '玻璃球大小'], ['透射率', '0 = 不透明，1 = 完全透光'], ['折射率 n', '光线弯折程度']],
      example: (v) => `<ol><li>n = ${fmt(v.n ?? 1.5)}：光以 30° 入射，折射角 = arcsin(sin30°/n) = ${fmt(Math.asin(0.5 / (v.n || 1.5)) * 180 / Math.PI, 1)}°</li><li>临界角 ${v.n > 1 ? fmt(Math.asin(1 / v.n) * 180 / Math.PI, 1) + '°' : '—'}：超过它会全反射</li></ol>`,
      tip: '拖动旋转，透过玻璃球观察背后方块被扭曲；把折射率调到 1 对比。',
    },
    build(S, C0) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), new THREE.MeshPhysicalMaterial({ transmission: 0.85, thickness: 1.2, roughness: 0.05, metalness: 0, ior: 1.5 }));
      S.scene.add(ball);
      const ring = new THREE.Group();
      for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i / 12, 0.75, 0.55) })); const a = (i / 12) * Math.PI * 2; c.position.set(Math.cos(a) * 1.9, Math.sin(a * 2) * 0.35, Math.sin(a) * 1.9); ring.add(c); }
      S.scene.add(ring);
      return ({ t, C }) => {
        ring.rotation.y = W * t; ball.scale.setScalar(Number(C.size || 1));
        ball.material.color.set(C.color || '#c7d2fe'); ball.material.transmission = Number(C.trans ?? 0.85); ball.material.ior = Number(C.ior ?? 1.5);
        return { th: W * t, tr: ball.material.transmission, n: ball.material.ior, r: Number(C.size || 1) };
      };
    },
  },
  wire: {
    spec: { color: { label: '线条颜色', value: '#a5b4fc' }, speed: spin, size: { label: '缩放', min: 0.5, max: 1.4, step: 0.05, value: 1 }, count: { label: '细分级别 d', min: 0, max: 4, step: 1, value: 1, buttons: true }, remountKeys: ['count'] },
    presets: { 细线: { count: 0 }, 密线: { count: 3 }, 快: { speed: 2 }, 慢: { speed: 0.45 }, 亮: { color: '#e0e7ff' }, 暗: { color: '#4338ca' } },
    radius: 1.3,
    doc: {
      title: '二十面体线框 · 细分',
      rows: (v) => [...spinRows(v), ['细分 d', String(v.d ?? 0)], ['面 F = 20·4^d', String(20 * 4 ** (v.d ?? 0))], ['棱 E = 30·4^d', String(30 * 4 ** (v.d ?? 0))], ['顶点 V = 10·4^d+2', String(10 * 4 ** (v.d ?? 0) + 2)], ['欧拉 V−E+F', '2']],
      formula: () => F('每细分一次：每个三角形 → 4 个小三角形') + F('欧拉公式：V − E + F = 2'),
      explain: '<p>正二十面体有 20 个三角形面。<b>细分</b>时把每条边的中点连起来，一个三角形就变成 4 个，再把新顶点推到球面上——细分越多越接近圆球（这就是“测地线球”）。</p><p>无论细分多少次，顶点数 − 棱数 + 面数 永远等于 2，这是凸多面体的<b>欧拉公式</b>。</p>',
      params: [['线条颜色', '线框颜色'], ['自转速度', '旋转快慢'], ['缩放', '整体大小'], ['细分级别 d', '0 = 正二十面体，每 +1 面数 ×4（重建）']],
      example: (v) => `<ol><li>d = ${v.d}：F = 20×4^${v.d} = ${20 * 4 ** (v.d ?? 0)}</li><li>E = ${30 * 4 ** (v.d ?? 0)}，V = ${10 * 4 ** (v.d ?? 0) + 2}</li><li>V − E + F = ${10 * 4 ** (v.d ?? 0) + 2} − ${30 * 4 ** (v.d ?? 0)} + ${20 * 4 ** (v.d ?? 0)} = 2 ✓</li></ol>`,
      tip: '用细分按钮从 0 加到 4，看多面体变成球。',
    },
    build(S, C0) {
      const d = Math.max(0, Math.min(4, Math.round(C0.count ?? 1)));
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, d), new THREE.MeshBasicMaterial({ wireframe: true })); S.scene.add(m);
      return ({ t, C }) => { m.rotation.set(0.3 * Math.sin(t * 0.5), W * t, 0); m.scale.setScalar(Number(C.size || 1)); m.material.color.set(C.color || '#a5b4fc'); return { th: W * t, d }; };
    },
  },
  instanced: {
    spec: { color: { label: '颜色', value: '#818cf8' }, speed: spin, size: { label: '方块大小', min: 0.4, max: 2, step: 0.1, value: 1 }, count: { label: '实例数 N', min: 20, max: 400, step: 20, value: 120, buttons: true }, extras: [R('spread', '分布范围', 1.5, 6, 0.1, 3.6)], remountKeys: ['count'] },
    presets: { 少: { count: 60 }, 多: { count: 360 }, 散布: { spread: 5.5 }, 聚拢: { spread: 2 }, 快: { speed: 2 }, 慢: { speed: 0.45 } },
    radius: 2.0,
    doc: {
      title: 'InstancedMesh · 实例化',
      rows: (v) => [...spinRows(v), ['实例数 N', String(v.n ?? 0)], ['绘制调用', '1 次（普通做法 N 次）'], ['分布范围', `±${fmt((v.sp ?? 0) / 2, 2)}`], ['总三角形', String((v.n ?? 0) * 12)]],
      formula: () => F('每个实例：世界矩阵 Mᵢ = 平移(pᵢ·s) · 旋转(ωt + i) · 缩放(a)') + F('一次 draw call 画出全部 N 个'),
      explain: '<p>如果要画几百个一样的方块，最笨的办法是创建几百个 Mesh，CPU 要发几百次绘制命令（draw call）。<b>InstancedMesh</b> 只上传一份几何体，再给每个实例一个变换矩阵，GPU 一次就画完。</p><p>“分布范围”把所有实例的位置按比例放大缩小，你会看到它们从中心散开或聚拢。</p>',
      params: [['颜色', '实例颜色'], ['自转速度', '整体旋转和每块自转快慢'], ['方块大小', '每个实例的缩放'], ['实例数 N', '实例个数（重建）'], ['分布范围', '位置的整体缩放 s']],
      example: (v) => `<ol><li>N = ${v.n} 个方块，每个 12 个三角形 → 共 ${(v.n ?? 0) * 12}</li><li>普通 Mesh：${v.n} 次 draw call；InstancedMesh：1 次</li></ol>`,
      tip: '调实例数到 400 感受依旧流畅；拖“分布范围”看散开/聚拢。',
    },
    build(S, C0) {
      const n = Math.max(20, Math.min(400, Math.round(C0.count || 120)));
      const ig = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), n);
      const base = Array.from({ length: n }, () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
      S.scene.add(ig);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
      return ({ t, C }) => {
        const sp = Number(C.spread ?? 3.6), a = Number(C.size || 1);
        for (let i = 0; i < n; i++) { e.set(t + i, t * 0.7 + i, 0); q.setFromEuler(e); p.copy(base[i]).multiplyScalar(sp); sc.setScalar(a); m4.compose(p, q, sc); ig.setMatrixAt(i, m4); }
        ig.instanceMatrix.needsUpdate = true; ig.rotation.y = W * t * 0.5; ig.material.color.set(C.color || '#818cf8');
        return { th: W * t * 0.5, n, sp };
      };
    },
  },
  'terrain-3': {
    spec: { color: { label: '颜色', value: '#34d399' }, speed: { label: '波速', min: 0, max: 3, step: 0.1, value: 1 }, size: { label: '振幅 A', min: 0.05, max: 0.7, step: 0.05, value: 0.3 }, count: { label: '网格细分 N', min: 16, max: 96, step: 8, value: 48, buttons: true }, extras: [R('freq', '波数 k', 1, 5, 0.1, 2.5)], remountKeys: ['count'] },
    presets: { 高波: { size: 0.6 }, 低波: { size: 0.1 }, 密网: { count: 88 }, 疏网: { count: 24 }, 快: { speed: 2 }, 慢: { speed: 0.45 } },
    radius: 2.2, fill: 0.9,
    doc: {
      title: '水波纹 · 径向衰减波',
      rows: (v) => [['中心高度 z(0)', fmt(v.z0 ?? 0, 3), 'z0'], ['振幅 A', fmt(v.A ?? 0)], ['波数 k', fmt(v.k ?? 0, 1)], ['波长 λ = 2π/k', fmt(v.lam ?? 0)], ['角频率 ω', `${fmt(v.w ?? 0)} rad/s`], ['顶点数', String(v.verts ?? 0)]],
      formula: () => F('z(r, t) = A · sin(k·r − ω·t) / (1 + r)') + F('r = √(x² + y²)，λ = 2π/k'),
      explain: '<p>往平静的水里丢一颗石子，波纹会从中心一圈圈向外扩散，而且越往外越弱。公式里 <b>sin(k·r − ω·t)</b> 表示“沿半径 r 向外跑的波”，除以 (1+r) 表示能量摊到更大的圆周上、振幅变小。</p><p>这里每帧对网格的每个顶点计算 z 值并重算法线，属于 CPU 端的<b>顶点动画</b>。</p>',
      params: [['颜色', '网格颜色'], ['波速', 'ω = 2 × 倍率，0 = 冻结'], ['振幅 A', '中心波峰高度'], ['网格细分 N', '每边格子数（重建）'], ['波数 k', '波纹疏密，k 越大圈越密']],
      example: (v) => `<ol><li>k = ${fmt(v.k ?? 0, 1)} → 相邻两圈波峰相距 λ = ${fmt(v.lam ?? 0)}</li><li>r = 1 处的最大振幅 = A/2 = ${fmt((v.A ?? 0) / 2, 3)}</li><li>波纹外扩速度 = ω/k = ${fmt((v.w ?? 0) / (v.k || 1))}</li></ol>`,
      tip: '把波速调 0 再拖波数，看圈数变化；拖动换个角度看衰减。',
    },
    build(S, C0) {
      const seg = Math.max(16, Math.min(96, Math.round(C0.count || 48)));
      const geo = new THREE.PlaneGeometry(3.6, 3.6, seg, seg);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide, flatShading: true }));
      mesh.rotation.x = -Math.PI / 2.4; S.scene.add(mesh);
      const base = Float32Array.from(geo.attributes.position.array);
      return ({ t, C }) => {
        const A = Number(C.size ?? 0.3), k = Number(C.freq ?? 2.5), ph = 2 * t; const pos = geo.attributes.position.array;
        for (let i = 0; i < pos.length; i += 3) { const r = Math.hypot(base[i], base[i + 1]); pos[i + 2] = (A * Math.sin(k * r - ph)) / (1 + r); }
        geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); mesh.material.color.set(C.color || '#34d399');
        return { z0: A * Math.sin(-ph), A, k, lam: (2 * Math.PI) / k, w: 2 * C.speed, verts: (seg + 1) ** 2 };
      };
    },
  },
  ringcloud: {
    spec: { color: { label: '颜色', value: '#fbbf24' }, speed: { label: '公转速度', min: 0, max: 3, step: 0.1, value: 1 }, size: { label: '点大小', min: 0.4, max: 3, step: 0.1, value: 1 }, count: { label: '点数（×100）', min: 4, max: 30, step: 2, value: 12, buttons: true }, extras: [R('thick', '环厚度', 0.05, 0.9, 0.05, 0.35)], remountKeys: ['count'] },
    presets: { 密: { count: 26 }, 疏: { count: 6 }, 厚环: { thick: 0.8 }, 薄环: { thick: 0.1 }, 快: { speed: 2 }, 慢: { speed: 0.45 } },
    radius: 1.65,
    doc: {
      title: '行星环 · 开普勒差速',
      rows: (v) => [['点数 N', String(v.n ?? 0)], ['内缘 r=0.9 角速度', `${fmt(v.wIn ?? 0)} rad/s`], ['外缘 r=1.6 角速度', `${fmt(v.wOut ?? 0)} rad/s`], ['内外速度比', fmt(v.ratio ?? 0)], ['环厚度', fmt(v.th ?? 0)], ['点大小', fmt(v.ps ?? 0, 3)]],
      formula: () => F('ω(r) = ω₀ · r^(−3/2)（开普勒第三定律）') + F('内外比 = (1.6/0.9)^1.5 ≈ 2.37'),
      explain: '<p>土星环由无数冰块组成，每块都像小卫星一样绕土星公转。离得越近转得越快（ω ∝ r^−1.5），所以环的内圈总在“超车”外圈，这叫<b>差速旋转</b>。</p><p>程序每帧给每个点按自己的半径加上不同的角度，原本均匀的点会慢慢被拉出螺旋纹理。</p>',
      params: [['颜色', '点的颜色'], ['公转速度', '整体时间倍率 ω₀'], ['点大小', '每个点的尺寸'], ['点数（×100）', '粒子数量（重建）'], ['环厚度', '竖直方向的厚度']],
      example: (v) => `<ol><li>内缘 ω = ${fmt(v.wIn ?? 0)}，外缘 ω = ${fmt(v.wOut ?? 0)}</li><li>内缘转一圈 ${v.wIn ? fmt((2 * Math.PI) / v.wIn, 1) + ' 秒' : '—'}，外缘 ${v.wOut ? fmt((2 * Math.PI) / v.wOut, 1) + ' 秒' : '—'}</li></ol>`,
      tip: '从正上方看差速产生的纹理；调厚度对比“薄如纸”的真实行星环。',
    },
    build(S, C0) {
      const n = Math.max(400, Math.min(3000, Math.round((C0.count || 12) * 100)));
      const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3);
      const rr = new Float32Array(n), a0 = new Float32Array(n), yy = new Float32Array(n);
      for (let i = 0; i < n; i++) { rr[i] = 0.9 + Math.random() * 0.7; a0[i] = (i / n) * Math.PI * 2 + Math.random() * 0.2; yy[i] = Math.random() - 0.5; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.9, depthWrite: false });
      const pts = new THREE.Points(geo, mat); pts.rotation.x = 0.45; S.scene.add(pts);
      const planet = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })); S.scene.add(planet);
      return ({ t, C }) => {
        const th = Number(C.thick ?? 0.35);
        for (let i = 0; i < n; i++) { const a = a0[i] + 0.8 * t * rr[i] ** -1.5; pos[i * 3] = Math.cos(a) * rr[i]; pos[i * 3 + 1] = yy[i] * th; pos[i * 3 + 2] = Math.sin(a) * rr[i]; }
        geo.attributes.position.needsUpdate = true; mat.color.set(C.color || '#fbbf24'); mat.size = 0.035 * Number(C.size || 1);
        const wIn = 0.8 * C.speed * 0.9 ** -1.5, wOut = 0.8 * C.speed * 1.6 ** -1.5;
        return { n, wIn, wOut, ratio: wOut ? wIn / wOut : (1.6 / 0.9) ** 1.5, th, ps: mat.size };
      };
    },
  },
  pillar: {
    spec: { color: { label: '光柱颜色', value: '#22d3ee' }, speed: spin, size: { label: '粗细', min: 0.4, max: 1.8, step: 0.05, value: 1 }, count: false, extras: [R('h', '高度 h', 1, 3.4, 0.1, 2.4), R('glow', '发光强度', 0, 2, 0.05, 0.6)] },
    presets: { 细柱: { size: 0.55 }, 粗柱: { size: 1.6 }, 高: { h: 3.2 }, 矮: { h: 1.3 }, 快转: { speed: 2 }, 慢转: { speed: 0.45 } },
    radius: 1.55, target: [0, 0.2, 0],
    doc: {
      title: '光柱 · 圆台体积',
      rows: (v) => [...spinRows(v), ['顶半径 r₁', fmt(v.r1 ?? 0, 3)], ['底半径 r₂', fmt(v.r2 ?? 0, 3)], ['高度 h', fmt(v.h ?? 0)], ['体积 V', fmt(v.V ?? 0, 3)], ['发光', fmt(v.glow ?? 0)]],
      formula: () => F('圆台体积 V = π·h·(r₁² + r₁r₂ + r₂²) / 3') + F('最终颜色 = 漫反射 + 自发光 emissive × 强度'),
      explain: '<p>CylinderGeometry 的上下半径可以不同，于是得到一个<b>圆台</b>（被削掉尖的圆锥）。体积公式介于圆柱 πr²h 和圆锥 πr²h/3 之间。</p><p><b>自发光（emissive）</b>让物体即使在阴影里也有颜色，配合半透明，就像一根发光的能量柱；地面上的光圈随时间轻轻脉动。</p>',
      params: [['光柱颜色', '材质与发光颜色'], ['自转速度', '光柱旋转与脉动快慢'], ['粗细', '上下半径一起缩放'], ['高度 h', '光柱高度'], ['发光强度', 'emissive 强度，0 = 不发光']],
      example: (v) => `<ol><li>r₁ = ${fmt(v.r1 ?? 0, 3)}，r₂ = ${fmt(v.r2 ?? 0, 3)}，h = ${fmt(v.h ?? 0)}</li><li>V = π×${fmt(v.h ?? 0)}×(${fmt((v.r1 ?? 0) ** 2, 3)} + ${fmt((v.r1 ?? 0) * (v.r2 ?? 0), 3)} + ${fmt((v.r2 ?? 0) ** 2, 3)})/3 = ${fmt(v.V ?? 0, 3)}</li></ol>`,
      tip: '拖动环绕；把发光强度调高再调低，对比自发光效果。',
    },
    build(S) {
      const geo = new THREE.CylinderGeometry(0.25, 0.55, 1, 40, 1, true);
      const mat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.85, side: THREE.DoubleSide, roughness: 0.3 });
      const m = new THREE.Mesh(geo, mat); S.scene.add(m);
      const disc = new THREE.Mesh(new THREE.RingGeometry(0.62, 1.3, 64), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2; S.scene.add(disc);
      return ({ t, C }) => {
        const s = Number(C.size || 1), h = Number(C.h ?? 2.4), glow = Number(C.glow ?? 0.6);
        m.scale.set(s, h, s); m.position.y = h / 2 - 1; m.rotation.y = W * t; disc.position.y = -1;
        mat.color.set(C.color || '#22d3ee'); mat.emissive.set(C.color || '#22d3ee'); mat.emissiveIntensity = glow;
        disc.material.color.set(C.color || '#22d3ee'); disc.scale.setScalar(s * (1 + 0.12 * Math.sin(2 * t)));
        const r1 = 0.25 * s, r2 = 0.55 * s;
        return { th: W * t, r1, r2, h, V: (Math.PI * h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3, glow };
      };
    },
  },
  'mirror-floor': {
    spec: { color: { label: '球颜色', value: '#818cf8' }, speed: { label: '浮动速度', min: 0, max: 3, step: 0.1, value: 1 }, size: { label: '球半径', min: 0.3, max: 1, step: 0.05, value: 0.6 }, count: false, extras: [R('refl', '地面反射率', 0, 1, 0.05, 0.55)] },
    presets: { 大球: { size: 0.95 }, 小球: { size: 0.35 }, 亮地: { refl: 0.85 }, 暗地: { refl: 0.15 }, 快: { speed: 2 }, 慢: { speed: 0.45 } },
    radius: 1.9, target: [0, -0.2, 0],
    doc: {
      title: '镜面地板 · 镜像反射',
      rows: (v) => [['球心高度 y', fmt(v.y ?? 0, 3), 'y'], ['镜像高度 y′', fmt(v.ym ?? 0, 3)], ['离地距离', fmt(v.gap ?? 0, 3)], ['球半径', fmt(v.r ?? 0)], ['反射率', `${fmt((v.refl ?? 0) * 100, 0)}%`], ['浮动周期', v.Tp ? `${fmt(v.Tp, 2)} s` : '∞']],
      formula: () => F('关于地面 y = y₀ 的镜像：y′ = 2·y₀ − y') + F('y(t) = 0.35 + 0.3·sin(1.6·t)'),
      explain: '<p>真实的镜面反射计算很贵，游戏里常用一个小技巧：把物体<b>关于地面翻转复制</b>一份放到地板下面，再让地板半透明，看起来就像地面映出了倒影。</p><p>镜像点满足：到地面的距离与原物体相等、方向相反，所以 y′ = 2y₀ − y。球往上浮，倒影就往下沉。</p>',
      params: [['球颜色', '球体颜色'], ['浮动速度', '上下浮动的时间倍率'], ['球半径', '球的大小'], ['地面反射率', '倒影的清晰程度（地板越透明倒影越清楚）']],
      example: (v) => `<ol><li>地面 y₀ = −1，球心 y = ${fmt(v.y ?? 0, 3)}</li><li>镜像 y′ = 2×(−1) − (${fmt(v.y ?? 0, 3)}) = ${fmt(v.ym ?? 0, 3)}</li><li>球底到地面的距离 = ${fmt(v.gap ?? 0, 3)}</li></ol>`,
      tip: '拖动从低角度看倒影最明显；调反射率对比。',
    },
    build(S) {
      const ballMat = new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.3 });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), ballMat); S.scene.add(ball);
      const mirror = new THREE.Mesh(ball.geometry, ballMat); S.scene.add(mirror);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.45, metalness: 0.6, roughness: 0.25 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -1; S.scene.add(floor);
      const rim = new THREE.Mesh(new THREE.RingGeometry(2.38, 2.45, 64), new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide })); rim.rotation.x = -Math.PI / 2; rim.position.y = -0.999; S.scene.add(rim);
      return ({ t, C }) => {
        const r = Number(C.size ?? 0.6); const y = -1 + r + 0.35 + 0.3 * Math.sin(1.6 * t);
        ball.scale.setScalar(r); ball.position.y = y; mirror.scale.set(r, -r, r); mirror.position.y = 2 * -1 - y; ball.rotation.y = mirror.rotation.y = 0.5 * t;
        ballMat.color.set(C.color || '#818cf8'); const refl = Number(C.refl ?? 0.55); floor.material.opacity = 1 - refl * 0.85;
        return { y, ym: -2 - y, gap: y - r + 1, r, refl, Tp: C.speed ? (2 * Math.PI) / (1.6 * C.speed) : 0 };
      };
    },
  },
  knots: {
    spec: { color: { label: '颜色', value: '#f472b6' }, speed: spin, size: { label: '缩放', min: 0.5, max: 1.3, step: 0.05, value: 1 }, count: false, extras: [R('p', '绕轴圈数 p', 1, 5, 1, 2), R('q', '绕管圈数 q', 2, 7, 1, 3), { ...metal, value: 0.35 }, T('wire', '线框', false)], remountKeys: ['p', 'q'] },
    presets: { 紧: { q: 7 }, 松: { q: 2 }, 快: { speed: 2 }, 慢: { speed: 0.45 }, 金属: { metal: 0.95 }, 线框感: { wire: true } },
    radius: 1.35,
    doc: {
      title: '环面纽结 (p, q)',
      rows: (v) => [...spinRows(v), ['p（绕中轴）', String(v.p ?? 0)], ['q（绕管身）', String(v.q ?? 0)], ['gcd(p, q)', String(v.g ?? 1)], ['类型', v.g === 1 ? '单条纽结' : `${v.g} 条互扣的环（链环）`], ['三角形数', String(v.tris ?? 0)]],
      formula: () => F('r = cos(q·u) + 2') + F('x = r·cos(p·u)，y = r·sin(p·u)，z = −sin(q·u)，u∈[0, 2π]'),
      explain: '<p>想象一根线缠在甜甜圈表面：沿大圈方向绕 p 圈，同时沿管子绕 q 圈，就得到 <b>(p, q) 环面纽结</b>。(2,3) 是最有名的“三叶结”。</p><p>如果 p 和 q 的最大公约数大于 1，线会提前首尾相接，实际是几条互相扣在一起的环。</p>',
      params: [['颜色', '材质颜色'], ['自转速度', '旋转快慢'], ['缩放', '整体大小'], ['绕轴圈数 p', '绕中心轴的圈数（重建）'], ['绕管圈数 q', '绕管身的圈数（重建）'], ['金属度', '材质金属感'], ['线框', '只显示三角网格边']],
      example: (v) => `<ol><li>(p, q) = (${v.p}, ${v.q})</li><li>gcd = ${v.g} → ${v.g === 1 ? '一条连续曲线' : '会分成 ' + v.g + ' 条'}</li><li>试试 (2,3) 三叶结、(3,5)、(2,4)</li></ol>`,
      tip: '改 p、q 看结的形状；打开线框看网格。',
    },
    build(S, C0) {
      const p = Math.round(C0.p ?? 2), q = Math.round(C0.q ?? 3);
      const geo = new THREE.TorusKnotGeometry(0.75, 0.2, 220, 18, p, q);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.3 })); S.scene.add(m);
      return ({ t, C }) => {
        m.rotation.set(0.4, W * t, 0); m.scale.setScalar(Number(C.size || 1)); m.material.color.set(C.color || '#f472b6');
        m.material.metalness = Number(C.metal ?? 0.35); m.material.wireframe = !!C.wire;
        return { th: W * t, p, q, g: gcd(p, q), tris: triCount(geo) };
      };
    },
  },
  'orbit-moons': {
    spec: { color: { label: '行星颜色', value: '#818cf8' }, speed: { label: '公转速度', min: 0, max: 3, step: 0.1, value: 1 }, size: { label: '行星半径', min: 0.25, max: 0.7, step: 0.05, value: 0.45 }, count: { label: '卫星数', min: 1, max: 6, step: 1, value: 3, buttons: true }, extras: [R('dist', '最内轨道 r₁', 0.8, 1.6, 0.05, 1.0)], remountKeys: [] },
    presets: { 三星: { count: 3 }, 双星: { count: 2 }, 近: { dist: 0.85 }, 远: { dist: 1.5 }, 快: { speed: 2 }, 慢: { speed: 0.45 } },
    radius: 1.95, camDir: [0, 0.85, 1],
    doc: {
      title: '卫星轨道 · 开普勒第三定律',
      rows: (v) => [['卫星数', String(v.n ?? 0)], ['r₁ / T₁', `${fmt(v.r1 ?? 0)} / ${v.T1 ? fmt(v.T1, 1) + 's' : '∞'}`], ['最外 rₙ / Tₙ', `${fmt(v.rn ?? 0)} / ${v.Tn ? fmt(v.Tn, 1) + 's' : '∞'}`], ['T²/r³（应恒定）', v.k ? fmt(v.k, 2) : '—'], ['1 号卫星角 θ₁', deg(v.a1 ?? 0), 'a1'], ['行星半径', fmt(v.R ?? 0)]],
      formula: () => F('rᵢ = r₁ · (1 + 0.35·i)') + F('ωᵢ = ω₀ · rᵢ^(−3/2) ⇒ Tᵢ² / rᵢ³ = (2π/ω₀)²'),
      explain: '<p>多颗卫星绕同一颗行星转，离得越远转得越慢，而且慢得很有规律：<b>周期的平方与轨道半径的立方成正比</b>（开普勒第三定律），所以面板里 T²/r³ 对每颗卫星都一样。</p><p>每颗卫星的轨道稍微倾斜，用浅色圆圈画出轨道线，方便对比内外圈的速度差。</p>',
      params: [['行星颜色', '中心行星颜色'], ['公转速度', '时间倍率 ω₀'], ['行星半径', '中心球大小'], ['卫星数', '显示的卫星数量'], ['最内轨道 r₁', '最近一颗卫星的轨道半径，其余按比例向外']],
      example: (v) => `<ol><li>r₁ = ${fmt(v.r1 ?? 0)}，T₁ = ${v.T1 ? fmt(v.T1, 1) : '∞'} s</li><li>最外 r = ${fmt(v.rn ?? 0)}，T = ${v.Tn ? fmt(v.Tn, 1) : '∞'} s</li><li>T²/r³：${v.T1 ? fmt(v.T1 ** 2 / v.r1 ** 3, 2) : '—'} ≈ ${v.Tn ? fmt(v.Tn ** 2 / v.rn ** 3, 2) : '—'} ✓</li></ol>`,
      tip: '从正上方看各卫星“赛跑”；调最内轨道半径看周期如何变化。',
    },
    build(S) {
      const planetMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
      const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 40), planetMat); S.scene.add(planet);
      const moons = [], rings = []; let lastFit = '';
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 + 0.03 * (i % 3), 20, 20), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08 + i * 0.13, 0.6, 0.65) }));
        const pivot = new THREE.Group(); pivot.rotation.x = 0.12 * Math.sin(i * 1.7); pivot.add(m); S.scene.add(pivot); moons.push({ m, pivot, a0: i * 2.1 });
        const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, k) => new THREE.Vector3(Math.cos((k / 96) * Math.PI * 2), 0, Math.sin((k / 96) * Math.PI * 2)))), new THREE.LineBasicMaterial({ color: 0x334155 }));
        pivot.add(ring); rings.push(ring);
      }
      return ({ t, C }) => {
        const n = Math.max(1, Math.min(6, Math.round(C.count || 3))), r1 = Number(C.dist ?? 1), R0 = Number(C.size ?? 0.45);
        planet.scale.setScalar(R0); planetMat.color.set(C.color || '#818cf8'); planet.rotation.y = 0.3 * t;
        let a1 = 0;
        moons.forEach((o, i) => { const vis = i < n; o.pivot.visible = vis; const r = r1 * (1 + 0.35 * i); const a = o.a0 + 1.2 * t * r ** -1.5; if (i === 0) a1 = a; o.m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); rings[i].scale.setScalar(r); });
        const rn = r1 * (1 + 0.35 * (n - 1)); const fitKey = n + ':' + r1;
        if (fitKey !== lastFit) { lastFit = fitKey; S.setFitRadius(Math.max(1.2, rn + 0.25)); }
        const w0 = 1.2 * C.speed;
        const T1 = w0 ? (2 * Math.PI) / (w0 * r1 ** -1.5) : 0, Tn = w0 ? (2 * Math.PI) / (w0 * rn ** -1.5) : 0;
        return { n, r1, rn, T1, Tn, k: T1 ? T1 ** 2 / r1 ** 3 : 0, a1, R: R0 };
      };
    },
  },
};

export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'lattice').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'lattice';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-three',
    title: fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: F0.spec.remountKeys || [],
    liveKeys: ['color', 'speed', 'size', 'count'],
    presetDefaults: F0.presets,
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => mountFamily(fam, box, o),
  });
}

function mountFamily(fam, host, opts) {
  const F0 = FAM[fam];
  const S = createThreeStage(host, opts, { doc: F0.doc, spec: F0.spec, radius: F0.radius || 1.5, fill: F0.fill || 0.66, target: F0.target || [0, 0, 0], camDir: F0.camDir || [0, 0.38, 1] });
  addLights(S.scene, { amb: 0.5, key: 1.15, fill: 0.45 });
  const step = F0.build(S, S.get());
  S.onFrame(({ t, C }) => ({ w: W * C.speed, ...(step({ t, C }) || {}) }));
  return S.destroy;
}
