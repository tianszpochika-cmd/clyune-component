export async function mountChartLine(host) {
  const canvas = document.createElement('canvas');
  host.style.padding = '16px';
  host.appendChild(canvas);
  const { Chart } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.6/auto/+esm');
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets: [{
        label: 'Visits',
        data: [120, 190, 150, 220, 280, 240, 310],
        borderColor: '#818cf8',
        backgroundColor: 'rgba(129,140,248,.2)',
        fill: true, tension: 0.35,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#c7d2fe' } } },
      scales: {
        x: { ticks: { color: '#93a0c0' }, grid: { color: '#24314f' } },
        y: { ticks: { color: '#93a0c0' }, grid: { color: '#24314f' } },
      },
    },
  });
  return () => { chart.destroy(); host.innerHTML = ''; };
}
