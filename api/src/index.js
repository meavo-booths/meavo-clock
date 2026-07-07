import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { deviceAuth, adminAuth } from './middleware.js';
import {
  upsertPendingUid,
  assignPendingUid,
  getActiveBindings,
  isUidAssigned,
  expirePendingUids,
} from './pending.js';
import { recordClockEvent, listClockEvents } from './clock.js';
import { listWorkers, createWorker, deactivateWorker, deactivateCard } from './workers.js';
import {
  getDashboard,
  getWorkerMonthlyReport,
  getWorkerMonthlySummary,
  currentMonth,
} from './stats.js';
import {
  verifyGoogleCredential,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  verifySessionToken,
  getSessionCookieName,
} from './auth.js';

const app = express();
const port = Number(process.env.PORT) || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/dist');
const serveStatic = process.env.SERVE_STATIC === '1' || process.env.NODE_ENV === 'production';
const webOrigins = (process.env.WEB_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: webOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

setInterval(() => {
  const n = expirePendingUids();
  if (n > 0) console.log(`Expired ${n} pending UID(s)`);
}, 30_000);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// --- Auth ---

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential is required' });
  try {
    const user = await verifyGoogleCredential(credential);
    const token = createSessionToken(user);
    setSessionCookie(res, token);
    res.json(user);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const user = verifySessionToken(req.cookies?.[getSessionCookieName()]);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// --- Device (kiosk) endpoints ---

app.get('/api/device/bindings', deviceAuth, (_req, res) => {
  res.json(getActiveBindings());
});

app.get('/api/device/bindings/:uid', deviceAuth, (req, res) => {
  const binding = isUidAssigned(req.params.uid);
  if (!binding) return res.status(404).json({ error: 'Not assigned' });
  res.json(binding);
});

app.post('/api/device/pending_uid', deviceAuth, (req, res) => {
  const { uid, station_id, tapped_at } = req.body;
  if (!uid || !station_id || !tapped_at) {
    return res.status(400).json({ error: 'uid, station_id, and tapped_at are required' });
  }
  const pending = upsertPendingUid({
    uid,
    stationId: station_id,
    tappedAt: tapped_at,
  });
  res.status(201).json(pending);
});

app.post('/api/device/clock_event', deviceAuth, (req, res) => {
  const { uid, station_id, tapped_at, idempotency_key } = req.body;
  if (!uid || !station_id || !tapped_at || !idempotency_key) {
    return res
      .status(400)
      .json({ error: 'uid, station_id, tapped_at, and idempotency_key are required' });
  }
  try {
    const { event, duplicate } = recordClockEvent({
      uid,
      stationId: station_id,
      tappedAt: tapped_at,
      idempotencyKey: idempotency_key,
    });
    res.status(duplicate ? 200 : 201).json(event);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Admin endpoints (require Google SSO session) ---

app.get('/api/stats/dashboard', adminAuth, (req, res) => {
  const month = req.query.month || currentMonth();
  res.json(getDashboard(month));
});

app.get('/api/stats/workers', adminAuth, (req, res) => {
  const month = req.query.month || currentMonth();
  res.json(getWorkerMonthlyReport(month));
});

app.get('/api/stats/worker/:id', adminAuth, (req, res) => {
  const month = req.query.month || currentMonth();
  const summary = getWorkerMonthlySummary(Number(req.params.id), month);
  if (!summary) return res.status(404).json({ error: 'Worker not found' });
  res.json(summary);
});

app.get('/api/workers', adminAuth, (_req, res) => {
  res.json(listWorkers());
});

app.post('/api/workers', adminAuth, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(createWorker(name));
});

app.delete('/api/workers/:id', adminAuth, (req, res) => {
  try {
    res.json(deactivateWorker(Number(req.params.id)));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/pending_uids', adminAuth, (_req, res) => {
  expirePendingUids();
  const rows = db
    .prepare(`SELECT * FROM pending_uids WHERE status = 'pending' ORDER BY tapped_at DESC`)
    .all()
    .filter((row) => new Date(row.expires_at).getTime() > Date.now());
  res.json(rows);
});

app.post('/api/pending_uids/:id/assign', adminAuth, (req, res) => {
  const { worker_id } = req.body;
  if (!worker_id) return res.status(400).json({ error: 'worker_id is required' });
  try {
    const result = assignPendingUid(Number(req.params.id), Number(worker_id));
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/card_bindings', adminAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT cb.*, w.name AS worker_name
       FROM card_bindings cb
       JOIN workers w ON w.id = cb.worker_id
       WHERE cb.active = 1
       ORDER BY w.name`
    )
    .all();
  res.json(rows);
});

app.delete('/api/card_bindings/:uid', adminAuth, (req, res) => {
  try {
    res.json(deactivateCard(req.params.uid));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/clock_events', adminAuth, (req, res) => {
  const { from, to, worker_id, limit } = req.query;
  const parsedLimit = Number(limit);
  res.json(
    listClockEvents({
      from,
      to,
      workerId: worker_id ? Number(worker_id) : undefined,
      limit:
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(Math.floor(parsedLimit), 1000)
          : undefined,
    })
  );
});

app.get('/api/unassigned_taps', adminAuth, (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM unassigned_taps ORDER BY tapped_at DESC LIMIT 500')
    .all();
  res.json(rows);
});

if (serveStatic && existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.listen(port, () => {
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
  console.log(`Meavo Clock-In listening on port ${port}`);
  console.log(`Public URL: ${publicUrl}`);
  if (serveStatic && existsSync(webDist)) {
    console.log('Serving web admin from web/dist');
  }
});
