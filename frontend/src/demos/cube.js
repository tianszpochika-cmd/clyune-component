import { createThreeStage, addLights, THREE, fmt, deg } from './kits/three-stage.js';
import { F } from './kits/info-panel.js';

export const PARAMS_SPEC = {
  color: { label: '方块颜色', value: '#818cf8' },
  speed: { label: '自转速度', min: 0, max: 3, step: 0.1, value: 1 },
  size: { label: '边长 a', min: 0.5, max: 1.8, step: 0.1, value: 1.2 },
  count: false,
  extras: [{ key: 'edges', type: 'toggle', label: '显示棱线', value: true }],
};
const DOC = {
  title: '旋转方块 · 欧拉角',
  rows: (v) => [
    ['绕 X 轴角 θx', deg(v.rx ?? 0), 'rx'],
    ['绕 Y 轴角 θy', deg(v.ry ?? 0), 'ry'],
    ['角速度 ωx / ωy', `${fmt(v.wx ?? 0)} / ${fmt(v.wy ?? 0)} rad/s`],
    ['边长 a', fmt(v.a ?? 1.2)],
    ['体积 a³', fmt((v.a ?? 1.2) ** 3, 3)],
    ['表面积 6a²', fmt(6 * (v.a ?? 1.2) ** 2)],
    ['顶点 / 棱 / 面', '8 / 12 / 6'],
  ],
  formula: () => F('θ(t) = θ₀ + ω · t') + F('ωx = 0.6·k, ωy = 0.9·k（k = 自转速度）') + F('V = a³，S = 6a²'),
  explain: '<p>一个最基础的 Three.js 场景：<b>场景 Scene</b> 放物体，<b>相机 Camera</b> 决定从哪看，<b>渲染器 Renderer</b> 每帧把画面画到画布上。</p><p>方块每帧绕 X、Y 轴各转一点点，角度随时间<b>匀速增加</b>，这就是“欧拉角旋转”。灯光让每个面明暗不同，你才看得出它是立体的。</p>',
  params: [['方块颜色', '材质 MeshStandardMaterial 的基础色'], ['自转速度', '角速度倍率 k；0 = 停住，方便观察某一面'], ['边长 a', '缩放方块，体积按 a³ 增长'], ['显示棱线', 'EdgesGeometry 画出 12 条棱，看清结构']],
  example: (v) => `<ol><li>当前 k = ${fmt(v.k ?? 1)}，ωy = 0.9×k = ${fmt(v.wy ?? 0)} rad/s</li><li>转一圈需要 2π/ωy ≈ ${v.wy ? fmt((2 * Math.PI) / v.wy, 1) + ' 秒' : '∞（已停）'}</li><li>边长 ${fmt(v.a ?? 1.2)} → 体积 ${fmt((v.a ?? 1.2) ** 3, 3)}</li></ol>`,
  tip: '拖动画布旋转视角，滚轮/双指缩放；把自转速度调到 0 静态观察。',
};

export async function mountCube(host, opts = {}) {
  const S = createThreeStage(host, opts, { doc: DOC, spec: PARAMS_SPEC, camDir: [0.6, 0.45, 0.8], radius: 1.35, fill: 0.6 });
  addLights(S.scene, { amb: 0.45 });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.35, roughness: 0.35 }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0x22d3ee }));
  cube.add(edges);
  S.scene.add(cube);
  const grid = new THREE.GridHelper(8, 16, 0x334166, 0x1b2744); grid.position.y = -1.1; S.scene.add(grid);
  let rx = 0, ry = 0;
  S.onFrame(({ dt, C }) => {
    const k = C.speed; const a = C.size || 1.2;
    rx += 0.6 * dt; ry += 0.9 * dt;
    cube.rotation.set(rx, ry, 0);
    cube.scale.setScalar(a);
    cube.material.color.set(C.color || '#818cf8');
    edges.visible = C.edges !== false;
    return { rx, ry, wx: 0.6 * k, wy: 0.9 * k, k, a };
  });
  return S.destroy;
}
