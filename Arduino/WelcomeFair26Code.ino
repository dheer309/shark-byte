
#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>
#include <ESP32Servo.h>

// ==========================================
// HARDWARE PIN DEFINITIONS
// ==========================================
const int SERVO_PIN        = 25;
const int SERVO_REST_ANGLE = 125; // Initial / resting servo position
const int SERVO_FLAP_ANGLE = 90;  // Flap motion position
const int BUZZER_PIN       = 26; 
const int GREEN_LED_PIN    = 27; // Success / Vote Confirmed LED
const int RED_LED_PIN      = 32; // Error / Cooldown LED

// Screen I2C (Bus 0)
#define SCREEN_SDA 21
#define SCREEN_SCL 22
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define SCREEN_ADDRESS 0x3C

// PN532 I2C (Bus 1)
#define PN532_SDA 16
#define PN532_SCL 17
#define PN532_RST -1 // Set to GPIO (e.g. 18) if connected to PN532 RSTPDN pin

TwoWire WireScreen = TwoWire(0);   // I2C Bus 0: Display (800 kHz)
TwoWire WirePN532  = TwoWire(1);   // I2C Bus 1: NFC (100 kHz)

PN532_I2C pn532i2c(WirePN532);
PN532 nfc(pn532i2c);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &WireScreen, -1);
Servo servo;
Preferences preferences;

// ==========================================
// AUDIO FREQUENCIES (Hz)
// ==========================================
#define NOTE_C4  262  
#define NOTE_E4  330
#define NOTE_F4  349
#define NOTE_GB4 370
#define NOTE_G4  392
#define NOTE_C5  523  
#define NOTE_E5  659
#define NOTE_G5  784
#define NOTE_C6  1047 

// ==========================================
// SHARK BITMAPS (32x16)
// ==========================================
const unsigned char shark1[] PROGMEM = { 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x01, 0x80, 0x00, 0x00, 0x03, 0xc0, 0x00, 
  0x00, 0x07, 0xe0, 0x00, 0x04, 0x0f, 0xf0, 0x00, 
  0x0e, 0x1f, 0xf8, 0x00, 0x1f, 0xff, 0xfc, 0x00, 
  0x3f, 0xff, 0xfe, 0x00, 0x1f, 0xff, 0xff, 0x80, 
  0x0e, 0x1f, 0xf8, 0x00, 0x04, 0x03, 0xc0, 0x00, 
  0x00, 0x01, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
};

const unsigned char shark2[] PROGMEM = { 
  0x00, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 
  0x1e, 0x01, 0x80, 0x00, 0x3f, 0x03, 0xc0, 0x00, 
  0x1f, 0x07, 0xe0, 0x00, 0x07, 0x0f, 0xf0, 0x00, 
  0x03, 0x1f, 0xf8, 0x00, 0x01, 0xff, 0xfc, 0x00, 
  0x03, 0xff, 0xfe, 0x00, 0x07, 0xff, 0xff, 0x80, 
  0x00, 0x1f, 0xf8, 0x00, 0x00, 0x03, 0xc0, 0x00, 
  0x00, 0x01, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
};

// ==========================================
// FEEDBACK TOPICS & PERSISTENT DATA
// ==========================================
const int NUM_TOPICS = 4;
const char* TOPIC_NAMES[NUM_TOPICS] = {
  "Unibots",
  "FPGA",
  "Workshops",
  "PCB Series"
};

String topicUIDs[NUM_TOPICS] = {"", "", "", ""};
uint32_t topicCounts[NUM_TOPICS] = {0, 0, 0, 0};

// Hardcoded Maintenance Tag: CA:EF:99:9E
const uint8_t MAINT_UID[4] = {0xCA, 0xEF, 0x99, 0x9E};

// FreeRTOS Task Handles
TaskHandle_t servoTaskHandle  = NULL;
TaskHandle_t buzzerTaskHandle = NULL;
TaskHandle_t nfcTaskHandle    = NULL;

// Asynchronous NFC Detection State
volatile bool nfcTaskPaused   = false;
volatile bool newCardDetected = false;
uint8_t scannedUid[7]         = {0};
uint8_t scannedUidLen         = 0;

