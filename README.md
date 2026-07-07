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

## Production

Deploy guide: **[docs/deployment.md](docs/deployment.md)**

```bash
vercel --prod
```

## Firmware

See [docs/firmware-upload.md](docs/firmware-upload.md). Set `API_BASE_URL` to `https://clock.meavo.app`.
