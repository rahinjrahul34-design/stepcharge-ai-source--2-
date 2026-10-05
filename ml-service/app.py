"""
StepCharge AI — ML inference service (FastAPI + scikit-learn).

Endpoints consumed by the dashboard (src/services/ml/mlService.ts):

    GET  /health   → {status, modelLoaded, version}
    GET  /model    → metadata: real metrics, confusion matrix, feature importance
    POST /predict  → {class, confidence, probabilities, contributions, modelVersion}
    POST /train    → trains from an uploaded/collected dataset, returns real metrics
    POST /reload   → re-reads model.joblib from disk without restarting

Academic honesty rules enforced in code:
  * No model on disk  → /model reports MODEL NOT TRAINED with metrics = null,
    and /predict returns HTTP 503 (never a fabricated label).
  * All metrics come from a held-out test split computed at training time.

Run:  uvicorn app:app --reload --port 8000
Then: VITE_ML_API_URL=http://localhost:8000 in the dashboard's .env.local
"""

from __future__ import annotations

import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from train_model import CLASSES, FEATURES, DatasetError, train_from_dataframe

# --- configuration (see ml-service/.env.example) ---------------------------
ARTIFACT_DIR = Path(os.getenv("MODEL_ARTIFACT_PATH", os.getenv("ARTIFACT_DIR", "artifacts")))
DATASET_PATH = Path(os.getenv("DATASET_PATH", "../stepcharge-dataset.csv"))
MODEL_PATH = ARTIFACT_DIR / "model.joblib"
META_PATH = ARTIFACT_DIR / "metadata.json"

# CORS is restrictive by default: only local dev origins. Production deployments
# MUST set ALLOWED_ORIGINS to the real dashboard origin. "*" is never implied.
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]

app = FastAPI(title="StepCharge AI ML Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_model = None
_meta: Optional[dict] = None


_load_error: Optional[str] = None


def _load_from_disk() -> None:
    """
    Loads model + metadata if present. Absence is a valid state, and a CORRUPT
    artifact must never crash the service — it degrades to "no model".
    """
    global _model, _meta, _load_error
    _model, _meta, _load_error = None, None, None
    try:
        if MODEL_PATH.exists():
            _model = joblib.load(MODEL_PATH)
    except Exception as e:  # noqa: BLE001 — any unpickling failure is non-fatal
        _load_error = f"Model artifact could not be loaded: {e}"
        _model = None
    try:
        if META_PATH.exists():
            _meta = json.loads(META_PATH.read_text())
    except (OSError, json.JSONDecodeError) as e:
        _load_error = f"Metadata could not be read: {e}"
        _meta = None
    # A model without metadata cannot be described honestly, so refuse to use it.
    if _model is not None and _meta is None:
        _load_error = _load_error or "Model present but metadata.json is missing; refusing to serve it."
        _model = None


_load_from_disk()

NOT_TRAINED = {
    "modelName": "MODEL NOT TRAINED",
    "evaluationMethod": None,
    "subjectIndependent": False,
    "warnings": [],
    "version": "-",
    "trainedAt": None,
    "featureCount": len(FEATURES),
    "datasetVersion": None,
    "classes": CLASSES,
    "metrics": None,
    "confusionMatrix": None,
    "featureImportance": None,
    "samples": None,
    "labelDistribution": None,
}


class Features(BaseModel):
    peakVoltage: float = Field(ge=0, le=60)
    averageVoltage: float = Field(ge=0, le=60)
    pulseDuration: float = Field(ge=0, le=60_000)
    stepInterval: float = Field(ge=0, le=3600)
    storageVoltage: float = Field(ge=0, le=60)


class PredictRequest(BaseModel):
    features: Features


class TrainRequest(BaseModel):
    """Either raw CSV text (as exported by the dashboard) or inline samples."""
    csv: Optional[str] = None
    samples: Optional[list[dict]] = None
    version: str = "v1.0"
    testSize: float = Field(default=0.25, gt=0.05, lt=0.6)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelLoaded": _model is not None,
        "version": (_meta or {}).get("version") if _meta else None,
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
        # Explicit failure: the dashboard renders MODEL_NOT_CONNECTED.
        raise HTTPException(503, detail="MODEL_NOT_CONNECTED: no trained model available.")

    # DataFrame (not bare ndarray) so sklearn sees the same feature names it was fitted with.
    x = pd.DataFrame([[getattr(req.features, f) for f in FEATURES]], columns=FEATURES, dtype=float)
    proba = _model.predict_proba(x)[0]
    order = list(_model.classes_)
    probabilities = {c: float(proba[order.index(c)]) if c in order else 0.0 for c in CLASSES}
    label = max(probabilities, key=probabilities.get)
    return {
        "class": label,
        "confidence": probabilities[label],
        "probabilities": probabilities,
        "contributions": (_meta or {}).get("featureImportance") or {},
        "modelVersion": (_meta or {}).get("version", "unknown"),
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
        meta = train_from_dataframe(df, version=req.version, test_size=req.testSize, out=ARTIFACT_DIR)
    except DatasetError as e:
        raise HTTPException(422, detail=f"DATASET_REJECTED: {e}") from e
    except ValueError as e:
        raise HTTPException(422, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001 — surface training faults as 500, never crash
        raise HTTPException(500, detail=f"TRAINING_FAILED: {e}") from e

    _load_from_disk()
    return {"trained": True, "trainedAt": datetime.now(timezone.utc).isoformat(), "metadata": meta}


@app.post("/reload")
def reload_model():
    _load_from_disk()
    return {"reloaded": True, "modelLoaded": _model is not None, "error": _load_error}
