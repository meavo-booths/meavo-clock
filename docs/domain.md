# Domain reference — meavo-clock

Business rules and **where to change what**. For stack see [architecture.md](architecture.md). For tables see [data-model.md](data-model.md).

## Glossary

| Term | Meaning |
|------|---------|
| Worker | Gateway `User` shown in clock; RFID state lives on linked `ClockWorker` (`userId`). Workers don't log into clock |
| Card binding | Active RFID UID → `ClockWorker` mapping (`ClockCardBinding`); one active binding per UID |
| Pending UID | Unknown card tap awaiting admin assignment, 15-minute TTL (`ClockPendingUid`) |
| Unassigned tap | Audit record of a pending UID that expired unassigned (`ClockUnassignedTap`) |
| Clock event | An IN or OUT tap (`ClockEvent`), deduplicated by `idempotencyKey` |
| Station | Kiosk identifier string sent by the ESP32 (`stationId`) |
| Work settings | Singleton shift config: 07:30–16:30, `Europe/Sofia` (`ClockWorkSettings`) |
| UID | RFID card serial, normalized trim + uppercase (`normalizeUid`) |

## Status / state values

**`ClockPendingStatus`:** `PENDING` → `ASSIGNED` (admin assigns within TTL), `CANCELLED` (admin dismisses; no audit row; same UID can pending again), or `EXPIRED` (TTL passes → logged to `clock_unassigned_taps`). Expiry runs lazily in every `src/lib/clock/pending.ts` helper and via the cron route.

**`ClockEventType`:** `IN` / `OUT` — not sent by the kiosk. `recordClockEvent()` toggles: first-ever event or last event `OUT` → `IN`; otherwise `OUT`.

**Derived day flags** (`stats.ts`, vs shift 07:30–16:30): `late` (first IN after start), `early_leave` (last OUT before end), `overtime` (last OUT after end), `incomplete` (IN without OUT, or OUT without IN → also `missing_in`). Expected hours = weekdays × 9.

## Roles / personas

| Role | Route or scope | Permissions |
|------|----------------|-------------|
| Admin (`@meavo.com` user with `ToolCardAccess` on `seed-clock-tool`) | All `/(app)` pages + admin `/api/*` | Assign/deactivate cards, view reports and audit |
| Kiosk device (holds `DEVICE_API_KEY`) | `/api/device/*` only | Post taps, read bindings for offline cache |
| Worker (gateway `User`) | None in clock — physical card tap only | Created in gateway Admin → Users; generates clock events via the kiosk |

Access is granted/revoked in the **gateway admin** (meavo.app), not in this app. Floor workers do **not** need Clock tool-card access.

## Mutation map

| Change | Domain module | Action / API | Notes |
|--------|---------------|--------------|-------|
| Record a tap (IN/OUT) | `src/lib/clock/events.ts` `recordClockEvent` | `POST /api/device/clock_event` | Idempotent on `idempotency_key`; 404 if UID unbound |
| Register unknown card | `src/lib/clock/pending.ts` `upsertPendingUid` | `POST /api/device/pending_uid` | Refreshes TTL if already pending |
| Assign card to worker | `src/lib/clock/pending.ts` `assignPendingUid` | `POST /api/pending_uids/[id]/assign` | `worker_id` is **User id**; upserts `ClockWorker` then binds; 410 if expired |
| Cancel pending UID | `src/lib/clock/pending.ts` `cancelPendingUid` | `POST /api/pending_uids/[id]/cancel` | Sets `CANCELLED`; no unassigned-tap audit |
| Create worker | (gateway) | Gateway Admin → Users `createUser` | Not creatable in clock (`POST /api/workers` → 405) |
| Deactivate worker | `src/lib/clock/workers.ts` `deactivateWorker` | `DELETE /api/workers/[id]` | Id is User id; soft-deactivates linked `ClockWorker` + bindings |
| Deactivate a card | `src/lib/clock/workers.ts` `deactivateCard` | `DELETE /api/card_bindings/[uid]` | Sets `deactivatedAt` |
| Expire stale pending UIDs | `src/lib/clock/pending.ts` `expirePendingUids` | `GET /api/cron/expire-pending` + lazy calls | Writes `clock_unassigned_taps` audit rows |
| Ensure shift settings | `src/lib/clock/workers.ts` `ensureWorkSettings` | (internal, via stats) | Creates the `default` singleton on first use |

## Authorization

- Resolved in: `src/lib/meavo-auth.ts` (`requireClockAccess` — pages), `src/lib/admin-api.ts` (`requireAdminApi` — API), `src/lib/device-auth.ts` (`assertDeviceAuth` — kiosk), `src/lib/google-auth.ts` (login).
- Key rules agents get wrong: tool-card access is re-checked on **every** admin API call (revocation is immediate); public worker ids in the admin UI are gateway **User** ids (bindings/events still FK to `ClockWorker`); `tappedAt` is a site-local time **string**, not UTC — compare lexicographically, never via `new Date()` in domain math.

## Legacy port index

Original Express + SQLite app (`api/`) and Vite SPA (`web/`) — read-only reference.

| Legacy | Modern |
|--------|--------|
| `api/src/clock.js` | `src/lib/clock/events.ts` |
| `api/src/pending.js` | `src/lib/clock/pending.ts` |
| `api/src/stats.js` | `src/lib/clock/stats.ts` |
| `api/src/workers.js` | `src/lib/clock/workers.ts` |
