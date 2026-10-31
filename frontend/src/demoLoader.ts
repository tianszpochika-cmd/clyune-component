/** Dynamic import map: registry.mod → module, then call registry.fn(host, opts). */
type MountFn = (
  host: HTMLElement,
  opts?: { variant?: string; slug?: string },
) => void | (() => void) | Promise<void | (() => void)>;

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
  // parameterized kits (≥300 demos)
  'kit-css': () => import('./demos/kits/kit-css.js'),
  'kit-canvas': () => import('./demos/kits/kit-canvas.js'),
  'kit-svg': () => import('./demos/kits/kit-svg.js'),
  'kit-ui': () => import('./demos/kits/kit-ui.js'),
  'kit-chart': () => import('./demos/kits/kit-chart.js'),
  'kit-webgl': () => import('./demos/kits/kit-webgl.js'),
  'kit-three': () => import('./demos/kits/kit-three.js'),
  'kit-gsap': () => import('./demos/kits/kit-gsap.js'),
  'kit-physics': () => import('./demos/kits/kit-physics.js'),
  'kit-audio': () => import('./demos/kits/kit-audio.js'),
  'kit-dataviz': () => import('./demos/kits/kit-dataviz.js'),
  'kit-micro': () => import('./demos/kits/kit-micro.js'),
  'kit-layout': () => import('./demos/kits/kit-layout.js'),
  'kit-filters': () => import('./demos/kits/kit-filters.js'),
  'kit-particles': () => import('./demos/kits/kit-particles.js'),
  'kit-generative': () => import('./demos/kits/kit-generative.js'),
  'kit-text': () => import('./demos/kits/kit-text.js'),
  'kit-scroll': () => import('./demos/kits/kit-scroll.js'),
};

export async function mountDemo(
  mod: string,
  fn: string,
  host: HTMLElement,
  opts?: { variant?: string; slug?: string },
) {
  const load = loaders[mod];
  if (!load) throw new Error(`Unknown demo module: ${mod}`);
  const m = await load();
  const mount = m[fn];
  if (typeof mount !== 'function') throw new Error(`Missing export ${fn} in ${mod}`);
  return mount(host, opts);
}
