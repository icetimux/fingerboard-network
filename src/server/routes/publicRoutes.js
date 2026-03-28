import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve main media player page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/index.html'));
});

router.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/debug.html'));
});
// Optionally serve static assets (JS, CSS, etc.)
router.use('/static', express.static(path.join(__dirname, '../../client')));

// Serve downloaded videos
router.use('/videos', express.static(path.resolve(process.env.VIDEO_DIR || './videos')));

export default router;