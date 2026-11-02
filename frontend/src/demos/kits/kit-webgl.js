/**
 * kit-webgl — real GLSL fragment shaders rendered to an offscreen WebGL canvas,
 * composited into the canvas stage. Knobs drive shader uniforms (u_s/u_n/u_x);
 * LIVE .mip readout; beginner Chinese docs. Full-stage fill, no in-canvas overlays.
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, hexRgb, hueOf, clamp, TAU, fmt } from './canvas-stage.js';
import { F } from './info-panel.js';

const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const SPD = (label = '动画速度', max = 2.5) => ({ label, min: 0, max, step: 0.05, value: 0.9 });
const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
const on = (x) => x === true || x === 'true' || x === 1 || x === '1';
const yes = (x) => (on(x) ? '开' : '关');
const hsla = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const fsz = (W, H, k = 1) => clamp(Math.min(W, H) / 28, 10, 14) * k;
const text = (ctx, s, x, y, o = {}) => {
  const { size = 12, col = '#cbd5e1', align = 'left', base = 'middle', bold = false } = o;
  ctx.font = `${bold ? '600 ' : ''}${size}px ui-sans-serif,system-ui,"PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(String(s), x, y);
};
const rrect = (ctx, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};
const tip = (ctx, W, H, x, y, lines, accent = '#818cf8') => {
  if (!lines?.length) return;
  const s = fsz(W, H, 0.9); ctx.font = `${s}px ui-sans-serif,system-ui,"PingFang SC",sans-serif`;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16, h = lines.length * (s + 5) + 10;
  let bx = x + 12, by = y + 12; if (bx + w > W - 4) bx = x - w - 12; if (by + h > H - 4) by = y - h - 12;
  bx = clamp(bx, 4, Math.max(4, W - w - 4)); by = clamp(by, 4, Math.max(4, H - h - 4));
  ctx.fillStyle = 'rgba(8,13,26,.92)'; rrect(ctx, bx, by, w, h, 7); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
  lines.forEach((l, i) => text(ctx, l, bx + 8, by + 5 + (s + 5) * i + s / 2 + 1, { size: s, col: i ? '#cbd5e1' : '#f8fafc', bold: !i }));
};
const chip = (ctx, W, H, C) => {
  ctx.fillStyle = C.color || '#818cf8';
  rrect(ctx, 0, 0, W, 8, 0); ctx.fill();
  rrect(ctx, W - 48, H - 48, 38, 38, 9); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, W - 48, H - 48, 38, 38, 9); ctx.stroke();
};
const pastel = (C, i, n = 8, a = 1) => hsla(hueOf(C.color || '#818cf8') + i * (300 / Math.max(1, n)), 72, 58, a);
const easeFn = (name, t) => {
  t = clamp(t, 0, 1);
  switch (name) {
    case 'linear': return t;
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'back': { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
    case 'bounce': return t < 0.5 ? 4 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'steps': return Math.floor(t * 5) / 5;
    default: return t * t * (3 - 2 * t); // ease
  }
};

export const FAM = {};
const VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';
const COMMON = `precision mediump float; uniform vec2 u_res; uniform float u_t; uniform vec2 u_m; uniform vec3 u_col; uniform float u_s; uniform float u_n; uniform float u_x;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1)); vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
void main(){ vec2 uv=gl_FragCoord.xy/u_res; vec2 p=uv*2.-1.; float asp=u_res.x/u_res.y; p.x*=asp; vec2 m=u_m*2.-1.; m.x*=asp; float t=u_t; vec3 col=vec3(0.04,0.05,0.1);
`;
function makeGL(fragBody) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 4;
  const gl = c.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false }) || c.getContext('experimental-webgl');
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('[kit-webgl]', gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, COMMON + fragBody + '\n gl_FragColor=vec4(clamp(col,0.,1.),1.); }')); gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const k of ['u_res', 'u_t', 'u_m', 'u_col', 'u_s', 'u_n', 'u_x']) U[k] = gl.getUniformLocation(pr, k);
  return {
    c,
    draw(w, h, u) {
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h); gl.uniform2f(U.u_res, w, h); gl.uniform1f(U.u_t, u.t); gl.uniform2f(U.u_m, u.mx, u.my);
      gl.uniform3f(U.u_col, u.col[0], u.col[1], u.col[2]); gl.uniform1f(U.u_s, u.s); gl.uniform1f(U.u_n, u.n); gl.uniform1f(U.u_x, u.x);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    lose() { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {} },
  };
}

/** glFam: shared spec/doc wrapper. d.frag = GLSL body using u_s (尺寸), u_n (数量), u_x (额外). */
function glFam(d) {
  const ex = d.extra;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '动画速度'), size: d.size, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? (on(C[ex.key]) ? 1 : 0) : num(C[ex.key], ex.value));
  const exTxt = (C) => (ex.type === 'toggle' ? `${ex.label}：${yes(C[ex.key])}` : `${ex.label} ${fmt(exVal(C), 2)}`);
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针 uv', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p><p>每个像素都在 GPU 上独立运行同一段片元着色器（fragment shader），输入是像素坐标 uv 和时间 t，输出这个像素的颜色。</p>`,
      params: [['主色', '着色器里的 u_col，决定整体色调'], [spec.speed.label, '时间 t 的快慢（t × 速度）'], [d.size.label, d.sizeDoc || '传入 u_s，控制图案尺度'], [d.count.label, d.countDoc || '传入 u_n，控制循环/元素个数'], [ex.label, d.extraDoc || '传入 u_x，额外效果']],
      example: (v) => `<ol><li>当前：${v.mode}，${d.count.label} ${v.n}</li><li>指针位置 uv = ${v.cell}</li><li>主色 ${v.colorHex}，拖滑条看着色器实时变化</li></ol>`,
      tip: d.tip || '移动指针扰动画面（u_m）；拖动右侧滑条立即改变着色器参数。',
    },
    build(S) {
      const G = makeGL(d.frag); S._gl = G;
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        const n = Math.round(num(C.count, d.count.value)), s = num(C.size, d.size.value), spd = num(C.speed, 0.9), col = C.color || '#818cf8';
        const sh = Math.max(1, H - 8), sc = Math.min(1, (d.res || 560) / Math.max(W, sh)), gw = Math.max(2, Math.round(W * sc)), gh = Math.max(2, Math.round(sh * sc));
        const mx = clamp(P.x / W, 0, 1), my = clamp(1 - (P.y - 8) / sh, 0, 1);
        if (G) { const [r, g, b] = hexRgb(col); G.draw(gw, gh, { t: t * spd, mx, my, col: [r / 255, g / 255, b / 255], s, n, x: exVal(C) }); ctx.imageSmoothingEnabled = true; ctx.drawImage(G.c, 0, 8, W, sh); }
        else { ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 8, W, H); text(ctx, '此浏览器不支持 WebGL', W / 2, H / 2, { size: 14, col: '#94a3b8', align: 'center' }); }
        chip(ctx, W, H, C);
        return { mode: exTxt(C), n: String(n), cell: `(${mx.toFixed(2)}, ${my.toFixed(2)})`, colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}

