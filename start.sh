#!/data/data/com.termux/files/usr/bin/bash
set -e

echo ""
echo "  ⬡ LAN Chat — Startup"
echo "  ────────────────────────────────"

# Detect IP
IP=$(ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | cut -d/ -f1 | head -1)
if [ -z "$IP" ]; then
  IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1)
fi
if [ -z "$IP" ]; then
  IP="127.0.0.1"
  echo "  [WARN] Could not detect LAN IP, using localhost"
fi

echo "  IP detected: $IP"

# Update frontend .env
cat > ~/chatapp/frontend/.env << ENVEOF
VITE_API_URL=https://$IP:8443
VITE_RT_URL=https://$IP:6443
ENVEOF
echo "  .env updated"

# Regenerate cert for current IP if needed
CERT=~/chatapp/cert.pem
KEY=~/chatapp/key.pem
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "  Generating HTTPS certificate..."
  openssl req -x509 -newkey rsa:2048 -keyout $KEY -out $CERT \
    -days 365 -nodes -subj "/CN=$IP" 2>/dev/null
  echo "  Certificate generated"
fi

# Copy cert to storage for other devices
cp $CERT /storage/emulated/0/lanchat-cert.pem 2>/dev/null && \
  echo "  Cert saved to storage (install on other devices)"

echo ""
echo "  ────────────────────────────────"
echo "  Start each service in a new Termux session:"
echo ""
echo "  Session 1 — API (Python Flask):"
echo "    cd ~/chatapp/data_handling && python app.py"
echo ""
echo "  Session 2 — Realtime (Node Socket.IO):"
echo "    cd ~/chatapp/realtime_msg && npm start"
echo ""
echo "  Session 3 — API HTTPS Proxy:"
echo "    node ~/chatapp/api-https.cjs"
echo ""
echo "  Session 4 — Realtime HTTPS Proxy:"
echo "    node ~/chatapp/rt-https.cjs"
echo ""
echo "  Session 5 — Frontend:"
echo "    cd ~/chatapp/frontend && npm start"
echo ""
echo "  ────────────────────────────────"
echo "  Open on any device on the same WiFi:"
echo "  https://$IP:5173"
echo ""
echo "  Install cert on other devices:"
echo "  /storage/emulated/0/lanchat-cert.pem"
echo "  ────────────────────────────────"
echo ""
