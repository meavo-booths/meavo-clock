#pragma once

#include <Wire.h>
#include <Adafruit_PN532.h>
#include "pins.h"

inline Adafruit_PN532 nfc(-1, -1);

inline void i2cEnsureBus() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(100000);
  Wire.setTimeOut(100); // fail fast instead of ~1s Error 263 spam
}

inline bool rfidInit() {
  i2cEnsureBus();
  nfc.begin();
  // Adafruit_I2CDevice::begin() calls Wire.begin() with no pins — re-apply ours.
  i2cEnsureBus();
  delay(20);

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
  // Keep the RF field under PN532/SAM control — manually forcing RF off
  // between polls was wedging I2C (Wire Error 263 every ~1s).
  if (!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 50)) {
    return false;
  }
  uidOut = uidToHex(uid, uidLength);
  return true;
}
