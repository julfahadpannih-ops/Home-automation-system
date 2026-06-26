# 🏠 Home Automation System

IoT-based smart home system using ESP32, Blynk Cloud, and a local PHP/MySQL dashboard with Telegram notifications.

## Project Structure

```
HOME_AUTOMATION/
├── README.md
├── firmware/
│   └── Home_auto.ino           # ESP32 sketch — relay control, DHT22, LDR, Blynk, Telegram
├── frontend/
│   ├── index.html              # Web dashboard
│   ├── css/
│   │   └── style.css           # Custom styles
│   └── js/
│       ├── tailwind.config.js  # Tailwind theme config
│       └── main.js             # Dashboard logic — login, device control, energy charts, chatbot
├── php/
│   └── api.php                 # Backend API — auth, Blynk emulation, energy log, history
└── sql/
    └── smarthome_db.sql        # DB schema — devices, device_history, energy_log, users
```

## Setup Instructions

### 1. Database
- Import `sql/smarthome_db.sql` in phpMyAdmin
- Default DB name: `smarthome_db`

### 2. Web Files
- Place `frontend/` and `php/` contents into `htdocs/home_automation/`
- Access via: `http://localhost/home_automation/index.html`

### 3. ESP32 Firmware
- Open `firmware/Home_auto.ino` in Arduino IDE
- Fill in `YOUR_*` placeholders
- Required libraries: Blynk, UniversalTelegramBot, DHT, Adafruit Unified Sensor

## Credentials to Configure (`firmware/Home_auto.ino`)

| Placeholder | Where to get it |
|---|---|
| `YOUR_BLYNK_AUTH_TOKEN` | Blynk Console → Device Info |
| `YOUR_WIFI_SSID` | Your WiFi name |
| `YOUR_WIFI_PASSWORD` | Your WiFi password |
| `YOUR_TELEGRAM_BOT_TOKEN` | @BotFather on Telegram |
| `YOUR_TELEGRAM_CHAT_ID` | Your Telegram chat ID |

## Features
- 7-relay control (4 lights + 3 fans) via Blynk and web dashboard
- DHT22 auto-fan trigger at ≥30°C
- LDR auto-light trigger at night
- Telegram notifications on device state change
- Energy consumption logging and charts
- Local activity history log
