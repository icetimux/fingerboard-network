import dbPromise from '../../config/db.js';

export const queueRepository = {
  async getApproved() {
    const db = await dbPromise;
    return db.all("SELECT * FROM videos WHERE status='approved' ORDER BY id");
  },

  async getNext(currentId) {
    const db = await dbPromise;
    return db.get(
      "SELECT * FROM videos WHERE status='approved' AND id > ? ORDER BY id LIMIT 1",
      [currentId || 0]
    );
  },

  async insertPending(url) {
    const db = await dbPromise;
    const result = await db.run("INSERT INTO videos (url) VALUES (?)", [url]);
    return result.lastID;
  },

  async approve(id) {
    const db = await dbPromise;
    await db.run("UPDATE videos SET status='approved' WHERE id=?", [id]);
  },

  async getVideoById(id) {
    const db = await dbPromise;
    return db.get("SELECT * FROM videos WHERE id=?", [id]);
  }
};