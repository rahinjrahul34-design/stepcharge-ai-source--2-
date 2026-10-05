# StepCharge AI — Authorization Matrix

**Project:** StepCharge AI — Smart Footstep Energy Harvesting and Monitoring System  
**Phase:** 1 — Security, Authorization, Data Integrity & Production Hardening  
**Version:** 1.0.0  
**Last Updated:** October 2026  

---

## 1. Executive Summary

This document defines the comprehensive **Role-Based and Resource-Ownership Access Control Matrix** for the StepCharge AI platform.

### Core Security Tenets
1. **Authentication $\neq$ Authorization:** Every request must establish identity *and* verify permission to access the specific target resource.
2. **Least Privilege:** Normal users (`USER`) can only inspect, control, and receive data from devices they explicitly own.
3. **No Unauthenticated Access to Private Telemetry:** All telemetry, history, alerts, analytics, and device commands require verified sessions.
4. **Device Isolation:** ESP32 hardware devices authenticate using high-entropy API key credentials (`X-Device-Key`) verified via SHA-256 hashes against MongoDB records.
5. **No Global Broadcasts:** Private telemetry, footsteps, load states, and alerts are strictly scoped to authenticated Socket.IO rooms (`device:<deviceId>`).

---

## 2. Roles & Callers

| Identifier | Description | Authentication Mechanism |
|---|---|---|
| **PUBLIC** | Unauthenticated web visitor or client | None |
| **USER** | Authenticated platform user | Google OAuth 2.0 $\to$ HttpOnly Session Cookie (`stepcharge_session`) |
| **ADMIN** | System administrator with global operational authority | Verified Google OAuth 2.0 user matching `ADMIN_EMAILS` whitelist |
| **DEVICE** | Physical ESP32 micro-controller or verified hardware gateway | Header `X-Device-Key` verified against SHA-256 hash in MongoDB |

---

## 3. Comprehensive REST API Authorization Matrix

### 3.1 Authentication Routes (`/api/auth`)

| Endpoint | HTTP Method | Allowed Callers | Ownership / Scope Rules | Failure Code | Notes |
|---|---|---|---|---|---|
| `/api/auth/google/url` | `GET` | PUBLIC, USER, ADMIN | None | N/A | Generates Google OAuth redirect URL + sets cryptographic 32-byte CSRF cookie `stepcharge_oauth_state` (HttpOnly). |
| `/api/auth/google/callback` | `POST` | PUBLIC | Validates query/body `state` matches `stepcharge_oauth_state` cookie | `400 Bad Request` | Exchanges code for tokens, verifies Google ID, provisions/locates User in MongoDB, issues session cookie. |
| `/api/auth/me` | `GET` | USER, ADMIN | Current session owner | `401 Unauthorized` | Returns authenticated user profile (`id`, `email`, `name`, `role`, `avatarUrl`). |
| `/api/auth/logout` | `POST` | USER, ADMIN | Current session owner | `401 Unauthorized` | Clears HttpOnly session cookie and invalidates client session. |

---

### 3.2 Device Management Routes (`/api/devices`)

| Endpoint | HTTP Method | Allowed Callers | Ownership / Scope Rules | Failure Code | Notes |
|---|---|---|---|---|---|
| `/api/devices` | `POST` | ADMIN | Explicit Admin Only | `401 / 403` | Creates new device with secure high-entropy API key (`sc_live_...`). In production, unknown devices cannot auto-provision. |
| `/api/devices` | `GET` | USER, ADMIN | Scoped: USER sees only owned devices (`ownerId === userId`). ADMIN sees all. | `401 Unauthorized` | Queries filtered at database query layer. Prevents device enumeration across users. |
| `/api/devices/:deviceId` | `GET` | USER, ADMIN | User must own device OR caller is ADMIN | `401 / 403 / 404` | Protected by `requireDeviceAccess` middleware. |
| `/api/devices/:deviceId/rotate-key` | `POST` | USER, ADMIN | User must own device OR caller is ADMIN | `401 / 403 / 404` | Protected by `requireDeviceAccess`. Generates new API key, computes SHA-256 hash, returns plaintext once. |
| `/api/devices/:deviceId/piezo` | `POST` | USER, ADMIN | User must own device OR caller is ADMIN | `401 / 403 / 404` | Protected by `requireDeviceAccess`. Triggers calibration / piezo diagnostic test. |
| `/api/devices/:deviceId/load-command` | `POST` | USER, ADMIN | User must own device OR caller is ADMIN | `401 / 403 / 404` | Protected by `requireDeviceAccess`. Validates `loadId` (`LOAD_1`, `LOAD_2`) and `state` (`ON`, `OFF`). Logs load command. |
| `/api/devices/:deviceId/loads` | `GET` | DEVICE, USER, ADMIN | ESP32 matches device key OR User owns device OR caller is ADMIN | `401 / 403` | Protected by `requireDeviceOrOwnerAuth`. Used by ESP32 polling loop and web dashboard to synchronize switch states. |

