#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "  LAN Chat — Starting"
echo "  ────────────────────"

IP=$(ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" \
  | awk '{print $2}' | cut -d/ -f1 | head -1)
[ -z "$IP" ] && IP="127.0.0.1"
echo "  IP: $IP"

# Update .env
cat > ~/chatapp/frontend/.env << ENVEOF
VITE_API_URL=https://$IP:8000
VITE_RT_URL=https://$IP:6767
ENVEOF

# Regenerate cert if IP changed
CERT=~/chatapp/cert.pem
KEY=~/chatapp/key.pem
CURRENT=$(openssl x509 -noout -subject -in $CERT 2>/dev/null \
  | grep -o "CN=[^,/]*" | cut -d= -f2)
if [ "$CURRENT" != "$IP" ] || [ ! -f "$CERT" ]; then
  echo "  Generating cert for $IP..."
  openssl req -x509 -newkey rsa:2048 -keyout $KEY -out $CERT \
    -days 365 -nodes -subj "/CN=$IP" 2>/dev/null
  cp $CERT /storage/emulated/0/lanchat-cert.pem 2>/dev/null && \
    echo "  Cert saved — install lanchat-cert.pem on other devices"
fi

# Build frontend
echo "  Building frontend..."
cd ~/chatapp/frontend && npm run build

# Launch in tmux — 3 panes
pkg install tmux -y 2>/dev/null | grep -v "already installed" || true

SESSION="lanchat"
tmux kill-session -t $SESSION 2>/dev/null || true
tmux new-session  -d -s $SESSION -x 220 -y 50

# Pane 0 — Flask API (HTTPS on :8000)
tmux send-keys -t $SESSION \
  "cd ~/chatapp/data_handling && python app.py" Enter

# Pane 1 — Socket.IO (HTTPS on :6767)
tmux split-window -t $SESSION -v
tmux send-keys -t $SESSION \
  "cd ~/chatapp/realtime_msg && npm start" Enter

# Pane 2 — Frontend (HTTPS on :5173)
tmux split-window -t $SESSION -h
tmux send-keys -t $SESSION \
  "node ~/chatapp/frontend/serve.cjs" Enter

echo ""
echo "  Sessions: API :8000  RT :6767  Frontend :5173"
echo "  Open:     https://$IP:5173"
echo "  Logs:     tmux attach -t $SESSION"
echo "  Stop:     tmux kill-session -t $SESSION"
echo ""

tmux attach -t $SESSION
