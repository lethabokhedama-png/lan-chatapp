#!/data/data/com.termux/files/usr/bin/bash
# Start HTTPS proxy in background
node ~/chatapp/rt-https.cjs &
PROXY_PID=$!
echo "  [RT-HTTPS] Proxy started (pid=$PROXY_PID)"

# Start Socket.IO
cd ~/chatapp/realtime_msg
npm start

# Kill proxy when Socket.IO stops
kill $PROXY_PID 2>/dev/null
