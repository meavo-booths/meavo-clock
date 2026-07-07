# Meavo Clock-In

RFID clock-in kiosk (Seeed XIAO ESP32S3 + PN532) with branded admin at **[clock.meavo.app](https://clock.meavo.app)**.

Part of the [meavo-booths](https://github.com/meavo-booths) org alongside `meavo-rp`, `hols`, `assembly`, etc.

## Project structure

```
firmware/     PlatformIO firmware for XIAO ESP32S3
api/          Node.js REST API (SQLite) — serves web in production
web/          Admin web app (React + Tailwind, Meavo brand)
docs/         BOM, enclosure, firmware upload, deployment
```

## Production — clock.meavo.app

Single domain serves admin UI and API:

| Path | Purpose |
|------|---------|
| `https://clock.meavo.app/` | Admin web app |
| `https://clock.meavo.app/api/*` | REST API + kiosk endpoints |

Full deploy guide: **[docs/deployment.md](docs/deployment.md)**

```bash
cd web && npm ci && npm run build
cd ../api && cp .env.production.example .env   # edit secrets
NODE_ENV=production npm start
```

## Database

SQLite file: `api/data/meavo.db` (created on first API start).

```bash
npm run db:inspect   # print tables, counts, recent rows
npm run db:seed      # add sample workers + events (dev)
sqlite3 api/data/meavo.db   # interactive SQL shell
```

Full guide: **[docs/database.md](docs/database.md)**

## Local development

### API

Requires **Node.js 22.5+**.

```bash
cd api
cp .env.example .env
npm install
npm run dev
```

Runs at http://localhost:3001

### Web admin

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Opens at http://localhost:5173 (proxies `/api` to the API)

### Firmware

See [docs/firmware-upload.md](docs/firmware-upload.md).

```bash
cp firmware/include/config.example.h firmware/include/config.h
# Production: API_BASE_URL https://clock.meavo.app
cd firmware && pio run -t upload
```

## Google OAuth setup

1. Create a **Web application** OAuth client in [Google Cloud Console](https://console.cloud.google.com/)
2. Authorized JavaScript origins:
   - `https://clock.meavo.app` (production)
   - `http://localhost:5173` (local dev)
3. Copy Client ID to `api/.env` and `web/.env` (`VITE_GOOGLE_CLIENT_ID`)
4. Set `SESSION_SECRET` and `ALLOWED_ADMIN_EMAILS`

## Environment

| Variable | Description |
|----------|-------------|
| `PUBLIC_URL` | `https://clock.meavo.app` in production |
| `WEB_ORIGIN` | CORS origin — `https://clock.meavo.app` |
| `DEVICE_API_KEY` | Shared secret for kiosk (`X-Device-Key` header) |
| `GOOGLE_CLIENT_ID` | Google SSO |
| `SESSION_SECRET` | JWT session signing |
| `ALLOWED_ADMIN_EMAILS` | Comma-separated admin emails |
| `SERVE_STATIC` | `1` — serve `web/dist` from API (auto on `NODE_ENV=production`) |
| `TRUST_PROXY` | `1` — required behind Nginx/Caddy TLS |

## Working hours

Default shift: **07:30–16:30** (Europe/Sofia). Daily hours = gross (first clock-in to last clock-out).
