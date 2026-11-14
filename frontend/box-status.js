import { getBins } from './api.js';
import socket from './socket.js';
const boxStatusGrid = document.getElementById('boxStatusGrid');

function renderBins(bins) {
  if (!bins || bins.length === 0) {
    boxStatusGrid.innerHTML = '<p class="muted">No bins found.</p>';
    return;
  }
  boxStatusGrid.innerHTML = bins.map(bin => `
    <div class="tile slide-in-up">
      <div class="bin-header">
        <h4 class="bin-title" style="margin:0">📍 ${bin.location}</h4>
        <span class="bin-status ${String(bin.status || '').toLowerCase()}">${bin.status}</span>
      </div>
      <div class="level-row"><span>Fill level</span><b>${bin.level}%</b></div>
      <div class="capacity-bar"><div class="capacity-fill ${bin.level >= 90 ? 'full' : bin.level >= 70 ? 'warning' : ''}" style="width:${bin.level}%"></div></div>
    </div>
  `).join('');
}

// Initial load
getBins().then(renderBins);

// Real-time update
socket.on('binStatusUpdate', (bin) => {
  // Re-fetch all bins for simplicity
  getBins().then(renderBins);
});
