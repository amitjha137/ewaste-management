import express from 'express';
import Event from '../models/Event.js';
import Bin from '../models/Bin.js';

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

// Create event and automatically update bin
router.post('/', async (req, res) => {
  try {
    const eventData = req.body;

    let updatedBin = null;

    // Update bin only for deposit and collection events
    if (
      ['deposit', 'collection'].includes(eventData.type) &&
      eventData.bin
    ) {
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

        // Add deposited weight
        bin.currentWeight = (bin.currentWeight || 0) + weight;

        // Calculate bin fill percentage
        const capacity = bin.capacity || 100;

        bin.level = Math.min(
          100,
          Math.round((bin.currentWeight / capacity) * 100)
        );

        // Update status
        bin.status =
          bin.currentWeight >= capacity ? 'full' : 'available';
      }

      if (eventData.type === 'collection') {
        // Reset bin after collector collects the waste
        bin.currentWeight = 0;
        bin.level = 0;
        bin.status = 'available';
        bin.lastCollected = new Date();
      }

      bin.lastUpdated = new Date();

      updatedBin = await bin.save();
    }

    // Save event in history
    const event = new Event(eventData);
    await event.save();

    // Send live updates
    const io = req.app.get('io');

    if (io) {
      io.emit('new-event', event);

      if (updatedBin) {
        io.emit('binStatusUpdate', updatedBin);
      }
    }

    console.log('Event created:', event.type);

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