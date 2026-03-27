import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const dbPromise = open({
  filename: './database/db.sqlite',
  driver: sqlite3.Database
});

(async () => {
  const db = await dbPromise;

  await db.run(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      file_path TEXT,
      status TEXT DEFAULT 'pending',
      duration INTEGER DEFAULT 180,
      title TEXT,
      channel TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate existing DBs
  await db.run(`ALTER TABLE media ADD COLUMN title TEXT`).catch(() => {});
  await db.run(`ALTER TABLE media ADD COLUMN channel TEXT`).catch(() => {});

  await db.run(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id INTEGER,
      type TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT,
      text TEXT,
      color TEXT,
      timestamp INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Seed default welcome message if not set
  await db.run(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (
      'welcome_message',
      '✨Welcome to Fingerboard Network!✨\nThis is a synchronized video channel. Everyone watches together in real time.\nFeel free to chat below 💬\nType /submit followed by a YouTube URL to submit a video! 🎥'
    )
  `);
})();

export default dbPromise;

