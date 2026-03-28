import crypto from 'crypto';
import dbPromise from '../../config/db.js';

export async function findUserByUsername(username) {
  const db = await dbPromise;
  return db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
}

export async function findUserByEmail(email) {
  const db = await dbPromise;
  return db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
}

export async function findUserById(id) {
  const db = await dbPromise;
  return db.get('SELECT * FROM users WHERE id = ?', [id]);
}

export async function createUser(username, email, passwordHash) {
  const db = await dbPromise;
  const result = await db.run(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, passwordHash]
  );
  return result.lastID;
}

export async function updatePassword(userId, passwordHash) {
  const db = await dbPromise;
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

export async function createResetToken(userId) {
  const db = await dbPromise;
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
  await db.run('DELETE FROM reset_tokens WHERE user_id = ?', [userId]);
  await db.run(
    'INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
  return token;
}

export async function findResetToken(token) {
  const db = await dbPromise;
  return db.get('SELECT * FROM reset_tokens WHERE token = ? AND used = 0', [token]);
}

export async function consumeResetToken(tokenId) {
  const db = await dbPromise;
  await db.run('UPDATE reset_tokens SET used = 1 WHERE id = ?', [tokenId]);
}
