import { useCallback } from 'react';
import { api } from '@/lib/api';
import { usePoll, formatTime } from '@/lib/hooks';

export default function CardsPage() {
  const fetchBindings = useCallback(() => api.cardBindings(), []);
  const { data: bindings, error, loading, refresh } = usePoll(fetchBindings, 10000);

  async function handleDeactivate(uid) {
    if (!confirm(`Deactivate card ${uid}?`)) return;
    try {
      await api.deactivateCard(uid);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <h2 className="page-title">Card bindings</h2>
      <p className="page-subtitle mb-6">Active RFID cards linked to workers.</p>
      {error && <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="card overflow-x-auto">
        {loading && bindings.length === 0 ? (
          <p className="text-meavo-grey">Loading…</p>
        ) : bindings.length === 0 ? (
          <p className="text-meavo-grey">No active card bindings.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>UID</th>
                <th>Worker</th>
                <th>Bound since</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bindings.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.uid}</td>
                  <td className="font-medium">{b.worker_name}</td>
                  <td className="text-meavo-grey">{formatTime(b.created_at)}</td>
                  <td>
                    <button type="button" className="btn-danger" onClick={() => handleDeactivate(b.uid)}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
