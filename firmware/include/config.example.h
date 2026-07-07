#pragma once

// Copy this file to config.h and fill in your values.

#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASSWORD "your-wifi-password"

#define API_BASE_URL "https://clock.meavo.app"
// Dev LAN fallback: "http://192.168.1.100:3001"
#define DEVICE_API_KEY "meavo-kiosk-dev-key-change-in-production"
#define STATION_ID "kiosk-1"

// Deep sleep window (local time, 24h). Device sleeps between SLEEP_START and SLEEP_END.
#define SLEEP_START_HOUR 22
#define SLEEP_START_MINUTE 0
#define SLEEP_END_HOUR 6
#define SLEEP_END_MINUTE 30

// IANA timezone for NTP → RTC sync (factory shift is local time)
#define TIMEZONE "EET-2EEST,M3.5.0/3,M10.5.0/4"

// TLS: when API_BASE_URL is https, skip certificate validation (simplest for
// a managed host with auto-renewing certs). Set to 0 and provide API_ROOT_CA
// below to pin the certificate instead (more secure).
#define API_INSECURE_TLS 1
// #define API_ROOT_CA "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"

// Local queue safety: cap stored events on flash so a long outage cannot fill
// the filesystem. Oldest synced rows are pruned first; unsynced rows are kept.
#define QUEUE_MAX_EVENTS 2000

// Set to 1 for breadboard POC: serial UID + RTC only, no Wi-Fi/API
#define BREADBOARD_POC 0
