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

  // Migrate existing DBs: add columns that may be missing on older installs
  await db.run(`ALTER TABLE media ADD COLUMN title TEXT`).catch(() => {});
  await db.run(`ALTER TABLE media ADD COLUMN channel TEXT`).catch(() => {});

  await db.run(`
    CREATE TABLE IF NOT EXISTS bumps (
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

  await db.run(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id INTEGER,
      type TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
    )
  `);

  // Migrate existing DBs: add bump_id column if missing
  await db.run(`ALTER TABLE queue ADD COLUMN bump_id INTEGER REFERENCES bumps(id) ON DELETE CASCADE`).catch(() => {});

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
      '<strong class="text-on-surface text-sm block mb-2">Welcome to Fingerboard Network!</strong><p class="text-on-surface/70 text-xs mb-3 leading-relaxed">A synchronized video channel — everyone watches together in real time.</p><div class="flex flex-col gap-2 text-xs text-on-surface/80"><div class="flex items-start gap-2"><span class="material-symbols-outlined text-primary shrink-0" style="font-size:14px">chat_bubble</span><span>Chat with everyone in the sidebar</span></div><div class="flex items-start gap-2"><span class="material-symbols-outlined text-primary shrink-0" style="font-size:14px">movie</span><span class="whitespace-nowrap">Submit a video: <code class="bg-primary/20 text-primary px-1 py-0.5 rounded text-[10px]">/submit [YouTube URL]</code></span></div></div>'
    )
  `);
})();

export default dbPromise;

