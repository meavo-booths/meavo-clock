# Meavo Clock-In Kiosk — Bill of Materials

Procurement checklist for a single kiosk build.

| Qty | Item | Notes |
|-----|------|-------|
| 1 | Seeed XIAO ESP32S3 | Include flex U.FL antenna |
| 1 | LiPo 1350 mAh protected, JST PH2.0 | − near USB, + away from USB |
| 1 | PN532 NFC module (I2C) | Set DIP switches to I2C |
| 1 | DS3231 RTC module | CR2032 installed |
| 1 | Passive buzzer 3.3V (2‑pin +/−) | Driven with tone() on D2 |
| 2 | 5 mm LEDs + 220 Ω resistors | Green / red |
| 1 | USB-C PSU 5V 2A + cable | Mains 24/7 |
| 1 | ABS enclosure ~120×80×40 mm | Plastic RFID window |
| 50 | NTAG213 cards | 13.56 MHz |

## Wiring (XIAO pin map)

| XIAO pin | Connect |
|----------|---------|
| D4 / SDA / GPIO5 | PN532 SDA + DS3231 SDA |
| D5 / SCL / GPIO6 | PN532 SCL + DS3231 SCL |
| D0 / GPIO1 | Green LED (+ 220 Ω) |
| D1 / GPIO2 | Red LED (+ 220 Ω) |
| D2 / GPIO3 | Passive buzzer + (− to GND). For louder: +→5V, −→NPN collector, D2→base via 1kΩ |
| D3 / GPIO4 | DS3231 SQW (wake from sleep) |
| 3V3, GND | All modules |
