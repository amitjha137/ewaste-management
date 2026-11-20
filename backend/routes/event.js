import express from 'express';
import Event from '../models/Event.js';

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().populate('user bin');
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    return res.json([]);
  }
});

// Create new event
router.post('/', async (req, res) => {
  try {
    const event = new Event(req.body);

    // Save event in MongoDB
    await event.save();

    // Broadcast event to connected website clients
    const io = req.app.get('io');

    if (io) {
      io.emit('new-event', event);
      console.log('Live event broadcasted:', event.category);
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