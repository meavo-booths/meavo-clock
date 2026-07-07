#!/usr/bin/env node
/**
 * Seed the dev database with sample workers and clock events.
 * Safe to re-run — uses INSERT OR IGNORE / idempotent keys.
 * Usage: npm run db:seed
 */
import 'dotenv/config';
import db from '../src/db.js';

const workers = ['Maria Ivanova', 'Georgi Petrov', 'Elena Dimitrova'];

const insertWorker = db.prepare('INSERT INTO workers (name) VALUES (?)');
for (const name of workers) {
  const existing = db.prepare('SELECT id FROM workers WHERE name = ?').get(name);
  if (!existing) insertWorker.run(name);
}

function workerId(name) {
  return db.prepare('SELECT id FROM workers WHERE name = ?').get(name)?.id;
}

const cards = [
  ['A1B2C3D4', 'Maria Ivanova'],
  ['E5F6A7B8', 'Georgi Petrov'],
  ['11223344', 'Elena Dimitrova'],
];

const insertCard = db.prepare(
  `INSERT OR IGNORE INTO card_bindings (uid, worker_id) VALUES (?, ?)`
);
for (const [uid, name] of cards) {
  const id = workerId(name);
  if (id) insertCard.run(uid, id);
}

const events = [
  ['A1B2C3D4', 'Maria Ivanova', '2026-07-07T07:28:00', 'in', 'seed-maria-in-1'],
  ['A1B2C3D4', 'Maria Ivanova', '2026-07-07T16:32:00', 'out', 'seed-maria-out-1'],
  ['E5F6A7B8', 'Georgi Petrov', '2026-07-07T08:05:00', 'in', 'seed-georgi-in-1'],
  ['E5F6A7B8', 'Georgi Petrov', '2026-07-07T16:30:00', 'out', 'seed-georgi-out-1'],
  ['11223344', 'Elena Dimitrova', '2026-07-07T07:31:00', 'in', 'seed-elena-in-1'],
];

const insertEvent = db.prepare(
  `INSERT OR IGNORE INTO clock_events
   (uid, worker_id, station_id, event_type, tapped_at, idempotency_key)
   VALUES (?, ?, 'kiosk-1', ?, ?, ?)`
);

let inserted = 0;
for (const [uid, name, tappedAt, type, key] of events) {
  const id = workerId(name);
  if (!id) continue;
  const r = insertEvent.run(uid, id, type, tappedAt, key);
  if (r.changes) inserted++;
}

const totalWorkers = db.prepare('SELECT COUNT(*) AS c FROM workers').get().c;
console.log(`Workers: ${totalWorkers}`);
console.log(`Clock events seeded: ${inserted} new`);
console.log('\nRun npm run db:inspect to view the database.');

db.close();