FAM.noise = glFam({ title: '噪声流体背景', size: { label: '噪声缩放', min: 0.5, max: 5, step: 0.05, value: 2 }, count: { label: '叠加层数', min: 1, max: 6, step: 1, value: 4 },
  extra: R('warp', '域扭曲强度', 0, 2, 0.05, 1), presets: { 单层: { count: 1 }, 细节: { count: 6 }, 无扭曲: { warp: 0 }, 强扭曲: { warp: 2 } },
  explain: 'FBM 分形噪声：把不同频率的噪声叠加（每层频率 ×2、幅度 ÷2），再用噪声去扭曲坐标（域扭曲），得到流体般的背景。', formula: 'fbm(p) = Σ noise(p·2ⁱ) / 2ⁱ', formula2: 'q = p + 强度 · fbm(p + t)',
  frag: `float f=0.; float a=.5; vec2 q=p*u_s+m*.3; vec2 w=vec2(0.);
  for(int i=0;i<6;i++){ if(float(i)>=u_n) break; w+=a*vec2(noise(q*exp2(float(i))+t*.3),noise(q*exp2(float(i))+vec2(5.2,1.3)-t*.25)); a*=.5; }
  q+=u_x*w; a=.5; for(int i=0;i<6;i++){ if(float(i)>=u_n) break; f+=a*noise(q*exp2(float(i))+t*.15); a*=.5; }
  col=mix(vec3(.03,.04,.1),u_col,smoothstep(.15,.85,f)); col+=.35*u_col.bgr*length(w);` });

FAM.plasma = glFam({ title: '等离子 Plasma', size: { label: '波纹频率', min: 2, max: 14, step: 0.1, value: 6 }, count: { label: '正弦层数', min: 1, max: 6, step: 1, value: 4 },
  extra: R('contrast', '色彩对比', 0.4, 2.5, 0.05, 1), presets: { 单层: { count: 1 }, 繁复: { count: 6 }, 柔和: { contrast: 0.5 }, 高对比: { contrast: 2.4 } },
  explain: '经典 demoscene 等离子：几组方向不同的正弦波相加，结果再映射到彩色调色板。', formula: 'v = Σ sin(k·(p·dᵢ) + t)', formula2: 'color = 主色 × (0.5 + 0.5·sin(v·对比))',
  frag: `float v=0.; for(int i=0;i<6;i++){ if(float(i)>=u_n) break; float fi=float(i); vec2 d=vec2(cos(fi*1.3),sin(fi*1.7)); v+=sin(dot(p,d)*u_s+t*(1.+fi*.3)+fi); }
  v+=sin(length(p-m*.5)*u_s); v/=max(1.,u_n*.6);
  col=u_col*(.5+.5*sin(v*3.*u_x))+.45*hue(v*.15+.6)*(.5+.5*cos(v*2.*u_x));` });

