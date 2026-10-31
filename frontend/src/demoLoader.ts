/** Dynamic import map: registry.mod → module, then call registry.fn(host). */
type MountFn = (host: HTMLElement) => void | (() => void) | Promise<void | (() => void)>;

const loaders: Record<string, () => Promise<Record<string, MountFn>>> = {
  'cube': () => import('./demos/cube.js'),
  'orbit': () => import('./demos/orbit.js'),
  'particles': () => import('./demos/particles.js'),
  'gallery': () => import('./demos/gallery.js'),
  'wave': () => import('./demos/wave.js'),
  'gltf-shapes': () => import('./demos/gltf-shapes.js'),
  'shader-blob': () => import('./demos/shader-blob.js'),
  'charts-line': () => import('./demos/charts-line.js'),
  'charts-bar': () => import('./demos/charts-bar.js'),
  'charts-doughnut': () => import('./demos/charts-doughnut.js'),
  'ui-buttons': () => import('./demos/ui-buttons.js'),
  'ui-cards-modal': () => import('./demos/ui-cards-modal.js'),
  'css-keyframes': () => import('./demos/css-keyframes.js'),
  'css-glass': () => import('./demos/css-glass.js'),
  'css-tilt': () => import('./demos/css-tilt.js'),
  'css-scroll': () => import('./demos/css-scroll.js'),
  'canvas-network': () => import('./demos/canvas-network.js'),
  'canvas-matrix': () => import('./demos/canvas-matrix.js'),
  'canvas-fireworks': () => import('./demos/canvas-fireworks.js'),
  'canvas-draw': () => import('./demos/canvas-draw.js'),
  'svg-draw': () => import('./demos/svg-draw.js'),
  'svg-morph': () => import('./demos/svg-morph.js'),
  'svg-icons': () => import('./demos/svg-icons.js'),
  'gsap-timeline': () => import('./demos/gsap-timeline.js'),
  'gsap-scroll': () => import('./demos/gsap-scroll.js'),
  'gsap-text': () => import('./demos/gsap-text.js'),
  'webgl-shader': () => import('./demos/webgl-shader.js'),
  'physics-matter': () => import('./demos/physics-matter.js'),
  'physics-drag': () => import('./demos/physics-drag.js'),
  'physics-magnetic': () => import('./demos/physics-magnetic.js'),
  'audio-viz': () => import('./demos/audio-viz.js'),
  'dataviz': () => import('./demos/dataviz.js'),
  'micro': () => import('./demos/micro.js'),
};

export async function mountDemo(mod: string, fn: string, host: HTMLElement) {
  const load = loaders[mod];
  if (!load) throw new Error(`Unknown demo module: ${mod}`);
  const m = await load();
  const mount = m[fn];
  if (typeof mount !== 'function') throw new Error(`Missing export ${fn} in ${mod}`);
  return mount(host);
}
