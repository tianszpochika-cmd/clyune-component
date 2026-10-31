import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { readLiveControls, colorToRgb } from './kits/_shared.js';

/** Approximate solar-system planets (relative sizes / distances, not to scale). */
const PLANETS = [
  { name: 'Mercury', color: 0xa8a29e, r: 0.11, dist: 1.55, speed: 4.15 },
  { name: 'Venus', color: 0xeab308, r: 0.17, dist: 2.15, speed: 3.25 },
  { name: 'Earth', color: 0x3b82f6, r: 0.19, dist: 2.85, speed: 2.7, moon: true },
  { name: 'Mars', color: 0xef4444, r: 0.14, dist: 3.55, speed: 2.2 },
  { name: 'Jupiter', color: 0xd97706, r: 0.42, dist: 4.85, speed: 1.15 },
  { name: 'Saturn', color: 0xfbbf24, r: 0.36, dist: 6.05, speed: 0.85, ring: true },
  { name: 'Uranus', color: 0x67e8f9, r: 0.26, dist: 7.2, speed: 0.62 },
  { name: 'Neptune', color: 0x6366f1, r: 0.25, dist: 8.35, speed: 0.48 },
];

function makeOrbitRing(radius, color = 0x94a3b8) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const pts = curve.getPoints(128);
  const geo = new THREE.BufferGeometry().setFromPoints(
    pts.map((p) => new THREE.Vector3(p.x, 0, p.y)),
  );
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const line = new THREE.LineLoop(geo, mat);
  line.userData.isOrbit = true;
  return line;
}

function makeStarfield(count = 900) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 40 + Math.random() * 80;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.08,
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

export async function mountSolarSystem(host, opts = {}) {
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, host.parentElement], ctrl);
  const styleName = String(ctrl.styleName || opts.variant || '');
  const hideTrails = /隐藏|无轨|无线/.test(styleName);
  const innerOnly = /内太阳系|岩石/.test(styleName);
  const gasOnly = /气态|外行星/.test(styleName);
  const speedMult = /快进|快速|快/.test(styleName) && !/慢/.test(styleName) ? 2.4
    : /慢速|慢/.test(styleName) ? 0.4
    : 1;

  const L0 = live();
  let planetCount = Math.round(Number(ctrl.count ?? L0.count ?? 8));
  if (planetCount > 8) planetCount = Math.round(planetCount / 5);
  planetCount = Math.max(1, Math.min(8, planetCount || 8));
  if (innerOnly) planetCount = Math.min(planetCount, 4);
  if (gasOnly) planetCount = Math.max(planetCount, 5);

  let list = PLANETS.slice(0, planetCount);
  if (gasOnly) list = PLANETS.slice(4, 4 + Math.min(4, planetCount));
  if (innerOnly) list = PLANETS.slice(0, Math.min(4, planetCount));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030712);
  scene.fog = new THREE.FogExp2(0x030712, 0.012);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 7.5, 14);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x030712, 1);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 4;
  controls.maxDistance = 40;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x1e293b, 0.55));
  const sunLight = new THREE.PointLight(0xfff1c1, 2.4, 40, 1.4);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);
  const rim = new THREE.DirectionalLight(0x93c5fd, 0.35);
  rim.position.set(4, 8, 2);
  scene.add(rim);

  const stars = makeStarfield(1000);
  scene.add(stars);

  // Sun
  const sunGroup = new THREE.Group();
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.35,
    metalness: 0.1,
    roughness: 0.45,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 48), sunMat);
  sunGroup.add(sun);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  sunGroup.add(glow);
  scene.add(sunGroup);

  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);
  const bodies = [];

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!hideTrails) {
      const ring = makeOrbitRing(p.dist, 0x64748b);
      orbitGroup.add(ring);
    }

    const pivot = new THREE.Object3D();
    pivot.rotation.y = (i / list.length) * Math.PI * 2 + Math.random() * 0.4;
    orbitGroup.add(pivot);

    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      metalness: 0.25,
      roughness: 0.55,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.r, 32, 32), mat);
    mesh.position.set(p.dist, 0, 0);
    pivot.add(mesh);

    if (p.ring) {
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(p.r * 1.35, p.r * 2.15, 64),
        new THREE.MeshBasicMaterial({
          color: 0xfde68a,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
      );
      ringMesh.rotation.x = Math.PI / 2.6;
      mesh.add(ringMesh);
    }

    if (p.moon) {
      const moonPivot = new THREE.Object3D();
      mesh.add(moonPivot);
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 }),
      );
      moon.position.set(0.38, 0.05, 0);
      moonPivot.add(moon);
      bodies.push({ pivot: moonPivot, speed: 6.5, spin: moon });
    }

    bodies.push({ pivot, speed: p.speed, spin: mesh });
  }

  let alive = true;
  const resize = () => {
    const w = host.clientWidth || host.parentElement?.clientWidth || 640;
    const h = host.clientHeight || host.parentElement?.clientHeight || 420;
    camera.aspect = w / Math.max(1, h);
    camera.userData.baseFov ??= camera.fov;
    camera.fov =
      camera.aspect < 1
        ? Math.min(
            85,
            (2 * Math.atan(Math.tan((camera.userData.baseFov * Math.PI) / 360) / camera.aspect) * 180) /
              Math.PI,
          )
        : camera.userData.baseFov;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, 2));
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  if (host.parentElement) ro.observe(host.parentElement);

  let last = performance.now();
  const tick = (now) => {
    if (!alive) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const L = live();
    const spd = L.speed > 0 ? L.speed : 1;
    const sz = L.size > 0 ? L.size : 1;
    orbitGroup.scale.setScalar(sz);
    sunGroup.scale.setScalar(sz);

    const [cr, cg, cb] = colorToRgb(L.color);
    sunMat.color.setRGB(Math.min(1, cr * 1.2), Math.min(1, cg * 1.05), Math.min(1, cb * 0.6));
    sunMat.emissive.setRGB(cr, cg * 0.7, cb * 0.2);

    for (const b of bodies) {
      b.pivot.rotation.y += b.speed * 0.35 * dt * spd * speedMult;
      if (b.spin) b.spin.rotation.y += 0.6 * dt * spd * speedMult;
    }
    sun.rotation.y += 0.15 * dt * spd * speedMult;
    stars.rotation.y += 0.01 * dt;
    controls.update();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(tick);

  return () => {
    alive = false;
    ro.disconnect();
    controls.dispose();
    scene.traverse((obj) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
      else obj.material?.dispose?.();
    });
    renderer.dispose();
    host.innerHTML = '';
  };
}
