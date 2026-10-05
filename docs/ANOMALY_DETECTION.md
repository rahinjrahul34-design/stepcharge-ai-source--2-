# StepCharge AI — Anomaly Detection & Triage Architecture
## Dual-Layer Detection, Physical Safeguards & Explainability Attribution

---

### 1. Architectural Philosophy

Anomaly detection in StepCharge AI employs a **dual-layer architecture**:
1. **Deterministic Physical Rules (`RULE-BASED`)**: Hard electronic and mechanical boundary conditions that indicate physical danger, hardware malfunction, or sensor decoupling.
2. **Unsupervised Multidimensional Projection (`ML-BASED`)**: Scikit-Learn **Isolation Forest** that isolates unusual multidimensional feature combinations that individual single-variable thresholds miss.

```
                              Incoming Telemetry Packet
                                         |
                                         v
                      +--------------------------------------+
                      |  1. Deterministic Physical Rules     |
                      |  - Storage Overvoltage (> 5.5 V)     |
                      |  - Kinetic Impact Spike (> 35.0 V)   |
                      |  - Sensor Inversion (Avg > Peak)     |
                      |  - Compression Hold (> 5000 ms)      |
                      +------------------+-------------------+
                                         |
                       Rule Violated?    |
                      +------------------+-------------------+
                      |                                      |
                     YES                                     NO
                      |                                      |
                      v                                      v
       +------------------------------+     +----------------------------------+
       | Source: "RULE-BASED"         |     |  2. Unsupervised ML Detector     |
       | AnomalyScore: 1.0 (Critical) |     |  - Scikit-Learn Isolation Forest |
       | Deterministic attribution    |     |  - Normalized score (0.0 -> 1.0) |
       +--------------+---------------+     |  - Driving feature attribution   |
                      |                     +----------------+-----------------+
                      |                                      |
                      +------------------+-------------------+
                                         |
                                         v
                      +--------------------------------------+
                      |   AnomalyEvent Record & Alert Bus    |
                      |  - Severity: LOW/MED/HIGH/CRITICAL   |
                      |  - Observed vs Typical Range         |
                      |  - Explainable Root Cause            |
                      |  - Status: DETECTED / RESOLVED       |
                      +--------------------------------------+
```

---

### 2. Layer 1: Deterministic Physical Rules

| Rule | Severity | Condition | Typical Range | Probable Cause |
|---|---|---|---|---|
| `STORAGE_ANOMALY` | `CRITICAL` | $V_{\text{storage}} > 5.5\text{ V}$ | $1.0\text{ V} - 5.0\text{ V}$ | Supercapacitor terminal voltage exceeded safe rated maximum ceiling (5.5 V). Overvoltage risk. |
| `VOLTAGE_SPIKE` | `HIGH` | $V_{\text{peak}} > 35.0\text{ V}$ | $0.2\text{ V} - 25.0\text{ V}$ | Severe mechanical shock or hammer strike delivered to piezoelectric transducer. |
| `UNUSUAL_PULSE` | `MEDIUM` | $t_{\text{pulse}} > 5000\text{ ms}$ | $20\text{ ms} - 1500\text{ ms}$ | Extended human standing, furniture resting on harvest tile, or mechanical settling. |
| `SENSOR_FAILURE` | `HIGH` | $V_{\text{avg}} > 1.05 \cdot V_{\text{peak}}$ | $V_{\text{avg}} \le V_{\text{peak}}$ | Sensor decoupling, reversed polarity, or ADC reference drift. |

---

### 3. Layer 2: Unsupervised Isolation Forest

When deterministic rules do not trigger, the feature vector is analyzed by an `IsolationForest`:
- **Algorithm**: Forest of extremely randomized decision trees partitioning feature space. Outliers are isolated closer to the tree root, requiring fewer splits.
- **Normalized Score**:
  $$\text{Score} = \text{clip}\left(\frac{- \text{decision\_function}(x)}{0.35}, 0.0, 1.0\right)$$
- **Driving Feature Attribution**: Feature perturbation identifies which parameter caused the greatest increase in isolation depth.

---

### 4. Explainable Triage Workflow

Every anomaly includes full explainability fields:
1. **`observedValue`**: The exact value recorded (e.g. `5.85 V`).
2. **`typicalRange`**: The standard operational boundary (e.g. `1.00 V – 5.00 V`).
3. **`possibleCause`**: Plain-English engineering context explaining why the flag triggered.
4. **`status`**: Life-cycle tracking: `DETECTED` $\to$ `ACKNOWLEDGED` $\to$ `INVESTIGATING` $\to$ `RESOLVED` (or `FALSE_POSITIVE`).
