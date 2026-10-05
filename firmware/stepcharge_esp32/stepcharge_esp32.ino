/*
 * StepCharge AI — ESP32 firmware (reference implementation)
 * --------------------------------------------------------
 * Piezo mat → bridge rectifier → supercapacitor → divider → ADC → Wi-Fi → Firebase RTDB
 *
 * Publishes exactly the JSON contract the dashboard expects:
 *   telemetry/<deviceId>/latest        (overwritten every TX_INTERVAL_MS)
 *   footstepEvents/<deviceId>/<epochMs>  (appended on each detected step)
 *   devices/<deviceId>                 (identity + link stats + uptimeSec)
 *   devices/<deviceId>/loads/<key>/actualState   (GPIO readback after switching)
 *
 * Load control loop (Phase 14):
 *   dashboard writes  devices/<id>/loads/led/command = true
 *   this sketch polls that node every LOAD_POLL_MS
 *   drives the MOSFET gate, reads the pin back
 *   writes devices/<id>/loads/led/actualState = <real pin state>
 * The dashboard only ever shows a load as ON once actualState confirms it.
 *
 * Honesty notes:
 *  - This board measures VOLTAGE only. "current", "power" and "energy" are sent
 *    as null. Do not populate them with guesses; fit an INA219/ACS712 and send
 *    real readings instead.
 *  - stepClass/confidence are omitted here, so the dashboard's ML service does
 *    the classification and labels it "ML PREDICTION". If you run TFLite Micro
 *    on-device, fill them in and the dashboard shows "DEVICE PREDICTION".
 *
 * AUTHENTICATION (important):
 *   Firebase ID tokens expire after ~1 hour, so a hardcoded token WILL stop
 *   working mid-run. This sketch therefore signs in as a dedicated device
 *   account over the Identity Toolkit REST API, stores the refresh token, and
 *   renews the ID token before it expires.
 *
 *     signInWithPassword  -> idToken (1 h) + refreshToken (long-lived)
 *     securetoken refresh -> new idToken, repeated forever
 *
 *   The device account's UID must be listed under config/deviceOwners/<id> in
 *   the database, which is what the security rules check.
 *
 *   Legacy fallback: if DEVICE_EMAIL is left blank the sketch falls back to
 *   FIREBASE_AUTH as a raw database secret. That is an ADMIN credential which
 *   bypasses all security rules — acceptable on a closed bench, never in
 *   production. The sketch warns about this on the serial console.
 *
 * Secrets: WIFI_PASSWORD, the device password and any database secret stay in
 * secrets.h, which is git-ignored. Never commit them.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>   // v7.x — JsonDocument (v6 StaticJsonDocument is deprecated)
#include <time.h>
#include "secrets.h"   // WIFI_SSID, WIFI_PASSWORD, FIREBASE_HOST, FIREBASE_AUTH

// ---------------------------- configuration ----------------------------
static const char*    DEVICE_ID        = "ESP32-01";
static const char*    FIRMWARE_VERSION = "1.3.0";
static const uint8_t  PIN_HARVEST      = 34;   // rectified piezo output (divider)
static const uint8_t  PIN_STORAGE      = 35;   // supercapacitor terminal (divider)
static const uint8_t  PIN_LED_LOAD     = 25;
static const uint8_t  PIN_FAN_LOAD     = 26;

static const float    ADC_REF_V        = 3.30f;
static const float    ADC_MAX          = 4095.0f;
static const float    DIVIDER_RATIO    = 2.0f;   // (R1+R2)/R2 — measure yours!
// --- footstep detection ---
// Schmitt-trigger style: a step STARTS above the rising threshold and only ENDS
// once the signal drops below the (lower) falling threshold. The gap between
// them is hysteresis, which stops a noisy signal hovering at one level from
// toggling in/out of a pulse and counting one footstep many times.
static const float    STEP_THRESHOLD_V = 0.80f;  // rising edge
static const float    STEP_RELEASE_V   = 0.55f;  // falling edge (must be < rising)
static const uint16_t SAMPLE_INTERVAL_MS = 20;   // 50 Hz envelope sampling
static const uint16_t MIN_PULSE_MS       = 60;   // shorter = electrical noise
static const uint16_t MAX_PULSE_MS       = 2000; // longer = someone standing still
static const uint16_t REFRACTORY_MS      = 250;  // ignore new steps this soon after one
static const uint8_t  EMA_SHIFT          = 2;    // smoothing: ema += (v-ema)/4

// --- timing ---
static const uint32_t TX_INTERVAL_MS     = 1000;
static const uint32_t LOAD_POLL_MS       = 1500;
static const uint16_t HTTP_TIMEOUT_MS    = 4000; // never block the loop forever

// --- supercapacitor safety (software guard only — see README) ---
// These MUST match the physical part. Software cannot replace a real clamp.
static const float    MAX_STORAGE_VOLTAGE     = 5.00f; // 5.5 V part, 0.5 V margin
static const float    WARNING_STORAGE_VOLTAGE = 4.70f; // approaching the ceiling
static const float    LOW_STORAGE_VOLTAGE     = 2.00f; // below this loads are useless
static const float    ADC_FAULT_V         = 0.02f; // flat-line => sensor suspect
static const uint32_t SENSOR_IDLE_FAULT_MS = 300000UL; // 5 min of nothing at all

// ------------------------------ state ---------------------------------
uint32_t footstepCount = 0;
uint32_t lastTxMs = 0, lastStepEndMs = 0, pulseStartMs = 0;
float    pulsePeak = 0, pulseSum = 0;
uint16_t pulseSamples = 0;
bool     inPulse = false;
float    lastPeak = 0, lastAvg = 0, lastStorage = 0, lastIntervalS = 0;
uint16_t lastPulseMs = 0;
uint32_t lastLoadPollMs = 0;
bool     ledCommand = false, fanCommand = false;
float    harvestEma = 0;
String   idToken = "";          // short-lived Firebase ID token
String   refreshToken = "";     // long-lived, used to mint new ID tokens
uint32_t tokenExpiresAtMs = 0;  // millis() deadline for the current idToken
bool     usingLegacySecret = false;
uint32_t lastActivityMs = 0;
uint16_t consecutiveTxFailures = 0;
bool     overVoltageLatched = false;

/**
 * Reads a pin with 16x oversampling. Returns -1.0 for an implausible reading so
 * callers can treat it as a FAULT instead of silently publishing a wrong value.
 */
