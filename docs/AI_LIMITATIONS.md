# StepCharge AI — Model & Engineering Limitations
## Transparent Academic Disclosure of System Constraints

---

### 1. Transducer & Biomechanical Constraints

1. **Piezoelectric Non-Linearity**:
   Lead Zirconate Titanate (PZT) ceramic elements exhibit non-linear voltage generation under dynamic stress. Voltage output depends not only on force, but on the instantaneous strain rate ($\frac{d\sigma}{dt}$). A fast light strike can generate a higher peak voltage than a slow heavy compression.
2. **Contact Surface & Footwear Cushioning**:
   Footwear with thick ethylene-vinyl acetate (EVA) foam soles dampens the impulse rise time, stretching pulse duration and lowering peak voltage. The classifier must be calibrated for typical footwear types.
3. **Spatial Transducer Placement**:
   The mat consists of discrete piezoelectric ceramic discs. Strikes landing directly on a transducer element produce higher output than strikes landing between elements. Future revisions will explore continuous PVDF films.

---

### 2. Electronics & Measurement Constraints

1. **ADC Voltage Envelope Saturation**:
   The ESP32 onboard ADC1 attenuator clips rectified analog input at 3.3 V (or 36.0 V on attenuated divider channels). Extremely violent strikes above channel ceiling saturate the ADC, truncating waveform crests.
2. **Current Sensor Shunt Resolution**:
   Low-side current sensing requires footsteps producing current $> 0.5\text{ mA}$ for reliable ADC bit quantization. Sub-milliamp micro-harvesting events fall below shunt resolution.
3. **Capacitive Theoretical Estimation**:
   When optional I2C current shunt hardware is not installed, the platform falls back to capacitive potential energy $E = \frac{1}{2} C V^2$. This theoretical value measures stored charge, not dynamic kinetic energy generated during the strike.

---

### 3. Anti-Fabrication & Academic Transparency Pledge

StepCharge AI enforces strict scientific integrity:
- **No Synthetic Metrics**: If models have not been evaluated against real data, metrics display `NOT EVALUATED` or `INSUFFICIENT DATA`.
- **No Hallucinated Forecasting**: Energy forecasting requires at least 20 sequential empirical footsteps. Below 20, forecasting displays an explicit warning rather than a speculative trendline.
- **No Masked Failures**: Sensor decoupling, overvoltages, and missing packets are logged as explicit anomalies rather than silently interpolated.
