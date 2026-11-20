import express from 'express';
import Event from '../models/Event.js';
import Bin from '../models/Bin.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get only the logged-in user's events
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const events = await Event.find({ user: req.user.id })
      .populate('bin')
      .sort({ timestamp: -1 });

    return res.status(200).json(events);
  } catch (err) {
    console.error('Error fetching user events:', err);
    return res.status(500).json({
      error: 'failed_to_fetch_user_events'
    });
  }
});

// Get all events (Admin / Collector dashboard)
router.get('/', async (req, res) => {
  try {
    const events = await Event.find()
      .populate('user bin')
      .sort({ timestamp: -1 });

    return res.status(200).json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    return res.status(500).json({
      error: 'failed_to_fetch_events'
    });
  }
});

// Create event and automatically update shared bin
router.post('/', requireAuth, async (req, res) => {
  try {
    const eventData = { ...req.body };

    // Never trust user ID supplied by frontend
    delete eventData.user;

    // Associate deposits with authenticated user
    if (eventData.type === 'deposit') {
      eventData.user = req.user.id;
    }

    let updatedBin = null;

    if (['deposit', 'collection'].includes(eventData.type) && eventData.bin) {
      const bin = await Bin.findById(eventData.bin);

      if (!bin) {
        return res.status(404).json({
          error: 'Bin not found'
        });
      }

      if (eventData.type === 'deposit') {
        const weight = Number(eventData.amount);

        if (!Number.isFinite(weight) || weight <= 0) {
          return res.status(400).json({
            error: 'Invalid deposit weight'
          });
        }

        // Shared bin weight: combines deposits from all users
        bin.currentWeight = (bin.currentWeight || 0) + weight;

        const capacity = bin.capacity || 100;

        bin.level = Math.min(
          100,
          Math.round((bin.currentWeight / capacity) * 100)
        );

        bin.status = bin.currentWeight >= capacity
          ? 'full'
          : 'available';
      }

      if (eventData.type === 'collection') {
        bin.currentWeight = 0;
        bin.level = 0;
        bin.status = 'available';
        bin.lastCollected = new Date();
      }

      bin.lastUpdated = new Date();

      updatedBin = await bin.save();
    }

    // Save event
    const event = new Event(eventData);
    await event.save();

    // Socket.IO live updates
    const io = req.app.get('io');

    if (io) {
      io.emit('new-event', event);

      if (updatedBin) {
        io.emit('binStatusUpdate', updatedBin);
      }
    }

    console.log('Event created:', event.type);

    if (eventData.user) {
      console.log('Associated user:', eventData.user);
    }

    if (updatedBin) {
      console.log('Bin automatically updated:', updatedBin.location);
    }

    return res.status(201).json(event);

  } catch (err) {
    console.error('Error creating event:', err);

    return res.status(500).json({
      error: 'failed_to_create_event'
    });
  }
});

export default router;