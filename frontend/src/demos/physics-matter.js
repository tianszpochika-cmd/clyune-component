import { libs } from '../lib/load.js';
import { localPoint } from '../lib/canvas.js';
export async function mount(host) {
  const Matter = await libs.matter();
  const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Events, Body } = Matter;
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const engine = Engine.create();
  const render = Render.create({ element: host, engine, options: { width: W(), height: H(), wireframes: false, background: '#060a14', pixelRatio: Math.min(devicePixelRatio || 1, 2) } });
  render.canvas.style.touchAction = 'none';
  const colors = ['#818cf8', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#c084fc'];
  const pick = () => colors[(Math.random() * colors.length) | 0];
  let walls = [];
  const buildWalls = () => {
    Composite.remove(engine.world, walls);
    const w = W(), h = H(), t = 60, o = { isStatic: true, render: { fillStyle: '#18233d' } };
    walls = [Bodies.rectangle(w / 2, h + t / 2 - 6, w + 200, t, o), Bodies.rectangle(-t / 2, h / 2, t, h * 3, o), Bodies.rectangle(w + t / 2, h / 2, t, h * 3, o),
      Bodies.rectangle(w * .3, h * .55, w * .25, 14, { ...o, angle: .25 }), Bodies.rectangle(w * .72, h * .38, w * .25, 14, { ...o, angle: -.22 })];
    Composite.add(engine.world, walls);
  };
  buildWalls();
  const spawn = (x, y) => {
    const s = 16 + Math.random() * 22, r = Math.random(), opts = { restitution: .6, friction: .05, render: { fillStyle: pick(), strokeStyle: 'rgba(255,255,255,.35)', lineWidth: 1 } };
    const b = r < .4 ? Bodies.circle(x, y, s, opts) : r < .7 ? Bodies.rectangle(x, y, s * 2, s * 2, { ...opts, chamfer: { radius: 6 } }) : Bodies.polygon(x, y, 3 + ((Math.random() * 4) | 0), s * 1.2, opts);
    Body.setAngularVelocity(b, (Math.random() - .5) * .3);
    Composite.add(engine.world, b);
    const all = Composite.allBodies(engine.world).filter((x) => !x.isStatic);
    if (all.length > 160) Composite.remove(engine.world, all[0]);
  };
  for (let i = 0; i < 30; i++) spawn(60 + Math.random() * (W() - 120), -Math.random() * 600);
  const mouse = Mouse.create(render.canvas);
  mouse.pixelRatio = render.options.pixelRatio;
  const mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: .2, render: { visible: true, strokeStyle: '#22d3ee' } } });
  Composite.add(engine.world, mc);
  render.mouse = mouse;
  let downAt = null;
  render.canvas.addEventListener('pointerdown', (e) => { downAt = { ...localPoint(render.canvas, e), hit: !!mc.body, t: performance.now() }; });
  Events.on(mc, 'startdrag', () => { if (downAt) downAt.hit = true; });
  render.canvas.addEventListener('pointerup', (e) => { if (downAt && !downAt.hit && performance.now() - downAt.t < 300) { const p = localPoint(render.canvas, e); for (let i = 0; i < 3; i++) spawn(p.x + (i - 1) * 20, p.y); } downAt = null; });
  const bar = document.createElement('div'); bar.className = 'fx-bar';
  bar.innerHTML = `<button class="btn" data-a="rain">下雨 +20</button><button class="btn" data-a="grav">反转重力</button><button class="btn" data-a="shake">摇晃</button><button class="btn" data-a="clear">清空</button>`;
  host.appendChild(bar);
  bar.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'rain') for (let i = 0; i < 20; i++) spawn(40 + Math.random() * (W() - 80), -Math.random() * 300);
    if (a === 'grav') engine.gravity.y *= -1;
    if (a === 'shake') Composite.allBodies(engine.world).forEach((b) => !b.isStatic && Body.setVelocity(b, { x: (Math.random() - .5) * 20, y: -Math.random() * 18 }));
    if (a === 'clear') Composite.allBodies(engine.world).forEach((b) => !b.isStatic && Composite.remove(engine.world, b));
  });
  const ro = new ResizeObserver(() => {
    render.bounds.max.x = W(); render.bounds.max.y = H(); render.options.width = W(); render.options.height = H();
    Render.setPixelRatio(render, render.options.pixelRatio); buildWalls();
  });
  ro.observe(host);
  const runner = Runner.create();
  Render.run(render); Runner.run(runner, engine);
  return () => { ro.disconnect(); Render.stop(render); Runner.stop(runner); Composite.clear(engine.world, false); Engine.clear(engine); Mouse.clearSourceEvents?.(mouse); render.canvas.remove(); host.innerHTML = ''; };
}
