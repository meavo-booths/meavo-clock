import { useCallback } from 'react';
import { api } from '../api.js';
import { usePoll, formatTime } from '../hooks.js';

export default function AuditPage() {
  const fetchTaps = useCallback(() => api.unassignedTaps(), []);
  const { data: taps, error, loading } = usePoll(fetchTaps, 15000);

  return (
    <>
      <h2 className="page-title">Unassigned taps</h2>
      <p className="page-subtitle mb-6">
        Cards that expired without assignment within the 15-minute window.
      </p>
      {error && <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="card overflow-x-auto">
        {loading && taps.length === 0 ? (
          <p className="text-meavo-grey">Loading…</p>
        ) : taps.length === 0 ? (
          <p className="text-meavo-grey">No unassigned taps recorded.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>UID</th>
                <th>Station</th>
                <th>Tapped at</th>
                <th>Logged at</th>
              </tr>
            </thead>
            <tbody>
              {taps.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.uid}</td>
                  <td>{t.station_id}</td>
                  <td>{formatTime(t.tapped_at)}</td>
                  <td className="text-meavo-grey">{formatTime(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
