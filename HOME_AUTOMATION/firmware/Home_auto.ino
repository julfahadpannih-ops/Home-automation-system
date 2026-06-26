#define BLYNK_TEMPLATE_ID "TMPL6qy0d4haR"
#define BLYNK_TEMPLATE_NAME "IOT BASE HOME AUTOMATION EEAM"
#define BLYNK_AUTH_TOKEN "YOUR_BLYNK_AUTH_TOKEN"  // Replace with your actual token

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <BlynkSimpleEsp32.h>
#include <UniversalTelegramBot.h>
#include <Adafruit_Sensor.h> // Added dependency for DHT
#include <DHT.h> 

// ---------- WiFi ----------
char ssid[] = "YOUR_WIFI_SSID";      // Replace with your WiFi name
char pass[] = "YOUR_WIFI_PASSWORD";  // Replace with your WiFi password

// ---------- Telegram ----------
#define BOT_TOKEN "YOUR_TELEGRAM_BOT_TOKEN"  // Replace with your BotFather token
#define CHAT_ID   "YOUR_TELEGRAM_CHAT_ID"    // Replace with your Telegram chat ID

WiFiClientSecure client;
UniversalTelegramBot bot(BOT_TOKEN, client);

// ---------- Relay Pins ----------
#define R1 18
#define R2 14
#define R3 15
#define R4 27
#define R5 26
#define R6 25
#define R7 33

// ---------- Sensor Pins & Settings ----------
#define DHTPIN 4       // Digital pin connected to the DHT sensor
#define DHTTYPE DHT22  // DHT 22 
DHT dht(DHTPIN, DHTTYPE);

#define LDRPIN 34      // Analog pin (ADC1) required for ESP32 when WiFi is ON
const int ldrNightThreshold = 2000; // Threshold for analog reading (0-4095 range)

// ---------- States ----------
bool lightState[4] = {0,0,0,0};
bool fanState[3]   = {0,0,0};

// ---------- Previous States ----------
bool prevLightState[4] = {0,0,0,0};
bool prevFanState[3] = {0,0,0};

// Automation trackers to prevent spamming commands
bool isHot = false;
bool isNight = false;

// ---------- Periodic Update ----------
unsigned long lastUpdateTime = 0;
const unsigned long updateInterval = 30UL * 60UL * 1000UL; // 30 minutes

// Sensor update timer
unsigned long lastSensorCheck = 0;
const unsigned long sensorInterval = 5000UL; // INCREASED TO 5 SECONDS for DHT22 stability

// ======================================================
// APPLY STATES TO RELAYS
// ======================================================
void applyStates() {
  digitalWrite(R1, !lightState[0]);
  digitalWrite(R2, !lightState[1]);
  digitalWrite(R3, !lightState[2]);
  digitalWrite(R4, !lightState[3]);
  digitalWrite(R5, !fanState[0]);
  digitalWrite(R6, !fanState[1]);
  digitalWrite(R7, !fanState[2]);
}

// ======================================================
// SMART CHANGE NOTIFICATION
// ======================================================
void sendSmartChanges(String msg) {
  bot.sendMessage(CHAT_ID, msg, "");
}

// ======================================================
// SEND SHORT SUMMARY
// ======================================================
void sendShortSummary() {
  int lightsOn = 0;
  int fansOn = 0;
  for (int i = 0; i < 4; i++) if (lightState[i]) lightsOn++;
  for (int i = 0; i < 3; i++) if (fanState[i]) fansOn++;

  String summary = "Summary:\n";
  summary += "Lights ON: " + String(lightsOn) + "\n";
  summary += "Fans ON: " + String(fansOn);

  bot.sendMessage(CHAT_ID, summary, "");
}

// ======================================================
// CHECK CHANGES + SEND SMART NOTIFICATIONS
// ======================================================
void checkStateChange() {
  String changes = "";
  // Check Lights
  for (int i = 0; i < 4; i++) {
    if (lightState[i] != prevLightState[i]) {
      changes += "Light " + String(i+1) + " → ";
      changes += (lightState[i] ? "ON" : "OFF");
      changes += "\n";
      prevLightState[i] = lightState[i];
    }
  }

  // Check Fans
  for (int i = 0; i < 3; i++) {
    if (fanState[i] != prevFanState[i]) {
      changes += "Fan " + String(i+1) + " → ";
      changes += (fanState[i] ? "ON" : "OFF");
      changes += "\n";
      prevFanState[i] = fanState[i];
    }
  }

  if (changes.length() > 0) {
    sendSmartChanges(changes);
  }
}

// ======================================================
// CHECK IF ANY DEVICE IS ON
// ======================================================
bool isAnyDeviceOn() {
  for (int i = 0; i < 4; i++) if (lightState[i]) return true;
  for (int i = 0; i < 3; i++) if (fanState[i]) return true;
  return false;
}

