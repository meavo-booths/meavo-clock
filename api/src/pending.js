import db from './db.js';

const PENDING_TTL_MS = 15 * 60 * 1000;

export function expirePendingUids() {
  const now = Date.now();
  const expired = db
    .prepare(`SELECT id, uid, station_id, tapped_at, expires_at FROM pending_uids WHERE status = 'pending'`)
    .all()
    .filter((row) => new Date(row.expires_at).getTime() <= now);

  const markExpired = db.prepare(
    `UPDATE pending_uids SET status = 'expired' WHERE id = ?`
  );
  const insertAudit = db.prepare(
    `INSERT INTO unassigned_taps (uid, station_id, tapped_at, pending_uid_id)
     VALUES (?, ?, ?, ?)`
  );

  db.exec('BEGIN');
  try {
    for (const row of expired) {
      markExpired.run(row.id);
      insertAudit.run(row.uid, row.station_id, row.tapped_at, row.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return expired.length;
}

export function upsertPendingUid({ uid, stationId, tappedAt }) {
  expirePendingUids();

  const normalizedUid = uid.toUpperCase();
  const existingRows = db
    .prepare(`SELECT id, expires_at FROM pending_uids WHERE uid = ? AND status = 'pending'`)
    .all(normalizedUid);
  const existing = existingRows.find((row) => new Date(row.expires_at).getTime() > Date.now());

  // The device clock is untrusted (naive local time, may drift or be hours
  // stale when a queued tap finally syncs). The 15-minute assignment window is
  // therefore anchored to server receive time; tapped_at is kept for audit.
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS).toISOString();

  if (existing) {
    db.prepare(
      `UPDATE pending_uids SET tapped_at = ?, expires_at = ?, station_id = ? WHERE id = ?`
    ).run(tappedAt, expiresAt, stationId, existing.id);
    return db.prepare('SELECT * FROM pending_uids WHERE id = ?').get(existing.id);
  }
  const result = db
    .prepare(
      `INSERT INTO pending_uids (uid, station_id, tapped_at, expires_at, status)
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .run(normalizedUid, stationId, tappedAt, expiresAt);

  return db.prepare('SELECT * FROM pending_uids WHERE id = ?').get(result.lastInsertRowid);
}

export function assignPendingUid(pendingId, workerId) {
  expirePendingUids();

  const pending = db.prepare('SELECT * FROM pending_uids WHERE id = ?').get(pendingId);
  if (!pending) {
    const err = new Error('Pending UID not found');
    err.status = 404;
    throw err;
  }
  if (pending.status !== 'pending') {
    const err = new Error(`Pending UID is already ${pending.status}`);
    err.status = 400;
    throw err;
  }
  if (new Date(pending.expires_at) <= new Date()) {
    db.prepare(`UPDATE pending_uids SET status = 'expired' WHERE id = ?`).run(pendingId);
    const err = new Error('Pending UID has expired');
    err.status = 410;
    throw err;
  }

  const worker = db.prepare('SELECT id FROM workers WHERE id = ? AND active = 1').get(workerId);
  if (!worker) {
    const err = new Error('Worker not found');
    err.status = 404;
    throw err;
  }

  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE card_bindings SET active = 0, deactivated_at = datetime('now') WHERE uid = ? AND active = 1`
    ).run(pending.uid);
    db.prepare(`INSERT INTO card_bindings (uid, worker_id, active) VALUES (?, ?, 1)`).run(
      pending.uid,
      workerId
    );
    db.prepare(`UPDATE pending_uids SET status = 'assigned' WHERE id = ?`).run(pendingId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    binding: db
      .prepare(
        `SELECT cb.*, w.name AS worker_name FROM card_bindings cb
         JOIN workers w ON w.id = cb.worker_id
         WHERE cb.uid = ? AND cb.active = 1`
      )
      .get(pending.uid),
    pending: db.prepare('SELECT * FROM pending_uids WHERE id = ?').get(pendingId),
  };
}

export function getActiveBindings() {
  expirePendingUids();
  return db
    .prepare(
      `SELECT cb.uid, cb.worker_id, w.name AS worker_name
       FROM card_bindings cb
       JOIN workers w ON w.id = cb.worker_id
       WHERE cb.active = 1`
    )
    .all();
}

export function isUidAssigned(uid) {
  expirePendingUids();
  const row = db
    .prepare(
      `SELECT cb.uid, cb.worker_id, w.name AS worker_name
       FROM card_bindings cb
       JOIN workers w ON w.id = cb.worker_id
       WHERE cb.uid = ? AND cb.active = 1`
    )
    .get(uid.toUpperCase());
  return row || null;
}
