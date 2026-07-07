#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "config.h"

// Shared network helper that transparently handles http:// and https://
// targets. For https it uses WiFiClientSecure (pinned CA if API_ROOT_CA is
// defined, otherwise insecure per API_INSECURE_TLS).

struct NetResponse {
  int status;   // HTTP status, or negative on transport error
  String body;
};

inline bool netIsHttps() {
  return String(API_BASE_URL).startsWith("https://");
}

inline void netApplyTls(WiFiClientSecure &client) {
#ifdef API_ROOT_CA
  client.setCACert(API_ROOT_CA);
#elif API_INSECURE_TLS
  client.setInsecure();
#endif
  client.setTimeout(10000);
}

// Performs a GET or POST. If body is empty, a GET is issued.
inline NetResponse netRequest(const String &url, const String &body) {
  NetResponse resp{-1, ""};
  if (WiFi.status() != WL_CONNECTED) return resp;

  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(10000);
  bool began = false;

  if (netIsHttps()) {
    WiFiClientSecure client;
    netApplyTls(client);
    began = http.begin(client, url);
    if (!began) return resp;
    http.addHeader("X-Device-Key", DEVICE_API_KEY);
    if (body.length()) {
      http.addHeader("Content-Type", "application/json");
      resp.status = http.POST(body);
    } else {
      resp.status = http.GET();
    }
    if (resp.status > 0) resp.body = http.getString();
    http.end();
  } else {
    WiFiClient client;
    began = http.begin(client, url);
    if (!began) return resp;
    http.addHeader("X-Device-Key", DEVICE_API_KEY);
    if (body.length()) {
      http.addHeader("Content-Type", "application/json");
      resp.status = http.POST(body);
    } else {
      resp.status = http.GET();
    }
    if (resp.status > 0) resp.body = http.getString();
    http.end();
  }

  return resp;
}
