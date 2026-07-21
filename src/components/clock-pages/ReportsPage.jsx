import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/hooks";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function exportCsv(rows, month) {
  const headers = [
    "Worker",
    "Total hours",
    "Expected hours",
    "Avg hours/day",
    "Expected hours/day",
    "% of expected",
    "Days worked",
    "Late days",
    "Incomplete days",
    "Overtime hours",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        `"${String(r.name).replace(/"/g, '""')}"`,
        r.total_hours,
        r.expected_hours,
        r.avg_hours_per_day,
        r.expected_hours_per_day,
        r.pct_of_expected,
        r.days_worked,
        r.late_days,
        r.incomplete_days,
        r.overtime_hours,
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meavo-hours-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function barColor(pct) {
  if (pct >= 95) return "bg-meavo-accent";
  if (pct >= 80) return "bg-amber-500";
  return "bg-red-500";
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const fetchStats = useCallback(() => api.workerStats(month), [month]);
  const { data: rows, error, loading } = usePoll(fetchStats, 30000);
  const list = rows || [];

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Worker hours</h2>
          <p className="page-subtitle">
            Average day vs 9h expected (07:30–16:30) · first in → last out
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="month"
            className="input min-h-11 w-full sm:w-auto"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary min-h-11"
            disabled={!list.length}
            onClick={() => exportCsv(list, month)}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading && !list.length ? (
        <p className="text-meavo-grey">Loading…</p>
      ) : !list.length ? (
        <div className="card">
          <p className="text-meavo-grey">No worker data for this month.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {[...list]
              .sort((a, b) => (a.pct_of_expected ?? 0) - (b.pct_of_expected ?? 0))
              .map((r) => (
                <li key={r.worker_id} className="card !p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-meavo-ink">{r.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        (r.pct_of_expected ?? 0) >= 95
                          ? "bg-meavo-accent/15 text-meavo-accent"
                          : (r.pct_of_expected ?? 0) >= 80
                            ? "bg-amber-100 text-amber-800"
                            : "bg-meavo-pink text-red-800"
                      }`}
                    >
                      {r.pct_of_expected ?? 0}%
                    </span>
                  </div>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-meavo-beige-300">
                    <div
                      className={`h-full rounded-full ${barColor(r.pct_of_expected ?? 0)}`}
                      style={{ width: `${Math.min(100, r.pct_of_expected ?? 0)}%` }}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="text-meavo-grey">Avg / day</dt>
                      <dd className="text-sm font-semibold">
                        {Number(r.avg_hours_per_day).toFixed(1)}h
                        <span className="font-normal text-meavo-grey">
                          {" "}
                          / {r.expected_hours_per_day}h
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-meavo-grey">Month total</dt>
                      <dd className="text-sm font-semibold">
                        {Number(r.total_hours).toFixed(1)}h
                        <span className="font-normal text-meavo-grey">
                          {" "}
                          / {r.expected_hours}h
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-meavo-grey">Days worked</dt>
                      <dd className="text-sm font-medium">{r.days_worked}</dd>
                    </div>
                    <div>
                      <dt className="text-meavo-grey">Late / incomplete</dt>
                      <dd className="text-sm font-medium">
                        <span className={r.late_days ? "text-amber-700" : ""}>
                          {r.late_days}
                        </span>
                        {" / "}
                        <span className={r.incomplete_days ? "text-red-700" : ""}>
                          {r.incomplete_days}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
          </ul>

          {/* Desktop table */}
          <div className="card hidden overflow-x-auto lg:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Avg / day</th>
                  <th>vs 9h</th>
                  <th>Total h</th>
                  <th>Expected h</th>
                  <th>%</th>
                  <th>Days</th>
                  <th>Late</th>
                  <th>Incomplete</th>
                  <th>OT h</th>
                </tr>
              </thead>
              <tbody>
                {[...list]
                  .sort((a, b) => (a.pct_of_expected ?? 0) - (b.pct_of_expected ?? 0))
                  .map((r) => (
                    <tr key={r.worker_id}>
                      <td className="font-medium">{r.name}</td>
                      <td>
                        {Number(r.avg_hours_per_day).toFixed(1)}
                        <span className="text-meavo-grey">
                          {" "}
                          / {r.expected_hours_per_day}
                        </span>
                      </td>
                      <td className="min-w-[8rem]">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-meavo-beige-300">
                          <div
                            className={`h-full rounded-full ${barColor(r.pct_of_expected ?? 0)}`}
                            style={{
                              width: `${Math.min(100, r.pct_of_expected ?? 0)}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td>{Number(r.total_hours).toFixed(1)}</td>
                      <td className="text-meavo-grey">{r.expected_hours}</td>
                      <td>{r.pct_of_expected ?? 0}%</td>
                      <td>{r.days_worked}</td>
                      <td>
                        {r.late_days > 0 ? (
                          <span className="text-amber-700">{r.late_days}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td>
                        {r.incomplete_days > 0 ? (
                          <span className="text-red-700">{r.incomplete_days}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td>{Number(r.overtime_hours).toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
