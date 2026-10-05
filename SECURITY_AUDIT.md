# StepCharge AI — Complete Security Audit & Hardening Report

**Project:** StepCharge AI — Smart Footstep Energy Harvesting and Monitoring System  
**Phase:** 1 — Security, Authorization, Data Integrity & Production Hardening  
**Audit Date:** October 2026  
**Status:** PASS — ALL 18 VULNERABILITIES REMEDIATED & VERIFIED  

---

## 1. Executive Summary

A comprehensive, zero-trust security audit and production hardening review was conducted on the **StepCharge AI** platform. The system comprises a React 18 + TypeScript frontend, a Node.js + Express + TypeScript backend, MongoDB Atlas persistence, Socket.IO real-time event pipeline, Python Scikit-Learn ML microservice, and ESP32 embedded firmware.

Prior to hardening, the codebase exhibited critical vulnerabilities, including insecure automatic device provisioning (`DEVICE_AUTO_PROVISION`), global broadcasts of confidential telemetry via `io.emit`, lack of resource ownership checks on device endpoints, first-user-admin escalation, missing OAuth CSRF state verification, unauthenticated history/analytics endpoints, and unbounded ML inference requests.

Following the Phase 1 hardening program:
- **18 security vulnerabilities (SEC-01 through SEC-18)** have been identified, remediated, and verified.
- **33 dedicated security test cases** were created in `backend/src/__tests__/security.test.ts`.
- **100% of test suites pass** (51/51 tests passing across backend test suites).
- **TypeScript compiles with zero errors** across backend (`tsc`) and frontend (`tsc -b && vite build`).
- **Zero data fabrication principles** enforced across live mode, metrics, and energy reporting.

---

## 2. Complete Vulnerability & Remediation Matrix

