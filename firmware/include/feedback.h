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

inline void beepSuccess() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(80);
    digitalWrite(PIN_BUZZER, LOW);
    delay(80);
  }
}

inline void beepUnknown() {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(400);
  digitalWrite(PIN_BUZZER, LOW);
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
