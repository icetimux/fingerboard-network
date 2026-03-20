import db from '../../config/db.js';

export const queueRepository = {
  getApproved() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM videos WHERE status='approved' ORDER BY id", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getNext(currentId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM videos WHERE status='approved' AND id > ? ORDER BY id LIMIT 1",
        [currentId || 0],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });
  },

  insertPending(url) {
    return new Promise((resolve, reject) => {
      db.run("INSERT INTO videos (url, status='pending') VALUES (?)", [url], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  },

  approve(id) {
    return new Promise((resolve, reject) => {
      db.run("UPDATE videos SET status='approved' WHERE id=?", [id], err => err ? reject(err) : resolve());
    });
  },

  getVideoById(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM videos WHERE id=?", [id], (err, row) => err ? reject(err) : resolve(row));
    });
  }
};