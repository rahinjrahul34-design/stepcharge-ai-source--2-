/*
 * StepCharge AI — Research-Grade ESP32 Firmware (Phase 2 Architecture)
 * --------------------------------------------------------------------------
 * Piezo Mat -> Bridge Rectifier -> Supercapacitor -> Divider -> ADC -> Wi-Fi -> Node.js REST API
 * Optional Current Sensing: INA219 / INA226 over I2C (Pins 21 SDA, 22 SCL)
 *
 * REST Endpoints Consumed:
 *   POST /api/devices/{DEVICE_ID}/telemetry      (periodic telemetry stream + sequence numbers)
 *   POST /api/devices/{DEVICE_ID}/footsteps      (detected footstep events + waveform capture)
 *   GET  /api/devices/{DEVICE_ID}/loads          (poll load switch commands)
 *   POST /api/devices/{DEVICE_ID}/load-state     (report confirmed physical GPIO readback)
 *   GET  /api/devices/{DEVICE_ID}/config         (poll remote desired configuration)
 *   POST /api/devices/{DEVICE_ID}/config-status  (report applied/rejected configuration status)
 *
 * Academic Honesty & Measurement Principles (Phase 2):
 *  - Distinguishes MEASURED, ESTIMATED, and UNAVAILABLE.
 *  - Voltage is MEASURED via calibrated 16x oversampled ADC.
 *  - Current and Power are MEASURED when an I2C current sensor is physically present.
 *    If no current sensor is installed, current, power, and measured energy are transmitted
 *    as null; NEVER fabricated or defaulted to zero.
 *  - Supercapacitor energy is ESTIMATED via E = 1/2 * C * V^2 by backend.
 *  - Firmware enforces local hardware safety limits even if remote config is invalid.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>   // v7.x — JsonDocument
#include <Wire.h>
#include <time.h>
#include "secrets.h"       // WIFI_SSID, WIFI_PASSWORD, BACKEND_BASE_URL, DEVICE_API_KEY

// ---------------------------- Hardware Pinout ----------------------------
static const char*    DEVICE_ID            = "ESP32-01";
static const char*    FIRMWARE_VERSION     = "2.1.0";
static const uint8_t  PIN_HARVEST          = 34;   // Rectified piezo harvester input (divider)
static const uint8_t  PIN_STORAGE          = 35;   // Supercapacitor terminal (divider)
static const uint8_t  PIN_LED_LOAD         = 25;   // Demo LED load gate
static const uint8_t  PIN_FAN_LOAD         = 26;   // Demo Fan load gate
static const uint8_t  PIN_I2C_SDA          = 21;   // I2C Current Sensor SDA
static const uint8_t  PIN_I2C_SCL          = 22;   // I2C Current Sensor SCL

// ---------------------------- ADC & Divider Constants --------------------
static const float    ADC_REF_V            = 3.30f;
static const float    ADC_MAX              = 4095.0f;
static const float    DEFAULT_DIVIDER      = 2.0f;   // (R1 + R2) / R2

// ---------------------------- Runtime Active Configuration ---------------
struct RuntimeConfig {
  uint16_t sampleIntervalMs;
  uint32_t telemetryIntervalMs;
  float    stepThresholdV;
  float    stepReleaseV;
  uint16_t minPulseMs;
  uint16_t maxPulseMs;
  uint16_t refractoryMs;
  float    storageMaxSafeV;
  float    storageWarnV;
  float    storageLowV;
  float    voltageScale;
  float    voltageOffset;
  float    currentScale;
  float    currentOffset;
  float    supercapFarads;
  uint32_t version;
};

// Initial safe factory defaults
static RuntimeConfig activeConfig = {
  .sampleIntervalMs    = 20,
  .telemetryIntervalMs = 1000,
  .stepThresholdV      = 0.80f,
  .stepReleaseV        = 0.55f,
  .minPulseMs          = 60,
  .maxPulseMs          = 2000,
  .refractoryMs        = 250,
  .storageMaxSafeV     = 5.00f,
  .storageWarnV        = 4.70f,
  .storageLowV         = 2.00f,
  .voltageScale        = 1.00f,
  .voltageOffset       = 0.00f,
  .currentScale        = 1.00f,
  .currentOffset       = 0.00f,
  .supercapFarads      = 0.10f,
  .version             = 1
};

// ---------------------------- Hardware Safety Ceilings -------------------
static const float    HARDWARE_MAX_SAFE_VOLTAGE = 5.50f; // Absolute component limit
static const uint16_t MIN_SAFE_SAMPLE_INTERVAL  = 5;     // ADC cycle floor
static const uint32_t CONFIG_POLL_INTERVAL_MS   = 5000;  // Poll config every 5s
static const uint32_t LOAD_POLL_INTERVAL_MS     = 1500;  // Poll loads every 1.5s
static const uint16_t HTTP_TIMEOUT_MS           = 3500;  // Non-blocking network timeout

// ---------------------------- Footstep Waveform Buffer -------------------
static const uint8_t  WAVEFORM_CAPACITY         = 60;    // 60 samples @ 50 Hz = 1.2s window
float                 waveformBuffer[WAVEFORM_CAPACITY];
uint8_t               waveformCount             = 0;

// ---------------------------- Current Sensor Abstraction -----------------
bool                  currentSensorInstalled    = false;
float                 lastMeasuredCurrentMa     = -1.0f; // negative = unmeasured/unavailable
float                 lastMeasuredPowerMw       = -1.0f; // negative = unmeasured/unavailable
float                 accumulatedEnergyJoules   = 0.0f;
uint32_t              lastEnergyIntegrationMs   = 0;

// ---------------------------- Operational State --------------------------
uint32_t              telemetrySequence         = 0;
uint32_t              footstepSequence          = 0;
uint32_t              footstepCount             = 0;
uint32_t              lastTxMs                  = 0;
uint32_t              lastStepEndMs             = 0;
uint32_t              pulseStartMs              = 0;
float                 pulsePeak                 = 0.0f;
float                 pulseSum                  = 0.0f;
uint16_t              pulseSamples              = 0;
bool                  inPulse                   = false;

float                 lastPeak                  = 0.0f;
float                 lastAvg                   = 0.0f;
float                 lastStorage               = 0.0f;
float                 lastIntervalS             = 0.0f;
uint16_t              lastPulseMs               = 0;

uint32_t              lastLoadPollMs            = 0;
uint32_t              lastConfigPollMs          = 0;
bool                  ledCommand                = false;
bool                  fanCommand                = false;
float                 harvestEma                = 0.0f;
uint32_t              lastActivityMs            = 0;
uint16_t              consecutiveTxFailures     = 0;
bool                  overVoltageLatched        = false;

// Forward Declarations
bool postApi(const String& path, const String& body, String* responseOut = nullptr);
bool getApi(const String& path, String& responseOut);
void applyLoad(const char* key, uint8_t pin, bool command, bool& cache);

// ---------------------------- Voltage Measurement ------------------------
/**
 * Reads an analog pin with 16x oversampling and applies calibration.
 */
