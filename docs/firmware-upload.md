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
| `ENABLE_DEEP_SLEEP` | `1` | `0` = stay awake (USB bench test) |
| `SLEEP_START_HOUR` / `SLEEP_END_HOUR` | `22` / `6` | Local-time overnight window (see §7) |
| `BREADBOARD_POC` | `0` | `1` = serial UID test only |

RTC uses **Europe/Sofia** local time via `TIMEZONE` in config.

## 2. Wire check

| Module | XIAO pin |
|--------|----------|
| PN532 VCC / GND / SDA / SCL | 3V3 / GND / D4 / D5 |
| DS3231 VCC / GND / SDA / SCL / SQW | 3V3 / GND / D4 / D5 / D3 |
| Passive speaker via 2N2222 | +→5V, −→collector, emitter→GND, 2kΩ→D2 |

PN532 switch: **I2C** (Ch1 ON, Ch2 OFF).

## 3. Upload (USB)

**Close the serial monitor first** (`Ctrl+C`), then:

```bash
cd firmware
pio run -t upload
pio device monitor -b 115200
```

The XIAO ESP32S3 uses **1200bps touch** so PlatformIO should enter download mode without holding BOOT.
If upload still fails, unplug/replug USB once, then retry — BOOT+RESET is only a last resort.

### After the enclosure: Wi‑Fi OTA

Once the kiosk is on Wi‑Fi (look for `OTA: ready as meavo-clock-kiosk-1…` in the log), flash without opening the box:

```bash
cd firmware
pio run -t upload --upload-protocol espota --upload-port 192.168.1.156 --upload-flags --auth=YOUR_OTA_PASSWORD
```

Use the IP printed at boot (or `meavo-clock-kiosk-1.local` if mDNS works). Set `OTA_PASSWORD` in `config.h` (same value as `--auth`).

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

## 7. Deep sleep (overnight power saving)

When `ENABLE_DEEP_SLEEP` is `1`, the kiosk powers down outside factory hours. Default window: **22:00 → 06:30** local time (`SLEEP_START_*` / `SLEEP_END_*` in `config.h`), aligned with the 07:30–16:30 shift — nobody should tap overnight.

**How it works**

1. On boot and in the main loop, firmware reads local time from the **DS3231 RTC** (kept accurate via NTP on Wi‑Fi connect, then every 6h).
2. If the time falls inside the sleep window, it computes seconds until `SLEEP_END`, mutes the buzzer, and calls **`esp_deep_sleep_start()`** with a timer wakeup.
3. The ESP32 shuts down almost everything (Wi‑Fi, RFID polling, serial). Power draw drops sharply; the unit is not listening for cards.
4. At wake time (~06:30), the chip **cold-boots**: `setup()` runs again — Wi‑Fi, NTP, bindings refresh, queue drain, OTA, then `Ready — present card` before the shift.

**Safety guard:** deep sleep only runs after a **successful NTP sync** on that boot (`lastNtpSyncMs != 0`). If the RTC still holds UTC or garbage from a dead coin cell, the kiosk stays awake and logs `Sleep: skipped (no NTP sync yet — RTC time may be UTC)` rather than sleeping through the workday.

**Bench testing:** set `ENABLE_DEEP_SLEEP 0` in `config.h` while on USB — deep sleep drops the serial monitor link and looks like a crash. Re-enable before deploying in the enclosure.

**Expected serial log when entering sleep:**

```
Sleep: entering deep sleep for 28800 seconds
```

On morning boot you see the normal startup sequence again.
