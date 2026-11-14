// Dashboard Charts and Visualizations
import { EWASTE_CATEGORIES } from './rewards.js';

// Shared look for every chart (colours match style.css tokens)
const GRID = '#e1dccd';
const TICK = '#7b877e';
function themeCharts() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
  Chart.defaults.color = '#45564b';
}

// Create deposits over time chart
export function createDepositsChart(canvasId, events) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  // Group deposits by date
  const depositsByDate = {};
  events.filter(e => e.type === 'deposit').forEach(e => {
    const date = new Date(e.timestamp).toLocaleDateString();
    depositsByDate[date] = (depositsByDate[date] || 0) + (e.amount || 0);
  });
  
  const dates = Object.keys(depositsByDate).sort();
  const amounts = dates.map(date => depositsByDate[date]);
  
  themeCharts();
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'E-Waste Deposited (kg)',
        data: amounts,
        borderColor: '#1f7a4d',
        backgroundColor: 'rgba(201, 242, 107, 0.35)',
        borderWidth: 2.5,
        pointBackgroundColor: '#0d2218',
        pointRadius: 3,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: TICK } },
        y: {
          beginAtZero: true,
          grid: { color: GRID },
          ticks: { color: TICK },
          title: {
            display: true,
            text: 'Weight (kg)'
          }
        }
      }
    }
  });
}

// Create category breakdown pie chart
export function createCategoryChart(canvasId, categoryBreakdown) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  const categories = Object.keys(categoryBreakdown);
  const amounts = Object.values(categoryBreakdown);
  
  const colors = [
    '#0d2218', '#1f7a4d', '#c9f26b', '#2c6fbb', '#e9a31b',
    '#7bb87f', '#a9d443', '#d2473b', '#7b877e'
  ];
  
  themeCharts();
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map(cat => EWASTE_CATEGORIES[cat]?.name || cat),
      datasets: [{
        data: amounts,
        backgroundColor: colors.slice(0, categories.length),
        borderWidth: 3,
        borderColor: '#fffefa'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value}kg (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Create impact comparison chart
export function createImpactChart(canvasId, impact) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  themeCharts();
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['CO₂ Saved', 'Water Saved', 'Energy Saved', 'Trees Equiv.'],
      datasets: [{
        label: 'Environmental Impact',
        data: [
          parseFloat(impact.co2Saved),
          parseFloat(impact.waterSaved) / 10, // Scale down for visibility
          parseFloat(impact.energySaved),
          parseFloat(impact.treesEquivalent) * 10 // Scale up for visibility
        ],
        backgroundColor: ['#1f7a4d', '#2c6fbb', '#e9a31b', '#a9d443'],
        borderRadius: 8,
        maxBarThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label;
              const value = context.parsed.y;
              if (label === 'Water Saved') return `${(value * 10).toFixed(0)} liters`;
              if (label === 'Trees Equiv.') return `${(value / 10).toFixed(1)} trees`;
              if (label === 'CO₂ Saved') return `${value.toFixed(2)} kg`;
              if (label === 'Energy Saved') return `${value.toFixed(1)} kWh`;
              return `${value}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: TICK } },
        y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: TICK } }
      }
    }
  });
}

// Create progress ring (circular progress bar)
export function createProgressRing(percentage, size = 120) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  return `
    <div class="progress-ring">
      <svg width="${size}" height="${size}">
        <circle class="bg" cx="${size/2}" cy="${size/2}" r="${radius}"/>
        <circle class="progress" cx="${size/2}" cy="${size/2}" r="${radius}"
                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}"/>
      </svg>
      <div class="progress-ring-text">
        ${percentage}%
      </div>
    </div>
  `;
}

// Collections over time chart for Collector
export function createCollectionsChart(canvasId, events) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const collectionsByDate = {};
  events.filter(e => e.type === 'collection').forEach(e => {
    const date = new Date(e.timestamp).toLocaleDateString();
    collectionsByDate[date] = (collectionsByDate[date] || 0) + (e.amount || 0);
  });

  const dates = Object.keys(collectionsByDate).sort();
  const amounts = dates.map(date => collectionsByDate[date]);

  themeCharts();
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{
        label: 'Collections (kg)',
        data: amounts,
        backgroundColor: '#1f7a4d',
        borderRadius: 8,
        maxBarThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: TICK } },
        y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: TICK }, title: { display: true, text: 'kg' } }
      }
    }
  });
}
