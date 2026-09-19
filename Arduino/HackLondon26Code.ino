#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
//#include <esp_wifi.h>
//#include <esp_eap_client.h>
#include <HTTPClient.h>
#include <time.h> 
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ESP32Servo.h>

Servo servo;

// --- PIN DEFINITIONS ---
const int SERVO_PIN = 25;
const int BUZZER_PIN = 26; 
const int GREEN_LED_PIN = 27; // Success / Level Up LED
const int RED_LED_PIN = 32;   // Error LED
// Maintenance mode globals
bool maintenanceMode = false;
WebServer server(80);
Preferences preferences;

// Screen I2C (Bus 0) - standard pins
#define SCREEN_SDA 21
#define SCREEN_SCL 22

// --- EXPANDED NOTE FREQUENCIES (Hz) ---
// Bass notes for the shark
#define NOTE_E2  82   
#define NOTE_F2  87
#define NOTE_G2  98
#define NOTE_A2  110

// Mid tones for sad/error sounds
#define NOTE_C4  262  
#define NOTE_E4  330
#define NOTE_F4  349
#define NOTE_GB4 370
#define NOTE_G4  392

// High tones for happy/success sounds
#define NOTE_C5  523  
#define NOTE_E5  659
#define NOTE_G5  784
#define NOTE_C6  1047 

// PN532 I2C (Bus 1) - alternate pins  
#define PN532_SDA  16
#define PN532_SCL  17

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define SCREEN_ADDRESS 0x3C

TwoWire WireScreen = TwoWire(0);   // I2C Bus 0
TwoWire WirePN532 = TwoWire(1);    // I2C Bus 1

PN532_I2C pn532i2c(WirePN532);     // <<< Use PN532 bus
PN532 nfc(pn532i2c);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &WireScreen, -1);