| Vulnerability ID | Severity | Component | Description | Impact | Remediation Implemented | Status |
|---|---|---|---|---|---|---|
| **SEC-01** | **P0 (Critical)** | `middlewares/deviceAuth.ts` | Insecure automatic device creation upon receiving unknown `deviceId` and key. | Rogue ESP32 or attacker could flood database with arbitrary devices. | Auto-provisioning disabled by default (`DEVICE_AUTO_PROVISION=false`). Unknown devices rejected with `403 DEVICE_NOT_REGISTERED`. Registration restricted to `ADMIN`. | **RESOLVED** |
| **SEC-02** | **P0 (Critical)** | `config/socket.ts`, `services/telemetryService.ts` | Global `io.emit` broadcast of telemetry, footsteps, load states, and alerts to all connected sockets. | Complete telemetry and event data leakage across unrelated users. | Eliminated all global emits. Scoped all broadcasts strictly to `io.to("device:" + deviceId).emit`. Enforced room membership checks. | **RESOLVED** |
| **SEC-03** | **P0 (Critical)** | `routes/deviceRoutes.ts`, `controllers/deviceController.ts` | Missing ownership checks on device control, details, key rotation, and load commands. | Any authenticated user could manipulate or control any other user's hardware. | Created `requireDeviceAccess` middleware verifying `device.ownerId === req.user.userId` or caller is `ADMIN`. Applied to all `/:deviceId` routes. | **RESOLVED** |
| **SEC-04** | **P0 (Critical)** | `services/authService.ts` | First-user auto-admin: `countDocuments() === 0 => ADMIN`. | Race condition during deployment allowed arbitrary first registrant to become superadmin. | Removed auto-admin bootstrapping. Admin role assignment strictly requires explicit configuration in `ADMIN_EMAILS` whitelist. | **RESOLVED** |
| **SEC-05** | **P1 (High)** | `controllers/authController.ts`, `services/authService.ts` | Google OAuth redirect URL generated without cryptographic CSRF state token. | Cross-Site Request Forgery during OAuth callback flow. | Implemented 32-byte cryptographic state token (`crypto.randomBytes(32)`), stored in HttpOnly cookie `stepcharge_oauth_state`, and strictly validated in `/google/callback`. | **RESOLVED** |
| **SEC-06** | **P1 (High)** | `routes/historyRoutes.ts`, `controllers/historyController.ts` | Historical telemetry, footsteps, and energy endpoints lacked authentication and device ownership scoping. | Unauthenticated exfiltration of user footstep and energy consumption logs. | Enforced `requireAuth` on all history routes. Scoped queries by `deviceId` ownership; auto-scoped to owned devices when `deviceId` omitted. | **RESOLVED** |
| **SEC-07** | **P1 (High)** | `routes/analyticsRoutes.ts`, `controllers/analyticsController.ts` | Analytics endpoints (`/stats`, `/trends`) accessible without authentication or ownership checks. | Public exposure of aggregate device performance and analytics data. | Added `requireAuth` + `requireDeviceAccess`. Validates `deviceId` presence and user ownership before computing statistics. | **RESOLVED** |
| **SEC-08** | **P1 (High)** | `routes/alertRoutes.ts`, `controllers/alertController.ts` | Alert list and resolution endpoints unauthenticated; any user could resolve any alert. | Tampering with system alerts; data integrity degradation. | Added `requireAuth`. Scoped alerts to user-owned devices. Alert resolution (`PATCH /:id/resolve`) strictly verifies ownership of associated device. | **RESOLVED** |
| **SEC-09** | **P1 (High)** | `routes/datasetRoutes.ts`, `controllers/datasetController.ts` | Dataset endpoints lacked user authentication, creation attribution, and rate limiting. | Dataset pollution and unauthorized deletion of machine learning training data. | Enforced `requireAuth`, rate limiting, ownership verification on sample addition, and restricted sample deletion to creator (`createdBy === userId`) or `ADMIN`. | **RESOLVED** |
| **SEC-10** | **P1 (High)** | `controllers/mlController.ts`, `routes/mlRoutes.ts` | Missing physical bounds validation on ML prediction inputs; missing rate limiting on inference endpoint. | Denial-of-service, mathematical anomalies, and service crash via NaN/Infinity inputs. | Enforced strict bounds ($0 \le V \le 60\text{V}$, non-negative finite steps/energy). Added `mlPredictLimiter` (30 req/min). | **RESOLVED** |
| **SEC-11** | **P1 (High)** | `routes/mlRoutes.ts` | Machine learning model retraining trigger was unprotected or accessible to standard users. | Resource exhaustion and model poisoning via unthrottled training triggers. | Restricted `/api/ml/train` to `requireAdmin` + added `mlTrainLimiter` (5 req/min). | **RESOLVED** |
| **SEC-12** | **P1 (High)** | `models/Device.ts`, `services/deviceService.ts` | Device keys stored or transmitted with risk of predictability. | Key exposure allows spoofed telemetry generation. | High-entropy crypto hex keys (`sc_live_` + 48 hex chars) generated via `crypto.randomBytes(24)`. Only SHA-256 hash stored in MongoDB (`apiKeyHash`). Plaintext key returned exactly once at creation. | **RESOLVED** |
| **SEC-13** | **P2 (Medium)** | `config/env.ts`, `src/data/store.tsx` | Discrepancy in supercapacitor capacitance between frontend ($1.0\,\text{F}$) and backend/firmware ($0.1\,\text{F}$). | Inaccurate energy calculations ($E = \frac{1}{2} C V^2$) and confusing user metrics. | Aligned `supercapFarads` to $0.1\,\text{F}$ across backend configuration and frontend `DEFAULT_SETTINGS`. Configured centralized safety thresholds ($5.0\,\text{V}$ max, $4.7\,\text{V}$ warn, $2.0\,\text{V}$ low). | **RESOLVED** |
| **SEC-14** | **P2 (Medium)** | `services/telemetryService.ts` | Ingestion pipeline used `Device.findOneAndUpdate` with `upsert: true`. | Bypassed device authorization by creating new device records during telemetry processing. | Set `upsert: false`. Handled null device gracefully with logged error. | **RESOLVED** |
| **SEC-15** | **P2 (Medium)** | `services/telemetryService.ts` | Supercapacitor stored energy calculation vulnerable to negative or non-finite voltage. | Negative or corrupt energy values logged into database. | Enforced voltage clamping ($\ge 0$), finite checks, and honest energy accounting formula ($E = \frac{1}{2} C V^2$). | **RESOLVED** |
| **SEC-16** | **P1 (High)** | `config/socket.ts` | Socket.IO allowed unauthenticated WebSocket connections and arbitrary room joins. | Unauthorized clients could join any room and intercept live hardware telemetry. | Added handshake session middleware (extracts JWT from HttpOnly cookie or auth token). Enforced ownership check before socket joins room `device:<deviceId>`. | **RESOLVED** |
| **SEC-17** | **P3 (Low)** | `src/pages/Settings.tsx` | Dashboard UI implied that modifying interval sliders immediately reprogrammed ESP32 firmware over-the-air. | Operator confusion regarding hardware configuration vs local polling cadence. | Added explicit `[LOCAL UI SETTING]` labels in Settings UI clarifying local UI refresh rate vs firmware settings in `config.h`. | **RESOLVED** |
| **SEC-18** | **P2 (Medium)** | `config/socket.ts`, `app.ts` | CORS allowed wildcard or loose origin matching in development fallbacks. | Potential cross-origin WebSocket hijacking and API abuse. | Restructured CORS configuration to strictly validate against `CORS_ORIGIN` environment variable with credentials enabled. | **RESOLVED** |

---

## 3. Security Architecture Overview

