import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { basicAuth } from '../middleware/basicAuth.js';
import { playbackController, buildEnrichedState } from '../domains/playback/controller.js';
import { state as playbackState } from '../domains/playback/state.js';
import { getQueue, getQueueWithMedia } from '../domains/queue/queueService.js';
import { approve } from '../domains/media/mediaService.js';
import { mediaRepository } from '../domains/media/mediaRepository.js';
import { approveBump } from '../domains/bumps/bumpService.js';
import { bumpRepository } from '../domains/bumps/bumpRepository.js';
import dbPromise from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get('/', basicAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin/index.html'));
});

router.get('/submissions', basicAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin/submissions.html'));
});

router.get('/queue', basicAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin/queue.html'));
});

router.get('/bumps', basicAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin/bumps.html'));
});

// Get all media
router.get('/all', basicAuth, async (req, res) => {
  try {
    const db = await dbPromise;
    const all = await db.all("SELECT * FROM media ORDER BY created_at DESC");
    res.json(all);
  } catch (error) {
    console.error('Error fetching all media:', error);
    res.status(500).json({ error: 'Failed to fetch all media' });
  }
});

// Get queue with media details
router.get('/queue-data', basicAuth, async (req, res) => {
  try {
    const queue = await getQueueWithMedia();
    res.json(queue);
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// Get playback state
router.get('/playback-state', basicAuth, async (req, res) => {
  res.json(await buildEnrichedState());
});

// Delete submission
router.delete('/submissions/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    await mediaRepository.deleteById(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// Approve video
router.post('/approve/:id', basicAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await approve(id);
    // Auto-start playback if the queue was idle (exhausted, not just paused)
    if (!playbackState.playing && !playbackState.currentVideoId) {
      await playbackController.play();
    }
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

// Shuffle queue
router.post('/shuffle-queue', basicAuth, async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all('SELECT id FROM queue ORDER BY RANDOM()');
    await db.run('BEGIN');
    try {
      for (let i = 0; i < rows.length; i++) {
        await db.run('UPDATE queue SET id = ? WHERE id = ?', [-(i + 1), rows[i].id]);
      }
      for (let i = 0; i < rows.length; i++) {
        await db.run('UPDATE queue SET id = ? WHERE id = ?', [i + 1, -(i + 1)]);
      }
      if (rows.length) {
        await db.run("UPDATE sqlite_sequence SET seq = ? WHERE name = 'queue'", [rows.length]);
      }
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error shuffling queue:', error);
    res.status(500).json({ error: 'Failed to shuffle queue' });
  }
});

// Bump loop — immediately start playing random bumps
router.post('/bump-loop', basicAuth, async (req, res) => {
  try {
    const started = await playbackController.startBumpLoop();
    if (!started) return res.status(404).json({ error: 'No approved bumps available' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error starting bump loop:', error);
    res.status(500).json({ error: 'Failed to start bump loop' });
  }
});

// Get all bumps
router.get('/bumps-data', basicAuth, async (req, res) => {
  try {
    const bumps = await bumpRepository.getAll();
    res.json(bumps);
  } catch (error) {
    console.error('Error fetching bumps:', error);
    res.status(500).json({ error: 'Failed to fetch bumps' });
  }
});

// Approve bump
router.post('/approve-bump/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    await approveBump(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving bump:', error);
    res.status(500).json({ error: 'Failed to approve bump' });
  }
});

export default router;