// ======================================================
// SENSOR CHECK & AUTOMATION LOGIC (FIXED)
// ======================================================
void checkSensorsAndAutomate() {
  if (millis() - lastSensorCheck > sensorInterval) {
    lastSensorCheck = millis();

    // -----------------------------------------
    // 1. DHT22 READING & AUTOMATION
    // -----------------------------------------
    float h = dht.readHumidity();
    yield(); // Prevent ESP32 WiFi watchdog from interrupting the next read
    float t = dht.readTemperature();

    // Check if DHT read failed, but DO NOT return/exit the function
    if (isnan(h) || isnan(t)) {
      Serial.println("Failed to read from DHT sensor! Check wiring/pull-up resistor.");
    } else {
      // Send values to Blynk Dashboard
      Blynk.virtualWrite(V7, t);
      Blynk.virtualWrite(V8, h);

      // Temperature Automation (HOT = FANS ON)
      if (t >= 30.0 && !isHot) {
        isHot = true;
        Serial.println("Auto: High Temp Detected. Fans ON.");
        fanState[0] = 1; fanState[1] = 1; fanState[2] = 1;
        Blynk.virtualWrite(V0, 1); Blynk.virtualWrite(V1, 1); Blynk.virtualWrite(V6, 1);
        applyStates();
        checkStateChange();
      } else if (t < 30.0 && isHot) {
        isHot = false;
        Serial.println("Auto: Temp Normal. Fans OFF.");
        fanState[0] = 0; fanState[1] = 0; fanState[2] = 0;
        Blynk.virtualWrite(V0, 0); Blynk.virtualWrite(V1, 0); Blynk.virtualWrite(V6, 0);
        applyStates();
        checkStateChange();
      }
    }

    // -----------------------------------------
    // 2. LDR READING & AUTOMATION
    // -----------------------------------------
    int ldrVal = analogRead(LDRPIN); 
    Blynk.virtualWrite(V9, ldrVal);

    // LDR Automation (NIGHT = LIGHTS ON, DAY = LIGHTS OFF)
    if (ldrVal > ldrNightThreshold && !isNight) {
      isNight = true;
      Serial.println("Auto: Night Detected. Lights ON.");
      lightState[0] = 1; lightState[1] = 1; lightState[2] = 1; lightState[3] = 1;
      Blynk.virtualWrite(V2, 1); Blynk.virtualWrite(V3, 1); 
      Blynk.virtualWrite(V4, 1); Blynk.virtualWrite(V5, 1);
      applyStates();
      checkStateChange();
    } 
    else if (ldrVal <= ldrNightThreshold && isNight) {
      isNight = false;
      Serial.println("Auto: Daylight Detected. Lights OFF.");
      lightState[0] = 0; lightState[1] = 0; lightState[2] = 0; lightState[3] = 0;
      Blynk.virtualWrite(V2, 0); Blynk.virtualWrite(V3, 0); 
      Blynk.virtualWrite(V4, 0); Blynk.virtualWrite(V5, 0);
      applyStates();
      checkStateChange();
    }
  }
}

// ======================================================
// BLYNK HANDLERS
// ======================================================
BLYNK_WRITE(V2) { lightState[0] = param.asInt(); applyStates(); checkStateChange(); }
BLYNK_WRITE(V3) { lightState[1] = param.asInt(); applyStates(); checkStateChange(); }
BLYNK_WRITE(V4) { lightState[2] = param.asInt(); applyStates(); checkStateChange(); }
BLYNK_WRITE(V5) { lightState[3] = param.asInt(); applyStates(); checkStateChange(); }

BLYNK_WRITE(V0) { fanState[0] = param.asInt(); applyStates(); checkStateChange(); }
BLYNK_WRITE(V1) { fanState[1] = param.asInt(); applyStates(); checkStateChange(); }
BLYNK_WRITE(V6) { fanState[2] = param.asInt(); applyStates(); checkStateChange(); }

// ======================================================
BLYNK_CONNECTED() { Blynk.syncAll(); }

// ======================================================
void setup() {
  Serial.begin(115200);

  pinMode(R1, OUTPUT); pinMode(R2, OUTPUT); pinMode(R3, OUTPUT); pinMode(R4, OUTPUT);
  pinMode(R5, OUTPUT); pinMode(R6, OUTPUT); pinMode(R7, OUTPUT);
  
  pinMode(LDRPIN, INPUT); 

  // Relays Active LOW → Initialize OFF
  digitalWrite(R1,HIGH); digitalWrite(R2,HIGH); digitalWrite(R3,HIGH); digitalWrite(R4,HIGH);
  digitalWrite(R5,HIGH); digitalWrite(R6,HIGH); digitalWrite(R7,HIGH);

  dht.begin();

  client.setInsecure();
  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);
  
  lastUpdateTime = millis();
  lastSensorCheck = millis(); // IMPORTANT FIX: Gives DHT sensor 5 seconds to warm up before the first read
}

// ======================================================
void loop() {
  Blynk.run();
  
  checkSensorsAndAutomate();
  
  // Periodic summarized update
  if (millis() - lastUpdateTime > updateInterval) {
    lastUpdateTime = millis();
    if (isAnyDeviceOn()) {
      sendShortSummary();
    }
  }
}