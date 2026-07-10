# Domain reference — meavo-clock

Business rules and **where to change what**. For stack see [architecture.md](architecture.md). For tables see [data-model.md](data-model.md).

## Glossary

| Term | Meaning |
|------|---------|
| Worker | Factory employee (`ClockWorker`) — not a gateway `User`; workers don't log in |
| Card binding | Active RFID UID → worker mapping (`ClockCardBinding`); one active binding per UID |
| Pending UID | Unknown card tap awaiting admin assignment, 15-minute TTL (`ClockPendingUid`) |
| Unassigned tap | Audit record of a pending UID that expired unassigned (`ClockUnassignedTap`) |
| Clock event | An IN or OUT tap (`ClockEvent`), deduplicated by `idempotencyKey` |
| Station | Kiosk identifier string sent by the ESP32 (`stationId`) |
| Work settings | Singleton shift config: 07:30–16:30, `Europe/Sofia` (`ClockWorkSettings`) |
| UID | RFID card serial, normalized trim + uppercase (`normalizeUid`) |

## Status / state values

**`ClockPendingStatus`:** `PENDING` → `ASSIGNED` (admin assigns within TTL) or `EXPIRED` (TTL passes → logged to `clock_unassigned_taps`). Expiry runs lazily in every `src/lib/clock/pending.ts` helper and via the cron route.

**`ClockEventType`:** `IN` / `OUT` — not sent by the kiosk. `recordClockEvent()` toggles: first-ever event or last event `OUT` → `IN`; otherwise `OUT`.

**Derived day flags** (`stats.ts`, vs shift 07:30–16:30): `late` (first IN after start), `early_leave` (last OUT before end), `overtime` (last OUT after end), `incomplete` (IN without OUT, or OUT without IN → also `missing_in`). Expected hours = weekdays × 9.

## Roles / personas

| Role | Route or scope | Permissions |
|------|----------------|-------------|
| Admin (`@meavo.com` user with `ToolCardAccess` on `seed-clock-tool`) | All `/(app)` pages + admin `/api/*` | Manage workers, assign/deactivate cards, view reports and audit |
| Kiosk device (holds `DEVICE_API_KEY`) | `/api/device/*` only | Post taps, read bindings for offline cache |
| Worker | None — physical card tap only | Generates clock events via the kiosk |

Access is granted/revoked in the **gateway admin** (meavo.app), not in this app.

## Mutation map

| Change | Domain module | Action / API | Notes |
|--------|---------------|--------------|-------|
| Record a tap (IN/OUT) | `src/lib/clock/events.ts` `recordClockEvent` | `POST /api/device/clock_event` | Idempotent on `idempotency_key`; 404 if UID unbound |
| Register unknown card | `src/lib/clock/pending.ts` `upsertPendingUid` | `POST /api/device/pending_uid` | Refreshes TTL if already pending |
| Assign card to worker | `src/lib/clock/pending.ts` `assignPendingUid` | `POST /api/pending_uids/[id]/assign` | Transaction: deactivate old bindings for the UID, create new, mark ASSIGNED; 410 if expired |
| Create worker | `src/lib/clock/workers.ts` `createWorker` | `POST /api/workers` | Name trimmed, required |
| Deactivate worker | `src/lib/clock/workers.ts` `deactivateWorker` | `DELETE /api/workers/[id]` | Also deactivates their active card bindings |
| Deactivate a card | `src/lib/clock/workers.ts` `deactivateCard` | `DELETE /api/card_bindings/[uid]` | Sets `deactivatedAt` |
| Expire stale pending UIDs | `src/lib/clock/pending.ts` `expirePendingUids` | `GET /api/cron/expire-pending` + lazy calls | Writes `clock_unassigned_taps` audit rows |
| Ensure shift settings | `src/lib/clock/workers.ts` `ensureWorkSettings` | (internal, via stats) | Creates the `default` singleton on first use |

## Authorization

- Resolved in: `src/lib/meavo-auth.ts` (`requireClockAccess` — pages), `src/lib/admin-api.ts` (`requireAdminApi` — API), `src/lib/device-auth.ts` (`assertDeviceAuth` — kiosk), `src/lib/google-auth.ts` (login).
- Key rules agents get wrong: tool-card access is re-checked on **every** admin API call (revocation is immediate); `ClockWorker` is unrelated to the gateway `User` table; `tappedAt` is a site-local time **string**, not UTC — compare lexicographically, never via `new Date()` in domain math.

## Legacy port index

Original Express + SQLite app (`api/`) and Vite SPA (`web/`) — read-only reference.

| Legacy | Modern |
|--------|--------|
| `api/src/clock.js` | `src/lib/clock/events.ts` |
| `api/src/pending.js` | `src/lib/clock/pending.ts` |
| `api/src/stats.js` | `src/lib/clock/stats.ts` |
| `api/src/workers.js` | `src/lib/clock/workers.ts` |
| `api/src/auth.js` (Google token + `admin_allowlist`) | NextAuth + `ToolCardAccess` (`src/lib/auth.ts`, `meavo-auth.ts`) |
| `web/src/pages/*.jsx` | `src/components/clock-pages/*.jsx` (+ thin `src/app/(app)/*/page.tsx`) |
| `web/src/api.js`, `web/src/hooks.js` | `src/lib/api.ts`, `src/lib/hooks.ts` |
