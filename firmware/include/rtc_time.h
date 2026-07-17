#pragma once

#include <Wire.h>
#include <RTClib.h>
#include <time.h>
#include "config.h"
#include "pins.h"

inline RTC_DS3231 rtc;
inline bool rtcPresent = false;

inline bool rtcInit() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (!rtc.begin()) {
    Serial.println("RTC: DS3231 not found — using NTP/system time");
    rtcPresent = false;
    return true; // soft-fail: continue without hardware RTC
  }
  rtcPresent = true;
  if (rtc.lostPower()) {
    Serial.println("RTC: lost power, set compile time");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  return true;
}

inline DateTime rtcNow() {
  if (rtcPresent) {
    return rtc.now();
  }
  time_t now = time(nullptr);
  if (now < 1700000000) {
    // Before NTP: approximate from compile time + millis
    static const DateTime compiled(F(__DATE__), F(__TIME__));
    return DateTime(compiled.unixtime() + (millis() / 1000));
  }
  struct tm timeinfo;
  localtime_r(&now, &timeinfo);
  return DateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                  timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
}

inline String rtcIsoNow() {
  DateTime now = rtcNow();
  char buf[32];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());
  return String(buf);
}

inline void rtcPrintNow() {
  DateTime now = rtcNow();
  Serial.printf("%s: %04d-%02d-%02d %02d:%02d:%02d\n",
                rtcPresent ? "RTC" : "Time",
                now.year(), now.month(), now.day(),
                now.hour(), now.minute(), now.second());
}

inline void rtcSyncFromNtp() {
  time_t now = time(nullptr);
  if (now < 1700000000) return;
  struct tm timeinfo;
  localtime_r(&now, &timeinfo);
  if (rtcPresent) {
    rtc.adjust(DateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                        timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
    Serial.println("RTC: synced from NTP (local time)");
  } else {
    Serial.println("Time: synced from NTP (no DS3231)");
  }
}

inline bool rtcInSleepWindow() {
  DateTime now = rtcNow();
  int minutes = now.hour() * 60 + now.minute();
  int start = SLEEP_START_HOUR * 60 + SLEEP_START_MINUTE;
  int end = SLEEP_END_HOUR * 60 + SLEEP_END_MINUTE;
  if (start > end) {
    return minutes >= start || minutes < end;
  }
  return minutes >= start && minutes < end;
}

inline uint64_t rtcSecondsUntilWake() {
  DateTime now = rtcNow();
  DateTime wake(now.year(), now.month(), now.day(), SLEEP_END_HOUR, SLEEP_END_MINUTE, 0);
  if (wake.unixtime() <= now.unixtime()) {
    wake = DateTime(now.year(), now.month(), now.day() + 1, SLEEP_END_HOUR, SLEEP_END_MINUTE, 0);
  }
  return wake.unixtime() - now.unixtime();
}
