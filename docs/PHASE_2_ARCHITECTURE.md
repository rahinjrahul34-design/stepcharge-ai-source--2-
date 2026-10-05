# StepCharge AI — Phase 2 Architecture & Mathematical Foundation

## 1. Executive Summary
Phase 2 transforms the **StepCharge AI** platform from a prototype voltage-estimator into a **research-grade, experimentally rigorous, physically verifiable energy harvesting and monitoring system**. 

Phase 2 preserves 100% of Phase 1's security guarantees (Google OAuth 2.0, HTTP-only cookies, room-scoped WebSockets, SHA-256 device authentication, RBAC authorization) while introducing:
1. **Real Electrical Energy Measurement** via dual sensing (ADC voltage + INA219/INA226 current integration).
2. **Honest Provenance & State Contract** (`MEASURED`, `ESTIMATED`, `UNAVAILABLE`) — eliminating synthetic zeroes.
3. **Over-The-Air ESP32 Remote Configuration** with Desired vs. Applied version control and hardware safety enforcement.
4. **Research-Grade Experiment Mode** with participant anonymization (`P001`, `P002`), progress HUD, and scientific CSV/JSON dataset export.
5. **High-Resolution Oscillogram Waveform Streaming** (60 samples @ 50 Hz on footstep events) for gait biomechanics and feature extraction.
6. **Multi-Subsystem Hardware & Pipeline Self-Test**.

---

## 2. End-to-End System Pipeline

