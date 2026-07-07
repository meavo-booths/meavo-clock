import { useState, useCallback } from 'react';
import { api } from '../api.js';
import { usePoll } from '../hooks.js';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function exportCsv(rows, month) {
  const headers = [
    'Worker',
    'Total hours',
    'Expected hours',
    'Days worked',
    'Late days',
    'Incomplete days',
    'Overtime hours',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        `"${String(r.name).replace(/"/g, '""')}"`,
        r.total_hours,
        r.expected_hours,
        r.days_worked,
        r.late_days,
        r.incomplete_days,
        r.overtime_hours,
      ].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meavo-hours-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const fetchStats = useCallback(() => api.workerStats(month), [month]);
  const { data: rows, error, loading } = usePoll(fetchStats, 30000);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Monthly reports</h2>
          <p className="page-subtitle">Gross hours · first in to last out · 07:30–16:30 shift</p>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            className="input w-auto"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!rows?.length}
            onClick={() => exportCsv(rows, month)}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">{error}</p>}

      <div className="card overflow-x-auto">
        {loading && !rows?.length ? (
          <p className="text-meavo-grey">Loading…</p>
        ) : !rows?.length ? (
          <p className="text-meavo-grey">No worker data for this month.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Total h</th>
                <th>Expected h</th>
                <th>Days worked</th>
                <th>Late days</th>
                <th>Incomplete</th>
                <th>Overtime h</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.worker_id}>
                  <td className="font-medium">{r.name}</td>
                  <td>{r.total_hours.toFixed(1)}</td>
                  <td className="text-meavo-grey">{r.expected_hours}</td>
                  <td>{r.days_worked}</td>
                  <td>{r.late_days > 0 ? <span className="text-amber-700">{r.late_days}</span> : '0'}</td>
                  <td>{r.incomplete_days > 0 ? <span className="text-red-700">{r.incomplete_days}</span> : '0'}</td>
                  <td>{r.overtime_hours.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