FAM.raymarch = glFam({ title: '光线步进 Raymarch', size: { label: '球体半径', min: 0.2, max: 0.9, step: 0.01, value: 0.45 }, count: { label: '球体数', min: 1, max: 6, step: 1, value: 3 },
  res: 300,
  extra: R('light', '光照强度', 0.3, 1.8, 0.05, 1), presets: { 单球: { count: 1 }, 球群: { count: 6 }, 暗: { light: 0.4 }, 亮: { light: 1.7 } },
  explain: '光线步进：从相机向每个像素发出一条射线，每步前进「到最近物体的距离」（SDF），撞到球体表面后计算法线和光照。', formula: 'SDF 球 = |p − c| − r', formula2: '漫反射 = max(dot(N, L), 0) × 光照',
  frag: `vec3 ro=vec3(0.,0.,-3.); vec3 rd=normalize(vec3(p,1.6)); float tt=0.; float hit=0.; vec3 pos=ro;
  for(int s=0;s<48;s++){ pos=ro+rd*tt; float d=pos.y+1.; for(int i=0;i<6;i++){ if(float(i)>=u_n) break; float fi=float(i); float a=t*.6+fi*6.283/max(1.,u_n);
      vec3 c=u_n<1.5?vec3(0.):vec3(cos(a)*1.1,sin(t+fi)*.25,sin(a)*1.1); d=min(d,length(pos-c)-u_s); }
    if(d<.002){ hit=1.; break; } tt+=d; if(tt>12.) break; }
  if(hit>.5){ vec3 e=vec3(.002,0.,0.); vec3 N=vec3(0.,1.,0.); if(pos.y>-.99){ N=normalize(pos-vec3(0.)); float bd=99.; for(int i=0;i<6;i++){ if(float(i)>=u_n) break; float fi=float(i); float a=t*.6+fi*6.283/max(1.,u_n);
      vec3 c=u_n<1.5?vec3(0.):vec3(cos(a)*1.1,sin(t+fi)*.25,sin(a)*1.1); float dd=length(pos-c); if(dd<bd){ bd=dd; N=normalize(pos-c);} } }
    vec3 L=normalize(vec3(m.x*2.,1.5,-1.5+m.y)); float dif=max(dot(N,L),0.)*u_x; float floorC=pos.y<-.99?.35+.25*mod(floor(pos.x*2.)+floor(pos.z*2.),2.):1.;
    col=(pos.y<-.99?vec3(.25,.28,.4):u_col)*(.12+dif)*floorC+pow(max(dot(reflect(-L,N),-rd),0.),24.)*u_x*.6; col=mix(col,vec3(.04,.05,.1),clamp(tt/12.,0.,1.)); }
  else col=vec3(.04,.05,.1)+u_col*.08*(1.-uv.y);` });

FAM.voronoi = glFam({ title: 'Voronoi 细胞', size: { label: '光晕半径', min: 0.05, max: 0.6, step: 0.01, value: 0.3 }, count: { label: '种子点数', min: 3, max: 16, step: 1, value: 10 },
  extra: T('edges', '显示边线', true), presets: { 少点: { count: 3 }, 多点: { count: 16 }, 无边线: { edges: false }, 大光晕: { size: 0.6 } },
  explain: 'Voronoi 图：画面被分成若干细胞，每个像素属于离它最近的种子点；两个最近距离相等的地方就是细胞边线。', formula: 'd₁ = min |p − cᵢ|，d₂ = 第二近距离', formula2: '边线 = smoothstep(0.02, 0, d₂ − d₁)',
  frag: `float d1=9.,d2=9.; float id=0.; for(int i=0;i<16;i++){ if(float(i)>=u_n) break; float fi=float(i); vec2 c=vec2(sin(fi*1.7+t*.5)*asp*.8,cos(fi*2.3+t*.37)*.8); if(i==0) c=m;
    float d=length(p-c); if(d<d1){ d2=d1; d1=d; id=fi; } else if(d<d2) d2=d; }
  col=mix(vec3(.06,.08,.18),u_col*(.4+.6*hash(vec2(id,1.))),.6)+u_col*smoothstep(u_s,0.,d1); col+=u_x*vec3(1.)*smoothstep(.025,0.,d2-d1);` });

FAM.warp = glFam({ title: '坐标扭曲 Warp', size: { label: '扭曲幅度', min: 0, max: 1, step: 0.01, value: 0.4 }, count: { label: '噪声层数', min: 1, max: 5, step: 1, value: 3 },
  extra: R('freq', '图案频率', 1, 8, 0.1, 4), presets: { 平直: { size: 0 }, 强扭曲: { size: 1 }, 低频: { freq: 1.5 }, 高频: { freq: 7.5 } },
  explain: '坐标扭曲：先用噪声把坐标推来推去，再在扭曲后的坐标上画条纹/棋盘，规则图案就变成了流动的波纹。', formula: "p' = p + 幅度 · noise(p + t)", formula2: "图案 = sin(p'.x · 频率)",
  frag: `vec2 q=p+m*.2; float a=1.; for(int i=0;i<5;i++){ if(float(i)>=u_n) break; float fi=float(i); q+=u_s*a*vec2(noise(q*2.*(fi+1.)+t*.4)-.5,noise(q*2.*(fi+1.)+vec2(7.)-t*.3)-.5); a*=.6; }
  float s=sin(q.x*u_x*3.)*sin(q.y*u_x*3.); col=mix(vec3(.05,.06,.14),u_col,smoothstep(-.3,.3,s)); col+=.2*hue(q.x*.1+.5)*u_s;` });

FAM.spiral = glFam({ title: '螺旋 Spiral', size: { label: '螺旋密度', min: 3, max: 24, step: 0.5, value: 10 }, count: { label: '旋臂数', min: 1, max: 8, step: 1, value: 4 },
  extra: T('reverse', '反向旋转', false), presets: { 单臂: { count: 1 }, 八臂: { count: 8 }, 反向: { reverse: true }, 密: { size: 22 } },
  explain: '极坐标螺旋：把像素换成角度 θ 和半径 r，亮度取 sin(臂数·θ − 密度·r + t)，就得到旋转的螺旋臂。', formula: 'θ = atan(y, x)，r = |p|', formula2: 'v = sin(n·θ ∓ k·r + t)',
  frag: `vec2 q=p-m*.3; float a=atan(q.y,q.x); float r=length(q); float dir=u_x>.5?1.:-1.; float s=sin(a*u_n+dir*r*u_s-t*2.);
  col=vec3(.06,.08,.18)+u_col*smoothstep(0.,.35,s*.5+.5)/(1.+r*1.5)+.25*hue(a/6.283+.5)*smoothstep(.8,1.,s)*(u_x>.5?vec3(1.,.6,.6):vec3(.6,.8,1.));` });

