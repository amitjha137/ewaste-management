# Changes made for the laptop + ESP32 sorter

## Backend
- routes/sorter.js (new): POST /api/sorter/result saves each sorted item (deposit event, bin level estimate, live `sortResult` + `binStatusUpdate` socket events). Works (202) even if MongoDB is down.
- routes/iot.js: now the one mounted at /api/iot (capture, run-model, NEW sort). The old iot/iot.js, iot/run_model.js, iot/run-model.js were removed: capture never reached the device, and Run Model returned random fake labels.
- utils/categories.js (new): label -> web category and sorter compartment (1-5). Event/Bin enums extended with headphones, mouse, pcbs, printers, remote_controls, smartwatches.
- utils/deviceAuth.js (new): one token check shared by the socket registration and the REST route.
- models/Bin.js: qrCode index is now sparse (a second bin without a QR code no longer fails).
- routes/bin.js: bin updates now emit `binStatusUpdate` (the duplicate PUT in index.js never ran).
- utils/deviceTokens.js: Windows-safe path for device_tokens.json.
- index.js: socket buffer raised to 5 MB for photos; routes re-mounted.
- model_service/app.py: loads .pth or TorchScript .pt; returns category + compartment; requirements.txt added.
- .env.example: new variables.  backend/.env was NOT included (see note below).

## Frontend
- api.js / socket.js / iot.js: no more hard-coded onrender.com; default to the page origin.
- config.js included in every page.
- rewards.js: new categories. iot.js + bin-user.html: "Sort item now (device)" button, live sort result, "Sorter: online/offline" status.

## New: sorter/ (laptop client + ESP32 firmware)

## Security note
The original zip contained backend/.env with real credentials. Rotate those secrets (MongoDB password, mail/SMS keys, JWT secret) and keep .env out of zips and git.

## Fill level (ToF sensor)
- sorter/fill.py (new): converts the 8x8 distances to a fill percentage (per-pixel empty-bin baseline, wall pixels ignored, invalid pixels ignored, percentile of the pile, hysteresis on "full").
- ESP32 firmware: new `MATRIX` command (I2C, GPIO 21/22).
- sorter/main.py: `--fill`, `--fill-calibrate`, `--full-distance`, `--fill-percentile`; measures after each item, sends it to the web app.
- backend: POST /api/sorter/level sets the measured level and status (FULL_LEVEL / FULL_LEVEL_CLEAR); /api/sorter/result no longer estimates the level by counting when the level is measured.
