"""
StepCharge AI — Advanced ML Inference & Intelligence Service (Phase 3)
FastAPI + scikit-learn.

Endpoints:
    GET  /health          → Service and model status
    GET  /model           → Current production model metadata
    POST /predict         → Inference with confidence classification and provenance
    POST /train           → Train model with algorithm selection & feature versioning
    POST /compare-models  → Side-by-side benchmark of RF, Gradient Boosting, SVM, Logistic Regression
    POST /feature-study   → Feature ablation study (Baseline vs Waveform vs Electrical)
    POST /anomalies/detect→ Real anomaly detection using Isolation Forest and deterministic rules
    POST /forecast/energy → Time-series energy forecasting with regression or INSUFFICIENT_DATA guard
    POST /reload          → Reload model from disk
"""

from __future__ import annotations

import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from feature_engine import BASELINE_FEATURES, FEATURE_VERSIONS
from train_model import (
    CLASSES,
    FEATURES,
    DatasetError,
    compare_all_models,
    run_feature_study,
    train_from_dataframe,
)
from anomaly_detector import AnomalyDetector
from energy_forecaster import EnergyForecaster

# Configuration
ARTIFACT_DIR = Path(os.getenv("MODEL_ARTIFACT_PATH", os.getenv("ARTIFACT_DIR", "artifacts")))
MODEL_PATH = ARTIFACT_DIR / "model.joblib"
META_PATH = ARTIFACT_DIR / "metadata.json"

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]

app = FastAPI(title="StepCharge AI Intelligence Service", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_model = None
_meta: Optional[dict] = None
_load_error: Optional[str] = None
_anomaly_detector = AnomalyDetector()
_forecaster = EnergyForecaster()


def _load_from_disk() -> None:
    global _model, _meta, _load_error
    _model, _meta, _load_error = None, None, None
    try:
        if MODEL_PATH.exists():
            _model = joblib.load(MODEL_PATH)
    except Exception as e:
        _load_error = f"Model artifact could not be loaded: {e}"
        _model = None
    try:
        if META_PATH.exists():
            _meta = json.loads(META_PATH.read_text())
    except Exception as e:
        _load_error = f"Metadata could not be read: {e}"
        _meta = None

    if _model is not None and _meta is None:
        _load_error = "Model present but metadata.json is missing; refusing to serve."
        _model = None


_load_from_disk()

NOT_TRAINED = {
    "modelName": "MODEL NOT TRAINED",
    "evaluationMethod": None,
    "subjectIndependent": False,
    "warnings": [],
    "version": "—",
    "trainedAt": None,
    "featureCount": len(FEATURES),
    "datasetVersion": None,
    "featureVersion": "features-v1",
    "classes": CLASSES,
    "metrics": None,
    "confusionMatrix": None,
    "featureImportance": None,
    "samples": None,
    "labelDistribution": None,
    "status": "VALIDATION",
}


class StepFeatures(BaseModel):
    peakVoltage: float = Field(ge=0, le=60)
    averageVoltage: float = Field(ge=0, le=60)
    pulseDuration: float = Field(ge=0, le=60_000)
    stepInterval: float = Field(ge=0, le=3600)
    storageVoltage: float = Field(ge=0, le=60)
    current: Optional[float] = None
    power: Optional[float] = None
    energy: Optional[float] = None


class PredictRequest(BaseModel):
    features: StepFeatures
    confidenceThreshold: float = Field(default=0.65, ge=0.1, le=0.99)


class TrainRequest(BaseModel):
    csv: Optional[str] = None
    samples: Optional[list[dict[str, Any]]] = None
    version: str = "v1.0"
    algorithm: str = "Random Forest"
    featureVersion: str = "features-v1"
    testSize: float = Field(default=0.25, gt=0.05, lt=0.6)


class DatasetRequest(BaseModel):
    csv: Optional[str] = None
    samples: Optional[list[dict[str, Any]]] = None
    featureVersion: str = "features-v1"


class AnomalyDetectRequest(BaseModel):
    sample: dict[str, Any]


class ForecastRequest(BaseModel):
    historicalData: list[dict[str, Any]]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelLoaded": _model is not None,
        "version": (_meta or {}).get("version") if _meta else None,
        "algorithm": (_meta or {}).get("algorithm", "Random Forest") if _meta else None,
        "service": "stepcharge-ml",
        "artifactDir": str(ARTIFACT_DIR),
        "error": _load_error,
    }


