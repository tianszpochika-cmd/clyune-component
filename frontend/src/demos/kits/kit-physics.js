import { makeCanvas, loop, localPoint, bar, rand, hsl } from './_shared.js';
export function mount(host, opts = {}) {
  const id = opts.variant || 'sim-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<button class="btn" data-add>Add</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const balls = [];
  const spawn = (x, y) => balls.push({ x: x ?? rand(40, state.w-40), y: y ?? 40, vx: rand(-80,80), vy: rand(-20,20), r: rand(8,16), hue: (n*40+balls.length*20)%360 });
  for (let i=0;i<10;i++) spawn();
  const mouse = { x:0,y:0,down:false };
  canvas.addEventListener('pointermove', e => Object.assign(mouse, localPoint(canvas,e)));
  canvas.addEventListener('pointerdown', e => { mouse.down=true; Object.assign(mouse, localPoint(canvas,e)); spawn(mouse.x, mouse.y); });
  window.addEventListener('pointerup', () => mouse.down=false);
  host.querySelector('[data-add]')?.addEventListener('click', () => spawn());
  const kind = (n-1)%10;
  const stop = loop((dt) => {
    const { w,h } = state; ctx.fillStyle='#060a14'; ctx.fillRect(0,0,w,h);
    const g = kind===1 ? 0 : kind===4 ? -20 : 420;
    for (const b of balls) {
      if (kind===2) { // spring to mouse
        b.vx += (mouse.x - b.x) * 3 * dt; b.vy += (mouse.y - b.y) * 3 * dt;
      } else if (kind===5) { // pendulum-ish
        b.vx += Math.sin((b.x - w/2)/80) * -200 * dt;
      } else if (kind===7) { // magnetic to mouse
        const dx=mouse.x-b.x, dy=mouse.y-b.y, d=Math.hypot(dx,dy)||1;
        b.vx += dx/d*120*dt; b.vy += dy/d*120*dt;
      } else if (kind===8) {
        b.vx += (w/2 - b.x)*0.8*dt; b.vy += (h/2 - b.y)*0.8*dt;
      }
      b.vy += g * dt; b.vx *= 0.995; b.vy *= 0.995;
      b.x += b.vx*dt; b.y += b.vy*dt;
      if (b.x<b.r){b.x=b.r;b.vx*=-0.85;} if(b.x>w-b.r){b.x=w-b.r;b.vx*=-0.85;}
      if (b.y<b.r){b.y=b.r;b.vy*=-0.85;} if(b.y>h-b.r){b.y=h-b.r;b.vy*=-0.85;}
    }
    // simple collisions
    for (let i=0;i<balls.length;i++) for (let j=i+1;j<balls.length;j++){
      const a=balls[i],b=balls[j]; const dx=b.x-a.x,dy=b.y-a.y; const d=Math.hypot(dx,dy)||1; const min=a.r+b.r;
      if (d<min){ const nx=dx/d,ny=dy/d, overlap=(min-d)/2; a.x-=nx*overlap; a.y-=ny*overlap; b.x+=nx*overlap; b.y+=ny*overlap;
        const dv= (a.vx-b.vx)*nx+(a.vy-b.vy)*ny; a.vx-=dv*nx; a.vy-=dv*ny; b.vx+=dv*nx; b.vy+=dv*ny; }
    }
    for (const b of balls) {
      ctx.beginPath(); ctx.fillStyle=`hsl(${b.hue} 75% 60%)`; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      if (kind===2 || kind===8) { ctx.strokeStyle='rgba(129,140,248,.35)'; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(mouse.x,mouse.y); ctx.stroke(); }
    }
    if (kind===9) { // billiards cue line
      ctx.strokeStyle=hsl(n); ctx.beginPath(); ctx.moveTo(mouse.x,mouse.y); ctx.lineTo(balls[0]?.x||0, balls[0]?.y||0); ctx.stroke();
    }
  });
  return () => { stop(); dispose(); host.innerHTML=''; };
}
