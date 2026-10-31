import * as THREE from 'three';
import { maxDpr, tuneOrbitControls } from '../lib/mobile.js';

export async function mountShaderBlob(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3.2;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  host.appendChild(renderer.domElement);

  const uniforms = {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(0x818cf8) },
    uColorB: { value: new THREE.Color(0x22d3ee) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vN; varying vec3 vP; uniform float uTime;
      void main(){
        vN = normalize(normalMatrix * normal);
        vec3 p = position + normal * (0.12 * sin(uTime + position.y * 6.0));
        vP = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vP; uniform float uTime;
      uniform vec3 uColorA; uniform vec3 uColorB;
      void main(){
        float f = 0.5 + 0.5 * dot(normalize(vN), vec3(0.2,0.8,0.4));
        vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vP.y * 3.0 + uTime));
        gl_FragColor = vec4(col * f, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), mat);
  scene.add(mesh);

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
    uniforms.uTime.value += 0.02;
    mesh.rotation.y += 0.005;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
  return () => { alive = false; ro.disconnect(); renderer.dispose(); host.innerHTML = ''; };
}
