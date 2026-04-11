# Setup Guide

## Requirements
- Android phone with Termux
- Python 3, Node.js, Git, OpenSSL installed

## Installation
```bash
git clone https://github.com/lethabokhedama-png/lan-chatapp.git
cd lan-chatapp
pip install flask flask-cors waitress --break-system-packages
cd realtime_msg && npm install && cd ..
cd frontend && npm install && cd ..
```

## Starting
```bash
# 1. Detect and update IP
bash detect-ip.sh

# 2. Build frontend
cd frontend && npm run build && cd ..

# 3. Start API (Session 1)
cd data_handling && python app.py

# 4. Start Realtime (Session 2)
cd realtime_msg && npm start

# 5. Start Frontend (Session 3)
node frontend/serve.cjs
```

## Other Devices
Open Chrome on any device on the same WiFi:
https://YOUR_IP:5173

Install cert if needed:
Settings → Security → Install certificate → CA → lanchat-cert.pem
