import { getStats } from './api.js';
import { renderBarChart } from './chart.js';
getStats().then(stats => {
  if (!stats) {
    document.getElementById('stats').innerHTML = '<p class="muted">No stats found.</p>';
    return;
  }
  document.getElementById('stats').innerHTML = `
    <div class="kpi-grid">
      <div class="kpi slide-in-up"><div class="k">Total e-waste collected</div><div class="v">${stats.totalEwaste || 0} <small>kg</small></div></div>
      <div class="kpi slide-in-up" style="animation-delay:.06s"><div class="k">Bins in network</div><div class="v">${stats.totalBins || 0}</div></div>
      <div class="kpi slide-in-up" style="animation-delay:.12s"><div class="k">Registered users</div><div class="v">${stats.totalUsers || 0}</div></div>
      <div class="kpi slide-in-up" style="animation-delay:.18s"><div class="k">CO₂ saved</div><div class="v">${stats.co2Saved || 0} <small>kg</small></div></div>
    </div>
  `;
  // Render chart
  const ctx = document.getElementById('statsChart').getContext('2d');
  renderBarChart(ctx,
    ['E-Waste', 'Bins', 'Users', 'CO₂ Saved'],
    [stats.totalEwaste || 0, stats.totalBins || 0, stats.totalUsers || 0, stats.co2Saved || 0],
    'Impact Stats'
  );
});