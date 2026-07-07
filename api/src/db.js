import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DATABASE_PATH || './data/meavo.db';
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS card_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL COLLATE NOCASE,
    worker_id INTEGER NOT NULL REFERENCES workers(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deactivated_at TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_card_bindings_uid_active
    ON card_bindings(uid) WHERE active = 1;

  CREATE TABLE IF NOT EXISTS pending_uids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL COLLATE NOCASE,
    station_id TEXT NOT NULL,
    tapped_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'assigned', 'expired')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pending_uids_status ON pending_uids(status);
  CREATE INDEX IF NOT EXISTS idx_pending_uids_uid ON pending_uids(uid);

  CREATE TABLE IF NOT EXISTS unassigned_taps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL COLLATE NOCASE,
    station_id TEXT NOT NULL,
    tapped_at TEXT NOT NULL,
    pending_uid_id INTEGER REFERENCES pending_uids(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clock_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL COLLATE NOCASE,
    worker_id INTEGER NOT NULL REFERENCES workers(id),
    station_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('in', 'out')),
    tapped_at TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_clock_events_tapped_at ON clock_events(tapped_at);

  CREATE TABLE IF NOT EXISTS work_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    shift_start TEXT NOT NULL DEFAULT '07:30',
    shift_end TEXT NOT NULL DEFAULT '16:30',
    timezone TEXT NOT NULL DEFAULT 'Europe/Sofia'
  );

  CREATE TABLE IF NOT EXISTS admin_allowlist (
    email TEXT PRIMARY KEY COLLATE NOCASE
  );
`);

const settingsCount = db.prepare('SELECT COUNT(*) AS c FROM work_settings').get().c;
if (settingsCount === 0) {
  db.prepare(
    `INSERT INTO work_settings (id, shift_start, shift_end, timezone) VALUES (1, '07:30', '16:30', 'Europe/Sofia')`
  ).run();
}

const envEmails = process.env.ALLOWED_ADMIN_EMAILS?.split(',').map((e) => e.trim()).filter(Boolean);
if (envEmails?.length) {
  const insert = db.prepare('INSERT OR IGNORE INTO admin_allowlist (email) VALUES (?)');
  for (const email of envEmails) insert.run(email);
}

export default db;
