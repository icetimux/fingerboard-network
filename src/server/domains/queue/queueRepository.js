import dbPromise from '../../config/db.js';

export const queueRepository = {
  async getQueueWithMedia() {
    const db = await dbPromise;
    return db.all(`
      SELECT q.id, q.media_id, q.type, q.added_at,
             m.url, m.file_path
      FROM queue q
      JOIN media m ON m.id = q.media_id
      ORDER BY q.added_at DESC
    `);
  },

  async getQueue() {
    const db = await dbPromise;
    return db.all("SELECT * FROM queue ORDER BY id");
  },

  async getVideoWithMedia(id) {
    const db = await dbPromise;
    return db.get(`
      SELECT q.*, m.file_path, m.url, m.duration
      FROM queue q
      JOIN media m ON m.id = q.media_id
      WHERE q.id = ?
    `, [id]);
  },

  async enqueue(mediaId, type = 'normal') {
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO queue (media_id, type) VALUES (?, ?)",
      [mediaId, type]
    );
    return result.lastID;
  },

  async getNext(currentId) {
    const db = await dbPromise;
    return db.get(
      "SELECT * FROM queue WHERE id > ? ORDER BY id LIMIT 1",
      [currentId || 0]
    );
  },

  async getVideoById(id) {
    const db = await dbPromise;
    return db.get(`
      SELECT q.*, m.duration, m.file_path, m.url
      FROM queue q
      JOIN media m ON m.id = q.media_id
      WHERE q.id = ?
    `, [id]);
  }
};