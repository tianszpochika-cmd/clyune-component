import * as THREE from 'three';
import { bar, defaultParams, readLiveControls, colorToRgb } from './_shared.js';
import { withControls } from './withControls.js';

const FAMILIES = [
  'lattice', 'torus', 'nebula', 'polycubes', 'helix', 'glass', 'wire',
  'instanced', 'terrain-3', 'ringcloud', 'pillar', 'mirror-floor', 'knots', 'orbit-moons',
];

const PRESET_DEFAULTS = {
  细线: { size: 1 },
  密线: { size: 1.1 },
  粗线: { size: 1.2 },
  快: { speed: 2 },
  慢: { speed: 0.45 },
  快转: { speed: 2 },
  慢转: { speed: 0.45 },
  亮: { color: '#c4b5fd' },
  暗: { color: '#4338ca' },
  高: { size: 1.4 },
  大: { size: 1.5 },
  小: { size: 0.7 },
  疏: { count: 8 },
  密: { count: 80 },
  少: { count: 12 },
  多: { count: 90 },
};

export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'lattice').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'lattice';
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-three',
    title: fam,
    fallbackVariant: fam,
    params: defaultParams({ color: true, speed: true, size: true, count: true }),
    remountKeys: ['count'],
    presetDefaults: PRESET_DEFAULTS,
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy,
  });
}

function styleIndex(id, family) {
  const parts = String(id).split('-');
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last) && parts.slice(0, -1).join('-') === family) {
    return Math.max(0, parseInt(last, 10) - 1);
  }
  return 0;
}

function resolveFamily(id) {
  const partsId = String(id).split('-');
  const last = partsId[partsId.length - 1];
  let family = /^\d+$/.test(last) ? partsId.slice(0, -1).join('-') : String(id);
  if (!FAMILIES.includes(family)) {
    for (let i = partsId.length - 1; i >= 1; i--) {
      const cand = partsId.slice(0, i).join('-');
      if (FAMILIES.includes(cand)) { family = cand; break; }
    }
  }
  if (!FAMILIES.includes(family)) {
    const num = parseInt(String(id).split('-').pop(), 10) || 1;
    family = FAMILIES[(num - 1) % FAMILIES.length];
  }
  return family;
}

