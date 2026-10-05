# StepCharge AI — Phase 3 Architecture Specification
## Advanced AI, Predictive Analytics, Anomaly Detection & Research Governance

---

### 1. Executive Summary

Phase 3 elevates the **StepCharge AI** platform from a real-time kinetic measurement system (established in Phase 2) into a **research-grade AI, predictive intelligence, and academic experimentation platform**.

The Phase 3 architecture introduces:
1. **Multi-Model Benchmark & Subject-Independent Cross-Validation**: Compares Random Forest, Gradient Boosting, SVM, and Logistic Regression with strict `GroupKFold` partitioning by `participantId` to eliminate subject identity-leakage.
2. **Model Registry & Lifecycle Governance**: Formal state machine (`VALIDATION` $\to$ `PRODUCTION` $\to$ `ARCHIVED`) with automated demotion, cryptographic versioning, rollback mechanics, and persistent audit logs.
3. **Dual-Layer Anomaly Detection Engine**: Combines deterministic physical bounds checks (overvoltage $> 5.5\text{ V}$, mechanical shock spikes $> 35\text{ V}$, compression holds $> 5000\text{ ms}$, inverted ADC signals) with unsupervised Scikit-Learn **Isolation Forest** scoring and feature attribution.
4. **Temporal Time-Series Energy Yield Forecaster**: Preserves chronological ordering with sliding-window autoregressive lags to predict energy yields over 50–100 steps ahead, protected by a strict $N \ge 20$ sample availability safeguard.
5. **Feature Ablation Workbench**: Systematically contrasts baseline envelope features ($N=5$) against 50Hz oscillograms ($N=14$) and direct current shunts.
6. **DataQualityGate & Immutable Dataset Versioning**: Validates data hygiene prior to training, penalizes physical anomalies, and freezes datasets with version hashes.

```
                             +------------------------+
                             |   ESP32 Kinetic Mat    |
                             +-----------+------------+
                                         |
                                         | HTTPS / REST (Telemetry + 50Hz Waveform)
                                         v
+---------------------------------------------------------------------------------+
|                               Node.js Backend                                  |
|                                                                                 |
|   +-----------------------+     +--------------------+    +------------------+  |
|   |   DataQualityGate     |     | Telemetry Ingest   |    | Model Registry   |  |
|   |  - Outlier bounds     |     | - Deduplication    |    | - Status machine |  |
|   |  - Quality scoring    |     | - Anomaly hook     |    | - Audit log      |  |
|   |  - Dataset versioning |     | - Energy integrate |    | - Rollback trail |  |
|   +-----------+-----------+     +---------+----------+    +--------+---------+  |
+---------------|---------------------------|------------------------|------------+
                |                           |                        |
                | JSON / HTTP               | JSON / HTTP            | REST
                v                           v                        v
+---------------------------------------------------------------------------------+
|                        Python ML Microservice (FastAPI)                         |
|                                                                                 |
|   +---------------------+   +--------------------+   +-----------------------+  |
|   |  feature_engine.py  |   |  train_model.py    |   |  anomaly_detector.py  |  |
|   |  - Features v1 - v4 |   |  - GroupKFold CV   |   |  - Isolation Forest   |  |
|   |  - 9 Waveform stats |   |  - 4 Model Matrix  |   |  - Feature attribution|  |
|   +---------------------+   +--------------------+   +-----------------------+  |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   |  energy_forecaster.py (Temporal Autoregressive Split, N >= 20 safeguard)|   |
|   +-------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------+
                                         |
                                         | WebSocket / REST
                                         v
+---------------------------------------------------------------------------------+
|                          React + TypeScript Frontend                            |
|                                                                                 |
|  - Research Analytics Workbench (/research)                                     |
|  - Multi-Model Benchmark & GroupKFold Matrix                                   |
|  - Model Registry Governance & Rollback Console                                 |
|  - Temporal Energy Forecaster Card                                              |
|  - Anomaly Center & Triage Workbench                                            |
|  - Academic Limitations & Zero-Fabrication Transparency                         |
+---------------------------------------------------------------------------------+
```

---

### 2. Multi-Model Benchmark & Subject-Independent Cross-Validation

Standard random $K$-fold cross-validation inflates classification accuracy by 8–15% when applied to gait and kinetic energy data because samples from the same person appear in both train and test partitions. The classifier memorizes the subject's foot strike weight, footwear stiffness, and cadence rather than learning generalized biomechanical classes.

To ensure academic rigor:
- **GroupKFold by Participant ID**: All footsteps from `participantId = "P001"` are placed entirely into either train or test, never split.
- **Candidate Models Evaluated Simultaneously**:
  1. `RandomForestClassifier`: Ensemble of 100 decision trees, robust to non-linear sensor thresholds.
  2. `GradientBoostingClassifier`: Sequential boosting minimizing cross-entropy loss, captures subtle waveform crest-factor gradients.
  3. `SVC (Support Vector Classifier)`: RBF kernel mapping normalized features into hyperplanes.
  4. `LogisticRegression`: Baseline linear model providing an interpretable reference point.

---

### 3. Model Registry & Lifecycle Governance

```
                    +-------------------+
                    |    TRAINED MODEL  |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    |    VALIDATION     |
                    +---------+---------+
                              |
                     Promote  |  (Requires ADMIN role)
                              v
                    +-------------------+
            +------>|    PRODUCTION     |
            |       +---------+---------+
            |                 |
   Rollback |        Demote   |  (Upon newer promotion or rollback)
            |                 v
            |       +-------------------+
            +-------+     ARCHIVED      |
                    +-------------------+
```

- **Validation State**: A freshly trained model is evaluated offline; metrics, inference latency, and size are recorded.
- **Production State**: Exactly one model holds `status: 'PRODUCTION', isCurrent: true` at any time. When a new model is promoted, the previous production model is atomically transitioned to `ARCHIVED`.
- **Rollback Mechanics**: An administrator can revert the active model to any archived version, creating a structured audit log record specifying `fromVersion`, `toVersion`, `reason`, `performedBy`, and `timestamp`.
- **Archive Protection**: The system strictly forbids deleting or archiving the currently serving production model.

---

### 4. Dual-Layer Anomaly Detection

1. **Deterministic Physical Rules (`RULE-BASED`)**:
   - `STORAGE_ANOMALY` (CRITICAL): Supercapacitor voltage $> 5.5\text{ V}$.
   - `VOLTAGE_SPIKE` (HIGH): Peak harvester voltage $> 35.0\text{ V}$.
   - `UNUSUAL_PULSE` (MEDIUM): Pulse duration $> 5000\text{ ms}$.
   - `SENSOR_FAILURE` (HIGH): Average voltage exceeds peak voltage by $> 5\%$ or negative values observed.
2. **Unsupervised Multidimensional Outliers (`ML-BASED`)**:
   - `IsolationForest(contamination=0.05, random_state=42)` evaluates multi-feature combinations.
   - Calculates normalized anomaly score ($0.0 \to 1.0$) and identifies the driving feature that contributed most to isolation depth.

---

### 5. Temporal Energy Forecaster & Zero-Fabrication Safeguard

- **No Data Shuffling**: Energy prediction uses chronologically ordered observations ($t_0 \to t_{N-1} \to t_N$).
- **Lag Features**: Auto-regressive features ($E_{t-1}, E_{t-2}, V_{t-1}, \Delta t$) predict cumulative energy yield.
- **Strict Safeguard**: If $N < 20$ historical sequential steps are recorded, the forecaster refuses to generate speculative trendlines, returning status `INSUFFICIENT_DATA` with explanatory guidance.