FAM.checker = glFam({ title: '扭曲棋盘', size: { label: '扭曲幅度', min: 0, max: 1, step: 0.01, value: 0.35 }, count: { label: '格子数', min: 2, max: 14, step: 1, value: 6 },
  extra: T('dots', '圆点样式', false), presets: { 大格: { count: 2 }, 小格: { count: 14 }, 圆点: { dots: true }, 不扭曲: { size: 0 } },
  explain: '棋盘：floor(x)+floor(y) 的奇偶决定黑白；先用 sin 扭曲坐标，格子就会像布料一样波动。', formula: '格 = mod(floor(x) + floor(y), 2)', formula2: "x' = x + 幅度·sin(t + y)",
  frag: `vec2 q=p*u_n*.5; q+=u_s*vec2(sin(t+q.y),cos(t*.8+q.x))+m*.5; float c=mod(floor(q.x)+floor(q.y),2.);
  if(u_x>.5){ float d=length(fract(q)-.5); c=smoothstep(.36,.32,d)*(.4+.6*c); } col=mix(vec3(.06,.07,.15),u_col,c);` });

FAM.tunnel = glFam({ title: '隧道 Tunnel', size: { label: '隧道口径', min: 0.05, max: 0.6, step: 0.01, value: 0.15 }, count: { label: '条纹数', min: 3, max: 16, step: 1, value: 8 },
  extra: R('fog', '雾深度', 0, 1, 0.01, 0.5), presets: { 少条纹: { count: 3 }, 多条纹: { count: 16 }, 无雾: { fog: 0 }, 大口径: { size: 0.55 } },
  explain: '隧道：用 1/r 当作深度 z、角度 θ 当作绕圈坐标，z 随时间增加，就像在管道里向前飞。', formula: 'z = 1 / (r + 口径) + t', formula2: 'v = sin(条纹·θ)·sin(4z)',
  frag: `vec2 q=p-m*.25; float r=length(q); float a=atan(q.y,q.x); float z=1./(r+u_s)+t; float v=sin(a*u_n)*sin(z*4.);
  col=u_col*smoothstep(-.1,.6,v)+.2*hue(z*.05); col*=mix(1.,smoothstep(0.,.9,r),u_x); col+=vec3(.03,.04,.09);` });

FAM.ripple = glFam({ title: '水波纹 Ripple', size: { label: '波长', min: 0.05, max: 0.4, step: 0.005, value: 0.15 }, count: { label: '波源数', min: 1, max: 5, step: 1, value: 2 },
  extra: R('decay', '衰减速度', 0.3, 4, 0.05, 1.5), presets: { 单源: { count: 1 }, 多源: { count: 5 }, 远传: { decay: 0.4 }, 快衰减: { decay: 3.8 } },
  explain: '水波纹：每个波源发出圆形波 sin(距离/波长 − t)，离得越远越弱；多个波源叠加会出现干涉条纹。第一个波源跟随指针。', formula: 'h = Σ sin(2π·dᵢ/λ − 6t) · e^(−衰减·dᵢ)', formula2: '亮度 ∝ 0.5 + 0.5·h',
  frag: `float h=0.; for(int i=0;i<5;i++){ if(float(i)>=u_n) break; float fi=float(i); vec2 c=i==0?m:vec2(sin(fi*2.1)*asp*.7,cos(fi*1.4)*.6); float d=length(p-c); h+=sin(6.283*d/u_s-t*6.)*exp(-u_x*d); }
  col=vec3(.04,.08,.18)+u_col*(.5+.5*h/max(1.,u_n*.7))*.9+vec3(.9,.95,1.)*pow(max(h,0.),4.)*.08;` });

FAM.stars = glFam({ title: '星空 Starfield', size: { label: '星星大小', min: 0.5, max: 3, step: 0.05, value: 1.2 }, count: { label: '视差层数', min: 1, max: 5, step: 1, value: 3 },
  extra: T('nebula', '星云', true), presets: { 单层: { count: 1 }, 深空: { count: 5 }, 无星云: { nebula: false }, 大星: { size: 2.8 } },
  explain: '星空：把画面切成网格，每格用哈希随机放一颗星；多层网格以不同速度平移形成视差，近处星大且快。', formula: 'cell = floor(uv·密度)，星位 = hash(cell)', formula2: '第 i 层平移速度 ∝ (i+1)',
  frag: `vec3 s=vec3(0.); for(int i=0;i<5;i++){ if(float(i)>=u_n) break; float fi=float(i); float z=1.+fi; vec2 q=(p+m*.05*z)*(8.+fi*6.)+vec2(t*.4*z,fi*13.);
    vec2 id=floor(q); vec2 f=fract(q)-.5; float h=hash(id+fi*7.); vec2 o=vec2(hash(id+1.3),hash(id+2.7))-.5; float d=length(f-o*.6);
    float tw=.75+.25*sin(t*2.+h*40.); s+=step(.55,h)*smoothstep(.06*u_s/(1.+fi*.3),0.,d)*tw*mix(vec3(1.),u_col,.4); }
  float nb=noise(p*1.5+t*.05)*noise(p*3.-t*.03); col=vec3(.01,.015,.04)+u_x*u_col*nb*.7+s*1.6;` });

