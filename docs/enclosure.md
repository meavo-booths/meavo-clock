# Kiosk Enclosure Assembly

## Requirements

- ABS project box ~120×80×40 mm (or larger for LiPo + modules)
- 2–3 mm plastic window over PN532 coil (no metal)
- USB-C pass-through or panel mount for mains cable
- External Wi-Fi antenna routed through enclosure wall (U.FL pigtail)

## Layout

1. Mount XIAO on standoffs; leave access to USB-C for programming.
2. PN532 coil flush behind plastic lid window — center the tap zone.
3. DS3231 and buzzer on perfboard or hot-glue to base.
4. LiPo secured with double-sided tape or holder; avoid puncturing cell.
5. Route antenna outside enclosure; gentle bend on U.FL connector.
6. Label: **Tap card to clock in**

## Power

- USB-C wall adapter → panel USB → XIAO USB-C (24/7 mains)
- LiPo JST → XIAO battery pads (backup)

## LEDs

- Mount green/red LEDs visible through lid or beside RFID window.
- Drill 3 mm holes if needed.

## Test before closing

1. Wi-Fi RSSI acceptable with lid on
2. RFID read through plastic window
3. Unplug USB — kiosk runs on LiPo briefly
4. LEDs and buzzer visible/audible
