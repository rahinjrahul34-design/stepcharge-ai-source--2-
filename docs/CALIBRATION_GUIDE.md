# StepCharge AI — Sensor Calibration Guide

## 1. Overview
Physical sensor accuracy is critical for research reproducibility. Because raw ESP32 ADCs possess unit-to-unit variations of $\pm 6\%$ and resistor tolerances introduce gain errors, StepCharge AI incorporates an integrated calibration subsystem accessible via the **Hardware Calibration** console (`/calibration`) or through REST endpoints.

All calibrations are:
1. **Validated against physical boundaries** before acceptance.
2. **Version-tracked** and stored in the `CalibrationLog` collection.
3. **Audited** with timestamp, user ID, error percentages, and scale factors.
4. **Pushed over-the-air** to the target device's active configuration.

---

## 2. Voltage Calibration Procedure

### 2.1. Principle & Formula
The corrected storage rail voltage is calculated by:
$$V_{\text{corrected}} = V_{\text{raw\_ADC}} \times \text{DividerRatio} \times K_{\text{voltage\_scale}} + V_{\text{voltage\_offset}}$$

When calibrating against a calibrated digital multimeter (DMM):
$$K_{\text{new}} = K_{\text{current}} \times \left( \frac{V_{\text{DMM\_reference}}}{V_{\text{device\_reported}}} \right)$$

$$\text{Error } \% = \left| \frac{V_{\text{device\_reported}} - V_{\text{DMM\_reference}}}{V_{\text{DMM\_reference}}} \right| \times 100\%$$

### 2.2. Step-by-Step Procedure
1. Power on the StepCharge hardware and connect a calibrated 4.5-digit multimeter (e.g. Fluke 87V) across the supercapacitor terminal.
2. Ensure the supercapacitor has charged to at least $2.5\text{V}$ (recommended: $3.3\text{V} - 4.5\text{V}$).
3. Open the **Hardware Calibration** page on the StepCharge AI dashboard.
4. Note the **Measured Voltage** reported on the dashboard.
5. Enter the exact **DMM Reference Reading** in Volts.
6. Click **Calculate Calibration Scale**. Review the computed error percentage and new scale factor.
7. Click **Apply Scale to Hardware**. The new factor is saved to the database and synced to the ESP32.

---

## 3. Current Calibration Procedure

### 3.1. Prerequisite: Sensor Installation Guard
> [!IMPORTANT]
> Current calibration can **only** be executed if a physical I2C current sensor (`INA219` or `INA226`) is installed and detected. If no current sensor is installed, the backend rejects calibration with error code `CURRENT_SENSOR_NOT_INSTALLED`. The system refuses to fabricate or calibrate fictitious current.

### 3.2. Formula
$$K_{\text{new}} = K_{\text{current}} \times \left( \frac{I_{\text{reference\_mA}}}{I_{\text{measured\_mA}}} \right)$$

### 3.3. Procedure
1. Connect a calibrated current meter or source in series with the supercapacitor discharge load.
2. Enable the demonstration load (LED or Fan) to draw steady current.
3. Enter the reference current reading in milliamps ($\text{mA}$).
4. Click **Apply Scale Factor**.

---

## 4. Piezoelectric Threshold & Noise Floor Calibration

The piezoelectric harvester is sensitive to ambient acoustic vibrations and mat mechanical settling.
To prevent phantom steps or missed strikes:
1. Ensure the mat is completely stationary (no footsteps for 10 seconds).
2. Measure the **Baseline Noise Floor** $V_{\text{noise}}$ (typically $0.02\text{V} - 0.08\text{V}$).
3. Perform a sequence of calibrated light toe strikes to register $V_{\text{light\_peak}}$.
4. The system calculates:
   $$V_{\text{threshold}} = \max\left(V_{\text{noise}} \times 2.0, \, 0.20\text{V}\right)$$
   $$V_{\text{release}} = V_{\text{threshold}} \times 0.60$$
5. This provides positive hysteresis and eliminates double-counting on impact ringdown.

---

## 5. Calibration History & Verification
Every calibration action is permanently logged to MongoDB in the `calibrationlogs` collection:
```json
{
  "_id": "67324fa5...",
  "deviceId": "ESP32-01",
  "calibrationType": "VOLTAGE",
  "referenceValue": 4.150,
  "measuredValue": 3.980,
  "previousScale": 1.000,
  "newScale": 1.0427,
  "errorPercent": 4.10,
  "result": "APPLIED",
  "timestamp": "2026-10-05T22:30:00.000Z"
}
```
View the complete log in the **Calibration Audit Log** panel at the bottom of the Calibration page.
