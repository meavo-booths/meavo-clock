import { ClockEventType, ClockPendingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ensureWorkSettings,
  findClockWorkerByPublicId,
  publicWorkerId,
} from "@/lib/clock/workers";

const HOURS_PER_SHIFT = 9;

type WorkSettings = {
  shiftStart: string;
  shiftEnd: string;
  timezone: string;
};

function parseParts(iso: string) {
  const clean = String(iso).replace("Z", "").split(".")[0];
  const [datePart, timePart = "00:00:00"] = clean.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi, s = 0] = timePart.split(":").map(Number);
  return { y, mo, d, h, mi, s };
}

function dateKey(iso: string) {
  return iso.split("T")[0];
}

function timeToMinutes(h: number, m: number) {
  return h * 60 + m;
}

function shiftMinutes(field: string) {
  const [h, m] = field.split(":").map(Number);
  return timeToMinutes(h, m);
}

function msBetween(a: string, b: string) {
  const pa = parseParts(a);
  const pb = parseParts(b);
  return (
    Date.UTC(pb.y, pb.mo - 1, pb.d, pb.h, pb.mi, pb.s) -
    Date.UTC(pa.y, pa.mo - 1, pa.d, pa.h, pa.mi, pa.s)
  );
}

export async function getWorkSettings(): Promise<WorkSettings> {
  const row = await ensureWorkSettings();
  return {
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd,
    timezone: row.timezone,
  };
}

