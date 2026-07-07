import db from './db.js';

const HOURS_PER_SHIFT = 9;

export function getWorkSettings() {
  return db.prepare('SELECT * FROM work_settings WHERE id = 1').get();
}

function parseParts(iso) {
  const clean = String(iso).replace('Z', '').split('.')[0];
  const [datePart, timePart = '00:00:00'] = clean.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi, s = 0] = timePart.split(':').map(Number);
  return { y, mo, d, h, mi, s };
}

function dateKey(iso) {
  return iso.split('T')[0];
}

function timeToMinutes(h, m) {
  return h * 60 + m;
}

function shiftMinutes(field) {
  const [h, m] = field.split(':').map(Number);
  return timeToMinutes(h, m);
}

function msBetween(a, b) {
  const pa = parseParts(a);
  const pb = parseParts(b);
  return (
    Date.UTC(pb.y, pb.mo - 1, pb.d, pb.h, pb.mi, pb.s) -
    Date.UTC(pa.y, pa.mo - 1, pa.d, pa.h, pa.mi, pa.s)
  );
}

// Current date in the site's timezone as YYYY-MM-DD. Kiosk timestamps are
// site-local, so "today" must be derived from the site timezone, not the
// server's (a UTC server would disagree with Sofia between 00:00 and 03:00).
export function todayKeyInSiteTz() {
  const tz = getWorkSettings()?.timezone || 'Europe/Sofia';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function countWeekdaysInMonth(year, month, uptoDay = null) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay = uptoDay ? Math.min(uptoDay, daysInMonth) : daysInMonth;
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

// Expected weekdays for a month: full month for past months, elapsed days
// only for the current month (so mid-month KPIs aren't compared against the
// whole month), zero for future months.
function expectedWeekdays(year, month) {
  const todayKey = todayKeyInSiteTz();
  const currentKey = todayKey.slice(0, 7);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  if (monthKey > currentKey) return 0;
  if (monthKey === currentKey) {
    return countWeekdaysInMonth(year, month, Number(todayKey.slice(8, 10)));
  }
  return countWeekdaysInMonth(year, month);
}

function parseMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const from = `${monthStr}-01T00:00:00`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59`;
  return { year, month, from, to, weekdays: expectedWeekdays(year, month) };
}

function getEventsForWorker(workerId, from, to) {
  return db
    .prepare(
      `SELECT * FROM clock_events
       WHERE worker_id = ? AND tapped_at >= ? AND tapped_at <= ?
       ORDER BY tapped_at ASC`
    )
    .all(workerId, from, to);
}

export function computeDailySummaries(workerId, monthStr) {
  const settings = getWorkSettings();
  const { from, to } = parseMonth(monthStr);
  const shiftStart = shiftMinutes(settings.shift_start);
  const shiftEnd = shiftMinutes(settings.shift_end);
  const events = getEventsForWorker(workerId, from, to);

  const byDay = new Map();
  for (const ev of events) {
    const day = dateKey(ev.tapped_at);
    if (!byDay.has(day)) byDay.set(day, { ins: [], outs: [] });
    const bucket = byDay.get(day);
    if (ev.event_type === 'in') bucket.ins.push(ev.tapped_at);
    else bucket.outs.push(ev.tapped_at);
  }

  const days = [];
  for (const [day, { ins, outs }] of byDay) {
    const firstIn = ins.length ? ins.sort()[0] : null;
    const lastOut = outs.length ? outs.sort().at(-1) : null;
    let hours = 0;
    let late = false;
    let early_leave = false;
    let incomplete = false;
    let overtime = false;
    let missing_in = false;

    if (firstIn) {
      const p = parseParts(firstIn);
      late = timeToMinutes(p.h, p.mi) > shiftStart;
    }
    if (firstIn && lastOut) {
      hours = msBetween(firstIn, lastOut) / 3600000;
      const pOut = parseParts(lastOut);
      const outMin = timeToMinutes(pOut.h, pOut.mi);
      early_leave = outMin < shiftEnd;
      overtime = outMin > shiftEnd;
    } else if (firstIn && !lastOut) {
      incomplete = true;
    } else if (!firstIn && lastOut) {
      // Clock-out with no clock-in (e.g. queued "in" lost, or a state flip
      // from a missed tap). Surface it instead of silently showing 0 hours.
      incomplete = true;
      missing_in = true;
    }

    days.push({
      date: day,
      first_in: firstIn,
      last_out: lastOut,
      hours: Math.round(hours * 100) / 100,
      late,
      early_leave,
      incomplete,
      overtime,
      missing_in,
    });
  }

  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export function getWorkerMonthlySummary(workerId, monthStr) {
  const worker = db.prepare('SELECT id, name, active FROM workers WHERE id = ?').get(workerId);
  if (!worker) return null;

  const { weekdays } = parseMonth(monthStr);
  const days = computeDailySummaries(workerId, monthStr);
  const total_hours = days.reduce((s, d) => s + d.hours, 0);
  const expected_hours = weekdays * HOURS_PER_SHIFT;
  const days_worked = days.filter((d) => d.hours > 0).length;
  const late_days = days.filter((d) => d.late).length;
  const shiftEndMin = shiftMinutes(getWorkSettings().shift_end);
  const overtime_hours = days.reduce((s, d) => {
    if (!d.overtime || !d.last_out) return s;
    const p = parseParts(d.last_out);
    const extra = timeToMinutes(p.h, p.mi) - shiftEndMin;
    return s + Math.max(0, extra / 60);
  }, 0);

  return {
    worker_id: worker.id,
    name: worker.name,
    active: worker.active,
    month: monthStr,
    total_hours: Math.round(total_hours * 100) / 100,
    expected_hours,
    days_worked,
    late_days,
    incomplete_days: days.filter((d) => d.incomplete).length,
    overtime_hours: Math.round(overtime_hours * 100) / 100,
    days,
  };
}

export function getWorkerMonthlyReport(monthStr) {
  const workers = db.prepare('SELECT id FROM workers WHERE active = 1').all();
  return workers.map((w) => {
    const s = getWorkerMonthlySummary(w.id, monthStr);
    return {
      worker_id: s.worker_id,
      name: s.name,
      total_hours: s.total_hours,
      expected_hours: s.expected_hours,
      days_worked: s.days_worked,
      late_days: s.late_days,
      incomplete_days: s.incomplete_days,
      overtime_hours: s.overtime_hours,
    };
  });
}

export function getDashboard(monthStr) {
  const { weekdays } = parseMonth(monthStr);
  const settings = getWorkSettings();
  const report = getWorkerMonthlyReport(monthStr);
  const total_hours = report.reduce((s, r) => s + r.total_hours, 0);
  const activeWorkers = report.length;
  const expected_hours = activeWorkers * weekdays * HOURS_PER_SHIFT;

  const todayKey = todayKeyInSiteTz();

  let late_arrivals_today = 0;
  let incomplete_today = 0;

  for (const w of report) {
    const days = computeDailySummaries(w.worker_id, monthStr);
    const todayRow = days.find((d) => d.date === todayKey);
    if (todayRow?.late) late_arrivals_today++;
    if (todayRow?.incomplete) incomplete_today++;
  }

  const pendingRows = db
    .prepare(`SELECT expires_at FROM pending_uids WHERE status = 'pending'`)
    .all()
    .filter((r) => new Date(r.expires_at).getTime() > Date.now());

  const recent_events = db
    .prepare(
      `SELECT ce.*, w.name AS worker_name FROM clock_events ce
       JOIN workers w ON w.id = ce.worker_id
       ORDER BY ce.tapped_at DESC LIMIT 10`
    )
    .all();

  const incomplete_days = report.reduce((s, r) => s + r.incomplete_days, 0);

  return {
    month: monthStr,
    shift_start: settings.shift_start,
    shift_end: settings.shift_end,
    timezone: settings.timezone,
    total_hours: Math.round(total_hours * 100) / 100,
    expected_hours,
    workers_active: activeWorkers,
    late_arrivals_today,
    incomplete_days,
    incomplete_today,
    pending_uids: pendingRows.length,
    hours_by_worker: report.map((r) => ({
      worker_id: r.worker_id,
      name: r.name,
      hours: r.total_hours,
      expected: r.expected_hours,
    })),
    recent_events,
  };
}

export function currentMonth() {
  return todayKeyInSiteTz().slice(0, 7);
}
