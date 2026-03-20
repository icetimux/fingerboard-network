import express from 'express';
import { basicAuth } from '../middleware/basicAuth.js';
import { playbackController } from '../domains/playback/controller.js';
import { getQueue, approve } from '../domains/queue/queueService.js';

const router = express.Router();

// Get pending videos
router.get('/pending', basicAuth, async (req, res) => {
  const pending = await new Promise((resolve, reject) => {
    import('../config/db.js').then(({ default: db }) => {
      db.all("SELECT * FROM videos WHERE status='pending'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
  res.json(pending);
});

// Approve video
router.post('/approve/:id', basicAuth, async (req, res) => {
  const id = req.params.id;
  await approve(id);
  res.json({ success: true });
});

// Play video
router.post('/play', basicAuth, async (req, res) => {
  await playbackController.play();
  res.json({ success: true });
});

// Pause video
router.post('/pause', basicAuth, (req, res) => {
  playbackController.pause();
  res.json({ success: true });
});

// Skip video
router.post('/skip', basicAuth, async (req, res) => {
  await playbackController.next();
  res.json({ success: true });
});

export default router;