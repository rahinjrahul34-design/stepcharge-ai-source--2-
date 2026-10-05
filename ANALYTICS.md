# StepCharge AI — Analytics & Energy Intelligence

## 1. Overview
StepCharge AI provides end-to-end telemetry analytics across three core dimensions:
1. **Physical Energy Harvesting & Supercapacitor Buffering**
2. **Biomechanical Gait Classification & Feature Ablation**
3. **Dual-Layer Anomaly Detection & System Reliability**

---

## 2. Real-Time Energy Analytics
- **Supercapacitor Potential:** Calculated continuously as $E = \frac{1}{2} C V^2$ across the $C = 0.10\text{ F}$ rail.
- **Harvest Energy per Step:**
  - `MEASURED`: Time-integral of instantaneous voltage and shunt current $\int (V \cdot I) dt$.
  - `ESTIMATED`: Energy delta across the supercapacitor buffer $\Delta E = \frac{1}{2} C (V_{i+1}^2 - V_i^2)$.
- **Energy Flow Diagram:** Renders physical transduction stages:
  1. Mechanical Footstep Impact
  2. Piezo Ceramic Voltage Spike
  3. Schottky Diode Rectification
  4. Supercapacitor Buffer Rail
  5. Controllable LED / Fan Demonstration Loads

---

## 3. Predictive Energy Forecasting
- **Endpoint:** `GET /api/ai/forecast/energy?deviceId=...&stepsAhead=50`
- **Methodology:** Time-series projection using rolling kinetic energy moving averages paired with active gait cadence.
- **Honest Fallback:** If fewer than 20 historical footsteps are recorded in the database, the forecast returns `INSUFFICIENT_DATA` rather than hallucinating synthetic energy trajectories.

---

## 4. Dual-Layer Anomaly Detection
StepCharge AI protects hardware and research data integrity through a dual-layer detection pipeline:

1. **Deterministic Rule Engine (Hardware Protection):**
   - Storage Over-Voltage: $V_{\text{store}} > 5.5\text{ V}$ (Immediate load dissipation trigger)
   - Transducer Voltage Spike: $V_{\text{peak}} > 35\text{ V}$ (Electrical surge alert)
   - Unusually Long Impact: $t_{\text{pulse}} > 800\text{ ms}$ (Mechanical resting artifact)
   - Rapid Frequency Drift: $\Delta t_{\text{step}} < 200\text{ ms}$ (Mechanical vibration or bouncing)

2. **Unsupervised Multidimensional Model (Outlier Triage):**
   - Isolation Forest evaluated in Python ML microservice across 5 feature dimensions.
   - Detects subtle sensor drift, contact impedance degradation, or anomalous gait patterns.
