# ⚡ StepCharge AI
**Smart Footstep Energy Harvesting & Monitoring System**

A production-grade full-stack IoT and AI platform for monitoring piezoelectric footstep energy harvesting, running on **Node.js + Express + TypeScript**, **MongoDB Atlas**, **Google OAuth 2.0**, **Socket.IO**, and an **ESP32 microcontroller** over secure HTTPS REST APIs.

```
Human footstep → Piezoelectric mat → Rectifier → Supercapacitor → Voltage measurement
→ ESP32 → HTTPS REST (X-Device-Key) → Node.js Backend → MongoDB Atlas
→ Socket.IO real-time stream → React + Vite Dashboard → ML classification & load control
```

---

## 🚀 Quick Start (Localhost)

Both the Node.js backend and React frontend are ready to run:

### 1. Frontend Web Dashboard
- **URL**: `http://localhost:5173/`
- Command:
  ```bash
  npm install
  npm run dev
  ```

### 2. Node.js Backend API
- **URL**: `http://localhost:5000/`
- **Health Check**: `http://localhost:5000/api/health`
- Command:
  ```bash
  cd backend
  npm install
  npm run dev
  ```

### 3. Python ML Inference Service (Optional)
- **URL**: `http://localhost:8000/`
- Command:
  ```bash
  cd ml-service
  pip install -r requirements.txt
  uvicorn app:app --port 8000 --reload
  ```

---

## 📌 Architecture Overview

| Layer | Technology | Responsibilities |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Recharts | Real-time monitoring dashboard, Google OAuth login, load control toggle, AI insights, system health |
| **Backend** | Node.js, Express, TypeScript, Socket.IO, Helmet | REST API, Google OAuth session verification, device API key auth (SHA-256), real-time broadcast, audit logging |
| **Database** | MongoDB Atlas (Mongoose) | Persistent storage for users, devices, telemetry, footsteps, alerts, dataset samples, model metadata, and audit logs |
| **Edge IoT** | ESP32 (Arduino C++) | 16x ADC oversampling, EMA filtering, Schmitt trigger footstep detection, load switching, HTTPS REST telemetry |
| **Machine Learning**| Python FastAPI, Scikit-learn, Pandas | Multi-class footstep classification (LIGHT, NORMAL, HEAVY), model training, feature importance analysis |

---

## 🔑 Authentication Architecture

StepCharge AI employs strict, defense-in-depth separation of web user and IoT device authentication:

1. **Web Users (Google OAuth 2.0)**:
   - Server-side token exchange using Google OAuth API.
   - HTTP-only, `SameSite=Lax`, secure JWT session cookies.
   - Zero sensitive credentials stored in `localStorage`.
   - Distinct roles: `USER` and `ADMIN`.
2. **IoT Devices (X-Device-Key)**:
   - ESP32 authenticates via the `X-Device-Key` HTTP header.
   - The backend computes a SHA-256 hash and validates it against `apiKeyHash` in the MongoDB `Device` collection.
   - ESP32 never possesses database connection strings or Google secrets.

---

## 📊 Documentation Suite

For detailed technical documentation, please refer to:

### Core Architecture & Documentation
- [ARCHITECTURE.md](file:///./ARCHITECTURE.md) — End-to-end system dataflow and component diagrams.
- [DATABASE.md](file:///./DATABASE.md) — MongoDB Atlas collection schemas, compound indexes, and queries.
- [API.md](file:///./API.md) — REST API endpoints and Socket.IO real-time event specifications.
- [AUTHENTICATION.md](file:///./AUTHENTICATION.md) — Google OAuth 2.0 flow, session management, and device authentication.
- [SECURITY.md](file:///./SECURITY.md) — Comprehensive security architecture, threat model, and RBAC matrix.
- [RESEARCH.md](file:///./RESEARCH.md) — Academic research methodology, Kruskal-Wallis $H$-test, and correlation framework.
- [ML.md](file:///./ML.md) — Machine learning microservice, GroupKFold CV, and model registry lifecycle.
- [DATASET.md](file:///./DATASET.md) — Dataset sample structure, Data Quality Gate, and immutable freezing.
- [EXPERIMENTS.md](file:///./EXPERIMENTS.md) — Structured trial runner, multi-session comparison, and CSV/JSON export.
- [ANALYTICS.md](file:///./ANALYTICS.md) — Energy intelligence, predictive forecasting, and dual-layer anomaly detection.
- [LIMITATIONS.md](file:///./LIMITATIONS.md) — Transparent physical, transducer, and computational disclosures.
- [TROUBLESHOOTING.md](file:///./TROUBLESHOOTING.md) — Diagnostic commands, common issues, and fast recovery matrix.
- [ESP32_SETUP.md](file:///./ESP32_SETUP.md) — Microcontroller circuit pinout, Arduino IDE flashing, and API keys.
- [ENVIRONMENT.md](file:///./ENVIRONMENT.md) — Complete environment variable reference for all services.
- [DEPLOYMENT.md](file:///./DEPLOYMENT.md) — Docker Compose container orchestration, Nginx reverse proxy, and SSL/TLS.
- [TESTING.md](file:///./TESTING.md) — Complete test suite report (86 Vitest tests + 8 Python pytest tests passing).

### Phase 4 Masterclass Additions
- **Dedicated Full-Screen Presentation Mode (`/presentation`)**: Distraction-free, high-visibility UI designed for laboratory demonstrations and thesis defenses.
- **Kruskal-Wallis Non-Parametric Hypothesis Testing**: Multi-class rank-sum variance test ($H$-statistic, degrees of freedom, $p$-value) across gait dynamics.
- **Pairwise Correlation Engine**: Simultaneous 5x5 Pearson linear and Spearman rank correlation matrices with scientific disclaimer.
- **Multi-Session Experiment Comparison**: Cross-trial evaluation of peak voltage, pulse duration, supercap voltage delta, and energy yield.
- **17-Section Automated Research Report Generator**: Publication-grade Markdown documentation engine with MongoDB live provenance.
- **Production System Heartbeat Monitor**: End-to-end latency waterfall breakdown and packet sequence integrity tracker.

---

## ⚡ Energy Calculation Methodology

StepCharge AI maintains academic rigor regarding piezoelectric energy calculation:

1. **Measured Electrical Energy (Current Sensing Installed)**:
   $$E_{\text{electrical}} = \int P(t) \, dt \approx \sum V_i \cdot I_i \cdot \Delta t$$
   - Tagged as `MEASURED ELECTRICAL ENERGY` (Joules) based on simultaneous ADC storage voltage and I2C shunt current measurements.
   - If current sensor is absent: tagged as `UNAVAILABLE` (`Not measured`), never synthetic zeroes.
2. **Supercapacitor Stored Energy**:
   $$E_{\text{stored}} = \frac{1}{2} C V^2$$
   - Reported as `ESTIMATED STORED ENERGY` (Joules) based on measured capacitor terminal voltage $V$ and capacitance $C$ (default $0.1\,\text{F}$).
   - Clearly designated as capacitive potential storage, **not** harvested electrical energy.
3. **Footstep Oscillogram Waveforms**:
   - 60 instantaneous voltage samples digitized at 50 Hz on impact events.
   - Enables biomechanical gait classification and machine-learning feature extraction.
   - Calculated over the pulse duration $t_{\text{pulse}}$ (ms) across the equivalent load resistance $R_{\text{eq}} = 10,000\,\Omega$.

---

## 🔒 Security Summary

- Zero Firebase dependencies in production.
- No database URIs, Google Client Secrets, or JWT secrets in client-side code.
- Strict CORS whitelist for dashboard origin.
- IP rate limiting on standard (`100/15min`), auth (`10/15min`), and telemetry (`120/min`) endpoints.
- Server-side payload validation using Zod and Mongoose schemas.
- Distinguishes user command intent (`command`) from confirmed microcontroller GPIO status (`actualState`).
