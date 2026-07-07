# Deploying to clock.meavo.app (Vercel)

Clock-In runs on **Vercel** (`fra1`), same as RP, Hols, and Assembly. It uses the **shared Neon Postgres** via `@meavo/db` and **NextAuth** with gateway **ToolCard** access (`seed-clock-tool`).

## Architecture

```text
clock.meavo.app (Vercel)
   ├── Next.js admin UI
   ├── /api/* admin + device routes
   └── Neon Postgres (@meavo/db — clock_* tables)

ESP32 kiosk → POST /api/device/* (X-Device-Key)
```

## 1. Database schema

Clock tables live in the shared `meavo-db` schema (v0.8.0+). Apply from the meavo-db repo:

```bash
cd ~/Desktop/CursorAI/meavo-db
cp .env.example .env   # DATABASE_URL from Neon
npm run db:push
```

## 2. Gateway tool card

Grant access via the meavo.app gateway (same as other apps):

```bash
cd ~/Desktop/CursorAI/meavo-gateway
npx tsx --env-file=.env.local scripts/seed-clock-tool-card.ts
```

Admins get the **Clock-In** card automatically. Grant other users access from the gateway admin UI.

## 3. Vercel project

```bash
cd ~/Desktop/CursorAI/meavo-clock
vercel link          # link to meavo-booths/meavo-clock
vercel env pull .env.local
```

Required environment variables (copy from other Meavo apps where shared):

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Neon pooled connection (same DB as gateway) |
| `DIRECT_DATABASE_URL` | Neon direct connection |
| `AUTH_SECRET` | Same as other apps or generate new |
| `AUTH_GOOGLE_ID` | Google OAuth client |
| `AUTH_GOOGLE_SECRET` | Google OAuth secret |
| `DEVICE_API_KEY` | Shared secret for ESP32 kiosks |
| `CLOCK_TOOL_CARD_ID` | `seed-clock-tool` (default) |
| `CRON_SECRET` | Protects `/api/cron/expire-pending` |
| `NEXT_PUBLIC_APP_URL` | `https://clock.meavo.app` |

## 4. DNS

In your DNS provider, add:

```text
clock.meavo.app  →  cname.vercel-dns.com
```

Then in Vercel → Project → Domains → add `clock.meavo.app`.

## 5. Google OAuth

Authorized JavaScript origins:

```text
https://clock.meavo.app
http://localhost:3004
```

## 6. Deploy

```bash
vercel --prod
```

## 7. Kiosk firmware

```cpp
#define API_BASE_URL "https://clock.meavo.app"
#define DEVICE_API_KEY "same-as-vercel-env"
```

## Local development

```bash
cd ~/Desktop/CursorAI/meavo-clock
cp .env.example .env.local   # fill DATABASE_URL + auth vars
npm install
npm run dev                    # http://localhost:3004
```

Legacy `api/` + `web/` folders are kept for reference; the active app is the Next.js project at the repo root.
