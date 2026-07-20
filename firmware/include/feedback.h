#pragma once

#include <Arduino.h>
#include "pins.h"

// Passive 2-pin piezo: loudest near its resonance (often ~3–4 kHz at 3.3 V).
// For a clearly louder beep, drive it from 5V via an NPN/MOSFET (see docs).
#define BUZZER_FREQ_HZ 4000

inline bool buzzerToneActive = false;

inline void buzzerMute() {
  // noTone() before any tone() triggers "LEDC is not initialized" on ESP32.
  if (buzzerToneActive) {
    noTone(PIN_BUZZER);
    buzzerToneActive = false;
  }
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
}

inline void feedbackInit() {
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  buzzerMute();
}

inline void beepOnce(unsigned onMs = 120, unsigned freqHz = BUZZER_FREQ_HZ) {
  tone(PIN_BUZZER, freqHz);
  buzzerToneActive = true;
  delay(onMs);
  buzzerMute();
}

inline void beepSuccess() { beepOnce(140, 4000); }

inline void beepUnknown() {
  beepOnce(100, 3500);
  delay(40);
  beepOnce(100, 2800);
}

inline void ledSuccess() {
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);
}

inline void ledUnknown() {
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_RED, LOW);
}
