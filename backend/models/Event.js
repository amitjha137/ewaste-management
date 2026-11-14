import mongoose from 'mongoose';
import { WEB_CATEGORIES } from '../utils/categories.js';

const eventSchema = new mongoose.Schema({
  type: { type: String, enum: ['deposit', 'collection', 'recycle'], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bin: { type: mongoose.Schema.Types.ObjectId, ref: 'Bin' },
  amount: { type: Number, default: 0 },
  category: { 
    type: String, 
    enum: WEB_CATEGORIES,
    default: 'other'
  },
  pointsEarned: { type: Number, default: 0 },
  photoUrl: { type: String },
  timestamp: { type: Date, default: Date.now },
  details: { type: String },
  // set when the event was recorded by the physical sorter
  source: { type: String, default: 'manual' },
  label: { type: String },
  confidence: { type: Number },
  compartment: { type: Number }
});

export default mongoose.model('Event', eventSchema);