float readCalibratedVolts(uint8_t pin) {
  uint32_t acc = 0;
  uint16_t rawMin = 4095, rawMax = 0;

  for (uint8_t i = 0; i < 16; i++) {
    uint16_t r = analogRead(pin);
    acc += r;
    if (r < rawMin) rawMin = r;
    if (r > rawMax) rawMax = r;
  }

  // Railing check: continuous full-scale indicates disconnected divider or short
  if (rawMin >= 4094 && rawMax >= 4094) return -1.0f;

  float rawVoltage = (acc / 16.0f) * (ADC_REF_V / ADC_MAX) * DEFAULT_DIVIDER;

  // Calibrated voltage formula: actual = (raw * scale) + offset
  float calibrated = (rawVoltage * activeConfig.voltageScale) + activeConfig.voltageOffset;
  if (calibrated < 0.0f) calibrated = 0.0f;
  if (calibrated > 60.0f) return -1.0f; // Exceeds physical bounds

  return calibrated;
}

bool validVolts(float v) {
  return v >= 0.0f && v <= 60.0f;
}

// ---------------------------- Optional Current Sensor --------------------
/**
 * Initializes optional INA219/INA226 current sensor over I2C.
 * If sensor is not physically detected, gracefully flags as uninstalled.
 */
void initCurrentSensor() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.beginTransmission(0x40); // Standard INA219 / INA226 address
  if (Wire.endTransmission() == 0) {
    currentSensorInstalled = true;
    Serial.println("[SENSOR] INA Current Sensor detected at I2C address 0x40.");
  } else {
    currentSensorInstalled = false;
    Serial.println("[SENSOR] No I2C Current Sensor detected. Operating in voltage-only mode.");
  }
}

