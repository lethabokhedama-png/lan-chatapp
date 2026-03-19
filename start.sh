#!/data/data/com.termux/files/usr/bin/bash

echo ""
echo "  ⬡ LAN Chat — Starting up"
echo "  ─────────────────────────"

# Detect IP using ifconfig
IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1)

if [ -z "$IP" ] || [ "$IP" = "127.0.0.1" ]; then
  echo "  Could not detect IP. Enter manually:"
  read -p "  IP: " IP
fi

echo "  IP: $IP"

# Update .env
cat > ~/chatapp/frontend/.env << ENVEOF
VITE_API_URL=https://$IP:8443
VITE_RT_URL=https://$IP:6443
ENVEOF
echo "  .env updated"

# Generate cert if IP changed or cert missing
CERT=~/chatapp/cert.pem
KEY=~/chatapp/key.pem
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "  Generating certificate for $IP..."
  openssl req -x509 -newkey rsa:2048 -keyout $KEY -out $CERT \
    -days 365 -nodes -subj "/CN=$IP" 2>/dev/null
  echo "  Certificate generated"
  cp $CERT /storage/emulated/0/lanchat-cert.pem 2>/dev/null && echo "  Cert saved to storage"
else
  echo "  Certificate exists — skipping"
fi

# Build frontend
echo "  Building frontend..."
cd ~/chatapp/frontend
npm run build
if [ $? -ne 0 ]; then
  echo "  Build failed — check errors above"
  exit 1
fi
echo "  Build complete"

# Start services
echo ""
echo "  Starting services..."

# Kill old tmux session if exists
tmux kill-session -t lanchat 2>/dev/null
sleep 1

# Start in tmux
tmux new-session  -d -s lanchat -x 220 -y 50
tmux send-keys    -t lanchat "echo '[1/3] API'; bash ~/chatapp/run-api.sh" Enter
tmux split-window -t lanchat -v
tmux send-keys    -t lanchat "echo '[2/3] Realtime'; bash ~/chatapp/run-rt.sh" Enter
tmux split-window -t lanchat -h
tmux send-keys    -t lanchat "echo '[3/3] Frontend'; node ~/chatapp/frontend/serve.cjs" Enter

echo ""
echo "  ─────────────────────────"
echo "  Open on any device:"
echo "  https://$IP:5173"
echo ""
echo "  View logs:  tmux attach -t lanchat"
echo "  Stop all:   tmux kill-session -t lanchat"
echo "  ─────────────────────────"
echo ""

tmux attach -t lanchat