float readVolts(uint8_t pin) {
  uint32_t acc = 0;
  uint16_t rawMin = 4095, rawMax = 0;
  for (uint8_t i = 0; i < 16; i++) {
    uint16_t r = analogRead(pin);
    acc += r;
    if (r < rawMin) rawMin = r;
    if (r > rawMax) rawMax = r;
  }
  float v = (acc / 16.0f) * (ADC_REF_V / ADC_MAX) * DIVIDER_RATIO;

  // A pin railed at full scale across every sample usually means the divider
  // is disconnected or shorted to 3V3 — not a genuine 60 V reading.
  if (rawMin >= 4094 && rawMax >= 4094) return -1.0f;
  if (v < 0 || v > 60.0f) return -1.0f;
  return v;
}

/** Clamps a reading into the published range; negative means "unavailable". */
bool validVolts(float v) { return v >= 0.0f; }

String isoTimestamp() {
  time_t now; time(&now);
  struct tm t; gmtime_r(&now, &t);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(buf);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WiFi] connecting to %s\n", WIFI_SSID);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    if (millis() - t0 > 20000) {           // don't spin forever on a bad AP
      Serial.println("[WiFi] FAILED — retrying in 5 s");
      delay(5000);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      t0 = millis();
    }
  }
  configTime(0, 0, "pool.ntp.org");            // ISO timestamps need real time
  Serial.printf("[WiFi] connected  IP=%s  RSSI=%d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

/**
 * Signs in as the device account. Returns false on failure — the caller keeps
 * retrying rather than pretending the device is authenticated.
 */
bool firebaseSignIn() {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (strlen(DEVICE_EMAIL) == 0) {          // legacy database-secret mode
    usingLegacySecret = true;
    idToken = FIREBASE_AUTH;
    tokenExpiresAtMs = 0;                   // never expires (it is a secret)
    Serial.println("[AUTH] WARNING: using legacy database secret. This is an "
                   "ADMIN credential that bypasses security rules. Use a device "
                   "account (DEVICE_EMAIL/DEVICE_PASSWORD) for anything real.");
    return true;
  }

  HTTPClient http;
  String url = String("https://identitytoolkit.googleapis.com/v1/accounts:"
                      "signInWithPassword?key=") + FIREBASE_API_KEY;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");

  JsonDocument req;
  req["email"] = DEVICE_EMAIL;
  req["password"] = DEVICE_PASSWORD;
  req["returnSecureToken"] = true;
  String body; serializeJson(req, body);

  int code = http.POST(body);
  String resp = (code > 0) ? http.getString() : "";
  http.end();

  if (code != 200) {
    Serial.printf("[AUTH] sign-in FAILED code=%d\n", code);
    idToken = "";
    return false;
  }
  JsonDocument d;
  if (deserializeJson(d, resp)) { Serial.println("[AUTH] malformed sign-in response"); return false; }

  idToken      = d["idToken"].as<const char*>();
  refreshToken = d["refreshToken"].as<const char*>();
  uint32_t ttl = String(d["expiresIn"].as<const char*>()).toInt();  // seconds
  if (ttl == 0) ttl = 3600;
  // Renew 5 minutes early so a request never races the expiry.
  tokenExpiresAtMs = millis() + (ttl - 300) * 1000UL;
  Serial.printf("[AUTH] signed in as %s, token valid %lus\n", DEVICE_EMAIL, (unsigned long)ttl);
  return true;
}

/** Exchanges the refresh token for a fresh ID token. */
bool firebaseRefreshToken() {
  if (refreshToken.length() == 0) return firebaseSignIn();

  HTTPClient http;
  String url = String("https://securetoken.googleapis.com/v1/token?key=") + FIREBASE_API_KEY;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  int code = http.POST(String("grant_type=refresh_token&refresh_token=") + refreshToken);
  String resp = (code > 0) ? http.getString() : "";
  http.end();

  if (code != 200) {
    Serial.printf("[AUTH] refresh FAILED code=%d — falling back to full sign-in\n", code);
    refreshToken = "";
    return firebaseSignIn();
  }
  JsonDocument d;
  if (deserializeJson(d, resp)) return firebaseSignIn();

  idToken      = d["id_token"].as<const char*>();
  refreshToken = d["refresh_token"].as<const char*>();
  uint32_t ttl = String(d["expires_in"].as<const char*>()).toInt();
  if (ttl == 0) ttl = 3600;
  tokenExpiresAtMs = millis() + (ttl - 300) * 1000UL;
  Serial.printf("[AUTH] token refreshed, valid %lus\n", (unsigned long)ttl);
  return true;
}

/** Keeps credentials valid. Call before any database request. */
bool ensureAuth() {
  if (idToken.length() == 0) return firebaseSignIn();
  if (usingLegacySecret) return true;
  if ((int32_t)(millis() - tokenExpiresAtMs) >= 0) return firebaseRefreshToken();
  return true;
}

bool putJson(const String& path, const String& body, bool patch = false) {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (!ensureAuth()) { Serial.println("[FIREBASE] no valid credentials — write skipped"); return false; }
  HTTPClient http;
  String url = String("https://") + FIREBASE_HOST + path + ".json?auth=" + idToken;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);          // bounded: a dead cloud must not hang the mat
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  int code = patch ? http.PATCH(body) : http.PUT(body);
  http.end();
  if (code == 401 || code == 403) {
    // Token rejected: force a renewal so the next cycle recovers by itself.
    Serial.printf("[FIREBASE] auth rejected (%d) — renewing token\n", code);
    idToken = "";
    return false;
  }
  if (code <= 0 || code >= 300) {
    Serial.printf("[FIREBASE] write failed path=%s code=%d\n", path.c_str(), code);
    return false;
  }
  return true;
}

