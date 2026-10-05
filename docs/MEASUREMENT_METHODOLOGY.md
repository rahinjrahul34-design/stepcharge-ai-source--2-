# StepCharge AI — Measurement Methodology & Scientific Rationale

## 1. Physical Distinctions in Piezoelectric Energy Harvesting

In physical harvesting systems, conflating potential energy, open-circuit voltage, and transferred electrical energy is a widespread source of flawed research claims. StepCharge AI enforces strict physical boundaries:

```
[Mechanical Footstep Impact]
         │
         ▼
[Piezoelectric Crystal Lattice Strain] ───> Open-Circuit Piezo Voltage (Spikes up to 20-40V, high impedance)
         │
         ▼
[Bridge Rectifier & Filter] ───────────────> Forward diode loss (2 x Vf ≈ 0.6V), internal ESR dissipation
         │
         ▼
[Supercapacitor Charge Accumulation] ─────> Storage Rail Voltage (0 - 5V across 0.1F capacitor)
         │
         ▼
[Regulated Load Discharge] ───────────────> Load Voltage V(t) & Load Current I(t) ──> Real Useful Energy
```

---

## 2. Why $E = \frac{1}{2} C V^2$ is NOT "Harvested Energy per Step"

The equation:
$$E_{\text{stored}} = \frac{1}{2} C V^2$$
describes the total electrostatic energy accumulated inside the dielectric of the supercapacitor at an instantaneous terminal voltage $V$.

If a footstep causes the capacitor to charge from $V_1$ to $V_2$, the incremental energy delta accumulated is:
$$\Delta E = \frac{1}{2} C (V_2^2 - V_1^2)$$
**Critical Insights:**
1. $\Delta E$ is non-linear with respect to voltage. A $0.1\text{V}$ rise from $4.0\text{V} \to 4.1\text{V}$ represents $\approx 40.5\,\text{mJ}$ (for $C = 0.1\text{F}$), whereas the same $0.1\text{V}$ rise from $1.0\text{V} \to 1.1\text{V}$ represents only $\approx 10.5\,\text{mJ}$.
2. Supercapacitors exhibit non-zero leakage currents ($10–50\,\mu\text{A}$) and equivalent series resistance (ESR).
3. Therefore, $E = \frac{1}{2} C V^2$ is strictly tagged in StepCharge AI as:
   $$\textbf{ESTIMATED STORED ENERGY}$$
   and is never displayed as directly measured harvested energy.

---

## 3. Real Electrical Energy via Current Integration
To claim research-grade energy measurement, the system must integrate real instantaneous power:
$$E = \int_{t_0}^{t_1} V(t) \cdot I(t) \, dt \approx \sum_{k=1}^{N} V_k \cdot I_k \cdot \Delta t$$

Without measuring current $I(t)$, one cannot distinguish between:
- A high voltage across an open circuit (zero current $\implies$ zero energy transferred).
- A high voltage delivering power into a low-impedance load (high current $\implies$ significant energy transferred).

---

## 4. The Harm of "Synthetic Zeroes"
In naive IoT dashboards, absent sensors often report `0.00` or arbitrary placeholders. 
In scientific systems, **this corrupts data**:
1. If an INA219 sensor is disconnected, recording $I = 0.00\,\text{A}$ implies that zero current flowed through a powered load (an electrical impossibility).
2. Machine-learning algorithms trained on datasets where unmeasured fields are represented by zeroes learn spurious zero-correlations.
3. In StepCharge AI:
   - When a sensor is not installed, the field value is strictly `null`.
   - The provenance state is explicitly tagged `UNAVAILABLE`.
   - The UI displays `"Not measured"` and never plots a fake zero line.

---

## 5. Waveform Nyquist & Sampling Rate
- Footstep mechanical impact pulses last between $80\,\text{ms}$ and $450\,\text{ms}$.
- Dominant frequency components in rectified piezoelectric gait impacts lie below $20\,\text{Hz}$.
- By sampling at **50 Hz** ($T_s = 20\,\text{ms}$), the ESP32 captures between 15 and 30 samples across the rise, peak, and decay phases of a step impulse.
- A 60-sample window captures $1.2\,\text{seconds}$ of oscillogram data, completely resolving the footstep envelope while preserving microcontroller RAM and network payload bandwidth.
