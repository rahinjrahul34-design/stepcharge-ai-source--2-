"""
Feature ablation study — does `storageVoltage` actually help classification?

STEP 15 of the project review asks whether the 5th feature earns its place.
This script answers it with evidence instead of intuition: it trains the same
RandomForest with and without storageVoltage, using the SAME evaluation
protocol the main trainer uses (subject-independent where participants exist),
and prints both score sets side by side.

Usage:
    python feature_study.py --csv ../stepcharge-dataset.csv

Interpretation guidance:
  * If the 4-feature model matches or beats the 5-feature one, storageVoltage
    is not contributing and can be dropped (simpler model, easier to defend).
  * If the 5-feature model is clearly better, keep it and report the gain.
  * With a small dataset, differences under ~2 points are usually noise — say
    so rather than claiming an improvement.

This script does NOT modify the shipped model. It is a reporting tool.
"""

from __future__ import annotations

import argparse
import json

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedGroupKFold, train_test_split

from train_model import CLASSES, FEATURES, RANDOM_SEED, _participants, validate_dataset

WITHOUT = [f for f in FEATURES if f != "storageVoltage"]


def evaluate(df: pd.DataFrame, feats: list[str]) -> tuple[dict, str]:
    X, y = df[feats].astype(float), df["label"]
    groups = _participants(df)

    if groups is not None and groups.nunique() >= 2:
        n_splits = min(5, int(groups.nunique()))
        cv = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_SEED)
        yt, yp = [], []
        for tr, te in cv.split(X, y, groups=groups):
            m = RandomForestClassifier(n_estimators=300, random_state=RANDOM_SEED, class_weight="balanced")
            m.fit(X.iloc[tr], y.iloc[tr])
            yt.extend(y.iloc[te].tolist())
            yp.extend(m.predict(X.iloc[te]).tolist())
        method = f"subject-independent group {n_splits}-fold"
    else:
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=0.25, stratify=y, random_state=RANDOM_SEED
        )
        m = RandomForestClassifier(n_estimators=300, random_state=RANDOM_SEED, class_weight="balanced")
        m.fit(Xtr, ytr)
        yt, yp = yte.tolist(), m.predict(Xte).tolist()
        method = "random split (subject-dependent)"

    return {
        "accuracy": float(accuracy_score(yt, yp)),
        "precision": float(precision_score(yt, yp, average="macro", zero_division=0)),
        "recall": float(recall_score(yt, yp, average="macro", zero_division=0)),
        "f1": float(f1_score(yt, yp, average="macro", zero_division=0)),
    }, method


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    args = ap.parse_args()

    df, warnings = validate_dataset(pd.read_csv(args.csv, comment="#"))
    for w in warnings:
        print(f"WARNING: {w}")

    a, method = evaluate(df, FEATURES)
    b, _ = evaluate(df, WITHOUT)

    print(f"\nSamples   : {len(df)}")
    print(f"Evaluation: {method}\n")
    print(f"{'metric':<12}{'5 features':>14}{'4 features':>14}{'delta':>10}")
    print("-" * 50)
    for k in ("accuracy", "precision", "recall", "f1"):
        d = a[k] - b[k]
        print(f"{k:<12}{a[k]:>14.4f}{b[k]:>14.4f}{d:>+10.4f}")

    delta = a["f1"] - b["f1"]
    print()
    if abs(delta) < 0.02:
        print("VERDICT: no meaningful difference (|ΔF1| < 0.02). storageVoltage is not")
        print("         earning its place; the simpler 4-feature model is equally defensible.")
    elif delta > 0:
        print(f"VERDICT: storageVoltage helps (+{delta:.4f} F1). Keep all 5 features.")
    else:
        print(f"VERDICT: storageVoltage HURTS ({delta:.4f} F1). Consider dropping it.")

    # A model that leans on storageVoltage is suspicious: capacitor charge is a
    # property of the system's state, not of how hard someone stepped.
    m = RandomForestClassifier(n_estimators=300, random_state=RANDOM_SEED, class_weight="balanced")
    m.fit(df[FEATURES].astype(float), df["label"])
    imp = dict(zip(FEATURES, (float(v) for v in m.feature_importances_)))
    print("\nFeature importance (full model):")
    for k, v in sorted(imp.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<18}{v:.4f}")
    print(json.dumps({"fiveFeature": a, "fourFeature": b, "method": method}, indent=2))


if __name__ == "__main__":
    main()
