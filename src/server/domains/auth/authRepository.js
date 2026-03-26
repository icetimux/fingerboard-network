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
