# ⚡ StepCharge AI
**Smart Footstep Energy Harvesting & Monitoring System**

A production-quality academic IoT + AI prototype dashboard for a piezoelectric
footstep energy-harvesting mat.

```
Human footstep → Piezoelectric mat → Rectifier → Supercapacitor → Voltage measurement
→ ESP32 → Wi-Fi → Firebase RTDB → ML classification → Web dashboard → Insights & alerts
```

---

## 1. Running the dashboard

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle
npx tsc -b         # type check (clean)
npx oxlint src     # lint
```

The login screen is a lightweight academic prototype gate (credentials pre-filled).

---

## 2. Demo mode vs Live mode

The UI is source-agnostic: every page reads from the store, and the store reads
from a `DataSource`. Two implementations satisfy the same contract.

| | DEMO | LIVE |
|---|---|---|
| Source | `src/data/mockSource.ts` | `src/data/liveSource.ts` |
| Data | fully simulated | only what the ESP32 publishes |
| Badge | amber **DEMO MODE** everywhere | green **LIVE · ESP32-01** |
| Enabled when | always | `VITE_FIREBASE_*` configured |

**Switching:** the *Data source* selector in the sidebar (also on Settings →
Device Settings). The choice persists in `localStorage`. Selecting LIVE without
Firebase configured is blocked with an explanation rather than silently falling
back. Switching tears down all listeners and rebuilds the stream — no leaks.

---

## 3. Environment variables

Frontend (`.env.example` → `.env.local`):

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | live mode | Public web-client key |
| `VITE_FIREBASE_AUTH_DOMAIN` | live mode | For Firebase Authentication |
| `VITE_FIREBASE_DATABASE_URL` | live mode | `VITE_FIREBASE_DB_URL` also accepted |
| `VITE_FIREBASE_PROJECT_ID` | live mode | |
| `VITE_FIREBASE_STORAGE_BUCKET` | optional | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | optional | |
| `VITE_FIREBASE_APP_ID` | optional | |
| `VITE_DEVICE_ID` | yes | Defaults to `ESP32-01` |
| `VITE_ML_API_URL` | optional | Blank ⇒ labelled demo heuristic, no crash |

ML service (`ml-service/.env.example` → `ml-service/.env`):

| Variable | Default | Notes |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allow-list. **Never defaults to `*`** |
| `MODEL_ARTIFACT_PATH` | `artifacts` | Where `model.joblib` / `metadata.json` live |
| `DATASET_PATH` | `../stepcharge-dataset.csv` | Default training CSV |

ESP32 (`firmware/stepcharge_esp32/secrets.h`, git-ignored):
`WIFI_SSID`, `WIFI_PASSWORD`, `FIREBASE_HOST`, `FIREBASE_AUTH`.

**Credential placement rules**

| Secret | Belongs in | Never in |
| --- | --- | --- |
| Wi-Fi password | `secrets.h` on the device | Frontend, Git, README |
| RTDB secret / device token | `secrets.h` on the device | Frontend bundle |
| Service-account JSON / Admin SDK key | Server or Cloud Functions only | Frontend, firmware, Git |
| Firebase web config | `.env.local` (public by design) | — protected by rules, not secrecy |

## 4. Firebase setup

1. Create a project → **Realtime Database** (RTDB chosen over Firestore: telemetry
   is a high-frequency append-only stream and the ESP32 can push over plain REST).
2. Deploy `firebase.rules.json` (public read, authenticated write, range index on
   `footstepEvents`, server-side validation of voltage bounds).
3. Copy the web config into `.env.local`.
4. Flash the firmware with a **device-scoped token**, not the database secret.

Database layout (also in `services/firebase/config.ts`):

```
devices/{deviceId}                  identity, firmware, lastSeen, rssi, piezoArray
telemetry/{deviceId}/latest         current TelemetryPacket (1 Hz)
footstepEvents/{deviceId}/{epochMs} one record per detected step
alerts/{alertId}                    severity, category, value, threshold
systemHealth/{deviceId}/{ts}        link statistics
modelMetadata                       metrics published by the training pipeline
```

---

## 5. ESP32 telemetry JSON

`firmware/stepcharge_esp32/` contains a complete reference sketch (envelope
detection, debounce, NTP timestamps, REST publishing, load readback).

```json
{
  "deviceId": "ESP32-01",
  "timestamp": "2026-10-05T10:42:31Z",
  "footstepCount": 1284,
  "peakVoltage": 4.62,
  "averageVoltage": 2.31,
  "pulseDuration": 238,
  "stepInterval": 1.42,
  "storageVoltage": 4.18,
  "current": null,
  "power": null,
  "energy": null,
  "wifiRssi": -54,
  "uptimeSec": 36114,
  "deviceStatus": "ONLINE",
  "firmwareVersion": "1.3.0",
  "loadControlAvailable": true
}
```

### Load control chain (command vs actual state)

Load state does **not** travel in the telemetry packet. It lives under
`devices/{id}/loads/{led|fan}` so the two directions stay separate:

```json
{ "led": { "command": true, "actualState": true,
           "updatedAt": "…dashboard wrote this…",
           "reportedAt": "…firmware confirmed this…" } }
