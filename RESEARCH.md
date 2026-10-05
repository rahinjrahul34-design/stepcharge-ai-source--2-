# StepCharge AI — Academic Research & Statistical Framework

## 1. Overview
StepCharge AI is designed as a research-grade IoT energy harvesting and edge biomechanical monitoring platform. It combines piezoelectric kinetic harvesting with non-parametric statistical analysis, subject-independent cross-validation, and rigorous measurement provenance.

---

## 2. Theoretical Transduction & Physical Foundations

### 2.1 Piezoelectric Constitutive Equations
The kinetic transducers operate on direct piezoelectric effect principles:

$$D_i = d_{ijk} \sigma_{jk} + \varepsilon_{ik}^T E_k$$

Where:
- $D_i$: Electric displacement vector ($\text{C/m}^2$)
- $d_{ijk}$: Direct piezoelectric coefficient tensor ($\text{C/N}$)
- $\sigma_{jk}$: Applied biomechanical mechanical stress tensor ($\text{N/m}^2$)
- $\varepsilon_{ik}^T$: Dielectric permittivity at constant stress ($\text{F/m}$)
- $E_k$: Electric field vector ($\text{V/m}$)

### 2.2 Electrical Storage Potential
Kinetic energy harvested across the Schottky full-bridge rectifier is stored in a 0.1 F / 5.5 V supercapacitor. The electrical potential energy stored is:

$$E = \frac{1}{2} C V^2$$

Where:
- $C = 0.10\text{ F}$ (buffer capacitance)
- $V$: Real-time ADC voltage on the storage rail

### 2.3 Strict Energy Provenance Distinction
1. **`MEASURED` Power and Energy:**
   - Applicable **only** when an active low-side current shunt (INA219 or calibrated precision resistor) is physically installed:
   $$P(t) = V(t) \cdot I(t), \quad E = \int_{t_0}^{t_1} P(t) dt$$
2. **`ESTIMATED` Stored Energy:**
   - Derived purely from supercapacitor voltage rail differential ($\Delta E = \frac{1}{2} C (V_{\text{final}}^2 - V_{\text{initial}}^2)$).
   - If no current sensor is detected, current and instantaneous power explicitly render as `Not Measured` / `Unavailable`. Zero or synthetic current is **never** fabricated.

---

## 3. Statistical Analysis & Hypothesis Testing

### 3.1 Non-Parametric Framework: Kruskal-Wallis $H$-Test
Human footstep kinetic waveforms exhibit skewed, non-Gaussian distributions due to biomechanical variations (heel-strike transients, soft footwear dampening, stance cadence). Consequently, parametric One-Way ANOVA is academically inappropriate without proof of normality.

StepCharge AI employs the **Kruskal-Wallis non-parametric rank sum test** across the three gait classes ($k = 3$: `LIGHT`, `NORMAL`, `HEAVY`):

$$H = \frac{12}{N(N+1)} \sum_{j=1}^k \frac{R_j^2}{n_j} - 3(N+1)$$

With tie correction:
$$C_{\text{ties}} = 1 - \frac{\sum (t_m^3 - t_m)}{N^3 - N}, \quad H_{\text{corrected}} = \frac{H}{C_{\text{ties}}}$$

Where:
- $N$: Total pooled sample size across all classes
- $n_j$: Sample size of class $j$
- $R_j$: Sum of fractional ranks assigned to observations in class $j$
- $t_m$: Number of tied observations in group $m$
- Degrees of Freedom: $\text{df} = k - 1 = 2$
- Significance threshold: $\alpha = 0.05$

### 3.2 Pairwise Correlation Matrix
Kinetic co-variation across 5 primary physical variables is analyzed simultaneously via:
1. **Pearson Linear Correlation ($r$):**
   $$r = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2 \sum (y_i - \bar{y})^2}}$$
2. **Spearman Monotonic Rank Correlation ($\rho$):**
   $$\rho = 1 - \frac{6 \sum d_i^2}{n(n^2 - 1)}$$

**Variables Evaluated:**
- Peak Voltage ($V_{\text{peak}}$)
- Average Pulse Voltage ($V_{\text{avg}}$)
- Pulse Duration ($t_{\text{pulse}}$)
- Cadence Interval ($\Delta t_{\text{step}}$)
- Supercapacitor Storage Voltage ($V_{\text{store}}$)

> **Scientific Disclaimer:** Statistical correlation evaluates empirical co-variation and does not prove physical causation.

---

## 4. Subject-Independent Machine Learning Protocol

To prevent subject identity memorization and data leakage:
- **Partitioning:** `StratifiedGroupKFold` grouped by `participantId`.
- **Feature Set v2:** 14 deterministic time-domain features (Peak, Mean, RMS, Pulse Duration, Cadence, Rise Time, Fall Time, Crest Factor, Energy Yield, Storage Rail).
- **Ablation Study:** Systematic removal of feature groups to isolate kinetic discriminators from background noise.

---

## 5. Automated 17-Section Academic Research Report

The platform includes an automated reporting engine generating complete Markdown documentation conforming to IEEE / Springer publication guidelines:
1. Project Information
2. Experiment Information & Session Metadata
3. Hardware Transducer & Circuit Configuration
4. Software & Telemetry Pipeline Stack
5. Dataset Description & Provenance
6. Data Quality Evaluation & Readiness Gates
7. Feature Engineering Matrix
8. Machine Learning Model Registry
9. Model Performance & GroupKFold Validation Protocol
10. Footstep Kinetic Analysis (Mean, Median, StdDev, IQR, 95% CI)
11. Energy Generation & Storage Analysis
12. Dual-Layer Anomaly Detection Audit
13. Statistical Hypothesis Testing ($H$-Statistic & $p$-Value)
14. Empirical Results & Findings
15. Limitations & Engineering Disclosures
16. Concluding Assessment
17. Reproducibility & Governance Information with Anti-Fabrication Pledge
