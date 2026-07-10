# Meavo Clock-In

RFID clock-in kiosk (Seeed XIAO ESP32S3 + PN532) with admin at **[clock.meavo.app](https://clock.meavo.app)**.

Part of the [meavo-booths](https://github.com/meavo-booths) org. Uses the **shared Neon database** (`@meavo/db`) and **gateway ToolCard** permissions like RP, Hols, and Assembly.

**Local checkout:** `~/Desktop/CursorAI/meavo-clock`

## Stack

| Layer | Technology |
|-------|------------|
| Admin + API | Next.js 15 on Vercel |
| Database | Neon Postgres via `@meavo/db` |
| Auth | NextAuth + Google (`@meavo.com`) + `seed-clock-tool` card |
| Kiosk | ESP32 firmware → `/api/device/*` |

## Quick start

```bash
cd ~/Desktop/CursorAI/meavo-clock
cp .env.example .env.local
# Fill DATABASE_URL, AUTH_* from your Neon / Google OAuth setup
npm install
npm run dev    # http://localhost:3004
```

Before first login, seed the gateway tool card (see [docs/deployment.md](docs/deployment.md)).

## Project structure

```
src/          Next.js app (admin UI + API routes)
firmware/     PlatformIO ESP32 kiosk
docs/         BOM, deployment, firmware upload
api/          Legacy Express app (superseded)
web/          Legacy Vite app (superseded)
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Quick orientation for AI coding agents |
| [.cursor/rules/](.cursor/rules/) | Always-on Cursor rules (stack, security, UI, domain, API, legacy) |
| [docs/architecture.md](docs/architecture.md) | Stack, layout, data flow |
| [docs/domain.md](docs/domain.md) | Business rules, pending-UID lifecycle, mutation map |
| [docs/data-model.md](docs/data-model.md) | `Clock*` tables in the shared schema |
| [docs/deployment.md](docs/deployment.md) | Vercel deploy + tool card seeding |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PR process |

## Production

Deploy guide: **[docs/deployment.md](docs/deployment.md)**

```bash
vercel --prod
```

## Firmware

See [docs/firmware-upload.md](docs/firmware-upload.md). Set `API_BASE_URL` to `https://clock.meavo.app`.
