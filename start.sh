#!/data/data/com.termux/files/usr/bin/bash
IP=$(ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | cut -d/ -f1 | head -1)
echo "IP: $IP"
sed -i "s|VITE_API_URL=.*|VITE_API_URL=https://$IP:8443|" ~/chatapp/frontend/.env
sed -i "s|VITE_RT_URL=.*|VITE_RT_URL=https://$IP:6443|" ~/chatapp/frontend/.env
echo ""
echo "Start these in order in separate Termux sessions:"
echo ""
echo "  Session 1:  cd ~/chatapp/data_handling && python app.py"
echo "  Session 2:  cd ~/chatapp/realtime_msg  && npm start"
echo "  Session 3:  node ~/chatapp/api-https.cjs"
echo "  Session 4:  node ~/chatapp/rt-https.cjs"
echo "  Session 5:  cd ~/chatapp/frontend && npm start"
echo ""
echo "  Open: https://$IP:5173"
