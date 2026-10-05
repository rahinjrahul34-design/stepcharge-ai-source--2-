# StepCharge AI — Security Architecture & Threat Model

## 1. Overview
StepCharge AI was comprehensively audited and hardened in Phase 1 and validated in Phase 4. All communication channels, database operations, device authentications, and user authorizations enforce strict production-grade security standards.

---

## 2. Authentication & Authorization Architecture

### 2.1 Google OAuth 2.0 & Session Security
- User identity is verified via Google OAuth 2.0 server-side exchange.
- Session tokens are signed using JWT (HMAC SHA-256) stored in `HttpOnly`, `SameSite=Lax` cookies.
- CSRF protection: State parameters verified on OAuth callback.

### 2.2 Role-Based Access Control (RBAC)
- **`ADMIN`**: Can modify settings, calibrate sensors, control loads, manage model registry, and register devices.
- **`USER`**: Can view telemetry, run experiments, submit footstep samples, and view research analytics.
- **Strict Device Scoping**: User A cannot read, modify, or send load commands to User B's devices.

### 2.3 Edge Device Security (`X-Device-Key`)
- ESP32 nodes authenticate to the REST API using an HMAC SHA-256 pre-shared device key in the `X-Device-Key` HTTP header.
- The raw key is never stored in plaintext; only the SHA-256 hash is persisted in the `Device` collection in MongoDB.
- Revoked devices are rejected at the middleware boundary (`403 Forbidden`).

---

## 3. Realtime Socket.IO Security
- WebSockets require authenticated handshake via session cookies.
- Unauthenticated socket connections are immediately disconnected.
- Sockets must join room-scoped device channels (`device:<deviceId>`).
- Cross-tenant device broadcasting is strictly prevented.

---

## 4. Zero Firebase Elimination
- All Firebase SDKs, Realtime Database, Firestore, and legacy rules are 100% removed.
- Production storage is backed exclusively by MongoDB Atlas with indexed collections and schema validation.
