#!/data/data/com.termux/files/usr/bin/bash
# Auto-detect LAN IP and update frontend .env

IP=""

# Try multiple methods
IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
[ -z "$IP" ] && IP=$(ip -4 addr show wlan1 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
[ -z "$IP" ] && IP=$(ip -4 addr show ap0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
[ -z "$IP" ] && IP=$(ip -4 addr show swlan0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
[ -z "$IP" ] && IP=$(ifconfig 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127.0.0.1 | head -1)
[ -z "$IP" ] && IP=$(getprop dhcp.wlan0.ipaddress 2>/dev/null)
[ -z "$IP" ] && IP=$(getprop dhcp.wlan1.ipaddress 2>/dev/null)
[ -z "$IP" ] && IP="127.0.0.1"

echo "Detected IP: $IP"

cat > ~/chatapp/frontend/.env << ENVEOF
VITE_API_URL=http://$IP:8000
VITE_RT_URL=http://$IP:6767
ENVEOF

echo "Updated frontend/.env"
