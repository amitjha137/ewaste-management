"""
E-waste sorter - laptop side.

  webcam + ResNet50  ->  category  ->  ESP32 (stepper + servos)  ->  web app

Modes
  python main.py --port COM5                                    local only (Enter = sort next item)
  python main.py --port COM5 --backend http://localhost:5000    also connects to the web app:
        * dashboard buttons "Request Device Capture", "Run Model", "Sort item now (device)" work
        * every sorted item is saved to the dashboard history
  python main.py --port COM5 --backend ... --headless           no keyboard prompt, dashboard only

Testing without hardware
  --port fake       pretend ESP32 (answers PONG / DONE)
  --image test.jpg  use this file instead of the webcam
"""
import argparse
import base64
import datetime
import sys
import threading
import time
from pathlib import Path

import requests
import serial
import serial.tools.list_ports

from fill import FillMeter, parse_matrix

HERE = Path(__file__).resolve().parent
DEFAULT_WEIGHTS = HERE / "Model" / "resnet50_finetuned.pth"
PHOTOS = HERE / "Photos"

# Same order as training (ImageFolder = alphabetical). Must match the model!
CLASSES = ["Battery", "Headphones", "Keyboard", "Mobile", "Mouse",
           "PCBs", "Printer", "Remote Control", "Smartwatch"]

# label -> compartment (stepper position 1-5)
COMPARTMENT_MAP = {
    "Smartwatch": 1, "Mobile": 1, "Mouse": 1,
    "Headphones": 2, "Remote Control": 2,
    "Battery": 3,
    "PCBs": 4,
    "Keyboard": 5, "Printer": 5,
}


# ----------------------------------------------------------------------------
# ESP32 link
# ----------------------------------------------------------------------------
class FakeESP32:
    """Stands in for the ESP32 when --port fake is used (also fakes the ToF sensor)."""
    def __init__(self):
        self._reply = []
        self._items = 0

    def write(self, data):
        cmd = data.decode().strip().upper()
        time.sleep(0.2)
        if cmd == "PING":
            self._reply.append("PONG")
        elif cmd == "MATRIX":
            d = max(110, 400 - 20 * self._items)       # pile rises 20 mm per item
            self._reply.append("MATRIX " + ",".join([str(d)] * 64))
        else:
            if cmd.startswith("CAT"):
                self._items += 1
            self._reply.append("DONE")

    def readline(self):
        return (self._reply.pop(0) + "\n").encode() if self._reply else b""

    def reset_input_buffer(self):
        pass

    def close(self):
        pass


def open_esp32(port):
    if port.lower() == "fake":
        return FakeESP32()
    ser = serial.Serial(port, 115200, timeout=1)
    time.sleep(2)                      # the ESP32 resets when the port opens
    ser.reset_input_buffer()
    return ser


def ask(ser, command, wait=60, prefix=None):
    """Send one command line to the ESP32 and return its reply line.
    Returns PONG / DONE / ERR..., or a line starting with `prefix` (e.g. MATRIX)."""
    ser.write((command + "\n").encode())
    end = time.time() + wait
    while time.time() < end:
        line = ser.readline().decode(errors="ignore").strip()
        if line in ("PONG", "DONE") or line.startswith("ERR"):
            return line
        if prefix and line.startswith(prefix):
            return line
    return "TIMEOUT"


