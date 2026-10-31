export async function mountChartDoughnut(host) {
  const canvas = document.createElement('canvas');
  host.style.padding = '16px';
  host.appendChild(canvas);
  const { Chart } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.6/auto/+esm');
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['CPU','Mem','Disk','Idle'],
      datasets: [{
        data: [22, 38, 15, 25],
        backgroundColor: ['#818cf8','#22d3ee','#f472b6','#334155'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#c7d2fe' } } },
    },
  });
  return () => { chart.destroy(); host.innerHTML = ''; };
}