/**
 * Polls the current sensor if installed.
 */
void pollCurrentSensor() {
  if (!currentSensorInstalled) {
    lastMeasuredCurrentMa = -1.0f;
    lastMeasuredPowerMw   = -1.0f;
    return;
  }

  // Read shunt voltage from I2C register 0x01
  Wire.beginTransmission(0x40);
  Wire.write(0x01);
  if (Wire.endTransmission() != 0 || Wire.requestFrom(0x40, 2) != 2) {
    lastMeasuredCurrentMa = -1.0f;
    lastMeasuredPowerMw   = -1.0f;
    return;
  }

  int16_t rawShunt = (Wire.read() << 8) | Wire.read();
  float rawCurrentMa = rawShunt * 0.1f; // 100uV LSB across 0.1 ohm shunt = 1mA / 10 = 0.1mA

  // Apply calibration scale & offset
  float calCurrentMa = (rawCurrentMa * activeConfig.currentScale) + activeConfig.currentOffset;
  if (calCurrentMa < 0.0f) calCurrentMa = 0.0f;

  lastMeasuredCurrentMa = calCurrentMa;

  // Real Power = V * I
  if (validVolts(lastStorage)) {
    lastMeasuredPowerMw = lastStorage * lastMeasuredCurrentMa; // V * mA = mW
    
    // Numerical integration of real energy: E = sum(P * dt) in Joules
    uint32_t now = millis();
    if (lastEnergyIntegrationMs > 0 && now > lastEnergyIntegrationMs) {
      float dtSec = (now - lastEnergyIntegrationMs) / 1000.0f;
      float powerWatts = lastMeasuredPowerMw / 1000.0f;
      accumulatedEnergyJoules += (powerWatts * dtSec);
    }
    lastEnergyIntegrationMs = now;
  }
}

// ---------------------------- Time & Network -----------------------------
String isoTimestamp() {
  time_t now;
  time(&now);
  struct tm t;
  gmtime_r(&now, &t);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(buf);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WiFi] Connecting to %s...\n", WIFI_SSID);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    if (millis() - t0 > 20000) {
      Serial.println("[WiFi] Connection timeout. Retrying...");
      delay(2000);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      t0 = millis();
    }
  }
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.printf("[WiFi] Connected! IP: %s | RSSI: %d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

const char* deviceStatus() {
  if (!validVolts(lastStorage)) return "DEGRADED";
  if (lastStorage > activeConfig.storageMaxSafeV || lastStorage < 0) return "DEGRADED";
  if (consecutiveTxFailures >= 3) return "DEGRADED";
  return "ONLINE";
}

// ---------------------------- HTTP Helpers -------------------------------
bool postApi(const String& path, const String& body, String* responseOut) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + path;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.addHeader("X-Device-Id", DEVICE_ID);

  int code = http.POST(body);
  if (code > 0 && responseOut != nullptr) {
    *responseOut = http.getString();
  }
  http.end();

  return (code >= 200 && code < 300);
}

