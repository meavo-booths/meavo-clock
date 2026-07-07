import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { usePoll, formatTime, secondsUntil, formatCountdown } from '../hooks.js';

export default function PendingPage() {
  const fetchPending = useCallback(() => api.pendingUids(), []);
  const fetchWorkers = useCallback(() => api.workers(), []);
  const { data: pending, error, loading, refresh } = usePoll(fetchPending, 3000);
  const { data: workers } = usePoll(fetchWorkers, 15000);
  const [assigning, setAssigning] = useState({});
  const [selected, setSelected] = useState({});
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleAssign(pendingId) {
    const workerId = selected[pendingId];
    if (!workerId) return;
    setAssigning((s) => ({ ...s, [pendingId]: true }));
    try {
      await api.assignPending(pendingId, Number(workerId));
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setAssigning((s) => ({ ...s, [pendingId]: false }));
    }
  }

  const activeWorkers = workers.filter((w) => w.active);

  return (
    <>
      <h2 className="page-title">Pending UIDs</h2>
      <p className="page-subtitle mb-6">
        Unknown cards tapped at the kiosk. Assign to a worker within 15 minutes.
      </p>
      {error && <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="card overflow-x-auto">
        {loading && pending.length === 0 ? (
          <p className="text-meavo-grey">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-meavo-grey">No pending UIDs — tap a new card at the kiosk to enroll.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>UID</th>
                <th>Station</th>
                <th>Tapped</th>
                <th>Expires in</th>
                <th>Assign to</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => {
                const secs = secondsUntil(row.expires_at);
                return (
                  <tr key={row.id}>
                    <td className="mono">{row.uid}</td>
                    <td>{row.station_id}</td>
                    <td>{formatTime(row.tapped_at)}</td>
                    <td className="font-mono text-amber-700">{formatCountdown(secs)}</td>
                    <td>
                      <select
                        className="input"
                        value={selected[row.id] || ''}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [row.id]: e.target.value }))
                        }
                      >
                        <option value="">Select worker…</option>
                        {activeWorkers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={!selected[row.id] || assigning[row.id]}
                        onClick={() => handleAssign(row.id)}
                      >
                        Assign
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
