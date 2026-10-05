"""
Train the StepCharge AI footstep classifier from LOCALLY COLLECTED data.

Input CSV (exported from the dashboard: AI Model → Dataset → Export CSV):

    timestamp,deviceId,participantId,peakVoltage,averageVoltage,
    pulseDuration,stepInterval,storageVoltage,label,source

`participantId` is optional but strongly recommended — see "Evaluation" below.

Output (artifacts/):
    model.joblib   — fitted RandomForest
    metadata.json  — REAL metrics in the exact shape the dashboard renders

------------------------------------------------------------------------------
Evaluation (this is the academically important part)
------------------------------------------------------------------------------
A plain random train/test split leaks gait identity: the same person's footsteps
land in BOTH train and test, so the model can recognise the person rather than
the step intensity, and accuracy comes out optimistically high.

So this script prefers SUBJECT-INDEPENDENT evaluation:

  * ≥2 participants  → StratifiedGroupKFold grouped by participantId, i.e. no
                       participant appears in both train and test.
                       method = "subject-independent-group-kfold"
  * <2 participants  → falls back to a stratified random split and records
                       method = "random-split-subject-dependent" plus an explicit
                       warning. The dashboard surfaces that warning verbatim.

Never present a subject-dependent score as if it were subject-independent.

CLI:
    python train_model.py --csv ../stepcharge-dataset.csv --version v1.0
The same function backs the FastAPI POST /train endpoint.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedGroupKFold, train_test_split

FEATURES = ["peakVoltage", "averageVoltage", "pulseDuration", "stepInterval", "storageVoltage"]
CLASSES = ["LIGHT", "NORMAL", "HEAVY"]
RANDOM_SEED = 42

# Hard floor to train at all; academic guidance is far higher (see below).
MIN_SAMPLES = 30
MIN_PER_CLASS = 5
# What a defensible final-year dataset should look like.
RECOMMENDED_PER_CLASS = 100
PREFERRED_PER_CLASS = 150
RECOMMENDED_PARTICIPANTS = 5

# Physically plausible ranges — anything outside is a measurement fault.
VALID_RANGES = {
    "peakVoltage": (0.0, 60.0),
    "averageVoltage": (0.0, 60.0),
    "pulseDuration": (1.0, 60_000.0),
    "stepInterval": (0.0, 3_600.0),
    "storageVoltage": (0.0, 60.0),
}


class DatasetError(ValueError):
    """Raised when the dataset cannot support honest training."""


def validate_dataset(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Cleans and validates. Returns (clean_df, warnings).
    Raises DatasetError when the data cannot be trained on at all.
    """
    warnings: list[str] = []

    missing = [c for c in FEATURES + ["label"] if c not in df.columns]
    if missing:
        raise DatasetError(f"CSV is missing required columns: {missing}")

    n0 = len(df)
    df = df.copy()

    # Duplicate sample IDs usually mean a double export or a merge mistake.
    if "id" in df.columns:
        dup = int(df["id"].duplicated().sum())
        if dup:
            df = df.drop_duplicates(subset="id", keep="first")
            warnings.append(f"Dropped {dup} row(s) with duplicate sample id.")

    for col in FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    bad_rows = df[FEATURES].isna().any(axis=1) | df["label"].isna()
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

    # A mean above the peak is physically impossible for the same pulse.
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
            f"Target ≥{RECOMMENDED_PER_CLASS} (preferably {PREFERRED_PER_CLASS}) samples per class."
        )

    return df, warnings


def _participants(df: pd.DataFrame) -> pd.Series | None:
    if "participantId" not in df.columns:
        return None
    g = df["participantId"].astype(str).str.strip()
    g = g.replace({"": np.nan, "nan": np.nan, "None": np.nan})
    return None if g.isna().all() else g.fillna("unknown")