# ----------------------------------------------------------------------------
# Sorter: camera + model + motors. One operation at a time (lock).
# ----------------------------------------------------------------------------
class Sorter:
    def __init__(self, ser, weights, camera_index=0, image=None, min_conf=0.5, fill=None):
        self.ser = ser
        self.weights = Path(weights)
        self.camera_index = camera_index
        self.image = Path(image) if image else None
        self.min_conf = min_conf
        self.fill = fill              # FillMeter or None
        self.model = None
        self.lock = threading.Lock()

    # -- model -----------------------------------------------------------
    def load_model(self):
        if self.model is not None:
            return
        import torch
        from torchvision import models, transforms
        if not self.weights.exists():
            raise FileNotFoundError(f"Model file not found: {self.weights}")
        if self.weights.suffix.lower() == ".pt":
            model = torch.jit.load(str(self.weights), map_location="cpu")
        else:
            model = models.resnet50()
            model.fc = torch.nn.Linear(model.fc.in_features, len(CLASSES))
            state = torch.load(str(self.weights), map_location="cpu")
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            model.load_state_dict(state)
        model.eval()
        self.model = model
        self._torch = torch
        self._preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

    def classify(self, path):
        from PIL import Image
        self.load_model()
        x = self._preprocess(Image.open(path).convert("RGB")).unsqueeze(0)
        with self._torch.inference_mode():
            probs = self._torch.softmax(self.model(x), dim=1)[0]
            conf, idx = self._torch.max(probs, 0)
        return CLASSES[idx.item()], float(conf.item())

    # -- camera ----------------------------------------------------------
    def capture(self):
        """Returns the saved image path, or None."""
        if self.image:
            return self.image
        import cv2
        PHOTOS.mkdir(exist_ok=True)
        backend = cv2.CAP_DSHOW if sys.platform.startswith("win") else cv2.CAP_ANY
        cam = cv2.VideoCapture(self.camera_index, backend)
        if not cam.isOpened():
            print("Camera not found (try --camera 1).")
            return None
        cam.set(3, 1280)
        cam.set(4, 720)
        time.sleep(2)                  # auto exposure / white balance
        frame = None
        for _ in range(8):             # drop buffered frames
            ok, frame = cam.read()
            if not ok:
                cam.release()
                return None
        cam.release()
        path = PHOTOS / f"captured_{datetime.datetime.now():%Y%m%d_%H%M%S}.png"
        cv2.imwrite(str(path), frame)
        return path

    @staticmethod
    def jpeg_b64(path, max_width=800):
        """Small JPEG (base64) for the web app preview."""
        import cv2
        img = cv2.imread(str(path))
        if img is None:
            return None
        h, w = img.shape[:2]
        if w > max_width:
            img = cv2.resize(img, (max_width, int(h * max_width / w)))
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 70])
        return base64.b64encode(buf.tobytes()).decode() if ok else None

    # -- bin fill level (ToF sensor on the ESP32) -------------------------
    def read_frames(self, n=8, gap=0.15):
        frames = []
        for _ in range(n):
            f = parse_matrix(ask(self.ser, "MATRIX", wait=3, prefix="MATRIX"))
            if f is not None:
                frames.append(f)
            time.sleep(gap)
        return frames

    def calibrate_fill(self, n=15):
        """Bin must be EMPTY."""
        frames = self.read_frames(n)
        if len(frames) < 5:
            raise RuntimeError("ESP32 did not return sensor data (check wiring, MATRIX command, I2C address).")
        return self.fill.calibrate(frames)

    def measure_fill(self):
        frames = self.read_frames(8)
        if len(frames) < 4:
            return None
        return self.fill.level(frames)

    # -- operations (all take the lock) -----------------------------------
    def look(self):
        """Photo + classification, no motors."""
        with self.lock:
            return self._look()

    def _look(self):
        t0 = time.time()
        path = self.capture()
        if path is None:
            return {"ok": False, "error": "capture_failed"}
        label, conf = self.classify(path)
        return {
            "ok": True, "path": path, "label": label, "confidence": conf,
            "compartment": COMPARTMENT_MAP.get(label),
            "seconds": round(time.time() - t0, 1),
        }

    def sort_once(self):
        """Photo + classification + move the item to its compartment."""
        with self.lock:
            res = self._look()
            if not res["ok"]:
                return res
            res["sorted"] = False
            if res["compartment"] is None:
                res["note"] = "no compartment for this label"
            elif res["confidence"] < self.min_conf:
                res["note"] = f"confidence below {self.min_conf}: not sorted"
            elif self.ser is None:
                res["note"] = "no ESP32 (--no-esp32): not moved"
            else:
                reply = ask(self.ser, f"CAT {res['compartment']}")
                res["esp32"] = reply
                res["sorted"] = (reply == "DONE")
                if not res["sorted"]:
                    res["note"] = f"ESP32 replied {reply}"
                elif self.fill is not None:
                    time.sleep(1.5)                 # let the item settle before measuring
                    try:
                        res["fill"] = self.measure_fill()
                    except Exception as e:
                        print("Fill measurement failed:", e)
            return res


