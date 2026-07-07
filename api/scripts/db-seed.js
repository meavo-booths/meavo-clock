#!/usr/bin/env node
/**
 * Seed the dev database with sample workers and clock events.
 * Safe to re-run — uses INSERT OR IGNORE / idempotent keys.
 * Usage: npm run db:seed
 */
import 'dotenv/config';
import db from '../src/db.js';

const workers = [
  ['Maria Ivanova'],
  ['Georgi Petrov'],
  ['Elena Dimitrova'],
];

const insertWorker = db.prepare('INSERT INTO workers (name) VALUES (?)');
for (const [name] of workers) {
  const existing = db.prepare('SELECT id FROM workers WHERE name = ?').get(name);
  if (!existing) insertWorker.run(name);
}

const workerRows = db.prepare('SELECT id, name FROM workers ORDER BY id').all();
console.log(`Workers: ${workerRows.length}`);

const cards = [
  ['A1B2C3D4', 1],
  ['E5F6A7B8', 2],
  ['11223344', 3],
];

const insertCard = db.prepare(
  `INSERT OR IGNORE INTO card_bindings (uid, worker_id) VALUES (?, ?)`
);
for (const [uid, workerId] of cards) {
  if (workerRows[workerId - 1]) {
    insertCard.run(uid, workerRows[workerId - 1].id);
  }
}

const events = [
  ['A1B2C3D4', 1, '2026-07-07T07:28:00', 'in', 'seed-maria-in-1'],
  ['A1B2C3D4', 1, '2026-07-07T16:32:00', 'out', 'seed-maria-out-1'],
  ['E5F6A7B8', 2, '2026-07-07T08:05:00', 'in', 'seed-georgi-in-1'],
  ['E5F6A7B8', 2, '2026-07-07T16:30:00', 'out', 'seed-georgi-out-1'],
  ['11223344', 3, '2026-07-07T07:31:00', 'in', 'seed-elena-in-1'],
];

const insertEvent = db.prepare(
  `INSERT OR IGNORE INTO clock_events
   (uid, worker_id, station_id, event_type, tapped_at, idempotency_key)
   VALUES (?, ?, 'kiosk-1', ?, ?, ?)`
);

let inserted = 0;
for (const [uid, workerId, tappedAt, type, key] of events) {
  const w = workerRows[workerId - 1];
  if (!w) continue;
  const r = insertEvent.run(uid, w.id, type, tappedAt, key);
  if (r.changes) inserted++;
}

console.log(`Clock events seeded: ${inserted} new`);
console.log('\nRun npm run db:inspect to view the database.');

db.close();
