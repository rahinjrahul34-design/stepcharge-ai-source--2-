# StepCharge AI — Machine Learning Architecture & Model Registry

## 1. Overview
The StepCharge AI ML sub-system classifies footstep kinetic impact intensity into three physiological classes:
- **`LIGHT`**: Soft toe tap, light step, low momentum ($V_{\text{peak}} \approx 0.8\text{ V} - 2.2\text{ V}$)
- **`NORMAL`**: Standard walking stride, regular gait cadence ($V_{\text{peak}} \approx 2.2\text{ V} - 4.5\text{ V}$)
- **`HEAVY`**: Heel impact, brisk walking, heavy footwear, run ($V_{\text{peak}} \approx 4.5\text{ V} - 12.0\text{ V}$)

---

## 2. Microservice Architecture
The machine learning pipeline operates as an independent Python 3.11 FastAPI microservice:
- **Location:** `ml-service/`
- **Framework:** FastAPI + Scikit-Learn 1.5.2 + Pandas 2.2.3 + Joblib
- **Port:** `8000`
- **Endpoints:**
  - `POST /predict`: Real-time footstep classification with probabilities and feature contributions
  - `GET /health`: Service health, uptime, and loaded model status
  - `GET /model/metadata`: Detailed metrics, confusion matrix, and feature importances
  - `POST /compare-models`: Multi-model benchmark (Random Forest, Gradient Boosting, SVM, Logistic Regression)
  - `POST /feature-study`: Feature ablation evaluation
  - `POST /reload`: Hot-reload model weights after promotion or rollback

---

## 3. Evaluated Model Benchmarks

| Model | Core Architecture | Hyperparameters | Target Latency |
|---|---|---|---|
| **Random Forest (Production)** | Ensemble Decision Trees | `n_estimators=100, max_depth=8, class_weight='balanced'` | < 2 ms |
| **Gradient Boosting** | Sequential Loss Minimization | `n_estimators=100, learning_rate=0.1, max_depth=4` | < 5 ms |
| **Support Vector Machine** | RBF Kernel | `C=1.0, gamma='scale', probability=True` | < 3 ms |
| **Logistic Regression** | Multinomial Regularized | `C=1.0, penalty='l2', solver='lbfgs'` | < 1 ms |

---

## 4. Feature Schemas

### 4.1 features-v1 (5 Features)
- `peakVoltage` (V)
- `averageVoltage` (V)
- `pulseDuration` (ms)
- `stepInterval` (s)
- `storageVoltage` (V)

### 4.2 features-v2 (14 Features - Recommended)
Adds 9 time-domain oscillogram parameters:
- `rmsVoltage`: Root-mean-square amplitude
- `crestFactor`: Ratio of peak to RMS ($V_{\text{peak}} / V_{\text{rms}}$)
- `auc`: Area under the voltage-time curve ($\int |V| dt$)
- `riseTimeMs`: Time from 10% to 90% peak amplitude
- `fallTimeMs`: Time from 90% peak down to 10%
- `fwhmMs`: Full-width at half-maximum duration
- `voltageVariance`: Signal variance across the burst
- `skewness`: Asymmetry of the voltage transient
- `kurtosis`: Sharpness of the impact peak

---

## 5. Model Registry & Governance
The backend manages model lifecycle transitions:
- **`VALIDATION`**: Newly trained or candidate weights
- **`PRODUCTION`**: Active model serving real-time predictions (`isCurrent: true`)
- **`ARCHIVED`**: Deprecated or superseded versions

### Lifecycle API Endpoints:
- `POST /api/ai/models/promote`: Promotes candidate model to active production
- `POST /api/ai/models/rollback`: Reverts production to a previous version with audit reason
- `POST /api/ai/models/archive`: Retires old versions
- `GET /api/ai/models`: Retrieves the model version registry
