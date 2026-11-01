import { createThreeStage, THREE, fmt, deg } from './kits/three-stage.js';
import { F } from './kits/info-panel.js';

export const PARAMS_SPEC = {
  color: { label: '圆环颜色', value: '#818cf8' },
  speed: { label: '圆环转速', min: 0, max: 3, step: 0.1, value: 1 },
  size: { label: '主光强度', min: 0.2, max: 3, step: 0.1, value: 1.4 },
  count: false,
  extras: [
    { key: 'fillI', type: 'range', label: '补光强度', min: 0, max: 3, step: 0.1, value: 1.2 },
    { key: 'metal', type: 'range', label: '球体金属度', min: 0, max: 1, step: 0.05, value: 0.85 },
  ],
};
const DOC = {
  title: '轨道控制 + 多光源',
  rows: (v) => [
    ['相机距离 r', fmt(v.camDist ?? 0, 2)],
    ['圆环角 φ', deg(v.ring ?? 0), 'ring'],
    ['圆环角速度', `${fmt(v.w ?? 0)} rad/s`],
    ['主光 I₁', fmt(v.key ?? 0, 1)],
    ['补光 I₂', fmt(v.fill ?? 0, 1)],
    ['金属度 m', fmt(v.metal ?? 0, 2)],
    ['球顶亮度≈', fmt(v.lum ?? 0, 2)],
  ],
  formula: () => F('亮度 ≈ Σ Iᵢ · max(0, N·Lᵢ) + 环境光') + F('相机位置 = 目标 + r·(sinφ·sinθ, cosφ, sinφ·cosθ)'),
  explain: '<p><b>OrbitControls</b> 让相机像卫星一样绕着目标点转：拖动改变方位角/俯仰角，滚轮改变距离 r（用球坐标描述）。</p><p>场景里有三盏灯：半球光（天空/地面两色）、<b>主光</b>（方向光，产生阴影）和<b>补光</b>（青色点光源）。物体某点的亮度大致是“每盏灯强度 × 灯光方向与表面法线夹角的余弦”之和。</p><p><b>金属度</b>越高，球越像镜面，主要反射环境与高光；越低越像塑料，漫反射更多。</p>',
  params: [['圆环颜色', '紫色圆环的材质颜色'], ['圆环转速', '圆环绕自身轴的角速度倍率'], ['主光强度', '方向光强度 I₁，影响阴影与明暗对比'], ['补光强度', '点光源强度 I₂，照亮暗部'], ['球体金属度', '0 = 塑料，1 = 金属镜面']],
  example: (v) => `<ol><li>主光 ${fmt(v.key ?? 0, 1)} + 补光 ${fmt(v.fill ?? 0, 1)}</li><li>球顶法线朝上，主光与法线夹角余弦 ≈ 0.83 → 主光贡献 ≈ ${fmt((v.key ?? 0) * 0.83, 2)}</li><li>把主光调到 0.2，看看阴影几乎消失</li></ol>`,
  tip: '拖动环绕观察，滚轮/双指缩放；调主光与补光对比明暗。',
};

export async function mountOrbit(host, opts = {}) {
  const S = createThreeStage(host, opts, { doc: DOC, spec: PARAMS_SPEC, camDir: [0.62, 0.42, 0.78], target: [0, 0.9, 0], radius: 2.2, fill: 0.7 });
  const { scene, renderer } = S;
  scene.fog = new THREE.Fog(0x060a14, 10, 26);
  renderer.shadowMap.enabled = true;
  const hemi = new THREE.HemisphereLight(0x9bb7ff, 0x223344, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(5, 8, 3); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const fill = new THREE.PointLight(0x22d3ee, 1.2, 20, 1); fill.position.set(-3, 2, 2);
  scene.add(hemi, key, fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x151d33, metalness: 0.2, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), new THREE.MeshStandardMaterial({ color: 0xf0f4ff, metalness: 0.85, roughness: 0.2 }));
  ball.position.y = 1; ball.castShadow = true; scene.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 16, 100), new THREE.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x312e81, metalness: 0.4, roughness: 0.3 }));
  ring.rotation.x = Math.PI / 2.4; ring.position.y = 1; ring.castShadow = true; scene.add(ring);
  let phi = 0;
  S.onFrame(({ dt, C }) => {
    phi += 0.5 * dt;
    ring.rotation.z = phi;
    ring.material.color.set(C.color || '#818cf8');
    key.intensity = Number(C.size ?? 1.4);
    fill.intensity = Number(C.fillI ?? 1.2) * 4;
    ball.material.metalness = Number(C.metal ?? 0.85);
    const lum = key.intensity * 0.83 + 0.6 + (1 - ball.material.metalness) * 0.2;
    return { ring: phi, w: 0.5 * C.speed, key: key.intensity, fill: Number(C.fillI ?? 1.2), metal: ball.material.metalness, lum };
  });
  return S.destroy;
}
