#!/usr/bin/env python3
"""Merge zh/en i18n into registry.json (+ public copy, registry.ts) and build frontend/src/i18n/en.json.
Sources: scripts/i18n/titles.txt (hand names), glossary.txt (hand UI words), mt.json (offline MT cache), CC-CEDICT (short words)."""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
H = Path(__file__).resolve().parent
REG = ROOT / 'backend/data/registry.json'
PUB = ROOT / 'frontend/public/registry.json'
TS = ROOT / 'frontend/src/registry.ts'
OUT = ROOT / 'frontend/src/i18n/en.json'
ZH = re.compile(r'[\u3400-\u9fff]')

mt = json.loads((H / 'mt.json').read_text())
gloss = {}
for l in (H / 'glossary.txt').read_text().splitlines():
    if '=' in l: k, v = l.split('=', 1); gloss[k.strip()] = v.strip()
ced = {}
cp = Path('/tmp/cedict_ts.u8')
if cp.exists():
    for l in cp.read_text().splitlines():
        if l.startswith('#'): continue
        m = re.match(r'(\S+) (\S+) \[[^\]]*\] /(.*)/', l)
        if not m: continue
        w = m[2]
        if w in ced: continue
        g = [x for x in m[3].split('/') if not x.startswith(('CL:', 'variant of', 'old variant', 'surname', 'see ', 'abbr.', 'used in'))]
        if not g: continue
        s = re.sub(r'\([^)]*\)', '', g[0]).strip()
        s = re.sub(r'^to ', '', s)
        if s and not ZH.search(s): ced[w] = s
    (H / 'cedict-short.json').write_text(json.dumps({k: v for k, v in ced.items() if len(k) <= 3}, ensure_ascii=False))
else:
    ced = json.loads((H / 'cedict-short.json').read_text())

def cap(s): return s[:1].upper() + s[1:] if s else s
def clean_mt(zh, en):
    if not en or ZH.search(en): return None
    if len(en) > 8 * len(zh) + 24: return None
    if re.search(r'(\b\w+\b)(?:\W+\1\b){3,}', en): return None
    if not re.search(r'[。.!！?？]$', zh): en = en.rstrip('.')
    return en.strip()

def word(zh):
    if zh in gloss: return gloss[zh]
    if len(zh) <= 2 and zh in ced: return cap(ced[zh])
    m = clean_mt(zh, mt.get(zh, ''))
    if m: return m if len(zh) > 6 else cap(m)
    if zh in ced: return cap(ced[zh])
    return None

def runwise(s):
    def rep(m):
        e = d.get(m.group())
        if e is None: return m.group()
        a, b = m.start(), m.end()
        pre = ' ' if a > 0 and re.match(r'[A-Za-z0-9)]', s[a-1]) else ''
        post = ' ' if b < len(s) and re.match(r'[A-Za-z0-9(]', s[b]) else ''
        return pre + e + post
    return re.sub(r'[\u3400-\u9fff][\u3400-\u9fff\u3000-\u303f\uff01-\uff5e·]*', rep, s)

reg = json.loads(REG.read_text())
titles = {}; cur = None
for l in (H / 'titles.txt').read_text().splitlines():
    if not l.strip(): continue
    if l.startswith('@'):
        p = l[1:].split('|'); cur = p[0]; titles[cur] = {'_': p[1:]}
    else:
        p = l.split('|'); titles[cur][p[0]] = p[1:]

SEP = re.compile(r'(\s*[·/｜|、]\s*)')
def compose(k):
    parts = SEP.split(k)
    if len(parts) < 3: return None
    out = []
    for p in parts:
        if SEP.fullmatch(p) or not ZH.search(p): out.append(' · ' if '·' in p else (' / ' if '/' in p else (', ' if '、' in p else p))); continue
        w = word(p.strip())
        if w is None: return None
        out.append(w)
    return ''.join(out)
keep = set(json.loads((H / 'keys.json').read_text())) if (H / 'keys.json').exists() else set(mt)
d = {}
for k in mt:
    if k not in keep: continue
    w = compose(k) or word(k)
    if w is None: continue
    # MT often mangles maths: keep whole-string entry only if symbols/digits/latin tokens survive
    toks = re.findall(r'[0-9]+|[²³√π±×÷=θφμσΣ∫→≈≤≥ⁿ₀₁₂]', k)
    if toks and any(t not in w for t in toks) and k not in gloss: continue
    d[k] = w
for k, v in gloss.items(): d[k] = v
miss = []
for c in reg['categories']:
    t = titles[c['key']]
    zhn, enn, zhi, eni = (t['_'] + ['', '', '', ''])[:4]
    if zhn and zhn != c['name']:
        d[c['name']] = enn; c['name'] = zhn
    if zhi: c['intro'] = zhi
    c['name_en'] = enn; d[c['name']] = enn
    c['intro_en'] = eni or d.get(c['intro']) or ''
    if eni: d[c['intro']] = eni
    for x in c['demos']:
        zt, et = t[x['slug']]
        if zt and zt != x['title']: d[x['title']] = et; x['title'] = zt
        x['title_en'] = et; d[x['title']] = et
        for f in ('hint', 'desc'):
            s = x[f]
            x[f + '_en'] = s if not ZH.search(s) else (d.get(s) or runwise(s))
            if not x[f + '_en'] and ZH.search(s): miss.append(s)
reg['totalDemos'] = sum(len(c['demos']) for c in reg['categories'])
REG.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + '\n')
PUB.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + '\n')

# frontend overlay consumed by registry.ts (registry.ts itself carries variant/presets not in JSON)
ov = {'cats': {}, 'demos': {}}
for c in reg['categories']:
    ov['cats'][c['key']] = {'name': c['name'], 'name_en': c['name_en'], 'intro': c['intro'], 'intro_en': c['intro_en']}
    for x in c['demos']:
        ov['demos'][f"/{c['key']}/{x['slug']}"] = {'title': x['title'], 'title_en': x['title_en'], 'hint_en': x['hint_en'], 'desc_en': x['desc_en']}
(ROOT / 'frontend/src/i18n').mkdir(parents=True, exist_ok=True)
(ROOT / 'frontend/src/i18n/registry-i18n.json').write_text(json.dumps(ov, ensure_ascii=False, separators=(',', ':')))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
print('dict', len(d), 'bytes', OUT.stat().st_size, 'missing hint/desc', len(miss), miss[:5])
