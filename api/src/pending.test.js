import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'fs';

process.env.DATABASE_PATH = './data/test-meavo.db';

let db;
let upsertPendingUid;
let assignPendingUid;
let expirePendingUids;
let isUidAssigned;

before(async () => {
  mkdirSync('./data', { recursive: true });
  rmSync('./data/test-meavo.db', { force: true });
  const mod = await import('./db.js');
  db = mod.default;
  db.prepare('INSERT INTO workers (name) VALUES (?)').run('Test Worker');
  const pending = await import('./pending.js');
  upsertPendingUid = pending.upsertPendingUid;
  assignPendingUid = pending.assignPendingUid;
  expirePendingUids = pending.expirePendingUids;
  isUidAssigned = pending.isUidAssigned;
});

after(() => {
  db.close();
  rmSync('./data/test-meavo.db', { force: true });
});

test('unknown UID creates pending with 15 min expiry', () => {
  const tappedAt = new Date().toISOString();
  const pending = upsertPendingUid({
    uid: 'ABCD1234',
    stationId: 'kiosk-1',
    tappedAt,
  });
  assert.equal(pending.status, 'pending');
  const expires = new Date(pending.expires_at).getTime();
  const tapped = new Date(tappedAt).getTime();
  assert.ok(expires - tapped >= 14 * 60 * 1000);
});

test('expiry is anchored to server time even when tapped_at is stale', () => {
  // A tap queued offline for an hour before syncing must still get a full
  // assignment window from when the server receives it.
  const staleTap = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const pending = upsertPendingUid({
    uid: 'STALE001',
    stationId: 'kiosk-1',
    tappedAt: staleTap,
  });
  const expires = new Date(pending.expires_at).getTime();
  assert.ok(expires - Date.now() >= 14 * 60 * 1000);
});

test('re-tap refreshes tapped_at without duplicate row', () => {
  const first = upsertPendingUid({
    uid: 'EF567890',
    stationId: 'kiosk-1',
    tappedAt: new Date().toISOString(),
  });
  const secondTap = new Date(Date.now() + 60000).toISOString();
  const second = upsertPendingUid({
    uid: 'EF567890',
    stationId: 'kiosk-1',
    tappedAt: secondTap,
  });
  assert.equal(first.id, second.id);
  assert.equal(second.tapped_at, secondTap);
  const count = db
    .prepare(`SELECT COUNT(*) AS c FROM pending_uids WHERE uid = 'EF567890' AND status = 'pending'`)
    .get().c;
  assert.equal(count, 1);
});

test('assign pending creates card binding', () => {
  const pending = upsertPendingUid({
    uid: '11223344',
    stationId: 'kiosk-1',
    tappedAt: new Date().toISOString(),
  });
  const worker = db.prepare('SELECT id FROM workers LIMIT 1').get();
  const result = assignPendingUid(pending.id, worker.id);
  assert.equal(result.pending.status, 'assigned');
  assert.ok(isUidAssigned('11223344'));
});

test('expired pending moves to unassigned_taps audit', () => {
  const tappedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const expiresAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const result = db
    .prepare(
      `INSERT INTO pending_uids (uid, station_id, tapped_at, expires_at, status)
       VALUES ('AABBCCDD', 'kiosk-1', ?, ?, 'pending')`
    )
    .run(tappedAt, expiresAt);
  const n = expirePendingUids();
  assert.ok(n >= 1);
  const audit = db.prepare(`SELECT * FROM unassigned_taps WHERE uid = 'AABBCCDD'`).get();
  assert.ok(audit);
  const pending = db.prepare('SELECT status FROM pending_uids WHERE id = ?').get(result.lastInsertRowid);
  assert.equal(pending.status, 'expired');
});
