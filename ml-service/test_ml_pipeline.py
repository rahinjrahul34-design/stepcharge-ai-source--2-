"""
StepCharge AI — Automated Test Suite for ML Service (Phase 3)
Tests:
- Data Quality Gate & Dataset Validation
- Waveform Feature Extraction & Signal Features
- Anomaly Detection (Isolation Forest + Deterministic Rules)
- Energy Forecasting & Insufficient Data Protection
- Multi-Model Training & Cross-Validation
"""

import unittest
import numpy as np
import pandas as pd
from feature_engine import extract_waveform_features, engineer_sample_features, WAVEFORM_FEATURES
from anomaly_detector import AnomalyDetector
from energy_forecaster import EnergyForecaster
from train_model import (
    validate_dataset,
    DatasetError,
    instantiate_model,
    compare_all_models,
    run_feature_study,
)


class TestMLPipeline(unittest.TestCase):
    def setUp(self):
        # Generate synthetic test dataset with 30 valid samples across 3 classes and 2 participants
        data = []
        for i in range(30):
            cls = ["LIGHT", "NORMAL", "HEAVY"][i % 3]
            pv = 1.0 + (i % 3) * 1.5 + np.random.uniform(0.1, 0.5)
            av = pv * 0.45
            dur = 150.0 + (i % 3) * 50.0
            si = 1.2
            sv = 3.5 + (i * 0.02)
            pid = f"P00{1 + (i % 2)}"
            data.append({
                "id": f"SMP_{i}",
                "participantId": pid,
                "peakVoltage": pv,
                "averageVoltage": av,
                "pulseDuration": dur,
                "stepInterval": si,
                "storageVoltage": sv,
                "label": cls,
            })
        self.valid_df = pd.DataFrame(data)

    def test_waveform_feature_extraction(self):
        # 60 samples impulse waveform
        wf = [0.05, 0.1, 0.3, 1.2, 3.5, 4.2, 3.8, 2.1, 1.0, 0.4, 0.1, 0.05]
        feats = extract_waveform_features(wf, sampling_rate=50.0)
        self.assertEqual(feats["wf_peak"], 4.2)
        self.assertGreater(feats["wf_rms"], 0.0)
        self.assertGreater(feats["wf_auc"], 0.0)
        self.assertGreater(feats["wf_crest_factor"], 1.0)
        for k in WAVEFORM_FEATURES:
            self.assertIn(k, feats)

    def test_dataset_validation_success(self):
        clean_df, warnings = validate_dataset(self.valid_df)
        self.assertEqual(len(clean_df), 30)

    def test_dataset_validation_bounds_rejection(self):
        bad_df = self.valid_df.copy()
        # Make one row physically impossible (averageVoltage > peakVoltage)
        bad_df.loc[0, "averageVoltage"] = 50.0
        bad_df.loc[0, "peakVoltage"] = 2.0
        clean_df, warnings = validate_dataset(bad_df)
        self.assertEqual(len(clean_df), 29)
        self.assertTrue(any("exceeded peakVoltage" in w for w in warnings))

    def test_anomaly_detection_rules(self):
        detector = AnomalyDetector()
        # Storage overvoltage trigger
        res = detector.detect_sample({
            "peakVoltage": 3.0,
            "averageVoltage": 1.2,
            "pulseDuration": 200.0,
            "stepInterval": 1.0,
            "storageVoltage": 5.8,  # > 5.5 V safety limit
        })
        self.assertTrue(res["isAnomaly"])
        self.assertEqual(res["anomalyType"], "STORAGE_ANOMALY")
        self.assertEqual(res["severity"], "CRITICAL")

        # Voltage spike trigger
        res2 = detector.detect_sample({
            "peakVoltage": 42.0,  # > 35 V
            "averageVoltage": 12.0,
            "pulseDuration": 150.0,
            "stepInterval": 1.0,
            "storageVoltage": 4.0,
        })
        self.assertTrue(res2["isAnomaly"])
        self.assertEqual(res2["anomalyType"], "VOLTAGE_SPIKE")

    def test_energy_forecaster_insufficient_data(self):
        forecaster = EnergyForecaster()
        # Fewer than 20 samples must safely report INSUFFICIENT_DATA
        res = forecaster.fit_and_evaluate([{"storageVoltage": 3.0}] * 5)
        self.assertEqual(res["status"], "INSUFFICIENT_DATA")
        self.assertFalse(res["isAvailable"])

    def test_energy_forecaster_sufficient_data(self):
        forecaster = EnergyForecaster()
        hist = []
        for i in range(25):
            hist.append({
                "peakVoltage": 2.5,
                "averageVoltage": 1.1,
                "pulseDuration": 180.0,
                "stepInterval": 1.2,
                "storageVoltage": 2.0 + i * 0.05,
                "measuredEnergyJ": 0.05 + i * 0.002,
            })
        res = forecaster.fit_and_evaluate(hist)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["isAvailable"])
        self.assertIn("forecast", res)
        self.assertGreater(res["forecast"]["predictedNextHourEnergyJ"], 0)

    def test_multi_model_comparison(self):
        comparison = compare_all_models(self.valid_df)
        self.assertEqual(len(comparison["models"]), 4)
        algo_names = [m["algorithm"] for m in comparison["models"]]
        self.assertIn("Random Forest", algo_names)
        self.assertIn("Gradient Boosting", algo_names)
        self.assertIn("Logistic Regression", algo_names)
        self.assertIn("Support Vector Machine", algo_names)
        self.assertTrue(any(m["isRecommended"] for m in comparison["models"]))

    def test_feature_study(self):
        study = run_feature_study(self.valid_df)
        self.assertIn("studies", study)
        self.assertGreaterEqual(len(study["studies"]), 2)


if __name__ == "__main__":
    unittest.main()
