# StepCharge AI — Research Analytics Console Guide
## Empirical Experimentation, Multi-Model Benchmarks & Statistical Analysis

---

### 1. Research Console Overview

The **Research Analytics Console** (`/research`) is the central laboratory interface for data scientists, embedded systems engineers, and academic researchers evaluating kinetic footstep energy harvesting.

The console provides 7 specialized investigation modules:
1. **Multi-Model Benchmark**: Side-by-side performance matrix of 4 classification algorithms.
2. **Model Registry & Governance**: State lifecycle, administrative promotions, and auditable rollbacks.
3. **Feature Ablation Study**: Marginal accuracy contribution of baseline features vs 50Hz oscillograms vs electrical shunts.
4. **Time-Series Energy Forecaster**: Autoregressive yield prediction with 95% confidence intervals and sample size guards.
5. **Anomaly Center & Triage**: Dual-layer detection timeline with explainability and status triage.
6. **Class Distributions**: Empirical distributions of peak voltage, pulse duration, and energy across `LIGHT`, `NORMAL`, and `HEAVY` gaits.
7. **Academic Limitations**: Transparent documentation of physical transducer and electronic constraints.

---

### 2. Multi-Model Benchmark Matrix

| Metric | Random Forest | Gradient Boosting | Support Vector Machine | Logistic Regression |
|---|---|---|---|---|
| **Macro F1 Score** | High (~88–92%) | High (~89–93%) | Moderate (~80–84%) | Baseline (~70–75%) |
| **Inference Latency** | ~2.5 ms | ~4.8 ms | ~1.2 ms | ~0.4 ms |
| **Model Size (RAM)** | ~45 KB | ~120 KB | ~18 KB | ~4 KB |
| **Suitability** | Best generalizer | Highest accuracy | Boundary sensitivity | Linear baseline |

---

### 3. Feature Ablation Insights

The feature ablation workbench demonstrates that:
1. **Baseline Features (5)** achieve ~82–85% macro F1.
2. **Adding 9 Waveform Parameters (14 total)** improves classification of rapid `LIGHT` vs gentle `NORMAL` footsteps by +5–7%, as the **crest factor** and **rise-to-fall ratio** differentiate heel strikes from toe presses.
3. **Adding Electrical Shunts** enables direct physical Joules integration ($\int P dt$), replacing capacitor voltage estimations.