const unsigned char shark1[] PROGMEM = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x80, 0x00, 0x00, 0x03, 0xc0, 0x00, 0x00, 0x07, 0xe0, 0x00, 0x04, 0x0f, 0xf0, 0x00, 0x0e, 0x1f, 0xf8, 0x00, 0x1f, 0xff, 0xfc, 0x00, 0x3f, 0xff, 0xfe, 0x00, 0x1f, 0xff, 0xff, 0x80, 0x0e, 0x1f, 0xf8, 0x00, 0x04, 0x03, 0xc0, 0x00, 0x00, 0x01, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
const unsigned char shark2[] PROGMEM = { 0x00, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x1e, 0x01, 0x80, 0x00, 0x3f, 0x03, 0xc0, 0x00, 0x1f, 0x07, 0xe0, 0x00, 0x07, 0x0f, 0xf0, 0x00, 0x03, 0x1f, 0xf8, 0x00, 0x01, 0xff, 0xfc, 0x00, 0x03, 0xff, 0xfe, 0x00, 0x07, 0xff, 0xff, 0x80, 0x00, 0x1f, 0xf8, 0x00, 0x00, 0x03, 0xc0, 0x00, 0x00, 0x01, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
char WIFI_SSID[32]      = "Pixel";
char WIFI_PASSWORD[64] = "";
char API_ENDPOINT[128]  = "http://api.londonrobotics.co.uk/api/nfc-events";
char DEVICE_ID[32]      = "SHARK-001";
char DEVICE_MODE[32]    = "attendance";

// --- NEW DELTA TIME VARIABLES ---
float sharkFloatX = -32.0;
int loadingFrame = 0;
unsigned long lastFrameTime = 0;
float pixelsPerSecond = 80.0; // Adjust this number to make the shark faster or slower

unsigned long lastAnimUpdate = 0;
unsigned long lastNFCScan = 0;
bool isFrame1 = true;
int frameCounter = 0;

TaskHandle_t servoTaskHandle = NULL;
TaskHandle_t buzzerTaskHandle = NULL;

// This task runs in the background for sounds and LEDs
void buzzerTask(void * pvParameters) {
  uint32_t songToPlay;
  
  for(;;) {
    xTaskNotifyWait(0x00, ULONG_MAX, &songToPlay, portMAX_DELAY);
    
    if (songToPlay == 1) { // 1 = SUCCESS
      digitalWrite(GREEN_LED_PIN, HIGH);
      int melody[] = {NOTE_C5, NOTE_E5, NOTE_G5, NOTE_C6};
      int durations[] = {80, 80, 80, 300}; 
      for (int i = 0; i < 4; i++) {
          tone(BUZZER_PIN, melody[i], durations[i] - 10);
          vTaskDelay(pdMS_TO_TICKS(durations[i])); 
      }
      noTone(BUZZER_PIN);
      digitalWrite(GREEN_LED_PIN, LOW);
      
    } else if (songToPlay == 2) { // 2 = ERROR
      digitalWrite(RED_LED_PIN, HIGH);
      int melody[] = {NOTE_G4, NOTE_GB4, NOTE_F4, NOTE_E4};
      int durations[] = {250, 250, 250, 500};
      for (int i = 0; i < 4; i++) {
          tone(BUZZER_PIN, melody[i], durations[i] - 20);
          vTaskDelay(pdMS_TO_TICKS(durations[i]));
      }
      noTone(BUZZER_PIN);
      digitalWrite(RED_LED_PIN, LOW);

    } else if (songToPlay == 3) { // 3 = LEVEL UP
      int melody[] = {NOTE_C4, NOTE_E4, NOTE_G4, NOTE_C5, NOTE_G4, NOTE_C5, NOTE_E5, NOTE_C5, NOTE_G5};
      int durations[] = {100, 100, 100, 100, 100, 100, 100, 100, 400};
      for (int i = 0; i < 9; i++) {
          digitalWrite(GREEN_LED_PIN, (i % 2 == 0) ? HIGH : LOW); 
          tone(BUZZER_PIN, melody[i], durations[i] - 15);
          vTaskDelay(pdMS_TO_TICKS(durations[i]));
      }
      noTone(BUZZER_PIN);
      digitalWrite(GREEN_LED_PIN, LOW); 
    }
  }
}
void servoFlapTask(void * pvParameters) {
  for(;;) {
    // Wait here infinitely until flapServo() sends a signal
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY); 
    
    servo.write(90);
    vTaskDelay(pdMS_TO_TICKS(200)); // vTaskDelay doesn't block the main code
    servo.write(0);
    vTaskDelay(pdMS_TO_TICKS(200));
    servo.write(90);
    vTaskDelay(pdMS_TO_TICKS(200));
    servo.write(0);
  }
}
void drawLoadingScreen() {
  display.clearDisplay();
  
  int cx = 64;
  int cy = 32;
  int r = 12;
  
  for (int i = 0; i < 8; i++) {
    float angle = i * 0.785398; // 45 degrees in radians
    int x = cx + r * cos(angle);
    int y = cy + r * sin(angle);
    
    // Highlight one spinning dot, draw others smaller
    if (i == (loadingFrame / 2) % 8) {
      display.fillCircle(x, y, 3, SSD1306_WHITE); 
    } else {
      display.fillCircle(x, y, 1, SSD1306_WHITE); 
    }
  }
  
  display.display();
  loadingFrame++;
}
void flapServo() {
  if (servoTaskHandle != NULL) {
    xTaskNotifyGive(servoTaskHandle); 
  }
}
void playSuccess() {
  if (buzzerTaskHandle != NULL) {
    xTaskNotify(buzzerTaskHandle, 1, eSetValueWithOverwrite);
  }
}

void playError() {
  if (buzzerTaskHandle != NULL) {
    xTaskNotify(buzzerTaskHandle, 2, eSetValueWithOverwrite);
  }
}

// 4. LEVEL UP: The "Arcade Jackpot"
void playLevelUp() {
  if (buzzerTaskHandle != NULL) {
    xTaskNotify(buzzerTaskHandle, 3, eSetValueWithOverwrite);
  }
}

