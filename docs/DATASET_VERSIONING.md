# StepCharge AI — Dataset Versioning & Quality Gates
## DataQualityGate Validation, Physical Bounds & Immutable Version Freezing

---

### 1. DataQualityGate Specification

Before any model training or benchmark run is executed, the raw candidate dataset passes through the **DataQualityGate** (`dataQualityService.ts`). The gate enforces physical plausibility, class balance, and participant diversity:

#### Validation Criteria
1. **Total Sample Count**: Minimum 10 samples required for basic validation; minimum 30 samples recommended for cross-validation.
2. **Participant Diversity**: At least 2 distinct `participantId` values must be present to enable `GroupKFold` cross-validation.
3. **Physical Feasibility Bounds**:
   - $0 \le V_{\text{peak}} \le 50.0\text{ V}$
   - $0 \le V_{\text{avg}} \le 1.05 \cdot V_{\text{peak}}$ (average cannot physically exceed peak).
   - $5\text{ ms} \le t_{\text{pulse}} \le 15000\text{ ms}$
   - $0 \le V_{\text{storage}} \le 5.5\text{ V}$
4. **Class Representation**: Ensures non-zero representation across `LIGHT`, `NORMAL`, and `HEAVY` classes.

---

### 2. Quality Score Formulation

The dataset quality score $Q \in [0, 100]$ is computed as:
$$Q = 100 - \min(40, 100 \cdot r_{\text{missing}}) - \min(30, 100 \cdot r_{\text{outlier}}) - \text{penalties}$$

Where:
- $r_{\text{missing}}$: Fraction of rows with missing physical telemetry fields.
- $r_{\text{outlier}}$: Fraction of rows violating physical boundary conditions.
- $\text{penalties}$: Penalties for extreme class imbalance ($< 20\%$ minority class) or single-participant datasets.

---

### 3. Immutable Dataset Freezing

Researchers can freeze an active collection into an immutable version snapshot via `POST /api/ai/datasets/freeze`:
- Persists record in `DatasetVersion` collection with sample count, participant count, quality score, and class distribution.
- Locked against future modification, deletion, or sample appending.
- Guarantees that future model retrainings or academic paper revisions reference the exact same data bytes.
