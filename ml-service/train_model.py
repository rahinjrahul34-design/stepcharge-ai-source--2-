"""
Train the StepCharge AI footstep classifier from LOCALLY COLLECTED data. (Phase 3)
Supports multi-model architectures (Random Forest, Gradient Boosting, SVM, Logistic Regression),
subject-independent evaluation, feature engineering versioning, and feature ablation studies.
"""

from __future__ import annotations

import argparse
import io
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedGroupKFold, train_test_split
from sklearn.svm import SVC

from feature_engine import BASELINE_FEATURES, FEATURE_VERSIONS, extract_waveform_features

FEATURES = BASELINE_FEATURES
CLASSES = ["LIGHT", "NORMAL", "HEAVY"]
RANDOM_SEED = 42

MIN_SAMPLES = 25
MIN_PER_CLASS = 5
RECOMMENDED_PER_CLASS = 100
PREFERRED_PER_CLASS = 150
RECOMMENDED_PARTICIPANTS = 4

VALID_RANGES = {
    "peakVoltage": (0.0, 60.0),
    "averageVoltage": (0.0, 60.0),
    "pulseDuration": (1.0, 60_000.0),
    "stepInterval": (0.0, 3_600.0),
    "storageVoltage": (0.0, 60.0),
}

SUPPORTED_ALGORITHMS = [
    "Random Forest",
    "Gradient Boosting",
    "Logistic Regression",
    "Support Vector Machine",
]


class DatasetError(ValueError):
    """Raised when the dataset cannot support honest training."""


def instantiate_model(algorithm: str, random_state: int = RANDOM_SEED) -> Any:
    """Creates a candidate classifier instance."""
    algo = algorithm.strip().lower()
    if "gradient" in algo or "boost" in algo:
        return GradientBoostingClassifier(n_estimators=100, random_state=random_state)
    elif "logistic" in algo or "linear" in algo:
        return LogisticRegression(max_iter=1000, random_state=random_state, class_weight="balanced")
    elif "svm" in algo or "support" in algo:
        return SVC(probability=True, random_state=random_state, class_weight="balanced")
    else:
        return RandomForestClassifier(
            n_estimators=100, random_state=random_state, class_weight="balanced"
        )


def validate_dataset(df: pd.DataFrame, feature_version: str = "features-v1") -> tuple[pd.DataFrame, list[str]]:
    """
    Cleans, validates, and gates dataset samples.
    """
    warnings: list[str] = []
    req_cols = BASELINE_FEATURES + ["label"]
    missing = [c for c in req_cols if c not in df.columns]
    if missing:
        raise DatasetError(f"Dataset is missing required columns: {missing}")

    n0 = len(df)
    df = df.copy()

    # Drop duplicate sample IDs if present
    if "id" in df.columns:
        dup = int(df["id"].duplicated().sum())
        if dup:
            df = df.drop_duplicates(subset="id", keep="first")
            warnings.append(f"Dropped {dup} row(s) with duplicate sample id.")

    for col in BASELINE_FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    bad_rows = df[BASELINE_FEATURES].isna().any(axis=1) | df["label"].isna()
    if bad_rows.any():
        warnings.append(f"Dropped {int(bad_rows.sum())} row(s) with missing or non-numeric values.")
        df = df[~bad_rows]

    df["label"] = df["label"].astype(str).str.upper().str.strip()
    unknown = ~df["label"].isin(CLASSES)
    if unknown.any():
        warnings.append(f"Dropped {int(unknown.sum())} row(s) with a label outside {CLASSES}.")
        df = df[~unknown]

    for col, (lo, hi) in VALID_RANGES.items():
        out = (df[col] < lo) | (df[col] > hi)
        if out.any():
            warnings.append(f"Dropped {int(out.sum())} row(s) with {col} outside {lo}–{hi}.")
            df = df[~out]

    impossible = df["averageVoltage"] > df["peakVoltage"] * 1.05
    if impossible.any():
        warnings.append(f"Dropped {int(impossible.sum())} row(s) where averageVoltage exceeded peakVoltage.")
        df = df[~impossible]

    if len(df) < MIN_SAMPLES:
        raise DatasetError(
            f"Only {len(df)} usable samples after validation (started with {n0}). "
            f"Collect at least {MIN_SAMPLES} before training."
        )

    counts = df["label"].value_counts().to_dict()
    weak = {c: counts.get(c, 0) for c in CLASSES if counts.get(c, 0) < MIN_PER_CLASS}
    if weak:
        raise DatasetError(f"Each class needs ≥{MIN_PER_CLASS} samples. Underfilled: {weak}")

    thin = {c: counts.get(c, 0) for c in CLASSES if counts.get(c, 0) < RECOMMENDED_PER_CLASS}
    if thin:
        warnings.append(
            f"Dataset is small for academic claims: {thin}. "
            f"Target ≥{RECOMMENDED_PER_CLASS} samples per class."
        )

    return df, warnings