# ----------------------------------------------------------------------------
# Web app link (optional)
# ----------------------------------------------------------------------------
class WebLink:
    def __init__(self, sorter, backend, name, token, bin_id=None):
        import socketio
        self.sorter = sorter
        self.backend = backend.rstrip("/")
        self.name = name
        self.token = token or ""
        self.bin_id = bin_id
        self.sio = socketio.Client(reconnection=True)
        self.registered = threading.Event()
        self._wire()

    def _wire(self):
        sio = self.sio

        @sio.event
        def connect():
            print("[web] connected, registering as", self.name)
            sio.emit("register_device", {"name": self.name, "token": self.token})

        @sio.on("register_success")
        def _ok(_d):
            print("[web] registered. Dashboard buttons are now live.")
            self.registered.set()

        @sio.on("register_error")
        def _err(d):
            print("[web] registration refused:", d, "(check --token / DEVICE_TOKENS)")

        @sio.event
        def disconnect():
            print("[web] disconnected (will retry)")
            self.registered.clear()

        @sio.on("capture")
        def on_capture(data):
            rid = (data or {}).get("requestId")
            print("[web] capture requested")
            try:
                with self.sorter.lock:
                    path = self.sorter.capture()
                if path is None:
                    raise RuntimeError("capture failed")
                sio.emit("iot-photo", {"requestId": rid, "imageBase64": self.sorter.jpeg_b64(path), "device": self.name})
            except Exception as e:
                sio.emit("iot-photo", {"requestId": rid, "error": str(e), "device": self.name})

        @sio.on("run_model")
        def on_run_model(data):
            rid = (data or {}).get("requestId")
            print("[web] run_model requested")
            self._look_and_report(rid, move=False)

        @sio.on("sort")
        def on_sort(data):
            rid = (data or {}).get("requestId")
            print("[web] sort requested")
            self._look_and_report(rid, move=True, bin_id=(data or {}).get("binId"))

    def _look_and_report(self, rid, move, bin_id=None):
        try:
            res = self.sorter.sort_once() if move else self.sorter.look()
        except Exception as e:
            self.sio.emit("iot-model-result", {"requestId": rid, "error": str(e), "device": self.name})
            return
        report_result(res)
        self.publish(res, rid)
        if move and res.get("sorted"):
            self.post_result(res, bin_id, measured=bool(res.get("fill")))
            self.post_level(res.get("fill"), bin_id)

    def publish(self, res, rid=None):
        """Show the photo and the prediction on the dashboard."""
        if not res.get("ok"):
            self.sio.emit("iot-model-result", {"requestId": rid, "error": res.get("error", "failed"), "device": self.name})
            return
        try:
            b64 = self.sorter.jpeg_b64(res["path"])
            if b64:
                self.sio.emit("iot-photo", {"requestId": rid, "imageBase64": b64, "device": self.name})
        except Exception as e:
            print("[web] photo preview failed:", e)
        self.sio.emit("iot-model-result", {
            "requestId": rid, "label": res["label"], "confidence": res["confidence"],
            "compartment": res.get("compartment"), "sorted": res.get("sorted", False),
            "source": "sorter", "device": self.name,
        })

    def post_result(self, res, bin_id=None, measured=False):
        """Save the sorted item to the dashboard history."""
        try:
            r = requests.post(
                f"{self.backend}/api/sorter/result",
                json={"label": res["label"], "confidence": res["confidence"],
                      "compartment": res.get("compartment"),
                      "binId": bin_id or self.bin_id, "deviceName": self.name,
                      "measured": measured},
                headers={"x-device-token": self.token}, timeout=10)
            print(f"[web] result saved: HTTP {r.status_code}", r.json() if r.ok or r.status_code == 202 else r.text[:200])
        except Exception as e:
            print("[web] could not save result:", e)

    def post_level(self, fill, bin_id=None):
        """Send the measured fill level of the bin to the dashboard."""
        if not fill:
            return
        try:
            r = requests.post(
                f"{self.backend}/api/sorter/level",
                json={"binId": bin_id or self.bin_id, "level": fill["level"], "deviceName": self.name},
                headers={"x-device-token": self.token}, timeout=10)
            print(f"[web] fill level sent: {fill['level']} % -> HTTP {r.status_code}")
        except Exception as e:
            print("[web] could not send fill level:", e)

    def start(self):
        self.sio.connect(self.backend, wait_timeout=10)
        self.registered.wait(timeout=10)

    def stop(self):
        try:
            self.sio.disconnect()
        except Exception:
            pass


