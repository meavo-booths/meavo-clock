async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
  return data;
}

export const api = {
  dashboard: (month: string) => request(`/api/stats/dashboard?month=${month}`),
  workerStats: (month: string) => request(`/api/stats/workers?month=${month}`),
  workerDetail: (id: string, month: string) =>
    request(`/api/stats/worker/${id}?month=${month}`),
  workers: () => request("/api/workers"),
  createWorker: (name: string) =>
    request("/api/workers", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deactivateWorker: (id: string) =>
    request(`/api/workers/${id}`, { method: "DELETE" }),
  pendingUids: () => request("/api/pending_uids"),
  assignPending: (id: string, worker_id: string) =>
    request(`/api/pending_uids/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ worker_id }),
    }),
  cardBindings: () => request("/api/card_bindings"),
  deactivateCard: (uid: string) =>
    request(`/api/card_bindings/${encodeURIComponent(uid)}`, {
      method: "DELETE",
    }),
  clockEvents: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/clock_events${qs ? `?${qs}` : ""}`);
  },
  unassignedTaps: () => request("/api/unassigned_taps"),
};
