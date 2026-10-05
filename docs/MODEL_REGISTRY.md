# StepCharge AI — Model Registry & Lifecycle Governance
## Architecture, Audit Mechanics, and Promotion/Rollback Protocols

---

### 1. Overview

In scientific and safety-critical embedded systems, machine learning models cannot simply be overwritten on disk without governance. The StepCharge AI **Model Registry** implements an immutable, audited state-machine for all trained model artifacts.

Every model trained or evaluated by the platform is stored in MongoDB Atlas with complete provenance metadata, cryptographic versioning, cross-validation metrics, and human promotion history.

---

### 2. Model States & Transitions

```
[ New Training Run ]
         |
         v
+-------------------+
|    VALIDATION     |  <-- Model evaluated offline via GroupKFold CV.
+---------+---------+      Serving status: Inactive.
          |
          | Admin POST /api/ai/models/promote
          v
+-------------------+
|    PRODUCTION     |  <-- Serving live inferences to ESP32 & Web UI.
+---------+---------+      Exactly ONE model can hold this state.
          |
          | Newer model promoted OR Rollback triggered
          v
+-------------------+
|     ARCHIVED      |  <-- Preserved for reproducibility & historical rollbacks.
+-------------------+      Cannot be deleted if it was ever in production.
```

---

### 3. State Definitions

1. **`VALIDATION`**:
   - Newly trained models enter this state.
   - Evaluated on test splits; accuracy, precision, recall, F1, inference latency, and serialized size are calculated.
   - Does **not** receive live traffic or classify active ESP32 telemetry.
2. **`PRODUCTION`**:
   - The active model currently loaded in the Python ML microservice and serving real-time predictions.
   - Exactly one model document has `{ status: 'PRODUCTION', isCurrent: true }`.
   - **Protection Rule**: The active production model cannot be archived or deleted.
3. **`ARCHIVED`**:
   - Historical models that previously served in production.
   - Preserved to allow reproducible comparisons and instant single-click rollbacks.

---

### 4. Promotion & Rollback Mechanics

#### Promotion Protocol
When an administrator promotes a model via `POST /api/ai/models/promote`:
1. The currently serving `PRODUCTION` model is demoted to `ARCHIVED`, setting `isCurrent = false`.
2. The target model's status is set to `PRODUCTION`, setting `isCurrent = true` and recording `promotedAt` and `promotedBy`.
3. An immutable record is created in the `AuditLog` collection:
   ```json
   {
     "action": "PROMOTE_MODEL",
     "resource": "Model:gb-v2.1",
     "details": {
       "promotedVersion": "gb-v2.1",
       "previousVersion": "rf-v1.4",
       "metrics": { "f1": 0.912 }
     }
   }
   ```
4. The Python ML service is notified via `POST /reload` to load the new model weights into RAM without restarting the microservice.

#### Rollback Protocol
If an active model exhibits edge-case regression in real hardware (e.g. latency spikes or sensor mismatch), an administrator triggers a rollback via `POST /api/ai/models/rollback`:
1. Requires a mandatory textual `reason` (e.g., *"Gradient Boosting latency spike observed on ESP32 field units; reverting to baseline Random Forest"*).
2. The target archived model is restored to `PRODUCTION`.
3. An audit trail entry is appended to `rollbackHistory`:
   ```json
   {
     "fromVersion": "gb-v2.1",
     "toVersion": "rf-v1.4",
     "reason": "Gradient Boosting latency spike observed on ESP32 field units",
     "performedBy": "admin@stepcharge.io",
     "timestamp": "2026-10-05T23:30:00Z"
   }
   ```
