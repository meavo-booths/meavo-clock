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

inline void beepOnce(unsigned onMs = 180) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(onMs);
  digitalWrite(PIN_BUZZER, LOW);
}

inline void beepSuccess() { beepOnce(180); }

inline void beepUnknown() {
  beepOnce(180);
  delay(80);
  beepOnce(180);
}

inline void ledSuccess() {
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);
  delay(150);
  digitalWrite(PIN_LED_GREEN, LOW);
}

inline void ledUnknown() {
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  delay(150);
  digitalWrite(PIN_LED_RED, LOW);
}