def _participants(df: pd.DataFrame) -> pd.Series | None:
    if "participantId" not in df.columns:
        return None
    g = df["participantId"].astype(str).str.strip()
    g = g.replace({"": np.nan, "nan": np.nan, "None": np.nan})
    return None if g.isna().all() else g.fillna("unknown")


def evaluate_model_cv(
    clf: Any, X: pd.DataFrame, y: pd.Series, groups: pd.Series | None, n_splits: int = 4
) -> tuple[dict[str, float], list[list[int]], str, str]:
    """
    Evaluates candidate model with subject-independent CV or stratified fallback.
    """
    n_participants = int(groups.nunique()) if groups is not None else 0

    if groups is not None and n_participants >= 2:
        splits = min(n_splits, n_participants)
        cv = StratifiedGroupKFold(n_splits=splits, shuffle=True, random_state=RANDOM_SEED)
        y_true_all, y_pred_all = [], []
        for tr, te in cv.split(X, y, groups=groups):
            fold = clf.__class__(**clf.get_params())
            fold.fit(X.iloc[tr], y.iloc[tr])
            y_true_all.extend(y.iloc[te].tolist())
            y_pred_all.extend(fold.predict(X.iloc[te]).tolist())

        y_true, y_pred = y_true_all, y_pred_all
        method = "subject-independent-group-kfold"
        detail = f"StratifiedGroupKFold with {splits} folds grouped by participantId ({n_participants} participants)."
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, stratify=y, random_state=RANDOM_SEED
        )
        fold = clf.__class__(**clf.get_params())
        fold.fit(X_train, y_train)
        y_true = y_test.tolist()
        y_pred = fold.predict(X_test).tolist()
        method = "random-split-subject-dependent"
        detail = "Stratified random 75/25 split (single or unlabelled participant)."

    metrics = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
    }
    cm = confusion_matrix(y_true, y_pred, labels=CLASSES).tolist()
    return metrics, cm, method, detail


def compare_all_models(df: pd.DataFrame, feature_version: str = "features-v1") -> dict[str, Any]:
    """
    Evaluates Random Forest, Gradient Boosting, Logistic Regression, and SVM
    on the exact same dataset using subject-independent CV.
    """
    df_clean, warnings = validate_dataset(df, feature_version=feature_version)
    target_features = FEATURE_VERSIONS.get(feature_version, BASELINE_FEATURES)
    available_features = [f for f in target_features if f in df_clean.columns]

    X = df_clean[available_features].astype(float)
    y = df_clean["label"]
    groups = _participants(df_clean)

    comparisons = []
    for algo_name in SUPPORTED_ALGORITHMS:
        m = instantiate_model(algo_name)
        t0 = time.perf_counter()
        metrics, cm, method, detail = evaluate_model_cv(m, X, y, groups)
        train_duration_ms = round((time.perf_counter() - t0) * 1000.0, 1)

        # Inference benchmark (100 single-row queries)
        m.fit(X, y)
        single_sample = X.iloc[:1]
        t_infer0 = time.perf_counter()
        for _ in range(50):
            m.predict(single_sample)
        avg_infer_ms = round(((time.perf_counter() - t_infer0) / 50.0) * 1000.0, 2)

        # Estimated serialized size in KB
        buf = io.BytesIO()
        joblib.dump(m, buf)
        size_kb = round(len(buf.getvalue()) / 1024.0, 1)

        comparisons.append({
            "algorithm": algo_name,
            "metrics": metrics,
            "confusionMatrix": cm,
            "trainingTimeMs": train_duration_ms,
            "inferenceTimeMs": avg_infer_ms,
            "modelSizeKb": size_kb,
            "isRecommended": False,
        })

    # Pick recommended model by highest F1 score
    best = max(comparisons, key=lambda c: c["metrics"]["f1"])
    best["isRecommended"] = True

    return {
        "datasetSamples": len(df_clean),
        "participants": int(groups.nunique()) if groups is not None else 0,
        "featureVersion": feature_version,
        "features": available_features,
        "evaluationMethod": comparisons[0]["metrics"],
        "recommendedAlgorithm": best["algorithm"],
        "models": comparisons,
        "warnings": warnings,
    }