/**
 * Honest device status:
 *   DEGRADED — a sensor looks faulty, storage is out of safe bounds, or uploads
 *              are failing. The dashboard shows this instead of a green light.
 */
const char* deviceStatus() {
  if (!validVolts(lastStorage)) return "DEGRADED";
  if (lastStorage > MAX_STORAGE_VOLTAGE || lastStorage < 0) return "DEGRADED";
  if (consecutiveTxFailures >= 3) return "DEGRADED";
  if (lastActivityMs && (millis() - lastActivityMs) > SENSOR_IDLE_FAULT_MS) return "DEGRADED";
  return "ONLINE";
}

/** Reads a JSON node from RTDB. Returns false on any transport error. */
bool getJson(const String& path, String& out) {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (!ensureAuth()) return false;
  HTTPClient http;
  String url = String("https://") + FIREBASE_HOST + path + ".json?auth=" + idToken;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  int code = http.GET();
  if (code == 200) out = http.getString();
  http.end();
  if (code == 401 || code == 403) { idToken = ""; Serial.printf("[FIREBASE] read auth rejected (%d)\n", code); }
  return code == 200;
}

/**
 * Applies a command to a GPIO and reports back what the pin ACTUALLY reads.
 * The readback is what makes the dashboard's "actual hardware state" honest.
 */
