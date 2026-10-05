// StepCharge AI — ESP32 Firmware Configuration
// Copy to secrets.h (git-ignored) and fill in. NEVER commit real credentials.

#define WIFI_SSID        "your-ssid"
#define WIFI_PASSWORD    "your-password"

// Backend API Base URL (without trailing slash)
// In local development: "http://192.168.1.100:5000"
// In production HTTPS:  "https://api.stepcharge.yourdomain.com"
#define BACKEND_BASE_URL "http://192.168.1.100:5000"

// ---------------------------------------------------------------------------
// DEVICE API KEY AUTHENTICATION
// Generated during device registration (e.g. POST /api/devices or in MongoDB).
// Sent in the HTTP header "X-Device-Key: <DEVICE_API_KEY>"
// The backend verifies the SHA-256 hash. Never put database or Google secrets here.
// ---------------------------------------------------------------------------
#define DEVICE_API_KEY   "sc_live_your_device_key_here"