---

### 3.3 Telemetry Ingestion & Retrieval (`/api/telemetry`)

| Endpoint | HTTP Method | Allowed Callers | Ownership / Scope Rules | Failure Code | Notes |
|---|---|---|---|---|---|
| `/api/telemetry` | `POST` | DEVICE | Device must exist in DB; key must match SHA-256 hash | `401 / 403` | Rejects unregistered devices (`DEVICE_NOT_REGISTERED`) when `DEVICE_AUTO_PROVISION=false`. Validates voltage bounds ($0-60\text{V}$), finite numbers. Broadcasts strictly to room `device:<deviceId>`. |
| `/api/telemetry/latest` | `GET` | USER, ADMIN | Query param `deviceId` required; user must own device OR caller is ADMIN | `400 / 401 / 403 / 404` | Protected by `requireAuth` + `requireDeviceAccess`. Returns latest recorded telemetry document. |

---

### 3.4 Historical Data Routes (`/api/history`)

| Endpoint | HTTP Method | Allowed Callers | Ownership / Scope Rules | Failure Code | Notes |
|---|---|---|---|---|---|
| `/api/history/telemetry` | `GET` | USER, ADMIN | If `deviceId` provided, user must own it or be ADMIN. If omitted, auto-scoped to owned devices. | `401 / 403` | Supports pagination (`limit`) and timeframe filters (`1h`, `24h`, `7d`, `30d`). Rejects unauthorized device queries. |
| `/api/history/footsteps` | `GET` | USER, ADMIN | If `deviceId` provided, user must own it or be ADMIN. If omitted, auto-scoped to owned devices. | `401 / 403` | Scoped historical footstep log with peak voltage, energy, duration. |
| `/api/history/energy` | `GET` | USER, ADMIN | If `deviceId` provided, user must own it or be ADMIN. If omitted, auto-scoped to owned devices. | `401 / 403` | Returns energy aggregation records (hourly / daily totals). |

---

### 3.5 Analytics Routes (`/api/analytics`)

| Endpoint | HTTP Method | Allowed Callers | Ownership / Scope Rules | Failure Code | Notes |
|---|---|---|---|---|---|
| `/api/analytics/stats` | `GET` | USER, ADMIN | Query param `deviceId` required; user must own device OR caller is ADMIN | `400 / 401 / 403 / 404` | Protected by `requireAuth` + `requireDeviceAccess`. Aggregates lifetime steps, total energy ($J$), peak power, storage voltage. |
| `/api/analytics/trends` | `GET` | USER, ADMIN | Query param `deviceId` required; user must own device OR caller is ADMIN | `400 / 401 / 403 / 404` | Protected by `requireAuth` + `requireDeviceAccess`. Aggregates energy trends by time interval (`hour`, `day`, `week`). |

---

### 3.6 Alerts & Notifications Routes (`/api/alerts`)

| Endpoint | HTTP Method | Allowed Callers | Ownership / Scope Rules | Failure Code | Notes |
|---|---|---|---|---|---|
| `/api/alerts` | `GET` | USER, ADMIN | Scoped: USER sees alerts for owned devices only. ADMIN sees all. | `401 Unauthorized` | Protected by `requireAuth`. Supports filter by `severity`, `resolved` status. |
| `/api/alerts/:id/resolve` | `PATCH` | USER, ADMIN | User must own device associated with alert OR caller is ADMIN | `401 / 403 / 404` | Verifies alert exists and caller owns the parent device before setting `resolved: true`. |

---

### 3.7 Machine Learning Dataset Routes (`/api/dataset`)

| Endpoint | HTTP Method | Allowed Callers | Ownership / Scope Rules | Failure Code | Notes |
|---|---|---|---|---|---|
| `/api/dataset/samples` | `POST` | USER, ADMIN | If `deviceId` specified, user must own it. Attaches `createdBy: userId`. | `401 / 403` | Protected by `requireAuth` + rate limiter. Stores raw footstep waveform features for model training. |
| `/api/dataset/samples` | `GET` | USER, ADMIN | Any authenticated user | `401 Unauthorized` | Protected by `requireAuth`. Retrieves list of labeled samples for model evaluation. |
| `/api/dataset/export` | `GET` | USER, ADMIN | Any authenticated user | `401 Unauthorized` | Protected by `requireAuth`. Exports dataset as formatted JSON. |
| `/api/dataset/samples/:id` | `DELETE` | USER, ADMIN | User must be sample creator (`createdBy === userId`) OR caller is ADMIN | `401 / 403 / 404` | Prevents unauthorized deletion of dataset samples collected by other users. |

---

### 3.8 Machine Learning Inference & Control (`/api/ml`)

