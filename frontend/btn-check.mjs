// Button-overflow check (runs in page): text must stay inside its button/pill border.
// Flags scrollWidth>clientWidth (unless an intentional ellipsis) or text range rect spilling past the element rect.
export const BTN_CHECK = () => {
  const sel = 'button, .btn, a.btn, [role=button], .pill, .chip, .tag, .u-btn, .seg button, .fx-toolbar button, .demo-controls button, label.btn';
  const out = [];
  const sbOpen = !!document.querySelector('.sidebar.open, .sidebar-open, body.nav-open');
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
    if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('.sidebar') && !sbOpen) continue;
    if (el.closest('[aria-hidden=true]')) continue;
    const txt = (el.textContent || '').trim(); if (!txt) continue;
    const ell = cs.textOverflow === 'ellipsis' || [...el.querySelectorAll('*')].some((c) => getComputedStyle(c).textOverflow === 'ellipsis');
    let bad = '';
    if (!ell && el.scrollWidth > el.clientWidth + 1) bad = `scroll ${el.scrollWidth}>${el.clientWidth}`;
    if (!bad && !ell) {
      const rg = document.createRange(); rg.selectNodeContents(el);
      for (const tr of rg.getClientRects()) {
        if (tr.width < 1) continue;
        if (tr.left < r.left - 1 || tr.right > r.right + 1 || tr.top < r.top - 2 || tr.bottom > r.bottom + 2) { bad = `text ${Math.round(tr.left - r.left)},${Math.round(r.right - tr.right)}`; break; }
      }
    }
    if (bad) out.push(`btn-overflow ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || ''}「${txt.slice(0, 10)}」 ${bad}`);
  }
  return [...new Set(out)].slice(0, 6);
};
