/**
 * createThreeStage — shared Three.js lab scaffold for the threejs category.
 *  - splits the host into canvas + MathInfoPanel (live readout + 公式/说明/参数/步骤)
 *  - one rAF loop with a speed-scaled simulation clock (dt clamped → no teleports after tab switch)
 *  - OrbitControls drag/zoom, camera auto-framing so the subject fills the stage at any aspect
 *  - live knob values read straight from the panel state (no remount for live keys)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createInfoPanel, alignDocParams, fmt } from './info-panel.js';
import { readLiveControls } from './_shared.js';
import { maxDpr, tuneOrbitControls } from '../../lib/mobile.js';

export { THREE, fmt };
const DEG = 180 / Math.PI;
export const deg = (r) => `${fmt(((r * DEG) % 360 + 360) % 360, 0)}°`;

export function createThreeStage(host, opts = {}, {
  doc, spec = {}, fov = 50, camDir = [0, 0.35, 1], target = [0, 0, 0],
  radius = 1.5, fill = 0.62, bg = 0x060a14, orbit = true, zoom = true,
} = {}) {
  const ctrl = opts._controls || {};
  const info = createInfoPanel(host, { doc: alignDocParams(doc, spec) });
  const view = info.canvasBox;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(bg, 1);
  renderer.setPixelRatio(maxDpr(2));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 200);
  const tgt = new THREE.Vector3(...target);
  const dir0 = new THREE.Vector3(...camDir).normalize();
  camera.position.copy(tgt).addScaledVector(dir0, 6);
  camera.lookAt(tgt);

  let controls = null;
  if (orbit) {
    controls = new OrbitControls(camera, renderer.domElement);
    tuneOrbitControls(controls);
    controls.enablePan = false;
    controls.enableZoom = zoom;
    controls.target.copy(tgt);
  }

  // live knob state: panel state (all keys incl. extras) with CSS-var fallback
  const stageEl = host.parentElement;
  const get = () => {
    let s = null;
    try { s = stageEl?.__getControls?.(); } catch (_) { s = null; }
    const L = readLiveControls([host, stageEl], ctrl);
    return { ...ctrl, ...(s || {}), color: (s && s.color) || L.color, speed: Number(s?.speed ?? L.speed ?? 1), size: Number(s?.size ?? L.size ?? 1), count: Number(s?.count ?? L.count ?? 40) };
  };

  // framing: keep a sphere of `radius` filling `fill` of the shorter view axis
  let W = 0, H = 0, fitR = radius;
  const frame = () => {
    if (!W || !H) return;
    const vf = (camera.fov * Math.PI) / 360;
    const hf = Math.atan(Math.tan(vf) * camera.aspect);
    const half = Math.min(vf, hf);
    const dist = fitR / Math.sin(half) / fill;
    const d = new THREE.Vector3().subVectors(camera.position, controls ? controls.target : tgt);
    if (d.lengthSq() < 1e-6) d.copy(dir0);
    d.setLength(dist);
    camera.position.copy(controls ? controls.target : tgt).add(d);
    if (controls) { controls.minDistance = dist * 0.45; controls.maxDistance = dist * 2.4; }
    camera.lookAt(controls ? controls.target : tgt);
  };
  const resize = () => {
    const r = view.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
    if (w === W && h === H) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frame();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(view);
  resize();

  const frames = [];
  let raf = 0, alive = true, last = -1, sim = 0, wall = 0, slowN = 0, dprScale = 1;
  const api = {
    THREE, scene, camera, renderer, controls, view, info, get,
    get size() { return [W, H]; },
    setFitRadius(r) { fitR = r; frame(); },
    onFrame(fn) { frames.push(fn); },
    disposers: [],
  };
  const warm = [];
  const tick = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (!W || !H) resize();
    const dtw = last < 0 ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    // adaptive resolution: weak GPUs / software GL drop render scale instead of stuttering
    // Decide once during a short warm-up (first ~24 frames) and jump straight to the target scale, so the
    // canvas doesn't visibly step down several times while the user is watching; afterwards only a long,
    // sustained slowdown triggers one more step.
    if (dtw > 0) {
      if (warm.length < 24) {
        warm.push(dtw);
        if (warm.length === 24) {
          const med = [...warm].sort((a, b) => a - b)[12];
          const target = med > 0.034 ? Math.max(0.5, Math.min(1, 0.03 / med)) : 1;
          if (target < 0.95) { dprScale = target; renderer.setPixelRatio(maxDpr(2) * dprScale); renderer.setSize(W, H, false); }
        }
      } else {
        slowN = dtw > 0.045 ? slowN + 1 : Math.max(0, slowN - 1);
        if (slowN > 180 && dprScale > 0.55) { dprScale = Math.max(0.5, dprScale * 0.75); slowN = 0; renderer.setPixelRatio(maxDpr(2) * dprScale); renderer.setSize(W, H, false); }
      }
    }
    const C = get();
    const spd = Number.isFinite(C.speed) ? C.speed : 1;
    sim += dtw * spd; wall += dtw;
    if (controls) controls.update();
    let v = {}; let ix = '';
    for (const fn of frames) {
      const r = fn({ dt: dtw * spd, dtw, t: sim, wall, C });
      if (r) { if (r.ix != null) { ix += r.ix; delete r.ix; } Object.assign(v, r); }
    }
    renderer.render(scene, camera);
    const off = new THREE.Vector3().subVectors(camera.position, controls ? controls.target : tgt);
    const sph = new THREE.Spherical().setFromVector3(off);
    v.camAz = sph.theta; v.camPol = sph.phi; v.camDist = sph.radius;
    info.update(v, {
      ix: `${sph.theta.toFixed(2)},${sph.phi.toFixed(2)},${sph.radius.toFixed(1)}|${ix}`,
      handle: `${Math.round(W / 2)},${Math.round(H / 2)}`,
      ctl: [['视角 方位/俯仰', `${fmt(sph.theta * DEG, 0)}° / ${fmt(sph.phi * DEG, 0)}°`]],
    });
  };
  raf = requestAnimationFrame(tick);

  api.destroy = () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    api.disposers.forEach((f) => { try { f(); } catch (_) { /* ignore */ } });
    controls?.dispose();
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => { if (!seen.has(m)) { seen.add(m); m.dispose(); } });
    });
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (_) { /* ignore */ }
    info.destroy();
    host.innerHTML = '';
  };
  return api;
}

/** Standard light rig. */
export function addLights(scene, { amb = 0.5, key = 1.2, fill = 0.5 } = {}) {
  const a = new THREE.AmbientLight(0xffffff, amb);
  const k = new THREE.DirectionalLight(0xffffff, key); k.position.set(3, 5, 2);
  const f = new THREE.PointLight(0x818cf8, fill * 4, 30); f.position.set(-3, 1.5, 3);
  scene.add(a, k, f);
  return { amb: a, key: k, fill: f };
}
export const triCount = (g) => (g.index ? g.index.count / 3 : g.attributes.position.count / 3);