FAM.lava = glFam({ title: '熔岩灯 Lava', size: { label: '团块大小', min: 0.1, max: 0.5, step: 0.01, value: 0.25 }, count: { label: '团块数', min: 2, max: 10, step: 1, value: 6 },
  extra: R('glow', '发光强度', 0, 1.5, 0.05, 0.6), presets: { 少: { count: 2 }, 多: { count: 10 }, 无光: { glow: 0 }, 大团: { size: 0.48 } },
  explain: '熔岩灯：若干团块上下漂浮，每个团块贡献 r²/d² 的「场」，场之和超过阈值的区域连成一片，团块靠近时会融合。', formula: 'f = Σ rᵢ² / |p − cᵢ|²', formula2: '熔岩 = smoothstep(0.9, 1.1, f)',
  frag: `float f=0.; for(int i=0;i<10;i++){ if(float(i)>=u_n) break; float fi=float(i); vec2 c=vec2(sin(fi*2.4)*asp*.75,sin(t*.35*(.6+hash(vec2(fi))*.8)+fi*1.7)*.75); if(i==0) c=mix(c,m,.6);
    vec2 d=p-c; f+=u_s*u_s/dot(d,d); }
  float e=smoothstep(.9,1.1,f); col=mix(vec3(.12,.02,.05),u_col,e)+u_x*u_col*clamp(f*.25,0.,1.)*(1.-e)+vec3(1.,.9,.6)*smoothstep(2.5,6.,f)*.35;` });

FAM.grid3d = glFam({ title: '透视网格 Synthwave', size: { label: '网格密度', min: 1, max: 10, step: 0.1, value: 4 }, count: { label: '太阳条纹', min: 0, max: 8, step: 1, value: 4 },
  extra: R('horizon', '地平线高度', -0.4, 0.4, 0.01, 0.1), presets: { 无条纹: { count: 0 }, 多条纹: { count: 8 }, 低地平线: { horizon: -0.35 }, 高地平线: { horizon: 0.35 } },
  explain: '复古透视网格：地平线以下用 1/|y| 做透视深度，深度随时间增加让网格向你滚来；上方是一轮带条纹缺口的太阳。', formula: 'z = 1 / |y − 地平线|', formula2: 'gx = x·z·密度，gz = z + t',
  frag: `float hy=u_x; float y=p.y-hy; if(y<0.){ float z=1./(-y+.02); vec2 g=vec2(p.x*z*u_s*.3,(z+t*2.)*u_s*.3); vec2 l=abs(fract(g)-.5); float gr=smoothstep(.07*z*.15+.02,0.,min(l.x,l.y)*1.2);
    col=vec3(.05,.02,.1)+u_col*gr*clamp(-y*3.,0.,1.)*1.2; }
  else { float r=length(vec2(p.x-m.x*.2,y-.35)); float sun=smoothstep(.36,.34,r); float band=u_n<.5?1.:step(.5,fract((y-.35)*u_n*1.6+t*.3)); if(y>.35) band=1.;
    col=mix(vec3(.08,.03,.14),vec3(.12,.05,.2),y)+sun*band*mix(vec3(1.,.8,.3),u_col,clamp((.7-y),0.,1.)); col+=u_col*.15*exp(-y*6.); }` });

FAM.kaleido = glFam({ title: '万花筒 Kaleido', size: { label: '图案缩放', min: 1, max: 9, step: 0.1, value: 4 }, count: { label: '镜像瓣数', min: 3, max: 16, step: 1, value: 8 },
  extra: T('rainbow', '彩虹色环', true), presets: { 三瓣: { count: 3 }, 十六瓣: { count: 16 }, 单色: { rainbow: false }, 细密: { size: 8.5 } },
  explain: '万花筒：把角度对「每瓣角度」取模再镜像，整个平面就由一小块扇形复制出 n 瓣对称图案。', formula: 'θ\' = |mod(θ, 2π/n) − π/n|', formula2: "k = r·(cos θ', sin θ')，颜色 = noise(k·缩放 + t)",
  frag: `float a=atan(p.y,p.x)+t*.1; float r=length(p); float seg=6.283/u_n; a=abs(mod(a,seg)-seg*.5); vec2 k=vec2(cos(a),sin(a))*r+m*.15; float n=noise(k*u_s+t*.5)+.5*noise(k*u_s*2.-t*.3);
  vec3 base=u_col*(.35+.65*n); col=u_x>.5?mix(base,hue(n*.6+r*.3+t*.05),.5):base; col*=smoothstep(1.6,.2,r)*.8+.2; col+=u_col*.3*smoothstep(.02,0.,abs(a-seg*.5+.0)*r);` });

