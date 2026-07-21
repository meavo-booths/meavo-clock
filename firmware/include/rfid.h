#pragma once

#include <Wire.h>
#include <Adafruit_PN532.h>
#include "pins.h"

inline Adafruit_PN532 nfc(-1, -1);
inline unsigned long rfidPauseUntilMs = 0;

inline void i2cEnsureBus() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(100000);
  Wire.setTimeOut(50);
}

inline bool rfidInit() {
  i2cEnsureBus();
  nfc.begin();
  i2cEnsureBus();
  delay(20);

  uint32_t version = nfc.getFirmwareVersion();
  if (!version) {
    Serial.println("RFID: PN532 not found");
    return false;
  }
  Serial.printf("RFID: PN532 firmware 0x%x\n", version);
  if (!nfc.SAMConfig()) {
    Serial.println("RFID: SAMConfig failed");
    return false;
  }
  rfidPauseUntilMs = 0;
  return true;
}

inline bool rfidResetRf() {
  delay(5);
  if (!nfc.SAMConfig()) {
    Serial.println("RFID: SAMConfig recover failed — full reinit");
    return rfidInit();
  }
  return true;
}

// Pause RFID around Wi‑Fi/TLS work — concurrent I2C+TLS often logs Wire Error -1.
inline void rfidPause(unsigned ms = 500) {
  unsigned long until = millis() + ms;
  if (until > rfidPauseUntilMs) rfidPauseUntilMs = until;
}

inline bool rfidPaused() { return millis() < rfidPauseUntilMs; }

inline String uidToHex(uint8_t uid[], uint8_t uidLength) {
  String s;
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) s += '0';
    s += String(uid[i], HEX);
  }
  s.toUpperCase();
  return s;
}

inline bool rfidCardPresent() {
  if (rfidPaused()) return true; // stay in wait-gone until pause ends
  uint8_t uid[7];
  uint8_t uidLength;
  if (!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 30)) {
    return false;
  }
  rfidResetRf();
  return true;
}

inline bool rfidReadUid(String &uidOut) {
  if (rfidPaused()) return false;
  uint8_t uid[7];
  uint8_t uidLength;
  // Do not call Wire.begin() every poll — that itself causes Error -1 spam.
  if (!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 30)) {
    return false; // no card (normal). Occasional Wire log lines are library noise.
  }
  uidOut = uidToHex(uid, uidLength);
  rfidResetRf();
  return true;
}
