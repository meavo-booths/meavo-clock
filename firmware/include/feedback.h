#pragma once

#include <Arduino.h>
#include "pins.h"

// Speaker only (no LEDs). NPN low-side switch on D2:
//   speaker + → 3V3, speaker − → collector, emitter → GND, base → 2kΩ → D2
#define BUZZER_FREQ_HZ 2000

inline void buzzerMute() {
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
}

inline void feedbackInit() {
  buzzerMute();
}

// Bit-bang with periodic yield — avoids ESP32 tone()/LEDC init errors and
// doesn't starve Wi‑Fi/USB the way a pure delayMicroseconds loop does.
inline void beepOnce(unsigned onMs = 150, unsigned freqHz = BUZZER_FREQ_HZ) {
  if (freqHz < 100) freqHz = 100;
  const unsigned halfUs = 1000000UL / (freqHz * 2UL);
  const unsigned long endMs = millis() + onMs;
  pinMode(PIN_BUZZER, OUTPUT);
  uint16_t n = 0;
  while (millis() < endMs) {
    digitalWrite(PIN_BUZZER, HIGH);
    delayMicroseconds(halfUs);
    digitalWrite(PIN_BUZZER, LOW);
    delayMicroseconds(halfUs);
    if ((++n & 31) == 0) {
      delay(0);
    }
  }
  buzzerMute();
}

inline void beepSuccess() { beepOnce(160, 2000); }

inline void beepUnknown() {
  beepOnce(100, 1800);
  delay(40);
  beepOnce(100, 1400);
}

inline void beepReady() { beepOnce(180, 2000); }