bool getApi(const String& path, String& responseOut) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + path;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.addHeader("X-Device-Id", DEVICE_ID);

  int code = http.GET();
  if (code == 200) {
    responseOut = http.getString();
  }
  http.end();

  return (code == 200);
}

// ---------------------------- Load Control -------------------------------
void applyLoad(const char* key, uint8_t pin, bool command, bool& cache) {
  digitalWrite(pin, command ? HIGH : LOW);
  delay(5); // Settle gate
  bool actual = (digitalRead(pin) == HIGH);
  cache = command;

  JsonDocument d;
  d["load"]        = key;
  d["actualState"] = actual;
  d["reportedAt"]  = isoTimestamp();
  String body;
  serializeJson(d, body);

  postApi(String("/api/devices/") + DEVICE_ID + "/load-state", body);
  Serial.printf("[LOAD] %s command=%s -> confirmed actual=%s\n",
                key, command ? "ON" : "OFF", actual ? "ON" : "OFF");
}

void pollLoadCommands() {
  String response;
  if (!getApi(String("/api/devices/") + DEVICE_ID + "/loads", response)) return;

  JsonDocument doc;
  if (deserializeJson(doc, response)) return;

  JsonObject loads = doc["data"].is<JsonObject>() ? doc["data"].as<JsonObject>() : doc.as<JsonObject>();
  bool ledCmd = loads["led"]["command"] | false;
  bool fanCmd = loads["fan"]["command"] | false;

  if (ledCmd != ledCommand) applyLoad("led", PIN_LED_LOAD, ledCmd, ledCommand);
  if (fanCmd != fanCommand) applyLoad("fan", PIN_FAN_LOAD, fanCmd, fanCommand);
}

// ---------------------------- Remote Configuration -----------------------
/**
 * Reports configuration application result back to the backend.
 */
void reportConfigStatus(uint32_t version, const char* status, const char* reason = nullptr) {
  JsonDocument d;
  d["appliedVersion"] = version;
  d["status"]         = status;
  if (reason) d["rejectionReason"] = reason;
  String body;
  serializeJson(d, body);

  postApi(String("/api/devices/") + DEVICE_ID + "/config-status", body);
  Serial.printf("[CONFIG] Version %lu reported status: %s (%s)\n",
                version, status, reason ? reason : "Applied");
}

/**
 * Polls for remote configuration updates, performs local hardware safety checks,
 * applies valid settings, or rolls back with an explicit rejection reason.
 */