@app.get("/model")
def get_model():
    if _model is None or _meta is None:
        return NOT_TRAINED
    return _meta


@app.post("/predict")
def predict(req: PredictRequest):
    if _model is None:
        raise HTTPException(503, detail="MODEL_NOT_CONNECTED: no trained model available.")

    active_features = (_meta or {}).get("featureNames", FEATURES)
    vals = []
    for f in active_features:
        v = getattr(req.features, f, 0.0)
        vals.append(float(v) if v is not None else 0.0)

    x = pd.DataFrame([vals], columns=active_features, dtype=float)
    proba = _model.predict_proba(x)[0]
    order = list(_model.classes_)
    probabilities = {c: float(proba[order.index(c)]) if c in order else 0.0 for c in CLASSES}
    label = max(probabilities, key=probabilities.get)
    conf = probabilities[label]

    # Confidence classification
    threshold = req.confidenceThreshold
    if conf < threshold - 0.15:
        confidence_status = "UNCERTAIN"
    elif conf < threshold:
        confidence_status = "LOW_CONFIDENCE"
    else:
        confidence_status = "CONFIDENT"

    return {
        "class": label if confidence_status != "UNCERTAIN" else "UNKNOWN",
        "predictedClass": label,
        "confidence": round(conf, 4),
        "confidenceStatus": confidence_status,
        "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
        "contributions": (_meta or {}).get("featureImportance") or {},
        "modelVersion": (_meta or {}).get("version", "rf-v1.0"),
        "featureVersion": (_meta or {}).get("featureVersion", "features-v1"),
    }


@app.post("/train")
def train(req: TrainRequest):
    if req.csv:
        df = pd.read_csv(io.StringIO(req.csv), comment="#")
    elif req.samples:
        df = pd.DataFrame(req.samples)
    else:
        raise HTTPException(400, detail="Provide either `csv` text or `samples`.")

    try:
        meta = train_from_dataframe(
            df,
            version=req.version,
            test_size=req.testSize,
            out=ARTIFACT_DIR,
            algorithm=req.algorithm,
            feature_version=req.featureVersion,
        )
        # Update anomaly detector baseline with newly validated training dataset
        _anomaly_detector.fit(df)
    except DatasetError as e:
        raise HTTPException(422, detail=f"DATASET_REJECTED: {e}") from e
    except Exception as e:
        raise HTTPException(500, detail=f"TRAINING_FAILED: {e}") from e

    _load_from_disk()
    return {"trained": True, "trainedAt": datetime.now(timezone.utc).isoformat(), "metadata": meta}


@app.post("/compare-models")
def compare_models(req: DatasetRequest):
    if req.csv:
        df = pd.read_csv(io.StringIO(req.csv), comment="#")
    elif req.samples:
        df = pd.DataFrame(req.samples)
    else:
        raise HTTPException(400, detail="Provide either `csv` text or `samples`.")

    try:
        comparison = compare_all_models(df, feature_version=req.featureVersion)
        return {"success": True, "data": comparison}
    except DatasetError as e:
        raise HTTPException(422, detail=f"DATASET_REJECTED: {e}") from e
    except Exception as e:
        raise HTTPException(500, detail=f"COMPARISON_FAILED: {e}") from e


@app.post("/feature-study")
def feature_study_endpoint(req: DatasetRequest):
    if req.csv:
        df = pd.read_csv(io.StringIO(req.csv), comment="#")
    elif req.samples:
        df = pd.DataFrame(req.samples)
    else:
        raise HTTPException(400, detail="Provide either `csv` text or `samples`.")

    try:
        study = run_feature_study(df)
        return {"success": True, "data": study}
    except DatasetError as e:
        raise HTTPException(422, detail=f"DATASET_REJECTED: {e}") from e
    except Exception as e:
        raise HTTPException(500, detail=f"STUDY_FAILED: {e}") from e


@app.post("/anomalies/detect")
def detect_anomaly(req: AnomalyDetectRequest):
    res = _anomaly_detector.detect_sample(req.sample)
    return {"success": True, "data": res}


@app.post("/forecast/energy")
def forecast_energy(req: ForecastRequest):
    res = _forecaster.fit_and_evaluate(req.historicalData)
    return {"success": True, "data": res}


@app.post("/reload")
def reload_model():
    _load_from_disk()
    return {"reloaded": True, "modelLoaded": _model is not None, "error": _load_error}
