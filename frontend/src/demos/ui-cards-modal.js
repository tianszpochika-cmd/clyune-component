export async function mountUiCardsModal(host) {
  host.style.padding = '24px';
  host.style.overflow = 'auto';
  host.innerHTML = `
    <div class="ui-demo">
      <div class="ui-cards">
        <article class="u-card">
          <h3>卡片 A</h3>
          <p>用于展示摘要信息的基础卡片。</p>
          <button class="u-btn primary" data-open>打开弹层</button>
        </article>
        <article class="u-card">
          <h3>卡片 B</h3>
          <p>支持标题、描述与操作区。</p>
          <button class="u-btn">次要操作</button>
        </article>
        <article class="u-card accent">
          <h3>强调卡片</h3>
          <p>带边框高亮的变体样式。</p>
        </article>
      </div>
      <div class="u-modal-backdrop" id="modal" hidden>
        <div class="u-modal" role="dialog" aria-modal="true">
          <h3>示例弹层</h3>
          <p>这是一个轻量 Modal Demo，点击遮罩或关闭按钮即可退出。</p>
          <div class="ui-row">
            <button class="u-btn primary" data-close>确认</button>
            <button class="u-btn ghost" data-close>关闭</button>
          </div>
        </div>
      </div>
    </div>`;
  const modal = host.querySelector('#modal');
  const open = () => { modal.hidden = false; };
  const close = () => { modal.hidden = true; };
  host.querySelector('[data-open]')?.addEventListener('click', open);
  host.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });
  return () => { host.innerHTML = ''; };
}
