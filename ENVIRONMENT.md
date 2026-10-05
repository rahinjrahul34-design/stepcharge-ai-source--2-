# StepCharge AI — Environment Variables Reference

This document provides a comprehensive reference of all environment variables used by the backend, frontend, and ML microservice.

---

## 1. Backend (`backend/.env`)

| Variable | Type | Required | Default | Description |
|---|---|---|---|---|
| `PORT` | Integer | No | `5000` | Port on which the Express REST API and Socket.IO server listen. |
| `NODE_ENV` | String | No | `development` | Runtime environment (`development`, `production`, `test`). |
| `FRONTEND_URL` | String | Yes | `http://localhost:5173` | Allowed CORS origin and OAuth redirect target. |
| `MONGODB_URI` | String | Yes | `mongodb://localhost:27017/stepcharge` | MongoDB Atlas SRV connection string or local MongoDB URI. |
| `JWT_SECRET` | String | Yes | *Required in Prod* | Secret used to sign session JWTs. Must be $\ge 32$ characters. |
| `SESSION_COOKIE_NAME` | String | No | `stepcharge_session` | Name of the HTTP-only cookie storing the session token. |
| `SESSION_MAX_AGE_MS` | Integer | No | `604800000` | Session lifetime in milliseconds (default: 7 days). |
| `GOOGLE_CLIENT_ID` | String | Yes | — | Google Cloud OAuth 2.0 Web Client ID. |
| `GOOGLE_CLIENT_SECRET` | String | Yes | — | Google Cloud OAuth 2.0 Web Client Secret (Confidential). |
| `GOOGLE_CALLBACK_URL` | String | Yes | `http://localhost:5000/api/auth/google/callback` | Authorized redirect URI configured in Google Cloud Console. |
| `ML_SERVICE_URL` | String | No | `http://localhost:8000` | Address of the Python FastAPI inference microservice. |
| `INITIAL_ADMIN_EMAIL` | String | No | — | Email automatically granted `ADMIN` role upon first Google login. |
| `DEFAULT_DEVICE_ID` | String | No | `ESP32-01` | Default hardware identifier seeded or queried. |

---

## 2. Frontend (`.env` / `.env.local`)

| Variable | Type | Required | Default | Description |
|---|---|---|---|---|
| `VITE_API_URL` | String | Yes | `http://localhost:5000/api` | Base URL for REST API calls. |
| `VITE_SOCKET_URL` | String | Yes | `http://localhost:5000` | Base URL for Socket.IO WebSocket connections. |
| `VITE_DEVICE_ID` | String | No | `ESP32-01` | Default device selected on dashboard load. |
| `VITE_ML_API_URL` | String | No | — | Optional direct ML API endpoint (leave empty to route through backend). |

> [!WARNING]
> Never include `GOOGLE_CLIENT_SECRET` or `MONGODB_URI` in frontend `.env` files. Variables prefixed with `VITE_` are bundled directly into public client-side JavaScript.

---

## 3. ML Service (`ml-service/.env`)

| Variable | Type | Required | Default | Description |
|---|---|---|---|---|
| `PORT` | Integer | No | `8000` | Port for the Uvicorn FastAPI server. |
| `MODEL_PATH` | String | No | `artifacts/stepcharge_model.joblib` | Path to serialized Scikit-learn model artifact. |