// Delta-Time Shark Animation Variables
float sharkFloatX = -32.0;
unsigned long lastFrameTime = 0;
float pixelsPerSecond = 80.0;
unsigned long lastAnimUpdate = 0;
bool isFrame1 = true;
int frameCounter = 0;

// Anti-Spam / Physical Removal & Cooldown Tracking
String lastCardUID = "";
unsigned long lastCardTime = 0;
bool lastCardLifted = true; // Must physically remove card before voting again
const unsigned long CARD_COOLDOWN_MS = 2500;

// NFC scan timing
unsigned long lastNFCScan = 0;

// Forward Declarations
void printCentered(String text, int y, int textSize);
void updateSharkAnimation();
void nfcTask(void * pvParameters);
void playSuccess();
void playError();
void playLevelUp();
void playShortBeep();
void playCooldownWarning();
void flapServo();
void handleCardFound(uint8_t* uid, uint8_t uidLength);
bool isMaintenanceCard(const uint8_t* uid, uint8_t uidLength);
String uidToString(const uint8_t* uid, uint8_t uidLength);
void runMaintenanceFlow();
void printResultsToSerial();
void runPairingSequence();
void showVoteAnimation(int topicIndex);
void showUnknownCardAnimation(String uidStr);
void showCooldownAnimation();
void loadPersistentData();
void saveCount(int index);
void saveUID(int index, String uidStr);
void resetAllCounts();

// ==========================================
// FREERTOS BACKGROUND TASKS
// ==========================================
void buzzerTask(void * pvParameters) {
  uint32_t songToPlay;
  
  for(;;) {
    xTaskNotifyWait(0x00, ULONG_MAX, &songToPlay, portMAX_DELAY);
    
    if (songToPlay == 1) { // 1 = SUCCESS / VOTE CONFIRMED
      digitalWrite(GREEN_LED_PIN, HIGH);
      int melody[] = {NOTE_C5, NOTE_E5, NOTE_G5, NOTE_C6};
      int durations[] = {80, 80, 80, 250}; 
      for (int i = 0; i < 4; i++) {
          tone(BUZZER_PIN, melody[i], durations[i] - 10);
          vTaskDelay(pdMS_TO_TICKS(durations[i])); 
      }
      noTone(BUZZER_PIN);
      digitalWrite(GREEN_LED_PIN, LOW);
      
    } else if (songToPlay == 2) { // 2 = REJECT / UNKNOWN CARD
      digitalWrite(RED_LED_PIN, HIGH);
      int melody[] = {NOTE_G4, NOTE_GB4, NOTE_F4, NOTE_E4};
      int durations[] = {200, 200, 200, 350};
      for (int i = 0; i < 4; i++) {
          tone(BUZZER_PIN, melody[i], durations[i] - 20);
          vTaskDelay(pdMS_TO_TICKS(durations[i])); 
      }
      noTone(BUZZER_PIN);
      digitalWrite(RED_LED_PIN, LOW);

    } else if (songToPlay == 3) { // 3 = LEVEL UP / ALL TAGS PAIRED
      int melody[] = {NOTE_C4, NOTE_E4, NOTE_G4, NOTE_C5, NOTE_G4, NOTE_C5, NOTE_E5, NOTE_C5, NOTE_G5};
      int durations[] = {90, 90, 90, 90, 90, 90, 90, 90, 350};
      for (int i = 0; i < 9; i++) {
          digitalWrite(GREEN_LED_PIN, (i % 2 == 0) ? HIGH : LOW); 
          tone(BUZZER_PIN, melody[i], durations[i] - 15);
          vTaskDelay(pdMS_TO_TICKS(durations[i])); 
      }
      noTone(BUZZER_PIN);
      digitalWrite(GREEN_LED_PIN, LOW); 

    } else if (songToPlay == 4) { // 4 = SHORT BEEP (Step confirmed)
      digitalWrite(GREEN_LED_PIN, HIGH);
      tone(BUZZER_PIN, NOTE_C6, 120);
      vTaskDelay(pdMS_TO_TICKS(130));
      noTone(BUZZER_PIN);
      digitalWrite(GREEN_LED_PIN, LOW);

    } else if (songToPlay == 5) { // 5 = COOLDOWN WARNING (Double low blip)
      digitalWrite(RED_LED_PIN, HIGH);
      tone(BUZZER_PIN, NOTE_E4, 70);
      vTaskDelay(pdMS_TO_TICKS(100));
      noTone(BUZZER_PIN);
      vTaskDelay(pdMS_TO_TICKS(50));
      tone(BUZZER_PIN, NOTE_E4, 70);
      vTaskDelay(pdMS_TO_TICKS(100));
      noTone(BUZZER_PIN);
      digitalWrite(RED_LED_PIN, LOW);
    }
  }
}

