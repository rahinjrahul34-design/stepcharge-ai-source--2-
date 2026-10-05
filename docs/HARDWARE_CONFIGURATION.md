# StepCharge AI — Hardware Configuration & Pinout Guide

## 1. Bill of Materials (BOM)

| Component | Part / Specification | Quantity | Purpose |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP32-WROOM-32D / DevKit V1 | 1 | Edge sampling, Wi-Fi HTTPS telemetry, load orchestration |
| **Transducer Array** | Piezoelectric Ceramic Discs (PZT, 27mm–35mm) | 4–8 | Kinetic-to-electrical energy conversion (footstrike impact) |
| **Bridge Rectifier** | Schottky Diode Bridge (e.g. 1N5819 or MB10S) | 1–2 | AC to DC rectification with ultra-low forward drop ($V_f \le 0.35\text{V}$) |
| **Energy Buffer** | Electric Double-Layer Supercapacitor ($0.1\text{F} - 1.0\text{F}, 5.5\text{V}$) | 1 | Charge accumulation and temporary energy storage |
| **Voltage Sensing** | Precision Metal Film Resistors ($100\,\text{k}\Omega$ & $33\,\text{k}\Omega$, 1%) | 1 set | Attenuates $0–5.5\text{V}$ rail to $0–1.36\text{V}$ for ESP32 ADC linear range |
| **Current Sensor** | INA219 or INA226 High-Side I2C Breakout ($0.1\,\Omega$ shunt) | 1 (Opt) | High-precision bus voltage, shunt voltage, and current sensing |
| **Zener Clamp** | $5.1\text{V}$ / $5.6\text{V}$ Zener Diode (e.g. 1N4733A) | 1 | Overvoltage protection clamp on supercapacitor terminal |
| **Demonstration Loads** | 5mm Low-Current LED ($20\text{mA}$) & 5V Micro Fan ($100\text{mA}$) | 1 each | Switchable output loads for energy dissipation trials |
| **Load Drivers** | 2N7000 or AO3400 N-Channel Logic-Level MOSFETs | 2 | Low-side switching controlled by ESP32 GPIOs |

---

## 2. ESP32 Pin Assignment Map

```
                  ┌──────────────────────┐
                  │   ESP32-DEVKIT V1    │
                  ├──────────────────────┤
     Piezo ADC In │ GPIO 34 (ADC1_CH6)   │ (Analog Input - Harvester Pulse)
   Supercap V In  │ GPIO 35 (ADC1_CH7)   │ (Analog Input - Divider Output)
          I2C SDA │ GPIO 21              │ (Bidirectional - INA219/226 SDA)
          I2C SCL │ GPIO 22              │ (Clock - INA219/226 SCL)
      LED Control │ GPIO 25              │ (Digital Output - MOSFET Gate 1)
      Fan Control │ GPIO 26              │ (Digital Output - MOSFET Gate 2)
           Ground │ GND                  │ Common System Reference
         DC Power │ 5V (USB or Reg.)     │ Microcontroller VCC
                  └──────────────────────┘
```

> [!IMPORTANT]
> Always use **ADC1** pins (GPIOs 32–39) on the ESP32. **ADC2** pins cannot be used while the Wi-Fi subsystem is transmitting!

---

## 3. Voltage Divider & ADC Calibration

The ESP32 analog-to-digital converter (ADC1) operates with an internal attenuation setting of `ADC_11db` (input voltage span: $0.15\text{V}$ to $3.1\text{V}$). Because uncalibrated ESP32 ADCs exhibit non-linearity below $0.15\text{V}$ and above $2.8\text{V}$, the divider resistors are selected to center the supercapacitor voltage inside the linear window:

$$V_{\text{ADC\_pin}} = V_{\text{storage}} \times \frac{R_2}{R_1 + R_2} = V_{\text{storage}} \times \frac{33\,\text{k}\Omega}{100\,\text{k}\Omega + 33\,\text{k}\Omega} = V_{\text{storage}} \times 0.2481$$

- At $V_{\text{storage}} = 1.0\text{V} \implies V_{\text{ADC}} = 0.248\text{V}$
- At $V_{\text{storage}} = 5.0\text{V} \implies V_{\text{ADC}} = 1.241\text{V}$
- At $V_{\text{storage}} = 5.5\text{V} \implies V_{\text{ADC}} = 1.365\text{V}$

This ensures that the entire operational envelope remains strictly within the linear and calibrated ADC region.

---

## 4. Current Sensor (INA219 / INA226) Connection

When installed for real energy and power measurement:
1. Connect `VCC` to ESP32 `3.3V` and `GND` to common ground.
2. Connect `SDA` to `GPIO 21` and `SCL` to `GPIO 22`. Add $4.7\,\text{k}\Omega$ pull-up resistors to $3.3\text{V}$ if the breakout board lacks onboard pull-ups.
3. Wire the `VIN+` and `VIN-` terminals in series with the high-side load path between the supercapacitor positive rail and the load positive terminal.
4. If no current sensor is connected, the firmware automatically sets `currentSensorInstalled = false`, transmitting `current = null` and `power = null`.

---

## 5. Over-Voltage Protection
1. A **$5.1\text{V}$ / $5.6\text{V}$ 500mW Zener diode** is placed across the supercapacitor terminals to protect against open-circuit high-voltage spikes from heavy impact footsteps.
2. Firmware safety ceilings trigger automatic load shedding (activating the LED/Fan load or disabling harvester capture) if $V_{\text{storage}} > 5.0\text{V}$.