### 3.1 Authentication & Session Management
- **Protocol:** Google OAuth 2.0 with OpenID Connect (`sub`, `email`, `name`, `picture`).
- **CSRF Protection:** Cryptographically secure 32-byte state token set via `stepcharge_oauth_state` (HttpOnly, SameSite, Secure in production).
- **Session Delivery:** Signed JSON Web Tokens (JWT) stored exclusively in HttpOnly cookies (`stepcharge_session`).
- **No Client Secret Exposure:** `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, and `MONGODB_URI` are never bundled into frontend assets or exposed in client API responses.

### 3.2 Authorization & Device Ownership
- **Authorization Flow:**
  $$\text{Request} \longrightarrow \text{requireAuth} \longrightarrow \text{requireDeviceAccess} \longrightarrow \text{Controller}$$
- **Multi-Tenant Isolation:** Users can only view, query, control, or subscribe to devices where `device.ownerId === req.user.userId`.
- **Admin Privilege:** Granted strictly through configuration (`ADMIN_EMAILS` whitelist), never via auto-elevation or client-supplied fields.

### 3.3 Hardware & Ingestion Security
- **Authentication:** ESP32 devices authenticate using header `X-Device-Key: sc_live_<token>`.
- **Cryptographic Storage:** The backend hashes the incoming key with SHA-256 and performs a constant-time comparison against `Device.apiKeyHash` in MongoDB.
- **Production Auto-Provisioning:** Explicitly disabled (`DEVICE_AUTO_PROVISION=false`). Unknown devices are rejected immediately.
- **Strict Boundary Validation:**
  - Storage Voltage: $0 \le V \le 60.0\,\text{V}$
  - Piezo Voltage: $0 \le V \le 60.0\,\text{V}$
  - Current: $\ge 0\,\text{mA}$
  - Steps: $\ge 0$
  - Finite numbers only (`!Number.isFinite()` checks on all numeric inputs).

### 3.4 Socket.IO Real-Time Isolation
- **Handshake Verification:** Unauthenticated connections are terminated at handshake before connection establishment.
- **Room Authorization:** Clients must emit `subscribe:device` with a valid `deviceId`. The server verifies device existence and ownership prior to joining `device:<deviceId>`.
- **Zero Global Broadcasts:** All private telemetry, footstep events, load states, and alerts are emitted strictly to room `device:<deviceId>`.

---

## 4. Test Verification Summary

### 4.1 Automated Security Test Suite (`backend/src/__tests__/security.test.ts`)
The automated security suite contains **33 targeted tests** covering:
- Device auto-provisioning refusal for unknown devices (`403 DEVICE_NOT_REGISTERED`).
- Device key validation and rejection of invalid API keys (`401 INVALID_CREDENTIALS`).
- Telemetry validation (bounds enforcement, negative rejection, non-finite rejection).
- Ownership authorization on device retrieval, key rotation, and load commands.
- Dual-auth verification on `GET /api/devices/:deviceId/loads` for ESP32 and owners.
- Scoped listing of devices (normal user sees owned devices only; admin sees all).
- Historical query scoping (telemetry, footsteps, energy) preventing cross-user data leakage.
- Analytics endpoints requiring ownership and rejecting unowned device queries.
- Alert resolution ownership enforcement.
- Dataset sample addition, rate limiting, and creator-only deletion.
- ML prediction input bounds validation ($0-60\text{V}$, positive steps) and rate limiting.
- ML training restriction to `ADMIN`.
- OAuth state token generation and CSRF protection.
- Admin privilege assignment (strictly via `adminEmails`, no first-user auto-admin).

### 4.2 Test Suite Execution Results
```
 RUN  v3.2.7 backend

 ✓ src/__tests__/backend.test.ts (11 tests) 17ms
 ✓ src/__tests__/api.test.ts (7 tests) 146ms
 ✓ src/__tests__/security.test.ts (33 tests) 337ms

 Test Files  3 passed (3)
      Tests  51 passed (51)
   Duration  4.39s
```

### 4.3 Static Code Analysis & Build Verification
- **Backend Build (`tsc`):** Clean compile with 0 errors.
- **Frontend Lint (`oxlint`):** 0 errors.
- **Frontend Build (`tsc -b && vite build`):** Clean compile, 2533 modules transformed, production bundle built in 3.41s with exit code 0.

---

## 5. Production Deployment Recommendations

1. **Environment Variables Configuration:**
   - Set `NODE_ENV=production`.
   - Set `DEVICE_AUTO_PROVISION=false`.
   - Populate `ADMIN_EMAILS` with the authorized administrator email addresses (comma-separated).
   - Set high-entropy secrets for `JWT_SECRET` (minimum 64 characters) and `SESSION_SECRET`.
   - Ensure `CORS_ORIGIN` matches the exact production frontend domain.

2. **TLS / HTTPS Termination:**
   - Terminate SSL/TLS at reverse proxy (e.g. Nginx, Cloudflare, AWS ALB).
   - Ensure `X-Forwarded-Proto: https` is forwarded to Node.js for secure cookie enforcement.

3. **Database Hardening:**
   - Configure IP Access Whitelist in MongoDB Atlas restricting access to backend server IPs.
   - Enforce TLS 1.3 for all database connections.

4. **Hardware Provisioning Protocol:**
   - Administrators register devices via `POST /api/devices`.
   - The generated `apiKey` must be flashed onto the physical ESP32 device credentials (`config.h`) via secure serial connection before field deployment.