FAM.hsv = glFam({ title: 'HSV 色轮', size: { label: '饱和半径', min: 0.3, max: 1.5, step: 0.01, value: 0.9 }, count: { label: '色相分段', min: 0, max: 12, step: 1, value: 0 },
  extra: R('val', '明度 V', 0.2, 1, 0.01, 0.95), presets: { 连续: { count: 0 }, 六段: { count: 6 }, 十二段: { count: 12 }, 暗: { val: 0.35 } },
  explain: 'HSV 色轮：角度 = 色相 H，离中心距离 = 饱和度 S，整体亮度 = 明度 V。分段数 > 0 时色相被量化成色块。主色决定色轮中心的颜色。', formula: 'H = atan(y, x) / 2π，S = r / 半径', formula2: 'rgb = V · mix(1, hue(H), S)',
  frag: `vec2 q=p; float h=atan(q.y,q.x)/6.283+.5+t*.03; if(u_n>.5) h=floor(h*u_n)/u_n; float s=clamp(length(q)/u_s,0.,1.); vec3 c=hue(fract(h)); c=c*c*(3.-2.*c);
  col=u_x*mix(mix(vec3(1.),u_col,.6),c,s); col*=smoothstep(u_s+.01,u_s-.01,length(q))*.85+.15; float dm=length(q-m); col=mix(col,vec3(1.),smoothstep(.035,.025,dm)-smoothstep(.025,.015,dm));` });

FAM.scan = glFam({ title: '扫描线 Scanner', size: { label: '扫描线间距', min: 4, max: 40, step: 1, value: 14 }, count: { label: '扫描条数', min: 1, max: 5, step: 1, value: 2 },
  extra: R('glow', '余辉长度', 0.02, 0.4, 0.01, 0.12), presets: { 单条: { count: 1 }, 多条: { count: 5 }, 密线: { size: 4 }, 长余辉: { glow: 0.38 } },
  explain: '雷达/扫描效果：亮条从下往上扫过，身后留下指数衰减的余辉；背景是等间距的扫描线网格。', formula: '条 i 位置 y = fract(t·0.25 + i/n)', formula2: '亮度 = e^(−(y − 像素y)/余辉)',
  frag: `float g=0.; for(int i=0;i<5;i++){ if(float(i)>=u_n) break; float y0=fract(t*.25+float(i)/u_n); float dy=y0-uv.y; if(dy<0.) dy+=1.; g+=exp(-dy/u_x)*smoothstep(1.,.9,dy); }
  float lines=smoothstep(.2,0.,abs(fract(gl_FragCoord.y/u_res.y*u_res.y/u_s*0.5)-.5)-.4); float grid=smoothstep(.48,.5,abs(fract(uv.x*u_res.x/u_s*.25)-.5));
  col=vec3(.02,.05,.06)+u_col*(.08*lines+.1*grid)+u_col*g+vec3(.8)*pow(g,6.)*.4; col+=u_col*.2*smoothstep(.15,0.,length(p-m));` });

FAM.metaball = glFam({ title: 'Metaball 融球', size: { label: '融合阈值', min: 0.5, max: 2.5, step: 0.05, value: 1.2 }, count: { label: '球数', min: 2, max: 8, step: 1, value: 4 },
  extra: T('outline', '只描边', false), presets: { 两球: { count: 2 }, 八球: { count: 8 }, 描边: { outline: true }, 粘稠: { size: 0.6 } },
  explain: 'Metaball：每个球产生 1/d 的场，场之和大于阈值就算「球体内部」，所以球靠近时边界平滑地连在一起。最后一个球跟随指针。', formula: 'f = Σ 0.15 / |p − cᵢ|', formula2: '内部 = f > 阈值',
  frag: `float f=0.; for(int i=0;i<8;i++){ if(float(i)>=u_n) break; float fi=float(i); vec2 c=vec2(sin(t*.7+fi*2.1)*asp*.6,cos(t*.53+fi*1.3)*.6); if(float(i)==u_n-1.) c=m; f+=.15/length(p-c); }
  float e=smoothstep(u_s,u_s+.08,f); if(u_x>.5) e=smoothstep(.06,0.,abs(f-u_s)/max(f,.01)*3.); col=mix(vec3(.04,.05,.1),u_col,e)+u_col*.15*clamp(f/u_s,0.,1.);` });

FAM.fog = glFam({ title: '体积雾 Fog', size: { label: '雾浓度', min: 0.2, max: 1.6, step: 0.02, value: 0.9 }, count: { label: '雾层数', min: 1, max: 6, step: 1, value: 4 },
  extra: R('wind', '风向', -1, 1, 0.05, 0.4), presets: { 薄雾: { size: 0.3 }, 浓雾: { size: 1.5 }, 左风: { wind: -0.9 }, 单层: { count: 1 } },
  explain: '体积雾：多层噪声按不同速度沿风向飘动并叠加，越往下越浓；指针处像手电筒一样照亮雾气。', formula: 'f = Σ noise(p·1.5ⁱ + 风·t) / 2ⁱ', formula2: '颜色 = mix(夜色, 主色, f·浓度)',
  frag: `float f=0.; float a=.55; vec2 w=vec2(u_x,.15); for(int i=0;i<6;i++){ if(float(i)>=u_n) break; float fi=float(i); vec2 q=(p+vec2(u_x*.6*p.y,0.))*(1.2+fi*.6)+w*t*(.3+fi*.15)+fi*3.1; f+=a*noise(q); a*=.6; }
  f*=u_s*(1.2-uv.y*.6); float lamp=exp(-length(p-m)*2.5); col=mix(vec3(.02,.03,.07),u_col,clamp(f,0.,1.))+lamp*u_col*f*.8+vec3(.03)*lamp;` });

