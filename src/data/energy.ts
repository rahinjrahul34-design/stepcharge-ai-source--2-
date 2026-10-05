/**
 * Energy estimation model — documented so reviewers can audit the assumptions.
 *
 * The prototype measures VOLTAGE only (ESP32 ADC across a divider). Current is
 * NOT measured, therefore instantaneous electrical power cannot be measured.
 * We therefore report an ESTIMATE based on the energy actually banked in the
 * supercapacitor, which is a function of a measured voltage and a known
 * capacitance:
 *
 *      E = 0.5 * C * V^2            [joules]
 *
 * Per-step energy is ESTIMATED from the pulse envelope assuming the harvester
 * drives an equivalent load resistance R_eq after rectification:
 *
 *      E_step ≈ (V_avg^2 / R_eq) * t_pulse
 *
 * R_EQ_OHMS is a project-defined constant, not a measurement. Replace it with a
 * bench-characterised value (or add a current-sense front-end) to upgrade these
 * numbers from ESTIMATED to MEASURED.
 */
export const R_EQ_OHMS = 10_000
export const DEFAULT_FARADS = 1.0

export const storedEnergyJ = (volts: number, farads = DEFAULT_FARADS) =>
  0.5 * farads * volts * volts

export const stepEnergyJ = (avgVolts: number, pulseMs: number, rEq = R_EQ_OHMS) =>
  ((avgVolts * avgVolts) / rEq) * (pulseMs / 1000)

/** CALCULATED instantaneous power from the same assumption. */
export const estPowerMw = (volts: number, rEq = R_EQ_OHMS) => ((volts * volts) / rEq) * 1000

export const PROVENANCE_NOTE: Record<string, string> = {
  voltage: 'MEASURED — ESP32 ADC via resistive divider after rectification.',
  current: 'NOT MEASURED — no current-sense hardware fitted on this prototype.',
  power: 'CALCULATED — V²/R_eq with a project-defined equivalent load resistance.',
  energy: 'ESTIMATED — ½CV² for storage, V²/R_eq·t for per-step harvest.',
  classification: 'PREDICTED — ML classifier output with confidence score.',
}
