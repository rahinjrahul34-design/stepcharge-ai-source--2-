# StepCharge AI — Authentication & Authorization

This document specifies the security and authentication protocols implemented across StepCharge AI.

---

## 1. Web User Authentication: Google OAuth 2.0

All web users authenticate through Google OAuth 2.0. Legacy Firebase Authentication has been completely eradicated.

### 1.1 OAuth 2.0 Authorization Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant FE as React Frontend (:5173)
    participant BE as Express Backend (:5000)
    participant Google as Google Identity Services
    participant DB as MongoDB Atlas

    User->>FE: Clicks "Continue with Google"
    FE->>BE: GET /api/auth/google/url
    BE-->>FE: Returns https://accounts.google.com/o/oauth2/v2/auth?...
    FE->>Google: Redirects user to Google Consent Screen
    User->>Google: Approves authentication
    Google->>BE: Redirects to /api/auth/google/callback?code=AUTH_CODE
    BE->>Google: Exchanges AUTH_CODE for Access & ID Tokens (Server-side)
    Google-->>BE: Returns verified user claims (sub, email, name, picture)
    BE->>DB: Upsert User record (match on googleId or email)
    DB-->>BE: User document (role: USER or ADMIN)
    BE->>BE: Signs JWT Session Token (HS256)
    BE-->>User: Set-Cookie: stepcharge_session=JWT; HttpOnly; Secure; SameSite=Lax
    BE-->>FE: 302 Redirect to Frontend (/)
    FE->>BE: GET /api/auth/me (Cookie automatically sent)
    BE-->>FE: 200 OK { user: { email, name, role, avatarUrl } }
```

### 1.2 Session Cookie Properties

| Attribute | Production Value | Development Value | Rationale |
|---|---|---|---|
| `HttpOnly` | `true` | `true` | Mitigates XSS session hijacking. JavaScript cannot access cookie. |
| `Secure` | `true` | `false` | Ensures cookie is only transmitted over TLS in production. |
| `SameSite` | `None` (if cross-origin) or `Lax` | `Lax` | Protects against CSRF attacks. |
| `Max-Age` | `604800000` (7 days) | `604800000` (7 days) | Automatic session expiry window. |

### 1.3 Role-Based Access Control (RBAC)

Two explicit user roles are defined:
- `USER`: Read telemetry, view live graphs, export historical data, view alerts.
- `ADMIN`: Register new devices, rotate device API keys, issue load switching commands, train ML models, acknowledge/delete alerts, access audit logs.

> [!IMPORTANT]
> Google users are granted the `USER` role by default. Admin access must be explicitly granted in the MongoDB database or through the `INITIAL_ADMIN_EMAIL` environment variable.

---

## 2. IoT Device Authentication: `X-Device-Key`

The ESP32 microcontroller must never contain database URIs, Google OAuth client secrets, or Firebase credentials.

### 2.1 Device API Key Protocol

1. **Key Generation**: When a device is registered by an administrator, the backend generates a cryptographically secure 64-character token:
   ```
   sc_live_f89a4b2c8901de45a890b1c2d3e4f5a6b7c8d9e0f1a2b3c4...
   ```
2. **Key Storage**:
   - The plain key is displayed **once** to the administrator for flashing into `firmware/stepcharge_esp32/secrets.h`.
   - The backend computes a SHA-256 hash:
     $$\text{hash} = \text{SHA256}(\text{raw\_key})$$
   - The backend stores **only** the `apiKeyHash` in the MongoDB `Device` collection.
3. **Request Verification**:
   - Every ESP32 HTTP request includes the header:
     ```http
     X-Device-Key: <raw_key>
     ```
   - Middleware `requireDeviceAuth` hashes the incoming header and performs an indexed query on `Device.findOne({ deviceId, apiKeyHash })`.
   - Rejects with `401 Unauthorized` if invalid, revoked, or disabled.
