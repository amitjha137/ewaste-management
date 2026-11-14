// Rewards and Gamification System

// Points calculation: 10 points per kg
export function calculatePoints(amount) {
  return Math.floor(amount * 10);
}

// Level calculation based on total points
export function calculateLevel(totalPoints) {
  return Math.floor(totalPoints / 100) + 1;
}

// Badge definitions
export const BADGES = {
  FIRST_DEPOSIT: {
    name: 'First Step',
    icon: '🌱',
    description: 'Made your first deposit',
    requirement: (stats) => stats.totalDeposits >= 1
  },
  ECO_WARRIOR: {
    name: 'Eco Warrior',
    icon: '🌍',
    description: 'Deposited 10kg of e-waste',
    requirement: (stats) => stats.totalWeight >= 10
  },
  TECH_RECYCLER: {
    name: 'Tech Recycler',
    icon: '💻',
    description: 'Made 10 deposits',
    requirement: (stats) => stats.totalDeposits >= 10
  },
  GREEN_CHAMPION: {
    name: 'Green Champion',
    icon: '🏆',
    description: 'Deposited 50kg of e-waste',
    requirement: (stats) => stats.totalWeight >= 50
  },
  PLANET_SAVER: {
    name: 'Planet Saver',
    icon: '🌟',
    description: 'Deposited 100kg of e-waste',
    requirement: (stats) => stats.totalWeight >= 100
  },
  CONSISTENCY_KING: {
    name: 'Consistency King',
    icon: '📅',
    description: 'Made deposits for 7 consecutive days',
    requirement: (stats) => stats.consecutiveDays >= 7
  },
  CATEGORY_MASTER: {
    name: 'Category Master',
    icon: '🎯',
    description: 'Deposited all types of e-waste',
    requirement: (stats) => stats.uniqueCategories >= 8
  }
};

// Check which badges user has earned
export function getEarnedBadges(userStats) {
  const earned = [];
  for (const [key, badge] of Object.entries(BADGES)) {
    if (badge.requirement(userStats)) {
      earned.push({ ...badge, key });
    }
  }
  return earned;
}

// Get next badge to earn
export function getNextBadge(userStats) {
  for (const [key, badge] of Object.entries(BADGES)) {
    if (!badge.requirement(userStats)) {
      return { ...badge, key };
    }
  }
  return null;
}

// E-waste category definitions with icons
export const EWASTE_CATEGORIES = {
  phones: { name: 'Phones', icon: '📱', points: 10 },
  laptops: { name: 'Laptops', icon: '💻', points: 15 },
  tablets: { name: 'Tablets', icon: '📲', points: 12 },
  batteries: { name: 'Batteries', icon: '🔋', points: 8 },
  chargers: { name: 'Chargers', icon: '🔌', points: 5 },
  cables: { name: 'Cables', icon: '🔗', points: 3 },
  monitors: { name: 'Monitors', icon: '🖥️', points: 18 },
  keyboards: { name: 'Keyboards', icon: '⌨️', points: 7 },
  other: { name: 'Other', icon: '📦', points: 10 },
  // classes recognised by the sorter
  headphones: { name: 'Headphones', icon: '🎧', points: 6 },
  mouse: { name: 'Mouse', icon: '🖱️', points: 4 },
  pcbs: { name: 'PCBs', icon: '🧩', points: 12 },
  printers: { name: 'Printers', icon: '🖨️', points: 20 },
  remote_controls: { name: 'Remote controls', icon: '📺', points: 4 },
  smartwatches: { name: 'Smartwatches', icon: '⌚', points: 8 }
};

// Calculate environmental impact
export function calculateImpact(totalWeight) {
  // Average values based on e-waste recycling studies
  return {
    co2Saved: (totalWeight * 2.5).toFixed(2), // 2.5 kg CO2 per kg e-waste
    waterSaved: (totalWeight * 15).toFixed(0), // 15 liters per kg
    energySaved: (totalWeight * 5).toFixed(1), // 5 kWh per kg
    treesEquivalent: (totalWeight * 0.05).toFixed(1) // Trees planted equivalent
  };
}

// Get user statistics from events
export function getUserStats(events) {
  const deposits = events.filter(e => e.type === 'deposit');
  const totalWeight = deposits.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalDeposits = deposits.length;
  const totalPoints = calculatePoints(totalWeight);
  const level = calculateLevel(totalPoints);
  
  // Count unique categories
  const uniqueCategories = new Set(deposits.map(e => e.category || 'other')).size;
  
  // Calculate category breakdown
  const categoryBreakdown = {};
  deposits.forEach(e => {
    const cat = e.category || 'other';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (e.amount || 0);
  });
  
  return {
    totalWeight,
    totalDeposits,
    totalPoints,
    level,
    uniqueCategories,
    categoryBreakdown,
    consecutiveDays: 0 // TODO: Calculate from timestamps
  };
}
