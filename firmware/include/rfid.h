#pragma once

#include <Wire.h>
#include <Adafruit_PN532.h>
#include "pins.h"

inline Adafruit_PN532 nfc(-1, -1);

inline bool rfidInit() {
  nfc.begin();
  uint32_t version = nfc.getFirmwareVersion();
  if (!version) {
    Serial.println("RFID: PN532 not found");
    return false;
  }
  Serial.printf("RFID: PN532 firmware 0x%x\n", version);
  nfc.SAMConfig();
  return true;
}

inline String uidToHex(uint8_t uid[], uint8_t uidLength) {
  String s;
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) s += '0';
    s += String(uid[i], HEX);
  }
  s.toUpperCase();
  return s;
}

inline bool rfidReadUid(String &uidOut) {
  uint8_t uid[7];
  uint8_t uidLength;
  if (!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100)) {
    return false;
  }
  uidOut = uidToHex(uid, uidLength);
  return true;
}
