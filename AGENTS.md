# Agent guide — meavo-clock

Quick orientation for AI agents working in this repo. Read this before exploring blindly.

**Cursor:** `.cursor/rules/core.mdc` and `security.mdc` are always applied. `ui.mdc`, `domain.mdc`, `api.mdc`, and `legacy.mdc` apply when editing matching paths.

## What this repo does

RFID clock-in system for factory workers at [clock.meavo.app](https://clock.meavo.app): an ESP32 + PN532 kiosk posts card taps to `/api/device/*`, and admins manage workers, card bindings, timesheets, and monthly reports in a Next.js dashboard. Satellite app of [meavo-gateway](https://github.com/meavo-booths/meavo-gateway) — predates parts of [org STANDARDS](https://github.com/meavo-booths/meavo-agent-templates/blob/main/STANDARDS.md); deviations listed in `.cursor/rules/*` and [docs/architecture.md](docs/architecture.md).

## Stack

- Next.js 15 App Router, TypeScript strict (`allowJs` — legacy `.jsx` page components), React 19, Tailwind CSS 3
- Prisma 6 via `@meavo/db` (git tag `v0.8.0`) → shared Neon Postgres (`Clock*` models)
- NextAuth v5 (JWT), **Google invite-only** (`@meavo.com` emails, no credentials provider), gated on `ToolCardAccess` for `seed-clock-tool`
- Vercel (`fra1`), port 3004 locally; kiosk firmware: PlatformIO / Arduino C++ in `firmware/`

## First files to read

| Task | Start here |
|------|------------|
| Add/change an admin page | `src/app/(app)/<page>/page.tsx` → real UI in `src/components/clock-pages/*.jsx` |
| Add/change an admin API endpoint | `src/app/api/` (e.g. `workers/route.ts`) — must call `requireAdminApi()` |
| Kiosk/device endpoints | `src/app/api/device/*` — must call `assertDeviceAuth(req)` (X-Device-Key) |
| Clock in/out pairing logic | `src/lib/clock/events.ts` (`recordClockEvent`, idempotency, IN/OUT toggle) |
| Pending UID → card assignment | `src/lib/clock/pending.ts` (15-min TTL, expiry, bindings) |
| Hours / lateness / report math | `src/lib/clock/stats.ts` (shift 07:30–16:30, Europe/Sofia) |
| Workers & shift settings | `src/lib/clock/workers.ts` |
| API response shapes (snake_case) | `src/lib/clock/serialize.ts` |
| Client-side data fetching | `src/lib/api.ts` + `usePoll` in `src/lib/hooks.ts` |
| Kiosk firmware | `firmware/src/main.cpp`, `firmware/include/` |
| Auth & access | `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/meavo-auth.ts` (`requireClockAccess`), `src/lib/admin-api.ts` (`requireAdminApi`) |
| DB schema | `node_modules/@meavo/db/prisma/schema.prisma` — **edit in [meavo-db](https://github.com/meavo-booths/meavo-db) only** |
| Tests | N/A — no test suite in the Next.js app (legacy `api/` had `node --test`) |

## Do NOT

- Edit the Prisma schema here — schema lives in meavo-db; bump the git tag in `package.json` instead
- Run `prisma db push` from this repo — shared DB; the script is intentionally disabled
- Touch `api/` or `web/` for features — legacy Express/Vite trees, superseded by the root Next.js app
- Add shadcn/Radix/MUI or any component library — use the Tailwind classes in `src/app/globals.css` (`btn-primary`, `card`, `input`, …)
- Skip `requireAdminApi()` in a new `/api/*` admin route, or `assertDeviceAuth()` in a `/api/device/*` route — middleware passes `/api/*` through
- Look up the tool card by `linkedAppKey` — use `CLOCK_TOOL_CARD_ID` (`src/lib/constants.ts`)
- Change `tappedAt` semantics — it is a **string** of site-local time (`YYYY-MM-DDTHH:mm:ss`), not a `DateTime`; stats math depends on this
- Commit secrets, `.env.local`, or `firmware/include/config.h` (git-ignored; contains WiFi + device key)

## Commands

```bash
npm install
npm run dev        # http://localhost:3004
npm run lint       # next lint — no test suite
npm run build      # prisma generate && next build
```

## Conventions

1. Domain logic in `src/lib/clock/` — route handlers stay thin: auth, validate body, call domain, serialize.
2. Mutations are REST route handlers (not Server Actions — pre-standard deviation); errors thrown as `Error` with a `status` property, mapped by `jsonError()` to `{ error }` JSON.
3. API responses use snake_case via `src/lib/clock/serialize.ts` (kiosk firmware and `.jsx` pages depend on these shapes).
4. Pending-UID expiry runs lazily inside `src/lib/clock/pending.ts` helpers and via `GET /api/cron/expire-pending` (`CRON_SECRET` Bearer; not scheduled in `vercel.json`).

## Scoped task template (preferred from user)

```
Area/route: /timesheet, /api/device/*, or firmware
Behaviour: [what should happen]
Reference: [legacy api/src file or doc, if any]
Out of scope: [auth / schema / firmware / other apps]
```

## Related docs

- [docs/architecture.md](docs/architecture.md) — stack, layout, data flow, deviations
- [docs/domain.md](docs/domain.md) — clock/pending lifecycle, mutation map
- [docs/data-model.md](docs/data-model.md) — `Clock*` tables in the shared schema
- [docs/deployment.md](docs/deployment.md) — Vercel + tool card seeding; [docs/firmware-upload.md](docs/firmware-upload.md) — kiosk flashing
- [CONTRIBUTING.md](CONTRIBUTING.md) — PR process
