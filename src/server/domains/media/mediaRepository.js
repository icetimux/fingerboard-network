import dbPromise from '../../config/db.js';

export const mediaRepository = {
  async insertPending(url) {
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO media (url, status) VALUES (?, 'pending')",
      [url]
    );
    return result.lastID;
  },

  async setDownloading(id) {
    const db = await dbPromise;
    await db.run(
      "UPDATE media SET status='downloading' WHERE id=?",
      [id]
    );
  },

  async setFailed(id, error) {
    const db = await dbPromise;
    await db.run(
      "UPDATE media SET status='failed', error=? WHERE id=?",
      [error, id]
    );
  },

  async setReady(id, filePath, duration, title, channel) {
    const db = await dbPromise;
    await db.run(
      "UPDATE media SET status='ready', file_path=?, duration=?, title=?, channel=? WHERE id=?",
      [filePath, duration ?? 180, title ?? null, channel ?? null, id]
    );
  },

  async setApproved(id) {
    const db = await dbPromise;
    await db.run(
      "UPDATE media SET status='approved' WHERE id=?",
      [id]
    );
  },

  async getByUrl(url) {
    const db = await dbPromise;
    return db.get('SELECT id, status FROM media WHERE url = ?', [url]);
  },
};