void servoFlapTask(void * pvParameters) {
  for(;;) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY); 
    servo.write(SERVO_FLAP_ANGLE);
    vTaskDelay(pdMS_TO_TICKS(180));
    servo.write(SERVO_REST_ANGLE);
    vTaskDelay(pdMS_TO_TICKS(180));
    servo.write(SERVO_FLAP_ANGLE);
    vTaskDelay(pdMS_TO_TICKS(180));
    servo.write(SERVO_REST_ANGLE);
  }
}

void nfcTask(void * pvParameters) {
  for(;;) {
    if (nfcTaskPaused) {
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }

    if (!newCardDetected) {
      uint8_t uid[7] = {0};
      uint8_t uidLen = 0;

      // 25ms timeout for fast polling without locking the I2C bus
      if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 25)) {
        if (uidLen > 0) {
          memcpy(scannedUid, uid, uidLen);
          scannedUidLen = uidLen;
          newCardDetected = true;
        }
      } else {
        // Tag physically lifted or absent
        lastCardLifted = true;
      }
    }
    vTaskDelay(pdMS_TO_TICKS(40));
  }
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

void playLevelUp() {
  if (buzzerTaskHandle != NULL) {
    xTaskNotify(buzzerTaskHandle, 3, eSetValueWithOverwrite);
  }
}

void playShortBeep() {
  if (buzzerTaskHandle != NULL) {
    xTaskNotify(buzzerTaskHandle, 4, eSetValueWithOverwrite);
  }
}

void playCooldownWarning() {
  if (buzzerTaskHandle != NULL) {
    xTaskNotify(buzzerTaskHandle, 5, eSetValueWithOverwrite);
  }
}

// ==========================================
// PERSISTENCE (NVS FLASH)
// ==========================================
void loadPersistentData() {
  preferences.begin("shark_fair", false);
  
  for (int i = 0; i < NUM_TOPICS; i++) {
    String uidKey = "uid_" + String(i);
    String cntKey = "cnt_" + String(i);
    topicUIDs[i] = preferences.getString(uidKey.c_str(), "");
    topicCounts[i] = preferences.getUInt(cntKey.c_str(), 0);
  }
  
  preferences.end();
}

void saveCount(int index) {
  if (index < 0 || index >= NUM_TOPICS) return;
  preferences.begin("shark_fair", false);
  String cntKey = "cnt_" + String(index);
  preferences.putUInt(cntKey.c_str(), topicCounts[index]);
  preferences.end();
}

void saveUID(int index, String uidStr) {
  if (index < 0 || index >= NUM_TOPICS) return;
  preferences.begin("shark_fair", false);
  String uidKey = "uid_" + String(index);
  preferences.putString(uidKey.c_str(), uidStr);
  topicUIDs[index] = uidStr;
  preferences.end();
}

void resetAllCounts() {
  preferences.begin("shark_fair", false);
  for (int i = 0; i < NUM_TOPICS; i++) {
    topicCounts[i] = 0;
    String cntKey = "cnt_" + String(i);
    preferences.putUInt(cntKey.c_str(), 0);
  }
  preferences.end();
}

// ==========================================
// STRING & DISPLAY UTILITIES
// ==========================================
String uidToString(const uint8_t* uid, uint8_t uidLength) {
  char buf[3 * 10];
  int pos = 0;
  for (uint8_t i = 0; i < uidLength; i++) {
    if (i > 0) buf[pos++] = ':';
    sprintf(&buf[pos], "%02X", uid[i]);
    pos += 2;
  }
  buf[pos] = '\0';
  return String(buf);
}

