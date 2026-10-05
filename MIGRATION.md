# StepCharge AI — Firebase to MongoDB Migration Guide

This document describes how legacy Firebase Realtime Database and Authentication data was migrated to MongoDB Atlas, and provides instructions for running the automated data import script.

---

## 1. Migration Execution Overview

The automated migration script is located at:
`backend/src/scripts/migrateFirebaseToMongo.ts`

It takes a standard Firebase JSON export file and transforms legacy document structures into clean, typed Mongoose documents adhering to our new schema constraints.

### 1.1 Running the Migration Script

1. Export your Firebase Realtime Database as a JSON file from the Firebase Console:
   `Firebase Console → Realtime Database → Export JSON`.
2. Save the export file as `firebase_export.json` in the root of the project.
3. Run the automated migration script from the backend directory:
   ```bash
   cd backend
   npx tsx src/scripts/migrateFirebaseToMongo.ts ../firebase_export.json
   ```

---

## 2. Transformation Rules

### 2.1 Devices
- **Firebase**: Keyed by `$deviceId` at `/devices/$deviceId/config`.
- **MongoDB**: Created in the `devices` collection. Generates a secure random 64-character API key and hashes it with SHA-256 for `apiKeyHash`.
- **Note**: The script outputs the newly generated API key to stdout so it can be flashed into the ESP32.

### 2.2 Telemetry Time-Series
- **Firebase**: Object at `/telemetry/$deviceId`.
- **MongoDB**: Inserted into `telemetry` collection.
- **Formulas Applied**: Computes `estimatedStoredEnergy = 0.5 * 0.1 * (storageVoltage^2)`.

### 2.3 Footstep Impact Events
- **Firebase**: Push keys at `/footsteps/$deviceId`.
- **MongoDB**: Normalized and saved into `footsteps` collection.
- **Integrity**: Retains timestamp, peakVoltage, averageVoltage, pulseDuration, and ML classification if previously tagged.

### 2.4 Load Control States
- **Firebase**: Direct boolean properties at `/loads/$deviceId/led` and `/loads/$deviceId/fan`.
- **MongoDB**: Converted to structured array `loads: [{ channel: 1, name: 'LED Indicator', command: 'OFF', actualState: 'OFF' }, ...]` in the `Device` document.

---

## 3. Verification Post-Migration

After running the migration script, verify the collection document counts using the Mongo Shell or MongoDB Compass:

```javascript
use stepcharge;
db.devices.countDocuments();
db.telemetry.countDocuments();
db.footsteps.countDocuments();
db.alerts.countDocuments();
```
