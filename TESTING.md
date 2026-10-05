# StepCharge AI — Verification & Testing Guide

This document details the test suites, verification procedures, and automated quality gates across StepCharge AI.

---

## 1. Automated Test Execution

### 1.1 Backend Unit & Integration Tests (Vitest)

The backend includes comprehensive test coverage for physics formulas, data modeling, middleware, Google OAuth, and REST APIs:

```bash
cd backend
npm test
```

#### Test Suite Breakdown (86 Passing Vitest Tests across 6 Files):
1. **Physical Formula & Validation Unit Tests (`backend/src/__tests__/backend.test.ts`) [11 tests]**:
   - Supercapacitor energy calculation: $E = \frac{1}{2} C V^2$.
   - Footstep pulse energy calculation: $E_{\text{step}} = \frac{V_{\text{avg}}^2}{R_{\text{eq}}} \cdot \frac{t}{1000}$.
   - Zod schema validation: rejects negative voltage, negative uptime, and excessive RSSI.
   - Device key hashing: ensures SHA-256 hash match and uniqueness.
   - ML resilience fallback: handles offline ML service gracefully with `classification: null`.

2. **REST API Integration Tests (`backend/src/__tests__/api.test.ts`) [7 tests]**:
   - `GET /api/system/health`: returns 200 OK and database connectivity status.
   - `GET /api/devices`: rejects unauthenticated requests with 401 Unauthorized.
   - `POST /api/auth/google/token`: rejects missing or malformed tokens with 400 Bad Request.
   - `POST /api/devices/ESP32-01/telemetry`: rejects requests without `X-Device-Key` with 401.
   - `POST /api/devices/ESP32-01/load-command`: rejects unauthorized access with 401.

3. **Phase 1 Security Hardening Test Suite (`backend/src/__tests__/security.test.ts`) [33 tests]**:
   - Device ownership isolation (User A cannot access User B's device, telemetry, history, alerts, or datasets).
   - Role-Based Access Control (`ADMIN` vs `USER`).
   - Rate limiting, NoSQL injection resistance, CORS origins, and revoked device rejection.

4. **Phase 2 Measurement & Calibration Test Suite (`backend/src/__tests__/phase2_measurement.test.ts`) [17 tests]**:
   - Two-point voltage calibration scaling & offset application.
   - Current sensor shunt detection and strict `MEASURED` vs `ESTIMATED` energy tagging.
   - Remote ESP32 hardware configuration versioning and update broadcasts.
   - Dynamic threshold and refractory period physical validation.

5. **Phase 3 AI Intelligence & Model Governance Suite (`backend/src/__tests__/phase3_ai_intelligence.test.ts`) [12 tests]**:
   - Data Quality Gate verification (minimum 30 samples, 3 participants, 60% class balance).
   - Model Registry promotions, rollbacks, and archiving with audit logs.
   - Dual-layer rule-based and Isolation Forest anomaly detection and triage.
   - Energy forecasting fallback validation.

6. **Phase 4 Research Validation & System Reliability Suite (`backend/src/__tests__/phase4_research_validation.test.ts`) [6 tests]**:
   - Statistical analysis computing mean, median, stdDev, variance, IQR, and 95% CI.
   - Kruskal-Wallis non-parametric hypothesis $H$-test across gait classes.
   - 5x5 Pearson linear and Spearman rank correlation matrices with scientific disclaimer.
   - Multi-session experiment comparison engine.
   - Full 17-section academic research report generator.
   - Multi-service health monitor and latency breakdown.

### 1.2 Python ML Microservice Tests (pytest)
```bash
cd ml-service
pytest
```
- 8 tests passing verifying Random Forest classification, feature extraction, health check, model metadata, and model comparison.

### 1.3 Frontend Linting & Build Verification

The frontend TypeScript code is verified using strict type checks and the Oxlint engine:

```bash
# Check code style and rules (0 errors across 128 files)
npm run lint

# Compile and bundle
npm run build
```

---

## 2. Hardware Simulation & Manual Testing

### 2.1 Testing Device Ingestion via cURL

You can simulate an ESP32 sending real-time telemetry:

```bash
curl -X POST http://localhost:5000/api/devices/ESP32-01/telemetry \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: YOUR_DEVICE_API_KEY" \
  -d '{
    "uptime": 3600,
    "storageVoltage": 3.75,
    "wifiRssi": -58,
    "footstepDetected": false,
    "firmwareVersion": "1.0.0"
  }'
```

### 2.2 Testing Footstep Event Ingestion

```bash
curl -X POST http://localhost:5000/api/devices/ESP32-01/footsteps \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: YOUR_DEVICE_API_KEY" \
  -d '{
    "peakVoltage": 3.42,
    "averageVoltage": 2.15,
    "pulseDuration": 160,
    "stepInterval": 750,
    "storageVoltage": 3.78
  }'
```
