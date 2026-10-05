# StepCharge AI — Data Provenance & Dictionary

## 1. Principles of Provenance
In research and scientific telemetry, knowing the origin and physical validity of every number is mandatory. StepCharge AI strictly tags every field with one of six provenance categories:

- **`MEASURED`**: Digitized by physical sensor hardware (ESP32 ADC, I2C current sensor, timer counter).
- **`CALCULATED`**: Arithmetically derived exclusively from measured quantities ($P = V \times I$).
- **`ESTIMATED`**: Theoretical mathematical model ($\frac{1}{2} C V^2$).
- **`PREDICTED`**: Machine-learning inference from classifier (Random Forest with confidence).
- **`SIMULATED`**: Synthetic demonstration telemetry (strictly isolated to Demo Mode).
- **`METADATA`**: System attributes, tokens, identifiers, versions, timestamps.

---

## 2. Telemetry Record Data Dictionary

| Field Name | Type | Provenance | Source / Derivation |
| :--- | :--- | :--- | :--- |
| `deviceId` | String | `METADATA` | ESP32 hardware identifier (e.g. `ESP32-01`) |
| `timestamp` | Date | `METADATA` | System arrival timestamp (ISO-8601 UTC) |
| `sequenceNumber` | Number | `MEASURED` | Monotonic 32-bit integer incremented by ESP32 on each transmission |
| `configurationVersion` | Number | `METADATA` | Version of remote config active on device when packet was generated |
| `peakVoltage` | Number | `MEASURED` | Peak rectified piezoelectric spike digitized by ESP32 ADC ($V$) |
| `averageVoltage` | Number | `MEASURED` | Mean voltage across duration of footstep pulse ($V$) |
| `storageVoltage` | Number | `MEASURED` | Supercapacitor terminal voltage via calibrated resistor divider ($V$) |
| `pulseDuration` | Number | `MEASURED` | Milliseconds the harvester output stayed above threshold ($ms$) |
| `stepInterval` | Number | `MEASURED` | Seconds elapsed between previous footstep and current footstep ($s$) |
| `current` | Number \| Null | `MEASURED` | High-side current reading from INA219/INA226 shunt ($A$) |
| `power` | Number \| Null | `CALCULATED` | Real instantaneous electrical power $P = V \times I$ ($W$) |
| `measuredEnergyJ` | Number \| Null | `CALCULATED` | Numerical trapezoidal integration $\int P(t) dt$ ($J$) |
| `estimatedEnergyJ` | Number | `ESTIMATED` | Electrostatic potential energy $\frac{1}{2} C V_{\text{storage}}^2$ ($J$) |
| `stepClass` | String | `PREDICTED` | Random Forest classifier label (`LIGHT`, `NORMAL`, `HEAVY`, `UNKNOWN`) |
| `confidence` | Number \| Null | `PREDICTED` | Classifier posterior probability ($0.0 - 1.0$) |
| `wifiRssi` | Number | `MEASURED` | ESP32 802.11 Wi-Fi Received Signal Strength Indicator ($dBm$) |
| `uptimeSec` | Number \| Null | `MEASURED` | ESP32 hardware millisecond timer divided by 1000 ($s$) |
| `measurementQuality` | String | `METADATA` | Validity flag: `VALID`, `OUT_OF_RANGE`, `DEGRADED`, `ESTIMATED` |
| `currentQuality` | String | `METADATA` | Sensor health: `MEASURED`, `NOT_INSTALLED`, `SENSOR_DISCONNECTED` |

---

## 3. Footstep & Oscillogram Waveform Dictionary

| Field Name | Type | Provenance | Source / Derivation |
| :--- | :--- | :--- | :--- |
| `waveform` | Array<Number> | `MEASURED` | 60 instantaneous voltage samples captured at 50 Hz on impact ($V$) |
| `samplingRate` | Number | `METADATA` | Waveform acquisition frequency (fixed at $50\text{ Hz}$) |
| `featureVersion` | String | `METADATA` | Feature extraction pipeline version (e.g., `v2.1.0`) |
| `modelVersion` | String | `METADATA` | Model version applied for inference (e.g., `rf-gait-v2.1`) |
| `energyProvenance` | Object | `METADATA` | Provenance metadata detailing method, quality flag, and physical units |

---

## 4. Experiment Session Dictionary

| Field Name | Type | Provenance | Source / Derivation |
| :--- | :--- | :--- | :--- |
| `sessionId` | String | `METADATA` | Globally unique session identifier (e.g., `EXP_20261005_01`) |
| `participantId` | String | `METADATA` | Anonymized subject identifier (`P001`, `P002`, `P003`...) |
| `targetSteps` | Number | `METADATA` | Planned protocol step count for trial |
| `collectedSteps` | Number | `MEASURED` | Total steps captured in session |
| `validSteps` | Number | `MEASURED` | Samples passing physical validity and biomechanical sanity checks |
| `rejectedSteps` | Number | `MEASURED` | Samples flagged as mechanical vibration or electrical noise |
| `status` | String | `METADATA` | Session state: `PLANNED`, `RUNNING`, `PAUSED`, `COMPLETED`, `CANCELLED` |