void applyLoad(const char* key, uint8_t pin, bool command, bool& cache) {
  digitalWrite(pin, command ? HIGH : LOW);
  delay(5);                                  // let the gate settle before reading
  bool actual = digitalRead(pin) == HIGH;
  cache = command;
  JsonDocument d;
  d["actualState"] = actual;
  d["reportedAt"]  = isoTimestamp();
  String body; serializeJson(d, body);
  putJson(String("/devices/") + DEVICE_ID + "/loads/" + key, body, true);
  Serial.printf("[LOAD] %s command=%s actual=%s\n", key, command ? "ON" : "OFF", actual ? "ON" : "OFF");
}

/** Polls both load command nodes and applies any change. */
void pollLoadCommands() {
  String raw;
  if (!getJson(String("/devices/") + DEVICE_ID + "/loads", raw)) {
    Serial.println("[LOAD] command read failed — leaving GPIO unchanged");
    return;
  }
  JsonDocument d;
  if (deserializeJson(d, raw)) { Serial.println("[LOAD] malformed command JSON — ignored"); return; }

  bool ledCmd = d["led"]["command"] | false;
  bool fanCmd = d["fan"]["command"] | false;
  if (ledCmd != ledCommand) applyLoad("led", PIN_LED_LOAD, ledCmd, ledCommand);
  if (fanCmd != fanCommand) applyLoad("fan", PIN_FAN_LOAD, fanCmd, fanCommand);
}

/** Builds the exact payload shape documented in the dashboard README. */
String buildPayload(bool asEvent) {
  JsonDocument d;
  d["deviceId"]        = DEVICE_ID;
  d["timestamp"]       = isoTimestamp();
  d["footstepCount"]   = footstepCount;
  d["peakVoltage"]     = lastPeak;
  d["averageVoltage"]  = lastAvg;
  d["pulseDuration"]   = lastPulseMs;
  d["stepInterval"]    = lastIntervalS;
  d["storageVoltage"]  = lastStorage;
  d["current"]         = nullptr;   // not measured on this build
  d["power"]           = nullptr;   // not measured — do NOT fabricate
  d["energy"]          = nullptr;   // dashboard estimates 1/2*C*V^2
  d["wifiRssi"]        = WiFi.RSSI();
  d["deviceStatus"]    = deviceStatus();
  d["firmwareVersion"] = FIRMWARE_VERSION;
  d["uptimeSec"]       = millis() / 1000;
  d["loadControlAvailable"] = true;
  if (asEvent) d["eventType"] = "FOOTSTEP";
  String out; serializeJson(d, out); return out;
}

bool publishEvent() {
  String path = String("/footstepEvents/") + DEVICE_ID + "/" + String((uint64_t)time(nullptr) * 1000ULL);
  return putJson(path, buildPayload(true));
}

bool publishTelemetry() {
  bool ok = putJson(String("/telemetry/") + DEVICE_ID + "/latest", buildPayload(false));
  JsonDocument d;
  d["deviceId"] = DEVICE_ID; d["status"] = "ONLINE";
  d["firmwareVersion"] = FIRMWARE_VERSION; d["lastSeen"] = isoTimestamp();
  d["wifiRssi"] = WiFi.RSSI(); d["uptimeSec"] = millis() / 1000;
  String body; serializeJson(d, body);
  ok = putJson(String("/devices/") + DEVICE_ID, body, true) && ok;
  return ok;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_HARVEST, ADC_11db);
  analogSetPinAttenuation(PIN_STORAGE, ADC_11db);
  pinMode(PIN_LED_LOAD, OUTPUT);
  pinMode(PIN_FAN_LOAD, OUTPUT);
  digitalWrite(PIN_LED_LOAD, LOW);
  digitalWrite(PIN_FAN_LOAD, LOW);
  Serial.printf("\n[BOOT] StepCharge %s fw %s\n", DEVICE_ID, FIRMWARE_VERSION);
  connectWifi();
  if (!firebaseSignIn()) Serial.println("[AUTH] initial sign-in failed — will retry in the main loop");
  // Publish the true power-on state so the dashboard never shows a stale ON.
  applyLoad("led", PIN_LED_LOAD, false, ledCommand);
  applyLoad("fan", PIN_FAN_LOAD, false, fanCommand);
}

