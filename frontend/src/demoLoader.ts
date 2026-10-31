/** Dynamic import map: registry.mod → module, then call registry.fn(host, opts). */
type MountFn = (
  host: HTMLElement,
  opts?: { variant?: string; slug?: string; _controls?: Record<string, unknown> },
) => void | (() => void) | Promise<void | (() => void)>;

const loaders: Record<string, () => Promise<Record<string, MountFn>>> = {
  'solar-system': () => import('./demos/solar-system.js'),
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
  'kit-css': () => import('./demos/kits/kit-css.js'),
  'kit-canvas': () => import('./demos/kits/kit-canvas.js'),
  'kit-svg': () => import('./demos/kits/kit-svg.js'),
  'kit-ui': () => import('./demos/kits/kit-ui.js'),
  'kit-chart': () => import('./demos/kits/kit-chart.js'),
  'kit-charts': () => import('./demos/kits/kit-charts.js'),
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

const LEGACY_META: Record<string, {
  title: string;
  presets?: string[];
  color?: boolean; speed?: boolean; size?: boolean; count?: boolean;
  remountKeys?: string[];
}> = {
  'solar-system': { title: '太阳系轨道', size: true, speed: true, color: true, count: true, presets: ['日心模式', '螺旋前进', '内太阳系', '外行星', '隐藏轨迹', '快进', '慢速'], remountKeys: ['count'] },
  'cube': { title: '旋转方块', size: true, speed: true, color: true, count: false },
  'orbit': { title: '轨道', size: true, speed: true, color: true, count: true },
  'particles': { title: '粒子', size: true, speed: true, color: true, count: true },
  'gallery': { title: '画廊', color: true, speed: true, size: true, count: false },
  'wave': { title: '波浪', color: true, speed: true, size: true, count: true },
  'gltf-shapes': { title: 'GLTF 形状', color: true, speed: true, size: true, count: false },
  'shader-blob': { title: 'Shader Blob', color: true, speed: true, size: true, count: false },
  'charts-line': { title: '折线图', color: true, speed: false, size: false, count: true },
  'charts-bar': { title: '柱状图', color: true, speed: false, size: false, count: true },
  'charts-doughnut': { title: '环图', color: true, speed: false, size: false, count: true },
  'ui-buttons': { title: '按钮', color: true, speed: true, size: true, count: false },
  'ui-cards-modal': { title: '卡片/模态', color: true, speed: true, size: true, count: false },
  'css-keyframes': { title: 'Keyframes', color: true, speed: true, size: true, count: false, presets: ['默认', '慢速', '快速', '大尺寸'] },
  'css-glass': { title: '毛玻璃', color: true, speed: true, size: true, count: false },
  'css-tilt': { title: '倾斜卡片', color: true, speed: true, size: true, count: false },
  'css-scroll': { title: '滚动驱动', color: true, speed: true, size: true, count: false },
  'canvas-network': { title: '粒子网络', color: true, speed: true, size: true, count: true, presets: ['默认', '稀疏', '密集', '高速'] },
  'canvas-matrix': { title: 'Matrix 雨', color: true, speed: true, size: true, count: true },
  'canvas-fireworks': { title: '烟花', color: true, speed: true, size: true, count: true },
  'canvas-draw': { title: '画板', color: true, speed: false, size: true, count: false },
  'svg-draw': { title: 'SVG 描边', color: true, speed: true, size: true, count: false },
  'svg-morph': { title: 'SVG Morph', color: true, speed: true, size: true, count: false },
  'svg-icons': { title: 'SVG 图标', color: true, speed: true, size: true, count: false },
  'gsap-timeline': { title: 'GSAP 时间轴', color: true, speed: true, size: true, count: false },
  'gsap-scroll': { title: 'GSAP 滚动', color: true, speed: true, size: true, count: false },
  'gsap-text': { title: 'GSAP 文字', color: true, speed: true, size: true, count: false },
  'webgl-shader': { title: 'WebGL Shader', color: true, speed: true, size: false, count: false },
  'physics-matter': { title: 'Matter 物理', color: true, speed: true, size: true, count: true },
  'physics-drag': { title: '拖拽物理', color: true, speed: true, size: true, count: true },
  'physics-magnetic': { title: '磁力场', color: true, speed: true, size: true, count: true },
  'audio-viz': { title: '音频可视化', color: true, speed: true, size: true, count: true },
  'dataviz': { title: '数据可视化', color: true, speed: true, size: true, count: true },
  'micro': { title: '微交互', color: true, speed: true, size: true, count: false },
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

  // Kits already ship DemoControls via withControls
  if (mod.startsWith('kit-')) {
    return mount(host, opts);
  }

  const meta = LEGACY_META[mod] || { title: mod, color: true, speed: true, size: true, count: true };
  const { wrapLegacyMount } = await import('./demos/kits/withControls.js');
  const { defaultParams } = await import('./demos/kits/_shared.js');
  return (wrapLegacyMount as Function)(host, opts || {}, {
    title: meta.title,
    presets: meta.presets || ['默认'],
    params: defaultParams({
      color: meta.color !== false,
      speed: meta.speed !== false,
      size: meta.size !== false,
      count: meta.count === true,
    }),
    remountKeys: meta.remountKeys || (meta.count ? ['count'] : []),
    mountInner: (box: HTMLElement, o: { variant?: string; slug?: string; _controls?: Record<string, unknown> }) =>
      mount(box, o),
  });
}
