// Shared category definitions.
// The classifier (ResNet50) outputs one of 9 labels. Each label maps to a web-app
// category (shown in the dashboard) and to a physical sorter compartment (1-5).

export const WEB_CATEGORIES = [
  'phones', 'laptops', 'tablets', 'batteries', 'chargers', 'cables',
  'monitors', 'keyboards', 'other',
  // added for the sorter's classes
  'headphones', 'mouse', 'pcbs', 'printers', 'remote_controls', 'smartwatches',
];

export const LABEL_TO_CATEGORY = {
  'Battery': 'batteries',
  'Headphones': 'headphones',
  'Keyboard': 'keyboards',
  'Mobile': 'phones',
  'Mouse': 'mouse',
  'PCBs': 'pcbs',
  'Printer': 'printers',
  'Remote Control': 'remote_controls',
  'Smartwatch': 'smartwatches',
};

// Same mapping as the sorter hardware (stepper position).
export const LABEL_TO_COMPARTMENT = {
  'Smartwatch': 1, 'Mobile': 1, 'Mouse': 1,
  'Headphones': 2, 'Remote Control': 2,
  'Battery': 3,
  'PCBs': 4,
  'Keyboard': 5, 'Printer': 5,
};

export function categoryForLabel(label) {
  return LABEL_TO_CATEGORY[label] || 'other';
}
