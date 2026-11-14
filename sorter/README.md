# Sorter (laptop + ESP32)

Runs next to the bin. Webcam -> ResNet50 -> ESP32 (stepper + servos) -> web app.

## Setup
1. Upload `esp32_firmware/ewaste_esp32/ewaste_esp32.ino` to the ESP32 (Arduino IDE, library: ESP32Servo).
2. Put your weights at `sorter/Model/resnet50_finetuned.pth`.
3. `python -m venv venv`, activate it, `pip install -r requirements.txt`.
4. Start the web app first: `cd backend && npm install && npm start` (needs `backend/.env`, see `.env.example`).
5. Edit the COM port and token in `run.bat`, then double-click it.
   (Token = a value from `DEVICE_TOKENS` in `backend/.env`; leave DEVICE_TOKENS unset to allow any.)

## Test without hardware
    python main.py --port fake --image some_photo.jpg --backend http://localhost:5000

## What the dashboard buttons do (bin-user page, IoT panel)
- Request Device Capture: takes a photo, shows it in the page
- Run Model: photo + prediction, motors do not move
- Sort item now (device): photo + prediction + motors, then the item is saved to history

Items below `--min-conf` (default 0.5) are not sorted.

## Bin fill level (DFRobot 8x8 ToF sensor SEN0628)
Wiring to the ESP32 (3.3 V logic, sensor draws < 80 mA): VCC -> 3V3, GND -> GND, SDA -> GPIO 21, SCL -> GPIO 22.
Set the sensor's I2C switch to I2C with A0 = A1 = 1 (address 0x33), remove the yellow protective foil, power-cycle after changing switches.
Install the DFRobot_MatrixLidar library in the Arduino IDE (the firmware prints `TOF OK` at start-up).
Mount it at the top of the bin looking straight down, at least ~10 cm above the highest the waste should reach.

1. Empty bin:  `python main.py --port COM5 --fill-calibrate --full-distance 100`
   (`--full-distance` = mm from the sensor to the waste surface when the bin counts as full)
2. Run with `--fill` (add it to run.bat). After every sorted item the bin level is measured and sent to the dashboard.
3. Set `SORTER_BIN_ID` in backend/.env (or `--bin-id`) so the level goes to the right bin.