def report_result(res):
    if not res.get("ok"):
        print("Failed:", res.get("error"))
        return
    print(f"Prediction: {res['label']} (confidence {res['confidence']:.2f}) -> compartment {res['compartment']}")
    if "sorted" in res:
        print("Sorted." if res["sorted"] else f"Not sorted: {res.get('note', '')}")
    if res.get("fill"):
        f = res["fill"]
        print(f"Bin fill: {f['level']} % ({f['status']})")
    print(f"Took {res['seconds']} s")


# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="E-waste sorter (laptop side)")
    ap.add_argument("--port", help="ESP32 serial port (COM5, /dev/ttyUSB0) or 'fake'")
    ap.add_argument("--list", action="store_true", help="list serial ports and exit")
    ap.add_argument("--test", action="store_true", help="ping the ESP32 and exit")
    ap.add_argument("--no-esp32", action="store_true", help="camera + model only, no motors")
    ap.add_argument("--weights", default=str(DEFAULT_WEIGHTS), help="model file (.pth or TorchScript .pt)")
    ap.add_argument("--camera", type=int, default=0, help="camera index")
    ap.add_argument("--image", help="use this image file instead of the webcam (testing)")
    ap.add_argument("--min-conf", type=float, default=0.5, help="below this confidence nothing is sorted")
    ap.add_argument("--backend", help="web app URL, e.g. http://localhost:5000")
    ap.add_argument("--name", default="sorter-laptop", help="device name shown in the web app")
    ap.add_argument("--token", default="", help="device token (DEVICE_TOKENS in backend/.env)")
    ap.add_argument("--bin-id", help="bin _id the sorted items are added to")
    ap.add_argument("--fill", action="store_true", help="measure the bin fill level with the ToF sensor after each item")
    ap.add_argument("--fill-calibrate", action="store_true", help="EMPTY bin: measure and save the baseline, then exit")
    ap.add_argument("--full-distance", type=float, default=100.0, help="mm from sensor to the waste surface when the bin is full")
    ap.add_argument("--fill-percentile", type=float, default=80.0, help="which part of the pile counts (80 = fuller 20 %% of the area)")
    ap.add_argument("--headless", action="store_true", help="no keyboard prompt; wait for dashboard commands")
    args = ap.parse_args()

    if args.list:
        for p in serial.tools.list_ports.comports():
            print(p.device, "-", p.description)
        return

    ser = None
    if not args.no_esp32:
        if not args.port:
            sys.exit("Give --port COMx (see --list), --port fake, or --no-esp32")
        ser = open_esp32(args.port)
        print("ESP32 says:", ask(ser, "PING", wait=5))
        if args.test:
            return

    fill = None
    if args.fill or args.fill_calibrate:
        if ser is None:
            sys.exit("--fill needs the ESP32 (do not use --no-esp32)")
        fill = FillMeter(args.full_distance, args.fill_percentile)
    sorter = Sorter(ser, args.weights, args.camera, args.image, args.min_conf, fill)
    if args.fill_calibrate:
        ref = sorter.calibrate_fill()
        print(f"Calibrated: empty bin = {ref:.0f} mm from the sensor, full = {args.full_distance:.0f} mm. Saved to fill_calibration.json")
        return
    if args.fill and fill.baseline is None:
        sys.exit("No calibration yet. Empty the bin and run:  python main.py --port COMx --fill-calibrate")
    print("Loading model...")
    sorter.load_model()
    print("Model ready.\n")

    link = None
    if args.backend:
        link = WebLink(sorter, args.backend, args.name, args.token, args.bin_id)
        try:
            link.start()
        except Exception as e:
            print("[web] could not connect:", e, "- continuing without the web app")
            link = None

    try:
        if args.headless:
            if not link:
                sys.exit("--headless needs a working --backend")
            print("Waiting for dashboard commands (Ctrl+C to stop)...")
            while True:
                time.sleep(1)
        while True:
            if input("Place ONE item on the tray, press Enter (q to quit): ").strip().lower() == "q":
                break
            res = sorter.sort_once()
            report_result(res)
            if link and res.get("ok"):
                link.publish(res)
                if res.get("sorted"):
                    link.post_result(res, measured=bool(res.get("fill")))
                    link.post_level(res.get("fill"))
            print()
    except KeyboardInterrupt:
        pass
    finally:
        if link:
            link.stop()
        if ser:
            ser.close()


if __name__ == "__main__":
    main()
