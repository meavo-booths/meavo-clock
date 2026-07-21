import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { usePoll, formatTime, secondsUntil, formatCountdown } from "@/lib/hooks";
import KpiCard from "@/components/KpiCard";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const fetchDashboard = useCallback(() => api.dashboard(month), [month]);
  const fetchWorkers = useCallback(() => api.workers({ all: true }), []);
  const { data, error, loading, refresh } = usePoll(fetchDashboard, 10000, null);
  const { data: workers } = usePoll(fetchWorkers, 15000);
  const [selected, setSelected] = useState({});
  const [assigning, setAssigning] = useState({});
  const [cancelling, setCancelling] = useState({});
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const assignableWorkers = workers || [];
  const pct =
    data?.expected_hours > 0
      ? Math.round((data.total_hours / data.expected_hours) * 100)
      : 0;

  async function handleAssign(pendingId) {
    const workerId = selected[pendingId];
    if (!workerId) return;
    setAssigning((s) => ({ ...s, [pendingId]: true }));
    try {
      await api.assignPending(pendingId, String(workerId));
      setSelected((s) => {
        const next = { ...s };
        delete next[pendingId];
        return next;
      });
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setAssigning((s) => ({ ...s, [pendingId]: false }));
    }
  }

  async function handleCancel(pendingId) {
    setCancelling((s) => ({ ...s, [pendingId]: true }));
    try {
      await api.cancelPending(pendingId);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelling((s) => ({ ...s, [pendingId]: false }));
    }
  }

  return (
    <>
      <div className="mb-5 grid gap-3 sm:mb-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <h2 className="page-title">Today</h2>
          <p className="page-subtitle">
            Who&apos;s in, who&apos;s missing, new card requests · shift{" "}
            {data?.shift_start?.slice(0, 5) || "07:30"}–
            {data?.shift_end?.slice(0, 5) || "16:30"}
          </p>
        </div>
        <div className="w-fit max-w-full sm:justify-self-end">
          <input
            type="month"
            className="input min-h-11 w-full sm:w-auto"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Month"
          />
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading && !data ? (
        <p className="text-meavo-grey">Loading…</p>
      ) : data ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Missing now"
              value={data.missing_today?.length ?? 0}
              sub="No tap today"
              accent="bg-meavo-pink"
            />
            <KpiCard
              label="New requests"
              value={data.pending_uids}
              sub="Assign a worker"
              accent="bg-meavo-yellow"
            />
            <KpiCard
              label="Late today"
              value={data.late_arrivals_today}
              sub={`After ${data.shift_start?.slice(0, 5) || "07:30"}`}
              accent="bg-meavo-beige"
            />
            <KpiCard
              label="Hours MTD"
              value={`${data.total_hours}h`}
              sub={`${pct}% of ${data.expected_hours}h`}
              accent="bg-meavo-blue"
            />
          </div>

          {/* New card requests — quick assign */}
          <section className="card mb-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-meavo-ink">New card requests</h3>
              <Link href="/pending" className="text-xs font-medium text-meavo-accent">
                View all
              </Link>
            </div>
            {!data.pending_requests?.length ? (
              <p className="text-sm text-meavo-grey">
                No pending cards. Tap a new card at the kiosk to enroll.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.pending_requests.map((row) => {
                  const secs = secondsUntil(row.expires_at);
                  return (
                    <li
                      key={row.id}
                      className="rounded-xl border border-meavo-beige-600 bg-meavo-bg p-3"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="mono font-semibold text-meavo-ink">{row.uid}</p>
                          <p className="text-xs text-meavo-grey">
                            {row.station_id} · {formatTime(row.tapped_at)}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-amber-700">
                          {formatCountdown(secs)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select
                          className="input min-h-11"
                          value={selected[row.id] || ""}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [row.id]: e.target.value }))
                          }
                        >
                          <option value="">Choose worker…</option>
                          {assignableWorkers.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                              {w.email ? ` (${w.email})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-primary min-h-11 shrink-0 sm:w-28"
                          disabled={!selected[row.id] || assigning[row.id]}
                          onClick={() => handleAssign(row.id)}
                        >
                          {assigning[row.id] ? "…" : "Assign"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary min-h-11 shrink-0 sm:w-24"
                          disabled={cancelling[row.id] || assigning[row.id]}
                          onClick={() => handleCancel(row.id)}
                        >
                          {cancelling[row.id] ? "…" : "Cancel"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Missing today */}
          <section className="card mb-4">
            <h3 className="mb-3 font-semibold text-meavo-ink">Missing today</h3>
            {!data.missing_today?.length ? (
              <p className="text-sm text-meavo-grey">Everyone has tapped in today.</p>
            ) : (
              <ul className="divide-y divide-meavo-beige-300">
                {data.missing_today.map((w) => (
                  <li
                    key={w.worker_id}
                    className="flex min-h-11 items-center justify-between py-2.5 text-sm"
                  >
                    <span className="font-medium">{w.name}</span>
                    <span className="rounded-full bg-meavo-pink px-2.5 py-0.5 text-xs font-medium text-red-800">
                      No tap
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <section className="card">
              <h3 className="mb-3 font-semibold">Late arrivals</h3>
              {!data.late_today?.length ? (
                <p className="text-sm text-meavo-grey">No late arrivals today.</p>
              ) : (
                <ul className="divide-y divide-meavo-beige-300">
                  {data.late_today.map((w) => (
                    <li
                      key={w.worker_id}
                      className="flex min-h-11 items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <span className="font-medium">{w.name}</span>
                      <span className="text-xs text-amber-700">
                        {w.first_in ? formatTime(w.first_in) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h3 className="mb-3 font-semibold">Incomplete today</h3>
              {!data.incomplete_today_workers?.length ? (
                <p className="text-sm text-meavo-grey">No incomplete pairs today.</p>
              ) : (
                <ul className="divide-y divide-meavo-beige-300">
                  {data.incomplete_today_workers.map((w) => (
                    <li
                      key={w.worker_id}
                      className="flex min-h-11 items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <span className="font-medium">{w.name}</span>
                      <span className="text-xs text-meavo-grey">
                        {w.missing_in ? "OUT without IN" : "Still clocked in"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Worker hours snapshot */}
          <section className="card mb-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold">Hours vs expected</h3>
              <Link href="/reports" className="text-xs font-medium text-meavo-accent">
                Full report
              </Link>
            </div>
            <p className="mb-3 text-xs text-meavo-grey">
              Average day vs 9h shift (07:30–16:30) · month to date
            </p>
            {!data.hours_by_worker?.length ? (
              <p className="text-sm text-meavo-grey">No worker hours yet.</p>
            ) : (
              <ul className="space-y-4">
                {[...data.hours_by_worker]
                  .sort((a, b) => (a.pct_of_expected ?? 0) - (b.pct_of_expected ?? 0))
                  .map((w) => (
                    <li key={w.worker_id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{w.name}</span>
                        <span className="text-xs text-meavo-grey">
                          {w.avg_hours_per_day?.toFixed?.(1) ?? w.avg_hours_per_day}h avg ·{" "}
                          {w.hours}h / {w.expected}h
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-meavo-beige-300">
                        <div
                          className={`h-full rounded-full ${
                            (w.pct_of_expected ?? 0) >= 95
                              ? "bg-meavo-accent"
                              : (w.pct_of_expected ?? 0) >= 80
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.min(100, w.pct_of_expected ?? 0)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h3 className="mb-3 font-semibold">Recent taps</h3>
            {!data.recent_events?.length ? (
              <p className="text-sm text-meavo-grey">No events yet.</p>
            ) : (
              <ul className="divide-y divide-meavo-beige-300">
                {data.recent_events.map((e) => (
                  <li
                    key={e.id}
                    className="flex min-h-11 items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.worker_name}</p>
                      <p className="text-xs text-meavo-grey">{formatTime(e.tapped_at)}</p>
                    </div>
                    <span className={e.event_type === "in" ? "badge-in" : "badge-out"}>
                      {e.event_type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