void connectWiFi() {
  int attempts = 0;
  const int maxAttempts = 3;
  unsigned long timeouts[] = {5000, 10000, 15000}; 

  while (attempts < maxAttempts) {
    attempts++;
    WiFi.disconnect(true);
    WiFi.mode(WIFI_STA);

    // Standard WPA2 Connection
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD); 

    Serial.printf("Connecting to Hotspot: %s (Attempt %d)\n", WIFI_SSID, attempts);
    unsigned long startAttempt = millis();
    unsigned long currentTimeout = timeouts[attempts - 1];

    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < currentTimeout) {
        drawLoadingScreen(); 
        delay(250);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("\nConnected! IP: ");
      Serial.println(WiFi.localIP());
      return; 
    }
    
    Serial.println("\nRetry pause...");
    unsigned long retryStart = millis();
    while (millis() - retryStart < 1000) {
        drawLoadingScreen();
        delay(250);
    }
  }

  display.clearDisplay();
  printCentered("WIFI FAILED", 20, 2);
  printCentered("Rebooting...", 45, 1);
  display.display();
  delay(1000); 
  ESP.restart();
}
int sendTagEvent(const uint8_t* uid, uint8_t uidLength, String &firstName, int &points) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("No WiFi");
      return 0;  // network fail
    }
  }

  char uidBuf[3 * 10]; 
  int pos = 0;
  for (uint8_t i = 0; i < uidLength; i++) {
    if (i > 0) uidBuf[pos++] = ':';
    sprintf(&uidBuf[pos], "%02X", uid[i]);
    pos += 2;
  }
  uidBuf[pos] = '\0';

  time_t now;
  time(&now); 
  unsigned long nowSec = now;

  StaticJsonDocument<256> doc;
  doc["uid"]       = uidBuf;
  doc["ts"]        = nowSec;
  doc["type"]      = DEVICE_MODE;
  doc["device_id"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(body);
  
  // Extract data if successful
  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error) {
      String fullName = responseDoc["user_name"].as<String>();
      int spaceIndex = fullName.indexOf(' ');
      if (spaceIndex > 0) {
        firstName = fullName.substring(0, spaceIndex);
      } else {
        firstName = fullName;
      }
      points = responseDoc["points"].as<int>();
    }
  }

  http.end();
  return httpCode; 
}

void enterMaintenanceMode() {
  maintenanceMode = true;
  Serial.println("ENTERING MAINTENANCE MODE");
  
  // Stop normal WiFi client mode
  WiFi.disconnect();
  
  // Start AP mode
  WiFi.mode(WIFI_AP);
  WiFi.softAP(DEVICE_ID, "12345678"); // Using DEVICE_ID here
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP());
  
  // Web server routes
  server.on("/", handleRoot);
  server.on("/save", handleSave);
  server.on("/exit", handleExit);
  server.begin();
  
  displayMaintenanceScreen();
}

