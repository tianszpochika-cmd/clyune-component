import * as THREE from 'three';
import { readLiveControls, colorToRgb } from './kits/_shared.js';

export async function mountParticles(host, opts = {}) {
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, host.parentElement], ctrl);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 6;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  host.appendChild(renderer.domElement);

  const L0 = live();
  const COUNT = Math.max(500, Math.min(12000, Math.round((L0.count || 40) * 100)));
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    velocities[i * 3] = (Math.random() - 0.5) * 0.01;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.035, color: 0x22d3ee, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  const mouse = { x: 0, y: 0 };
  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  host.addEventListener('pointermove', onMove);

  let alive = true;
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight || 420;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const tick = () => {
    if (!alive) return;
    const L = live();
    const spd = L.speed;
    const [cr, cg, cb] = colorToRgb(L.color);
    mat.color.setRGB(cr, cg, cb);
    mat.size = 0.035 * L.size;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      pos[ix] += (velocities[ix] + mouse.x * 0.002) * spd;
      pos[ix + 1] += (velocities[ix + 1] + mouse.y * 0.002) * spd;
      pos[ix + 2] += velocities[ix + 2] * spd;
      if (Math.abs(pos[ix]) > 5) velocities[ix] *= -1;
      if (Math.abs(pos[ix + 1]) > 3) velocities[ix + 1] *= -1;
      if (Math.abs(pos[ix + 2]) > 4) velocities[ix + 2] *= -1;
    }
    geo.attributes.position.needsUpdate = true;
    points.rotation.y += 0.0015;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();

  return () => {
    alive = false;
    host.removeEventListener('pointermove', onMove);
    ro.disconnect();
    geo.dispose(); mat.dispose(); renderer.dispose();
    host.innerHTML = '';
  };
}
