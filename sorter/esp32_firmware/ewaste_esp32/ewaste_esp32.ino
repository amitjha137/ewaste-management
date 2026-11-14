/*
  E-waste segregator - ESP32 motor controller
  Laptop sends text lines over USB serial (115200 baud):
    PING        -> PONG
    CAT n       -> full cycle for category n (1-5), then DONE
    MOVE n      -> only move stepper to category n, then DONE
    BACK n      -> only return stepper from category n, then DONE
    SERVO       -> one open/close servo cycle, then DONE
    MATRIX      -> "MATRIX d0,d1,...,d63"  (8x8 ToF distances in mm, for the bin fill level)
  Libraries needed: "ESP32Servo" (Library Manager) and DFRobot_MatrixLidar (GitHub zip, DFRobot)
  ToF sensor wiring: VCC -> 3V3, GND -> GND, SDA -> GPIO 21, SCL -> GPIO 22 (I2C switch ON, A0=A1=1 -> address 0x33)
*/
#include <ESP32Servo.h>
#include <Wire.h>
#include <DFRobot_MatrixLidar.h>

// ---------- Pins ----------
const int PUL_PIN = 25;   // driver PUL+ (STEP)
const int DIR_PIN = 26;   // driver DIR+
const int ENA_PIN = 27;   // driver ENA+  (LOW = enabled)
const int SERVO1_PIN = 18;
const int SERVO2_PIN = 19;

// ---------- Motor settings (same as the Pi code) ----------
const int ACW = 1;
const int CW = 0;
const bool DIR_INVERTED = true;      // set false if the motor turns the wrong way
const int PULSE_MS = 3;              // 3 ms high + 3 ms low per step
const int STEPS_CAT_2_4 = 300;
const int STEPS_CAT_3_5 = 600;

// ---------- Servo settings ----------
// Pulse in microseconds (0.5 ms .. 2.5 ms range, same mapping as gpiozero)
const int S1_CLOSED = 2400, S1_OPEN = 1600;   // value 0.9 / 0.1
const int S2_CLOSED = 1600, S2_OPEN = 2400;   // value 0.1 / 0.9
const int OPEN_TIME_MS = 1000;

Servo servo1, servo2;

// ---------- ToF sensor (bin fill level) ----------
const int SDA_PIN = 21;
const int SCL_PIN = 22;
DFRobot_MatrixLidar_I2C tof(0x33);
bool tofOk = false;
uint16_t tofBuf[64];

void stepperEnable(bool on) { digitalWrite(ENA_PIN, on ? LOW : HIGH); }

void stepMotor(int steps, int direction) {
  stepperEnable(true);
  digitalWrite(DIR_PIN, (direction ^ (DIR_INVERTED ? 1 : 0)) ? HIGH : LOW);
  delay(1);
  for (int i = 0; i < steps; i++) {
    digitalWrite(PUL_PIN, HIGH);
    delay(PULSE_MS);
    digitalWrite(PUL_PIN, LOW);
    delay(PULSE_MS);
  }
}

bool moveToCategory(int c) {
  switch (c) {
    case 1: return true;                       // home
    case 2: stepMotor(STEPS_CAT_2_4, ACW); return true;
    case 3: stepMotor(STEPS_CAT_3_5, ACW); return true;
    case 4: stepMotor(STEPS_CAT_2_4, CW);  return true;
    case 5: stepMotor(STEPS_CAT_3_5, CW);  return true;
  }
  return false;
}

bool returnToInitial(int c) {
  switch (c) {
    case 1: return true;
    case 2: stepMotor(STEPS_CAT_2_4, CW);  return true;
    case 3: stepMotor(STEPS_CAT_3_5, CW);  return true;
    case 4: stepMotor(STEPS_CAT_2_4, ACW); return true;
    case 5: stepMotor(STEPS_CAT_3_5, ACW); return true;
  }
  return false;
}

void servosAttach() {
  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2500);
  servo2.attach(SERVO2_PIN, 500, 2500);
}

void servosDetach() { servo1.detach(); servo2.detach(); }

void servosClosed() {
  servosAttach();
  servo1.writeMicroseconds(S1_CLOSED);
  servo2.writeMicroseconds(S2_CLOSED);
  delay(1000);
  servosDetach();
}

void runServo() {
  servosAttach();
  servo1.writeMicroseconds(S1_OPEN);
  delay(100);
  servo2.writeMicroseconds(S2_OPEN);
  delay(OPEN_TIME_MS);
  servo1.writeMicroseconds(S1_CLOSED);
  delay(100);
  servo2.writeMicroseconds(S2_CLOSED);
  delay(1000);
  servosDetach();
}

void handleLine(String line) {
  line.trim();
  line.toUpperCase();
  if (line.length() == 0) return;

  if (line == "PING") { Serial.println("PONG"); return; }

  if (line == "MATRIX") {
    if (!tofOk) { Serial.println("ERR no ToF sensor"); return; }
    tof.getAllData(tofBuf);
    Serial.print("MATRIX ");
    for (int i = 0; i < 64; i++) {
      Serial.print(tofBuf[i]);
      if (i < 63) Serial.print(',');
    }
    Serial.println();
    return;
  }

  if (line == "SERVO") { runServo(); Serial.println("DONE"); return; }

  int sp = line.indexOf(' ');
  String cmd = (sp < 0) ? line : line.substring(0, sp);
  int cat = (sp < 0) ? 0 : line.substring(sp + 1).toInt();

  if (cmd == "CAT") {
    if (cat < 1 || cat > 5) { Serial.println("ERR bad category"); return; }
    moveToCategory(cat);
    delay(3000);
    runServo();
    delay(3000);
    returnToInitial(cat);
    delay(1000);
    stepperEnable(false);
    Serial.println("DONE");
  } else if (cmd == "MOVE") {
    if (!moveToCategory(cat)) { Serial.println("ERR bad category"); return; }
    stepperEnable(false);
    Serial.println("DONE");
  } else if (cmd == "BACK") {
    if (!returnToInitial(cat)) { Serial.println("ERR bad category"); return; }
    stepperEnable(false);
    Serial.println("DONE");
  } else {
    Serial.println("ERR unknown command");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PUL_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(ENA_PIN, OUTPUT);
  digitalWrite(PUL_PIN, LOW);
  digitalWrite(DIR_PIN, LOW);
  stepperEnable(false);
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servosClosed();

  Wire.begin(SDA_PIN, SCL_PIN);
  for (int i = 0; i < 3 && !tofOk; i++) {
    tofOk = (tof.begin() == 0) && (tof.setRangingMode(eMatrix_8X8) == 0);
    if (!tofOk) delay(300);
  }
  Serial.println(tofOk ? "TOF OK" : "TOF NOT FOUND (fill level disabled)");
  Serial.println("READY");
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    handleLine(line);
  }
}
