import { createThreeStage, THREE, fmt } from './kits/three-stage.js';
import { F } from './kits/info-panel.js';

export const PARAMS_SPEC = {
  color: { label: '粒子颜色', value: '#22d3ee' },
  speed: { label: '漂移速度', min: 0, max: 3, step: 0.1, value: 1 },
  size: { label: '粒子大小', min: 0.4, max: 3, step: 0.1, value: 1 },
  count: { label: '粒子数（×100）', min: 5, max: 120, step: 5, value: 40, buttons: true },
  extras: [{ key: 'pull', type: 'range', label: '鼠标引力', min: 0, max: 2, step: 0.1, value: 1 }],
  remountKeys: ['count'],
};
const BX = 5, BY = 3, BZ = 4;
const DOC = {
  title: 'Points 粒子场',
  rows: (v) => [
    ['粒子数 N', String(v.n ?? 0)],
    ['平均速率 |v|', `${fmt(v.vAvg ?? 0, 3)} /s`],
    ['鼠标偏置 (x, y)', `${fmt(v.mx ?? 0)}, ${fmt(v.my ?? 0)}`],
    ['鼠标引力 g', fmt(v.g ?? 0)],
    ['累计反弹', String(v.bounce ?? 0)],
    ['盒子边界', `±${BX} × ±${BY} × ±${BZ}`],
  ],
  formula: () => F('p(t+Δt) = p(t) + (v + g·m)·k·Δt') + F('碰到边界：p = ±边界，v → −v（弹性反弹）'),
  explain: '<p>屏幕上的每个亮点都是一个<b>粒子</b>，它们共用一个 BufferGeometry，坐标存在一个大数组里，GPU 一次就能画完成千上万个点（THREE.Points）。</p><p>每帧给每个粒子加上“速度 × 时间”，碰到看不见的盒子边界就把速度反向，所以粒子永远不会飞出画面。鼠标位置 m 会给所有粒子加一个同方向的小偏置 g，看起来像被“吹”过去。</p><p>粒子用<b>加法混合</b>，重叠的地方会更亮。</p>',
  params: [['粒子颜色', 'PointsMaterial 颜色'], ['漂移速度', '整体时间倍率 k'], ['粒子大小', '每个点的屏幕尺寸'], ['粒子数（×100）', '粒子总数 N，改动后重建几何体'], ['鼠标引力', '鼠标偏置强度 g，0 = 不受鼠标影响']],
  example: (v) => `<ol><li>N = ${v.n ?? 0} 个粒子，每帧更新 ${3 * (v.n ?? 0)} 个坐标分量</li><li>平均速率 ${fmt(v.vAvg ?? 0, 3)}，×漂移速度后才是屏幕上看到的快慢</li><li>反弹已发生 ${v.bounce ?? 0} 次</li></ol>`,
  tip: '在画布上移动鼠标/手指，粒子会朝那个方向漂；拖动可旋转视角。',
};

export async function mountParticles(host, opts = {}) {
  const S = createThreeStage(host, opts, { doc: DOC, spec: PARAMS_SPEC, camDir: [0, 0.1, 1], radius: 4.2, fill: 0.85 });
  const C0 = S.get();
  const N = Math.max(500, Math.min(12000, Math.round((C0.count || 40) * 100)));
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * BX * 2; pos[i * 3 + 1] = (Math.random() - 0.5) * BY * 2; pos[i * 3 + 2] = (Math.random() - 0.5) * BZ * 2;
    for (let k = 0; k < 3; k++) vel[i * 3 + k] = (Math.random() - 0.5) * 0.6;
  }
  let vAvg = 0; for (let i = 0; i < N; i++) vAvg += Math.hypot(vel[i * 3], vel[i * 3 + 1], vel[i * 3 + 2]); vAvg /= N;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 0.05, color: 0x22d3ee, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat); S.scene.add(pts);
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BX * 2, BY * 2, BZ * 2)), new THREE.LineBasicMaterial({ color: 0x1e293b }));
  S.scene.add(box);
  const m = { x: 0, y: 0 };
  const onMove = (e) => { const r = S.view.getBoundingClientRect(); m.x = ((e.clientX - r.left) / r.width) * 2 - 1; m.y = -(((e.clientY - r.top) / r.height) * 2 - 1); };
  const onLeave = () => { m.x = 0; m.y = 0; };
  S.view.addEventListener('pointermove', onMove); S.view.addEventListener('pointerleave', onLeave);
  S.disposers.push(() => { S.view.removeEventListener('pointermove', onMove); S.view.removeEventListener('pointerleave', onLeave); });
  let bounce = 0;
  const lim = [BX, BY, BZ];
  S.onFrame(({ dt, C }) => {
    mat.color.set(C.color || '#22d3ee');
    mat.size = 0.05 * (C.size || 1);
    const g = Number(C.pull ?? 1) * 0.25;
    const bias = [m.x * g, m.y * g, 0];
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        pos[j] += (vel[j] + bias[k]) * dt;
        if (pos[j] > lim[k]) { pos[j] = lim[k]; vel[j] = -Math.abs(vel[j]); bounce++; }
        else if (pos[j] < -lim[k]) { pos[j] = -lim[k]; vel[j] = Math.abs(vel[j]); bounce++; }
      }
    }
    geo.attributes.position.needsUpdate = true;
    return { n: N, vAvg, g, mx: m.x * g, my: m.y * g, bounce };
  });
  return S.destroy;
}
