import { createThreeStage, THREE, fmt } from './kits/three-stage.js';
import { F } from './kits/info-panel.js';

export const PARAMS_SPEC = {
  color: { label: '颜色 A', value: '#818cf8' },
  speed: { label: '时间流速', min: 0, max: 3, step: 0.1, value: 1 },
  size: { label: '位移强度 s', min: 0, max: 0.4, step: 0.01, value: 0.12 },
  count: { label: '波纹频率 f', min: 1, max: 14, step: 1, value: 6, buttons: true },
  extras: [{ key: 'colorB', type: 'color', label: '颜色 B', value: '#22d3ee' }],
  remountKeys: [],
};
const DOC = {
  title: 'ShaderMaterial 变形球',
  rows: (v) => [
    ['uTime', fmt(v.t ?? 0, 2), 't'],
    ['位移强度 s', fmt(v.s ?? 0)],
    ['波纹频率 f', String(v.f ?? 0)],
    ['赤道处位移 d(y=0)', fmt(v.d0 ?? 0, 3)],
    ['顶点数', String(v.verts ?? 0)],
    ['颜色混合 (y=0)', `${fmt((v.mix ?? 0) * 100, 0)}% B`],
  ],
  formula: () => F('p′ = p + n · s · sin(uTime + f · p.y)') + F('颜色 = mix(A, B, 0.5 + 0.5·sin(3·p.y + uTime))') + F('亮度 = 0.5 + 0.5 · (N · L)'),
  explain: '<p><b>着色器（Shader）</b>是直接跑在显卡上的小程序。<b>顶点着色器</b>决定每个顶点画在哪：这里把每个顶点沿法线 n 推出去一段距离 d，d 随高度 y 和时间变化，于是球面像水波一样鼓起、凹下。</p><p><b>片元着色器</b>决定每个像素的颜色：在颜色 A 和 B 之间按正弦来回混合，再乘上简单的光照系数。</p><p>uTime 是 JavaScript 每帧传给显卡的 <b>uniform</b> 变量，所有顶点共享。</p>',
  params: [['颜色 A / 颜色 B', '片元着色器混合的两种颜色'], ['时间流速', 'uTime 增长速度；0 = 冻结形变'], ['位移强度 s', '顶点沿法线推出的最大距离'], ['波纹频率 f', '沿高度方向有多少圈“波纹”']],
  example: (v) => `<ol><li>uTime = ${fmt(v.t ?? 0, 2)}</li><li>赤道 y=0：d = s·sin(uTime) = ${fmt(v.s ?? 0)}×${fmt(Math.sin(v.t ?? 0), 3)} = ${fmt(v.d0 ?? 0, 3)}</li><li>频率 f=${v.f ?? 0}：从南极到北极（y −1→1）大约有 ${fmt(((v.f ?? 0) * 2) / (2 * Math.PI), 1)} 个完整波</li></ol>`,
  tip: '拖动旋转、滚轮缩放；把位移强度调到 0 看回原始球体。',
};

export async function mountShaderBlob(host, opts = {}) {
  const S = createThreeStage(host, opts, { doc: DOC, spec: PARAMS_SPEC, camDir: [0, 0, 1], radius: 1.3, fill: 0.72 });
  const uniforms = {
    uTime: { value: 0 }, uAmp: { value: 0.12 }, uFreq: { value: 6 },
    uColorA: { value: new THREE.Color(0x818cf8) }, uColorB: { value: new THREE.Color(0x22d3ee) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vN; varying vec3 vP; uniform float uTime, uAmp, uFreq;
      void main(){ vN = normalize(normalMatrix * normal);
        vec3 p = position + normal * (uAmp * sin(uTime + position.y * uFreq)); vP = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying vec3 vN; varying vec3 vP; uniform float uTime; uniform vec3 uColorA, uColorB;
      void main(){ float f = 0.5 + 0.5 * dot(normalize(vN), normalize(vec3(0.2,0.8,0.4)));
        vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vP.y * 3.0 + uTime));
        gl_FragColor = vec4(col * f, 1.0); }`,
  });
  const geo = new THREE.IcosahedronGeometry(1, 5);
  const mesh = new THREE.Mesh(geo, mat); S.scene.add(mesh);
  S.onFrame(({ t, C }) => {
    uniforms.uTime.value = t;
    uniforms.uAmp.value = Number(C.size ?? 0.12);
    uniforms.uFreq.value = Number(C.count ?? 6);
    uniforms.uColorA.value.set(C.color || '#818cf8');
    uniforms.uColorB.value.set(C.colorB || '#22d3ee');
    mesh.rotation.y = t * 0.25;
    const s = uniforms.uAmp.value;
    return { t, s, f: uniforms.uFreq.value, d0: s * Math.sin(t), verts: geo.attributes.position.count, mix: 0.5 + 0.5 * Math.sin(t) };
  });
  return S.destroy;
}
