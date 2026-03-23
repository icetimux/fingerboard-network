import dbPromise from '../../config/db.js';

export const queueRepository = {
  async getQueue() {
    const db = await dbPromise;
    return db.all("SELECT * FROM queue ORDER BY id");
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
    return db.get("SELECT * FROM queue WHERE id=?", [id]);
  }
};