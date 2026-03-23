import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { basicAuth } from '../middleware/basicAuth.js';
import { playbackController } from '../domains/playback/controller.js';
import { getQueue } from '../domains/queue/queueService.js';
import { approve } from '../domains/media/mediaService.js';
import dbPromise from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get('/', basicAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin/index.html'));
});

// Get pending videos
router.get('/pending', basicAuth, async (req, res) => {
  try {
    const db = await dbPromise;
    const pending = await db.all("SELECT * FROM media WHERE status='pending'");
    res.json(pending);
  } catch (error) {
    console.error('Error fetching pending media:', error);
    res.status(500).json({ error: 'Failed to fetch pending media' });
  }
});

// Approve video
router.post('/approve/:id', basicAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await approve(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving media:', error);
    res.status(500).json({ error: 'Failed to approve media' });
  }
});

// Play video
router.post('/play', basicAuth, async (req, res) => {
  try {
    await playbackController.play();
    res.json({ success: true });
  } catch (error) {
    console.error('Error playing video:', error);
    res.status(500).json({ error: 'Failed to play video' });
  }
});

// Pause video
router.post('/pause', basicAuth, (req, res) => {
  try {
    playbackController.pause();
    res.json({ success: true });
  } catch (error) {
    console.error('Error pausing video:', error);
    res.status(500).json({ error: 'Failed to pause video' });
  }
});

// Skip video
router.post('/skip', basicAuth, async (req, res) => {
  try {
    await playbackController.next();
    res.json({ success: true });
  } catch (error) {
    console.error('Error skipping video:', error);
    res.status(500).json({ error: 'Failed to skip video' });
  }
});

export default router;