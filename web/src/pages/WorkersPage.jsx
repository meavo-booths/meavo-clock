import { useState, useCallback } from 'react';
import { api } from '../api.js';
import { usePoll } from '../hooks.js';

export default function WorkersPage() {
  const fetchWorkers = useCallback(() => api.workers(), []);
  const { data: workers, error, loading, refresh } = usePoll(fetchWorkers, 10000);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createWorker(name);
      setName('');
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this worker and unbind their card?')) return;
    try {
      await api.deactivateWorker(id);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <h2 className="page-title">Workers</h2>
      <p className="page-subtitle mb-6">Manage factory workers and card assignments.</p>
      {error && <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">{error}</p>}
      <form className="mb-6 flex gap-2" onSubmit={handleCreate}>
        <input
          className="input max-w-sm"
          placeholder="New worker name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={saving}>
          Add worker
        </button>
      </form>
      <div className="card overflow-x-auto">
        {loading && workers.length === 0 ? (
          <p className="text-meavo-grey">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Card UID</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="font-medium">{w.name}</td>
                  <td className="mono">{w.card_uid || '—'}</td>
                  <td>
                    <span className={w.active ? 'badge-in' : 'text-meavo-grey'}>
                      {w.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {w.active && (
                      <button type="button" className="btn-danger" onClick={() => handleDeactivate(w.id)}>
                        Deactivate
                      </button>
                    )}
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
