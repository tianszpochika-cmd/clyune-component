import * as THREE from 'three';
import { maxDpr, tuneOrbitControls } from '../lib/mobile.js';

export async function mountCube(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(2.4, 1.8, 3.2);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  host.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(3, 5, 2);
  scene.add(light, new THREE.AmbientLight(0x6688ff, 0.35));

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.35, roughness: 0.35 })
  );
  scene.add(cube);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineBasicMaterial({ color: 0x22d3ee })
  );
  cube.add(edges);

  const grid = new THREE.GridHelper(8, 16, 0x334166, 0x1b2744);
  scene.add(grid);

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
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.015;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();

  return () => {
    alive = false;
    ro.disconnect();
    renderer.dispose();
    host.innerHTML = '';
  };
}
