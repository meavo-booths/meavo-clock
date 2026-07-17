#pragma once

#include <Arduino.h>
#include "pins.h"

inline void feedbackInit() {
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);
}

// Active buzzer (HW-508): volume is mostly hardware; longer ON time + more
// pulses reads louder. Keep I/O HIGH while sounding (VCC must also be 3V3).
inline void beepPulse(unsigned onMs, unsigned offMs = 60) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(onMs);
  digitalWrite(PIN_BUZZER, LOW);
  if (offMs) delay(offMs);
}

inline void beepSuccess() {
  beepPulse(120);
  beepPulse(180, 0);
}

inline void beepUnknown() {
  beepPulse(250);
  beepPulse(250);
  beepPulse(500, 0);
}

inline void ledSuccess() {
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);
  delay(300);
  digitalWrite(PIN_LED_GREEN, LOW);
}

inline void ledUnknown() {
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  delay(500);
  digitalWrite(PIN_LED_RED, LOW);
}
