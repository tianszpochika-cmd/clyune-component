import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { readLiveControls, colorToRgb } from './kits/_shared.js';
import { maxDpr, preferLiteFx, tuneOrbitControls } from '../lib/mobile.js';
import { createInfoPanel } from './kits/info-panel.js';
import { MATH_DOCS } from './kits/math-docs.js';

const TAU = Math.PI * 2;
const COLORS = { sin: 0x22d3ee, cos: 0xf472b6, tan: 0xfbbf24 };

const CSS = `
.tg-ui{position:absolute;left:8px;top:8px;display:flex;flex-direction:column;gap:6px;z-index:3;pointer-events:none;font:12px/1.25 system-ui,-apple-system,sans-serif;max-width:calc(100% - 16px)}
.tg-row{display:flex;flex-wrap:wrap;gap:3px;align-items:center;pointer-events:auto;background:rgba(8,12,24,.66);border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:3px;backdrop-filter:blur(6px);width:max-content;max-width:100%}
.tg-row button{appearance:none;border:0;background:transparent;cursor:pointer;padding:4px 9px;border-radius:6px;color:#cbd5e1;font:inherit;min-height:30px}
.tg-row button:hover{background:rgba(148,163,184,.16)}
.tg-row button.on[data-fn=sin]{background:rgba(34,211,238,.28);color:#fff}
.tg-row button.on[data-fn=cos]{background:rgba(244,114,182,.28);color:#fff}
.tg-row button.on[data-fn=tan]{background:rgba(251,191,36,.28);color:#fff}
.tg-row button.on[data-act]{background:rgba(129,140,248,.35);color:#fff}
.tg-row label{display:flex;align-items:center;gap:6px;color:#94a3b8;padding:0 6px}
.tg-row input[type=range]{width:110px;accent-color:#818cf8}
.tg-read{display:none!important;pointer-events:none;background:rgba(8,12,24,.66);border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:6px 9px;color:#e2e8f0;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;width:max-content}
.tg-read b{font-weight:600}
.tg-read .s{color:#22d3ee}.tg-read .c{color:#f472b6}.tg-read .t{color:#fbbf24}
.tg-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
.tg-lab{position:absolute;left:0;top:0;font:11px system-ui,sans-serif;color:#94a3b8;text-shadow:0 1px 2px #000;white-space:nowrap;will-change:transform}
@media (max-width:860px){
  .tg-ui{left:6px;top:6px;right:6px;gap:4px}
  .tg-row{width:100%;padding:2px;gap:2px}
  .tg-row button{min-height:36px;min-width:40px;padding:4px 10px;font-size:13px;flex:1 1 auto}
  .tg-row label{flex:1 1 100%;padding:2px 6px}
  .tg-row input[type=range]{flex:1;width:auto;min-width:0;min-height:26px}
  .tg-read{font-size:11px;padding:4px 8px}
}
`;

function line(points, color, opacity = 1, extra = {}) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, ...extra });
  return new THREE.Line(g, m);
}
function dashed(color, opacity = 0.7) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
  const m = new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity });
  const l = new THREE.Line(g, m);
  l.computeLineDistances();
  return l;
}
function setSeg(l, a, b) {
  const p = l.geometry.attributes.position;
  p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z);
  p.needsUpdate = true;
  l.geometry.computeBoundingSphere();
  if (l.material.isLineDashedMaterial) l.computeLineDistances();
}

