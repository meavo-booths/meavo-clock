const opts = { credentials: 'include', headers: { 'Content-Type': 'application/json' } };

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...opts,
    ...options,
    headers: { ...opts.headers, ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('meavo-unauthorized'));
    }
    throw new Error(data.error || res.statusText);
  }
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  googleLogin: (credential) =>
    request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
  dashboard: (month) => request(`/api/stats/dashboard?month=${month}`),
  workerStats: (month) => request(`/api/stats/workers?month=${month}`),
  workerDetail: (id, month) => request(`/api/stats/worker/${id}?month=${month}`),
  workers: () => request('/api/workers'),
  createWorker: (name) => request('/api/workers', { method: 'POST', body: JSON.stringify({ name }) }),
  deactivateWorker: (id) => request(`/api/workers/${id}`, { method: 'DELETE' }),
  pendingUids: () => request('/api/pending_uids'),
  assignPending: (id, worker_id) =>
    request(`/api/pending_uids/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ worker_id }),
    }),
  cardBindings: () => request('/api/card_bindings'),
  deactivateCard: (uid) => request(`/api/card_bindings/${uid}`, { method: 'DELETE' }),
  clockEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/clock_events${qs ? `?${qs}` : ''}`);
  },
  unassignedTaps: () => request('/api/unassigned_taps'),
};
