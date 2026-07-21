#pragma once

#include <ArduinoOTA.h>
#include <WiFi.h>
#include "config.h"

#ifndef ENABLE_OTA
#define ENABLE_OTA 1
#endif

inline bool otaStarted = false;

inline void otaBegin() {
#if !ENABLE_OTA
  return;
#endif
  if (otaStarted || WiFi.status() != WL_CONNECTED) return;

  String hostname = String("meavo-clock-") + STATION_ID;
  hostname.replace("_", "-");
  ArduinoOTA.setHostname(hostname.c_str());
#ifdef OTA_PASSWORD
  ArduinoOTA.setPassword(OTA_PASSWORD);
#endif

  ArduinoOTA.onStart([]() {
    Serial.println("OTA: updating firmware…");
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\nOTA: done, rebooting");
  });
  ArduinoOTA.onError([](ota_error_t err) {
    Serial.printf("OTA: error %u\n", err);
  });
  ArduinoOTA.begin();
  otaStarted = true;
  Serial.printf("OTA: ready as %s.local (or %s) — no BOOT button needed\n",
                hostname.c_str(), WiFi.localIP().toString().c_str());
}

inline void otaHandle() {
#if ENABLE_OTA
  if (otaStarted) ArduinoOTA.handle();
#endif
}