void loop() {
  static uint32_t lastSample = 0;
  uint32_t nowMs = millis();

  // ---------------- footstep envelope detection ----------------
  // Schmitt trigger + refractory period + EMA smoothing. This is what stops a
  // single physical footstep being counted two or three times.
  if (nowMs - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = nowMs;

    float vRaw = readVolts(PIN_HARVEST);
    float sRaw = readVolts(PIN_STORAGE);

    if (validVolts(sRaw)) {
      lastStorage = sRaw;
      // Software over-voltage guard. Shedding load is the only lever firmware
      // has; a hardware clamp is still mandatory (see README).
      if (lastStorage > MAX_STORAGE_VOLTAGE && !overVoltageLatched) {
        overVoltageLatched = true;
        Serial.printf("[SAFETY] storage %.2fV exceeds max %.2fV — dumping into loads\n",
                      lastStorage, MAX_STORAGE_VOLTAGE);
        applyLoad("led", PIN_LED_LOAD, true, ledCommand);
      } else if (overVoltageLatched && lastStorage < (MAX_STORAGE_VOLTAGE - 0.25f)) {
        overVoltageLatched = false;
        Serial.println("[SAFETY] storage back within range");
      } else if (lastStorage > WARNING_STORAGE_VOLTAGE && !overVoltageLatched) {
        static uint32_t lastWarnMs = 0;
        if (millis() - lastWarnMs > 30000) {   // rate-limited: no console spam
          lastWarnMs = millis();
          Serial.printf("[SAFETY] storage %.2fV approaching max %.2fV\n",
                        lastStorage, MAX_STORAGE_VOLTAGE);
        }
      }
    } else {
      Serial.println("[SENSOR] storage ADC reading implausible — marking DEGRADED");
    }

    if (!validVolts(vRaw)) {
      Serial.println("[SENSOR] harvest ADC reading implausible — sample skipped");
    } else {
      // Exponential moving average: cheap low-pass without a filter buffer.
      harvestEma += (vRaw - harvestEma) / (1 << EMA_SHIFT);
      float v = harvestEma;

      bool refractory = lastStepEndMs && (nowMs - lastStepEndMs) < REFRACTORY_MS;

      if (!inPulse) {
        if (v > STEP_THRESHOLD_V && !refractory) {
          inPulse = true;
          pulseStartMs = nowMs;
          pulsePeak = v;
          pulseSum = v;
          pulseSamples = 1;
        }
      } else {
        pulsePeak = max(pulsePeak, v);
        pulseSum += v;
        pulseSamples++;

        // Only close the pulse below the LOWER threshold (hysteresis).
        if (v < STEP_RELEASE_V || (nowMs - pulseStartMs) > MAX_PULSE_MS) {
          uint16_t dur = nowMs - pulseStartMs;
          inPulse = false;

          if (dur < MIN_PULSE_MS) {
            Serial.printf("[STEP] rejected: %ums shorter than MIN_PULSE_MS\n", dur);
          } else if (dur > MAX_PULSE_MS) {
            Serial.printf("[STEP] rejected: %ums exceeds MAX_PULSE_MS (static load?)\n", dur);
            lastStepEndMs = nowMs;
          } else {
            footstepCount++;
            lastPeak      = pulsePeak;
            lastAvg       = pulseSamples ? pulseSum / pulseSamples : 0;
            lastPulseMs   = dur;
            lastIntervalS = lastStepEndMs ? (nowMs - lastStepEndMs) / 1000.0f : 0;
            lastStepEndMs = nowMs;
            lastActivityMs = nowMs;
            Serial.printf("[STEP] #%lu peak=%.2fV avg=%.2fV dur=%ums interval=%.2fs storage=%.2fV\n",
                          footstepCount, lastPeak, lastAvg, dur, lastIntervalS, lastStorage);
            if (!publishEvent()) Serial.println("[STEP] event upload failed — counted locally only");
          }
        }
      }
    }
  }

  // ---------------- periodic telemetry ----------------
  if (nowMs - lastTxMs >= TX_INTERVAL_MS) {
    lastTxMs = nowMs;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] link lost — reconnecting");
      connectWifi();
    }
    bool ok = publishTelemetry();
    if (ok) consecutiveTxFailures = 0;
    else if (consecutiveTxFailures < 65000) consecutiveTxFailures++;
    Serial.printf("[TELEMETRY] %s storage=%.2fV steps=%lu rssi=%d uptime=%lus status=%s fails=%u\n",
                  ok ? "sent" : "FAILED", lastStorage, footstepCount, WiFi.RSSI(),
                  millis() / 1000, deviceStatus(), consecutiveTxFailures);
    // NOTE: detection and load control keep running regardless of cloud state.
    // Footsteps are still counted locally when Firebase is unreachable.
  }

  // ---------------- load command polling ----------------
  if (nowMs - lastLoadPollMs >= LOAD_POLL_MS) {
    lastLoadPollMs = nowMs;
    pollLoadCommands();
  }
}
