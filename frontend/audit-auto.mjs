/** Enable 「自动演示」 in Playwright so gates still see pointer-driven motion. Works on BrowserContext or Page.
 *  Also pins UI language: AUDIT_LANG=zh (default) | en. */
export async function enableAutoDemo(target) {
  const lang = process.env.AUDIT_LANG || 'zh';
  await target.addInitScript((l) => { try { localStorage.setItem('cc-auto-demo', '1'); localStorage.setItem('cc-lang', l); } catch (_) { /* ignore */ } }, lang);
}
