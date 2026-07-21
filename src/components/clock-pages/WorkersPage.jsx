import { useCallback } from "react";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/hooks";

const GATEWAY_USERS_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "") ||
  "https://meavo.app";

export default function WorkersPage() {
  const fetchWorkers = useCallback(() => api.workers(), []);
  const { data: workers, error, loading, refresh } = usePoll(fetchWorkers, 10000);
  const list = workers || [];

  async function handleDeactivate(id) {
    if (!confirm("Take this worker off clock? Their card will be unbound and they will stop appearing in live reports until a card is assigned again.")) return;
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
      <p className="page-subtitle mb-4">
        People who have been assigned a card at least once. Assign new cards from
        Requests after a kiosk tap.
      </p>
      <p className="mb-6 text-sm text-meavo-grey">
        Create workers in{" "}
        <a
          href={`${GATEWAY_USERS_URL}/admin/users`}
          className="font-medium text-meavo-accent underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Gateway Admin → Users
        </a>{" "}
        (email + optional password). No clock tool-card access needed for
        floor workers.
      </p>
      {error && (
        <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="card overflow-x-auto">
        {loading && list.length === 0 ? (
          <p className="text-meavo-grey">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-meavo-grey">
            No one has been assigned a card yet. Tap a new card at the kiosk, then
            assign it from Requests.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Card UID</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id}>
                  <td className="font-medium">{w.name}</td>
                  <td className="text-sm text-meavo-grey">{w.email || "—"}</td>
                  <td className="mono">{w.card_uid || "—"}</td>
                  <td>
                    <span className={w.active ? "badge-in" : "text-meavo-grey"}>
                      {w.active ? "On clock" : "Off clock"}
                    </span>
                  </td>
                  <td>
                    {w.active && (
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleDeactivate(w.id)}
                      >
                        Remove from clock
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
