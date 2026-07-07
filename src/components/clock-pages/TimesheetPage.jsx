import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { usePoll, formatTime } from '@/lib/hooks';

export default function TimesheetPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const fetchEvents = useCallback(() => {
    const params = {};
    // tapped_at is stored as naive local time (no timezone suffix), so filter
    // with matching naive day bounds instead of UTC ISO strings.
    if (from) params.from = `${from}T00:00:00`;
    if (to) params.to = `${to}T23:59:59`;
    return api.clockEvents(params);
  }, [from, to]);
  const { data: events, error, loading, refresh } = usePoll(fetchEvents, 10000);

  return (
    <>
      <h2 className="page-title">Timesheet</h2>
      <p className="page-subtitle mb-6">Raw clock-in and clock-out events.</p>
      {error && <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="mb-6 flex flex-wrap gap-2">
        <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="btn-secondary" onClick={refresh}>
          Filter
        </button>
      </div>
      <div className="card overflow-x-auto">
        {loading && events.length === 0 ? (
          <p className="text-meavo-grey">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-meavo-grey">No clock events yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Type</th>
                <th>UID</th>
                <th>Station</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.worker_name}</td>
                  <td>
                    <span className={e.event_type === 'in' ? 'badge-in' : 'badge-out'}>{e.event_type}</span>
                  </td>
                  <td className="mono">{e.uid}</td>
                  <td>{e.station_id}</td>
                  <td className="text-meavo-grey">{formatTime(e.tapped_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
