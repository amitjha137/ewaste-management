import cv2

# Open USB Webcam
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Webcam not detected!")
    exit()

print("Webcam started successfully!")
print("Press Q to close the camera.")

while True:
    ret, frame = cap.read()

    if not ret:
        print("Cannot read webcam frame")
        break

    cv2.imshow("E-Waste Webcam Test", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()