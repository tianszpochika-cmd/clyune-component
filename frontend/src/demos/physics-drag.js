import { addStyle } from '../lib/canvas.js';
export function mount(host) {
  const rm = addStyle(`
  .pd { position:absolute; inset:0; overflow:auto; padding:18px; display:grid; grid-template-columns:repeat(3,minmax(220px,1fr)); gap:14px; align-items:start; }
  @media (max-width:760px){ .pd { grid-template-columns:1fr; } }
  .pd-col { background:#0d1426; border:1px solid #24314f; border-radius:14px; padding:12px; min-height:140px; display:flex; flex-direction:column; gap:8px; transition:border-color .2s, background .2s; }
  .pd-col.over { border-color:#818cf8; background:#111a33; }
  .pd-col h4 { margin:2px 4px 6px; font-size:13px; color:var(--muted); display:flex; justify-content:space-between; }
  .pd-item { background:#18233d; border:1px solid #24314f; border-radius:10px; padding:12px; font-size:13px; cursor:grab; user-select:none; touch-action:none; display:flex; gap:10px; align-items:center; }
  .pd-item i { width:8px; height:8px; border-radius:50%; flex:none; }
  .pd-item.ghost { opacity:.25; border-style:dashed; }
  .pd-drag { position:fixed; z-index:1000; pointer-events:none; box-shadow:0 18px 40px rgba(0,0,0,.5); transform:rotate(3deg) scale(1.04); cursor:grabbing; border-color:#818cf8; }
  `);
  const data = { '待办': ['设计首页', '接入 CDN', '编写文档', '性能测试'], '进行中': ['Canvas 特效', 'GSAP 时间轴'], '已完成': ['Three.js 示例', '图表组件', '部署 nginx'] };
  const dot = ['#fbbf24', '#22d3ee', '#34d399'];
  host.innerHTML = `<div class="pd">${Object.entries(data).map(([k, items], ci) => `<div class="pd-col" data-col="${ci}"><h4>${k}<span class="cnt"></span></h4>${items.map((t) => `<div class="pd-item"><i style="background:${dot[ci]}"></i>${t}</div>`).join('')}</div>`).join('')}</div>`;
  const root = host.querySelector('.pd');
  const count = () => root.querySelectorAll('.pd-col').forEach((c) => { c.querySelector('.cnt').textContent = c.querySelectorAll('.pd-item').length; c.querySelectorAll('.pd-item i').forEach((d) => d.style.background = dot[c.dataset.col]); });
  count();
  let drag = null;
  const flip = (fn) => {
    const items = [...root.querySelectorAll('.pd-item')];
    const first = new Map(items.map((el) => [el, el.getBoundingClientRect()]));
    fn();
    items.forEach((el) => { const a = first.get(el), b = el.getBoundingClientRect(); const dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' }); });
  };
  root.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.pd-item'); if (!item) return;
    e.preventDefault();
    const r = item.getBoundingClientRect();
    const clone = item.cloneNode(true); clone.classList.add('pd-drag'); clone.style.width = r.width + 'px'; clone.style.left = r.left + 'px'; clone.style.top = r.top + 'px';
    document.body.appendChild(clone); item.classList.add('ghost');
    drag = { item, clone, ox: e.clientX - r.left, oy: e.clientY - r.top, id: e.pointerId };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.clone.style.left = e.clientX - drag.ox + 'px'; drag.clone.style.top = e.clientY - drag.oy + 'px';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const col = el?.closest('.pd-col');
    root.querySelectorAll('.pd-col').forEach((c) => c.classList.toggle('over', c === col));
    if (!col) return;
    const after = [...col.querySelectorAll('.pd-item:not(.ghost)')].find((it) => { const b = it.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if (after ? drag.item.nextElementSibling !== after : col.lastElementChild !== drag.item) flip(() => after ? col.insertBefore(drag.item, after) : col.appendChild(drag.item));
    // auto-scroll the container
    const rr = root.getBoundingClientRect();
    if (e.clientY < rr.top + 40) root.scrollTop -= 10; else if (e.clientY > rr.bottom - 40) root.scrollTop += 10;
  });
  const end = () => { if (!drag) return; drag.clone.remove(); drag.item.classList.remove('ghost'); root.querySelectorAll('.pd-col').forEach((c) => c.classList.remove('over')); drag = null; count(); };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  return () => { drag?.clone.remove(); rm(); host.innerHTML = ''; };
}
