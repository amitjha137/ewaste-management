import express from 'express';
import mongoose from 'mongoose';
import Bin from '../models/Bin.js';
import Event from '../models/Event.js';
import { isTokenAllowed } from '../utils/deviceAuth.js';
import { categoryForLabel, LABEL_TO_COMPARTMENT } from '../utils/categories.js';

const router = express.Router();

// How many items fill a bin to 100% (there is no fill sensor, so level is estimated by count).
const ITEMS_PER_BIN_FULL = Number(process.env.ITEMS_PER_BIN_FULL || 50);
// Estimated weight of one sorted item in kg (used for dashboard statistics).
const DEFAULT_ITEM_WEIGHT_KG = Number(process.env.DEFAULT_ITEM_WEIGHT_KG || 0.2);
const POINTS_PER_KG = 10; // same as frontend calculatePoints()

function deviceTokenFromReq(req) {
  return req.headers['x-device-token'] || (req.body && req.body.token) || '';
}

// POST /api/sorter/result
// Called by the laptop sorter after it has sorted one item.
// Body: { label, confidence, compartment?, binId?, weightKg?, deviceName? }
router.post('/result', async (req, res) => {
  if (!isTokenAllowed(deviceTokenFromReq(req))) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  const body = req.body || {};
  const label = String(body.label || '').trim();
  const confidence = Number(body.confidence);
  if (!label) return res.status(400).json({ error: 'label_required' });
  // measured=true: the bin level comes from the ToF sensor (POST /level), so do not estimate it by counting
  const measured = body.measured === true;

  const category = categoryForLabel(label);
  const compartment = Number(body.compartment) || LABEL_TO_COMPARTMENT[label] || null;
  const weightKg = Number(body.weightKg) > 0 ? Number(body.weightKg) : DEFAULT_ITEM_WEIGHT_KG;
  const pointsEarned = Math.floor(weightKg * POINTS_PER_KG);
  const io = req.app.get('io');

  const summary = {
    label,
    confidence: Number.isFinite(confidence) ? confidence : null,
    category,
    compartment,
    deviceName: body.deviceName || null,
    ts: Date.now(),
  };

  // Live update for open dashboards, even when the database is down.
  if (mongoose.connection.readyState !== 1) {
    if (io) io.emit('sortResult', { ...summary, recorded: false });
    return res.status(202).json({ recorded: false, reason: 'database_unavailable', ...summary });
  }

  try {
    const binId = body.binId || process.env.SORTER_BIN_ID || null;
    let bin = null;
    if (binId && mongoose.isValidObjectId(binId)) bin = await Bin.findById(binId);

    const event = await Event.create({
      type: 'deposit',
      bin: bin ? bin._id : undefined,
      amount: weightKg,
      category,
      pointsEarned,
      source: 'sorter',
      label,
      confidence: summary.confidence ?? undefined,
      compartment: compartment ?? undefined,
      details: `Auto-sorted by ${summary.deviceName || 'sorter'}: ${label} -> compartment ${compartment ?? '?'}`,
    });

    if (bin) {
      if (!measured) {
        const step = 100 / Math.max(1, ITEMS_PER_BIN_FULL);
        bin.level = Math.min(100, Math.round(((bin.level || 0) + step) * 10) / 10);
        if (bin.level >= 90) bin.status = 'full';
      }
      bin.currentWeight = (bin.currentWeight || 0) + weightKg;
      bin.lastUpdated = new Date();
      await bin.save();
      if (io) io.emit('binStatusUpdate', bin);
    }

    if (io) io.emit('sortResult', { ...summary, recorded: true, eventId: event._id });
    return res.status(201).json({ recorded: true, eventId: event._id, ...summary });
  } catch (err) {
    console.error('sorter result failed', err);
    if (io) io.emit('sortResult', { ...summary, recorded: false });
    return res.status(500).json({ error: 'failed_to_record', details: String(err.message || err) });
  }
});

// POST /api/sorter/level
// Measured fill level of a bin (from the ToF sensor). Body: { level: 0-100, binId?, deviceName? }
const FULL_ON = Number(process.env.FULL_LEVEL || 85);
const FULL_OFF = Number(process.env.FULL_LEVEL_CLEAR || 70);

router.post('/level', async (req, res) => {
  if (!isTokenAllowed(deviceTokenFromReq(req))) return res.status(401).json({ error: 'invalid_token' });
  const body = req.body || {};
  const level = Number(body.level);
  if (!Number.isFinite(level) || level < 0 || level > 100) return res.status(400).json({ error: 'level_0_to_100_required' });
  const io = req.app.get('io');
  const binId = body.binId || process.env.SORTER_BIN_ID || null;

  if (mongoose.connection.readyState !== 1) {
    if (io) io.emit('binLevel', { binId, level, recorded: false });
    return res.status(202).json({ recorded: false, reason: 'database_unavailable', level });
  }
  try {
    if (!binId || !mongoose.isValidObjectId(binId)) return res.status(400).json({ error: 'binId_required', hint: 'send binId or set SORTER_BIN_ID' });
    const bin = await Bin.findById(binId);
    if (!bin) return res.status(404).json({ error: 'bin_not_found' });
    bin.level = Math.round(level * 10) / 10;
    // hysteresis so the status does not flicker around the threshold
    if (bin.level >= FULL_ON) bin.status = 'full';
    else if (bin.status === 'full' && bin.level < FULL_OFF) bin.status = 'available';
    bin.lastUpdated = new Date();
    await bin.save();
    if (io) { io.emit('binStatusUpdate', bin); io.emit('binLevel', { binId, level: bin.level, status: bin.status, recorded: true }); }
    return res.json({ recorded: true, level: bin.level, status: bin.status });
  } catch (err) {
    console.error('sorter level failed', err);
    return res.status(500).json({ error: 'failed_to_record', details: String(err.message || err) });
  }
});

export default router;
