# StepCharge AI — Academic Experiment Mode Guide

## 1. Introduction
**Experiment Mode** enables controlled, academic-grade data collection for piezoelectric energy harvesting studies, gait biomechanics research, and machine-learning dataset creation.

It transforms unorganized telemetry streams into structured, tagged, auditable research datasets.

---

## 2. Participant Privacy & Ethical Compliance
In compliance with human participant research standards (IRB / Ethics Review):
- Personally Identifiable Information (PII) like names, birthdates, and photos are **never** collected or stored.
- Participants are indexed exclusively via anonymized tokens: `P001`, `P002`, `P003`, etc.
- Sessions can record environmental parameters (e.g., shoe sole type, floor substrate, ambient temperature) in the session notes.

---

## 3. Session Lifecycle & Workflow

```
┌──────────────┐      Start       ┌──────────────┐      Pause       ┌──────────────┐
│   PLANNED    │ ───────────────> │   RUNNING    │ <──────────────> │    PAUSED    │
└──────────────┘                  └──────────────┘                  └──────────────┘
                                         │
                                         │ Target Reached or Complete
                                         ▼
                                  ┌──────────────┐
                                  │  COMPLETED   │ ───> Export CSV / JSON
                                  └──────────────┘
```

1. **Create Session**:
   - Provide an Experiment Name (e.g., *"Tile Floor Normal Gait Cadence Trial"*).
   - Enter Participant ID (e.g., `P004`).
   - Select Ground-Truth Class: `LIGHT`, `NORMAL`, or `HEAVY`.
   - Specify Target Step Count (e.g., `50` steps).
   - Add contextual notes.
2. **Execute Trial**:
   - Click **Start Session**.
   - As the subject walks across the harvester, each footstep detected by the ESP32 is automatically tagged with `sessionId`, `participantId`, ground-truth label, and sequence number.
   - The UI displays real-time progress towards the target step count.
3. **Data Quality Validation**:
   - Footsteps that violate biomechanical sanity checks (e.g., pulse duration $< 10\text{ms}$ or peak $< 0.1\text{V}$) are automatically flagged as `rejected = true` with a recorded `rejectionReason`.
   - Valid steps increment the `validSteps` counter.
4. **Complete & Export**:
   - Once target steps are reached, the session transitions to `COMPLETED`.
   - Export the complete session dataset via CSV or JSON.

---

## 4. Research Dataset Export Specification

### 4.1. CSV Column Structure
The exported research CSV contains 18 standardized columns:

| Column Header | Data Type | Physical Units | Description |
| :--- | :--- | :--- | :--- |
| `timestamp` | ISO-8601 String | UTC | Arrival timestamp at backend |
| `sessionId` | String | Identifier | Unique experiment session token |
| `participantId` | String | Anonymized ID | Participant token (`P001`) |
| `deviceId` | String | Identifier | Hardware ESP32 identifier |
| `sequenceNumber` | Integer | Counter | Monotonic hardware sequence number |
| `stepClass` | String | Category | Ground-truth label (`LIGHT`, `NORMAL`, `HEAVY`) |
| `peakVoltage` | Float | Volts ($V$) | Peak rectified harvester voltage |
| `averageVoltage` | Float | Volts ($V$) | Mean pulse voltage over impact duration |
| `storageVoltage` | Float | Volts ($V$) | Supercapacitor rail terminal voltage |
| `pulseDuration` | Float | Milliseconds ($ms$) | Duration above detection threshold |
| `stepInterval` | Float | Seconds ($s$) | Elapsed time since prior footstep |
| `currentMa` | Float \| Null | Milliamps ($mA$) | Measured load current (null if unmeasured) |
| `powerMw` | Float \| Null | Milliwatts ($mW$) | Measured instantaneous power (null if unmeasured) |
| `measuredEnergyJ`| Float \| Null | Joules ($J$) | Measured electrical energy from integration |
| `estimatedEnergyJ`| Float | Joules ($J$) | Theoretical capacitive energy $\frac{1}{2} C V^2$ |
| `samplingRate` | Integer | Hertz ($Hz$) | Waveform acquisition rate (typically $50\text{ Hz}$) |
| `rejected` | Boolean | Flag | `true` if flagged as electrical/mechanical noise |
| `rejectionReason`| String \| Null | Diagnostic | Text reason if sample was rejected |

---

## 5. Dataset Quality Metrics Panel
The **Dataset Quality Assessment** dashboard card monitors dataset health across four critical dimensions:
- **Class Balance**: Evaluates representation across `LIGHT`, `NORMAL`, and `HEAVY` gait classes.
- **Waveform Integrity**: Verifies what percentage of dataset samples have complete 60-sample oscillograms attached.
- **Current / Energy Availability**: Documents the percentage of samples with real measured electrical energy versus estimated capacitive storage.
- **ML Training Readiness**: Checks whether minimum class counts ($\ge 20$ samples per class) and noise thresholds are met to produce an unbiased Random Forest classifier.