bool isMaintenanceCard(const uint8_t* uid, uint8_t uidLength) {
  if (uidLength != 4) return false;
  return (uid[0] == MAINT_UID[0] && 
          uid[1] == MAINT_UID[1] && 
          uid[2] == MAINT_UID[2] && 
          uid[3] == MAINT_UID[3]);
}

void printCentered(String text, int y, int textSize) {
  display.setTextSize(textSize);
  int textWidth = text.length() * (6 * textSize);
  int x = (128 - textWidth) / 2;
  if (x < 0) x = 0;
  display.setCursor(x, y);
  display.print(text);
}

// ==========================================
// ANIMATIONS & SCREENS
// ==========================================
void updateSharkAnimation() {
  unsigned long currentMillis = millis();
  float deltaTime = (currentMillis - lastFrameTime) / 1000.0f;
  lastFrameTime = currentMillis;
  if (deltaTime > 0.05f) deltaTime = 0.05f; // Clamp delta-time to prevent jumping

  sharkFloatX += (pixelsPerSecond * deltaTime);
  if (sharkFloatX > 128.0f) sharkFloatX = -32.0f;
  int drawX = (int)sharkFloatX;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  
  printCentered("WELCOME FAIR '26", 0, 1);
  printCentered("TAP CARD TO VOTE", 14, 1);

  // Rotating subtitle showing options
  static unsigned long lastSubChange = 0;
  static int currentSubIndex = 0;
  if (millis() - lastSubChange > 2000) {
    lastSubChange = millis();
    currentSubIndex = (currentSubIndex + 1) % NUM_TOPICS;
  }
  String previewStr = "> " + String(TOPIC_NAMES[currentSubIndex]) + " <";
  printCentered(previewStr, 27, 1);
  
  frameCounter++;
  if (frameCounter % 8 == 0) isFrame1 = !isFrame1;

  if (isFrame1) display.drawBitmap(drawX, 44, shark1, 32, 16, 1);
  else display.drawBitmap(drawX, 44, shark2, 32, 16, 1);
  
  display.display();
}

void showVoteAnimation(int topicIndex) {
  flapServo();
  playSuccess();

  // Expanding ripple circles
  for (int r = 1; r < 75; r += 12) {
    display.clearDisplay();
    display.drawCircle(64, 32, r, SSD1306_WHITE);
    printCentered("+1 VOTE!", 24, 2);
    display.display();
    delay(20);
  }

  // Flash invert
  display.invertDisplay(true);
  display.clearDisplay();

  printCentered("VOTE RECORDED!", 4, 1);

  // Adaptive font sizing for topic name
  String name = String(TOPIC_NAMES[topicIndex]);
  if (name.length() <= 8) {
    printCentered(name, 19, 2);
  } else {
    printCentered(name, 22, 1);
  }

  String totalStr = "Total: " + String(topicCounts[topicIndex]) + " votes";
  printCentered(totalStr, 40, 1);
  printCentered("THANK YOU!", 53, 1);

  display.display();
  delay(1800);
  display.invertDisplay(false);

  sharkFloatX = -32.0;
  lastFrameTime = millis();
}

void showCooldownAnimation() {
  playCooldownWarning(); // Distinct low double blip (3.3)
  
  display.clearDisplay();
  printCentered("ALREADY VOTED!", 15, 1);
  printCentered("LIFT CARD", 30, 2);
  printCentered("Pass card to next", 50, 1);
  display.display();
  delay(1000);

  sharkFloatX = -32.0;
  lastFrameTime = millis();
}

void showUnknownCardAnimation(String uidStr) {
  playError();
  for (int i = 0; i < 8; i++) {
    int xOff = random(-4, 5);
    int yOff = random(-2, 3);
    
    display.clearDisplay();
    display.invertDisplay(i % 2 == 0); 
    
    display.setTextSize(3);
    display.setCursor(56 + xOff, 6 + yOff);
    display.print("?");
    
    printCentered("UNRECOGNIZED TAG", 36 + yOff, 1);
    printCentered(uidStr, 48 + yOff, 1);
    
    display.display();
    delay(35); 
  }
  display.invertDisplay(false);
  delay(1200);

  sharkFloatX = -32.0;
  lastFrameTime = millis();
}

