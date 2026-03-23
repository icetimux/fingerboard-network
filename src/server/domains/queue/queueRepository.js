import dbPromise from '../../config/db.js';

export const queueRepository = {
  async getQueue() {
    const db = await dbPromise;
    return db.all("SELECT * FROM queue ORDER BY id");
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