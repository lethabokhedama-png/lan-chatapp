#!/data/data/com.termux/files/usr/bin/bash
node ~/chatapp/api-https.cjs &
PROXY=$!
echo "  [API-HTTPS] proxy started"
cd ~/chatapp/data_handling
python app.py
kill $PROXY 2>/dev/null
