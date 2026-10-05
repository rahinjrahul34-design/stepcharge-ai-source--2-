"""
StepCharge AI — Anomaly Detection Engine (Phase 3)
Combines Machine-Learning Anomaly Detection (Isolation Forest) with
Deterministic Physical Rule-based Diagnostics.
"""

from __future__ import annotations
import math
from typing import Any
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

ANOMALY_FEATURES = [
    "peakVoltage",
    "averageVoltage",
    "pulseDuration",
    "stepInterval",
    "storageVoltage",
]


class AnomalyDetector:
    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state
        self.model: IsolationForest | None = None
        self.feature_stats: dict[str, dict[str, float]] = {}

    def fit(self, df: pd.DataFrame) -> None:
        """
        Fits Isolation Forest on historical clean samples.
        """
        valid_cols = [c for c in ANOMALY_FEATURES if c in df.columns]
        if len(df) < 10 or len(valid_cols) < len(ANOMALY_FEATURES):
            return

        X = df[ANOMALY_FEATURES].astype(float).fillna(0.0)

        # Store baseline quantiles for explainability
        self.feature_stats = {}
        for col in ANOMALY_FEATURES:
            q05 = float(X[col].quantile(0.05))
            q95 = float(X[col].quantile(0.95))
            median = float(X[col].median())
            self.feature_stats[col] = {"q05": q05, "q95": q95, "median": median}

        self.model = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=100,
        )
        self.model.fit(X)

    def detect_sample(self, sample: dict[str, Any]) -> dict[str, Any]:
        """
        Evaluates a single sample against deterministic rules and the fitted ML model.
        Returns:
            {
               "isAnomaly": bool,
               "anomalyType": str,
               "severity": "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
               "source": "RULE-BASED" | "ML-BASED",
               "status": "NORMAL" | "SUSPICIOUS" | "ANOMALOUS",
               "anomalyScore": float | null,
               "observedValue": any,
               "typicalRange": str,
               "possibleCause": str,
            }
        """
        # 1. Deterministic Physical Bounds Check (RULE-BASED)
        pv = float(sample.get("peakVoltage", 0.0))
        av = float(sample.get("averageVoltage", 0.0))
        dur = float(sample.get("pulseDuration", 0.0))
        si = float(sample.get("stepInterval", 0.0))
        sv = float(sample.get("storageVoltage", 0.0))

        if sv > 5.5:
            return {
                "isAnomaly": True,
                "anomalyType": "STORAGE_ANOMALY",
                "severity": "CRITICAL",
                "source": "RULE-BASED",
                "status": "ANOMALOUS",
                "anomalyScore": 1.0,
                "observedValue": f"{sv:.2f} V",
                "typicalRange": "1.00 V – 5.00 V",
                "possibleCause": "Supercapacitor voltage exceeded rated maximum safety ceiling.",
            }

        if pv > 35.0:
            return {
                "isAnomaly": True,
                "anomalyType": "VOLTAGE_SPIKE",
                "severity": "HIGH",
                "source": "RULE-BASED",
                "status": "ANOMALOUS",
                "anomalyScore": 0.95,
                "observedValue": f"{pv:.2f} V",
                "typicalRange": "0.20 V – 25.00 V",
                "possibleCause": "Abnormally high impact kinetic impulse on piezoelectric transducer.",
            }

        if dur > 5000.0:
            return {
                "isAnomaly": True,
                "anomalyType": "UNUSUAL_PULSE",
                "severity": "MEDIUM",
                "source": "RULE-BASED",
                "status": "ANOMALOUS",
                "anomalyScore": 0.85,
                "observedValue": f"{dur:.0f} ms",
                "typicalRange": "20 ms – 1500 ms",
                "possibleCause": "Prolonged contact or mechanical settling on harvest mat.",
            }

        if av > pv * 1.05 and pv > 0.1:
            return {
                "isAnomaly": True,
                "anomalyType": "SENSOR_FAILURE",
                "severity": "HIGH",
                "source": "RULE-BASED",
                "status": "ANOMALOUS",
                "anomalyScore": 0.9,
                "observedValue": f"Avg: {av:.2f}V > Peak: {pv:.2f}V",
                "typicalRange": "Average voltage <= Peak voltage",
                "possibleCause": "ADC acquisition timing fault or hardware channel corruption.",
            }

        # 2. Machine-Learning Anomaly Detection (Isolation Forest)
        if self.model is not None and self.feature_stats:
            row = pd.DataFrame([[pv, av, dur, si, sv]], columns=ANOMALY_FEATURES)
            pred = int(self.model.predict(row)[0])  # 1 = inlier, -1 = outlier
            raw_score = float(self.model.decision_function(row)[0])  # lower = more anomalous

            # Normalize raw_score (typically -0.3 to +0.3) to 0.0 - 1.0 anomaly index
            norm_anomaly_score = round(max(0.0, min(1.0, 0.5 - raw_score * 2.0)), 3)

            if pred == -1 or norm_anomaly_score >= 0.70:
                # Identify which feature contributed most to outlier status
                max_dev = 0.0
                driving_feat = "peakVoltage"
                for f, val in zip(ANOMALY_FEATURES, [pv, av, dur, si, sv]):
                    stats = self.feature_stats.get(f, {})
                    med = stats.get("median", 1.0)
                    dev = abs(val - med) / (max(abs(med), 0.1))
                    if dev > max_dev:
                        max_dev = dev
                        driving_feat = f

                st = self.feature_stats.get(driving_feat, {})
                q05 = st.get("q05", 0.0)
                q95 = st.get("q95", 10.0)
                obs_val = getattr(row[driving_feat], "iloc", [0])[0]

                return {
                    "isAnomaly": True,
                    "anomalyType": "UNUSUAL_STEP_INTERVAL" if driving_feat == "stepInterval" else "VOLTAGE_SPIKE",
                    "severity": "MEDIUM" if norm_anomaly_score < 0.85 else "HIGH",
                    "source": "ML-BASED",
                    "status": "ANOMALOUS" if norm_anomaly_score >= 0.80 else "SUSPICIOUS",
                    "anomalyScore": norm_anomaly_score,
                    "observedValue": f"{obs_val:.2f} ({driving_feat})",
                    "typicalRange": f"{q05:.2f} – {q95:.2f}",
                    "possibleCause": f"Multivariate deviation detected primarily in {driving_feat}.",
                }

        # Normal condition
        return {
            "isAnomaly": False,
            "anomalyType": "NONE",
            "severity": "INFO",
            "source": "RULE-BASED",
            "status": "NORMAL",
            "anomalyScore": 0.05,
            "observedValue": "Normal",
            "typicalRange": "Within learned operational bounds",
            "possibleCause": "None",
        }