void pollRemoteConfiguration() {
  String response;
  if (!getApi(String("/api/devices/") + DEVICE_ID + "/config", response)) return;

  JsonDocument doc;
  if (deserializeJson(doc, response)) return;

  JsonObject cfg = doc["data"]["desired"].is<JsonObject>()
                     ? doc["data"]["desired"].as<JsonObject>()
                     : doc["data"].as<JsonObject>();

  if (cfg.isNull()) return;

  uint32_t incomingVersion = cfg["version"] | 0;
  if (incomingVersion <= activeConfig.version) return; // Already synchronized

  Serial.printf("[CONFIG] Received pending config v%lu. Validating...\n", incomingVersion);

  // --- Strict Local Hardware Safety Validation ---
  float maxSafeV = cfg["storageMaxSafeVoltage"] | activeConfig.storageMaxSafeV;
  if (maxSafeV > HARDWARE_MAX_SAFE_VOLTAGE) {
    reportConfigStatus(incomingVersion, "REJECTED", "storageMaxSafeVoltage exceeds hardware ceiling (5.5V)");
    return;
  }

  uint16_t sampleInterval = cfg["samplingIntervalMs"] | activeConfig.sampleIntervalMs;
  if (sampleInterval < MIN_SAFE_SAMPLE_INTERVAL) {
    reportConfigStatus(incomingVersion, "REJECTED", "samplingIntervalMs below minimum safe ADC cycle (5ms)");
    return;
  }

  float stepThreshold = cfg["stepThresholdVoltage"] | activeConfig.stepThresholdV;
  float stepRelease   = cfg["stepReleaseVoltage"]   | activeConfig.stepReleaseV;
  if (stepRelease >= stepThreshold) {
    reportConfigStatus(incomingVersion, "REJECTED", "stepReleaseVoltage must be lower than stepThresholdVoltage");
    return;
  }

  uint16_t minPulse = cfg["minPulseDurationMs"] | activeConfig.minPulseMs;
  uint16_t maxPulse = cfg["maxPulseDurationMs"] | activeConfig.maxPulseMs;
  if (minPulse >= maxPulse) {
    reportConfigStatus(incomingVersion, "REJECTED", "minPulseDurationMs must be less than maxPulseDurationMs");
    return;
  }

  // --- Configuration is Valid: Apply Locally ---
  activeConfig.sampleIntervalMs    = sampleInterval;
  activeConfig.telemetryIntervalMs = cfg["telemetryIntervalMs"]    | activeConfig.telemetryIntervalMs;
  activeConfig.stepThresholdV      = stepThreshold;
  activeConfig.stepReleaseV        = stepRelease;
  activeConfig.minPulseMs          = minPulse;
  activeConfig.maxPulseMs          = maxPulse;
  activeConfig.refractoryMs        = cfg["refractoryPeriodMs"]     | activeConfig.refractoryMs;
  activeConfig.storageMaxSafeV     = maxSafeV;
  activeConfig.storageWarnV        = cfg["storageWarningVoltage"]   | activeConfig.storageWarnV;
  activeConfig.storageLowV         = cfg["storageLowVoltage"]       | activeConfig.storageLowV;
  activeConfig.voltageScale        = cfg["voltageCalibrationScale"] | activeConfig.voltageScale;
  activeConfig.voltageOffset       = cfg["voltageCalibrationOffset"]| activeConfig.voltageOffset;
  activeConfig.currentScale        = cfg["currentCalibrationScale"] | activeConfig.currentScale;
  activeConfig.currentOffset       = cfg["currentCalibrationOffset"]| activeConfig.currentOffset;
  activeConfig.supercapFarads      = cfg["supercapFarads"]          | activeConfig.supercapFarads;
  activeConfig.version             = incomingVersion;

  reportConfigStatus(incomingVersion, "SYNCHRONIZED");
  Serial.printf("[CONFIG] Successfully applied and synchronized configuration v%lu\n", activeConfig.version);
}

// ---------------------------- Telemetry & Footsteps ----------------------
String buildTelemetryPayload() {
  JsonDocument d;
  d["deviceId"]             = DEVICE_ID;
  d["timestamp"]            = isoTimestamp();
  d["sequenceNumber"]       = ++telemetrySequence;
  d["configurationVersion"] = activeConfig.version;
  d["footstepCount"]        = footstepCount;
  d["peakVoltage"]          = lastPeak;
  d["averageVoltage"]       = lastAvg;
  d["pulseDuration"]        = lastPulseMs;
  d["stepInterval"]         = lastIntervalS;
  d["storageVoltage"]       = lastStorage;

  // Real Current & Power: Send actual value if measured, or null if unmeasured
  if (currentSensorInstalled && lastMeasuredCurrentMa >= 0.0f) {
    d["current"]               = lastMeasuredCurrentMa / 1000.0f; // Amperes
    d["power"]                 = lastMeasuredPowerMw / 1000.0f;   // Watts
    d["energy"]                = accumulatedEnergyJoules;         // Joules
    d["currentQuality"]        = "MEASURED";
    d["powerQuality"]          = "MEASURED";
    d["measurementQuality"]    = "VALID";
  } else {
    d["current"]               = nullptr; // Explicitly unmeasured
    d["power"]                 = nullptr; // Explicitly unmeasured
    d["energy"]                = nullptr; // Backend calculates stored energy via 1/2*C*V^2
    d["currentQuality"]        = currentSensorInstalled ? "SENSOR_DISCONNECTED" : "NOT_INSTALLED";
    d["powerQuality"]          = "NOT_AVAILABLE";
    d["measurementQuality"]    = "VALID";
  }

  d["wifiRssi"]             = WiFi.RSSI();
  d["deviceStatus"]         = deviceStatus();
  d["firmwareVersion"]      = FIRMWARE_VERSION;
  d["uptimeSec"]            = millis() / 1000;
  d["loadControlAvailable"] = true;

  String out;
  serializeJson(d, out);
  return out;
}

