#pragma once

#include <Arduino.h>
#include "pins.h"

// Passive 2-pin piezo. Bit-bang square wave — avoids ESP32 LEDC/tone() which
// logs "LEDC is not initialized" and can leave the pin noisy when idle.
#define BUZZER_FREQ_HZ 4000

inline void buzzerMute() {
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
}

inline void feedbackInit() {
  buzzerMute();
}

inline void beepOnce(unsigned onMs = 120, unsigned freqHz = BUZZER_FREQ_HZ) {
  if (freqHz < 100) freqHz = 100;
  const unsigned halfUs = 1000000UL / (freqHz * 2UL);
  const unsigned long endMs = millis() + onMs;
  pinMode(PIN_BUZZER, OUTPUT);
  while (millis() < endMs) {
    digitalWrite(PIN_BUZZER, HIGH);
    delayMicroseconds(halfUs);
    digitalWrite(PIN_BUZZER, LOW);
    delayMicroseconds(halfUs);
  }
  buzzerMute();
}

inline void beepSuccess() { beepOnce(140, 4000); }

inline void beepUnknown() {
  beepOnce(100, 3500);
  delay(40);
  beepOnce(100, 2800);
}

// No external LEDs on the current build — keep stubs so call sites compile.
inline void ledSuccess() {}
inline void ledUnknown() {}
