import { addStyle, bar, hsl, defaultParams, parseVariant } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';
import { cdn, loadScript } from '../../lib/load.js';

export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-three',
    title: 'Three 场景',
    fallbackVariant: 'scene-1',
    params: defaultParams({color:true,speed:true}),
    mapVariant: (family, n) => `scene-${n}`,
    mountLegacy,
  });
}


async function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'scene-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id);
  await loadScript(cdn('three', '0.170.0', 'build/three.min.js'), 'THREE');
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1); dir.position.set(3, 5, 2); scene.add(dir);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(((n * 47) % 360) / 360, 0.7, 0.55), metalness: 0.35, roughness: 0.35 });
  let mesh;
  const kind = (n - 1) % 12;
  if (kind === 0) {
    const g = new THREE.Group();
    for (let i = 0; i < 27; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mat.clone());
      c.material.color = new THREE.Color().setHSL(((n * 47 + i * 12) % 360) / 360, 0.7, 0.55);
      c.position.set((i % 3) - 1, ((i / 3 | 0) % 3) - 1, ((i / 9) | 0) - 1);
      g.add(c);
    }
    mesh = g;
  } else if (kind === 1) mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 32, 64), mat);
  else if (kind === 2) mesh = new THREE.Points(new THREE.SphereGeometry(1, 32, 32), new THREE.PointsMaterial({ color: mat.color, size: 0.03 }));
  else if (kind === 3) {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat.clone());
      m.position.set(Math.cos(i) * 1.4, Math.sin(i * 0.7) * 0.4, Math.sin(i) * 1.4);
      g.add(m);
    }
    mesh = g;
  } else if (kind === 4) {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => new THREE.Vector3(Math.cos(i * 0.4) * 1.2, i * 0.05 - 1, Math.sin(i * 0.4) * 1.2)));
    mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.08, 8, false), mat);
  } else if (kind === 5) mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), new THREE.MeshPhysicalMaterial({ color: mat.color, transmission: 0.55, thickness: 0.8, roughness: 0.2, metalness: 0 }));
  else if (kind === 6) mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: mat.color, wireframe: true }));
  else if (kind === 7) {
    const ig = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat, 80);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 80; i++) { m4.setPosition((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4); ig.setMatrixAt(i, m4); }
    mesh = ig;
  } else if (kind === 8) { mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5, 48, 48), mat); mesh.rotation.x = -Math.PI / 2.5; }
  else if (kind === 9) {
    const g = new THREE.BufferGeometry(); const N = 800; const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pos[i * 3] = Math.cos(a) * 1.2; pos[i * 3 + 1] = (Math.random() - 0.5) * 0.4; pos[i * 3 + 2] = Math.sin(a) * 1.2; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    mesh = new THREE.Points(g, new THREE.PointsMaterial({ color: mat.color, size: 0.04 }));
  } else if (kind === 10) mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 2.4, 24), mat);
  else {
    mesh = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshStandardMaterial({ color: 0x1a2440, metalness: 0.8, roughness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1; mesh.add(floor);
    mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), mat));
  }
  scene.add(mesh);
  const ro = new ResizeObserver(() => {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
  });
  ro.observe(stage);
  let mx = 0, my = 0;
  const onMove = (e) => { const r = stage.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width * 2 - 1; my = (e.clientY - r.top) / r.height * 2 - 1; };
  stage.addEventListener('pointermove', onMove);
  let raf = 0;
  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    const s = t * 0.001;
    if (mesh.rotation) { mesh.rotation.y = s * 0.6 + mx; mesh.rotation.x = my * 0.3; }
    if (kind === 8 && mesh.geometry?.attributes?.position) {
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, Math.sin(x * 2 + s * 2) * 0.2 + Math.cos(y * 2 + s) * 0.15);
      }
      pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); stage.removeEventListener('pointermove', onMove); renderer.dispose(); host.innerHTML = ''; };
}
