/** Static analysis of demo modules (TypeScript compiler API, JS mode): imports, top-level decls, per-demo code blocks. */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('../../', import.meta.url).pathname); // frontend/
export const SRC = path.join(ROOT, 'src');
const cache = new Map();

export function resolveLocal(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const c of [base, base + '.js', base + '.ts', base + '.tsx', path.join(base, 'index.ts')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}

export function load(file) {
  if (cache.has(file)) return cache.get(file);
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const imports = [], decls = new Map(), exportsFrom = [];
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const from = st.moduleSpecifier.text; const names = [];
      const cl = st.importClause;
      if (cl?.name) names.push({ name: cl.name.text, imported: 'default' });
      if (cl?.namedBindings) {
        if (ts.isNamespaceImport(cl.namedBindings)) names.push({ name: cl.namedBindings.name.text, imported: '*' });
        else for (const e of cl.namedBindings.elements) names.push({ name: e.name.text, imported: (e.propertyName || e.name).text });
      }
      imports.push({ from, names, file: resolveLocal(file, from) });
      continue;
    }
    if (ts.isExportDeclaration(st)) {
      if (st.moduleSpecifier) exportsFrom.push(st.moduleSpecifier.text);
      continue;
    }
    const doc = jsdoc(st, text);
    const add = (name, node) => decls.set(name, { name, start: node.getStart(sf), end: node.end, line0: lineOf(node.getStart(sf)), line1: lineOf(node.end), doc, exported: !!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword), node: st });
    if (ts.isFunctionDeclaration(st) && st.name) add(st.name.text, st);
    else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) { if (ts.isIdentifier(d.name)) add(d.name.text, st); }
    else if (ts.isClassDeclaration(st) && st.name) add(st.name.text, st);
  }
  const m = { file, rel: path.relative(path.dirname(ROOT), file), text, sf, imports, decls, exportsFrom, lineOf };
  cache.set(file, m);
  return m;
}

/** leading /** … *\/ or // comment of a statement, first sentence */
function jsdoc(node, text) {
  const rs = ts.getLeadingCommentRanges(text, node.pos) || [];
  if (!rs.length) return '';
  const r = rs[rs.length - 1];
  let c = text.slice(r.pos, r.end);
  c = c.replace(/^\/\*\*?|\*\/$/g, '').replace(/^\s*\*\s?/gm, '').replace(/^\/\/\s?/gm, '').trim();
  return c.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
}

/** transitive local module graph */
export function graph(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const m = load(file);
  for (const im of m.imports) if (im.file) graph(im.file, seen);
  for (const ex of m.exportsFrom) { const f = resolveLocal(file, ex); if (f) graph(f, seen); }
  return seen;
}
export function externals(files) {
  const out = new Map();
  for (const f of files) for (const im of load(f).imports) if (!im.file) { const e = out.get(im.from) || new Set(); im.names.forEach((n) => e.add(n.imported)); out.set(im.from, e); }
  return out;
}

const strOf = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : n && ts.isIdentifier(n) ? n.text : null);

/** families defined in a kit module (FAMILIES list or FAM keys) */
export function families(m) {
  const fam = new Set();
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'FAMILIES' && n.initializer && ts.isArrayLiteralExpression(n.initializer))
      n.initializer.elements.forEach((e) => { const s = strOf(e); if (s) fam.add(s); });
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const k = famKey(n.left); if (k) fam.add(k);
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'FAM' && n.initializer && ts.isObjectLiteralExpression(n.initializer))
      n.initializer.properties.forEach((p) => { const s = p.name && strOf(p.name); if (s) fam.add(s); });
    ts.forEachChild(n, visit);
  };
  visit(m.sf);
  return fam;
}
function famKey(left) {
  if (ts.isPropertyAccessExpression(left) && ts.isIdentifier(left.expression) && left.expression.text === 'FAM') return left.name.text;
  if (ts.isElementAccessExpression(left) && ts.isIdentifier(left.expression) && left.expression.text === 'FAM') return strOf(left.argumentExpression);
  return null;
}
const TABLES = /^(FAM|FAMILY_CONTROLS|PRESET_DEFAULTS|TITLES|[A-Z_]*DOCS)$/;
const FAMVARS = new Set(['family', 'fam']);
function condMentions(cond, key) {
  let hit = false;
  const visit = (n) => {
    if (hit) return;
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(n.operatorToken.kind)) {
      const a = strOf(n.right), b = strOf(n.left);
      if ((a === key && ts.isIdentifier(n.left) && FAMVARS.has(n.left.text)) || (b === key && ts.isIdentifier(n.right) && FAMVARS.has(n.right.text))) hit = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(cond);
  return hit;
}
function enclosingName(n) {
  for (let p = n.parent; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText();
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) return p.parent.name.text;
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent && ts.isPropertyAssignment(p.parent)) return p.parent.name.getText();
  }
  return '';
}

