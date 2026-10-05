# StepCharge AI — Dataset Architecture & Quality Assurance

## 1. Overview
Empirical footstep harvesting records collected through ESP32 burst sampling are stored in MongoDB Atlas under the `datasetsamples` collection. To uphold academic rigor, all samples maintain complete provenance metadata.

---

## 2. Dataset Sample Schema

```typescript
interface IDatasetSample {
  sampleId: string           // Unique UUID
  sessionId?: string         // Linked ExperimentSession identifier
  participantId: string      // Anonymized human participant code (e.g. 'P001')
  deviceId: string           // Edge harvester device ID ('ESP32-01')
  timestamp: Date            // Observation timestamp
  features: {
    peakVoltage: number      // Maximum observed transducer voltage (V)
    averageVoltage: number   // Mean impact voltage (V)
    pulseDuration: number    // Impact pulse width (ms)
    stepInterval: number     // Time elapsed since preceding step (s)
    storageVoltage: number   // Supercapacitor rail voltage at capture (V)
    rmsVoltage?: number
    crestFactor?: number
    auc?: number
    riseTimeMs?: number
    fallTimeMs?: number
  }
  waveform?: number[]        // 50 Hz burst ADC raw oscillogram array (20-100 pts)
  label: 'LIGHT' | 'NORMAL' | 'HEAVY' // Ground-truth classification
  measuredEnergyJ?: number   // Real measured energy if current shunt exists
  estimatedEnergyJ?: number  // 0.5 * C * V^2 capacitive estimation
  measurementQuality: 'VALID' | 'OUT_OF_RANGE' | 'ESTIMATED'
  rejected: boolean          // True if flagged as mechanical noise or electrical artifact
  rejectionReason?: string   // Specific rule violation
  version: string            // Dataset schema version (e.g. 'dataset-v1')
}
```

---

## 3. Data Quality Gate
Before any dataset can be frozen or utilized for model training, it must pass the deterministic **Data Quality Gate**:

1. **Minimum Sample Size:**
   - At least 30 valid empirical samples must be collected.
2. **Participant Diversity:**
   - At least 3 unique, anonymized participants (`participantId`) must be present to prevent subject memorization.
3. **Class Balance Gate:**
   - Minimum 60% class balance score (ideal is 33.3% per class).
4. **Physical Outlier Filters:**
   - $V_{\text{peak}} \le 35\text{ V}$ (physical ceiling for PZT discs under human footstep)
   - $V_{\text{avg}} \le V_{\text{peak}}$ (physical impossibility check)
   - $t_{\text{pulse}} \ge 10\text{ ms}$ and $t_{\text{pulse}} \le 1000\text{ ms}$ (mechanical cadence filter)
   - $V_{\text{store}} \le 5.5\text{ V}$ (supercapacitor over-voltage boundary)

---

## 4. Dataset Versioning & Freezing
To guarantee reproducibility:
- Dataset collections can be frozen via `POST /api/ai/datasets/freeze`.
- Frozen datasets receive an immutable version tag (e.g. `v1.0-baseline`).
- New footstep recordings cannot be appended to a frozen version, ensuring benchmarks and model comparisons run on identical sample populations.
