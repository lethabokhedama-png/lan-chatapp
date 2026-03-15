#!/data/data/com.termux/files/usr/bin/bash

# ── Detect IP ────────────────────────────────────────────
IP=$(ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" \
  | awk '{print $2}' | cut -d/ -f1 | head -1)
[ -z "$IP" ] && IP="127.0.0.1"

echo "  IP: $IP"

# ── Update ALL .env files ─────────────────────────────────
cat > ~/chatapp/frontend/.env << ENVEOF
VITE_API_URL=https://$IP:8443
VITE_RT_URL=https://$IP:6443
ENVEOF

# ── Regenerate cert if missing or IP changed ──────────────
CERT=~/chatapp/cert.pem
KEY=~/chatapp/key.pem
CURRENT=$(openssl x509 -noout -subject -in $CERT 2>/dev/null | grep -o "CN=[^,/]*" | cut -d= -f2)
if [ "$CURRENT" != "$IP" ] || [ ! -f "$CERT" ]; then
  echo "  Generating cert for $IP..."
  openssl req -x509 -newkey rsa:2048 -keyout $KEY -out $CERT \
    -days 365 -nodes -subj "/CN=$IP" 2>/dev/null
  cp $CERT /storage/emulated/0/lanchat-cert.pem 2>/dev/null
  echo "  Cert saved — install lanchat-cert.pem on other devices"
fi

# ── Build frontend ────────────────────────────────────────
echo "  Building frontend..."
cd ~/chatapp/frontend && npm run build

# ── Launch all services in tmux ───────────────────────────
SESSION="lanchat"
tmux kill-session -t $SESSION 2>/dev/null

tmux new-session  -d -s $SESSION -x 220 -y 50

# Pane 0 — Flask API
tmux send-keys -t $SESSION \
  "cd ~/chatapp/data_handling && python app.py" Enter

# Pane 1 — Socket.IO realtime
tmux split-window -t $SESSION -v
tmux send-keys -t $SESSION \
  "cd ~/chatapp/realtime_msg && npm start" Enter

# Pane 2 — API HTTPS proxy
tmux split-window -t $SESSION -h
tmux send-keys -t $SESSION \
  "node ~/chatapp/api-https.cjs" Enter

# Pane 3 — Realtime HTTPS proxy
tmux select-pane -t $SESSION:0.0
tmux split-window -t $SESSION -h
tmux send-keys -t $SESSION \
  "node ~/chatapp/rt-https.cjs" Enter

# Pane 4 — Frontend HTTPS server
tmux select-pane -t $SESSION:0.1
tmux split-window -t $SESSION -h
tmux send-keys -t $SESSION \
  "node ~/chatapp/frontend/serve.cjs" Enter

echo ""
echo "  All services started in tmux session: $SESSION"
echo "  To view logs: tmux attach -t $SESSION"
echo "  To stop all:  tmux kill-session -t $SESSION"
echo ""
echo "  Open: https://$IP:5173"
echo ""

tmux attach -t $SESSION