String buildFootstepPayload() {
  JsonDocument d;
  d["deviceId"]             = DEVICE_ID;
  d["timestamp"]            = isoTimestamp();
  d["sequenceNumber"]       = ++footstepSequence;
  d["peakVoltage"]          = lastPeak;
  d["averageVoltage"]       = lastAvg;
  d["pulseDuration"]        = lastPulseMs;
  d["stepInterval"]         = lastIntervalS;
  d["storageVoltage"]       = lastStorage;
  d["samplingRate"]         = 1000 / activeConfig.sampleIntervalMs;

  // Real waveform samples captured during pulse
  JsonArray wf = d["waveform"].to<JsonArray>();
  for (uint8_t i = 0; i < waveformCount; i++) {
    wf.add(waveformBuffer[i]);
  }

  // Include electrical measurements if current sensor installed
  if (currentSensorInstalled && lastMeasuredCurrentMa >= 0.0f) {
    d["current"]            = lastMeasuredCurrentMa / 1000.0f;
    d["power"]              = lastMeasuredPowerMw / 1000.0f;
    d["measuredEnergyJ"]    = accumulatedEnergyJoules;
    d["measurementQuality"] = "VALID";
  } else {
    d["current"]            = nullptr;
    d["power"]              = nullptr;
    d["measuredEnergyJ"]    = nullptr;
    d["measurementQuality"] = "VALID";
  }

  String out;
  serializeJson(d, out);
  return out;
}

bool publishTelemetry() {
  return postApi(String("/api/devices/") + DEVICE_ID + "/telemetry", buildTelemetryPayload());
}

bool publishFootstep() {
  return postApi(String("/api/devices/") + DEVICE_ID + "/footsteps", buildFootstepPayload());
}

// ---------------------------- Arduino Setup ------------------------------
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_HARVEST, ADC_11db);
  analogSetPinAttenuation(PIN_STORAGE, ADC_11db);

  pinMode(PIN_LED_LOAD, OUTPUT);
  pinMode(PIN_FAN_LOAD, OUTPUT);
  digitalWrite(PIN_LED_LOAD, LOW);
  digitalWrite(PIN_FAN_LOAD, LOW);

  Serial.printf("\n========================================\n");
  Serial.printf("StepCharge AI Research Firmware v%s\n", FIRMWARE_VERSION);
  Serial.printf("Device ID: %s | Target: %s\n", DEVICE_ID, BACKEND_BASE_URL);
  Serial.printf("========================================\n");

  initCurrentSensor();
  connectWifi();

  // Initialize load states
  applyLoad("led", PIN_LED_LOAD, false, ledCommand);
  applyLoad("fan", PIN_FAN_LOAD, false, fanCommand);

  // Initial config sync check
  pollRemoteConfiguration();
}

