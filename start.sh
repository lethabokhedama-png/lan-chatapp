#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "  LAN Chat — Starting"
echo "  ────────────────────"

# Use ifconfig since ip doesn't work on this device
IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1)

if [ -z "$IP" ] || [ "$IP" = "127.0.0.1" ]; then
  echo "  Could not detect IP. Enter manually:"
  read -p "  IP: " IP
fi

echo "  IP: $IP"

cat > ~/chatapp/frontend/.env << ENVEOF
VITE_API_URL=https://$IP:8443
VITE_RT_URL=https://$IP:6443
ENVEOF
echo "  .env updated"

CERT=~/chatapp/cert.pem
KEY=~/chatapp/key.pem
CURRENT=$(openssl x509 -noout -subject -in $CERT 2>/dev/null | grep -o "CN=[^,/]*" | cut -d= -f2)
if [ "$CURRENT" != "$IP" ] || [ ! -f "$CERT" ]; then
  openssl req -x509 -newkey rsa:2048 -keyout $KEY -out $CERT \
    -days 365 -nodes -subj "/CN=$IP" 2>/dev/null
  cp $CERT /storage/emulated/0/lanchat-cert.pem 2>/dev/null
  echo "  Cert for $IP saved to storage"
fi

echo "  Building frontend..."
cd ~/chatapp/frontend && npm run build

pkg install tmux -y 2>/dev/null | grep -v "already\|Nothing" | tail -1

SESSION="lanchat"
tmux kill-session -t $SESSION 2>/dev/null || true
tmux new-session  -d -s $SESSION -x 220 -y 50
tmux send-keys    -t $SESSION "bash ~/chatapp/run-api.sh" Enter
tmux split-window -t $SESSION -v
tmux send-keys    -t $SESSION "bash ~/chatapp/run-rt.sh" Enter
tmux split-window -t $SESSION -h
tmux send-keys    -t $SESSION "node ~/chatapp/frontend/serve.cjs" Enter

echo ""
echo "  Open: https://$IP:5173"
echo "  Logs: tmux attach -t $SESSION"
echo "  Stop: tmux kill-session -t $SESSION"
echo ""
tmux attach -t $SESSION
