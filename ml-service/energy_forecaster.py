"""
StepCharge AI — Energy Forecasting Engine (Phase 3)
Time-Series Regression for Future Energy Harvesting Yield.
Strictly adheres to time-based validation and rejects training if historical data is insufficient.
"""

from __future__ import annotations
import math
from typing import Any
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

MIN_FORECAST_SAMPLES = 20


class EnergyForecaster:
    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.model: RandomForestRegressor | None = None
        self.metrics: dict[str, float] | None = None
        self.version = "forecast-v1.0"

    def fit_and_evaluate(self, historical_data: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Fits regressor on historical time series data using strictly temporal train-then-test split.
        Never shuffles time-series data.
        """
        if not historical_data or len(historical_data) < MIN_FORECAST_SAMPLES:
            return {
                "status": "INSUFFICIENT_DATA",
                "message": f"At least {MIN_FORECAST_SAMPLES} historical sequential samples required for energy forecasting (received {len(historical_data) if historical_data else 0}).",
                "metrics": None,
                "isAvailable": False,
            }

        df = pd.DataFrame(historical_data)

        # Prepare temporal feature representations
        feature_cols = ["peakVoltage", "averageVoltage", "pulseDuration", "stepInterval", "storageVoltage"]
        for c in feature_cols:
            if c not in df.columns:
                df[c] = 0.0
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

        # Target: measured energy if present, otherwise theoretical 0.5*C*V^2 storage delta
        if "measuredEnergyJ" in df.columns and df["measuredEnergyJ"].dropna().count() >= MIN_FORECAST_SAMPLES:
            target_col = "measuredEnergyJ"
            target_type = "MEASURED"
        else:
            # Theoretical energy proxy (0.5 * 0.1 * V^2)
            df["estimatedEnergyJ"] = 0.5 * 0.1 * (df["storageVoltage"] ** 2)
            target_col = "estimatedEnergyJ"
            target_type = "ESTIMATED"

        y = df[target_col].astype(float)
        X = df[feature_cols].astype(float)

        # Strictly temporal split (first 75% train, last 25% test) — no shuffling!
        split_idx = int(len(df) * 0.75)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

        self.model = RandomForestRegressor(n_estimators=100, random_state=self.random_state)
        self.model.fit(X_train, y_train)

        y_pred = self.model.predict(X_test)
        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

        # Mean Absolute Percentage Error (avoid division by zero)
        non_zero = y_test > 1e-4
        if non_zero.any():
            mape = float(np.mean(np.abs((y_test[non_zero] - y_pred[non_zero]) / y_test[non_zero])) * 100.0)
        else:
            mape = 0.0

        self.metrics = {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "mapePercent": round(mape, 2),
            "testSamples": len(y_test),
            "targetType": target_type,
        }

        # Project next hour / next session expected energy based on recent cadence
        recent_window = X.iloc[-5:]
        projected_per_step = float(np.mean(self.model.predict(recent_window)))
        recent_interval = float(recent_window["stepInterval"].median())
        steps_per_hour = (3600.0 / max(recent_interval, 1.0)) if recent_interval > 0 else 600.0
        predicted_next_hour_energy_j = round(projected_per_step * min(steps_per_hour, 3000.0), 3)

        return {
            "status": "SUCCESS",
            "isAvailable": True,
            "version": self.version,
            "targetType": target_type,
            "metrics": self.metrics,
            "forecast": {
                "predictedEnergyPerStepJ": round(projected_per_step, 4),
                "expectedStepsNextHour": int(min(steps_per_hour, 3000.0)),
                "predictedNextHourEnergyJ": predicted_next_hour_energy_j,
                "confidenceInterval95": [
                    round(max(0.0, predicted_next_hour_energy_j - 1.96 * rmse * math.sqrt(50)), 2),
                    round(predicted_next_hour_energy_j + 1.96 * rmse * math.sqrt(50), 2),
                ],
            },
        }
