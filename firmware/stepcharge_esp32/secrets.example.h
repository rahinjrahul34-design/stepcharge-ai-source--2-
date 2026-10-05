// Copy to secrets.h (git-ignored) and fill in. NEVER commit real credentials.

#define WIFI_SSID        "your-ssid"
#define WIFI_PASSWORD    "your-password"

// Realtime Database host, without https:// and without a trailing slash.
#define FIREBASE_HOST    "your-project-default-rtdb.firebaseio.com"

// Web API key: Firebase Console -> Project settings -> General.
// Not a secret, but needed for the Identity Toolkit REST endpoints.
#define FIREBASE_API_KEY "your-web-api-key"

// ---------------------------------------------------------------------------
// RECOMMENDED: a dedicated device account created in
// Firebase Console -> Authentication -> Users.
// Add its UID to config/deviceOwners/<DEVICE_ID> in the database so the
// security rules allow it to publish telemetry and report load state.
// The sketch signs in with these and refreshes the ID token automatically.
// ---------------------------------------------------------------------------
#define DEVICE_EMAIL     "esp32-01@stepcharge.local"
#define DEVICE_PASSWORD  "a-strong-device-password"

// ---------------------------------------------------------------------------
// LEGACY FALLBACK ONLY. Leave DEVICE_EMAIL as "" to use this instead.
// A database secret is an ADMIN credential that BYPASSES ALL SECURITY RULES.
// Acceptable on a closed bench; never for a deployed system.
// ---------------------------------------------------------------------------
#define FIREBASE_AUTH    ""
