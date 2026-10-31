// CDN loader with China-friendly fallback (jsDelivr -> npmmirror -> unpkg)
const cache = new Map();

export function cdn(pkg, ver, file) {
  return [
    `https://cdn.jsdelivr.net/npm/${pkg}@${ver}/${file}`,
    `https://registry.npmmirror.com/${pkg}/${ver}/files/${file}`,
    `https://unpkg.com/${pkg}@${ver}/${file}`,
  ];
}

function inject(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error('load failed ' + url)); };
    document.head.appendChild(s);
  });
}

// Load a UMD script once; `globalName` is checked to skip reloading.
export function loadScript(urls, globalName) {
  const key = urls[0];
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    let lastErr;
    for (const u of urls) {
      try { await inject(u); return globalName ? window[globalName] : true; }
      catch (e) { lastErr = e; }
    }
    cache.delete(key);
    throw lastErr;
  })();
  cache.set(key, p);
  return p;
}

export const libs = {
  gsap: () => loadScript(cdn('gsap', '3.12.5', 'dist/gsap.min.js'), 'gsap'),
  scrollTrigger: async () => { await libs.gsap(); return loadScript(cdn('gsap', '3.12.5', 'dist/ScrollTrigger.min.js'), 'ScrollTrigger'); },
  matter: () => loadScript(cdn('matter-js', '0.20.0', 'build/matter.min.js'), 'Matter'),
  echarts: () => loadScript(cdn('echarts', '5.5.1', 'dist/echarts.min.js'), 'echarts'),
  d3: () => loadScript(cdn('d3', '7.9.0', 'dist/d3.min.js'), 'd3'),
  lottie: () => loadScript(cdn('lottie-web', '5.12.2', 'build/player/lottie_svg.min.js'), 'lottie'),
};
