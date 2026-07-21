import { useCallback } from "react";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/hooks";

const GATEWAY_USERS_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "") ||
  "https://meavo.app";

export default function WorkersPage() {
  const fetchWorkers = useCallback(() => api.workers(), []);
  const { data: workers, error, loading, refresh } = usePoll(fetchWorkers, 10000);

  async function handleDeactivate(id) {
    if (!confirm("Deactivate this worker and unbind their card?")) return;
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
        People come from the gateway. Assign RFID cards here after a kiosk tap.
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
        {loading && workers.length === 0 ? (
          <p className="text-meavo-grey">Loading…</p>
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
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="font-medium">{w.name}</td>
                  <td className="text-sm text-meavo-grey">{w.email || "—"}</td>
                  <td className="mono">{w.card_uid || "—"}</td>
                  <td>
                    <span className={w.active ? "badge-in" : "text-meavo-grey"}>
                      {w.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    {w.active && w.clock_worker_id && (
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleDeactivate(w.id)}
                      >
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