def train_from_dataframe(
    df: pd.DataFrame,
    version: str = "v1.0",
    test_size: float = 0.25,
    out: Path | str = "artifacts",
    dataset_version: str | None = None,
) -> dict:
    """Validates, trains, evaluates honestly and persists the artifacts."""
    df, warnings = validate_dataset(df)

    X, y = df[FEATURES].astype(float), df["label"]
    groups = _participants(df)
    n_participants = int(groups.nunique()) if groups is not None else 0

    clf = RandomForestClassifier(
        n_estimators=300, random_state=RANDOM_SEED, class_weight="balanced"
    )

    # ---- choose an evaluation protocol we can defend ----
    if groups is not None and n_participants >= 2:
        n_splits = min(5, n_participants)
        try:
            cv = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_SEED)
            y_true_all, y_pred_all = [], []
            for tr, te in cv.split(X, y, groups=groups):
                fold = RandomForestClassifier(
                    n_estimators=300, random_state=RANDOM_SEED, class_weight="balanced"
                )
                fold.fit(X.iloc[tr], y.iloc[tr])
                y_true_all.extend(y.iloc[te].tolist())
                y_pred_all.extend(fold.predict(X.iloc[te]).tolist())
            y_test, pred = pd.Series(y_true_all), np.array(y_pred_all)
            method = "subject-independent-group-kfold"
            method_detail = (
                f"StratifiedGroupKFold with {n_splits} folds grouped by participantId "
                f"({n_participants} participants). No participant appears in both train and test."
            )
            n_train, n_test = len(df) - len(y_test) // n_splits, len(y_test)
            n_train = int(len(df) * (1 - 1 / n_splits))
        except ValueError as e:
            raise DatasetError(
                f"Subject-independent split failed ({e}). Collect more samples per participant, "
                "or remove participantId to fall back to a random split."
            ) from e
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, stratify=y, random_state=RANDOM_SEED
        )
        clf.fit(X_train, y_train)
        pred = clf.predict(X_test)
        method = "random-split-subject-dependent"
        method_detail = (
            f"Stratified random {int((1 - test_size) * 100)}/{int(test_size * 100)} split. "
            "Subject-independent validation unavailable due to insufficient participant data."
        )
        warnings.append(
            "Subject-independent validation unavailable: fewer than 2 participants are labelled. "
            "These metrics may be optimistic because the same person's gait can appear in both "
            f"train and test. Collect data from ≥{RECOMMENDED_PARTICIPANTS} participants with "
            "participantId set."
        )
        n_train, n_test = len(X_train), len(X_test)

    metrics = {
        "accuracy": float(accuracy_score(y_test, pred)),
        "precision": float(precision_score(y_test, pred, average="macro", zero_division=0)),
        "recall": float(recall_score(y_test, pred, average="macro", zero_division=0)),
        "f1": float(f1_score(y_test, pred, average="macro", zero_division=0)),
    }

    # Final model is always fitted on ALL validated data; metrics above describe
    # generalisation, this is the artifact we actually ship.
    clf.fit(X, y)

    meta = {
        "modelName": "Random Forest (scikit-learn)",
        "version": version,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "randomSeed": RANDOM_SEED,
        "hyperparameters": {
            "n_estimators": 300,
            "class_weight": "balanced",
            "random_state": RANDOM_SEED,
        },
        "featureCount": len(FEATURES),
        "featureNames": FEATURES,
        "datasetVersion": dataset_version or f"{len(df)}-samples",
        "classes": CLASSES,
        "evaluationMethod": method,
        "evaluationDetail": method_detail,
        "subjectIndependent": method.startswith("subject-independent"),
        "participants": n_participants,
        "metrics": metrics,
        "confusionMatrix": confusion_matrix(y_test, pred, labels=CLASSES).tolist(),
        "confusionMatrixLabels": CLASSES,
        "featureImportance": {f: float(v) for f, v in zip(FEATURES, clf.feature_importances_)},
        "samples": {"total": int(len(df)), "train": int(n_train), "test": int(n_test)},
        "labelDistribution": {c: int((y == c).sum()) for c in CLASSES},
        "warnings": warnings,
    }

    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, out_dir / "model.joblib")
    (out_dir / "metadata.json").write_text(json.dumps(meta, indent=2))
    return meta


def main() -> None:
    ap = argparse.ArgumentParser(description="Train the StepCharge footstep classifier.")
    ap.add_argument("--csv", required=True, help="dataset exported from the dashboard")
    ap.add_argument("--version", default="v1.0")
    ap.add_argument("--test-size", type=float, default=0.25)
    ap.add_argument("--out", default="artifacts")
    args = ap.parse_args()

    df = pd.read_csv(args.csv, comment="#")
    try:
        meta = train_from_dataframe(
            df,
            version=args.version,
            test_size=args.test_size,
            out=args.out,
            dataset_version=Path(args.csv).stem,
        )
    except DatasetError as e:
        raise SystemExit(f"Dataset rejected: {e}")

    print(f"Evaluation : {meta['evaluationMethod']}")
    print(f"             {meta['evaluationDetail']}")
    print(json.dumps(meta["metrics"], indent=2))
    for w in meta["warnings"]:
        print(f"WARNING    : {w}")
    print(f"Saved      → {Path(args.out) / 'model.joblib'} and {Path(args.out) / 'metadata.json'}")


if __name__ == "__main__":
    main()
