"use strict";
const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const express = require("express");
const https   = require("https");
const http    = require("http");
const { Server } = require("socket.io");

const config  = require("./config");
const auth    = require("./middleware/auth");
const handlers = require("./sockets/handlers");
const presence = require("./sockets/presence");

const app = express();
app.use(require("cors")({ origin: "*" }));
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Load cert
const CERT = path.join(os.homedir(), "chatapp/cert.pem");
const KEY  = path.join(os.homedir(), "chatapp/key.pem");

let server;
if (fs.existsSync(CERT) && fs.existsSync(KEY)) {
  server = https.createServer({
    cert: fs.readFileSync(CERT),
    key:  fs.readFileSync(KEY),
  }, app);
  console.log("  [RT] HTTPS mode");
} else {
  server = http.createServer(app);
  console.log("  [RT] HTTP mode (no cert found)");
}

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] },
  transports: ["websocket","polling"],
});

// Auth middleware
io.use(auth);

// Register handlers
io.on("connection", socket => {
  presence.onConnect(io, socket);
  handlers.register(io, socket);
  socket.on("disconnect", () => presence.onDisconnect(io, socket));
});

// Get LAN IP
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets))
    for (const iface of ifaces)
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
  return "0.0.0.0";
}

const IP = getLanIp();
const PORT = config.PORT || 6767;

server.listen(PORT, "0.0.0.0", () => {
  const proto = fs.existsSync(CERT) ? "https" : "http";
  console.log(`  [RT] ${proto}://${IP}:${PORT}`);
});
