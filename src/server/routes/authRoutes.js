import express from 'express';
import {
  register,
  login,
  resetPasswordDirect,
  changePassword,
} from '../domains/auth/authService.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

router.get('/me', (req, res) => {
  if (req.session?.userId) {
    res.json({ id: req.session.userId, username: req.session.username });
  } else {
    res.json(null);
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await register(username, email, password);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ username: user.username });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await login(username, password);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ username: user.username });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

router.post('/reset-password', async (req, res) => {
  try {
    const { username, email, newPassword } = req.body;
    await resetPasswordDirect(username, email, newPassword);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await changePassword(req.session.userId, currentPassword, newPassword);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
