# Firmware upload guide

## 1. Create `config.h`

```bash
cp firmware/include/config.example.h firmware/include/config.h
```

Edit `firmware/include/config.h`:

| Define | Example | Notes |
|--------|---------|-------|
| `WIFI_SSID` | `"Factory-WiFi"` | 2.4 GHz network |
| `WIFI_PASSWORD` | `"your-password"` | |
| `API_BASE_URL` | `"https://clock.meavo.app"` | Production. Dev: `http://192.168.x.x:3001` |
| `DEVICE_API_KEY` | same as `api/.env` | |
| `STATION_ID` | `"kiosk-1"` | |
| `BREADBOARD_POC` | `0` | `1` = serial UID test only |

RTC uses **Europe/Sofia** local time via `TIMEZONE` in config.

## 2. Wire check

| Module | XIAO pin |
|--------|----------|
| PN532 VCC / GND / SDA / SCL | 3V3 / GND / D4 / D5 |
| DS3231 VCC / GND / SDA / SCL / SQW | 3V3 / GND / D4 / D5 / D3 |
| Passive buzzer + / − | D2 / GND |

PN532 switch: **I2C** (Ch1 ON, Ch2 OFF).

## 3. Upload

```bash
cd firmware
pio run -t upload
pio device monitor -b 115200
```

## 4. Expected output

```
Meavo Clock-In Kiosk
RFID: PN532 firmware 0x...
RTC: 2026-07-04 14:30:00
WiFi: connecting to Factory-WiFi
WiFi: connected, IP 192.168.x.x
RTC: synced from NTP (local time)
Bindings: refreshed from API
Ready — present card
```

## 5. Offline resilience

The kiosk is built to keep working through network and internet outages:

- **Every tap is written to flash first** (`/queue.jsonl`), then uploaded — the worker is never blocked on the network.
- **DS3231 RTC** timestamps taps correctly even with no internet; NTP re-syncs on reconnect and every 6h.
- **Auto-reconnect**: the Wi-Fi radio reconnects on its own; the firmware also retries every 20s and drains the queue when the link returns. Reconnect no longer blocks card reads.
- **Batched drain**: after an outage the backlog uploads 10 events per sync cycle, streamed through a temp file — memory use stays flat and card reads stay responsive even with thousands of queued taps.
- **Idempotency keys** on clock events prevent duplicates when a retry succeeds after a timeout. Keys include a per-boot nonce, so even an RTC losing time can't cause two different taps to collide and be silently dropped.
- **Cached bindings** (`/bindings.json`) let known cards clock in while offline. On an unknown tap while online, bindings refresh once immediately so a just-assigned card works without waiting for the 5-min cache.
- **Queue cap** (`QUEUE_MAX_EVENTS`, default 2000): oldest already-synced rows are pruned so a long outage cannot fill the filesystem; unsynced taps are never dropped.

## 6. HTTPS / TLS

When `API_BASE_URL` is `https://` (e.g. `clock.meavo.app`), the firmware uses `WiFiClientSecure`.

- Default: `API_ROOT_CA` pins **ISRG Root X1** (Let's Encrypt), the root CA for `clock.meavo.app` certs. Certificate renewals don't require re-flashing — only a CA change would (pinned root is valid until 2035).
- `API_INSECURE_TLS 1` (with `API_ROOT_CA` removed) skips validation entirely — bench testing only. It lets anyone on the WiFi intercept the device key; never deploy a kiosk with it.

Test on the bench before deploying: tap with Wi-Fi off (events queue), restore Wi-Fi, and confirm `Queue: synced ...` appears in the serial log.
