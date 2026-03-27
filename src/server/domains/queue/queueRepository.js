import dbPromise from '../../config/db.js';

// Shared SELECT fragment: resolves media or bump columns via COALESCE
const ENRICHED_COLS = `
  COALESCE(m.duration, b.duration) AS duration,
  COALESCE(m.file_path, b.file_path) AS file_path,
  COALESCE(m.url, b.url) AS url,
  COALESCE(m.title, b.title) AS title,
  COALESCE(m.channel, b.channel) AS channel
`;

const ENRICHED_JOINS = `
  LEFT JOIN media m ON m.id = q.media_id
  LEFT JOIN bumps b ON b.id = q.bump_id
`;

export const queueRepository = {
  async getQueueWithMedia() {
    const db = await dbPromise;
    return db.all(`
      SELECT q.id, q.media_id, q.bump_id, q.type, q.added_at,
             ${ENRICHED_COLS}
      FROM queue q
      ${ENRICHED_JOINS}
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
      SELECT q.*, ${ENRICHED_COLS}
      FROM queue q
      ${ENRICHED_JOINS}
      WHERE q.id = ?
    `, [id]);
  },

  async enqueue(mediaId, type = 'media') {
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO queue (media_id, type) VALUES (?, ?)",
      [mediaId, type]
    );
    return result.lastID;
  },

  async enqueueBump(bumpId) {
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO queue (bump_id, type) VALUES (?, 'bump')",
      [bumpId]
    );
    return result.lastID;
  },

  async getNext(currentId) {
    const db = await dbPromise;
    return db.get(
      `SELECT q.*, ${ENRICHED_COLS}
       FROM queue q
       ${ENRICHED_JOINS}
       WHERE q.id > ? ORDER BY q.id LIMIT 1`,
      [currentId || 0]
    );
  },

  async getVideoById(id) {
    const db = await dbPromise;
    return db.get(`
      SELECT q.*, ${ENRICHED_COLS}
      FROM queue q
      ${ENRICHED_JOINS}
      WHERE q.id = ?
    `, [id]);
  }
};