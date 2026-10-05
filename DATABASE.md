# StepCharge AI — MongoDB Database Architecture

This document outlines the MongoDB Atlas database schema, collections, indexing strategies, and migration mappings.

---

## 1. Migration Entity Mapping

| Legacy Firebase RTDB Path | Target MongoDB Collection | Model File | Purpose |
|---|---|---|---|
| `/users/$uid` | `users` | `backend/src/models/User.ts` | Authenticated Google user accounts and RBAC |
| `/devices/$deviceId/config` | `devices` | `backend/src/models/Device.ts` | Registered IoT hardware, locations, SHA-256 keys |
| `/telemetry/$deviceId` (latest) | `telemetry` | `backend/src/models/Telemetry.ts` | Periodic time-series packets from ESP32 |
| `/footsteps/$deviceId` | `footsteps` | `backend/src/models/Footstep.ts` | Discrete footstep impact events with ML classification |
| `/loads/$deviceId` | `devices.loads` | Embedded in `Device.ts` | Multi-channel load command vs confirmed actual state |
| `/alerts` | `alerts` | `backend/src/models/Alert.ts` | System anomalies, offline events, threshold triggers |
| `/dataset` | `dataset_samples` | `backend/src/models/DatasetSample.ts` | Ground-truth labeled samples for ML retraining |
| `/modelMetadata` | `model_metadata` | `backend/src/models/ModelMetadata.ts` | Active ML model performance metrics and weights |
| *None (New)* | `audit_logs` | `backend/src/models/AuditLog.ts` | Administrative operations and security trace |

---

## 2. Collection Schemas & Indexes

### 2.1 `users`
```typescript
{
  _id: ObjectId,
  googleId: String,          // Unique Google account sub
  email: String,             // User email (lowercase)
  name: String,
  avatarUrl: String,
  role: 'USER' | 'ADMIN',    // Default: 'USER'
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}
```
- **Indexes**:
  - `{ googleId: 1 }` (unique)
  - `{ email: 1 }` (unique)

### 2.2 `devices`
```typescript
{
  _id: ObjectId,
  deviceId: String,          // Unique hardware identifier (e.g. 'ESP32-01')
  name: String,
  location: String,
  ownerId: ObjectId,         // Ref: User
  firmwareVersion: String,
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'REVOKED',
  apiKeyHash: String,        // SHA-256 hash of X-Device-Key
  lastSeenAt: Date,
  lastIp: String,
  rssi: Number,
  loads: [
    {
      channel: Number,       // e.g. 1 (LED), 2 (FAN)
      name: String,
      command: 'ON' | 'OFF', // User requested intent
      actualState: 'ON' | 'OFF' | 'UNKNOWN', // Confirmed by GPIO readback
      updatedAt: Date
    }
  ]
}
```
- **Indexes**:
  - `{ deviceId: 1 }` (unique)
  - `{ status: 1 }`

### 2.3 `telemetry`
```typescript
{
  _id: ObjectId,
  deviceId: String,
  timestamp: Date,
  uptimeSec: Number,
  storageVoltage: Number,       // Capacitor voltage (0.0 to 6.5 V)
  estimatedStoredEnergy: Number,// 0.5 * C * V^2 (Joules)
  wifiRssi: Number,             // dBm (-100 to 0)
  footstepDetected: Boolean,
  firmwareVersion: String
}
```
- **Indexes**:
  - `{ deviceId: 1, timestamp: -1 }` (compound: powers all dashboard live queries)
  - `{ timestamp: -1 }`

### 2.4 `footsteps`
```typescript
{
  _id: ObjectId,
  deviceId: String,
  timestamp: Date,
  peakVoltage: Number,          // Peak piezo pulse (V)
  averageVoltage: Number,       // Mean voltage over pulse (V)
  pulseDurationMs: Number,      // Pulse length (ms)
  stepIntervalMs: Number,       // Time since last footstep (ms)
  storageVoltage: Number,       // Cap voltage at trigger time (V)
  estimatedPulseEnergy: Number, // (Vavg^2 / Req) * (t / 1000) (Joules)
  classification: 'LIGHT' | 'NORMAL' | 'HEAVY' | null,
  confidence: Number | null,    // 0.0 to 1.0 (null if ML offline)
  mlModelVersion: String | null
}
```
- **Indexes**:
  - `{ deviceId: 1, timestamp: -1 }` (compound)
  - `{ classification: 1 }`

### 2.5 `alerts`
```typescript
{
  _id: ObjectId,
  deviceId: String,
  userId: ObjectId | null,
  type: 'LOW_STORAGE_VOLTAGE' | 'ESP32_OFFLINE' | 'WIFI_DISCONNECTED' |
        'ABNORMAL_VOLTAGE' | 'LOW_AI_CONFIDENCE' | 'LOAD_MALFUNCTION' | 'SYSTEM',
  severity: 'INFO' | 'WARNING' | 'CRITICAL',
  message: String,
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
  createdAt: Date,
  resolvedAt: Date | null,
  resolvedBy: ObjectId | null
}
```
- **Indexes**:
  - `{ deviceId: 1, status: 1, createdAt: -1 }`
  - `{ status: 1 }`