FAM.stripes = glFam({ title: '动态条纹', size: { label: '条纹宽度', min: 0.03, max: 0.4, step: 0.005, value: 0.12 }, count: { label: '颜色数', min: 2, max: 6, step: 1, value: 3 },
  extra: R('angle', '条纹角度', 0, 180, 1, 45), presets: { 双色: { count: 2 }, 六色: { count: 6 }, 竖条: { angle: 90 }, 粗条: { size: 0.38 } },
  explain: '斜条纹：把坐标旋转到条纹方向，按宽度切成一条条，每条按序号取 n 种颜色之一；指针附近条纹会弯曲。', formula: 's = (p·d) / 宽度 + t', formula2: '颜色 = 调色板[floor(s) mod n]',
  frag: `float an=radians(u_x); vec2 d=vec2(cos(an),sin(an)); vec2 q=p+(p-m)*.25*exp(-length(p-m)*3.); float s=dot(q,d)/u_s+t*.8; float idx=mod(floor(s),u_n);
  vec3 c=mix(u_col,hue(fract(idx/u_n+.15)),step(.5,idx)*.7); float edge=smoothstep(.0,.06,fract(s))*smoothstep(1.,.94,fract(s)); col=c*(.6+.4*edge);` });

FAM['circle-sdf'] = glFam({ title: '圆形 SDF', size: { label: '圆半径', min: 0.1, max: 0.6, step: 0.01, value: 0.3 }, count: { label: '圆个数', min: 1, max: 8, step: 1, value: 3 },
  extra: T('smooth', '平滑融合', true), presets: { 单圆: { count: 1 }, 八圆: { count: 8 }, 硬并集: { smooth: false }, 大圆: { size: 0.58 } },
  explain: 'SDF（有向距离场）：每个像素记录到圆边界的距离，内部为负、外部为正。多个圆取最小值得到并集，平滑融合用 smin 让交界圆润；等高线显示距离大小。', formula: 'd = |p − c| − r', formula2: 'smin(a, b) = min(a, b) − h²·k/4',
  frag: `float d=9.; for(int i=0;i<8;i++){ if(float(i)>=u_n) break; float fi=float(i); vec2 c=u_n<1.5?m:vec2(cos(fi*6.283/u_n+t*.4)*.6*asp*.7,sin(fi*6.283/u_n+t*.4)*.55); if(i==1) c=m;
    float di=length(p-c)-u_s; if(u_x>.5){ float k=.25; float h=max(k-abs(d-di),0.)/k; d=min(d,di)-h*h*k*.25; } else d=min(d,di); }
  col=d<0.?u_col*(.55+.45*cos(d*40.)):vec3(.08,.1,.2)*(.6+.4*cos(d*40.)); col=mix(col,vec3(1.),smoothstep(.012,0.,abs(d)));` });

FAM.water = glFam({ title: '水面焦散 Water', size: { label: '波高', min: 0.2, max: 1.6, step: 0.02, value: 0.8 }, count: { label: '波层数', min: 1, max: 6, step: 1, value: 4 },
  extra: R('caustic', '焦散强度', 0, 1.5, 0.05, 0.7), presets: { 平静: { size: 0.25 }, 汹涌: { size: 1.5 }, 无焦散: { caustic: 0 }, 单层: { count: 1 } },
  explain: '水面：多组不同方向、频率的正弦波叠加成水面高度，高度的峰值区域形成明亮的焦散光斑；指针拨动相位。', formula: 'h = Σ sin(fᵢ·x + t·fᵢ) · cos(fᵢ·y − t) / fᵢ', formula2: '焦散 = max(h, 0)³ × 强度',
  frag: `float w=0.; for(int i=0;i<6;i++){ if(float(i)>=u_n) break; float fi=float(i)+1.; w+=sin(p.x*fi*2.7+t*fi*.8+m.x*2.)*cos(p.y*fi*2.2-t*fi*.6+m.y)/fi; } w*=u_s;
  col=mix(vec3(.01,.06,.14),u_col,clamp(.45+.3*w,0.,1.)); col+=vec3(.85,.95,1.)*pow(max(0.,w),3.)*u_x*.5;` });

FAM.crt = glFam({ title: 'CRT 显示器', size: { label: '扫描线密度', min: 40, max: 300, step: 2, value: 120 }, count: { label: '像素块大小', min: 1, max: 10, step: 1, value: 2 },
  extra: R('aberr', '色差偏移', 0, 0.03, 0.001, 0.008), presets: { 细腻: { count: 1 }, 像素风: { count: 10 }, 无色差: { aberr: 0 }, 强色差: { aberr: 0.028 } },
  explain: 'CRT 复古屏：画面先按像素块量化，再加横向扫描线、RGB 三通道错位（色差）和四角暗角，模拟老电视。', formula: "uv' = floor(uv·N/块)·块/N", formula2: 'R/G/B 分别采样 uv ± 偏移',
  frag: `vec2 cu=uv*2.-1.; cu*=1.+.08*dot(cu,cu); vec2 u2=cu*.5+.5; float px=u_n/u_res.y; vec2 q=floor(u2/px)*px;
  vec3 img; for(int c=0;c<3;c++){ vec2 o=vec2((float(c)-1.)*u_x,0.); vec2 z=(q+o)*2.-1.; z.x*=asp; float v=.5+.5*sin(length(z-m)*9.-t*2.)*cos(z.x*3.+t)+.3*noise(z*3.+t*.2); if(c==0) img.r=v; else if(c==1) img.g=v; else img.b=v; }
  col=img*mix(vec3(.5),u_col*1.4,.6); col*=.75+.25*sin(u2.y*u_s*6.283+t*3.); col*=smoothstep(1.1,.4,length(cu)); if(abs(cu.x)>1.||abs(cu.y)>1.) col=vec3(.02);` });

