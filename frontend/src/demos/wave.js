import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export async function mountWave(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 4, 8);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0x8899ff, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(3, 8, 4);
  scene.add(dir);

  const SEG = 60;
  const geo = new THREE.PlaneGeometry(10, 10, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee, metalness: 0.2, roughness: 0.35,
    wireframe: false, flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  const base = Float32Array.from(geo.attributes.position.array);

  let alive = true, t = 0;
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight || 420;
    camera.aspect = w / h;
    camera.userData.baseFov ??= camera.fov;
    camera.fov = camera.aspect < 1 ? Math.min(100, 2 * Math.atan(Math.tan(camera.userData.baseFov * Math.PI / 360) / camera.aspect) * 180 / Math.PI) : camera.userData.baseFov; camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(host);
  const tick = () => {
    if (!alive) return;
    t += 0.03;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = base[i], z = base[i + 2];
      pos[i + 1] = Math.sin(x * 1.2 + t) * 0.35 + Math.cos(z * 1.1 + t * 0.8) * 0.35;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
  return () => { alive = false; ro.disconnect(); controls.dispose(); renderer.dispose(); host.innerHTML = ''; };
}
