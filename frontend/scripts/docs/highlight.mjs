/** Build-time JS syntax highlighter on the TypeScript scanner → per-line HTML (no runtime dependency). */
import ts from 'typescript';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const K = ts.SyntaxKind;
const isKw = (k) => k >= K.FirstKeyword && k <= K.LastKeyword;
const exprEnd = new Set([K.Identifier, K.CloseParenToken, K.CloseBracketToken, K.CloseBraceToken, K.NumericLiteral, K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateTail, K.ThisKeyword, K.TrueKeyword, K.FalseKeyword, K.NullKeyword, K.RegularExpressionLiteral, K.PlusPlusToken, K.MinusMinusToken]);
export function highlight(code) {
  const sc = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, code);
  const out = []; let prev = K.Unknown; const tmpl = []; let depth = 0;
  const emit = (cls, txt) => { for (const [i, seg] of txt.split('\n').entries()) { if (i) out.push('\n'); if (seg) out.push(cls ? `<span class="${cls}">${esc(seg)}</span>` : esc(seg)); } };
  const toks = [];
  for (let k = sc.scan(); k !== K.EndOfFileToken; k = sc.scan()) {
    if (k === K.SlashToken || k === K.SlashEqualsToken) { if (!exprEnd.has(prev)) k = sc.reScanSlashToken(); }
    if (k === K.OpenBraceToken) depth++;
    if (k === K.CloseBraceToken) { if (tmpl.length && tmpl[tmpl.length - 1] === depth) { k = sc.reScanTemplateToken(false); if (k === K.TemplateTail) tmpl.pop(); } else depth--; }
    if (k === K.TemplateHead) tmpl.push(depth);
    toks.push([k, sc.getTokenText()]);
    if (![K.WhitespaceTrivia, K.NewLineTrivia, K.SingleLineCommentTrivia, K.MultiLineCommentTrivia].includes(k)) prev = k;
  }
  for (let i = 0; i < toks.length; i++) {
    const [k, t] = toks[i];
    let cls = '';
    if (k === K.SingleLineCommentTrivia || k === K.MultiLineCommentTrivia) cls = 'c';
    else if (k === K.StringLiteral || k === K.NoSubstitutionTemplateLiteral || k === K.TemplateHead || k === K.TemplateMiddle || k === K.TemplateTail) cls = 's';
    else if (k === K.NumericLiteral || k === K.BigIntLiteral) cls = 'n';
    else if (k === K.RegularExpressionLiteral) cls = 'r';
    else if (isKw(k)) cls = 'k';
    else if (k === K.Identifier) { let j = i + 1; while (j < toks.length && toks[j][0] === K.WhitespaceTrivia) j++; if (toks[j] && toks[j][0] === K.OpenParenToken) cls = 'f'; }
    emit(cls, t);
  }
  return out.join('').split('\n');
}
