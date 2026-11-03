/** Enable 「自动演示」 in Playwright so gates still see pointer-driven motion. Works on BrowserContext or Page. */
export async function enableAutoDemo(target) {
  await target.addInitScript(() => { try { localStorage.setItem('cc-auto-demo', '1'); } catch (_) { /* ignore */ } });
}