```
┌────────────────────────────────────────────────────────┐
│                   PHYSICAL TRANSDUCTION                 │
│  Piezoelectric Harvester Mat (Multi-element PZT/PVDF)   │
└───────────────────────────┬────────────────────────────┘
                            │ AC Voltage Spikes
                            ▼
┌────────────────────────────────────────────────────────┐
│                    RECTIFICATION & STORAGE             │
│  Schottky Bridge Rectifier -> Supercapacitor (0.1 - 1F)│
└───────────────────────────┬────────────────────────────┘
                            │ DC Voltage Rail & Load Loop
                            ▼
┌────────────────────────────────────────────────────────┐
│                    DUAL SENSING STAGE                  │
│  - Storage Rail Voltage via Calibrated Resistor Divider│
│  - Load/Charge Current via INA219/INA226 I2C Shunt     │
└───────────────────────────┬────────────────────────────┘
                            │ Raw ADC & I2C Registers
                            ▼
┌────────────────────────────────────────────────────────┐
│                    ESP32 FIRMWARE v2.1.0               │
│  - Sequence Counting & Hardware Bounds Enforcement     │
│  - 60-sample 50Hz Footstep Waveform Buffer             │
│  - Desired vs Applied Version Synchronization          │
│  - Provenance & Quality Tagging                        │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS POST /api/telemetry
                            ▼
┌────────────────────────────────────────────────────────┐
│               NODE.JS / EXPRESS / TYPESCRIPT           │
│  - SHA-256 Device Key Authentication                   │
│  - Telemetry Deduplication via sequenceNumber          │
│  - Integration ∫ P dt & Capacitive ½CV² Provenance     │
│  - Experiment Session Sample Dispatcher                │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
               ▼                           ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│        MONGODB ATLAS          │ │   PYTHON ML SERVICE  │
│ - Devices (desired vs applied)│ │ - Random Forest Clf  │
│ - Telemetry & Footsteps       │ │ - Confidence & Wave  │
│ - CalibrationLogs & Audits    │ └──────────────────────┘
│ - ExperimentSessions & Datasets                          │
└──────────────┬─────────────────────────────────────────┘
               │
               ▼ Socket.IO Rooms (Authenticated Device Room)
┌────────────────────────────────────────────────────────┐
│               REACT 19 + TYPESCRIPT CLIENT             │
│  - Live Oscillogram Waveform Viewer (SVG Path)         │
│  - Provenance Badges (MEASURED / ESTIMATED / UNAVAIL)  │
│  - Remote Hardware Configuration Console               │
│  - Sensor Calibration Console (Voltage, Current, Piezo)│
│  - Academic Experiment Mode & Dataset Quality HUD      │
│  - Diagnostic Hardware & Pipeline Self-Test            │
└────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Foundations & Physical Laws

### 3.1. Supercapacitor Stored Energy (Theoretical Model)
The electrostatic potential energy stored in an ideal capacitor is given by:
$$E_{\text{stored}} = \frac{1}{2} C V_{\text{storage}}^2$$
- $C$: Rated capacitance in Farads (default: $0.1\text{ F}$, configurable).
- $V_{\text{storage}}$: Terminal voltage across the capacitor rail.
- **System Classification:** `ESTIMATED STORED ENERGY`.
- **Scientific Rule:** This represents maximum electrostatic energy stored, *not* the electrical energy harvested from an individual footstep.

### 3.2. Real Harvested / Dissipated Electrical Energy (Integration)
The true electrical energy transferred into a load or storage reservoir over a time interval $[t_0, t_n]$ is:
$$E_{\text{electrical}} = \int_{t_0}^{t_n} P(t) \, dt = \int_{t_0}^{t_n} V(t) \cdot I(t) \, dt$$
Using discrete numerical trapezoidal integration across $n$ samples:
$$E_{\text{electrical}} \approx \sum_{i=1}^{n} \frac{P_{i-1} + P_i}{2} \cdot (t_i - t_{i-1})$$
Or Riemann summation for uniform sampling periods $\Delta t$:
$$E_{\text{electrical}} \approx \sum_{i=1}^{n} V_i \cdot I_i \cdot \Delta t$$
- **System Classification:** `MEASURED ELECTRICAL ENERGY`.
- **Sensory Requirement:** Both $V(t)$ and $I(t)$ must be simultaneously measured.
- **Integrity Rule:** If $I(t)$ is null (sensor uninstalled), $E_{\text{electrical}}$ is marked `null` with provenance `UNAVAILABLE`.

### 3.3. Instantaneous Electrical Power
$$P = V \times I$$
- Voltage in Volts ($V$), Current in Amperes ($A$).
- Power in Watts ($W$) or milliwatts ($mW$).
- If current is not sensed: Power is `null`, and the UI indicates `Not measured`.

### 3.4. Resistor Voltage Divider Scaling
The ESP32 ADC pin measures an attenuated voltage $V_{\text{ADC}}$ from the higher-voltage supercapacitor rail $V_{\text{storage}}$:
$$V_{\text{storage}} = V_{\text{ADC}} \times \left( \frac{R_1 + R_2}{R_2} \right) \times K_{\text{scale}} + V_{\text{offset}}$$
- Typical values: $R_1 = 100\,\text{k}\Omega$, $R_2 = 33\,\text{k}\Omega \implies \text{Divider Ratio} \approx 4.03$.
- $K_{\text{scale}}$ and $V_{\text{offset}}$ are dynamically refined in the Calibration subsystem.

---

## 4. State & Provenance Contract

| State / Tag | Physical Meaning | UI Appearance | Rule |
| :--- | :--- | :--- | :--- |
| **`MEASURED`** | Directly digitized by physical transducer hardware (ADC or I2C sensor). | Green badge (`MEASURED`) | Never fabricated or synthesized in live mode. |
| **`CALCULATED`** | Arithmetically derived exclusively from measured quantities ($P = V \times I$). | Cyan badge (`CALCULATED`) | Requires all input variables to be valid `MEASURED`. |
| **`ESTIMATED`** | Model-based calculation based on theoretical assumptions ($\frac{1}{2} C V^2$). | Purple badge (`ESTIMATED`) | Must document formula and parameters in UI. |
| **`PREDICTED`** | Inferred by Machine Learning model (Random Forest). | Violet badge (`PREDICTED`) | Must always display model confidence ($0-100\%$). |
| **`UNAVAILABLE`**| Sensor is physically absent, disconnected, or disabled. | Slate badge (`NOT MEASURED`) | **Never substitute 0.0 or synthetic values.** |
| **`SIMULATED`**  | Generated in Demo Mode for UI evaluation and testing. | Amber badge (`SIMULATED`) | Strictly isolated to client demo sessions. |

---

## 5. Firmware Architecture (v2.1.0)
The upgraded firmware (`firmware/stepcharge_esp32/stepcharge_esp32.ino`) implements:
- **I2C Sensor Auto-Detection**: Probes addresses `0x40` (INA219) and `0x41` (INA226). If neither acknowledges, sets `currentSensorInstalled = false` and transmits `current: null`.
- **Continuous Oscillogram Capture**: Circular buffer maintaining 60 ADC samples at 50 Hz. When a footstep trigger event occurs ($V_{\text{peak}} \ge V_{\text{threshold}}$), the buffer freezes and serializes the high-frequency waveform array in the footstep payload.
- **Monotonic Sequence Counter**: Increments `sequenceNumber` with every broadcast packet to detect packet drops and deduplicate network retries.
- **Desired vs Applied Configuration Loop**: Polls `/api/devices/:id/config/desired` periodically. Verifies incoming parameters against on-board safety limits (Voltage $\le 5.5\text{V}$, Sampling $\ge 5\text{ms}$). Acknowledges via `/api/devices/:id/config/status` with `SYNCHRONIZED` or `REJECTED` and diagnostic reason.