function buildMesh(THREE, family, style, hueBase, countHint) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL((hueBase % 360) / 360, 0.7, 0.55),
    metalness: 0.35,
    roughness: 0.35,
  });
  const kind = FAMILIES.indexOf(family);
  const s = style % 6;

  if (kind === 0) {
    const g = new THREE.Group();
    const dens = s === 1 ? 4 : s === 0 ? 2 : 3;
    const step = dens === 2 ? 1.1 : dens === 4 ? 0.55 : 0.75;
    const half = (dens - 1) / 2;
    for (let x = 0; x < dens; x++) {
      for (let y = 0; y < dens; y++) {
        for (let z = 0; z < dens; z++) {
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat.clone());
          c.material.color = new THREE.Color().setHSL(((hueBase + x * 20 + y * 15) % 360) / 360, 0.7, 0.55);
          c.material.metalness = s === 4 ? 0.85 : s === 5 ? 0.05 : 0.35;
          c.material.roughness = s === 4 ? 0.15 : s === 5 ? 0.9 : 0.35;
          c.position.set((x - half) * step, (y - half) * step, (z - half) * step);
          g.add(c);
        }
      }
    }
    return g;
  }
  if (kind === 1) {
    const tube = s === 0 ? 0.18 : s === 1 ? 0.45 : 0.32;
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, tube, 32, 64), mat);
    if (s === 5) m.material = new THREE.MeshPhysicalMaterial({ color: mat.color, transmission: 0.55, thickness: 0.6, roughness: 0.2, metalness: 0 });
    if (s === 4) { m.material.metalness = 0.9; m.material.roughness = 0.15; }
    return m;
  }
  if (kind === 2) {
    const seg = s === 0 ? 48 : s === 1 ? 16 : 32;
    const size = s === 2 ? 0.06 : s === 3 ? 0.02 : 0.035;
    return new THREE.Points(
      new THREE.SphereGeometry(1, seg, seg),
      new THREE.PointsMaterial({ color: mat.color, size, sizeAttenuation: true }),
    );
  }
  if (kind === 3) {
    const g = new THREE.Group();
    const n = s === 0 ? 5 : s === 1 ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat.clone());
      m.material.metalness = s === 4 ? 0.9 : s === 5 ? 0.05 : 0.35;
      m.position.set(Math.cos(i) * 1.4, Math.sin(i * 0.7) * 0.4, Math.sin(i) * 1.4);
      g.add(m);
    }
    return g;
  }
  if (kind === 4) {
    const turns = s === 0 ? 0.55 : s === 1 ? 0.28 : 0.4;
    const rad = s === 2 ? 0.05 : s === 3 ? 0.14 : 0.08;
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 40 }, (_, i) => new THREE.Vector3(
        Math.cos(i * turns) * 1.2, i * 0.05 - 1, Math.sin(i * turns) * 1.2,
      )),
    );
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 120, rad, 8, false), mat);
  }
  if (kind === 5) {
    const trans = s === 0 ? 0.85 : s === 1 ? 0.25 : 0.55;
    return new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 48),
      new THREE.MeshPhysicalMaterial({ color: mat.color, transmission: trans, thickness: 0.8, roughness: 0.2, metalness: 0 }),
    );
  }
  if (kind === 6) {
    const detail = s === 1 ? 2 : s === 0 ? 0 : 1;
    return new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, detail),
      new THREE.MeshBasicMaterial({ color: mat.color, wireframe: true }),
    );
  }
  if (kind === 7) {
    const N = Math.max(20, Math.min(200, countHint || (s === 0 ? 40 : s === 1 ? 140 : 80)));
    const spread = s === 2 ? 5.5 : s === 3 ? 2.2 : 4;
    const ig = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat, N);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      m4.setPosition((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
      ig.setMatrixAt(i, m4);
    }
    return ig;
  }
  if (kind === 8) {
    const seg = s === 2 ? 64 : s === 3 ? 24 : 48;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5, seg, seg), mat);
    mesh.rotation.x = -Math.PI / 2.5;
    mesh.userData.amp = s === 0 ? 0.35 : s === 1 ? 0.08 : 0.2;
    return mesh;
  }
  if (kind === 9) {
    const N = s === 0 ? 1400 : s === 1 ? 400 : 800;
    const thick = s === 2 ? 0.7 : s === 3 ? 0.15 : 0.4;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * 1.2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * thick;
      pos[i * 3 + 2] = Math.sin(a) * 1.2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: mat.color, size: 0.04 }));
  }
  if (kind === 10) {
    const top = s === 0 ? 0.1 : s === 1 ? 0.45 : 0.15;
    const bot = s === 0 ? 0.22 : s === 1 ? 0.55 : 0.35;
    const h = s === 2 ? 3.2 : s === 3 ? 1.4 : 2.4;
    return new THREE.Mesh(new THREE.CylinderGeometry(top, bot, h, 24), mat);
  }
  if (kind === 12) {
    const p = s === 0 ? 64 : s === 1 ? 180 : 128;
    const q = s === 0 ? 0.18 : s === 1 ? 0.28 : 0.22;
    const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.7, q, p, 16), mat);
    if (s === 4) { mesh.material.metalness = 0.95; mesh.material.roughness = 0.12; }
    if (s === 5) mesh.material = new THREE.MeshBasicMaterial({ color: mat.color, wireframe: true });
    return mesh;
  }
  if (kind === 13) {
    const moons = s === 0 ? 2 : s === 1 ? 3 : 3;
    const dist = s === 2 ? 0.95 : s === 3 ? 1.7 : 1.3;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 32), mat));
    for (let i = 0; i < moons; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), mat.clone());
      m.userData.orbit = { i, dist };
      m.position.set(Math.cos(i * 2.1) * dist, Math.sin(i) * 0.2, Math.sin(i * 2.1) * dist);
      g.add(m);
    }
    return g;
  }
  const g = new THREE.Group();
  const floorCol = s === 2 ? 0x3a4a70 : s === 3 ? 0x0a1020 : 0x1a2440;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 48),
    new THREE.MeshStandardMaterial({ color: floorCol, metalness: 0.85, roughness: 0.18 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1;
  g.add(floor);
  const ballR = s === 0 ? 0.95 : s === 1 ? 0.45 : 0.7;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(ballR, 32, 32), mat));
  return g;
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'lattice-1';
  const family = resolveFamily(id);
  const style = styleIndex(id, family);
  const n = FAMILIES.indexOf(family) + 1;
  const { stage } = bar(host, id);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x060a14, 1);
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, 2));
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 1.15);
  dir.position.set(3, 5, 2);
  scene.add(dir);
  const fill = new THREE.PointLight(0x818cf8, 0.45, 20);
  fill.position.set(-2, 1, 3);
  scene.add(fill);

  const countHint = Math.round(Number(ctrl.count) || 40);
  const mesh = buildMesh(THREE, family, style, n * 47, countHint);
  scene.add(mesh);

  const kind = FAMILIES.indexOf(family);
  let mx = 0;
  let my = 0;
  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    my = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  stage.addEventListener('pointermove', onMove);

  const resize = () => {
    const r = stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor(r.width || stage.clientWidth || host.clientWidth || 640));
    const height = Math.max(1, Math.floor(r.height || stage.clientHeight || host.clientHeight || 420));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  requestAnimationFrame(resize);
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  if (host.parentElement) ro.observe(host.parentElement);

  let raf = 0;
  let alive = true;
  const tick = (t) => {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    const L = live();
    const s = t * 0.001 * L.speed;
    const [cr, cg, cb] = colorToRgb(L.color);
    const applyColor = (obj) => {
      if (!obj) return;
      if (obj.material?.color?.setRGB) obj.material.color.setRGB(cr, cg, cb);
      if (obj.children?.length) obj.children.forEach(applyColor);
    };
    applyColor(mesh);
    const sz = L.size > 0 ? L.size : 1;
    if (mesh.scale) mesh.scale.setScalar(sz);

    if (mesh.rotation) {
      mesh.rotation.y = s * 0.6 + mx;
      mesh.rotation.x = my * 0.35 + Math.sin(s * 0.4) * 0.08;
    }

    if (kind === 8 && mesh.geometry?.attributes?.position) {
      const pos = mesh.geometry.attributes.position;
      const amp = mesh.userData.amp || 0.2;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setZ(i, Math.sin(x * 2 + s * 2) * amp + Math.cos(y * 2 + s) * amp * 0.75);
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }

    if (kind === 13 && mesh.children) {
      mesh.children.forEach((ch) => {
        const o = ch.userData?.orbit;
        if (!o) return;
        const a = s * 0.9 + o.i * 2.1;
        ch.position.set(Math.cos(a) * o.dist, Math.sin(a * 0.7) * 0.25, Math.sin(a) * o.dist);
      });
    }

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    stage.removeEventListener('pointermove', onMove);
    renderer.dispose();
    mesh.traverse?.((obj) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
      else obj.material?.dispose?.();
    });
    if (mesh.geometry) mesh.geometry.dispose?.();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose?.());
      else mesh.material.dispose?.();
    }
    host.innerHTML = '';
  };
}
