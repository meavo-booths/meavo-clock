# Contributing — meavo-clock

## Before you open a PR

- [ ] Changes are scoped to the request — no drive-by refactors
- [ ] `npm run lint` passes
- [ ] No test suite — document your manual check (page at 375px + 1280px, or a curl against the touched API route)
- [ ] Agent docs updated if you added routes, domain modules, crons, or auth rules (`AGENTS.md`, `docs/`, `.cursor/rules/`)
- [ ] New admin API routes call `requireAdminApi()`; new device routes call `assertDeviceAuth()`
- [ ] Device/firmware contract unchanged (snake_case fields, `idempotency_key`) — or firmware updated in the same PR

## Branch naming

`feature/short-description`, `fix/short-description`, `docs/short-description`, `firmware/short-description`

## Commit messages

Imperative mood, complete sentences: "Add overtime column to reports page."

## Code placement

| Layer | Location |
|-------|----------|
| Admin pages | `src/app/(app)/*/page.tsx` (thin) + `src/components/clock-pages/*.jsx` |
| API routes | `src/app/api/` (admin), `src/app/api/device/` (kiosk) |
| Business logic | `src/lib/clock/` |
| Auth gates | `src/lib/meavo-auth.ts`, `src/lib/admin-api.ts`, `src/lib/device-auth.ts` |
| Kiosk firmware | `firmware/` (PlatformIO) |
| Legacy (read-only) | `api/`, `web/` — never add features here |

## Cross-repo dependencies

`@meavo/db` is pinned to a git tag in `package.json`. To bump: change the ref (e.g. `#v0.8.0` → `#v0.9.0`), `npm install` (postinstall runs `prisma generate`), verify the app builds.

## Schema changes

Only in [meavo-db](https://github.com/meavo-booths/meavo-db) — edit schema there, tag a release, bump the git ref here, redeploy. Never run `prisma db push` from this repo (shared database; the script is disabled).

## PR description

Include:

1. **What** changed (user-visible, API, or firmware behaviour)
2. **Why** (link issue if any)
3. **How to verify** (commands or manual steps)
4. **Out of scope** (what you intentionally did not change)

## Agent-assisted PRs

If an AI agent wrote the code:

- Verify paths and business rules against `docs/domain.md`
- Reject leftover template placeholder comments in merged files
- Ensure no secrets in diff (`.env.local`, `firmware/include/config.h`)
