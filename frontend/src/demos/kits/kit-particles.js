import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';


export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-particles',
    title: '粒子实验室',
    fallbackVariant: 'particles-lab',
    params: defaultParams({color:true,speed:true,size:true,count:true}),
    mapVariant: (family, n) => `p-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'p-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<button class="btn" data-burst>Burst</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const mouse = { x: 0, y: 0 };
  let parts = [];
  const kind = (n - 1) % 25;
  const seed = () => {
    parts = Array.from({ length: 100 + n * 3 }, () => ({
      x: rand(0, state.w), y: rand(0, state.h), vx: rand(-30,30), vy: rand(-30,30),
      r: rand(1, 3), life: rand(0.4,1), hue: (n*37 + rand(0,80)) % 360,
    }));
  };
  state.onResize = seed; seed();
  const burst = () => {
    for (let i=0;i<30;i++){ const a=rand(0,Math.PI*2), sp=rand(40,220); parts.push({ x:mouse.x||state.w/2, y:mouse.y||state.h/2, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:rand(1.5,4), life:1, hue:(n*40+i*10)%360 }); }
  };
  canvas.addEventListener('pointermove', e => Object.assign(mouse, localPoint(canvas,e)));
  canvas.addEventListener('pointerdown', burst);
  host.querySelector('[data-burst]')?.addEventListener('click', burst);
  const stop = loop((dt,t) => {
    const {w,h}=state;
    ctx.fillStyle = kind===0 ? 'rgba(6,10,20,0.35)' : '#060a14';
    if (kind!==0) ctx.fillRect(0,0,w,h); else ctx.fillRect(0,0,w,h);
    for (const p of parts) {
      if (kind===0) { p.vy = Math.sin(t+p.x)*4; } // stars twinkle drift
      else if (kind===1) { p.vy += 30*dt; p.vx += Math.sin(t+p.x)*5*dt; if(p.y>h){p.y=-2;p.x=rand(0,w);} } // snow
      else if (kind===2) { p.vy += 50*dt; if(p.y>h){p.y=-2;p.x=rand(0,w);} p.hue=45; } // gold rain
      else if (kind===3) { p.vy -= 20*dt; p.life -= dt*0.2; if(p.life<=0){ p.y=h; p.life=1; p.x=w/2+rand(-20,20);} } // smoke up
      else if (kind===6 || kind===8) { // gravity / follow
        const dx=mouse.x-p.x, dy=mouse.y-p.y, d=Math.hypot(dx,dy)||1;
        const f = kind===6 ? 80 : -60;
        p.vx += dx/d*f*dt; p.vy += dy/d*f*dt;
      } else if (kind===10) { // spiral galaxy
        const dx=p.x-w/2, dy=p.y-h/2; p.vx += -dy*0.4*dt; p.vy += dx*0.4*dt;
      } else if (kind===11) { // heart field
        const ang = Math.atan2(p.y-h/2, p.x-w/2);
        const hx = w/2 + 16*Math.pow(Math.sin(ang),3)*8;
        const hy = h/2 - (13*Math.cos(ang)-5*Math.cos(2*ang)-2*Math.cos(3*ang)-Math.cos(4*ang))*8;
        p.vx += (hx-p.x)*0.5*dt; p.vy += (hy-p.y)*0.5*dt;
      } else if (kind===14) { p.y += Math.sin(t*2+p.x*0.05)*20*dt; }
      else { p.vx *= 0.99; p.vy *= 0.99; }
      p.x += p.vx*dt; p.y += p.vy*dt;
      if (! [1,2,3].includes(kind)) {
        if (p.x<0||p.x>w) p.vx*=-1; if (p.y<0||p.y>h) p.vy*=-1;
      }
      ctx.beginPath(); ctx.fillStyle=`hsla(${p.hue} 80% 65% / ${0.4+p.life*0.6})`;
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    if (kind===22) {
      for (let i=0;i<parts.length;i++) for (let j=i+1;j<i+8 && j<parts.length;j++){
        const a=parts[i],b=parts[j]; const d=Math.hypot(a.x-b.x,a.y-b.y);
        if (d<90){ ctx.strokeStyle=`rgba(129,140,248,${1-d/90})`; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
      }
    }
  });
  return () => { stop(); dispose(); host.innerHTML=''; };
}
