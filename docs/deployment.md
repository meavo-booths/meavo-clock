# Deploying to clock.meavo.app

Everything runs on one domain: **https://clock.meavo.app**

- Web admin → `/`
- REST API → `/api/*`
- Kiosk devices → `https://clock.meavo.app/api/device/*`

## Architecture

```text
Internet
   │
   ▼
[Nginx/Caddy]  TLS termination, clock.meavo.app:443
   │
   ▼
[Node.js :3001]  API + static web (web/dist)
   │
   ▼
[SQLite]  api/data/meavo.db
```

## 1. DNS

Add an **A** or **CNAME** record:

```text
clock.meavo.app  →  your server IP
```

## 2. Build on the server

```bash
cd /opt/meavo-clock-in   # or clone: github.com/meavo-booths/meavo-clock

# Web admin
cd web && npm ci && npm run build && cd ..

# API
cd api && npm ci
cp .env.production.example .env
# Edit .env: DEVICE_API_KEY, SESSION_SECRET, GOOGLE_CLIENT_ID, ALLOWED_ADMIN_EMAILS
```

## 3. Run with systemd (example)

```ini
# /etc/systemd/system/meavo-clock.service
[Unit]
Description=Meavo Clock-In
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/meavo-clock-in/api
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now meavo-clock
```

## 4. Nginx reverse proxy

```nginx
server {
    listen 443 ssl http2;
    server_name clock.meavo.app;

    ssl_certificate     /etc/letsencrypt/live/clock.meavo.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clock.meavo.app/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Issue certificate:

```bash
sudo certbot certonly --nginx -d clock.meavo.app
```

## 5. Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/) → OAuth client → **Authorized JavaScript origins**:

```text
https://clock.meavo.app
```

For local dev, also add `http://localhost:5173`.

## 6. Kiosk firmware

In `firmware/include/config.h`:

```cpp
#define API_BASE_URL "https://clock.meavo.app"
#define DEVICE_API_KEY "same-as-server-.env"
```

Re-flash the XIAO after changing the API key.

## 7. Verify

| Check | URL |
|-------|-----|
| Health | `https://clock.meavo.app/health` |
| Admin UI | `https://clock.meavo.app` |
| Google login | Sign in with allowlisted email |

## Local development (unchanged)

```bash
# Terminal 1
cd api && npm run dev

# Terminal 2
cd web && npm run dev   # http://localhost:5173 proxies /api
```

Use `WEB_ORIGIN=http://localhost:5173` in `api/.env` for dev.
