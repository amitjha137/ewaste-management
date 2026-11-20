import cv2
import time
import requests
from ultralytics import YOLO

# ==========================================
# CONFIGURATION
# ==========================================

BACKEND_URL = "https://ewaste-backend-14z2.onrender.com/api/events"

CONFIDENCE = 0.4
STABLE_TIME = 2.0
CLEAR_SCENE_TIME = 3.0
DISAPPEAR_TIME = 1.5

# ==========================================
# CATEGORY AVERAGE WEIGHTS (GRAMS)
# ==========================================

weight_mapping = {
    "phones": 150,
    "laptops": 1800,
    "tablets": 530,
    "batteries": 250,
    "chargers": 60,
    "cables": 25,
    "monitors": 4500,
    "keyboards": 450,
    "other": 300,
    "headphones": 250,
    "mouse": 90,
    "pcbs": 100,
    "printers": 3000,
    "remote_controls": 120,
    "smartwatches": 40
}

# ==========================================
# YOLO LABELS -> WEBSITE CATEGORIES
# ==========================================

category_mapping = {
    "cell phone": "phones",
    "laptop": "laptops",
    "keyboard": "keyboards",
    "mouse": "mouse",
    "remote": "remote_controls"
}

# ==========================================
# LOAD YOLO MODEL
# ==========================================

print("Loading YOLO model...")

model = YOLO("yolov8n.pt")

# ==========================================
# START CAMERA
# ==========================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Webcam not detected!")
    exit()

print("\n===================================")
print(" E-WASTE AUTOMATIC DETECTION STARTED")
print("===================================")
print("Place an object in front of camera.")
print("Press Q to close.\n")

# ==========================================
# DETECTION VARIABLES
# ==========================================

current_object = None
object_start_time = None
last_seen_time = None

event_sent = False
detection_locked = False
clear_scene_start = None

# ==========================================
# MAIN LOOP
# ==========================================

while True:

    ret, frame = cap.read()

    if not ret:
        print("Camera frame unavailable.")
        break

    results = model(frame, conf=CONFIDENCE, verbose=False)

    detected_object = None
    detected_confidence = 0

    # --------------------------------------
    # FIND SUPPORTED OBJECT
    # --------------------------------------

    for box in results[0].boxes:

        class_id = int(box.cls[0])
        object_name = model.names[class_id]
        confidence = float(box.conf[0])

        if object_name in category_mapping:

            if confidence > detected_confidence:

                detected_object = object_name
                detected_confidence = confidence

    current_time = time.time()

    # ======================================
    # LOCK SYSTEM
    # ======================================

    if detection_locked:

        if detected_object is None:

            if clear_scene_start is None:
                clear_scene_start = current_time

            clear_duration = current_time - clear_scene_start

            if clear_duration >= CLEAR_SCENE_TIME:

                print("\nScene cleared!")
                print("Ready for next object.\n")

                detection_locked = False

                current_object = None
                object_start_time = None
                last_seen_time = None

                event_sent = False
                clear_scene_start = None

        else:

            # Object still visible
            clear_scene_start = None

    # ======================================
    # NORMAL DETECTION
    # ======================================

    else:

        if detected_object is not None:

            last_seen_time = current_time

            if detected_object != current_object:

                current_object = detected_object
                object_start_time = current_time
                event_sent = False

                print("New object detected:", current_object)

            # ----------------------------------
            # WAIT FOR STABLE DETECTION
            # ----------------------------------

            if not event_sent:

                elapsed = current_time - object_start_time

                if elapsed >= STABLE_TIME:

                    category = category_mapping[current_object]

                    estimated_weight = weight_mapping[category]

                    print("\n--------------------------------")
                    print("OBJECT:", current_object)
                    print("CATEGORY:", category)
                    print("CONFIDENCE:", round(detected_confidence, 2))
                    print("ESTIMATED WEIGHT:", estimated_weight, "grams")

                    # ----------------------------------
                    # CREATE BACKEND PAYLOAD
                    # ----------------------------------

                    payload = {
                        "type": "deposit",
                        "category": category,
                        "amount": estimated_weight / 1000,
                        "estimatedWeightGrams": estimated_weight,
                        "source": "camera",
                        "label": current_object,
                        "confidence": detected_confidence,
                        "details": "Automatically detected by YOLO camera"
                    }

                    # Lock immediately to avoid duplicate requests
                    event_sent = True
                    detection_locked = True
                    clear_scene_start = None

                    # ----------------------------------
                    # SEND EVENT
                    # ----------------------------------

                    try:

                        response = requests.post(
                            BACKEND_URL,
                            json=payload,
                            timeout=45
                        )

                        if response.status_code == 201:

                            print("SUCCESS: Event saved to website!")

                        else:

                            print("Backend error:", response.status_code)
                            print(response.text)

                    except requests.RequestException as error:

                        print("Connection error:", error)

                    print("--------------------------------\n")

        # --------------------------------------
        # OBJECT DISAPPEARED BEFORE EVENT
        # --------------------------------------

        else:

            if last_seen_time is not None:

                if current_time - last_seen_time >= DISAPPEAR_TIME:

                    current_object = None
                    object_start_time = None
                    last_seen_time = None
                    event_sent = False

    # ======================================
    # DISPLAY CAMERA
    # ======================================

    annotated_frame = results[0].plot()

    if detection_locked:

        status_text = "EVENT SENT - WAITING FOR CLEAR SCENE"

        cv2.putText(
            annotated_frame,
            status_text,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 165, 255),
            2
        )

    elif current_object is not None:

        cv2.putText(
            annotated_frame,
            "Detected: " + current_object,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2
        )

    else:

        cv2.putText(
            annotated_frame,
            "Waiting for object...",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2
        )

    cv2.imshow(
        "E-Waste AI Automatic Detection",
        annotated_frame
    )

    key = cv2.waitKey(1) & 0xFF

    if key == ord('q'):
        break

# ==========================================
# RELEASE CAMERA
# ==========================================

cap.release()
cv2.destroyAllWindows()

print("Camera stopped.")