import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { usePoll, formatTime } from '@/lib/hooks';
import KpiCard from '@/components/KpiCard';
import HoursChart from '@/components/HoursChart';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const fetchDashboard = useCallback(() => api.dashboard(month), [month]);
  const { data, error, loading } = usePoll(fetchDashboard, 15000, null);

  const pct =
    data?.expected_hours > 0
      ? Math.round((data.total_hours / data.expected_hours) * 100)
      : 0;

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Factory attendance overview</p>
        </div>
        <input
          type="month"
          className="input w-auto"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {error && <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">{error}</p>}

      {loading && !data ? (
        <p className="text-meavo-grey">Loading…</p>
      ) : data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total hours"
              value={`${data.total_hours}h`}
              sub={`${pct}% of ${data.expected_hours}h expected`}
              accent="bg-meavo-blue"
            />
            <KpiCard
              label="Active workers"
              value={data.workers_active}
              accent="bg-meavo-yellow"
            />
            <KpiCard
              label="Late today"
              value={data.late_arrivals_today}
              sub="Arrivals after 07:30"
              accent="bg-meavo-pink"
            />
            <KpiCard
              label="Pending cards"
              value={data.pending_uids}
              sub="Awaiting assignment"
              accent="bg-meavo-beige"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 font-semibold">Hours by worker</h3>
              <HoursChart data={data.hours_by_worker} />
            </div>
            <div className="card">
              <h3 className="mb-4 font-semibold">Recent clock events</h3>
              {data.recent_events?.length === 0 ? (
                <p className="text-sm text-meavo-grey">No events yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Type</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_events?.map((e) => (
                      <tr key={e.id}>
                        <td>{e.worker_name}</td>
                        <td>
                          <span className={e.event_type === 'in' ? 'badge-in' : 'badge-out'}>
                            {e.event_type}
                          </span>
                        </td>
                        <td className="text-meavo-grey">{formatTime(e.tapped_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <KpiCard
              label="Incomplete days"
              value={data.incomplete_days}
              sub="Missing clock-out this month"
            />
            <KpiCard
              label="Incomplete today"
              value={data.incomplete_today}
              sub="Workers still clocked in"
            />
          </div>
        </>
      ) : null}
    </>
  );
}
