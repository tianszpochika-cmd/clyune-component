import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { maxDpr, tuneOrbitControls } from '../lib/mobile.js';

/** Procedural "model" showcase (no external GLTF fetch) */
export async function mountGltfShapes(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(3.5, 2.5, 5);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  tuneOrbitControls(controls);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xb1c5ff, 0x1a2035, 0.9));
  const spot = new THREE.SpotLight(0xffffff, 2, 30, Math.PI / 5, 0.4);
  spot.position.set(4, 8, 2); scene.add(spot);

  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.2, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.4, roughness: 0.35 })
  );
  body.position.y = 1.1;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xf0f4ff, metalness: 0.2, roughness: 0.5 })
  );
  head.position.y = 2.15;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0x6366f1 }));
  armL.position.set(-0.75, 1.2, 0);
  const armR = armL.clone(); armR.position.x = 0.75;
  group.add(body, head, armL, armR);
  scene.add(group);
  scene.add(new THREE.GridHelper(10, 20, 0x334166, 0x1b2744));

  let alive = true;
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight || 420;
    camera.aspect = w / h;
    camera.userData.baseFov ??= camera.fov;
    camera.fov = camera.aspect < 1 ? Math.min(100, 2 * Math.atan(Math.tan(camera.userData.baseFov * Math.PI / 360) / camera.aspect) * 180 / Math.PI) : camera.userData.baseFov; camera.updateProjectionMatrix();
    renderer.setPixelRatio(maxDpr(2));
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(host);
  const tick = () => {
    if (!alive) return;
    group.rotation.y += 0.01;
    armL.rotation.x = Math.sin(Date.now() * 0.004) * 0.5;
    armR.rotation.x = Math.cos(Date.now() * 0.004) * 0.5;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
  return () => { alive = false; ro.disconnect(); controls.dispose(); renderer.dispose(); host.innerHTML = ''; };
}
