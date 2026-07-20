#pragma once

#include <Arduino.h>
#include "pins.h"

// Passive speaker/piezo via NPN low-side switch (2N2222):
//   speaker + → 5V
//   speaker − → collector
//   emitter → GND
//   base → 2kΩ → D2 (GPIO HIGH = on)
// ~2 kHz is louder on small speakers than 4 kHz piezo resonance.
#define BUZZER_FREQ_HZ 2000

inline void buzzerMute() {
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
}

inline void feedbackInit() {
  buzzerMute();
}

inline void beepOnce(unsigned onMs = 150, unsigned freqHz = BUZZER_FREQ_HZ) {
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

inline void beepSuccess() { beepOnce(180, 2000); }

inline void beepUnknown() {
  beepOnce(120, 1800);
  delay(50);
  beepOnce(120, 1400);
}

inline void beepBoot() { beepOnce(200, 2000); }

// No external LEDs on the current build — keep stubs so call sites compile.
inline void ledSuccess() {}
inline void ledUnknown() {}
