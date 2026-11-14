import mongoose from 'mongoose';
import { WEB_CATEGORIES } from '../utils/categories.js';

const binSchema = new mongoose.Schema({
  location: { type: String, required: true },
  status: { type: String, enum: ['available', 'full', 'collecting'], default: 'available' },
  level: { type: Number, default: 0 },
  capacity: { type: Number, default: 100 }, // Maximum capacity in kg
  currentWeight: { type: Number, default: 0 }, // Current weight in kg
  qrCode: { type: String, unique: true, sparse: true }, // QR code identifier (sparse: bins without a QR code do not collide)
  acceptedCategories: [{ 
    type: String, 
    enum: WEB_CATEGORIES
  }],
  lastUpdated: { type: Date, default: Date.now },
  lastCollected: { type: Date }
});

export default mongoose.model('Bin', binSchema);
