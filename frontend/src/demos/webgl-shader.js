// Raw WebGL fullscreen fragment shaders
import { makeCanvas, loop, localPoint } from '../lib/canvas.js';

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
const HEAD = 'precision highp float; uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;\n';

const NOISE = HEAD + `
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.y; vec2 m = uMouse / uRes.y;
  float t = uTime*.12;
  vec2 q = vec2(fbm(uv*2.+t), fbm(uv*2.+vec2(5.2,1.3)-t));
  q += .25*exp(-6.*length(uv-m));
  vec2 r = vec2(fbm(uv*2.+4.*q+vec2(1.7,9.2)+t*1.5), fbm(uv*2.+4.*q+vec2(8.3,2.8)-t));
  float f = fbm(uv*2.+4.*r);
  vec3 col = mix(vec3(.04,.06,.16), vec3(.31,.27,.9), clamp(f*f*2.,0.,1.));
  col = mix(col, vec3(.13,.83,.93), clamp(length(q)*.6,0.,1.));
  col = mix(col, vec3(.96,.45,.71), clamp(r.x*r.x*.9,0.,1.)*.6);
  col *= .6 + .7*f;
  gl_FragColor = vec4(pow(col, vec3(.95)), 1.);
}`;

const PLASMA = HEAD + `
void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes) / uRes.y * 3.;
  float t = uTime*.8;
  float v = sin(uv.x*2.+t) + sin((uv.y*2.+t)*.7) + sin((uv.x+uv.y)*1.5+t*1.3);
  vec2 c = uv + vec2(sin(t*.5)*1.5, cos(t*.33)*1.5);
  v += sin(sqrt(dot(c,c)+1.)*3. - t);
  v *= .5;
  vec3 col = .5 + .5*cos(3.14159*v + vec3(0., 2.1, 4.2) + t*.2);
  col *= .85 + .15*sin(gl_FragCoord.y*1.5);
  gl_FragColor = vec4(col, 1.);
}`;

const RAY = HEAD + `
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float map(vec3 p){
  float t=uTime; float d=p.y+1.2;
  float b=1e9;
  for(int i=0;i<5;i++){ float fi=float(i);
    vec3 c=vec3(sin(t*.7+fi*1.3)*1.2, sin(t*.9+fi*2.1)*.6, cos(t*.5+fi*1.7)*1.2);
    b=smin(b, length(p-c)-.45-.1*sin(t+fi), .6); }
  return min(d,b);
}
vec3 nrm(vec3 p){ vec2 e=vec2(.002,0.); return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float ay = (uMouse.x/uRes.x-.5)*6.2832 + uTime*.15; float ax = (uMouse.y/uRes.y-.5)*1.2;
  vec3 ro=vec3(sin(ay)*4.5, 1.2+ax*2., cos(ay)*4.5); vec3 ta=vec3(0.);
  vec3 f=normalize(ta-ro), r=normalize(cross(vec3(0,1,0),f)), u=cross(f,r);
  vec3 rd=normalize(f*1.6+uv.x*r+uv.y*u);
  float t=0.; float d; int hit=0;
  for(int i=0;i<90;i++){ vec3 p=ro+rd*t; d=map(p); if(d<.001){hit=1;break;} t+=d; if(t>30.)break; }
  vec3 col=mix(vec3(.02,.03,.08), vec3(.1,.12,.25), uv.y+.5);
  if(hit==1){
    vec3 p=ro+rd*t, n=nrm(p), l=normalize(vec3(.6,.9,.4));
    float dif=max(dot(n,l),0.), spe=pow(max(dot(reflect(-l,n),-rd),0.),48.), fre=pow(1.-max(dot(n,-rd),0.),3.);
    vec3 base = p.y < -1.19 ? vec3(.12,.14,.22)*(.6+.4*mod(floor(p.x)+floor(p.z),2.)) : .5+.5*cos(vec3(0.,2.,4.)+p.y*1.5+uTime*.3);
    float sh=1.; float st=.05; for(int j=0;j<24;j++){ float h=map(p+n*.01+l*st); sh=min(sh,8.*h/st); st+=clamp(h,.02,.3); if(st>6.)break; }
    sh=clamp(sh,.15,1.);
    col = base*(.18+dif*sh) + spe*sh + fre*vec3(.3,.4,.9)*.6;
    col = mix(col, vec3(.02,.03,.08), 1.-exp(-.004*t*t));
  }
  gl_FragColor=vec4(pow(col,vec3(.4545)),1.);
}`;

function mountShader(host, frag, maxDpr = 1.5) {
  const { canvas, ctx: gl, state, dispose } = makeCanvas(host, { webgl: true, maxDpr });
  if (!gl) { host.innerHTML = '<div class="loading err">当前浏览器不支持 WebGL</div>'; return () => { dispose(); host.innerHTML = ''; }; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'), uMouse = gl.getUniformLocation(prog, 'uMouse');
  const mouse = { x: canvas.width * .5, y: canvas.height * .5 }, target = { ...mouse };
  const move = (e) => { const p = localPoint(canvas, e); target.x = p.x * state.dpr; target.y = canvas.height - p.y * state.dpr; };
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', move);
  const t0 = performance.now();
  const stop = loop(() => {
    mouse.x += (target.x - mouse.x) * .08; mouse.y += (target.y - mouse.y) * .08;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uTime, (performance.now() - t0) / 1000); gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  });
  return () => { stop(); gl.deleteProgram(prog); gl.deleteBuffer(buf); gl.getExtension('WEBGL_lose_context')?.loseContext(); dispose(); };
}

export const mountNoise = (h) => mountShader(h, NOISE);
export const mountPlasma = (h) => mountShader(h, PLASMA);
export const mountRaymarch = (h) => mountShader(h, RAY, 1);
