import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { usePoll, formatTime, secondsUntil, formatCountdown } from "@/lib/hooks";

export default function PendingPage() {
  const fetchPending = useCallback(() => api.pendingUids(), []);
  const fetchWorkers = useCallback(() => api.workers({ all: true }), []);
  const { data: pending, error, loading, refresh } = usePoll(fetchPending, 3000);
  const { data: workers } = usePoll(fetchWorkers, 15000);
  const [assigning, setAssigning] = useState({});
  const [cancelling, setCancelling] = useState({});
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

  const assignableWorkers = workers || [];
  const rows = pending || [];

  return (
    <>
      <h2 className="page-title">Card requests</h2>
      <p className="page-subtitle mb-5">
        Unknown cards from the kiosk. Choose a worker and assign within 15 minutes,
        or cancel to dismiss.
      </p>
      {error && (
        <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-meavo-grey">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card">
          <p className="text-meavo-grey">
            No pending requests — tap a new card at the kiosk to enroll.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const secs = secondsUntil(row.expires_at);
            return (
              <li key={row.id} className="card !p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="mono text-base font-semibold">{row.uid}</p>
                    <p className="mt-1 text-xs text-meavo-grey">
                      {row.station_id} · tapped {formatTime(row.tapped_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 font-mono text-xs font-medium text-amber-800">
                    {formatCountdown(secs)}
                  </span>
                </div>
                <label className="mb-1 block text-xs font-medium text-meavo-grey">
                  Assign to worker
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="input min-h-11"
                    value={selected[row.id] || ""}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [row.id]: e.target.value }))
                    }
                  >
                    <option value="">Select worker…</option>
                    {assignableWorkers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                        {w.email ? ` (${w.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-primary min-h-11 sm:w-32"
                    disabled={!selected[row.id] || assigning[row.id]}
                    onClick={() => handleAssign(row.id)}
                  >
                    {assigning[row.id] ? "Assigning…" : "Assign"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary min-h-11 sm:w-28"
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
    </>
  );
}
