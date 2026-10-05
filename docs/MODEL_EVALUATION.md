# StepCharge AI — Model Evaluation & Validation Protocol
## Subject-Independent GroupKFold, Multi-Algorithm Benchmark & Error Analysis

---

### 1. Evaluation Methodology

Machine learning models for footstep classification are evaluated using a strict **Subject-Independent Cross-Validation** protocol.

#### Why Subject-Independence is Mandatory
When testing models on biometric and kinetic data, standard random $K$-fold cross-validation permits data from the same human participant to appear in both the training set and the test set. 

Because individual users walk with consistent idiosyncratic mechanics (stride cadence, foot angle, body weight distribution), models evaluated via random $K$-fold achieve artificially inflated test scores (+8–15%) by recognizing the participant rather than general footstep intensity.

To eliminate this bias, StepCharge AI enforces **`GroupKFold`** using `participantId`:
- Entire participants are held out in each fold.
- The test set evaluates strictly unseen human subjects.
- Metrics accurately reflect real-world deployment performance.

---

### 2. Candidate Algorithm Comparison

| Algorithm | Strengths | Trade-Offs |
|---|---|---|
| **Random Forest** | Robust to non-linear thresholds; excellent handling of mixed-scale features; built-in feature importance; resistant to overfitting. | Larger memory footprint than linear models. |
| **Gradient Boosting** | Highest classification accuracy; captures subtle waveform crest-factor gradients; sequential loss minimization. | Slightly higher inference latency; sensitive to outliers if unbounded. |
| **Support Vector Machine (RBF)** | Effective in high-dimensional feature spaces; clean decision boundaries. | Requires feature normalization; higher computational scaling with large datasets. |
| **Logistic Regression** | Fast inference ($< 0.5\text{ ms}$); highly interpretable linear coefficients; minimal RAM footprint. | Lower accuracy on non-linear piezo pulse dynamics. |

---

### 3. Classification Metrics

- **Accuracy**: $\frac{\text{TP} + \text{TN}}{\text{Total}}$
- **Precision (Macro)**: Unweighted average of precision across `LIGHT`, `NORMAL`, `HEAVY`.
- **Recall (Macro)**: Unweighted average of recall across classes, ensuring minority classes (`HEAVY` impacts) are not drowned out by frequent `NORMAL` strides.
- **Macro F1 Score**: Harmonic mean of macro precision and recall:
  $$F_1 = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$