```

| Field | Written by | Meaning |
| --- | --- | --- |
| `command` | Dashboard | What the user asked for |
| `actualState` | ESP32 only | What `digitalRead(pin)` actually returned |

The firmware polls `command` every 1.5 s, drives the MOSFET gate, reads the pin
back and publishes `actualState`. The dashboard shows both, and shows
**DEVICE OFFLINE** / **NOT REPORTED** rather than ever claiming a load switched.

`stepClass` / `confidence` are optional: send them only if you classify
on-device (the UI then tags the label **DEVICE PREDICTION**); otherwise the
dashboard's ML service classifies and tags **ML PREDICTION** or **DEMO PREDICTION**.

Every packet passes `validatePayload()` (type + physical range checks) before it
reaches a chart; malformed packets are rejected and raise a NETWORK alert.

---

## 6. ML integration

`ml-service/` is a working FastAPI + scikit-learn service.

```bash
cd ml-service && pip install -r requirements.txt
python train_model.py --csv ../stepcharge-dataset.csv --version v1.0
uvicorn app:app --host 0.0.0.0 --port 8000
# then set VITE_ML_API_URL=http://localhost:8000 and reload the dashboard
```

### Endpoints

| Method | Path | Purpose | Behaviour with no trained model |
| --- | --- | --- | --- |
| GET | `/health` | liveness + `modelLoaded` | `{"status":"ok","modelLoaded":false}` |
| GET | `/model` | metadata, metrics, confusion matrix | `modelName: "MODEL NOT TRAINED"`, `metrics: null` |
| POST | `/predict` | classify one feature vector | HTTP 503 `MODEL_NOT_CONNECTED` — never a fake label |
| POST | `/train` | train from posted CSV, return real metrics | n/a |
| POST | `/reload` | re-read `model.joblib` from disk | n/a |

The dashboard polls `/health` every 30 s and drives the ML Service cell of the
status panel plus the `ML_SERVICE_OFFLINE` alert from the result.

### Feature ablation study

Does `storageVoltage` actually help? Answer it with evidence, not intuition:

```bash
cd ml-service && python feature_study.py --csv ../stepcharge-dataset.csv
```

It trains with all 5 features and again with 4 (dropping `storageVoltage`),
using the same subject-independent protocol, and prints both score sets with a
verdict. Treat |ΔF1| < 0.02 as noise on a small dataset.

Conceptually `storageVoltage` describes the *system's* charge state rather than
how hard someone stepped, so a model leaning on it is a warning sign. Run the
study on your real data before claiming the feature earns its place.

### Dataset collection workflow (AI Model → Dataset)

1. Step on the mat — the latest feature vector appears as "pending capture".
2. Press **LIGHT**, **NORMAL** or **HEAVY** to store it with ground-truth label.
3. Filter by class, review, and delete any mislabelled row.
4. **Export CSV**, or press **Train now** (needs ≥30 samples, ≥5 per class).

Samples are saved to `localStorage` and, in live mode, mirrored to
`dataset/samples/{deviceId}`. Labels come from the operator — never from the
model's own predictions.

Contract consumed by `src/services/ml/mlService.ts`:

- `POST /predict {features}` → `{class, confidence, probabilities, contributions, modelVersion}`
- `GET /model` → name, version, trainedAt, metrics, confusionMatrix, featureImportance, samples, labelDistribution

With no API configured the app uses `DemoClassifier` — a transparent centroid
heuristic that reports `connected: false` and **no metrics at all**, so the
AI Model page shows **MODEL NOT CONNECTED** instead of fabricated accuracy.

### Dataset format

Collected locally from this mat (no internet dataset). Export from
**AI Model → Dataset → Export CSV**:

```
timestamp,peakVoltage,averageVoltage,pulseDuration,stepInterval,storageVoltage,label
2026-10-05T10:42:31Z,3.84,1.72,238,1.41,4.18,NORMAL
```

Units: volts, milliseconds, seconds. Labels: `LIGHT | NORMAL | HEAVY`.

---

## 7. Technical honesty

Provenance is a first-class UI concept — every figure carries a tag:

| Tag | Meaning |
|---|---|
| MEASURED | ESP32 ADC reading (voltages, RSSI, GPIO, step count) |
| CALCULATED | arithmetic on measurements (V×I, averages, success rate) |
| ESTIMATED | modelled: `E = ½CV²` stored, `V²/R_eq·t` per step |
| PREDICTED | classifier output, always with confidence |
| DEMO / SIMULATED | produced by demo mode |
| UNAVAILABLE | hardware does not measure it → rendered "Not measured" |

Consequences that are enforced in code, not just copy:

- `current`, `power` and `measured_energy_j` are `null` end-to-end until a
  current-sense front-end exists. Power is derived **only** when current is present.
- Model accuracy/precision/recall/F1 and the confusion matrix render only when a
  trained model supplies them.
- Feature "contributions" from the heuristic are labelled as heuristic; real
  importances appear only from the trained model.
- Anomaly detection is called **Anomaly Detection** (rule-based z-score/envelope
  checks), never "AI anomaly detection".
- The Energy Performance Score is labelled a project-defined index.
- CSV exports carry a provenance header and leave unmeasured columns empty.

---

## 8. Architecture

```
            Human Footstep
                  |
       Piezoelectric Mat (27 mm array)
                  |
       Bridge Rectifier (1N4007 x4)
                  |
        Supercapacitor (5.5 V)  --->  XL6009 Boost  --->  IRF520  --->  LED / Fan
                  |                                          ^
          Voltage Divider                                    |
                  |                                   GPIO 25 / 26
             ESP32 ADC 34/35                                 |
                  |                                          |
        Envelope detection + hysteresis                      |
                  |                                          |
               Wi-Fi / HTTPS                                 |
                  |                                          |
        Firebase Realtime Database  <-- loads/{k}/command ---+
                  |                     loads/{k}/actualState
        +---------+---------+
        |                   |
   Web Dashboard      ML Service (FastAPI)
   (React + Vite)     RandomForest /predict
