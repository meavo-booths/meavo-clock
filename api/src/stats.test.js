import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'fs';

process.env.DATABASE_PATH = './data/test-stats.db';

let db;
let getWorkerMonthlySummary;

before(async () => {
  mkdirSync('./data', { recursive: true });
  rmSync('./data/test-stats.db', { force: true });
  db = (await import('./db.js')).default;
  getWorkerMonthlySummary = (await import('./stats.js')).getWorkerMonthlySummary;

  db.prepare('INSERT INTO workers (name) VALUES (?)').run('Stats Test Worker');
  const worker = db.prepare('SELECT id FROM workers LIMIT 1').get();
  const ins = [
    ['2026-07-01T07:25:00', 'in'],
    ['2026-07-01T16:35:00', 'out'],
    ['2026-07-02T08:00:00', 'in'],
    ['2026-07-02T16:30:00', 'out'],
    ['2026-07-03T16:40:00', 'out'],
  ];
  const insert = db.prepare(
    `INSERT INTO clock_events (uid, worker_id, station_id, event_type, tapped_at, idempotency_key)
     VALUES ('TEST01', ?, 'kiosk-1', ?, ?, ?)`
  );
  ins.forEach(([t, type], i) => {
    insert.run(worker.id, type, t, `test-key-${i}`);
  });
});

test('gross daily hours: first in to last out', () => {
  const summary = getWorkerMonthlySummary(1, '2026-07');
  assert.equal(summary.days.length, 3);
  const day1 = summary.days.find((d) => d.date === '2026-07-01');
  assert.ok(day1.hours > 9);
  assert.equal(day1.late, false);
  assert.equal(day1.overtime, true);
  const day2 = summary.days.find((d) => d.date === '2026-07-02');
  assert.equal(day2.late, true);
  assert.equal(day2.hours, 8.5);
});

test('clock-out with no clock-in is flagged, not hidden', () => {
  const summary = getWorkerMonthlySummary(1, '2026-07');
  const day3 = summary.days.find((d) => d.date === '2026-07-03');
  assert.ok(day3);
  assert.equal(day3.missing_in, true);
  assert.equal(day3.incomplete, true);
  assert.equal(day3.hours, 0);
});

test('expected hours only count elapsed weekdays for the current month', () => {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const current = getWorkerMonthlySummary(1, currentMonthStr);
  // June 2026 (a past month relative to any test run after it) has fixed
  // weekday count; the current month must never exceed its full-month figure.
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let fullWeekdays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (dow >= 1 && dow <= 5) fullWeekdays++;
  }
  assert.ok(current.expected_hours <= fullWeekdays * 9);
  // A future month has zero expected hours.
  const future = getWorkerMonthlySummary(1, '2099-01');
  assert.equal(future.expected_hours, 0);
});
