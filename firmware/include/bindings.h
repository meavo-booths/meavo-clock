#pragma once

#include <LittleFS.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "config.h"
#include "net.h"

#define BINDINGS_CACHE "/bindings.json"
#define BINDINGS_TTL_MS 300000

inline unsigned long bindingsLastFetch = 0;

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
  Serial.println("Bindings: refreshed from API");
  return true;
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

inline bool bindingsIsAssigned(const String &uid) {
  if (WiFi.status() == WL_CONNECTED &&
      (millis() - bindingsLastFetch > BINDINGS_TTL_MS || bindingsLastFetch == 0)) {
    bindingsFetchFromApi();
  }

  bool assigned = bindingsLookup(uid);

  // If the card looks unknown but we are online, the admin may have just
  // assigned it. Force one immediate refresh and re-check before treating it
  // as a new pending enrollment. Rate-limited to avoid hammering the API.
  static unsigned long lastForcedRefresh = 0;
  if (!assigned && WiFi.status() == WL_CONNECTED && millis() - lastForcedRefresh > 5000) {
    lastForcedRefresh = millis();
    if (bindingsFetchFromApi()) {
      assigned = bindingsLookup(uid);
    }
  }

  return assigned;
}
