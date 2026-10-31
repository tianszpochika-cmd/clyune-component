export async function mountChartBar(host) {
  const canvas = document.createElement('canvas');
  host.style.padding = '16px';
  host.appendChild(canvas);
  const { Chart } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.6/auto/+esm');
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['电信','联通','移动','海外'],
      datasets: [{
        label: 'Latency ms',
        data: [48, 62, 55, 180],
        backgroundColor: ['#818cf8','#22d3ee','#34d399','#fbbf24'],
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#c7d2fe' } } },
      scales: {
        x: { ticks: { color: '#93a0c0' }, grid: { display: false } },
        y: { ticks: { color: '#93a0c0' }, grid: { color: '#24314f' } },
      },
    },
  });
  return () => { chart.destroy(); host.innerHTML = ''; };
}
