#!/bin/bash
IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
if [ -z "$IP" ]; then
  IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
fi
echo "Detected IP: $IP"
cd ~/chatapp/frontend
cat > .env << ENVEOF
VITE_API_URL=http://$IP:8000
VITE_RT_URL=http://$IP:6767
ENVEOF
npm start