// ==========================================
// SERIAL DATA EXPORT (3.1)
// ==========================================
void printResultsToSerial() {
  Serial.println("\n==========================================");
  Serial.println("       WELCOME FAIR '26 RESULTS TALLY      ");
  Serial.println("==========================================");
  uint32_t totalVotes = 0;
  uint32_t maxVotes = 0;
  int leaderIdx = 0;

  for (int i = 0; i < NUM_TOPICS; i++) {
    totalVotes += topicCounts[i];
    if (topicCounts[i] > maxVotes) {
      maxVotes = topicCounts[i];
      leaderIdx = i;
    }
  }

  for (int i = 0; i < NUM_TOPICS; i++) {
    bool isLeader = (topicCounts[i] == maxVotes && maxVotes > 0);
    Serial.printf("%d. %-12s: %5u votes %s\n", 
                  i + 1, 
                  TOPIC_NAMES[i], 
                  topicCounts[i], 
                  isLeader ? " [★ LEADER]" : "");
  }
  Serial.println("------------------------------------------");
  Serial.printf("TOTAL VOTES   : %u\n", totalVotes);
  Serial.println("------------------------------------------");
  Serial.println("CSV EXPORT    : Unibots,FPGA,Workshops,PCB Series");
  Serial.printf("CSV DATA      : %u,%u,%u,%u\n", 
                topicCounts[0], topicCounts[1], topicCounts[2], topicCounts[3]);
  Serial.println("==========================================\n");
}

// ==========================================
// MAINTENANCE & PAIRING FLOW
// ==========================================
void runMaintenanceFlow() {
  nfcTaskPaused = true;
  delay(60); // Allow in-flight NFC transaction to finish cleanly
  playShortBeep();

  // 3.1: Export all current tallies over Serial immediately
  printResultsToSerial();

  // 1: Ensure maintenance card is physically REMOVED before listening for confirmation
  uint8_t dummyUid[7];
  uint8_t dummyLen;
  while (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, dummyUid, &dummyLen, 25)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    printCentered("LIFT MAINT CARD", 26, 1);
    display.display();
    delay(50);
  }
  delay(200);

  // Screen 1: Show Live Results with Leaderboard Highlight (3.4) + Countdown
  unsigned long promptStart = millis();
  const unsigned long CONFIRM_WINDOW_MS = 6000;
  bool confirmed = false;

  // Find leading vote count for highlight
  uint32_t maxVotes = 0;
  for (int i = 0; i < NUM_TOPICS; i++) {
    if (topicCounts[i] > maxVotes) maxVotes = topicCounts[i];
  }

  while (millis() - promptStart < CONFIRM_WINDOW_MS) {
    int timeLeft = (CONFIRM_WINDOW_MS - (millis() - promptStart)) / 1000;

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("--- LIVE RESULTS ---");
    
    for (int i = 0; i < NUM_TOPICS; i++) {
      // 3.4: Leaderboard marker highlight
      bool isLead = (topicCounts[i] == maxVotes && maxVotes > 0);
      display.printf("%d.%-10s:%3d%s\n", 
                     i + 1, 
                     TOPIC_NAMES[i], 
                     topicCounts[i], 
                     isLead ? " *" : "");
    }
    
    display.setCursor(0, 48);
    display.printf("SCAN TO RESET (%ds)", timeLeft);
    display.display();

    // Check for second deliberate tap of maintenance card
    uint8_t uid[7];
    uint8_t uidLength;
    if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 50)) {
      if (isMaintenanceCard(uid, uidLength)) {
        confirmed = true;
        break;
      }
    }
    delay(100);
  }

  if (!confirmed) {
    // Timed out: return to normal voting
    display.clearDisplay();
    printCentered("MAINTENANCE EXITED", 26, 1);
    display.display();
    delay(1000);
    sharkFloatX = -32.0;
    lastFrameTime = millis();
    lastAnimUpdate = millis();
    lastCardLifted = true;
    nfcTaskPaused = false;
    return;
  }

  // Second scan confirmed: Reset counts & enter pairing mode
  resetAllCounts();
  runPairingSequence();
}

