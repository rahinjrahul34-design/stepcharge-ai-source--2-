# StepCharge AI — REST & Socket.IO API Reference

Base REST URL: `http://localhost:5000/api` (or configured `PORT`)
Socket.IO URL: `http://localhost:5000`

All REST responses follow the unified envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": { "code": "STRING", "message": "STRING", "details": ... }
}
```

---

## 1. Authentication Endpoints

### `GET /api/auth/google/url`
- **Description**: Generates Google OAuth 2.0 authorization URL.
- **Auth**: Public.
- **Response**: `{ success: true, data: { url: "https://accounts.google.com/..." } }`

### `GET /api/auth/google/callback?code=...`
- **Description**: OAuth callback; exchanges authorization code, provisions user, sets HTTP-only session cookie.
- **Auth**: Public (redirects to frontend `/`).

### `POST /api/auth/google/token`
- **Description**: Client-side ID token exchange alternative.
- **Body**: `{ "idToken": "string" }`
- **Auth**: Rate-limited (10/15min).

### `GET /api/auth/me`
- **Description**: Returns authenticated user profile.
- **Auth**: Session cookie required.
- **Response**: `{ success: true, data: { user: { id, email, name, role, avatarUrl } } }`

### `POST /api/auth/logout`
- **Description**: Clears HTTP-only session cookie and creates audit log.
- **Auth**: Public / Authenticated.

---

## 2. IoT Device & Telemetry Endpoints (ESP32)

### `POST /api/devices/:deviceId/telemetry`
- **Description**: Ingests periodic telemetry packet from ESP32.
- **Headers**: `X-Device-Key: <plain_device_key>`
- **Payload**:
  ```json
  {
    "uptime": 12450,
    "storageVoltage": 3.82,
    "wifiRssi": -65,
    "footstepDetected": false,
    "firmwareVersion": "1.0.0"
  }
  ```
- **Validation**: Rejects negative uptime, voltage outside `0.0--6.5V`, RSSI outside `-100--0dBm`.
- **Side Effects**: Computes $E = \frac{1}{2} C V^2$, emits Socket.IO `telemetry:update`.

### `POST /api/devices/:deviceId/footsteps`
- **Description**: Ingests discrete footstep impact event.
- **Headers**: `X-Device-Key: <plain_device_key>`
- **Payload**:
  ```json
  {
    "peakVoltage": 4.12,
    "averageVoltage": 2.45,
    "pulseDuration": 180,
    "stepInterval": 820,
    "storageVoltage": 3.85
  }
  ```
- **Side Effects**: Queries Python ML microservice at `:8000/predict`. Computes $E_{\text{step}}$, persists footstep, emits Socket.IO `footstep:detected`.

### `GET /api/devices/:deviceId/loads`
- **Description**: Polled by ESP32 to retrieve pending load control commands.
- **Headers**: `X-Device-Key: <plain_device_key>`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "loads": [
        { "channel": 1, "name": "LED Indicator", "command": "ON" },
        { "channel": 2, "name": "5V DC Fan", "command": "OFF" }
      ]
    }
  }
  ```

### `POST /api/devices/:deviceId/load-state`
- **Description**: ESP32 confirms actual hardware GPIO state after switching MOSFETs.
- **Headers**: `X-Device-Key: <plain_device_key>`
- **Payload**:
  ```json
  {
    "channel": 1,
    "actualState": "ON"
  }
  ```
- **Side Effects**: Updates `Device.loads.actualState`, emits Socket.IO `load:stateChanged`.

---

## 3. Web Dashboard Endpoints

### `POST /api/devices/:deviceId/load-command`
- **Description**: User toggles load switch from dashboard.
- **Auth**: User / Admin session cookie.
- **Payload**: `{ "channel": 1, "command": "ON" }`
- **Notice**: Only updates `command` intent; `actualState` remains unchanged until ESP32 confirms.

### `GET /api/devices/:deviceId/history`
- **Description**: Paginated time-series telemetry for graphing.
- **Query Params**: `limit=100&since=ISO_DATE`
- **Auth**: Session cookie required.

### `GET /api/analytics/energy-summary`
- **Description**: Aggregated energy metrics (daily total stored energy, footstep counts, average yield).
- **Auth**: Session cookie required.

### `GET /api/alerts` & `PUT /api/alerts/:id/acknowledge`
- **Description**: Retrieve system warnings and acknowledge/resolve alerts.
- **Auth**: Session cookie required (Resolve requires `ADMIN`).

---

## 4. Socket.IO Real-Time Events

- `telemetry:update`: Emitted when new valid telemetry is saved.
- `footstep:detected`: Emitted when a footstep impact is processed by ML.
- `load:stateChanged`: Emitted when ESP32 confirms GPIO status.
- `alert:created`: Emitted when battery threshold or anomaly is triggered.
- `device:status`: Emitted when device transitions ONLINE / OFFLINE.

---

## 5. Machine Learning & AI Intelligence Endpoints

### `GET /api/ai/models`
- **Description**: Returns all registered machine learning models with performance metrics.
- **Auth**: Session cookie required.

### `POST /api/ai/models/promote`
- **Description**: Promotes candidate model version to active `PRODUCTION`.
- **Auth**: Admin session cookie required.
- **Body**: `{ "version": "v1.1.0" }`

### `POST /api/ai/models/rollback`
- **Description**: Reverts active production model to previous version with audit reason.
- **Auth**: Admin session cookie required.
- **Body**: `{ "targetVersion": "v1.0.0", "reason": "Justification..." }`

### `GET /api/ai/forecast/energy?deviceId=...&stepsAhead=50`
- **Description**: Temporal energy prediction based on rolling cadence.
- **Auth**: Session cookie required.

### `GET /api/ai/anomalies?deviceId=...`
- **Description**: Retrieves dual-layer rule & ML anomaly records.
- **Auth**: Session cookie required.

### `POST /api/ai/anomalies/:id/resolve`
- **Description**: Triages anomaly event status (`RESOLVED`, `ACKNOWLEDGED`, `FALSE_POSITIVE`).
- **Auth**: Session cookie required.

---

## 6. Phase 4 Research Validation & System Monitoring Endpoints

### `POST /api/experiments/compare`
- **Description**: Evaluates multi-session comparative metrics (peak voltage, pulse duration, storage delta V, energy yield).
- **Auth**: Session cookie required.
- **Body**: `{ "sessionIds": ["EXP_001", "EXP_002"] }`

### `GET /api/experiments/statistics?stepClass=...&sessionId=...`
- **Description**: Computes parametric & non-parametric statistical properties (mean, median, stdDev, variance, IQR, 95% CI) and **Kruskal-Wallis non-parametric $H$-test** across gait classes.
- **Auth**: Session cookie required.

### `GET /api/experiments/correlations?sessionId=...`
- **Description**: Constructs 5x5 Pearson linear and Spearman rank correlation matrices across kinetic variables with scientific disclaimer.
- **Auth**: Session cookie required.

### `GET /api/experiments/report?sessionId=...&deviceId=...&format=markdown|json`
- **Description**: Generates publication-ready 17-section academic research and engineering assessment report.
- **Auth**: Session cookie required.

### `GET /api/system/monitor?deviceId=...`
- **Description**: Production multi-service heartbeat monitor (MongoDB Atlas, Node Backend, Realtime Socket.IO, Python ML FastAPI, ESP32 Harvester, Google OAuth Gateway), telemetry sequence integrity audit, and end-to-end latency waterfall breakdown.
- **Auth**: Public / Authenticated.
