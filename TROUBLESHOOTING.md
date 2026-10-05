# StepCharge AI — Diagnostic & Troubleshooting Guide

## 1. Quick Diagnosis Matrix

| Symptom | Probable Cause | Diagnostic Command / Check | Resolution |
|---|---|---|---|
| **ESP32 Telemetry Fails (401 / 403)** | Invalid or revoked `X-Device-Key` | Check backend logs for `DEVICE_AUTH_FAILED` | Re-generate device key in Admin Settings and update `DEVICE_KEY` in firmware |
| **ESP32 Shows Disconnected** | Wi-Fi credential error or IP mismatch | Serial monitor at 115200 baud | Verify SSID, Wi-Fi password, and backend IP address |
| **"MongoDB Connection Failed"** | Incorrect URI or IP access list | Check `MONGODB_URI` in `backend/.env` | Whitelist deployment IP in MongoDB Atlas Network Access |
| **Google Sign-In Returns 400** | Missing Client ID or redirect mismatch | Inspect `GOOGLE_CLIENT_ID` in `backend/.env` | Verify authorized redirect URIs in Google Cloud Console |
| **ML Predictions Offline / Fallback** | FastAPI service not running on port 8000 | `curl http://localhost:8000/health` | Start `uvicorn app:app --port 8000` in `ml-service` |
| **Supercapacitor Voltage Not Rising** | Schottky bridge reversed or piezo disconnected | Check multimeter voltage across capacitor terminals | Check bridge polarity; verify ceramic disc soldering |
| **"INSUFFICIENT HISTORICAL DATA" on Forecast** | Less than 20 footsteps in database | Check `Footstep.countDocuments()` | Record at least 20 footsteps in Experiment or Live mode |

---

## 2. Service Verification Commands

### Check Backend Health
```bash
curl http://localhost:5000/api/system/health
```

### Check Multi-Service Health & Latency Monitor
```bash
curl http://localhost:5000/api/system/monitor?deviceId=ESP32-01
```

### Check Python ML Service
```bash
curl http://localhost:8000/health
```

### Run Full Backend Test Suite
```bash
cd backend
npx vitest run
```
All 86 tests should pass with code 0.
