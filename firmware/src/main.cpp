#include <Arduino.h>
#include <WiFi.h>
#include <time.h>
#include <esp_sleep.h>
#include "config.h"
#include "pins.h"
#include "feedback.h"
#include "rtc_time.h"
#include "rfid.h"
#include "queue.h"
#include "bindings.h"

static const unsigned long TAP_DEBOUNCE_MS = 800; // ignore same UID re-reads while card is held
static const unsigned long SYNC_INTERVAL_MS = 2000;
static const unsigned long RFID_POLL_MS = 50;
static const unsigned long WIFI_RETRY_MS = 20000;
static const unsigned long NTP_RESYNC_MS = 6UL * 60 * 60 * 1000; // every 6h

static String lastUid;
static String bootNonce;
static unsigned long lastTapMs = 0;
static unsigned long lastSyncMs = 0;
static unsigned long lastWifiAttemptMs = 0;
static unsigned long lastNtpSyncMs = 0;
static bool wifiWasConnected = false;

static void ntpSync() {
  // configTzTime applies POSIX TZ reliably on ESP32; setenv+configTime(0,0)
  // often left localtime_r() at UTC, so the DS3231 stayed 3h behind and the
  // overnight sleep window fired mid-morning.
  configTzTime(TIMEZONE, "pool.ntp.org", "time.nist.gov");

  struct tm timeinfo = {};
  bool gotLocal = false;
  for (int i = 0; i < 40; i++) {
    if (getLocalTime(&timeinfo, 500)) {
      gotLocal = true;
      break;
    }
  }
  if (!gotLocal) {
    Serial.println("NTP: failed to get local time");
    return;
  }

  Serial.printf("NTP: local %04d-%02d-%02d %02d:%02d:%02d\n",
                timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);

  if (rtcPresent) {
    rtc.adjust(DateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                        timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
    Serial.println("RTC: written from NTP (local time)");
  }
  lastNtpSyncMs = millis();
}

// Kick off a connection attempt. The radio's own auto-reconnect keeps the link
// up between attempts, so this only blocks briefly on the initial boot connect.
static void wifiConnect(bool blockOnBoot) {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiAttemptMs = millis();
  Serial.printf("WiFi: connecting to %s\n", WIFI_SSID);

  if (!blockOnBoot) return;

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
}

// Non-blocking maintenance: detects link transitions, retries periodically
// while offline, and re-syncs NTP on (re)connect and on a slow cadence.
static void wifiMaintain() {
  bool connected = WiFi.status() == WL_CONNECTED;

  if (connected && !wifiWasConnected) {
    Serial.print("WiFi: connected, IP ");
    Serial.println(WiFi.localIP());
    ntpSync();
    bindingsFetchFromApi();
    queueSyncFifo();
  } else if (!connected && wifiWasConnected) {
    Serial.println("WiFi: link lost, events will queue locally");
  }
  wifiWasConnected = connected;

  if (!connected && millis() - lastWifiAttemptMs > WIFI_RETRY_MS) {
    Serial.println("WiFi: retrying...");
    wifiConnect(false);
  }

  if (connected && millis() - lastNtpSyncMs > NTP_RESYNC_MS) {
    ntpSync();
  }
}

// The boot nonce guards against key collisions when the RTC loses time (e.g.
// coin cell dies): two genuinely different taps could otherwise produce the
// same station+uid+timestamp key and the API would silently drop the second.
// Keys stay stable across retries because they are stored with the queued
// event at tap time.
static String makeIdempotencyKey(const String &uid, const String &tappedAt) {
  return String(STATION_ID) + "-" + uid + "-" + tappedAt + "-" + bootNonce;
}

#ifndef ENABLE_DEEP_SLEEP
#define ENABLE_DEEP_SLEEP 1
#endif

static void enterDeepSleep() {
#if !ENABLE_DEEP_SLEEP
  return;
#endif
  uint64_t secs = rtcSecondsUntilWake();
  Serial.printf("Sleep: entering deep sleep for %llu seconds\n", secs);
  buzzerMute();
  esp_sleep_enable_timer_wakeup(secs * 1000000ULL);
  esp_deep_sleep_start();
}

static void handleTap(const String &uid) {
  unsigned long now = millis();
  if (uid == lastUid && (now - lastTapMs) < TAP_DEBOUNCE_MS) return;
  lastUid = uid;
  lastTapMs = now;

  String tappedAt = rtcIsoNow();
  Serial.printf("Tap: UID=%s at %s\n", uid.c_str(), tappedAt.c_str());

#if BREADBOARD_POC
  Serial.println("POC: would process tap (assign check skipped in POC)");
  beepSuccess();
  ledSuccess();
  return;
#endif

  // Local cache only — no network in the tap path (HTTPS was delaying the next card).
  bool assigned = bindingsLookup(uid);
  if (assigned) {
    beepSuccess();
    ledSuccess();
  } else {
    beepUnknown();
    ledUnknown();
    bindingsRequestRefresh(); // pick up admin assignments on next idle loop
  }

  QueueEvent ev;
  ev.uid = uid;
  ev.tappedAt = tappedAt;
  ev.idempotencyKey = makeIdempotencyKey(uid, tappedAt);

  if (assigned) {
    ev.type = "clock";
    queueAppend(ev);
    Serial.println("Tap: clock event queued");
  } else {
    ev.type = "pending";
    queueAppend(ev);
    Serial.println("Tap: pending UID queued");
  }
}

void setup() {
  Serial.begin(115200);
  // USB CDC on XIAO: wait briefly so the monitor can attach after reset
  unsigned long serialWait = millis();
  while (!Serial && millis() - serialWait < 2000) {
    delay(10);
  }
  delay(200);
  Serial.println("\nMeavo Clock-In Kiosk");

  bootNonce = String((uint32_t)esp_random(), HEX);

  feedbackInit();
  beepBoot(); // confirms transistor+speaker wiring at boot
  Serial.println("Buzzer: boot beep");

  if (!rtcInit()) {
    Serial.println("FATAL: I2C/RTC init failed");
    while (true) delay(1000);
  }
  rtcPrintNow();

  if (!rfidInit()) {
    Serial.println("FATAL: RFID init failed");
    while (true) delay(1000);
  }

#if BREADBOARD_POC
  Serial.println("Mode: BREADBOARD POC — tap cards to read UID + RTC timestamp");
  return;
#endif

  if (!queueInit()) {
    Serial.println("FATAL: queue init failed");
    while (true) delay(1000);
  }

  // Sync clock BEFORE sleep check. A DS3231 left on UTC (e.g. 05:40 when
  // local is 08:40) sits inside the overnight window and would sleep all morning.
  wifiConnect(true);
  wifiMaintain();
  rtcPrintNow();

#if ENABLE_DEEP_SLEEP
  if (lastNtpSyncMs != 0 && rtcInSleepWindow()) {
    enterDeepSleep();
  } else if (lastNtpSyncMs == 0) {
    Serial.println("Sleep: skipped (no NTP sync yet — RTC time may be UTC)");
  }
#else
  Serial.println("Sleep: deep sleep disabled (ENABLE_DEEP_SLEEP 0)");
#endif

  Serial.println("Ready — present card");
}

void loop() {
#if BREADBOARD_POC
  String uid;
  if (rfidReadUid(uid)) {
    unsigned long now = millis();
    if (uid != lastUid || (now - lastTapMs) >= TAP_DEBOUNCE_MS) {
      lastUid = uid;
      lastTapMs = now;
      Serial.printf("UID: %s\n", uid.c_str());
      rtcPrintNow();
      beepSuccess();
      ledSuccess();
      delay(500);
    }
  }
  delay(RFID_POLL_MS);
  return;
#endif

#if ENABLE_DEEP_SLEEP
  if (lastNtpSyncMs != 0 && rtcInSleepWindow()) {
    enterDeepSleep();
  }
#endif

  // Always poll RFID first. Network is deferred until the reader has been
  // quiet for a while — otherwise a bindings/queue HTTPS call (seconds)
  // blocks the next card even when the tap handler itself is offline.
  String uid;
  if (rfidReadUid(uid)) {
    handleTap(uid);
  }

  const bool idleForNet = (millis() - lastTapMs) > 2500;
  if (idleForNet) {
    wifiMaintain();

    // At most one HTTPS operation per loop iteration.
    if (bindingsRefreshRequested ||
        bindingsLastFetch == 0 ||
        (millis() - bindingsLastFetch > BINDINGS_TTL_MS)) {
      bindingsMaintain();
    } else if (millis() - lastSyncMs >= SYNC_INTERVAL_MS) {
      lastSyncMs = millis();
      if (WiFi.status() == WL_CONNECTED) {
        queueSyncFifo(); // posts at most 1 event (QUEUE_SYNC_BATCH)
      }
    }
  }

  delay(RFID_POLL_MS);
}
