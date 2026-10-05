# StepCharge AI — ESP32 Firmware & Hardware Setup

This document covers wiring, configuration, and flashing instructions for the ESP32 microcontroller node.

---

## 1. Hardware Pinout & Circuit Schematic

| ESP32 Pin | Function | Hardware Connection | Notes |
|---|---|---|---|
| **GPIO 34** (ADC1_CH6) | Piezo Pulse Input | Rectifier (+) via 10k resistor | 16x oversampled, EMA filtered |
| **GPIO 35** (ADC1_CH7) | Supercap Voltage | 0.1F Supercapacitor (+) | Voltage divider (3:1) if $V > 3.3\,\text{V}$ |
| **GPIO 25** | Load Channel 1 (LED) | N-Channel MOSFET Gate (2N7000/IRLZ44N) | 100Ω gate resistor, 10k pull-down |
| **GPIO 26** | Load Channel 2 (Fan) | N-Channel MOSFET Gate (IRLZ44N) | Flyback diode across inductive fan |
| **GPIO 2** | Status Indicator | Onboard Blue LED | Blinks on telemetry transmission |
| **GND** | System Ground | Common Ground | Common with rectifier and supercap |

---

## 2. Firmware Prerequisites

1. **Arduino IDE 2.x** or **PlatformIO**.
2. **ESP32 Board Support**: Install `esp32 by Espressif Systems` via Boards Manager (v2.0.x or v3.x).
3. **Required Libraries**:
   - `ArduinoJson` (v7.x)
   - `WiFi` (built-in)
   - `HTTPClient` (built-in)

---

## 3. Configuration (`secrets.h`)

1. Navigate to `firmware/stepcharge_esp32/`.
2. Copy `secrets.example.h` to `secrets.h`:
   ```bash
   cp secrets.example.h secrets.h
   ```
3. Edit `secrets.h` with your network credentials and backend address:

```c
#ifndef SECRETS_H
#define SECRETS_H

// Wi-Fi Credentials
#define WIFI_SSID     "Your_WiFi_SSID"
#define WIFI_PASSWORD "Your_WiFi_Password"

// Device Identity & Security
#define DEVICE_ID       "ESP32-01"
#define DEVICE_API_KEY  "sc_live_f89a4b2c8901de45a890b1c2d3e4f5a6b7c8d9e0f1a2b3c4"

// Backend Base URL
// For local testing: use your computer's LAN IP (e.g. http://192.168.1.15:5000)
// For production: use your HTTPS domain (e.g. https://api.stepcharge.yourdomain.com)
#define BACKEND_BASE_URL "http://192.168.1.100:5000"

#endif
```

> [!CAUTION]
> Never hardcode `secrets.h` into version control. It is already added to `.gitignore`.

---

## 4. Flashing Instructions

1. Open `firmware/stepcharge_esp32/stepcharge_esp32.ino` in Arduino IDE.
2. Select Board: **ESP32 Dev Module**.
3. Select Flash Frequency: **80MHz**, Upload Speed: **921600**, Partition Scheme: **Default 4MB with spiffs**.
4. Connect ESP32 via Micro-USB and select the appropriate COM Port.
5. Click **Upload**.
6. Open Serial Monitor at **115200 baud** to verify Wi-Fi connection, NTP time sync, and initial telemetry transmission.
