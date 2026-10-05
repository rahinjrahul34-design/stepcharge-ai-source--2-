# StepCharge AI — Honest Technical & Engineering Limitations

## 1. Physical Hardware Limitations

### 1.1 Piezoelectric Non-Linearity
- Lead Zirconate Titanate (PZT) ceramic transducers exhibit non-linear electromechanical coupling under dynamic high-impact stress.
- Voltage output saturation can occur at strike forces exceeding 800 N, compressing the voltage differentiation between heavy walking and running.

### 1.2 Footwear & Substrate Mechanical Low-Pass Filtering
- Thick rubber or foam running shoe soles act as an elastomeric mechanical damper, reducing impact peak voltage by up to 40% and lengthening pulse duration.
- Strike waveforms collected in running shoes must be normalized or compared against identical footwear configurations.

### 1.3 Supercapacitor Leakage & Dynamic Impedance
- The 0.1 F / 5.5 V supercapacitor exhibits internal equivalent series resistance (ESR $\approx 25\,\Omega$) and self-discharge leakage currents ($\approx 5-15\,\mu\text{A}$).
- Energy calculated via $E = \frac{1}{2} C V^2$ reflects electrostatic potential stored in the buffer rail, not total instantaneous mechanical energy transduced by the discs.

### 1.4 Current Sensor Quantization Floor
- When equipped with an INA219 current shunt, currents below $0.5\text{ mA}$ approach the quantization noise floor of the ADC. Instantaneous power measurements below this threshold are subject to discrete measurement noise.

---

## 2. Machine Learning & Computational Constraints

### 2.1 Participant Generalization
- Classifiers trained without subject-independent CV exhibit optimistic cross-validation accuracy due to memorizing idiosyncratic cadence rhythms.
- The system mandates GroupKFold by `participantId`, but accuracy on completely novel footwear or atypical gaits may degrade by 8–12%.

### 2.2 Cold-Start Energy Forecasting
- Energy forecasting relies on rolling historical cadence and charge rates. With fewer than 20 recorded footsteps, the system deliberately renders `INSUFFICIENT_DATA` rather than generating speculative forecasts.

---

## 3. Communication & Environmental Factors

### 3.1 2.4 GHz Wi-Fi Propagation
- ESP32 transmissions in dense RF environments (crowded 2.4 GHz spectrum) may experience packet retry delays (50–300 ms).
- On-device burst sampling buffers samples locally to prevent data loss during transient disconnections.
