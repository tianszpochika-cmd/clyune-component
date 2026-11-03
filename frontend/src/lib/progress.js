// Tiny load-progress bus: CDN script fetches report bytes; DemoHost listens and renders the stage loader.
const subs = new Set();
const jobs = new Map(); // url -> { loaded, total, done }
export function onProgress(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() {
  let loaded = 0, total = 0, known = true, n = 0, done = 0;
  for (const j of jobs.values()) { n++; if (j.done) done++; loaded += j.loaded; if (j.total) total += j.total; else known = false; }
  const snap = { loaded, total: known ? total : 0, n, done };
  subs.forEach((f) => { try { f(snap); } catch (_) { /* ignore */ } });
}
export function resetProgress() { for (const [k, j] of jobs) if (j.done) jobs.delete(k); emit(); }
/** fetch a script with a ReadableStream so bytes can be reported; returns its source text. */
export async function fetchWithProgress(url, timeoutMs = 45000) {
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), timeoutMs);
  const j = { loaded: 0, total: 0, done: false }; jobs.set(url, j); emit();
  try {
    const r = await fetch(url, { signal: ac.signal, mode: 'cors', credentials: 'omit' });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    j.total = +(r.headers.get('content-length') || 0);
    if (!r.body || !r.body.getReader) { const t = await r.text(); j.loaded = j.total = t.length; return t; }
    const rd = r.body.getReader(); const parts = [];
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); j.loaded += value.length; emit(); }
    const buf = new Uint8Array(j.loaded); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
    if (!j.total || j.total < j.loaded) j.total = j.loaded;
    return new TextDecoder().decode(buf);
  } catch (e) { jobs.delete(url); emit(); throw e; }
  finally { clearTimeout(to); j.done = true; emit(); }
}
