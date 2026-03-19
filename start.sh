#!/data/data/com.termux/files/usr/bin/bash
set -e

IP=$(ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" \
  | awk '{print $2}' | cut -d/ -f1 | head -1)
[ -z "$IP" ] && IP="127.0.0.1"
echo "  IP: $IP"

cat > ~/chatapp/frontend/.env << ENVEOF
VITE_API_URL=https://$IP:8443
VITE_RT_URL=https://$IP:6443
ENVEOF

CERT=~/chatapp/cert.pem
KEY=~/chatapp/key.pem
CURRENT=$(openssl x509 -noout -subject -in $CERT 2>/dev/null | grep -o "CN=[^,/]*" | cut -d= -f2)
if [ "$CURRENT" != "$IP" ] || [ ! -f "$CERT" ]; then
    openssl req -x509 -newkey rsa:2048 -keyout $KEY -out $CERT \
        -days 365 -nodes -subj "/CN=$IP" 2>/dev/null
    cp $CERT /storage/emulated/0/lanchat-cert.pem 2>/dev/null
    echo "  New cert for $IP saved to storage"
fi

echo "  Building frontend..."
cd ~/chatapp/frontend && npm run build

pkg install tmux -y 2>/dev/null | tail -1

SESSION="lanchat"
tmux kill-session -t $SESSION 2>/dev/null

tmux new-session  -d -s $SESSION -x 220 -y 50
tmux send-keys    -t $SESSION "bash ~/chatapp/run-api.sh" Enter
tmux split-window -t $SESSION -v
tmux send-keys    -t $SESSION "bash ~/chatapp/run-rt.sh" Enter
tmux split-window -t $SESSION -h
tmux send-keys    -t $SESSION "node ~/chatapp/frontend/serve.cjs" Enter

echo ""
echo "  3 sessions started — https://$IP:5173"
echo "  Logs: tmux attach -t $SESSION"
echo "  Stop: tmux kill-session -t $SESSION"
echo ""

tmux attach -t $SESSION
