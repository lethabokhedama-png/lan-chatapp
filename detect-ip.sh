#!/data/data/com.termux/files/usr/bin/bash
IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1)
[ -z "$IP" ] && IP="127.0.0.1"

echo ""
echo "  LAN IP: $IP"
echo ""

cat > /data/data/com.termux/files/home/chatapp/frontend/.env << ENVEOF
VITE_API_URL=https://$IP:8000
VITE_RT_URL=https://$IP:6767
ENVEOF
echo "  .env updated:"
echo "  API -> https://$IP:8000"
echo "  RT  -> https://$IP:6767"
echo ""
