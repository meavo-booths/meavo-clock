# Architecture — meavo-clock

RFID clock-in for factory workers at **[clock.meavo.app](https://clock.meavo.app)**: ESP32 kiosks post card taps to device API routes; a Next.js admin dashboard manages workers, card bindings, and monthly hour reports on the shared Meavo database.

**Further reading:**
- [domain.md](domain.md) — business rules, pending-UID lifecycle, mutation map
- [data-model.md](data-model.md) — `Clock*` tables in the shared schema
- [deployment.md](deployment.md) — Vercel setup, tool card seeding, DNS
- [firmware-upload.md](firmware-upload.md), [BOM.md](BOM.md), [enclosure.md](enclosure.md) — kiosk hardware
- [AGENTS.md](../AGENTS.md) — quick orientation for AI agents

## Sibling repos (meavo-booths)

| Repo | Relationship |
|------|----------------|
| [meavo-db](https://github.com/meavo-booths/meavo-db) | Canonical Prisma schema (`@meavo/db` git dep, pinned tag). Owns `Clock*` models. **All schema changes go there.** |
| [meavo-gateway](https://github.com/meavo-booths/meavo-gateway) | Owns `User`, `ToolCard`, `ToolCardAccess`. Seeds the `seed-clock-tool` card and grants/revokes login access. |
| hols / assembly / sales / meavo-rp | Sibling satellite apps on the same Neon DB — pattern reference only, no runtime dependency. |

Deviation from STANDARDS.md: this app does **not** use `@meavo/navigation` (own sidebar shell) and does not enqueue to `NotificationOutbox` (no notifications).

## Stack decisions

- **Next.js 15 App Router on Vercel (`fra1`)** — replaced a VPS-hosted Express + SQLite app (kept read-only in `api/` + `web/`).
- **Prisma 6 via `@meavo/db`** — shared Neon Postgres; `package.json` points Prisma at `node_modules/@meavo/db/prisma/schema.prisma`; `db:push` is disabled.
- **NextAuth v5, Google-only invite flow** — `@meavo.com` account must already exist in the shared `User` table and hold `ToolCardAccess` for the clock card. No password login.
- **Kiosk = ESP32-S3 + PN532** (PlatformIO, `firmware/`) — offline-tolerant: taps queue on the device and sync every 10 s; idempotency keys make retries safe.

## Repository layout

```
src/
  app/
    (app)/            # authenticated admin pages (dashboard, reports, pending, workers, cards, timesheet, audit)
    login/            # public login page
    api/              # REST routes: admin CRUD, device/*, stats/*, cron/*, health, auth
  components/
    app-shell.tsx     # sidebar layout
    clock-pages/      # page implementations (.jsx, ported from legacy web/)
  lib/
    clock/            # domain: events, pending, stats, workers, serialize
    auth.ts ...       # NextAuth, gates (meavo-auth, admin-api, device-auth), prisma singleton
  middleware.ts       # cookie-presence gate for pages
firmware/             # PlatformIO ESP32 kiosk (src/main.cpp, include/*.h)
api/, web/            # LEGACY Express + Vite app — read-only reference
docs/                 # this folder
```

## Data flow

```
ESP32 kiosk (RFID tap)
  │  POST /api/device/clock_event   (X-Device-Key, idempotency_key)
  ├──▶ known UID  → recordClockEvent() → toggles IN/OUT → clock_events
  │  POST /api/device/pending_uid
  └──▶ unknown UID → upsertPendingUid() → clock_pending_uids (15-min TTL)
                        │ admin assigns on /pending → clock_card_bindings
                        └ expiry (lazy + /api/cron/expire-pending) → clock_unassigned_taps

Admin browser ── session cookie ─▶ /(app) pages (requireClockAccess in layout)
  └─ clock-pages/*.jsx ── usePoll ─▶ /api/* (requireAdminApi) ─▶ src/lib/clock/* ─▶ Neon

Gateway admin (meavo.app) ─▶ ToolCardAccess for seed-clock-tool ─▶ controls who can log in / call admin APIs
```

## API surface

REST route handlers only (no Server Actions — pre-standard deviation):

- **Device** (`X-Device-Key`): `POST /api/device/clock_event`, `POST /api/device/pending_uid`, `GET /api/device/bindings`, `GET/DELETE /api/device/bindings/[uid]`
- **Admin** (`requireAdminApi`): `GET/POST /api/workers`, `DELETE /api/workers/[id]`, `GET /api/pending_uids`, `POST /api/pending_uids/[id]/assign`, `GET /api/card_bindings`, `DELETE /api/card_bindings/[uid]`, `GET /api/clock_events`, `GET /api/unassigned_taps`, `GET /api/stats/dashboard|workers|worker/[id]`
- **Open**: `GET /api/health`, `/api/auth/[...nextauth]`

## Scheduled jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `GET /api/cron/expire-pending` | Not scheduled in `vercel.json` (Hobby plan) — call manually or via external scheduler with `CRON_SECRET` Bearer | Expire stale pending UIDs into `clock_unassigned_taps` |

Expiry also runs lazily inside `src/lib/clock/pending.ts` on every pending/binding read, so the cron is a safety net.

## Environment variables

Document names only (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | Shared Neon Postgres (pooled / direct) |
| `AUTH_SECRET` | NextAuth JWT secret |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (invite-only login) |
| `DEVICE_API_KEY` | Shared secret for kiosk `X-Device-Key` header |
| `CLOCK_TOOL_CARD_ID` | Gateway tool card ID (default `seed-clock-tool`) |
| `CRON_SECRET` | Bearer auth for `/api/cron/*` |
| `NEXT_PUBLIC_APP_URL` | `https://clock.meavo.app` |

## Deployment

Vercel project (region `fra1`), domain `clock.meavo.app`. See [deployment.md](deployment.md) for the full checklist (schema apply from meavo-db, tool card seed from gateway, DNS, Google OAuth origins). Kiosk firmware is flashed separately via PlatformIO ([firmware-upload.md](firmware-upload.md)) with `API_BASE_URL` pointing at production.