export async function todayKeyInSiteTz() {
  const settings = await getWorkSettings();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: settings.timezone || "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function countWeekdaysInMonth(year: number, month: number, uptoDay: number | null = null) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay = uptoDay ? Math.min(uptoDay, daysInMonth) : daysInMonth;
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

async function expectedWeekdays(year: number, month: number) {
  const todayKey = await todayKeyInSiteTz();
  const currentKey = todayKey.slice(0, 7);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  if (monthKey > currentKey) return 0;
  if (monthKey === currentKey) {
    return countWeekdaysInMonth(year, month, Number(todayKey.slice(8, 10)));
  }
  return countWeekdaysInMonth(year, month);
}

async function parseMonth(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number);
  const from = `${monthStr}-01T00:00:00`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59`;
  return {
    year,
    month,
    from,
    to,
    weekdays: await expectedWeekdays(year, month),
  };
}

async function getEventsForWorker(workerId: string, from: string, to: string) {
  return prisma.clockEvent.findMany({
    where: { workerId, tappedAt: { gte: from, lte: to } },
    orderBy: { tappedAt: "asc" },
  });
}

export async function computeDailySummaries(workerId: string, monthStr: string) {
  const settings = await getWorkSettings();
  const { from, to } = await parseMonth(monthStr);
  const shiftStart = shiftMinutes(settings.shiftStart);
  const shiftEnd = shiftMinutes(settings.shiftEnd);
  const events = await getEventsForWorker(workerId, from, to);

  const byDay = new Map<string, { ins: string[]; outs: string[] }>();
  for (const ev of events) {
    const day = dateKey(ev.tappedAt);
    if (!byDay.has(day)) byDay.set(day, { ins: [], outs: [] });
    const bucket = byDay.get(day)!;
    if (ev.eventType === ClockEventType.IN) bucket.ins.push(ev.tappedAt);
    else bucket.outs.push(ev.tappedAt);
  }

  const days = [];
  for (const [day, { ins, outs }] of byDay) {
    const firstIn = ins.length ? [...ins].sort()[0] : null;
    const lastOut = outs.length ? [...outs].sort().at(-1)! : null;
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

export async function getWorkerMonthlySummary(workerId: string, monthStr: string) {
  const worker = await findClockWorkerByPublicId(workerId);
  if (!worker) return null;

  const { weekdays } = await parseMonth(monthStr);
  const days = await computeDailySummaries(worker.id, monthStr);
  const total_hours = days.reduce((s, d) => s + d.hours, 0);
  const expected_hours = weekdays * HOURS_PER_SHIFT;
  const settings = await getWorkSettings();
  const shiftEndMin = shiftMinutes(settings.shiftEnd);
  const overtime_hours = days.reduce((s, d) => {
    if (!d.overtime || !d.last_out) return s;
    const p = parseParts(d.last_out);
    const extra = timeToMinutes(p.h, p.mi) - shiftEndMin;
    return s + Math.max(0, extra / 60);
  }, 0);

  return {
    worker_id: publicWorkerId(worker),
    clock_worker_id: worker.id,
    name: worker.name,
    active: worker.active ? 1 : 0,
    month: monthStr,
    total_hours: Math.round(total_hours * 100) / 100,
    expected_hours,
    days_worked: days.filter((d) => d.hours > 0).length,
    late_days: days.filter((d) => d.late).length,
    incomplete_days: days.filter((d) => d.incomplete).length,
    overtime_hours: Math.round(overtime_hours * 100) / 100,
    days,
  };
}

export async function getWorkerMonthlyReport(monthStr: string) {
  const workers = await prisma.clockWorker.findMany({
    where: { active: true },
    select: { id: true },
  });
  const rows = await Promise.all(
    workers.map((w) => getWorkerMonthlySummary(w.id, monthStr)),
  );
  return rows
    .filter(Boolean)
    .map((s) => {
      const avg =
        s!.days_worked > 0
          ? Math.round((s!.total_hours / s!.days_worked) * 100) / 100
          : 0;
      const pct =
        s!.expected_hours > 0
          ? Math.round((s!.total_hours / s!.expected_hours) * 100)
          : 0;
      return {
        worker_id: s!.worker_id,
        clock_worker_id: s!.clock_worker_id,
        name: s!.name,
        total_hours: s!.total_hours,
        expected_hours: s!.expected_hours,
        days_worked: s!.days_worked,
        late_days: s!.late_days,
        incomplete_days: s!.incomplete_days,
        overtime_hours: s!.overtime_hours,
        avg_hours_per_day: avg,
        expected_hours_per_day: HOURS_PER_SHIFT,
        pct_of_expected: pct,
      };
    });
}

export async function getDashboard(monthStr: string) {
  const { weekdays } = await parseMonth(monthStr);
  const settings = await getWorkSettings();
  const report = await getWorkerMonthlyReport(monthStr);
  const total_hours = report.reduce((s, r) => s + r.total_hours, 0);
  const activeWorkers = report.length;
  const expected_hours = activeWorkers * weekdays * HOURS_PER_SHIFT;
  const todayKey = await todayKeyInSiteTz();

  let late_arrivals_today = 0;
  let incomplete_today = 0;
  const late_today: { worker_id: string; name: string; first_in: string | null }[] = [];
  const incomplete_today_workers: { worker_id: string; name: string; missing_in: boolean }[] = [];
  const presentIds = new Set<string>();

  for (const w of report) {
    const days = await computeDailySummaries(w.clock_worker_id, monthStr);
    const todayRow = days.find((d) => d.date === todayKey);
    if (todayRow?.first_in || todayRow?.last_out) presentIds.add(w.worker_id);
    if (todayRow?.late) {
      late_arrivals_today++;
      late_today.push({
        worker_id: w.worker_id,
        name: w.name,
        first_in: todayRow.first_in,
      });
    }
    if (todayRow?.incomplete) {
      incomplete_today++;
      incomplete_today_workers.push({
        worker_id: w.worker_id,
        name: w.name,
        missing_in: !!todayRow.missing_in,
      });
    }
  }

  const missing_today = report
    .filter((w) => !presentIds.has(w.worker_id))
    .map((w) => ({ worker_id: w.worker_id, name: w.name }));

  const pendingRows = await prisma.clockPendingUid.findMany({
    where: {
      status: ClockPendingStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const recent = await prisma.clockEvent.findMany({
    include: { worker: true },
    orderBy: { tappedAt: "desc" },
    take: 10,
  });

  const incomplete_days = report.reduce((s, r) => s + r.incomplete_days, 0);

  return {
    month: monthStr,
    shift_start: settings.shiftStart,
    shift_end: settings.shiftEnd,
    timezone: settings.timezone,
    total_hours: Math.round(total_hours * 100) / 100,
    expected_hours,
    workers_active: activeWorkers,
    late_arrivals_today,
    incomplete_days,
    incomplete_today,
    pending_uids: pendingRows.length,
    today: todayKey,
    missing_today,
    late_today,
    incomplete_today_workers,
    pending_requests: pendingRows.map((p) => ({
      id: p.id,
      uid: p.uid,
      station_id: p.stationId,
      tapped_at: p.tappedAt,
      expires_at: p.expiresAt.toISOString(),
    })),
    hours_by_worker: report.map((r) => {
      const avg =
        r.days_worked > 0
          ? Math.round((r.total_hours / r.days_worked) * 100) / 100
          : 0;
      const pct =
        r.expected_hours > 0
          ? Math.round((r.total_hours / r.expected_hours) * 100)
          : 0;
      return {
        worker_id: r.worker_id,
        name: r.name,
        hours: r.total_hours,
        expected: r.expected_hours,
        days_worked: r.days_worked,
        late_days: r.late_days,
        incomplete_days: r.incomplete_days,
        overtime_hours: r.overtime_hours,
        avg_hours_per_day: avg,
        expected_hours_per_day: HOURS_PER_SHIFT,
        pct_of_expected: pct,
      };
    }),
    recent_events: recent.map((ev) => ({
      id: ev.id,
      uid: ev.uid,
      worker_id: ev.workerId,
      station_id: ev.stationId,
      event_type: ev.eventType.toLowerCase(),
      tapped_at: ev.tappedAt,
      idempotency_key: ev.idempotencyKey,
      created_at: ev.createdAt.toISOString(),
      worker_name: ev.worker.name,
    })),
  };
}

export async function currentMonth() {
  return (await todayKeyInSiteTz()).slice(0, 7);
}
