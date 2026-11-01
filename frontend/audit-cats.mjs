// Shared: resolve audit job lists from registry.ts. CAT=threejs,math (default math,convert)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export function registryCats() {
  const src = fs.readFileSync(path.join(here, 'src/registry.ts'), 'utf8');
  const out = {}; let cur = null;
  for (const line of src.split('\n')) {
    const k = line.match(/^\s{4}key: '([^']+)'/); if (k) { cur = k[1]; out[cur] = []; continue; }
    const s = cur && line.match(/\{ slug: '([^']+)'/); if (s) out[cur].push(s[1]);
  }
  return out;
}
export function auditCats(fallback) {
  if (process.env.CATS) return JSON.parse(process.env.CATS);
  if (!process.env.CAT) return fallback;
  const all = registryCats(); const o = {};
  for (const c of process.env.CAT.split(',')) o[c] = all[c] || [];
  return o;
}
