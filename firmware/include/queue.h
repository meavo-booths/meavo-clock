#pragma once

#include <LittleFS.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include "config.h"
#include "net.h"

#define QUEUE_PATH "/queue.jsonl"
#define QUEUE_TMP_PATH "/queue.tmp"

// Max events POSTed per sync pass. Keeps the kiosk responsive after a long
// outage: the backlog drains in slices on the periodic sync cycle instead of
// blocking card reads for minutes.
#define QUEUE_SYNC_BATCH 1

struct QueueEvent {
  String type; // "clock" or "pending"
  String uid;
  String tappedAt;
  String idempotencyKey;
  bool synced;
};

inline bool queueInit() {
  if (!LittleFS.begin(true)) {
    Serial.println("Queue: LittleFS mount failed");
    return false;
  }
  if (!LittleFS.exists(QUEUE_PATH)) {
    File f = LittleFS.open(QUEUE_PATH, "w");
    if (!f) return false;
    f.close();
  }
  return true;
}

inline bool queueAppend(const QueueEvent &ev) {
  File f = LittleFS.open(QUEUE_PATH, "a");
  if (!f) return false;
  JsonDocument doc;
  doc["type"] = ev.type;
  doc["uid"] = ev.uid;
  doc["tapped_at"] = ev.tappedAt;
  doc["idempotency_key"] = ev.idempotencyKey;
  doc["synced"] = false;
  serializeJson(doc, f);
  f.println();
  f.close();
  return true;
}

inline int queueCountUnsynced() {
  File f = LittleFS.open(QUEUE_PATH, "r");
  if (!f) return 0;
  int count = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.isEmpty()) continue;
    JsonDocument doc;
    if (deserializeJson(doc, line) == DeserializationError::Ok && !doc["synced"].as<bool>()) {
      count++;
    }
  }
  f.close();
  return count;
}

// Rewrites the queue keeping every unsynced event and only the most recent
// synced events, so total rows stay under QUEUE_MAX_EVENTS. Streams through a
// temp file line by line — never loads the queue into RAM.
inline void queueCompact() {
  File f = LittleFS.open(QUEUE_PATH, "r");
  if (!f) return;

  int total = 0;
  int synced = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.isEmpty()) continue;
    total++;
    JsonDocument doc;
    if (deserializeJson(doc, line) == DeserializationError::Ok && doc["synced"].as<bool>()) {
      synced++;
    }
  }
  f.close();

  if (total <= QUEUE_MAX_EVENTS) return;

  // Drop oldest synced rows until within cap (never drop unsynced rows).
  int toDrop = total - QUEUE_MAX_EVENTS;
  if (toDrop > synced) toDrop = synced;
  if (toDrop <= 0) return;

  File in = LittleFS.open(QUEUE_PATH, "r");
  if (!in) return;
  File out = LittleFS.open(QUEUE_TMP_PATH, "w");
  if (!out) {
    in.close();
    return;
  }

  int dropped = 0;
  while (in.available()) {
    String line = in.readStringUntil('\n');
    line.trim();
    if (line.isEmpty()) continue;
    JsonDocument doc;
    bool isSynced =
        deserializeJson(doc, line) == DeserializationError::Ok && doc["synced"].as<bool>();
    if (isSynced && dropped < toDrop) {
      dropped++;
      continue;
    }
    out.println(line);
  }
  in.close();
  out.close();

  LittleFS.remove(QUEUE_PATH);
  LittleFS.rename(QUEUE_TMP_PATH, QUEUE_PATH);
  Serial.printf("Queue: compacted, dropped %d synced rows\n", dropped);
}

inline bool queuePostEvent(const QueueEvent &ev) {
  String url;
  String body;
  JsonDocument doc;
  doc["uid"] = ev.uid;
  doc["station_id"] = STATION_ID;
  doc["tapped_at"] = ev.tappedAt;

  if (ev.type == "clock") {
    url = String(API_BASE_URL) + "/api/device/clock_event";
    doc["idempotency_key"] = ev.idempotencyKey;
  } else {
    url = String(API_BASE_URL) + "/api/device/pending_uid";
  }
  serializeJson(doc, body);

  NetResponse resp = netRequest(url, body);
  return resp.status == 200 || resp.status == 201;
}

// Drains up to QUEUE_SYNC_BATCH unsynced events in FIFO order, streaming the
// file through a temp copy so memory use stays constant regardless of queue
// size. A failed POST stops further posting (preserves FIFO); remaining rows
// are copied through untouched and retried on the next cycle.
inline void queueSyncFifo() {
  if (WiFi.status() != WL_CONNECTED) return;

  File in = LittleFS.open(QUEUE_PATH, "r");
  if (!in) return;
  File out = LittleFS.open(QUEUE_TMP_PATH, "w");
  if (!out) {
    in.close();
    return;
  }

  int attempted = 0;
  bool anySynced = false;
  bool stopPosting = false;

  while (in.available()) {
    String line = in.readStringUntil('\n');
    line.trim();
    if (line.isEmpty()) continue;

    JsonDocument doc;
    bool parsed = deserializeJson(doc, line) == DeserializationError::Ok;
    if (!parsed || doc["synced"].as<bool>() || stopPosting || attempted >= QUEUE_SYNC_BATCH) {
      out.println(line);
      continue;
    }

    attempted++;
    QueueEvent ev;
    ev.type = doc["type"].as<String>();
    ev.uid = doc["uid"].as<String>();
    ev.tappedAt = doc["tapped_at"].as<String>();
    ev.idempotencyKey = doc["idempotency_key"].as<String>();

    if (queuePostEvent(ev)) {
      doc["synced"] = true;
      anySynced = true;
      String updated;
      serializeJson(doc, updated);
      out.println(updated);
      Serial.printf("Queue: synced %s %s\n", ev.type.c_str(), ev.uid.c_str());
    } else {
      out.println(line);
      stopPosting = true;
      Serial.println("Queue: sync failed, stopping FIFO drain");
    }
  }
  in.close();
  out.close();

  if (anySynced) {
    LittleFS.remove(QUEUE_PATH);
    LittleFS.rename(QUEUE_TMP_PATH, QUEUE_PATH);
    queueCompact();
  } else {
    LittleFS.remove(QUEUE_TMP_PATH);
  }
}