// ---------------------------- Arduino Main Loop --------------------------
void loop() {
  static uint32_t lastSample = 0;
  uint32_t nowMs = millis();

  // ---------------- 1. Footstep Envelope & Waveform Sampling -------------
  if (nowMs - lastSample >= activeConfig.sampleIntervalMs) {
    lastSample = nowMs;

    float vRaw = readCalibratedVolts(PIN_HARVEST);
    float sRaw = readCalibratedVolts(PIN_STORAGE);

    if (validVolts(sRaw)) {
      lastStorage = sRaw;

      // Software over-voltage emergency safety guard
      if (lastStorage > activeConfig.storageMaxSafeV && !overVoltageLatched) {
        overVoltageLatched = true;
        Serial.printf("[SAFETY] Storage %.2fV exceeds max safe %.2fV — dumping to load\n",
                      lastStorage, activeConfig.storageMaxSafeV);
        applyLoad("led", PIN_LED_LOAD, true, ledCommand);
      } else if (overVoltageLatched && lastStorage < (activeConfig.storageMaxSafeV - 0.25f)) {
        overVoltageLatched = false;
        Serial.println("[SAFETY] Storage restored within safe operating range.");
      }
    }

    if (validVolts(vRaw)) {
      // Exponential Moving Average filter for noise suppression
      harvestEma += (vRaw - harvestEma) / 4.0f;
      float v = harvestEma;

      bool refractory = lastStepEndMs && (nowMs - lastStepEndMs) < activeConfig.refractoryMs;

      if (!inPulse) {
        if (v > activeConfig.stepThresholdV && !refractory) {
          inPulse       = true;
          pulseStartMs  = nowMs;
          pulsePeak     = v;
          pulseSum      = v;
          pulseSamples  = 1;
          waveformCount = 0;
          if (waveformCount < WAVEFORM_CAPACITY) {
            waveformBuffer[waveformCount++] = v;
          }
        }
      } else {
        pulsePeak = max(pulsePeak, v);
        pulseSum += v;
        pulseSamples++;

        // Append to footstep waveform buffer
        if (waveformCount < WAVEFORM_CAPACITY) {
          waveformBuffer[waveformCount++] = v;
        }

        // Hysteresis release check
        if (v < activeConfig.stepReleaseV || (nowMs - pulseStartMs) > activeConfig.maxPulseMs) {
          uint16_t dur = nowMs - pulseStartMs;
          inPulse = false;

          if (dur >= activeConfig.minPulseMs && dur <= activeConfig.maxPulseMs) {
            footstepCount++;
            lastPeak      = pulsePeak;
            lastAvg       = pulseSamples ? (pulseSum / pulseSamples) : 0;
            lastPulseMs   = dur;
            lastIntervalS = lastStepEndMs ? ((nowMs - lastStepEndMs) / 1000.0f) : 0;
            lastStepEndMs = nowMs;
            lastActivityMs= nowMs;

            // Poll current sensor during step to associate real power
            pollCurrentSensor();

            Serial.printf("[STEP] #%lu peak=%.2fV avg=%.2fV dur=%ums wfSamples=%u\n",
                          footstepCount, lastPeak, lastAvg, dur, waveformCount);

            if (!publishFootstep()) {
              Serial.println("[STEP] Failed to publish footstep event to backend.");
            }
          } else {
            lastStepEndMs = nowMs;
          }
        }
      }
    }
  }

  // ---------------- 2. Periodic Current & Power Measurement --------------
  pollCurrentSensor();

  // ---------------- 3. Periodic Telemetry Stream -------------------------
  if (nowMs - lastTxMs >= activeConfig.telemetryIntervalMs) {
    lastTxMs = nowMs;

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Lost link. Reconnecting...");
      connectWifi();
    }

    bool ok = publishTelemetry();
    if (ok) {
      consecutiveTxFailures = 0;
    } else if (consecutiveTxFailures < 65000) {
      consecutiveTxFailures++;
    }

    Serial.printf("[TELEMETRY] %s | seq=%lu | Storage: %.2fV | Current: %s | Steps: %lu\n",
                  ok ? "SENT" : "FAILED", telemetrySequence, lastStorage,
                  currentSensorInstalled ? String(lastMeasuredCurrentMa).c_str() : "N/A",
                  footstepCount);
  }

  // ---------------- 4. Load Command Polling ------------------------------
  if (nowMs - lastLoadPollMs >= LOAD_POLL_INTERVAL_MS) {
    lastLoadPollMs = nowMs;
    pollLoadCommands();
  }

  // ---------------- 5. Remote Configuration Synchronization --------------
  if (nowMs - lastConfigPollMs >= CONFIG_POLL_INTERVAL_MS) {
    lastConfigPollMs = nowMs;
    pollRemoteConfiguration();
  }
}
