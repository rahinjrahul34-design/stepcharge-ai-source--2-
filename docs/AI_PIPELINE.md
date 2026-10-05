# StepCharge AI — Machine Learning Pipeline & Feature Engineering
## Complete Processing Pipeline from Raw Transducer Pulses to Biomechanical Inferences

---

### 1. Pipeline Overview

The StepCharge AI ML microservice transforms raw kinetic energy harvesting transducer pulses into calibrated biomechanical intensity classifications (`LIGHT`, `NORMAL`, `HEAVY`).

```
+-------------------------------------------------------------------------------+
|                       1. Raw Transducer Acquisition                           |
|  - ESP32 ADC1 @ 50 Hz burst (60 samples per strike)                           |
|  - Envelope peak, duration, cadence interval, and storage voltage             |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       2. Feature Extraction Engine                            |
|  - features-v1: [peakVoltage, avgVoltage, pulseDuration, interval, storageV]  |
|  - features-v2: adds 9 oscillogram parameters (RMS, AUC, Crest, Rise/Fall)    |
|  - features-v3: adds measured electrical current & power                      |
|  - features-v4: full research fusion schema                                   |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       3. Data Quality Gate & Cleaning                         |
|  - Filter physical outliers (V > 50V, duration > 15s)                         |
|  - Verify subject diversity (>= 2 participants)                               |
|  - Quality score calculation (0 - 100)                                        |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                 4. Subject-Independent Cross-Validation                       |
|  - Scikit-Learn GroupKFold partitioned by participantId                       |
|  - 0% participant leakage between training and validation splits              |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                    5. Multi-Model Candidate Training                          |
|  - Random Forest, Gradient Boosting, SVM, Logistic Regression                |
|  - Metric evaluation: Accuracy, Precision, Recall, Macro F1                   |
|  - Benchmarking: Inference latency (ms), serialized model size (KB)           |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                   6. Model Registry & Promotion Guard                         |
|  - Candidate saved with status = VALIDATION                                   |
|  - Admin promotion to PRODUCTION triggers atomic demotion of previous model   |
+-------------------------------------------------------------------------------+
```

---

### 2. Feature Schemas & Versioning

To ensure backward compatibility and experimental reproducibility, all feature vectors adhere to strict schema versions:

#### Schema `features-v1` (5 Baseline Features)
1. `peakVoltage` (V): Maximum rectified peak envelope voltage.
2. `averageVoltage` (V): Mean rectified voltage over the pulse duration.
3. `pulseDuration` (ms): Duration between initial threshold trigger and release voltage.
4. `stepInterval` (s): Inter-strike cadence period since previous strike.
5. `storageVoltage` (V): Terminal potential across the supercapacitor buffer.

#### Schema `features-v2` (Oscillogram Enhanced — 14 Features)
Inherits all `features-v1` parameters plus 9 statistical waveform features extracted from the 60-sample 50Hz raw array:
1. `wf_peak` (V): Maximum amplitude within the 60-sample array.
2. `wf_rms` (V): Root-mean-square kinetic power measure $\sqrt{\frac{1}{N}\sum v_i^2}$.
3. `wf_mean` (V): Arithmetic mean amplitude.
4. `wf_std` (V): Standard deviation of waveform envelope.
5. `wf_rise_time` (ms): Duration from 10% to 90% peak amplitude.
6. `wf_fall_time` (ms): Duration from 90% peak amplitude decay down to 10%.
7. `wf_auc` (V·s): Area Under Curve (Trapezoidal numerical integration).
8. `wf_crest_factor`: Peak-to-RMS ratio ($\frac{V_{\text{peak}}}{V_{\text{rms}}}$).
9. `wf_pulse_width` (ms): Full width at half maximum (FWHM).

#### Schema `features-v3` & `features-v4` (Electrical & Fusion)
Includes calibrated current ($I_{\text{mA}}$), instantaneous power ($P_{\text{mW}}$), and integrated pulse energy ($E_{\text{mJ}}$).

---

### 3. Subject-Independent Validation Protocol

Traditional $K$-Fold CV randomly splits rows:
$$\text{Fold}_k = \{ \text{Sample}_i \sim \mathcal{U}(1, N) \}$$
Because individuals have distinct biomechanical signatures (foot anatomy, walking gait, heel striking force), random splitting allows samples from "Participant A" to enter both the training and test folds. The model learns Participant A's idiosyncratic gait rather than generalized physical properties of `LIGHT`, `NORMAL`, or `HEAVY` steps.

StepCharge AI enforces `GroupKFold`:
$$\forall i \in \text{Train}, j \in \text{Test} \implies \text{participantId}(i) \neq \text{participantId}(j)$$
This ensures reported metrics reflect genuine real-world generalization to new unencountered human users.