```

Current sensing (INA219) is **absent**, which is why accumulated harvested
energy is never reported as measured — only capacitor energy *estimated* from
voltage.



```
src/
  data/        types.ts (full TS contract) · mockSource · liveSource · store.tsx · energy.ts
  services/
    firebase/  config · telemetryService · deviceService · historyService · alertService
    ml/        mlService.ts (DemoClassifier | RemoteModel)
  components/  ui · charts · cards · layout
  pages/       Overview · Live · Analytics · AIInsights · AIModel · History · Health · Settings · Login
  lib/         export.ts (CSV/report)
firmware/      ESP32 reference sketch
ml-service/    FastAPI inference + training script
```

- One listener per stream, torn down on unmount/mode switch.
- Heavy stats memoised; Firebase SDK dynamically imported (separate chunk, never
  downloaded in demo mode).
- History queries are bounded server-side (`orderByKey` + range + `limitToLast`).

Navigation: Overview · Live Monitoring · Footstep Analytics · Energy Analytics ·
AI Insights · AI Model · History · System Health · Settings.

---

## 9. Security model

**Authentication is real, not decorative.** The rules deny everything by
default and require `auth != null` for every read and write, so the dashboard
performs an actual Firebase email/password sign-in (`authService.ts`). If
Firebase is not configured the app runs in demo mode behind a gate that is
clearly labelled *"DEMO ACCESS — not a security boundary"*.

Create the dashboard user in **Firebase Console → Authentication → Users**, and
enable **Email/Password** under Sign-in method.

### Authorisation model

Two allow-lists live under `config/`, writable only from the Firebase console:

```json
{
  "config": {
    "deviceOwners": { "ESP32-01": { "<device-or-admin-uid>": true } },
    "modelPublishers": { "<training-pipeline-uid>": true }
  }
}
```

| Path | Read | Write |
| --- | --- | --- |
| `telemetry/{id}`, `footstepEvents/{id}` | any signed-in user | device owner only, **append-only** |
| `devices/{id}/loads/{k}/command` | any signed-in user | any signed-in user |
| `devices/{id}/loads/{k}/actualState` | any signed-in user | **device owner only** |
| `dataset/samples/{id}` | any signed-in user | any signed-in user |
| `modelMetadata` | any signed-in user | model publishers only |
| `config/**` | any signed-in user | **nobody** (console only) |

Why this matters academically: because only the device may write `actualState`,
a user cannot forge "the LED is on". Because history is append-only
(`!data.exists()`), past telemetry cannot be rewritten to flatter the results.

Every field is range-validated at the database layer, mirroring
`validatePayload()` in the frontend — so a rogue client cannot inject a 999 V
reading even if it bypasses the UI.

### Deploying the rules

```bash
firebase deploy --only database
```

### Rules are automatically tested — 33/33 passing

The rules are not just written, they are **executed against the real Firebase
Realtime Database emulator**:

```bash
cd tests/rules && npm install && npm test      # requires Java 11+
```

Covered: unauthenticated denial (5), authenticated reads/writes (5), device
ownership (3), payload range validation (7), append-only history (4), dataset
label validation (4), config lock-down (4), undeclared paths (1).

Representative assertions that actually pass:

| Assertion | Result |
| --- | --- |
| Anonymous read of telemetry | DENIED |
| Signed-in user writes `loads/led/command` | ALLOWED |
| Signed-in user forges `loads/led/actualState` | **DENIED** |
| Non-owner device writes telemetry | DENIED |
| `peakVoltage: 999` from the real owner | DENIED |
| Overwrite or delete an existing footstep event | DENIED |
| Dataset label `MEDIUM` | DENIED |
| Any user writing `config/**` | DENIED |

A bug was found this way: the original rules file had top-level `_comment`
keys, which the RTDB parser rejects with *"Expected 'rules' property"*. It
would have failed to deploy. Comments were removed and the suite now passes.

### ESP32 authentication (token refresh)

Firebase ID tokens expire after about one hour, so a hardcoded token stops
working mid-run. The firmware therefore performs a real sign-in flow:

```
signInWithPassword (Identity Toolkit REST)
      -> idToken (valid ~1 h) + refreshToken (long-lived)
securetoken.googleapis.com/v1/token
      -> new idToken, renewed 5 minutes before expiry, forever
```

`ensureAuth()` runs before every database request. A `401`/`403` clears the
token so the next cycle re-authenticates automatically.

Setup:

1. Firebase Console → Authentication → Users → add `esp32-01@stepcharge.local`.
2. Copy that user's UID.
3. In the database set `config/deviceOwners/ESP32-01/<uid> = true`.
4. Put the email, password and web API key in `secrets.h`.

**Legacy fallback.** Leaving `DEVICE_EMAIL` empty makes the sketch use
`FIREBASE_AUTH` as a raw database secret. That is an *admin* credential which
**bypasses every security rule**; the firmware prints a warning on boot. Use it
only on a closed bench.

**ML service.** CORS is restricted to the configured origins. `/train` is
unauthenticated and therefore must not be exposed to the public internet;
keep it on localhost or behind a reverse proxy with auth.

---

### Dependency audit

`npm audit` reports 9 high-severity advisories. None of them reach the
shipped application, and npm's suggested "fix" is a **downgrade** to
`firebase@9.14.0`, which would be worse. Evidence:

| Advisory | Reaches production? | Evidence |
| --- | --- | --- |
| `@grpc/grpc-js`, `@firebase/firestore` | **No** | Firestore is never imported (only `firebase/app`, `/auth`, `/database`); `grep grpc dist/assets/` returns nothing |
| `braces`, `micromatch`, `chokidar`, `fast-glob` | **No** | Build-time only: `npm ls --omit=dev` lists none of them |

Re-check after any dependency change:

```bash
npm ls --omit=dev braces micromatch chokidar fast-glob   # expect "(empty)"
grep -rl grpc dist/assets/                                # expect no output
```

---

## 10. Hardware

Actually present in this prototype:

| Component | Role |
| --- | --- |
| 27 mm piezoelectric discs | Energy transduction (wired as one array) |
| 1N4007 diodes | Bridge rectification |
| 5.5 V supercapacitor | Energy storage |
| XL6009 | Boost converter |
| IRF520 modules | Low-side load switching (LED, fan) |
| ESP32 DevKit | Sampling, detection, Wi-Fi, load control |
| 5 V DC fan, LEDs | Demonstration loads |
| 16×2 LCD, acrylic base, breadboard, jumpers | Enclosure / local display |

**Not present** — and therefore not claimed anywhere in the UI:

| Missing | Consequence |
| --- | --- |
| INA219 / INA226 current sensor | Current, power and *accumulated harvested energy* are **NOT MEASURED** |
| Per-element piezo wiring | Only the aggregate **Piezo Array Output** is observable |
| Hardware over-voltage clamp | The firmware's `MAX_STORAGE_VOLTAGE` guard is software-only — a TVS/zener or shunt regulator is still required |

### Firmware detection parameters

| Constant | Value | Purpose |
| --- | --- | --- |
| `STEP_THRESHOLD_V` | 0.80 V | Rising edge of a footstep |
| `STEP_RELEASE_V` | 0.55 V | Falling edge — the gap is hysteresis |
| `MIN_PULSE_MS` | 60 ms | Below this it is electrical noise |
| `MAX_PULSE_MS` | 2000 ms | Above this someone is standing still |
| `REFRACTORY_MS` | 250 ms | Blocks re-triggering on the same step |
| `EMA_SHIFT` | 2 | Low-pass smoothing (÷4) |
| `MAX_STORAGE_VOLTAGE` | 5.00 V | Over-voltage guard (5.5 V part) |
| `LOW_STORAGE_VOLTAGE` | 2.00 V | Below this loads cannot run |

Hysteresis + refractory period are what prevent one physical footstep being
counted several times as the signal rings down.

---

## 11. Known limitations

1. **No current sensing.** Power and energy remain *estimates* (½CV² and V×I
   only when current exists). Fit an INA219 and publish `current` to upgrade them
   to measured values.
2. **Supercapacitor charge is approximate.** The UI says "Approx. Voltage Level",
   not state-of-charge: terminal voltage ignores ESR, leakage and temperature.
3. **Per-element piezo diagnostics** are simulated in demo mode. In live mode the
   UI shows "Individual sensor diagnostics unavailable" unless the firmware
   publishes `devices/{id}/piezoArray`.
4. **Uptime is DEVICE REPORTED**; packet counts and the last-packet gap are
   **DASHBOARD CALCULATED** for the current browser session only and reset on
   reload. The System Health page labels which is which.
5. **Login is a prototype gate**, not Firebase Auth. Do not expose it publicly.
6. **No trained model ships with the repo.** Until you train one, the AI Model
   page shows MODEL NOT TRAINED and the dashboard falls back to a transparent
   heuristic labelled DEMO PREDICTION — it is not machine learning.
7. **Rule-based anomaly detection**, not an anomaly ML model: fixed z-score and
   threshold rules, named explicitly in the Alerts feed.
8. **The "Energy Performance Score" is a project-defined metric**, not a standard
   efficiency figure.
9. **Load confirmation depends on firmware readback.** `digitalRead()` on an
   output pin confirms the GPIO level, not that current actually flows through
   the MOSFET or that the LED physically lit.
10. **UI rendering was not verified in a browser in the authoring environment**
    (no browser available); the build, type-check, lint and logic tests pass, and
    the dev server starts, but you should click through it once yourself.

---

## 12. Test plan and recorded results

Run date 2026-10-05, in a Linux sandbox with **no ESP32, no Firebase project and
no physical mat**. Results are recorded exactly as observed.

| # | Test | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Firmware compiles for ESP32 | **PASS** | `arduino-cli compile --fqbn esp32:esp32:esp32` → 81% flash, 14% RAM, **0 warnings** |
| 1b | Firmware compiles with token-refresh auth | **PASS** | Recompiled after the auth rewrite: 1 065 901 bytes, 0 warnings |
| 1c | ESP32 token refresh works against Firebase | **NOT TESTABLE** | Requires hardware + a real project |
| 1d | Feature ablation tool runs | **PASS** | `feature_study.py` produced a side-by-side verdict (on synthetic data) |
| 1e | `npm ci` clean install | **PASS** | Completed without errors |
| 1f | Dependency audit triaged | **PASS** | 9 advisories, none reaching production — evidence in §9 |
| 2 | ESP32 boots / joins Wi-Fi | **NOT TESTABLE** | Requires hardware |
| 3 | Firebase connection | **NOT TESTABLE** | Requires project credentials |
| 4 | Piezo voltage detected | **NOT TESTABLE** | Requires hardware |
| 5 | One footstep = one event | **NOT TESTABLE** | Hysteresis + refractory implemented and code-reviewed, not bench-verified |
| 6 | Storage voltage updates | **NOT TESTABLE** | Requires hardware |
| 7 | Telemetry normalisation | **PASS** | Unclassified ⇒ `UNKNOWN`/`null`; uptime passed through |
| 8 | Payload validation | **PASS** | Rejects avg>peak, 999 V, missing `deviceId`; accepts valid packet |
| 9 | current/power never invented | **PASS** | Both remain `null` without a sensor |
| 10 | Load command ≠ actual state | **PASS** | Command applies instantly; `actualState` only after device ack |
| 11 | Load ON/OFF reaches hardware | **NOT TESTABLE** | Requires ESP32 |
| 12 | `GET /health` | **PASS** | `{"modelLoaded": false}` → `true` after training |
| 13 | `GET /model` untrained | **PASS** | `MODEL NOT TRAINED`, `metrics: null` |
| 14 | `POST /predict` untrained | **PASS** | HTTP 503 `MODEL_NOT_CONNECTED` |
| 15 | `POST /predict` malformed | **PASS** | HTTP 422 on negative voltage and on missing features |
| 16 | `POST /train` | **PASS** | Real metrics, 3×3 matrix, 5 importances |
| 17 | Subject-independent evaluation | **PASS** | 5 participants ⇒ `subject-independent-group-kfold` |
| 18 | Subject-dependent fallback warns | **PASS** | No participants ⇒ `random-split-subject-dependent` + explicit warning |
| 19 | Dataset validation | **PASS** | Dropped duplicate id, non-numeric, bad label, out-of-range, avg>peak |
| 20 | Tiny dataset rejected | **PASS** | HTTP 422 `DATASET_REJECTED` |
| 21 | Corrupt model artifact | **PASS** | `/reload` reports error, service stays up, `/predict` → 503 |
| 22 | `POST /reload` | **PASS** | `{"reloaded": true}` |
| 23 | CSV export shape | **PASS** | Header matches trainer, participantId included |
| 24 | Demo classifier honesty | **PASS** | `connected:false`, `metrics:null`, label `DEMO PREDICTION` |
| 25 | No fake values in Live mode | **PARTIAL** | Code paths verified + grep audit clean; not exercised against a live empty database |
| 26 | Security rules reject bad writes | **PASS** | **33/33 assertions against the RTDB emulator** — see `tests/rules/` |
| 27 | TypeScript compile | **PASS** | `tsc -b` clean |
| 28 | Lint | **PASS** | oxlint 0 errors, 10 accepted warnings |
| 29 | Production build | **PASS** | 846 kB / 243 kB gzip |
| 30 | Dev server serves app | **PASS** | HTTP 200 on `:5173` |
| 31 | Browser click-through of all 10 pages | **NOT TESTABLE** | No browser in the authoring environment (Playwright install failed) |

### Reproducing the automated tests

```bash
# frontend
npx tsc -b && npx oxlint src && npm run build

# ML service
cd ml-service && python train_model.py --csv your-dataset.csv --version v1.0
```

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Dashboard stuck on "WAITING FOR LIVE DEVICE DATA" | No telemetry at `telemetry/{id}/latest` | Check `VITE_DEVICE_ID` matches `DEVICE_ID` in the sketch |
| `permission_denied` in the console | Rules require auth; not signed in | Sign in; confirm the user exists in Firebase Auth |
| ESP32 logs `[FIREBASE] write failed code=401` | Bad `FIREBASE_AUTH` or UID not in `config/deviceOwners` | Add the device UID to the allow-list |
| Loads show "NOT REPORTED" | Firmware never wrote `actualState` | Confirm fw ≥ 1.3.0 and that `[LOAD]` lines appear on serial |
| AI Model shows MODEL NOT TRAINED | No `model.joblib` | Train, then `POST /reload` |
| Browser CORS error calling ML API | Origin not allow-listed | Set `ALLOWED_ORIGINS` in `ml-service/.env` |
| One stomp counted as several steps | Thresholds not tuned to your mat | Raise `STEP_RELEASE_V` / `REFRACTORY_MS` |
| Steps missed entirely | Threshold too high | Lower `STEP_THRESHOLD_V`; check divider ratio |
