# Waste Segregation AI Machine

An embedded AI system that automatically sorts waste into three categories — **Biodegradable**, **Non-Biodegradable**, and **Recyclable** — using a live camera feed, YOLOv8 object detection, and an ESP32-CAM-controlled mechanical sorting mechanism.

---

## How It Works

1. The ESP32-CAM streams a live MJPEG feed over Wi-Fi
2. A Python script running on a PC reads each frame in real time
3. YOLOv8 detects objects in the frame and maps them to a waste category
4. Once detected with ≥65% confidence, a sort command is sent to the ESP32 via HTTP
5. The ESP32 triggers the motors — a stepper motor rotates the bin to the correct compartment, then a servo drops the waste in
6. If a bin reaches 3 items, a Telegram notification is sent alerting that it's full

---

## Hardware

| Component | Purpose |
|---|---|
| ESP32-CAM (AI Thinker) | Camera stream + Wi-Fi server + motor control |
| Servo Motor | Drops the waste (flap mechanism) |
| 28BYJ-48 Stepper + ULN2003 | Rotates the bin to the correct compartment |
| Wi-Fi Network | Communication between ESP32 and PC |

---

## Software

| Layer | Technology |
|---|---|
| Microcontroller firmware | Arduino C++ (ESP32) |
| AI detection | Python + YOLOv8 (`ultralytics`) |
| Computer vision | OpenCV |
| Multitasking (ESP32) | FreeRTOS — motors run on Core 1, camera/Wi-Fi on Core 0 |
| Notifications | Telegram Bot API (HTTP GET) |

---

## Waste Categories & Object Mapping

| Waste Type | Detected Objects |
|---|---|
| **Biodegradable** | apple, banana, orange, carrot, broccoli, potted plant |
| **Recyclable** | bottle, cup, can, box |
| **Non-Biodegradable** | cell phone, mouse, remote, keyboard, scissors, toothbrush |

> Uses YOLOv8n (nano) — the pre-trained COCO model. No custom training needed for basic detection.

---

## Project Structure

```
WASTE/
├── WASTE.ino           # ESP32-CAM firmware — camera server, motor control, Telegram alerts
├── segregation_ai.py   # PC-side AI detection — YOLOv8 + OpenCV + sort command sender
├── yolov8n.pt          # Pre-trained YOLOv8 nano model weights
└── run.txt             # How to run the Python script
```

---

## Setup

### ESP32 Firmware (`WASTE.ino`)

1. Open in Arduino IDE with ESP32 board support installed
2. Install required libraries:
   - `esp32cam`
   - `ESP32Servo`
   - `Stepper`
3. Set your Wi-Fi credentials and Telegram bot token:
```cpp
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";
String BOT_TOKEN = "your-telegram-bot-token";
String CHAT_ID = "your-chat-id";
```
4. Flash to ESP32-CAM, open Serial Monitor at 115200 baud
5. Note the IP address printed — you'll need it for the Python script

### Python AI Script (`segregation_ai.py`)

1. Install dependencies:
```bash
pip install ultralytics opencv-python requests numpy
```
2. Update the ESP32 IP in the script:
```python
ESP32_IP = "your-esp32-ip"
```
3. Make sure `yolov8n.pt` is in the same folder, then run:
```bash
python segregation_ai.py
```

---

## Key Design Decisions

**FreeRTOS dual-core pinning** — Motor sorting runs on Core 1 while the camera server handles requests on Core 0. This prevents the motors from blocking the HTTP server, which would freeze the live feed.

**Non-blocking camera stream** — The Python script uses a background thread (`VideoStream` class) to continuously pull frames from the ESP32. This keeps the AI detection loop smooth without waiting for each HTTP request.

**Cooldown system** — After a sort command is sent, a 5-second cooldown prevents the same object from triggering multiple sorts while the motors are still moving.

**Telegram full-bin alerts** — Each bin tracks its own count. After every 3 items sorted into a bin, a Telegram message is sent. The counter resets after the alert.

---

## Limitations

- Relies on YOLOv8's pre-trained COCO classes — objects not in the mapping are ignored
- Detection accuracy depends on lighting and camera angle
- PC must be on the same Wi-Fi network as the ESP32 during operation

---

## About This Project

Built as a personal embedded systems + AI project combining hardware control and computer vision. The goal was to make the sorting mechanism truly non-blocking — camera, Wi-Fi, and motors all running independently without freezing each other.

---

## Author

**Julfahad** — Freelance Developer | Embedded Systems + AI Integration
