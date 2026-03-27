import dbPromise from '../../config/db.js';

export const bumpRepository = {
  async getByUrl(url) {
    const db = await dbPromise;
    return db.get('SELECT * FROM bumps WHERE url = ?', [url]);
  },

  async insertPending(url) {
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO bumps (url, status) VALUES (?, 'pending')",
      [url]
    );
    return result.lastID;
  },

  async setDownloading(id) {
    const db = await dbPromise;
    await db.run("UPDATE bumps SET status='downloading' WHERE id=?", [id]);
  },

  async setFailed(id, error) {
    const db = await dbPromise;
    await db.run("UPDATE bumps SET status='failed', error=? WHERE id=?", [error, id]);
  },

  async setReady(id, filePath, duration, title, channel) {
    const db = await dbPromise;
    await db.run(
      "UPDATE bumps SET status='ready', file_path=?, duration=?, title=?, channel=? WHERE id=?",
      [filePath, duration ?? 180, title ?? null, channel ?? null, id]
    );
  },

  async setApproved(id) {
    const db = await dbPromise;
    await db.run("UPDATE bumps SET status='approved' WHERE id=?", [id]);
  },

  async getAll() {
    const db = await dbPromise;
    return db.all("SELECT * FROM bumps ORDER BY created_at DESC");
  },

  async getRandomApproved(excludeId = null) {
    const db = await dbPromise;
    if (excludeId) {
      return db.get("SELECT * FROM bumps WHERE status='approved' AND id != ? ORDER BY RANDOM() LIMIT 1", [excludeId]);
    }
    return db.get("SELECT * FROM bumps WHERE status='approved' ORDER BY RANDOM() LIMIT 1");
  },

  async getById(id) {
    const db = await dbPromise;
    return db.get('SELECT * FROM bumps WHERE id=?', [id]);
  },

  async deleteById(id) {
    const db = await dbPromise;
    await db.run('DELETE FROM bumps WHERE id=?', [id]);
  },
};