void exitMaintenanceMode() {
  maintenanceMode = false;
  server.stop();
  WiFi.mode(WIFI_OFF);
  connectWiFi();
  Serial.println("EXITED MAINTENANCE MODE");
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>SHARK Config</title>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<style>body{font-family:Arial;padding:20px;background:#222;color:#0f0;}";
  html += "input{width:100%;padding:10px;margin:5px 0;font-size:16px;background:#333;color:#0f0;border:1px solid #0f0;}</style></head>";
  html += "<body><h1>SHARK Config</h1>";
  
  html += "<form action='/save' method='POST'>";
  html += "<label>API Endpoint:</label><input type='url' name='api' value='" + String(API_ENDPOINT) + "' maxlength='127'><br>";
  html += "<label>Device ID:</label><input type='text' name='device' value='" + String(DEVICE_ID) + "' maxlength='31'><br>";
  html += "<label>Device Mode:</label><input type='text' name='mode' value='" + String(DEVICE_MODE) + "' maxlength='31'><br>";
  html += "<button type='submit' style='background:#0f0;color:#000;'>SAVE CONFIG</button>";
  html += "</form>";
  
  html += "<form action='/exit' method='POST'>";
  html += "<button style='background:#f00;color:#fff;'>EXIT MAINTENANCE</button>";
  html += "</form></body></html>";
  
  server.send(200, "text/html", html);
}

void handleSave() {
  strncpy(API_ENDPOINT, server.arg("api").c_str(), 127);
  API_ENDPOINT[127] = '\0';
  strncpy(DEVICE_ID, server.arg("device").c_str(), 31);
  DEVICE_ID[31] = '\0';
  strncpy(DEVICE_MODE, server.arg("mode").c_str(), 31);
  DEVICE_MODE[31] = '\0';
  
  server.send(200, "text/html", "<h1>CONFIG SAVED!</h1><p>Click EXIT to reboot to normal mode.</p><a href='/'><button>BACK</button></a>");
}

void handleExit() {
  preferences.begin("unitap", false);
  preferences.putString("api", API_ENDPOINT);
  preferences.putString("device", DEVICE_ID);
  preferences.putString("mode", DEVICE_MODE);
  preferences.end();
  
  server.send(200, "text/html", "<h1>REBOOTING...</h1><p>Config saved to flash. Returning to normal mode.</p>");
  delay(1000);
  ESP.restart();
}

void updateSharkAnimation() {
    // Calculate Delta Time (how much time passed since the last frame)
    unsigned long currentMillis = millis();
    float deltaTime = (currentMillis - lastFrameTime) / 1000.0; // Time in seconds
    lastFrameTime = currentMillis;

    // Move the shark based on TIME, not frames
    sharkFloatX += (pixelsPerSecond * deltaTime);
    if (sharkFloatX > 128.0) sharkFloatX = -32.0;
    
    int drawX = (int)sharkFloatX; // Convert the precise float position to an integer for the screen

    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    
    printCentered("SharkByte", 0, 1);
    printCentered("TAP CARD", 18, 2);
    
    frameCounter++;
    if (frameCounter % 8 == 0) isFrame1 = !isFrame1;

    // Draw using the time-calculated position
    if (isFrame1) display.drawBitmap(drawX, 45, shark1, 32, 16, 1);
    else display.drawBitmap(drawX, 45, shark2, 32, 16, 1);
    
    display.display();
}

void handleCardFound(uint8_t* uid, uint8_t uidLength) {
  if (uidLength == 4 && uid[0] == 0xAD && uid[1] == 0x32 && uid[2] == 0x50 && uid[3] == 0x06) {
    enterMaintenanceMode();
    return;
  }
  
  String firstName = "USER";
  int points = 0;
  
  int status = sendTagEvent(uid, uidLength, firstName, points);
  
  if (status == 200 || status == 201) {
    playSuccessAnimation(firstName, points);   // accept
  } else if (status == 404) {
    playRejectAnimation("UNKNOWN");    // reject (not recognized)
  } else {
    playErrorAnimation("NETWORK");     // other errors
  }
  
  sharkFloatX = -32.0;
  lastFrameTime = millis();
}
void printCentered(String text, int y, int textSize) {
  display.setTextSize(textSize);
  int textWidth = text.length() * (6 * textSize);
  display.setCursor((128 - textWidth) / 2, y);
  display.print(text);
}
void playSuccessAnimation(String name, int points) {
  flapServo();
  playSuccess();
  for(int r = 1; r < 80; r += 12) {
    display.drawCircle(64, 32, r, 1);
    display.display();
  }
  display.invertDisplay(true);
  display.clearDisplay();
  
  printCentered("WELCOME", 5, 1);
  printCentered(name, 20, 2);
  printCentered(String(points) + "xp", 45, 2);
  
  display.display();
  delay(2000); 
  display.invertDisplay(false);
}
void playRejectAnimation(String msg) {
  flapServo();
  playError();
  for (int i = 0; i < 10; i++) {
    int xOff = random(-5, 6);
    int yOff = random(-3, 4);
    
    display.clearDisplay();
    display.invertDisplay(i % 2 == 0); 
    
    // Draw a big "!" icon
    display.setTextSize(3);
    display.setCursor(55 + xOff, 10 + yOff);
    display.print("!");
    
    display.setTextSize(1);
    int textWidth = msg.length() * 6;
    display.setCursor(((128 - textWidth) / 2) + xOff, 45 + yOff);
    display.print(msg);
    
    display.display();
    delay(30); 
  }
  display.invertDisplay(false);
  delay(1500); // Wait after the shake
}

void playErrorAnimation(String msg) {
  display.clearDisplay();
  printCentered("ERROR", 10, 2);
  printCentered(msg, 40, 1);
  display.display();
  delay(2000);
}

void displayMaintenanceScreen() {
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 1000) return;
  lastUpdate = millis();
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  display.setCursor(0, 0);
  display.println("MAINTENANCE MODE");
  display.println("=================");
  display.println("Connect to:");
  display.println(DEVICE_ID);
  display.println("12345678");
  
  IPAddress apIP = WiFi.softAPIP();
  display.print("IP: ");
  display.println(apIP);  // DYNAMIC IP!
  
  display.println("");
  display.println("EDIT CONFIG");
  
  display.display();
}
void setup() {
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  Serial.begin(115200);
  servo.attach(SERVO_PIN);
  xTaskCreate(servoFlapTask, "ServoTask", 2048, NULL, 1, &servoTaskHandle);
  xTaskCreate(buzzerTask, "BuzzerTask", 2048, NULL, 1, &buzzerTaskHandle);
  // Init both I2C buses
  WireScreen.begin(SCREEN_SDA, SCREEN_SCL, 400000);  // Screen: fast
  WirePN532.begin(PN532_SDA, PN532_SCL, 100000);     // PN532: standard NFC speed
  
  WireScreen.setClock(800000);  // Fast screen only

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) for(;;);
  
  display.clearDisplay();
  display.display();
  connectWiFi();
    // NTP setup - gets real Unix time
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");  // UTC, 2 servers
  
  // Wait for time sync (10s max)
  Serial.print("Waiting for NTP...");
  struct tm timeinfo;
  int ntpTries = 0;
  
  while (!getLocalTime(&timeinfo, 10) && ntpTries++ < 500) { 
    drawLoadingScreen(); 
    delay(250);
    Serial.print(".");
  }
  Serial.println(" NTP ready");
  preferences.begin("unitap", true);
  strncpy(API_ENDPOINT, preferences.getString("api", API_ENDPOINT).c_str(), 127); API_ENDPOINT[127] = '\0';
  strncpy(DEVICE_ID, preferences.getString("device", DEVICE_ID).c_str(), 31); DEVICE_ID[31] = '\0';
  strncpy(DEVICE_MODE, preferences.getString("mode", DEVICE_MODE).c_str(), 31); DEVICE_MODE[31] = '\0';
  preferences.end();
  nfc.begin();
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) while (1); 
  playLevelUp();
  nfc.SAMConfig();
  nfc.setPassiveActivationRetries(0x01); // Prevent hanging
  
  lastFrameTime = millis(); // Initialize our timer
}

void loop() {
  if (maintenanceMode) {
    server.handleClient();
    displayMaintenanceScreen(); 
    delay(10);
    return;
  }
  // --- 1. ANIMATION UPDATE ---
  if (millis() - lastAnimUpdate >= 20) { // Still targets ~50 FPS
    lastAnimUpdate = millis();
    updateSharkAnimation();
  }

  // --- 2. FAST POLLING NFC SCAN ---
  if (millis() - lastNFCScan > 250) {
    lastNFCScan = millis();
    
    uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
    uint8_t uidLength;
    
    // Low timeout (15ms) limits how long the I2C bus is locked up
    if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 15)) {
        handleCardFound(uid, uidLength);
    }
  }
}


