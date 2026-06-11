#include <HardwareSerial.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

HardwareSerial sim800l(1);   // UART1: RX pin 16, TX pin 17

// ================== OLED Config ==================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define OLED_ADDRESS  0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ================== WiFi & Firebase Config ==================
const char* ssid = "Titus 3:5-7";
const char* password = "toGodbetheglory";

String PROJECT_ID = "hyrdoalert";
String API_KEY = "AIzaSyDk0JrLNQdTU0FKef7RIw1HKxlQk1QzjLE";

// ================== PIN DEFINITIONS ==================
#define TRIG_PIN 18
#define ECHO_PIN 19

// Firestore data
float maxHeight = 4.0;
float normalThreshold = 0.5;
float warningThreshold = 1.9;
float dangerThreshold = 3.2;

String normalMsg  = "System Normal";
String warningMsg = "Warning: Rising Water";
String dangerMsg  = "Danger: Evacuate Now";

String phoneList[30];
int phoneCount = 0;

unsigned long lastFirestoreUpdate = 0;
const unsigned long FIRESTORE_INTERVAL = 60000;

unsigned long lastCheck = 0;
const unsigned long CHECK_INTERVAL = 5000;

unsigned long lastSMSMillis = 0;
const unsigned long SMS_COOLDOWN = 90000;

bool flagWarning = false;
bool flagDanger  = false;

float lastWaterLevel = 0.0;
float lastDistance   = 0.0;
String currentStatus = "Initializing...";

// ================== OLED DISPLAY ==================
void updateDisplay() {
  display.clearDisplay();

  // ---- Row 1: WiFi status ----
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.print("WiFi: Connected");
  } else {
    display.print("WiFi: Disconnected");
  }

  // ---- Divider ----
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  // ---- Row 2: Water Level ----
  display.setCursor(0, 14);
  display.setTextSize(1);
  display.print("Water Level:");

  display.setCursor(0, 24);
  display.setTextSize(2);
  display.print(String(lastWaterLevel, 2) + " m");

  // ---- Row 3: Distance ----
  display.setTextSize(1);
  display.setCursor(0, 42);
  display.print("Dist: " + String(lastDistance, 2) + " m");

  // ---- Divider ----
  display.drawLine(0, 52, 127, 52, SSD1306_WHITE);

  // ---- Row 4: Alert Status ----
  display.setCursor(0, 55);
  display.setTextSize(1);

  // Blink alert text if warning or danger
  if (flagDanger) {
    if ((millis() / 500) % 2 == 0) {
      display.print("!! DANGER !!");
    }
  } else if (flagWarning) {
    if ((millis() / 500) % 2 == 0) {
      display.print("! WARNING !");
    }
  } else {
    display.print("NORMAL");
  }

  display.display();
}

// ====================== SETUP ======================
void setup() {
  Serial.begin(115200);
  sim800l.begin(9600, SERIAL_8N1, 16, 17);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Init OLED
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("❌ SSD1306 OLED not found!");
  } else {
    Serial.println("✓ OLED initialized");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(20, 20);
    display.println("HydroAlert v1.0");
    display.setCursor(20, 35);
    display.println("Starting up...");
    display.display();
  }

  delay(2000);
  Serial.println("=== Flood Monitoring System Starting ===");

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  display.clearDisplay();
  display.setCursor(0, 20);
  display.println("Connecting to WiFi");
  display.display();

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    display.print(".");
    display.display();
  }
  Serial.println("\nWiFi Connected!");

  display.clearDisplay();
  display.setCursor(10, 25);
  display.println("WiFi Connected!");
  display.display();
  delay(1000);

  // Initialize SIM800L
  initSIM800L();

  // Initial load from Firestore
  updateSystemState();
  updateUsersList();
}

// ====================== LOOP ======================
void loop() {
  unsigned long now = millis();

  // Update thresholds and users periodically
  if (now - lastFirestoreUpdate >= FIRESTORE_INTERVAL) {
    updateSystemState();
    updateUsersList();
    lastFirestoreUpdate = now;
  }

  // Check water level
  if (now - lastCheck >= CHECK_INTERVAL) {
    lastCheck = now;

    lastDistance   = getDistance();
    lastWaterLevel = maxHeight - lastDistance;

    Serial.printf("Distance: %.2f m | Water Level: %.2f m\n", lastDistance, lastWaterLevel);

    updateWaterLevel(lastWaterLevel);
    checkAndSendAlert(lastWaterLevel);
  }

  // Refresh OLED every 500ms for blinking effect
  updateDisplay();
  delay(100);
}

// ====================== ULTRASONIC ======================
float getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  float distanceCm = (duration * 0.0343) / 2.0;
  return distanceCm / 100.0;
}

// ====================== FLOOD ALERT LOGIC ======================
void checkAndSendAlert(float waterLevel) {
  unsigned long now = millis();
  String message = "";

  if (waterLevel >= dangerThreshold && !flagDanger && (now - lastSMSMillis > SMS_COOLDOWN)) {
    message = dangerMsg + "\nWater Level: " + String(waterLevel, 2) + " m";
    broadcastSMS(message);
    flagDanger  = true;
    flagWarning = true;
  }
  else if (waterLevel >= warningThreshold && waterLevel < dangerThreshold && !flagWarning && (now - lastSMSMillis > SMS_COOLDOWN)) {
    message = warningMsg + "\nWater Level: " + String(waterLevel, 2) + " m";
    broadcastSMS(message);
    flagWarning = true;
  }
  else if (waterLevel < normalThreshold && (flagWarning || flagDanger)) {
    message = normalMsg + "\nWater Level: " + String(waterLevel, 2) + " m";
    broadcastSMS(message);
    flagWarning = false;
    flagDanger  = false;
  }
}

