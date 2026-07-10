# Data model — meavo-clock

Canonical schema lives in **[meavo-db](https://github.com/meavo-booths/meavo-db)** (`prisma/schema.prisma`, section `// ---- Clock-In (owner: clock app, clock.meavo.app) ----`). All Meavo apps share one Neon Postgres database.

Local reference: `node_modules/@meavo/db/prisma/schema.prisma`

**Do not edit schema in this repo** — this repo is a consumer. Change the schema in meavo-db, tag a release, then bump the `@meavo/db` git ref in `package.json` and run `npm install` (postinstall runs `prisma generate`). `npm run db:push` is intentionally disabled here.

Pinned version: `@meavo/db` → `git+https://github.com/meavo-booths/meavo-db.git#v0.8.0`

## Entity relationship

```
User ──< ToolCardAccess >── ToolCard          (gateway-owned; login gate only)

ClockWorker ──< ClockCardBinding              (one ACTIVE binding per UID)
     │
     └──< ClockEvent  (IN/OUT taps, unique idempotencyKey)

ClockPendingUid ──< ClockUnassignedTap        (expired pendings audit)

ClockWorkSettings (singleton id="default")
```

## Core tables / models

### `ClockWorker` → `clock_workers`

Factory employee. Soft-deleted via `active: false` (history preserved).

| Field | Notes |
|-------|-------|
| `name` | Display name; only required field |
| `active` | Deactivating also deactivates the worker's card bindings |

### `ClockCardBinding` → `clock_card_bindings`

RFID UID → worker mapping. Assigning a UID deactivates any previous active binding for that UID (in one transaction).

| Field | Notes |
|-------|-------|
| `uid` | Normalized (trim + uppercase); indexed with `active` |
| `active` / `deactivatedAt` | Never delete rows — deactivate |

### `ClockPendingUid` → `clock_pending_uids`

Unknown card tap awaiting admin assignment.

| Field | Notes |
|-------|-------|
| `status` | `PENDING` / `ASSIGNED` / `EXPIRED` (`ClockPendingStatus`) |
| `expiresAt` | `DateTime`, 15 minutes after tap; refreshed if the card taps again |
| `tappedAt` | **String** site-local time — see below |

### `ClockUnassignedTap` → `clock_unassigned_taps`

Audit log written when a pending UID expires unassigned. `pendingUidId` links back (nullable).

### `ClockEvent` → `clock_events`

An IN or OUT tap. Event type is derived server-side (toggle from the worker's last event), not sent by the kiosk.

| Field | Notes |
|-------|-------|
| `idempotencyKey` | Unique — kiosk retries after offline queueing return the existing row (200 vs 201) |
| `eventType` | `IN` / `OUT` (`ClockEventType`) |
| `tappedAt` | **String** `YYYY-MM-DDTHH:mm:ss` in site-local time (`Europe/Sofia`), indexed. Compared lexicographically in queries and stats math — do not convert to `DateTime` |
| `stationId` | Free-form kiosk identifier |

### `ClockWorkSettings` → `clock_work_settings`

Singleton (`id = "default"`): `shiftStart` (07:30), `shiftEnd` (16:30), `timezone` (Europe/Sofia). Created on first stats read by `ensureWorkSettings()`.

## Shared tables this app reads

`User`, `Account` (Google sign-in link), `ToolCard` / `ToolCardAccess` (access gate for `CLOCK_TOOL_CARD_ID`). Owned by gateway — never write to these except the `Account` upsert in `src/lib/google-auth.ts`.

## Sync / external copies

N/A — the shared Neon DB is the sole system of record. The kiosk keeps a local UID-binding cache and offline tap queue, reconciled through the idempotent device API. (Legacy SQLite in `api/data/` is dead.)

## Queries agents should reuse

All Prisma access goes through the `prisma` singleton (`src/lib/prisma.ts`) and the domain helpers in `src/lib/clock/` (`recordClockEvent`, `isUidAssigned`, `assignPendingUid`, `getActiveBindings`, `getDashboard`, `getWorkerMonthlySummary`, …). No raw SQL in this repo — keep it that way unless documented here.
