export async function mountUiButtons(host) {
  host.style.padding = '24px';
  host.style.overflow = 'auto';
  host.innerHTML = `
    <div class="ui-demo">
      <h3>Buttons</h3>
      <div class="ui-row">
        <button class="u-btn primary">Primary</button>
        <button class="u-btn">Secondary</button>
        <button class="u-btn ghost">Ghost</button>
        <button class="u-btn danger">Danger</button>
        <button class="u-btn primary" disabled>Disabled</button>
      </div>
      <h3>Sizes</h3>
      <div class="ui-row">
        <button class="u-btn primary sm">Small</button>
        <button class="u-btn primary">Default</button>
        <button class="u-btn primary lg">Large</button>
      </div>
      <p class="hint">纯 CSS 组件示例，无后端。</p>
    </div>`;
  return () => { host.innerHTML = ''; };
}
