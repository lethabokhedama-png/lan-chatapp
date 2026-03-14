#!/data/data/com.termux/files/usr/bin/bash
echo "=== LAN Chat v0.5.0 ==="
echo "Detecting IP..."
bash ~/chatapp/detect-ip.sh

echo ""
echo "Building frontend..."
cd ~/chatapp/frontend && npm run build

echo ""
echo "Done! Now start services in 3 sessions:"
echo "  Session 1: cd ~/chatapp/data_handling && python app.py"
echo "  Session 2: cd ~/chatapp/realtime_msg && npm start"
echo "  Session 3: cd ~/chatapp/frontend && serve -s dist -l 5173"
echo ""

# Show the IP
IP=$(grep VITE_API_URL ~/chatapp/frontend/.env | grep -oP '\d+\.\d+\.\d+\.\d+')
echo "Open: http://$IP:5173"
