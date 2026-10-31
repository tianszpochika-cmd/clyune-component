import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { maxDpr, tuneOrbitControls } from '../lib/mobile.js';

export async function mountGallery(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 2.2, 8);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  tuneOrbitControls(controls);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(4, 6, 2);
  scene.add(dir);

  const specs = [
    ['Box', new THREE.BoxGeometry(1, 1, 1), 0x818cf8],
    ['Sphere', new THREE.SphereGeometry(0.7, 32, 32), 0x22d3ee],
    ['Cone', new THREE.ConeGeometry(0.6, 1.2, 32), 0x34d399],
    ['Torus', new THREE.TorusGeometry(0.55, 0.22, 16, 48), 0xfbbf24],
    ['Octahedron', new THREE.OctahedronGeometry(0.7), 0xf472b6],
    ['Icosahedron', new THREE.IcosahedronGeometry(0.7), 0xa78bfa],
  ];
  const meshes = [];
  specs.forEach(([name, geometry, color], i) => {
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.x = (i - (specs.length - 1) / 2) * 1.7;
    mesh.userData = { name, baseColor: color };
    scene.add(mesh);
    meshes.push(mesh);
  });
  scene.add(new THREE.GridHelper(14, 28, 0x334166, 0x1b2744));

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selected = null;
  const onClick = (e) => {
    const r = host.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(meshes);
    if (selected) selected.material.emissive?.setHex(0x000000);
    selected = hits[0]?.object || null;
    if (selected) {
      selected.material.emissive = new THREE.Color(0x2244aa);
      selected.material.emissiveIntensity = 0.55;
    }
  };
  host.addEventListener('click', onClick);

  let alive = true;
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight || 420;
    camera.aspect = w / h;
    camera.userData.baseFov ??= camera.fov;
    camera.fov = camera.aspect < 1 ? Math.min(100, 2 * Math.atan(Math.tan(camera.userData.baseFov * Math.PI / 360) / camera.aspect) * 180 / Math.PI) : camera.userData.baseFov;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(maxDpr(2));
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const tick = () => {
    if (!alive) return;
    meshes.forEach((m, i) => {
      m.rotation.y += 0.008 + i * 0.001;
      m.rotation.x += 0.003;
    });
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();

  return () => {
    alive = false;
    host.removeEventListener('click', onClick);
    ro.disconnect();
    controls.dispose();
    renderer.dispose();
    host.innerHTML = '';
  };
}
