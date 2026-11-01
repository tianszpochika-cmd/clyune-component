import { createThreeStage, THREE, fmt, deg } from './kits/three-stage.js';
import { F } from './kits/info-panel.js';

export const PARAMS_SPEC = {
  color: { label: '身体颜色', value: '#818cf8' },
  speed: { label: '步频（时间倍率）', min: 0, max: 3, step: 0.1, value: 1 },
  size: { label: '摆臂幅度 A', min: 0.1, max: 1.2, step: 0.05, value: 0.5 },
  count: false,
  extras: [{ key: 'turn', type: 'toggle', label: '自动转身', value: true }],
};
const W0 = 4; // rad/s
const D = 180 / Math.PI;
const DOC = {
  title: '层级角色 · 摆臂动画',
  rows: (v) => [
    ['左臂角 θL', `${fmt((v.aL ?? 0) * D, 1)}°`, 'arm'],
    ['右臂角 θR', `${fmt((v.aR ?? 0) * D, 1)}°`, 'arm'],
    ['腿角 θ腿', `${fmt((v.leg ?? 0) * D, 1)}°`],
    ['幅度 A', `${fmt((v.A ?? 0) * D, 0)}°`],
    ['周期 T', v.w ? `${fmt((2 * Math.PI) / v.w, 2)} s` : '∞'],
    ['身体朝向', `${deg(v.yaw ?? 0)}${v.turn ? ' ↻' : ' (固定)'}`],
  ],
  formula: () => F('θL(t) = A · sin(ω·t)') + F('θR(t) = −A · sin(ω·t)（反相）') + F('子物体世界变换 = 父变换 × 自身变换'),
  explain: '<p>角色由胶囊身体、球形头部、两条手臂和两条腿组成，它们都挂在同一个 <b>Group（父物体）</b>下：父物体转身，所有部件一起转——这就是<b>层级模型</b>，和骨骼动画的原理一样。</p><p>每条手臂先放进一个位于<b>肩膀</b>的“关节”节点里，旋转关节时手臂绕肩膀摆动，而不是绕手臂中心乱转。左右手臂相差半个周期（反相），腿与同侧手臂也反相，看起来就像在走路。</p>',
  params: [['身体颜色', '胶囊身体颜色'], ['步频（时间倍率）', 'ω = 4 × 倍率 rad/s'], ['摆臂幅度 A', '最大摆角（弧度），手臂在 ±A 之间往返'], ['自动转身', '父 Group 是否持续绕 Y 轴旋转']],
  example: (v) => `<ol><li>A = ${fmt((v.A ?? 0) * D, 0)}°，ω = ${fmt(v.w ?? 0)} rad/s</li><li>此刻左臂 ${fmt((v.aL ?? 0) * D, 1)}°，右臂 ${fmt((v.aR ?? 0) * D, 1)}°，两者之和恒为 0</li><li>一个完整摆动周期 ${v.w ? fmt((2 * Math.PI) / v.w, 2) + ' 秒' : '—'}</li></ol>`,
  tip: '拖动环绕角色观察关节；关掉自动转身从侧面看摆臂。',
};

export async function mountGltfShapes(host, opts = {}) {
  const S = createThreeStage(host, opts, { doc: DOC, spec: PARAMS_SPEC, camDir: [0.55, 0.3, 0.8], target: [0, 1.25, 0], radius: 1.55, fill: 0.78 });
  S.scene.add(new THREE.HemisphereLight(0xb1c5ff, 0x1a2035, 0.9));
  const spot = new THREE.SpotLight(0xffffff, 60, 30, Math.PI / 5, 0.4); spot.position.set(4, 8, 2); S.scene.add(spot);
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.4, roughness: 0.35 });
  const limbMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, metalness: 0.3, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.9, 8, 16), bodyMat); body.position.y = 1.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 32), new THREE.MeshStandardMaterial({ color: 0xf0f4ff, roughness: 0.5 })); head.position.y = 2.32;
  const limb = (x, y, len) => {
    const joint = new THREE.Group(); joint.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, len, 0.2), limbMat); m.position.y = -len / 2;
    joint.add(m); group.add(joint); return joint;
  };
  const armL = limb(-0.72, 1.85, 0.85), armR = limb(0.72, 1.85, 0.85);
  const legL = limb(-0.22, 0.75, 0.75), legR = limb(0.22, 0.75, 0.75);
  group.add(body, head); S.scene.add(group);
  S.scene.add(new THREE.GridHelper(10, 20, 0x334166, 0x1b2744));
  let yaw = 0.5;
  S.onFrame(({ t, dt, C }) => {
    const A = Number(C.size ?? 0.5), ph = W0 * t;
    bodyMat.color.set(C.color || '#818cf8');
    if (C.turn !== false) yaw += 0.35 * dt;
    group.rotation.y = yaw;
    const aL = A * Math.sin(ph), aR = -aL, leg = -aL * 0.7;
    armL.rotation.x = aL; armR.rotation.x = aR; legL.rotation.x = leg; legR.rotation.x = -leg;
    body.position.y = 1.35 + Math.abs(Math.sin(ph)) * 0.04 * A;
    return { aL, aR, leg, A, w: W0 * C.speed, yaw, turn: C.turn !== false };
  });
  return S.destroy;
}
