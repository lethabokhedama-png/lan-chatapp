#!/data/data/com.termux/files/usr/bin/bash
node ~/chatapp/rt-https.cjs &
PROXY=$!
echo "  [RT-HTTPS] proxy started"
cd ~/chatapp/realtime_msg
npm start
kill $PROXY 2>/dev/null
