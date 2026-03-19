#!/data/data/com.termux/files/usr/bin/bash
echo "Starting HTTPS frontend..."
cd ~/chatapp/frontend
serve -s dist -l 5174 &
sleep 2
local-ssl-proxy --source 5173 --target 5174 \
  --cert ~/chatapp/cert.pem \
  --key ~/chatapp/key.pem
