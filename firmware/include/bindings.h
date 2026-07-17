#pragma once

#include <LittleFS.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "config.h"
#include "net.h"

#define BINDINGS_CACHE "/bindings.json"
#define BINDINGS_TTL_MS 300000

inline unsigned long bindingsLastFetch = 0;
inline bool bindingsRefreshRequested = false;

inline bool bindingsFetchFromApi() {
  if (WiFi.status() != WL_CONNECTED) return false;

  String url = String(API_BASE_URL) + "/api/device/bindings";
  NetResponse resp = netRequest(url, "");
  if (resp.status != 200) return false;

  File f = LittleFS.open(BINDINGS_CACHE, "w");
  if (!f) return false;
  f.print(resp.body);
  f.close();
  bindingsLastFetch = millis();
  bindingsRefreshRequested = false;
  Serial.println("Bindings: refreshed from API");
  return true;
}

inline void bindingsRequestRefresh() {
  bindingsRefreshRequested = true;
}

// Call from loop() only — never from the tap handler.
inline void bindingsMaintain() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool stale = bindingsLastFetch == 0 ||
               (millis() - bindingsLastFetch > BINDINGS_TTL_MS);
  if (!bindingsRefreshRequested && !stale) return;

  bindingsFetchFromApi();
}

inline bool bindingsLookup(const String &uid) {
  if (!LittleFS.exists(BINDINGS_CACHE)) return false;

  File f = LittleFS.open(BINDINGS_CACHE, "r");
  if (!f) return false;
  String payload = f.readString();
  f.close();

  JsonDocument doc;
  if (deserializeJson(doc, payload) != DeserializationError::Ok) return false;

  String upper = uid;
  upper.toUpperCase();
  for (JsonObject row : doc.as<JsonArray>()) {
    String cached = row["uid"].as<String>();
    cached.toUpperCase();
    if (cached == upper) return true;
  }
  return false;
}

// Local cache only — never hits the network (keeps taps responsive).
inline bool bindingsIsAssigned(const String &uid) {
  return bindingsLookup(uid);
}
