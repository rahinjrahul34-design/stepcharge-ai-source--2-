"""
StepCharge AI — Feature Engineering Engine (Phase 3)
Supports feature extraction across baseline features, high-resolution oscillograms,
and electrical current/power measurements.
"""

from __future__ import annotations
import math
from typing import Any
import numpy as np

# Feature sets
BASELINE_FEATURES = [
    "peakVoltage",
    "averageVoltage",
    "pulseDuration",
    "stepInterval",
    "storageVoltage",
]

WAVEFORM_FEATURES = [
    "wf_peak",
    "wf_rms",
    "wf_mean",
    "wf_std",
    "wf_rise_time",
    "wf_fall_time",
    "wf_auc",
    "wf_crest_factor",
    "wf_pulse_width",
]

ELECTRICAL_FEATURES = [
    "current",
    "power",
    "energy",
]

FEATURE_VERSIONS = {
    "features-v1": BASELINE_FEATURES,
    "features-v2": BASELINE_FEATURES + WAVEFORM_FEATURES,
    "features-v3": BASELINE_FEATURES + ELECTRICAL_FEATURES,
    "features-v4": BASELINE_FEATURES + WAVEFORM_FEATURES + ELECTRICAL_FEATURES,
}


def extract_waveform_features(
    waveform: list[float] | np.ndarray, sampling_rate: float = 50.0
) -> dict[str, float]:
    """
    Computes biomechanical and signal features from a discrete footstep oscillogram.
    sampling_rate: samples per second (default 50 Hz, dt = 20ms).
    """
    if waveform is None or len(waveform) < 5:
        return {k: 0.0 for k in WAVEFORM_FEATURES}

    arr = np.array(waveform, dtype=float)
    n = len(arr)
    dt = 1.0 / max(sampling_rate, 1.0)  # seconds per sample

    peak = float(np.max(arr))
    mean = float(np.mean(arr))
    std = float(np.std(arr))
    rms = float(np.sqrt(np.mean(arr**2)))

    crest_factor = float(peak / rms) if rms > 1e-6 else 1.0

    # Trapezoidal area under curve (Volt-seconds)
    auc = float(np.trapezoid(arr, dx=dt) if hasattr(np, "trapezoid") else np.trapz(arr, dx=dt))

    # Timing analysis
    max_idx = int(np.argmax(arr))
    peak_val = max(peak, 1e-4)

    # Rise time (10% to 90% of peak)
    t_10 = 0
    t_90 = max_idx
    for i in range(max_idx + 1):
        if arr[i] >= 0.1 * peak_val and t_10 == 0:
            t_10 = i
        if arr[i] >= 0.9 * peak_val:
            t_90 = i
            break
    rise_time_ms = float(max(0, (t_90 - t_10) * dt * 1000.0))

    # Fall time (peak to 10% of peak)
    t_decay = n - 1
    for i in range(max_idx, n):
        if arr[i] <= 0.1 * peak_val:
            t_decay = i
            break
    fall_time_ms = float(max(0, (t_decay - max_idx) * dt * 1000.0))

    # Pulse width (> 20% of peak)
    above_20 = np.where(arr >= 0.2 * peak_val)[0]
    pulse_width_ms = float(len(above_20) * dt * 1000.0) if len(above_20) > 0 else 0.0

    return {
        "wf_peak": round(peak, 4),
        "wf_rms": round(rms, 4),
        "wf_mean": round(mean, 4),
        "wf_std": round(std, 4),
        "wf_rise_time": round(rise_time_ms, 2),
        "wf_fall_time": round(fall_time_ms, 2),
        "wf_auc": round(auc, 4),
        "wf_crest_factor": round(crest_factor, 3),
        "wf_pulse_width": round(pulse_width_ms, 2),
    }


def engineer_sample_features(
    raw_sample: dict[str, Any], feature_version: str = "features-v1"
) -> dict[str, float]:
    """
    Transforms a single footstep record into an exact feature vector according to feature_version.
    """
    feats: dict[str, float] = {}

    # Baseline features
    for f in BASELINE_FEATURES:
        val = raw_sample.get(f)
        feats[f] = float(val) if val is not None and not math.isnan(float(val)) else 0.0

    target_keys = FEATURE_VERSIONS.get(feature_version, BASELINE_FEATURES)

    # Waveform features
    if any(k.startswith("wf_") for k in target_keys):
        wf = raw_sample.get("waveform") or []
        rate = float(raw_sample.get("samplingRate") or 50.0)
        wf_feats = extract_waveform_features(wf, sampling_rate=rate)
        for k in WAVEFORM_FEATURES:
            if k in target_keys:
                feats[k] = wf_feats.get(k, 0.0)

    # Electrical features
    if "current" in target_keys:
        curr = raw_sample.get("current") or raw_sample.get("currentMa")
        feats["current"] = float(curr) if curr is not None and not math.isnan(float(curr)) else 0.0
    if "power" in target_keys:
        pwr = raw_sample.get("power") or raw_sample.get("powerMw")
        feats["power"] = float(pwr) if pwr is not None and not math.isnan(float(pwr)) else 0.0
    if "energy" in target_keys:
        en = raw_sample.get("measuredEnergyJ") or raw_sample.get("energy")
        feats["energy"] = float(en) if en is not None and not math.isnan(float(en)) else 0.0

    return feats
