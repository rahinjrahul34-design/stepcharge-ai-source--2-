# StepCharge AI — Hardware & Firmware Test Plan

## 1. Test Overview
This test plan provides comprehensive verification procedures for physical StepCharge AI hardware (ESP32 node, piezoelectric tile array, rectification bridge, supercapacitor storage bank, and optional INA219/INA226 current sensing module).

---

## 2. Test Execution Matrix

| Test ID | Category | Description | Acceptance Criteria | Status |
| :--- | :--- | :--- | :--- | :--- |
| **HW-01** | Power | ESP32 cold boot and Wi-Fi HTTPS association | Boots within 3s, obtains IP via DHCP, validates backend HTTPS | PASS |
| **HW-02** | Sensing | ESP32 ADC linear voltage divider scaling | Reading matches calibrated DMM within $\pm 2.0\%$ | PASS |
| **HW-03** | Sensing | Current sensor autodetect (absent state) | System sets `currentSensorInstalled = false`, transmits `current = null` | PASS |
| **HW-04** | Sensing | Current sensor autodetect (INA219 detected) | Detects I2C at `0x40`, transmits valid $I_{\text{mA}}$ and $P_{\text{mW}}$ | PASS |
| **HW-05** | Biomechanics | Footstep impact trigger and envelope capture | Triggers on strike $\ge V_{\text{threshold}}$, ignores vibrations $< V_{\text{threshold}}$ | PASS |
| **HW-06** | Biomechanics | 60-sample 50Hz waveform capture buffer | Oscillogram array has 60 valid float values with single dominant peak | PASS |
| **HW-07** | Network | Monotonic sequence number incrementation | Every consecutive packet increments `seqNo` by exactly 1 | PASS |
| **HW-08** | Network | Deduplication on network retry | Duplicate packet with identical `seqNo` is deduplicated without double count | PASS |
| **HW-09** | Remote OTA | Desired vs Applied version synchronization | Pushing new config via dashboard updates version and ESP32 applies it | PASS |
| **HW-10** | Safety | Safety ceiling rejection on ESP32 | Pushing $V_{\text{max}} = 6.5\text{V}$ ($> 5.5\text{V}$) causes ESP32 to reject config | PASS |
| **HW-11** | Calibration | Voltage calibration scale factor persistence | Applying $K = 1.042$ updates database and adjusts live voltage readings | PASS |
| **HW-12** | Calibration | Current calibration refusal when sensor absent | Submitting current calibration without sensor returns `400 Bad Request` | PASS |
| **HW-13** | Experiment | Anonymized participant session data collection | Walking trial tags samples with `participantId = 'P001'` and `sessionId` | PASS |
| **HW-14** | Export | Scientific dataset CSV export | Exported CSV contains 18 headers, valid numbers, and no NaN strings | PASS |
| **HW-15** | Diagnostics | End-to-end self-test diagnostic report | Self-test passes all 6 components with honest `NOT_INSTALLED` for current | PASS |

---

## 3. Detailed Edge Case Test Procedures

### Test HW-10: Remote Safety Constraint Enforcement
1. Navigate to **Settings** $\to$ **ESP32 Remote Configuration**.
2. Set **Max Storage Ceiling** to an unsafe value of $6.0\text{V}$ (exceeding hardware rated $5.5\text{V}$).
3. Attempt to save. The dashboard client validates and displays: `"Max storage ceiling must be between 1.0 V and 5.5 V."`
4. If a forged REST request bypasses client checks (`PUT /api/devices/:id/config` with `maxStorageVoltage: 6.5`), the Node.js backend validation middleware rejects the request with HTTP 400.
5. If the firmware receives an applied version exceeding internal bounds ($5.5\text{V}$ or sampling $< 5\text{ms}$), the ESP32 safety guard triggers:
   ```cpp
   if (newMaxStorageV > 5.5) {
     reportConfigStatus(desiredVersion, "REJECTED", "Voltage ceiling exceeds hardware safety limit of 5.5V");
     return;
   }
   ```
6. The dashboard displays the rejection badge with the exact hardware diagnostic reason.

### Test HW-12: Honest Current Sensor Refusal
1. In a setup without an INA219 current sensor installed:
2. Open **Hardware Calibration** $\to$ **Current Sensing Calibration**.
3. Observe the warning banner: `"Current sensor is not installed on this device prototype."`
4. The calibration form is disabled.
5. Attempting to submit a POST to `/api/devices/:id/calibrate/current` returns:
   ```json
   {
     "success": false,
     "error": {
       "code": "CURRENT_SENSOR_NOT_INSTALLED",
       "message": "Cannot calibrate current: no current sensor is installed on device 'ESP32-01'."
     }
   }
   ```
6. Verify no fake calibration factors are recorded in the audit log.
