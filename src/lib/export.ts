import type { FootstepEvent, SourceMode } from '../data/types'

export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * CSV export. Only fields the system actually holds are written; unmeasured
 * quantities are exported as empty cells, never as fabricated numbers.
 * A provenance header records where the data came from.
 */
export function eventsToCsv(
  rows: FootstepEvent[],
  meta: { deviceId: string; mode: SourceMode; range: string },
): string {
  const header = [
    `# StepCharge AI telemetry export`,
    `# Generated at: ${new Date().toISOString()}`,
    `# Data source: ${meta.mode === 'demo' ? 'DEMO (SIMULATED DATA — not measured)' : 'LIVE ESP32 TELEMETRY'}`,
    `# Device ID: ${meta.deviceId}`,
    `# Range: ${meta.range}`,
    `# Note: current/power are not measured on this prototype; energy is estimated (V^2/R_eq*t per step).`,
  ].join('\n')
  const cols = [
    'timestamp',
    'device_id',
    'peak_voltage_v',
    'average_voltage_v',
    'storage_voltage_v',
    'pulse_duration_ms',
    'step_interval_s',
    'current_a',
    'power_w',
    'estimated_energy_j',
    'step_class',
    'confidence',
    'prediction_source',
    'data_source',
  ].join(',')
  const body = rows.map((r) =>
    [
      r.timestamp,
      r.device_id,
      r.features.peakVoltage.toFixed(3),
      r.features.averageVoltage.toFixed(3),
      r.storage_voltage.toFixed(3),
      r.pulse_duration_ms,
      (r.step_interval_ms / 1000).toFixed(3),
      '', // current — not measured
      '', // power — not measured
      r.estimated_energy_j.toFixed(6),
      r.step_class,
      r.confidence === null ? '' : r.confidence.toFixed(3),
      r.prediction_source,
      r.source,
    ].join(','),
  )
  return [header, cols, ...body].join('\n')
}