void runPairingSequence() {
  playShortBeep();
  display.clearDisplay();
  printCentered("COUNTS ZEROED!", 15, 1);
  printCentered("ENTERING PAIRING", 32, 1);
  display.display();
  delay(1500);

  // Require maintenance card to be removed first
  uint8_t dummyUid[7];
  uint8_t dummyLen;
  while (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, dummyUid, &dummyLen, 25)) {
    display.clearDisplay();
    printCentered("REMOVE MAINT CARD", 26, 1);
    display.display();
    delay(100);
  }
  delay(300);

  // Step-by-step pairing of the 4 topic tags
  for (int step = 0; step < NUM_TOPICS; step++) {
    bool stepComplete = false;

    while (!stepComplete) {
      display.clearDisplay();
      display.setTextSize(1);
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(0, 0);
      display.printf("TAG SETUP (%d/4)", step + 1);
      display.println("\n---------------------");
      display.println("TAP TARGET CARD FOR:");
      
      display.setTextSize(2);
      display.setCursor(0, 30);
      display.println(TOPIC_NAMES[step]);

      display.setTextSize(1);
      display.setCursor(0, 52);
      display.println("Waiting for scan...");
      display.display();

      uint8_t newUid[7];
      uint8_t newUidLen;
      if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, newUid, &newUidLen, 50)) {
        // Prevent registering the maintenance card as a topic tag
        if (isMaintenanceCard(newUid, newUidLen)) {
          playError();
          display.clearDisplay();
          printCentered("CANNOT USE MAINT TAG", 26, 1);
          display.display();
          delay(1200);
          continue;
        }

        String scannedStr = uidToString(newUid, newUidLen);

        // Check if this card was already used for an earlier step
        bool duplicate = false;
        for (int p = 0; p < step; p++) {
          if (topicUIDs[p] == scannedStr) {
            duplicate = true;
            break;
          }
        }

        if (duplicate) {
          playError();
          display.clearDisplay();
          printCentered("CARD ALREADY USED!", 20, 1);
          printCentered("Tap another card", 38, 1);
          display.display();
          delay(1500);
          continue;
        }

        // Successfully paired this step!
        saveUID(step, scannedStr);
        playShortBeep();

        display.clearDisplay();
        printCentered("SAVED!", 10, 2);
        printCentered(TOPIC_NAMES[step], 30, 1);
        printCentered(scannedStr, 45, 1);
        display.display();
        delay(1200);

        // Wait until card is lifted before prompting next step
        while (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, dummyUid, &dummyLen, 25)) {
          display.clearDisplay();
          printCentered("LIFT CARD UP", 26, 1);
          display.display();
          delay(100);
        }
        delay(400);

        stepComplete = true;
      }
      delay(50);
    }
  }

  // All 4 cards paired!
  display.clearDisplay();
  printCentered("ALL 4 CARDS PAIRED!", 12, 1);
  printCentered("READY TO VOTE!", 30, 1);
  printCentered("Restarting Shark...", 48, 1);
  display.display();

  flapServo();
  playLevelUp();
  delay(1500);

  // Send abort ACK frame and shut down I2C cleanly before reboot
  const uint8_t pn532_ack[] = {0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00};
  WirePN532.beginTransmission(0x24);
  WirePN532.write(pn532_ack, sizeof(pn532_ack));
  WirePN532.endTransmission();
  WirePN532.end();
  delay(100);

  ESP.restart();
}

