# StepCharge AI — Academic Experiment Protocols & Trials

## 1. Overview
The **Experiment Mode** module provides structured data collection consoles for laboratory footstep harvesting, biomechanical gait studies, and transducer evaluation.

---

## 2. Experiment Session Lifecycle

An experiment session moves through 4 deterministic states:
1. **`PLANNED`**: Trial parameters (operator, participant ID, ground-truth gait class, target step count) are defined.
2. **`RUNNING`**: The ESP32 node routes incoming footstep telemetry directly into the active session bucket.
3. **`PAUSED`**: Temporary suspension of data collection (e.g. subject resting or footwear change).
4. **`COMPLETED`**: Final metrics compiled, summary statistics locked, and dataset export enabled.

---

## 3. Session Configuration Parameters

When creating an experiment session via `POST /api/experiments/sessions`:
- `experimentName`: Descriptive trial title (e.g. "Heel Strike Dynamic Response Trial")
- `participantId`: Anonymized human participant code (e.g. `P001`, `P002`)
- `deviceId`: Target harvesting node (`ESP32-01`)
- `stepClass`: Expected ground-truth gait class (`LIGHT`, `NORMAL`, `HEAVY`)
- `targetSteps`: Target sample count (e.g. 50 steps)
- `notes`: Experimental context (e.g. footwear sole stiffness, flooring substrate, stride rate)

---

## 4. Multi-Session Comparative Analysis

The comparative analysis engine (`POST /api/experiments/compare`) allows researchers to select two or more completed sessions and evaluate physical metrics side-by-side:
- **Mean Peak Transducer Voltage ($V_{\text{peak}}$)**
- **Mean Pulse Duration ($\text{ms}$)**
- **Supercapacitor Voltage Differential ($\Delta V_{\text{store}}$)**
- **Harvest Energy Yield ($E_{\text{yield}}$)**
  - Tagged explicitly as `[MEASURED]` if current shunt was utilized.
  - Tagged explicitly as `[ESTIMATED]` if derived from capacitor differential $\frac{1}{2} C (V_2^2 - V_1^2)$.

---

## 5. Research Data Export
- **CSV Export:** `GET /api/experiments/:sessionId/export?format=csv` downloads raw feature records with headers ready for import into MATLAB, R, or Python Pandas.
- **JSON Metadata:** `GET /api/experiments/:sessionId/export?format=json` downloads complete structured trial session metadata with provenance signatures.
- **17-Section Research Report:** `GET /api/experiments/report?sessionId=...&format=markdown` compiles a publication-ready academic report.