FAM['julia-sh'] = glFam({ title: 'Julia 分形', size: { label: '视野缩放', min: 0.6, max: 3, step: 0.02, value: 1.5 }, count: { label: '迭代次数', min: 8, max: 64, step: 4, value: 40 },
  extra: T('smooth', '平滑着色', true), res: 420, presets: { 粗糙: { count: 8 }, 精细: { count: 64 }, 分层: { smooth: false }, 放大: { size: 0.7 } },
  explain: 'Julia 集：每个像素当作复数 z，反复做 z = z² + c，统计多少步后 |z| 超过 2（逃逸）。参数 c 随时间和指针缓慢移动，形状随之变化。', formula: 'z(n+1) = z(n)² + c', formula2: '颜色 ∝ 逃逸步数 / 迭代次数',
  frag: `vec2 z=p*u_s; vec2 c=vec2(-.7269+.06*cos(t*.3),.1889+.05*sin(t*.37))+m*.08; float it=0.; float zz=0.;
  for(int i=0;i<64;i++){ if(float(i)>=u_n) break; z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c; zz=dot(z,z); if(zz>16.) break; it+=1.; }
  float f=it; if(u_x>.5&&zz>4.) f=it-log2(log2(zz))+4.; f=clamp(f/u_n,0.,1.); col=mix(vec3(.02,.03,.08),u_col,pow(f,.6))+vec3(1.,.75,.35)*pow(f,4.)*.6; if(it>=u_n) col=u_col*.12+vec3(.02);` });

FAM['snow-sh'] = glFam({ title: '飘雪 Snow', size: { label: '雪花大小', min: 0.4, max: 3, step: 0.05, value: 1.2 }, count: { label: '雪花层数', min: 1, max: 10, step: 1, value: 6 },
  extra: R('wind', '风力', -1, 1, 0.05, 0.3), presets: { 小雪: { count: 2 }, 暴雪: { count: 10 }, 左风: { wind: -0.9 }, 大片: { size: 2.8 } },
  explain: '飘雪：每层把画面切成网格，每格放一片随机偏移的雪花并向下平移；近处层更大更快，风力让雪花倾斜飘落。', formula: '格 = floor(uv·密度 + (风·y, −速度·t))', formula2: '雪花 = smoothstep(r, 0, |格内位置 − 随机点|)',
  frag: `float s=0.; for(int i=0;i<10;i++){ if(float(i)>=u_n) break; float fi=float(i); float sc=3.+fi*1.2; vec2 q=uv*vec2(sc*asp,sc); q.x+=u_x*(q.y*.5+t*(.3+fi*.06))+sin(t*.5+fi)*.3; q.y+=t*(.25+fi*.06)+fi*5.;
    vec2 id=floor(q); vec2 f=fract(q); vec2 o=vec2(hash(id+fi),hash(id+fi+9.)); float d=length(f-o*.8-.1); s+=smoothstep(.07*u_s/(1.+fi*.08),.0,d)*(.4+.6*(1.-fi/10.)); }
  col=mix(vec3(.04,.06,.13),u_col*.35,uv.y*.6+.2)+vec3(.95,.97,1.)*min(s,1.2)+u_col*.15*exp(-length(p-m)*3.);` });

FAM.oil = glFam({ title: '油彩流 Oil', size: { label: '纹理尺度', min: 0.5, max: 4, step: 0.05, value: 1.6 }, count: { label: '扭曲迭代', min: 1, max: 6, step: 1, value: 4 },
  extra: R('irid', '彩虹膜', 0, 1, 0.02, 0.5), presets: { 简单: { count: 1 }, 复杂: { count: 6 }, 无彩膜: { irid: 0 }, 全彩: { irid: 1 } },
  explain: '油彩流：坐标被「旋转 + 噪声偏移」反复迭代，每多一次图案越复杂，像油彩在水面上流动；彩虹膜模拟肥皂泡的干涉色。', formula: 'q = rot(0.64)·q + noise(2q + 0.1t)', formula2: '颜色 = mix(主色 · n, 彩虹(n), 彩虹膜)',
  frag: `vec2 q=p*u_s+m*.3; for(int i=0;i<6;i++){ if(float(i)>=u_n) break; q=rot(.64)*q+vec2(noise(q*2.+t*.12),noise(q*2.+5.-t*.1)); } float n=noise(q*2.5);
  col=mix(u_col*(.3+.8*n),.5+.5*sin(n*12.+vec3(0,2,4)),u_x*.8)*(.6+.4*noise(q+3.));` });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'noise').replace(/^shader-/, '');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'noise';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-webgl',
    title: TITLES[fam] || fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: [],
    liveKeys: LIVE,
    presets: Object.keys(F0.presets),
    presetDefaults: { ...F0.presets, 默认: { color: F0.spec.color.value, ...(F0.presets['默认'] || {}) } },
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => {
      const S = createCanvasStage(box, o, { doc: F0.doc, spec: F0.spec, bg: '#060a14', auto: true, cursor: 'crosshair' });
      S.onFrame(F0.build(S));
      return () => { S.destroy(); S._gl?.lose(); };
    },
  });
}
