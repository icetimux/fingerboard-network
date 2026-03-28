import express from 'express';
import path from 'path';
import { unlink, statfs } from 'fs/promises';
import { fileURLToPath } from 'url';
import { basicAuth } from '../middleware/basicAuth.js';
import { ioInstance } from '../sockets/socketHandler.js';
import { playbackController, buildEnrichedState } from '../domains/playback/controller.js';
import { getQueue, getQueueWithMedia } from '../domains/queue/queueService.js';
import { queueRepository } from '../domains/queue/queueRepository.js';
import { approve } from '../domains/media/mediaService.js';
import { mediaRepository } from '../domains/media/mediaRepository.js';
import { approveBump } from '../domains/bumps/bumpService.js';
import { bumpRepository } from '../domains/bumps/bumpRepository.js';
import dbPromise from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get('/', basicAuth, (req, res) => {
  res.redirect('/admin/queue');
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

router.get('/stats', basicAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin/stats.html'));
});

// Stats data
router.get('/stats-data', basicAuth, async (req, res) => {
  try {
    const db = await dbPromise;
    const [mediaRow, queueRow, bumpsRow, usersRow, diskInfo] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM media'),
      db.get('SELECT COUNT(*) as count FROM queue'),
      db.get('SELECT COUNT(*) as count FROM bumps'),
      db.get('SELECT COUNT(*) as count FROM users'),
      statfs('.').catch(() => null),
    ]);
    const connectedClients = ioInstance ? ioInstance.sockets.sockets.size : 0;
    res.json({
      connectedClients,
      users: usersRow.count,
      submissions: mediaRow.count,
      queueCount: queueRow.count,
      bumps: bumpsRow.count,
      diskFree: diskInfo ? diskInfo.bfree * diskInfo.bsize : null,
      diskTotal: diskInfo ? diskInfo.blocks * diskInfo.bsize : null,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
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

// Delete all submissions (and their files)
router.delete('/submissions', basicAuth, async (req, res) => {
  try {
    const db = await dbPromise;
    const all = await db.all('SELECT file_path FROM media WHERE file_path IS NOT NULL');
    await Promise.all(all.map(row => unlink(row.file_path).catch(err => {
      if (err.code !== 'ENOENT') console.error('Error deleting file:', err);
    })));
    await db.run('DELETE FROM media');
    await db.run("DELETE FROM sqlite_sequence WHERE name='media'");
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all submissions:', error);
    res.status(500).json({ error: 'Failed to delete all submissions' });
  }
});

// Delete submission
router.delete('/submissions/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const record = await mediaRepository.getById(id);
    if (record?.file_path) {
      await unlink(record.file_path).catch(err => {
        if (err.code !== 'ENOENT') console.error('Error deleting file:', err);
      });
    }
    await mediaRepository.deleteById(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// Approve video — queues download, responds immediately
router.post('/approve/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    approve(id);
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
router.post('/pause', basicAuth, async (req, res) => {
  try {
    await playbackController.pause();
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

// Clear entire queue
router.post('/clear-queue', basicAuth, async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM queue');
    await db.run("DELETE FROM sqlite_sequence WHERE name='queue'");
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing queue:', error);
    res.status(500).json({ error: 'Failed to clear queue' });
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

// Delete queue entry
router.delete('/queue/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    await queueRepository.deleteById(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting queue entry:', error);
    res.status(500).json({ error: 'Failed to delete queue entry' });
  }
});

// Delete all bumps (and their files)
router.delete('/bumps', basicAuth, async (req, res) => {
  try {
    const db = await dbPromise;
    const all = await db.all('SELECT file_path FROM bumps WHERE file_path IS NOT NULL');
    await Promise.all(all.map(row => unlink(row.file_path).catch(err => {
      if (err.code !== 'ENOENT') console.error('Error deleting bump file:', err);
    })));
    await db.run('DELETE FROM bumps');
    await db.run("DELETE FROM sqlite_sequence WHERE name='bumps'");
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all bumps:', error);
    res.status(500).json({ error: 'Failed to delete all bumps' });
  }
});

// Delete bump
router.delete('/bumps/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const record = await bumpRepository.getById(id);
    if (record?.file_path) {
      await unlink(record.file_path).catch(err => {
        if (err.code !== 'ENOENT') console.error('Error deleting bump file:', err);
      });
    }
    await bumpRepository.deleteById(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bump:', error);
    res.status(500).json({ error: 'Failed to delete bump' });
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
    approveBump(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving bump:', error);
    res.status(500).json({ error: 'Failed to approve bump' });
  }
});

export default router;