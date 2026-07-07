import db from './db.js';

export function listWorkers() {
  return db
    .prepare(
      `SELECT w.*,
        (SELECT cb.uid FROM card_bindings cb WHERE cb.worker_id = w.id AND cb.active = 1 LIMIT 1) AS card_uid
       FROM workers w
       ORDER BY w.name`
    )
    .all();
}

export function createWorker(name) {
  const result = db.prepare('INSERT INTO workers (name) VALUES (?)').run(name.trim());
  return db.prepare('SELECT * FROM workers WHERE id = ?').get(result.lastInsertRowid);
}

export function deactivateWorker(id) {
  const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
  if (!worker) {
    const err = new Error('Worker not found');
    err.status = 404;
    throw err;
  }
  db.prepare('UPDATE workers SET active = 0 WHERE id = ?').run(id);
  db.prepare(
    `UPDATE card_bindings SET active = 0, deactivated_at = datetime('now') WHERE worker_id = ? AND active = 1`
  ).run(id);
  return db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
}

export function deactivateCard(uid) {
  const binding = db
    .prepare('SELECT * FROM card_bindings WHERE uid = ? AND active = 1')
    .get(uid.toUpperCase());
  if (!binding) {
    const err = new Error('Active card binding not found');
    err.status = 404;
    throw err;
  }
  db.prepare(
    `UPDATE card_bindings SET active = 0, deactivated_at = datetime('now') WHERE id = ?`
  ).run(binding.id);
  return { uid: binding.uid, worker_id: binding.worker_id };
}