| Endpoint | HTTP Method | Allowed Callers | Ownership / Scope Rules | Failure Code | Notes |
|---|---|---|---|---|---|
| `/api/ml/predict` | `POST` | USER, ADMIN | Any authenticated user | `400 / 401 / 429 / 503` | Validates strict physical bounds ($0 \le V \le 60\text{V}$, positive steps, finite numbers). Rate limited (30 req/min). |
| `/api/ml/train` | `POST` | ADMIN | Explicit Admin Only | `401 / 403 / 429 / 503` | Triggers retraining of RandomForest / LinearRegression models. Rate limited (5 req/min). |
| `/api/ml/status` | `GET` | USER, ADMIN | Any authenticated user | `401 Unauthorized` | Returns ML service health, active model version, test $R^2$, and MSE metrics. |

---

## 4. Socket.IO Real-Time Authorization Matrix

| Channel / Event | Direction | Allowed Callers | Authorization Rule | Scope / Delivery |
|---|---|---|---|---|
| **Handshake / Connect** | Client $\to$ Server | USER, ADMIN | Validates HttpOnly session cookie `stepcharge_session` or query token | Connection rejected (`401 Unauthorized`) if unauthenticated. |
| **`subscribe:device`** | Client $\to$ Server | USER, ADMIN | Caller must own `deviceId` OR be `ADMIN` | Socket joins room `device:<deviceId>`. Emits `error` event if unauthorized. |
| **`unsubscribe:device`** | Client $\to$ Server | USER, ADMIN | None | Socket leaves room `device:<deviceId>`. |
| **`telemetry:update`** | Server $\to$ Client | Authenticated Room Members | Must be joined to room `device:<deviceId>` | Scoped strictly to room `device:<deviceId>`. No global `io.emit`. |
| **`footstep:detected`** | Server $\to$ Client | Authenticated Room Members | Must be joined to room `device:<deviceId>` | Scoped strictly to room `device:<deviceId>`. No global `io.emit`. |
| **`load:state`** | Server $\to$ Client | Authenticated Room Members | Must be joined to room `device:<deviceId>` | Scoped strictly to room `device:<deviceId>`. No global `io.emit`. |
| **`alert:new`** | Server $\to$ Client | Authenticated Room Members | Must be joined to room `device:<deviceId>` | Scoped strictly to room `device:<deviceId>`. No global `io.emit`. |

---

## 5. Security Failure Matrix & Response Codes

| Condition | HTTP Status | Error Code | Response Payload Structure |
|---|---|---|---|
| No session cookie / token | `401` | `UNAUTHORIZED` | `{"error": "Authentication required", "code": "UNAUTHORIZED"}` |
| Expired / invalid JWT token | `401` | `INVALID_TOKEN` | `{"error": "Invalid or expired session token", "code": "INVALID_TOKEN"}` |
| Non-admin accessing admin route | `403` | `FORBIDDEN` | `{"error": "Administrator privilege required", "code": "FORBIDDEN"}` |
| User accessing unowned device | `403` | `FORBIDDEN` | `{"error": "Access denied: you do not own this device", "code": "FORBIDDEN"}` |
| Unregistered device in production | `403` | `DEVICE_NOT_REGISTERED` | `{"error": "Device not registered...", "code": "DEVICE_NOT_REGISTERED"}` |
| Invalid device API key | `401` | `INVALID_CREDENTIALS` | `{"error": "Invalid device credentials", "code": "INVALID_CREDENTIALS"}` |
| Target device does not exist | `404` | `NOT_FOUND` | `{"error": "Device not found", "code": "NOT_FOUND"}` |
| Telemetry / ML bounds invalid | `400` | `INVALID_INPUT` | `{"error": "Field '...' exceeds physical limit...", "code": "INVALID_INPUT"}` |
| CSRF OAuth state mismatch | `400` | `INVALID_STATE` | `{"error": "Invalid or expired OAuth state parameter"}` |
| Rate limit exceeded | `429` | `TOO_MANY_REQUESTS` | `{"error": "Too many requests. Please try again later."}` |
| ML Service offline | `503` | `ML_SERVICE_OFFLINE` | `{"error": "ML service unavailable", "code": "ML_SERVICE_OFFLINE"}` |

---

## 6. Implementation Reference

The rules defined in this matrix are enforced by the following production middleware:
- **`requireAuth`**: `backend/src/middlewares/auth.ts`
- **`requireAdmin`**: `backend/src/middlewares/auth.ts`
- **`requireDeviceAccess`**: `backend/src/middlewares/deviceAccess.ts`
- **`requireDeviceOrOwnerAuth`**: `backend/src/middlewares/deviceAccess.ts`
- **`requireDeviceAuth`**: `backend/src/middlewares/deviceAuth.ts`
- **Socket.IO Session Middleware**: `backend/src/config/socket.ts`
- **Rate Limiters**: `backend/src/middlewares/rateLimiter.ts`
- **Automated Security Verification**: `backend/src/__tests__/security.test.ts` (33 automated test cases)
