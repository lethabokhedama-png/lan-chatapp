#!/data/data/com.termux/files/usr/bin/bash
IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1)
echo "IP: $IP"
cat > ~/chatapp/frontend/.env << ENVEOF
VITE_API_URL=https://$IP:8443
VITE_RT_URL=https://$IP:6443
ENVEOF
echo ".env updated"
