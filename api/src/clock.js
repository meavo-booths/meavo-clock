import db from './db.js';
import { isUidAssigned } from './pending.js';

export function recordClockEvent({ uid, stationId, tappedAt, idempotencyKey }) {
  const existing = db
    .prepare('SELECT * FROM clock_events WHERE idempotency_key = ?')
    .get(idempotencyKey);
  if (existing) {
    return { event: existing, duplicate: true };
  }

  const binding = isUidAssigned(uid);
  if (!binding) {
    const err = new Error('UID not assigned to any worker');
    err.status = 404;
    throw err;
  }

  const lastEvent = db
    .prepare(
      `SELECT event_type FROM clock_events
       WHERE worker_id = ? ORDER BY tapped_at DESC LIMIT 1`
    )
    .get(binding.worker_id);

  const eventType = !lastEvent || lastEvent.event_type === 'out' ? 'in' : 'out';

  const result = db
    .prepare(
      `INSERT INTO clock_events (uid, worker_id, station_id, event_type, tapped_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      uid.toUpperCase(),
      binding.worker_id,
      stationId,
      eventType,
      tappedAt,
      idempotencyKey
    );

  const event = db.prepare('SELECT * FROM clock_events WHERE id = ?').get(result.lastInsertRowid);
  return { event, duplicate: false };
}

export function listClockEvents({ from, to, workerId, limit = 200 } = {}) {
  let sql = `
    SELECT ce.*, w.name AS worker_name
    FROM clock_events ce
    JOIN workers w ON w.id = ce.worker_id
    WHERE 1=1`;
  const params = [];

  if (from) {
    sql += ' AND ce.tapped_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND ce.tapped_at <= ?';
    params.push(to);
  }
  if (workerId) {
    sql += ' AND ce.worker_id = ?';
    params.push(workerId);
  }

  sql += ' ORDER BY ce.tapped_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}