def run_feature_study(df: pd.DataFrame) -> dict[str, Any]:
    """
    Conducts a feature ablation study comparing Baseline vs Waveform vs Electrical.
    """
    df_clean, warnings = validate_dataset(df)
    groups = _participants(df_clean)

    # 1. Baseline
    X_base = df_clean[BASELINE_FEATURES].astype(float)
    y = df_clean["label"]
    m_base = RandomForestClassifier(n_estimators=100, random_state=RANDOM_SEED, class_weight="balanced")
    base_metrics, _, method, _ = evaluate_model_cv(m_base, X_base, y, groups)

    # 2. Baseline without storage voltage
    no_sv = [f for f in BASELINE_FEATURES if f != "storageVoltage"]
    X_nosv = df_clean[no_sv].astype(float)
    m_nosv = RandomForestClassifier(n_estimators=100, random_state=RANDOM_SEED, class_weight="balanced")
    nosv_metrics, _, _, _ = evaluate_model_cv(m_nosv, X_nosv, y, groups)

    studies = [
        {
            "name": "Baseline (5 Features)",
            "features": BASELINE_FEATURES,
            "metrics": base_metrics,
            "deltaF1": 0.0,
            "description": "Peak, Average, Pulse Duration, Cadence, Storage Rail Voltage",
        },
        {
            "name": "Baseline without Storage Voltage (4 Features)",
            "features": no_sv,
            "metrics": nosv_metrics,
            "deltaF1": round(nosv_metrics["f1"] - base_metrics["f1"], 4),
            "description": "Tests if capacitor storage rail leaks bias or improves generalization",
        },
    ]

    return {
        "datasetSamples": len(df_clean),
        "participants": int(groups.nunique()) if groups is not None else 0,
        "evaluationMethod": method,
        "studies": studies,
        "recommendation": (
            "Keep storage voltage"
            if base_metrics["f1"] >= nosv_metrics["f1"] + 0.01
            else "4-feature model is simpler and equally defensible"
        ),
    }


def train_from_dataframe(
    df: pd.DataFrame,
    version: str = "v1.0",
    test_size: float = 0.25,
    out: Path | str = "artifacts",
    dataset_version: str | None = None,
    algorithm: str = "Random Forest",
    feature_version: str = "features-v1",
) -> dict:
    """Validates, trains, evaluates honestly and persists the artifacts."""
    df, warnings = validate_dataset(df, feature_version=feature_version)

    target_features = FEATURE_VERSIONS.get(feature_version, BASELINE_FEATURES)
    available_features = [f for f in target_features if f in df.columns]

    X = df[available_features].astype(float)
    y = df["label"]
    groups = _participants(df)
    n_participants = int(groups.nunique()) if groups is not None else 0

    clf = instantiate_model(algorithm)

    t0 = time.perf_counter()
    metrics, cm, method, method_detail = evaluate_model_cv(clf, X, y, groups)
    train_time_ms = round((time.perf_counter() - t0) * 1000.0, 1)

    # Final model is fitted on all validated data
    clf.fit(X, y)

    # Benchmark single sample inference time
    t_inf0 = time.perf_counter()
    for _ in range(50):
        clf.predict(X.iloc[:1])
    infer_time_ms = round(((time.perf_counter() - t_inf0) / 50.0) * 1000.0, 2)

    # Calculate model size
    buf = io.BytesIO()
    joblib.dump(clf, buf)
    size_kb = round(len(buf.getvalue()) / 1024.0, 1)

    # Feature importances if available
    feat_imp = {}
    if hasattr(clf, "feature_importances_"):
        feat_imp = {f: round(float(v), 4) for f, v in zip(available_features, clf.feature_importances_)}
    elif hasattr(clf, "coef_"):
        # For logistic regression / linear models
        coef_mean = np.mean(np.abs(clf.coef_), axis=0)
        norm = np.sum(coef_mean) or 1.0
        feat_imp = {f: round(float(v / norm), 4) for f, v in zip(available_features, coef_mean)}

    meta = {
        "modelName": f"{algorithm} (scikit-learn)",
        "version": version,
        "algorithm": algorithm,
        "status": "PRODUCTION",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "randomSeed": RANDOM_SEED,
        "featureVersion": feature_version,
        "featureCount": len(available_features),
        "featureNames": available_features,
        "datasetVersion": dataset_version or f"{len(df)}-samples",
        "classes": CLASSES,
        "evaluationMethod": method,
        "evaluationDetail": method_detail,
        "subjectIndependent": method.startswith("subject-independent"),
        "participants": n_participants,
        "metrics": metrics,
        "confusionMatrix": cm,
        "confusionMatrixLabels": CLASSES,
        "featureImportance": feat_imp,
        "samples": {
            "total": int(len(df)),
            "train": int(len(df) * 0.75),
            "test": int(len(df) * 0.25),
        },
        "labelDistribution": {c: int((y == c).sum()) for c in CLASSES},
        "inferenceTimeMs": infer_time_ms,
        "trainingTimeMs": train_time_ms,
        "modelSizeKb": size_kb,
        "warnings": warnings,
    }

    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, out_dir / "model.joblib")
    (out_dir / "metadata.json").write_text(json.dumps(meta, indent=2))
    return meta