// ====================== BROADCAST SMS ======================
void broadcastSMS(String msg) {
  Serial.println("=== Broadcasting SMS ===");
  Serial.println(msg);

  for (int i = 0; i < phoneCount; i++) {
    if (phoneList[i].length() > 8) {
      sendSingleSMS(phoneList[i], msg);
      delay(3500);
    }
  }
  lastSMSMillis = millis();
}

void sendSingleSMS(String number, String message) {
  sim800l.println("AT+CMGF=1");
  delay(400);
  sim800l.print("AT+CMGS=\"");
  sim800l.print(number);
  sim800l.println("\"");
  delay(500);
  sim800l.println(message);
  delay(500);
  sim800l.write(26);   // Ctrl+Z
  delay(2500);

  while (sim800l.available()) {
    Serial.write(sim800l.read());
  }
  Serial.println("→ Sent to: " + number);
}

// ====================== FIRESTORE: UPDATE WATER LEVEL ======================
void updateWaterLevel(float waterLevel) {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
               "/databases/(default)/documents/systemState/current?key=" + API_KEY +
               "&updateMask.fieldPaths=waterLevel";

  String body = "{\"fields\":{\"waterLevel\":{\"doubleValue\":" + String(waterLevel, 2) + "}}}";

  for (int attempt = 1; attempt <= 3; attempt++) {
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(5000);

    int httpCode = http.PATCH(body);

    if (httpCode == HTTP_CODE_OK) {
      Serial.printf("✓ waterLevel updated: %.2f m\n", waterLevel);
      http.end();
      return;
    } else {
      Serial.printf("❌ waterLevel PATCH failed (attempt %d/3): %d\n", attempt, httpCode);
      http.end();
      if (attempt < 3) delay(1000);
    }
  }
  Serial.println("⚠ waterLevel update skipped, will retry next cycle.");
}

// ====================== FIRESTORE: SYSTEM STATE ======================
void updateSystemState() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
               "/databases/(default)/documents/systemState/current?key=" + API_KEY;

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    Serial.println("Firestore payload: " + payload);

    DynamicJsonDocument doc(2048);
    deserializeJson(doc, payload);

    JsonObject fields = doc["fields"];

    auto getNumber = [](JsonObject& fields, const char* key, float fallback) -> float {
      if (fields[key]["stringValue"].is<const char*>()) {
        String val = fields[key]["stringValue"].as<String>();
        if (val.length() > 0) return val.toFloat();
      }
      if (fields[key]["doubleValue"].is<float>()) {
        return fields[key]["doubleValue"].as<float>();
      }
      if (fields[key]["integerValue"].is<long>()) {
        return (float)fields[key]["integerValue"].as<long>();
      }
      return fallback;
    };

    maxHeight        = getNumber(fields, "maxHeight",        maxHeight);
    normalThreshold  = getNumber(fields, "normalThreshold",  normalThreshold);
    warningThreshold = getNumber(fields, "warningThreshold", warningThreshold);
    dangerThreshold  = getNumber(fields, "dangerThreshold",  dangerThreshold);

    String tmp = "";

    tmp = fields["normalMessage"]["stringValue"].as<String>();
    if (tmp.length() > 0) normalMsg = tmp;

    tmp = fields["warningMessage"]["stringValue"].as<String>();
    if (tmp.length() > 0) warningMsg = tmp;

    tmp = fields["dangerMessage"]["stringValue"].as<String>();
    if (tmp.length() > 0) dangerMsg = tmp;

    Serial.println("✓ SystemState updated from Firestore");
    Serial.printf("maxHeight=%.2f | normalThreshold=%.2f | warningThreshold=%.2f | dangerThreshold=%.2f\n",
                  maxHeight, normalThreshold, warningThreshold, dangerThreshold);
  } else {
    Serial.printf("❌ SystemState GET failed: %d\n", httpCode);
  }
  http.end();
}

// ====================== FIRESTORE: USERS COLLECTION ======================
void updateUsersList() {
  if (WiFi.status() != WL_CONNECTED) return;

  phoneCount = 0;

  HTTPClient http;
  String url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
               "/databases/(default)/documents/users?key=" + API_KEY + "&pageSize=50";

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(8192);
    deserializeJson(doc, payload);

    JsonArray documents = doc["documents"];

    for (JsonObject docObj : documents) {
      JsonObject fields = docObj["fields"];

      String phone = "";
      if (fields.containsKey("phone")) {
        phone = fields["phone"]["stringValue"].as<String>();
      } else if (fields.containsKey("phoneNumber")) {
        phone = fields["phoneNumber"]["stringValue"].as<String>();
      }

      if (phone.length() > 8 && phoneCount < 30) {
        if (phone.startsWith("0")) {
          phone = "+63" + phone.substring(1);
        } else if (!phone.startsWith("+")) {
          phone = "+63" + phone;
        }
        phoneList[phoneCount++] = phone;
        Serial.println("Added user: " + phone);
      }
    }
    Serial.printf("✓ Loaded %d users from Firestore\n", phoneCount);
  } else {
    Serial.printf("❌ Users collection GET failed: %d\n", httpCode);
  }
  http.end();
}

// ====================== SIM800L INIT ======================
void initSIM800L() {
  sendATCommand("AT", 1000);
  sendATCommand("AT+CMGF=1", 500);
  Serial.println("SIM800L Initialized");
}

void sendATCommand(String cmd, int delayMs) {
  sim800l.println(cmd);
  delay(delayMs);
  while (sim800l.available()) {
    Serial.write(sim800l.read());
  }
}