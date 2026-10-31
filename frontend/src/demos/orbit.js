import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export async function mountOrbit(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  scene.fog = new THREE.Fog(0x060a14, 8, 22);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(4, 2.5, 5);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const hemi = new THREE.HemisphereLight(0x9bb7ff, 0x223344, 0.7);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(5, 8, 3);
  key.castShadow = true;
  const fill = new THREE.PointLight(0x22d3ee, 1.2, 20);
  fill.position.set(-3, 2, 2);
  scene.add(hemi, key, fill);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6, 64),
    new THREE.MeshStandardMaterial({ color: 0x151d33, metalness: 0.2, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshStandardMaterial({ color: 0xf0f4ff, metalness: 0.85, roughness: 0.2 })
  );
  ball.position.y = 1;
  ball.castShadow = true;
  scene.add(ball);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.08, 16, 100),
    new THREE.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x312e81, metalness: 0.4, roughness: 0.3 })
  );
  ring.rotation.x = Math.PI / 2.4;
  ring.position.y = 1;
  scene.add(ring);

  renderer.shadowMap.enabled = true;
  let alive = true;
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight || 420;
    camera.aspect = w / h;
    camera.userData.baseFov ??= camera.fov;
    camera.fov = camera.aspect < 1 ? Math.min(100, 2 * Math.atan(Math.tan(camera.userData.baseFov * Math.PI / 360) / camera.aspect) * 180 / Math.PI) : camera.userData.baseFov;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const tick = () => {
    if (!alive) return;
    ring.rotation.z += 0.008;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();

  return () => {
    alive = false;
    ro.disconnect();
    controls.dispose();
    renderer.dispose();
    host.innerHTML = '';
  };
}