/** code blocks belonging to one family key inside module m */
export function familyBlocks(m, key) {
  const out = [];
  const push = (node, kind, extra = {}) => {
    const start = node.getStart(m.sf), end = node.end;
    if (out.some((b) => b.start <= start && b.end >= end)) return;
    for (let i = out.length - 1; i >= 0; i--) if (start <= out[i].start && end >= out[i].end) out.splice(i, 1);
    out.push({ kind, start, end, node, file: m.file, ...extra });
  };
  const visit = (n) => {
    if (ts.isExpressionStatement(n) && ts.isBinaryExpression(n.expression) && n.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && famKey(n.expression.left) === key) { push(n, 'def'); return; }
    if (ts.isPropertyAssignment(n) && strOf(n.name) === key && ts.isObjectLiteralExpression(n.parent)) {
      const owner = n.parent.parent;
      const ownerName = owner && ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name) ? owner.name.text : (owner && ts.isPropertyAssignment(owner) ? strOf(owner.name) : '');
      const top = owner && ts.isVariableDeclaration(owner) && owner.parent?.parent && ts.isVariableStatement(owner.parent.parent) && owner.parent.parent.parent === m.sf;
      if (ownerName && top && TABLES.test(ownerName)) { push(n, ownerName === 'FAM' ? 'def' : 'table', { owner: ownerName }); return; }
    }
    if (ts.isIfStatement(n) && condMentions(n.expression, key)) { push(ts.factory ? n : n, 'branch', { fn: enclosingName(n), thenOnly: true }); }
    if (ts.isCaseClause(n) && strOf(n.expression) === key && ts.isIdentifier(n.parent.parent.expression) && FAMVARS.has(n.parent.parent.expression.text)) { push(n, 'case', { fn: enclosingName(n) }); return; }
    ts.forEachChild(n, visit);
  };
  visit(m.sf);
  // an if-chain: only keep the `if (cond) {then}` part, not the trailing else-branches
  for (const b of out) if (b.kind === 'branch') b.end = b.node.thenStatement.end;
  return out.sort((a, b) => a.start - b.start);
}

/** identifiers referenced inside [start,end) */
export function idents(m, start, end) {
  const s = new Set();
  const visit = (n) => {
    if (n.end < start || n.pos > end) return;
    if (ts.isIdentifier(n) && n.getStart(m.sf) >= start && n.end <= end) {
      const p = n.parent;
      if (!(p && ts.isPropertyAccessExpression(p) && p.name === n) && !(p && ts.isPropertyAssignment(p) && p.name === n)) s.add(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(m.sf);
  return s;
}
/** member accesses like OBJ.name( … or OBJ.name inside range, by object identifier */
export function members(m, start, end, objs) {
  const out = new Map();
  const visit = (n) => {
    if (n.end < start || n.pos > end) return;
    if (ts.isPropertyAccessExpression(n) && n.getStart(m.sf) >= start && n.end <= end) {
      const o = n.expression;
      const on = ts.isIdentifier(o) ? o.text : ts.isPropertyAccessExpression(o) && ts.isIdentifier(o.expression) ? `${o.expression.text}.${o.name.text}` : null;
      if (on && objs.has(on.split('.')[0])) {
        const call = ts.isCallExpression(n.parent) && n.parent.expression === n;
        const isNew = ts.isNewExpression(n.parent) && n.parent.expression === n;
        const k = `${on}.${n.name.text}`;
        const e = out.get(k) || { obj: on, name: n.name.text, call: false, isNew: false, n: 0 };
        e.call ||= call; e.isNew ||= isNew; e.n++; out.set(k, e);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(m.sf);
  return out;
}
export { ts };