// ==========================================
// CARD TAP HANDLER
// ==========================================
void handleCardFound(uint8_t* uid, uint8_t uidLength) {
  // 1. Maintenance Card Check
  if (isMaintenanceCard(uid, uidLength)) {
    runMaintenanceFlow();
    return;
  }

  String uidStr = uidToString(uid, uidLength);
  unsigned long now = millis();

  // 2. Anti-Spam & Physical Removal Gate:
  // If the same card is still resting on the reader, or cooldown hasn't expired
  if (uidStr == lastCardUID && (!lastCardLifted || (now - lastCardTime < CARD_COOLDOWN_MS))) {
    showCooldownAnimation();
    return;
  }

  // 3. Match against registered topics
  int matchedIndex = -1;
  for (int i = 0; i < NUM_TOPICS; i++) {
    if (topicUIDs[i].length() > 0 && topicUIDs[i].equalsIgnoreCase(uidStr)) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex >= 0) {
    // Valid vote!
    topicCounts[matchedIndex]++;
    saveCount(matchedIndex);
    lastCardUID = uidStr;
    lastCardTime = now;
    lastCardLifted = false; // Must be lifted before casting another vote
    showVoteAnimation(matchedIndex);
  } else {
    // Unrecognized tag
    lastCardUID = uidStr;
    lastCardTime = now;
    lastCardLifted = false;
    showUnknownCardAnimation(uidStr);
  }
}

// ==========================================
// SETUP & MAIN LOOP
// ==========================================
void setup() {
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);

  Serial.begin(115200);
  delay(100);
  Serial.println("\n[BOOT] Shark Byte starting up...");

  // Allocate hardware PWM timers: Reserve Timer 0 for tone() buzzer, allocate Timers 1-3 for Servo
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  servo.setPeriodHertz(50); // Standard 50Hz servo PWM
  servo.attach(SERVO_PIN);
  servo.write(SERVO_REST_ANGLE);

  // Initialize FreeRTOS background tasks for non-blocking sound & servo
  xTaskCreate(servoFlapTask, "ServoTask", 2048, NULL, 1, &servoTaskHandle);
  xTaskCreate(buzzerTask, "BuzzerTask", 2048, NULL, 1, &buzzerTaskHandle);

  // Screen I2C setup (Bus 0)
  WireScreen.begin(SCREEN_SDA, SCREEN_SCL, 400000);
  WirePN532.begin(PN532_SDA, PN532_SCL, 100000);
  WireScreen.setClock(800000); // 800 kHz Fast Mode Plus for high-framerate OLED
  WirePN532.setTimeOut(10);

  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    for(;;); // Halt on display hardware failure
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  printCentered("SHARK BYTE", 15, 2);
  printCentered("WELCOME FAIR '26", 38, 1);
  display.display();

  // Load persistent tags and vote counters from NVS
  loadPersistentData();

  // Hardware reset PN532 if a reset pin is configured
  if (PN532_RST >= 0) {
    pinMode(PN532_RST, OUTPUT);
    digitalWrite(PN532_RST, LOW);
    delay(50);
    digitalWrite(PN532_RST, HIGH);
    delay(100);
  }

  // Init NFC PN532 with retry loop
  bool nfcReady = false;
  for (int attempt = 1; attempt <= 6; attempt++) {
    nfc.begin();
    delay(100);
    uint32_t versiondata = nfc.getFirmwareVersion();
    if (versiondata) {
      nfc.SAMConfig();
      nfc.setPassiveActivationRetries(0x01); // 1 retry per poll to avoid blocking
      nfcReady = true;
      break;
    }
    delay(150);
  }

  if (!nfcReady) {
    display.clearDisplay();
    printCentered("NFC INIT ERROR", 26, 1);
    display.display();
    while (1);
  }

  // Startup chime
  playShortBeep();
  delay(600);

  lastFrameTime = millis();
  lastAnimUpdate = millis();

  // Launch background NFC polling task pinned to Core 0 (leaving Core 1 dedicated to OLED & loop)
  xTaskCreatePinnedToCore(nfcTask, "NFCTask", 4096, NULL, 1, &nfcTaskHandle, 0);
}

void loop() {
  // 1. Process scanned NFC card if detected by background task
  if (newCardDetected) {
    uint8_t uid[7];
    uint8_t uidLen = scannedUidLen;
    memcpy(uid, scannedUid, uidLen);

    handleCardFound(uid, uidLen);

    newCardDetected = false;
    lastFrameTime = millis();
    lastAnimUpdate = millis();
  }

  // 2. Shark animation update (~50 FPS)
  if (millis() - lastAnimUpdate >= 20) {
    lastAnimUpdate = millis();
    updateSharkAnimation();
  }
}
