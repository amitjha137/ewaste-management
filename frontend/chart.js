// Simple chart rendering using Chart.js CDN
export function renderBarChart(ctx, labels, data, label) {
  if (window.Chart) {
    window.Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data,
          backgroundColor: ['#1f7a4d', '#2c6fbb', '#e9a31b', '#a9d443'],
          borderRadius: 8,
          maxBarThickness: 64,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, color: '#45564b' } },
          y: { beginAtZero: true, grid: { color: '#e1dccd' }, ticks: { color: '#7b877e' } }
        }
      }
    });
  }
}
