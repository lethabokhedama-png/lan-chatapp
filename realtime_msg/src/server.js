/**
 * LAN Chat — Realtime Server
 * Run:  npm start
 * Port: 6767
 */
const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const cors     = require("cors");
const cfg      = require("./config");
const handlers = require("./sockets/handlers");
const presence = require("./sockets/presence");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: cfg.CORS_ORIGIN, methods: ["GET", "POST"] },
  pingTimeout:  60000,
  pingInterval: 25000,
});

app.use(cors({ origin: cfg.CORS_ORIGIN }));
app.use(express.json());

// ── REST endpoints (thin proxies, used by frontend for convenience) ────────────
app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "realtime_msg", online: presence.onlineList().length });
});

// ── Socket.IO ──────────────────────────────────────────────────────────────────
handlers.init(io);

// ── Start ──────────────────────────────────────────────────────────────────────
server.listen(cfg.PORT, cfg.HOST, () => {
  const os  = require("os");
  const nets = os.networkInterfaces();
  let ip = "127.0.0.1";
  for (const iface of Object.values(nets).flat()) {
    if (iface.family === "IPv4" && !iface.internal) { ip = iface.address; break; }
  }
  console.log(`\n  [realtime_msg] http://${ip}:${cfg.PORT}`);
  console.log(`  [realtime_msg] ws://${ip}:${cfg.PORT}\n`);
});