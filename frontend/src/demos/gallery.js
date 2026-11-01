import { createThreeStage, addLights, THREE, fmt, triCount } from './kits/three-stage.js';
import { F } from './kits/info-panel.js';

export const PARAMS_SPEC = {
  color: { label: '高亮颜色', value: '#fbbf24' },
  speed: { label: '自转速度', min: 0, max: 3, step: 0.1, value: 1 },
  size: { label: '几何体缩放', min: 0.5, max: 1.4, step: 0.05, value: 1 },
  count: false,
  extras: [{ key: 'wire', type: 'toggle', label: '线框模式', value: false }],
};
const SPECS = [
  ['立方体 Box', () => new THREE.BoxGeometry(1, 1, 1), 0x818cf8, 'BoxGeometry(宽, 高, 深)'],
  ['球体 Sphere', () => new THREE.SphereGeometry(0.7, 32, 32), 0x22d3ee, 'SphereGeometry(半径, 经度分段, 纬度分段)'],
  ['圆锥 Cone', () => new THREE.ConeGeometry(0.6, 1.2, 32), 0x34d399, 'ConeGeometry(底半径, 高, 分段)'],
  ['圆环 Torus', () => new THREE.TorusGeometry(0.55, 0.22, 16, 48), 0xf472b6, 'TorusGeometry(半径, 管粗, 管分段, 环分段)'],
  ['八面体 Octahedron', () => new THREE.OctahedronGeometry(0.7), 0xa78bfa, 'OctahedronGeometry(半径)'],
  ['二十面体 Icosahedron', () => new THREE.IcosahedronGeometry(0.7), 0x60a5fa, 'IcosahedronGeometry(半径, 细分)'],
];
const DOC = {
  title: '几何体画廊 · 射线拾取',
  rows: (v) => [
    ['选中', v.name || '（点一个几何体）', 'sel'],
    ['顶点数', v.verts != null ? String(v.verts) : '—'],
    ['三角形数', v.tris != null ? String(v.tris) : '—'],
    ['构造函数', v.ctor || '—', null, 'wide'],
    ['排布', v.layout || '—'],
    ['缩放 s', fmt(v.s ?? 1)],
  ],
  formula: () => F('射线 R(t) = 相机位置 + t · 方向') + F('鼠标像素 → NDC：x = 2·px/W − 1，y = 1 − 2·py/H'),
  explain: '<p>Three.js 内置了很多<b>几何体</b>，它们都由很多三角形拼成；分段越多越圆滑，但三角形也越多。</p><p>点击时，程序把鼠标位置换算成 −1~1 的“标准坐标”，从相机朝这个方向发出一条<b>射线 Raycaster</b>，第一个被射线穿过的物体就是你点中的那个，然后给它加上自发光高亮。</p>',
  params: [['高亮颜色', '被选中几何体的自发光颜色'], ['自转速度', '所有几何体的旋转快慢'], ['几何体缩放', '统一缩放倍数 s'], ['线框模式', '只画三角形的边，直观看到网格密度']],
  example: (v) => (v.name ? `<ol><li>选中 <b>${v.name}</b></li><li>${v.ctor}</li><li>共 ${v.tris} 个三角形、${v.verts} 个顶点 —— 打开“线框模式”数一数</li></ol>` : '<p>先在画布上点一个几何体。</p>'),
  tip: '点击/轻触几何体选中它；拖动旋转视角，打开线框模式看三角网格。',
};

export async function mountGallery(host, opts = {}) {
  const S = createThreeStage(host, opts, { doc: DOC, spec: PARAMS_SPEC, camDir: [0, 0.28, 1], radius: 5.2, fill: 0.9 });
  addLights(S.scene, { amb: 0.45, key: 1.1 });
  const meshes = SPECS.map(([name, make, color, ctor]) => {
    const g = make();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 }));
    mesh.userData = { name, ctor, verts: g.attributes.position.count, tris: triCount(g) };
    S.scene.add(mesh);
    return mesh;
  });
  const grid = new THREE.GridHelper(14, 28, 0x334166, 0x1b2744); grid.position.y = -0.9; S.scene.add(grid);
  let cols = 0, sel = 0;
  const layout = () => {
    const [w, h] = S.size; const asp = w / Math.max(1, h);
    const c = asp < 0.95 ? 2 : asp < 1.6 ? 3 : 6;
    if (c === cols) return;
    cols = c; const rows = Math.ceil(meshes.length / c);
    meshes.forEach((m, i) => { const cx = i % c, cy = Math.floor(i / c); m.position.set((cx - (c - 1) / 2) * 1.7, ((rows - 1) / 2 - cy) * 1.6, 0); });
    grid.position.y = -((rows - 1) / 2) * 1.6 - 0.9;
    S.setFitRadius(Math.max((c - 1) * 0.85 + 0.9, (rows - 1) * 0.8 + 0.9));
  };
  const rc = new THREE.Raycaster(); const p = new THREE.Vector2();
  let down = null;
  const onDown = (e) => { down = [e.clientX, e.clientY]; };
  const onUp = (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) { down = null; return; }
    down = null;
    const r = S.view.getBoundingClientRect();
    p.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    rc.setFromCamera(p, S.camera);
    const hit = rc.intersectObjects(meshes)[0];
    sel = hit ? meshes.indexOf(hit.object) : -1;
  };
  S.renderer.domElement.addEventListener('pointerdown', onDown);
  S.renderer.domElement.addEventListener('pointerup', onUp);
  S.disposers.push(() => { S.renderer.domElement.removeEventListener('pointerdown', onDown); S.renderer.domElement.removeEventListener('pointerup', onUp); });
  let rot = 0;
  S.onFrame(({ dt, C }) => {
    layout();
    rot += dt;
    const s = Number(C.size || 1);
    const hl = new THREE.Color(C.color || '#fbbf24');
    meshes.forEach((m, i) => {
      m.rotation.y = rot * (0.5 + i * 0.06); m.rotation.x = rot * 0.18;
      m.scale.setScalar(s * (i === sel ? 1.12 : 1));
      m.material.wireframe = !!C.wire;
      m.material.emissive.copy(i === sel ? hl : new THREE.Color(0));
      m.material.emissiveIntensity = i === sel ? 0.6 : 0;
    });
    const u = sel >= 0 ? meshes[sel].userData : {};
    return { name: u.name, verts: u.verts, tris: u.tris, ctor: u.ctor, s, layout: `${cols} 列`, ix: `sel${sel}` };
  });
  return S.destroy;
}