export async function mountTrigWaves(host, opts = {}) {
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, host.parentElement], ctrl);
  const styleName = String(ctrl.styleName || '');
  const lite = preferLiteFx();
  const show = {
    sin: !/仅\s*cos/.test(styleName),
    cos: !/仅\s*sin/.test(styleName),
    tan: /tan/i.test(styleName),
  };
  let phase = /相位/.test(styleName) ? Math.PI / 2 : 0;
  const speedMult = /快速/.test(styleName) ? 2.2 : /慢速/.test(styleName) ? 0.4 : 1;
  let freq;
  {
    // DemoControls "频率 f" is count 1..8 → frequency in [0.25, 2]
    let c = Number(ctrl.count ?? live().count ?? 4);
    freq = Math.max(0.25, Math.min(4, (Number.isFinite(c) ? c : 4) / 4));
  }
  let paused = false;

  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  let hl = null;
  const info = createInfoPanel(host, { doc: MATH_DOCS['trig-waves'], onHover: (k) => { hl = k; } });
  const view = info.canvasBox;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setClearColor(0x060a14, 1);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  view.appendChild(renderer.domElement);
  const style = document.createElement('style');
  style.textContent = CSS;
  view.appendChild(style);
  const labelsEl = document.createElement('div');
  labelsEl.className = 'tg-labels';
  view.appendChild(labelsEl);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  tuneOrbitControls(controls, { mobile: lite });
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.minZoom = 0.45;
  controls.maxZoom = 3.5;

  /* layout: circle centered at (CX,0); waves start at X0 and run to X1 */
  const R = 1.6;
  const CX = -4.2;
  const X0 = -1.8;
  const X1 = 9.4;
  const MID = (CX - R + X1) / 2;
  controls.target.set(MID, 0, 0);

  const world = new THREE.Group();
  scene.add(world);

  /* grid + axes */
  const gridMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.9 });
  const gpts = [];
  for (let y = -3; y <= 3; y++) { gpts.push(new THREE.Vector3(X0, y * 0.8, -0.01), new THREE.Vector3(X1, y * 0.8, -0.01)); }
  for (let i = 0; i <= 8; i++) {
    const x = X0 + ((X1 - X0) * i) / 8;
    gpts.push(new THREE.Vector3(x, -2.4, -0.01), new THREE.Vector3(x, 2.4, -0.01));
  }
  world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gpts), gridMat));
  const axisMat = 0x475569;
  world.add(line([new THREE.Vector3(CX - R - 0.5, 0, 0), new THREE.Vector3(X1 + 0.2, 0, 0)], axisMat));
  world.add(line([new THREE.Vector3(CX, -R - 0.5, 0), new THREE.Vector3(CX, R + 0.5, 0)], axisMat));
  world.add(line([new THREE.Vector3(X0, -2.5, 0), new THREE.Vector3(X0, 2.5, 0)], axisMat));

  /* unit circle */
  const circPts = [];
  for (let i = 0; i <= 128; i++) { const a = (i / 128) * TAU; circPts.push(new THREE.Vector3(CX + Math.cos(a) * R, Math.sin(a) * R, 0)); }
  const circle = line(circPts, 0x818cf8, 0.85);
  world.add(circle);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.06, depthWrite: false }));
  disk.position.set(CX, 0, -0.02);
  world.add(disk);

  /* angle arc (θ) */
  const ARC_N = 64;
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ARC_N + 1) * 3), 3));
  const arc = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.8 }));
  world.add(arc);
  const sector = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  world.add(sector);

  /* radius, projections, markers */
  const radius = line([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], 0xffffff);
  world.add(radius);
  const sinBar = line([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], COLORS.sin);
  const cosBar = line([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], COLORS.cos);
  sinBar.material.linewidth = 2; cosBar.material.linewidth = 2;
  world.add(sinBar, cosBar);
  const sinLink = dashed(COLORS.sin, 0.65);
  const cosLink = dashed(COLORS.cos, 0.65);
  const tanLine = line([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], COLORS.tan, 0.9);
  const tanLink = dashed(COLORS.tan, 0.6);
  world.add(sinLink, cosLink, tanLine, tanLink);
  const tanTangent = line([new THREE.Vector3(CX + R, -2.6, 0), new THREE.Vector3(CX + R, 2.6, 0)], COLORS.tan, 0.25);
  world.add(tanTangent);

  const sphereGeo = new THREE.SphereGeometry(0.075, lite ? 12 : 20, lite ? 8 : 14);
  const mk = (c) => { const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: c })); world.add(m); return m; };
  const pDot = mk(0xffffff);
  const sinHead = mk(COLORS.sin);
  const cosHead = mk(COLORS.cos);
  const tanHead = mk(COLORS.tan);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = (parent, c) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(0.5); parent.add(s); return s;
  };
  glow(pDot, 0xffffff); glow(sinHead, COLORS.sin); glow(cosHead, COLORS.cos); glow(tanHead, COLORS.tan);

  /* waves: index 0 = newest (at X0), flows right */
  const N = lite ? 240 : 420;
  const makeWave = (color) => {
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 4);
    const c = new THREE.Color(color);
    for (let i = 0; i < N; i++) { col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = 1; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    l.frustumCulled = false;
    world.add(l);
    // a soft "ribbon" fill under the curve for depth
    const fpos = new Float32Array(N * 2 * 3);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2, b = a + 1, c2 = a + 2, d = a + 3; idx.push(a, b, c2, b, d, c2); }
    fg.setIndex(idx);
    const fill = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    fill.frustumCulled = false;
    world.add(fill);
    return { line: l, pos, col, geo: g, fill, fpos, fg, z: 0 };
  };
  const waves = { sin: makeWave(COLORS.sin), cos: makeWave(COLORS.cos), tan: makeWave(COLORS.tan) };
  waves.sin.z = 0; waves.cos.z = -0.35; waves.tan.z = 0.35;

  /* DOM labels on axes */
  const labs = [];
  const addLab = (txt, v, color) => {
    const el = document.createElement('span'); el.className = 'tg-lab'; el.textContent = txt;
    if (color) el.style.color = color; labelsEl.appendChild(el); labs.push({ el, v }); return el;
  };
  addLab('1', new THREE.Vector3(X0 - 0.25, 0.8 * 2, 0));
  addLab('−1', new THREE.Vector3(X0 - 0.35, -0.8 * 2, 0));
  addLab('0', new THREE.Vector3(X0 - 0.25, 0, 0));
  const tickLabs = ['π/2', 'π', '3π/2', '2π'];
  const thetaLab = addLab('θ', new THREE.Vector3(), '#e2e8f0');
  const xTickEls = tickLabs.map((t) => addLab(t, new THREE.Vector3()));

  /* overlay UI */
  const ui = document.createElement('div');
  ui.className = 'tg-ui';
  ui.innerHTML = `
    <div class="tg-row" data-row="fn">
      <button type="button" data-fn="sin">sin</button>
      <button type="button" data-fn="cos">cos</button>
      <button type="button" data-fn="tan">tan</button>
      <button type="button" data-act="pause">暂停</button>
      <button type="button" data-act="view">正视</button>
    </div>
    <div class="tg-row" data-row="phase">
      <label>相位 φ <input type="range" min="0" max="360" step="1" data-phase aria-label="相位"><em data-pv style="font-style:normal;color:#e2e8f0;min-width:36px">0°</em></label>
    </div>
    <div class="tg-read" data-read></div>`;
  view.appendChild(ui);
  const readEl = ui.querySelector('[data-read]');
  const phaseInput = ui.querySelector('[data-phase]');
  const phaseVal = ui.querySelector('[data-pv]');
  phaseInput.value = String(Math.round((phase * 180) / Math.PI));
  phaseVal.textContent = `${phaseInput.value}°`;

  const sync = () => {
    ui.querySelectorAll('[data-fn]').forEach((b) => b.classList.toggle('on', !!show[b.dataset.fn]));
    ui.querySelector('[data-act="pause"]').classList.toggle('on', paused);
    ui.querySelector('[data-act="pause"]').textContent = paused ? '继续' : '暂停';
    host.dataset.fns = Object.keys(show).filter((k) => show[k]).join(',');
    host.dataset.paused = paused ? '1' : '0';
  };
  let viewAnim = null;
  const frontDir = new THREE.Vector3(0, 0, 1);
  const tiltDir = new THREE.Vector3(-0.35, 0.32, 0.88).normalize();
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.fn) show[b.dataset.fn] = !show[b.dataset.fn];
    else if (b.dataset.act === 'pause') paused = !paused;
    else if (b.dataset.act === 'view') {
      const cur = camera.position.clone().sub(controls.target).normalize();
      viewAnim = cur.angleTo(frontDir) < 0.05 ? tiltDir.clone() : frontDir.clone();
      b.textContent = viewAnim === frontDir || viewAnim.equals(frontDir) ? '立体' : '正视';
    }
    sync();
  });
  ['pointerdown', 'wheel', 'touchstart'].forEach((ev) => ui.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
  phaseInput.addEventListener('input', () => {
    phase = (Number(phaseInput.value) * Math.PI) / 180;
    phaseVal.textContent = `${phaseInput.value}°`;
  });
  controls.addEventListener('start', () => { viewAnim = null; });
  sync();

  /* orthographic fit: always keep unit circle + full wave strip in frame */
  let fitDist = 18;
  const resize = () => {
    const w = view.clientWidth || host.clientWidth || 640;
    const h = view.clientHeight || host.clientHeight || 420;
    const aspect = w / Math.max(1, h);
    renderer.setPixelRatio(maxDpr(2));
    renderer.setSize(w, h, false);
    const spanW = (X1 - (CX - R)) + 1.6;
    const spanH = 6.4;
    const pad = aspect < 1 ? 1.22 : 1.12;
    let halfH = (spanH / 2) * pad;
    let halfW = (spanW / 2) * pad;
    if (halfW / halfH < aspect) halfW = halfH * aspect;
    else halfH = halfW / aspect;
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    controls.target.set(MID, aspect < 1 ? 0.55 : 0.15, 0);
    const off = camera.position.clone().sub(controls.target);
    if (off.lengthSq() < 1e-6) camera.position.copy(controls.target).addScaledVector(tiltDir, fitDist);
    else camera.position.copy(controls.target).addScaledVector(off.normalize(), fitDist);
  };
  camera.position.copy(controls.target).addScaledVector(tiltDir, fitDist);
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(view);

  /* drag the point on the unit circle (capture phase on the view so OrbitControls doesn't rotate) */
  let theta = 0.6;
  let dragTh = null; // last θ set by dragging (debug signature)
  let dragging = false;
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitLocal = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const q = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, q)) return null;
    return q.divideScalar(world.scale.x || 1);
  };
  const setThetaFrom = (q) => {
    let a = Math.atan2(q.y, q.x - CX);
    if (a < 0) a += TAU;
    theta = Math.floor(theta / TAU) * TAU + a;
    dragTh = a;
  };
  const onDragDown = (e) => {
    if (e.target !== renderer.domElement) return;
    const q = hitLocal(e);
    if (!q) return;
    const dr = Math.hypot(q.x - CX, q.y);
    const th0 = theta % TAU;
    const dp = Math.hypot(q.x - (CX + Math.cos(th0) * R), q.y - Math.sin(th0) * R);
    if (dp < 0.9 || Math.abs(dr - R) < 0.55) {
      dragging = true; controls.enabled = false;
      setThetaFrom(q);
      renderer.domElement.setPointerCapture?.(e.pointerId);
      e.stopPropagation(); e.preventDefault();
    }
  };
  const onDragMove = (e) => { if (!dragging) return; const q = hitLocal(e); if (q) setThetaFrom(q); e.stopPropagation(); };
  const onDragUp = () => { if (dragging) { dragging = false; controls.enabled = true; } };
  view.addEventListener('pointerdown', onDragDown, true);
  view.addEventListener('pointermove', onDragMove, true);
  view.addEventListener('pointerup', onDragUp, true);
  view.addEventListener('pointercancel', onDragUp, true);

  /* loop */
  let alive = true;
  let last = performance.now();
  const P = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const prj = new THREE.Vector3();
  const C = new THREE.Vector3(CX, 0, 0);
  const XS = (X1 - X0) / TAU; // x units per radian of history (one period across)
  const TAN_LIM = 2.4;

  const place = (el, v, dx = 0, dy = 0) => {
    prj.copy(v).project(camera);
    if (prj.z > 1) { el.style.display = 'none'; return; }
    el.style.display = '';
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    el.style.transform = `translate(${((prj.x * 0.5 + 0.5) * w + dx).toFixed(1)}px, ${((-prj.y * 0.5 + 0.5) * h + dy).toFixed(1)}px)`;
  };

  const tick = (now) => {
    if (!alive) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const L = live();
    const spd = (L.speed > 0 ? L.speed : 1) * speedMult;
    const szLive = L.size > 0 ? L.size : 1;
    const A = szLive * 0.8 * 2; // amplitude in scene units (1 → 1.6)
    disk.material.opacity = Math.min(0.4, 0.04 + 0.14 * szLive);
    sector.material.opacity = Math.min(0.5, 0.1 + 0.14 * szLive);
    // uniform world scale so size slider is unmistakable in screenshots / audits
    const uni = Math.max(0.45, Math.min(1.85, 0.55 + 0.45 * szLive));
    world.scale.setScalar(uni);
    if (!paused && !dragging) theta = (theta + dt * 0.9 * spd) % (TAU * 1000);
    const [cr, cg, cb] = colorToRgb(L.color);
    circle.material.color.setRGB(cr, cg, cb);
    disk.material.color.setRGB(cr, cg, cb);
    sector.material.color.setRGB(cr, cg, cb);
    // accent waves / heads with live color so DemoControls color is obvious
    if (waves?.sin?.line?.material) {
      waves.sin.line.material.color.setRGB(cr, Math.min(1, cg * 0.6 + 0.4), Math.min(1, cb * 0.85 + 0.15));
      waves.cos.line.material.color.setRGB(Math.min(1, cr * 0.55 + 0.45), cg * 0.45, Math.min(1, cb * 0.7 + 0.3));
      waves.tan.line.material.color.setRGB(Math.min(1, cr * 0.7 + 0.3), Math.min(1, cg * 0.7 + 0.3), cb * 0.35);
      waves.sin.fill.material.color.setRGB(cr, cg, cb);
      waves.cos.fill.material.color.setRGB(cr, cg, cb);
      waves.tan.fill.material.color.setRGB(cr, cg, cb);
    }
    if (sinHead?.material) sinHead.material.color.setRGB(cr, cg, cb);
    if (cosHead?.material) cosHead.material.color.setRGB(cr, Math.min(1, cg + 0.2), cb);
    if (tanHead?.material) tanHead.material.color.setRGB(Math.min(1, cr + 0.2), Math.min(1, cg + 0.15), cb * 0.5);
    if (pDot?.material) pDot.material.color.setRGB(cr, cg, cb);

    const th = theta % TAU;
    const s = Math.sin(th), c = Math.cos(th), tn = Math.tan(th);
    P.set(CX + c * R, s * R, 0);
    pDot.position.copy(P);
    setSeg(radius, C, P);
    setSeg(sinBar, tmp.set(P.x, 0, 0), P);
    setSeg(cosBar, C, tmp.set(P.x, 0, 0));
    sinBar.visible = show.sin; cosBar.visible = show.cos;

    // arc & sector
    const ap = arcGeo.attributes.position;
    const ar = R * 0.32;
    const sv = [];
    for (let i = 0; i <= ARC_N; i++) {
      const a = (th * i) / ARC_N;
      ap.setXYZ(i, CX + Math.cos(a) * ar, Math.sin(a) * ar, 0.001);
      sv.push(CX, 0, 0, CX + Math.cos(a) * R, Math.sin(a) * R, 0);
    }
    ap.needsUpdate = true;
    arcGeo.computeBoundingSphere();
    const sp = new Float32Array(sv);
    const sIdx = [];
    for (let i = 0; i < ARC_N; i++) sIdx.push(i * 2, i * 2 + 1, i * 2 + 3);
    sector.geometry.dispose();
    sector.geometry = new THREE.BufferGeometry();
    sector.geometry.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sector.geometry.setIndex(sIdx);

    // waves: point i is angle (theta - i*dθ), located at x = X0 + i*dx
    const dTh = TAU / (N - 1) / Math.max(0.25, freq);
    for (const key of ['sin', 'cos', 'tan']) {
      const wv = waves[key];
      const on = show[key];
      wv.line.visible = on; wv.fill.visible = on;
      if (!on) continue;
      for (let i = 0; i < N; i++) {
        const a = theta - i * dTh;
        const x = X0 + (i / (N - 1)) * (X1 - X0);
        let y;
        let alpha = Math.pow(1 - i / N, 0.6);
        if (key === 'sin') y = A * Math.sin(freq * a + phase) / freq ** 0;
        else if (key === 'cos') y = A * Math.cos(freq * a + phase);
        else {
          const tv = Math.tan(freq * a + phase);
          y = Math.max(-TAN_LIM, Math.min(TAN_LIM, tv * A * 0.5));
          if (Math.abs(tv * A * 0.5) > TAN_LIM) alpha = 0;
        }
        wv.pos[i * 3] = x; wv.pos[i * 3 + 1] = y; wv.pos[i * 3 + 2] = wv.z;
        wv.col[i * 4 + 3] = alpha;
        wv.fpos[i * 6] = x; wv.fpos[i * 6 + 1] = key === 'tan' ? y : 0; wv.fpos[i * 6 + 2] = wv.z;
        wv.fpos[i * 6 + 3] = x; wv.fpos[i * 6 + 4] = key === 'tan' ? y : y; wv.fpos[i * 6 + 5] = wv.z;
      }
      wv.geo.attributes.position.needsUpdate = true;
      wv.geo.attributes.color.needsUpdate = true;
      wv.fg.attributes.position.needsUpdate = true;
    }
    const ys = A * Math.sin(freq * theta + phase);
    const yc = A * Math.cos(freq * theta + phase);
    const tvNow = Math.tan(freq * theta + phase);
    const yt = Math.max(-TAN_LIM, Math.min(TAN_LIM, tvNow * A * 0.5));
    sinHead.position.set(X0, ys, waves.sin.z); sinHead.visible = show.sin;
    cosHead.position.set(X0, yc, waves.cos.z); cosHead.visible = show.cos;
    tanHead.position.set(X0, yt, waves.tan.z); tanHead.visible = show.tan && Math.abs(tvNow * A * 0.5) <= TAN_LIM;
    // links from circle to wave heads (exact when freq=1, φ=0)
    setSeg(sinLink, P, sinHead.position); sinLink.visible = show.sin;
    setSeg(cosLink, tmp.set(CX, -R - 0.25, 0), new THREE.Vector3(P.x, -R - 0.25, 0)); cosLink.visible = show.cos;
    // tan: extend radius to tangent line x = CX+R
    const tanY = Math.max(-2.6, Math.min(2.6, tn * R));
    const T = new THREE.Vector3(CX + R, tanY, 0);
    setSeg(tanLine, C, T); tanLine.visible = show.tan && Math.abs(c) > 1e-3 && c > 0;
    setSeg(tanLink, T, tanHead.position); tanLink.visible = show.tan && tanHead.visible && c > 0;
    tanTangent.visible = show.tan;

    // labels
    const deg = (th * 180) / Math.PI;
    readEl.innerHTML = `θ = <b>${deg.toFixed(1)}°</b> (${th.toFixed(3)} rad)` +
      (freq !== 1 || phase !== 0 ? `<br>f = ${freq.toFixed(2)} · φ = ${Math.round((phase * 180) / Math.PI)}°` : '') +
      (show.sin ? `<br><span class="s">sin</span> = ${Math.sin(freq * theta + phase).toFixed(3)}` : '') +
      (show.cos ? `<br><span class="c">cos</span> = ${Math.cos(freq * theta + phase).toFixed(3)}` : '') +
      (show.tan ? `<br><span class="t">tan</span> = ${Math.abs(tvNow) > 99 ? '∞' : tvNow.toFixed(3)}` : '');
    // shared info panel
    const hlScale = (o, k) => { if (o) o.scale.setScalar(hl === k ? 1.8 + 0.3 * Math.sin(now / 90) : 1); };
    hlScale(pDot, 'P'); hlScale(sinHead, 'sin'); hlScale(cosHead, 'cos'); hlScale(tanHead, 'tan');
    prj.copy(P).multiplyScalar(world.scale.x).project(camera);
    const cw = renderer.domElement.clientWidth, chh = renderer.domElement.clientHeight;
    info.update({ th, theta, freq, phase, A: szLive, s: Math.sin(freq * theta + phase), c: Math.cos(freq * theta + phase), t: tvNow, show: { ...show }, paused, dragging }, {
      ix: JSON.stringify({ dragTh: dragTh == null ? undefined : Math.round(dragTh * 1000) / 1000, phase: Math.round(phase * 1000) / 1000, fns: Object.keys(show).filter((k) => show[k]).join(',') }),
      handle: `${Math.round((prj.x * 0.5 + 0.5) * cw)},${Math.round((-prj.y * 0.5 + 0.5) * chh)}`,
      dbg: `size=${szLive.toFixed(2)} speed=${spd.toFixed(2)} freq=${freq.toFixed(2)} preset=${styleName || '-'}`,
    });
    labs[0].v.set(X0 - 0.3, A, 0);
    labs[1].v.set(X0 - 0.4, -A, 0);
    for (const l of labs) if (l.el !== thetaLab && !xTickEls.includes(l.el)) place(l.el, l.v, 0, -7);
    place(thetaLab, tmp.set(CX + Math.cos(th / 2) * R * 0.48, Math.sin(th / 2) * R * 0.48, 0), -4, -7);
    xTickEls.forEach((el, i) => place(el, tmp.set(X0 + ((i + 1) / 4) * (X1 - X0) / Math.max(0.25, freq) * (freq >= 1 ? 1 : freq), -0.05, 0), -8, 4));
    xTickEls.forEach((el, i) => { if (((i + 1) / 4) / Math.max(0.25, freq) > 1.0001) el.style.display = 'none'; });

    if (viewAnim) {
      const off = camera.position.clone().sub(controls.target);
      const cur = off.lengthSq() < 1e-6 ? tiltDir.clone() : off.normalize();
      cur.lerp(viewAnim, 1 - Math.exp(-dt * 5)).normalize();
      camera.position.copy(controls.target).addScaledVector(cur, fitDist);
      if (cur.angleTo(viewAnim) < 0.002) viewAnim = null;
    }
    controls.update();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(tick);

  return () => {
    alive = false;
    ro.disconnect();
    view.removeEventListener('pointerdown', onDragDown, true);
    view.removeEventListener('pointermove', onDragMove, true);
    view.removeEventListener('pointerup', onDragUp, true);
    view.removeEventListener('pointercancel', onDragUp, true);
    info.destroy();
    controls.dispose();
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      if (o.material && !seen.has(o.material)) { seen.add(o.material); o.material.map?.dispose?.(); o.material.dispose(); }
    });
    glowTex.dispose();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (_) { /* ignore */ }
    host.innerHTML = '';
  };
}
