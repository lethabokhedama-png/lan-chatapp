#!/data/data/com.termux/files/usr/bin/bash
# Start HTTPS proxy in background
node ~/chatapp/api-https.cjs &
PROXY_PID=$!
echo "  [API-HTTPS] Proxy started (pid=$PROXY_PID)"

# Start Flask
cd ~/chatapp/data_handling
python app.py

# Kill proxy when Flask stops
kill $PROXY_PID 2>/dev/null
