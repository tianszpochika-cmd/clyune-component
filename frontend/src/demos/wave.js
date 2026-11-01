import { createThreeStage, THREE, fmt } from './kits/three-stage.js';
import { F } from './kits/info-panel.js';

export const PARAMS_SPEC = {
  color: { label: '地形颜色', value: '#22d3ee' },
  speed: { label: '波速（时间倍率）', min: 0, max: 3, step: 0.1, value: 1 },
  size: { label: '振幅 A', min: 0.05, max: 0.8, step: 0.05, value: 0.35 },
  count: { label: '网格细分 N', min: 12, max: 100, step: 4, value: 60, buttons: true },
  extras: [
    { key: 'k', type: 'range', label: '波数 k', min: 0.4, max: 2.5, step: 0.1, value: 1.2 },
    { key: 'wire', type: 'toggle', label: '线框', value: false },
  ],
  remountKeys: ['count'],
};
const W0 = 1.8; // rad/s at speed 1
const DOC = {
  title: '波浪地形 · 顶点动画',
  rows: (v) => [
    ['中心高度 y(0,0)', fmt(v.y0 ?? 0, 3), 'y0'],
    ['振幅 A', fmt(v.A ?? 0)],
    ['波数 k', fmt(v.k ?? 0, 1)],
    ['波长 λ = 2π/k', fmt(v.lam ?? 0)],
    ['角频率 ω', `${fmt(v.w ?? 0)} rad/s`],
    ['周期 T = 2π/ω', v.w ? `${fmt((2 * Math.PI) / v.w, 1)} s` : '∞'],
    ['顶点数 (N+1)²', String(v.verts ?? 0)],
  ],
  formula: () => F('y(x, z, t) = A·sin(k·x + ω·t) + A·cos(0.9k·z + 0.8ω·t)') + F('λ = 2π / k，T = 2π / ω'),
  explain: '<p>一张平面被切成 N×N 个小格子，每个格点（顶点）的高度 y 每帧按正弦公式重新计算，于是整张网格像海面一样起伏，这叫<b>顶点动画</b>。</p><p>两组波分别沿 x 和 z 方向传播并叠加，所以波峰会交错出“菱形”图案。<b>振幅 A</b> 决定浪多高，<b>波数 k</b> 决定浪有多密（波长 λ 越短），<b>ω</b> 决定浪走多快。</p><p>更新完高度后要重新计算法线（computeVertexNormals），光照才会跟着起伏变化。</p>',
  params: [['地形颜色', '材质颜色'], ['波速（时间倍率）', 'ω = 1.8 × 倍率；0 = 冻结画面'], ['振幅 A', '浪的高度，最高点约 2A'], ['网格细分 N', '每边格子数；越大越平滑但更耗性能（会重建网格）'], ['波数 k', '空间频率，k 大 → 波长短、浪更密'], ['线框', '显示网格线，看清顶点在上下移动']],
  example: (v) => `<ol><li>k = ${fmt(v.k ?? 0, 1)} → λ = 2π/k ≈ ${fmt(v.lam ?? 0)}（平面宽 10，可容纳约 ${fmt(10 / (v.lam || 1), 1)} 个波）</li><li>中心点此刻 y = ${fmt(v.y0 ?? 0, 3)}，范围在 ±${fmt(2 * (v.A ?? 0))} 之间</li><li>每帧要计算 ${v.verts ?? 0} 个顶点</li></ol>`,
  tip: '拖动旋转视角；把波速调 0 冻结，再拖振幅/波数观察形状。',
};

export async function mountWave(host, opts = {}) {
  const S = createThreeStage(host, opts, { doc: DOC, spec: PARAMS_SPEC, camDir: [0, 0.55, 0.85], radius: 5.6, fill: 0.92 });
  S.scene.add(new THREE.AmbientLight(0x8899ff, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 1); dir.position.set(3, 8, 4); S.scene.add(dir);
  const SEG = Math.max(12, Math.min(100, Math.round(S.get().count || 60)));
  const geo = new THREE.PlaneGeometry(10, 10, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.2, roughness: 0.35, flatShading: true });
  S.scene.add(new THREE.Mesh(geo, mat));
  const base = Float32Array.from(geo.attributes.position.array);
  S.onFrame(({ t, C }) => {
    const A = Number(C.size ?? 0.35), k = Number(C.k ?? 1.2), ph = W0 * t;
    mat.color.set(C.color || '#22d3ee'); mat.wireframe = !!C.wire;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] = A * Math.sin(k * base[i] + ph) + A * Math.cos(0.9 * k * base[i + 2] + 0.8 * ph);
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    return { A, k, lam: (2 * Math.PI) / k, w: W0 * C.speed, y0: A * Math.sin(ph) + A * Math.cos(0.8 * ph), verts: (SEG + 1) ** 2 };
  });
  return S.destroy;
}
