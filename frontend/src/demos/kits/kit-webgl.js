import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';


export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-webgl',
    title: '着色器',
    fallbackVariant: 'shader-voronoi',
    params: defaultParams({color:true,speed:true}),
    mapVariant: () => opts.variant || 'shader-voronoi',
    mountLegacy,
  });
}


const VERT = `attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`;
function frag(kind) {
  const common = `precision mediump float; uniform vec2 u_res; uniform float u_t; uniform vec2 u_m;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
  void main(){ vec2 uv=(gl_FragCoord.xy)/u_res; vec2 p=uv*2.-1.; p.x*=u_res.x/u_res.y; vec2 m=u_m*2.-1.; m.x*=u_res.x/u_res.y; float t=u_t; vec3 col=vec3(0.05);`;
  const bodies = {
    voronoi: `float md=1.; for(int i=0;i<12;i++){ float fi=float(i); vec2 c=vec2(sin(fi*1.7+t),cos(fi*2.3+t*.7))*.7; md=min(md,length(p-c)); } col=mix(vec3(.1,.15,.35),vec3(.5,.7,1.),smoothstep(.35,0.,md)); col+=exp(-md*12.)*vec3(.4,.7,1.);`,
    warp: `vec2 q=p; q+=.25*vec2(noise(q*3.+t),noise(q*3.+t+3.)); float n=noise(q*4.+m); col=vec3(.2+.5*n,.15+.4*noise(q*2.),.4+.4*n);`,
    spiral: `float a=atan(p.y,p.x); float r=length(p); float s=sin(a*5.-r*12.+t*2.); col=vec3(.15,.2,.4)+vec3(.5,.3,.8)*smoothstep(0.,.2,s*.5+.5)/(1.+r*2.);`,
    checker: `vec2 q=p*6.; q+=vec2(sin(t+q.y),cos(t+q.x))*.4+m*.3; float c=step(.5,fract(q.x))*step(.5,fract(q.y)); col=mix(vec3(.08,.1,.18),vec3(.7,.5,1.),c);`,
    tunnel: `float r=length(p); float a=atan(p.y,p.x); float z=1./(r+.15)+t; float v=sin(a*8.+z*4.); col=vec3(.1)+vec3(.4,.6,1.)*smoothstep(-.2,.8,v)/(1.+r*3.);`,
    ripple: `float d=length(p-m*.5); float w=sin(d*28.-t*6.); col=vec3(.1,.14,.25)+vec3(.3,.7,1.)*exp(-d*2.)* (.5+.5*w);`,
    stars: `float n=0.; for(int i=0;i<5;i++){ float f=exp2(float(i)); n+=noise(uv*f*3.+t*.05)/f; } col=vec3(n*.4); col+=smoothstep(.85,1.,hash(floor(uv*80.))) *vec3(1.);`,
    lava: `float n=noise(p*2.+t*.3)+.5*noise(p*4.-t*.2); col=mix(vec3(.15,0.,0.),vec3(1.,.5,.1),smoothstep(.3,.8,n)); col+=vec3(1.,.9,.5)*smoothstep(.75,.95,n);`,
    grid: `vec2 q=p; q.y+=.2; float z=1.5/(abs(q.y)+.2); vec2 g=vec2(q.x*z, z+t); float l=abs(fract(g.x)-.5); float v=abs(fract(g.y)-.5); float grid=smoothstep(.05,0.,min(l,v)); col=vec3(.05,.08,.15)+vec3(0.,.8,1.)*grid*exp(-abs(q.y)*2.);`,
    kaleido: `float a=atan(p.y,p.x); float r=length(p); a=mod(a,3.14159/4.); a=abs(a-3.14159/8.); vec2 k=vec2(cos(a),sin(a))*r; float n=noise(k*5.+t); col=vec3(.5+.5*sin(n*6.+vec3(0,2,4)));`,
    hsv: `float h=atan(p.y,p.x)/6.283+t*.1; float s=length(p); col=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.); col=col*col*(3.-2.*col); col=mix(vec3(1.),col,clamp(s*1.5,0.,1.));`,
    scan: `float n=noise(uv*vec2(40.,1.)+vec2(0,t)); float scan=step(.96,fract(uv.y*40.+t)); col=vec3(.05,.2,.1)+vec3(.2,1.,.4)*n*.5+vec3(0,1.,.3)*scan;`,
    metaball2: `float d1=length(p-vec2(sin(t)*.4,cos(t*.7)*.3)); float d2=length(p-m*.6); float f=1./d1+1./d2; float e=smoothstep(6.,8.,f); col=mix(vec3(.05),vec3(.4,.8,1.),e);`,
    fog: `float f=0.; for(int i=0;i<6;i++){ float fi=float(i); f+=noise(p*1.5+vec2(0,t*.1)+fi)*.5/exp2(fi);} col=mix(vec3(.02,.03,.08),vec3(.5,.6,.9),f);`,
    stripes: `float s=sin((p.x+p.y)*12.+t*3.+m.x*4.); col=mix(vec3(.1,.12,.25),vec3(.9,.4,1.),smoothstep(-.2,.2,s));`,
    'circle-sdf': `float d=abs(length(p-m*.4)-.45); col=vec3(.08)+vec3(.5,.8,1.)*exp(-d*30.); col+=vec3(1.,.6,.2)*exp(-abs(length(p)-.2)*40.);`,
  };
  const body = bodies[kind] || bodies.warp;
  return common + body + ` gl_FragColor=vec4(col,1.); }`;
}

function mountLegacy(host, opts = {}) {
  const id = (opts.variant || 'shader-warp').replace('shader-', '');
  const { stage } = bar(host, `shader-${id}`);
  const { canvas, ctx: gl, state, dispose } = makeCanvas(stage, { webgl: true });
  if (!gl) { stage.innerHTML = '<div class="loading err">WebGL unavailable</div>'; return () => { host.innerHTML=''; }; }
  const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, VERT); gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, frag(id)); gl.compileShader(fs);
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uT = gl.getUniformLocation(prog, 'u_t');
  const uM = gl.getUniformLocation(prog, 'u_m');
  const mouse = { x: 0.5, y: 0.5 };
  const onMove = (e) => { const p = localPoint(canvas, e); mouse.x = p.x / state.w; mouse.y = 1 - p.y / state.h; };
  canvas.addEventListener('pointermove', onMove);
  const stop = loop((_dt, t) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform2f(uM, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  });
  return () => { stop(); dispose(); canvas.removeEventListener('pointermove', onMove); host.innerHTML=''; };
}
