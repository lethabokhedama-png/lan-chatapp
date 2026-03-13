const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");
const fs         = require("fs");
const path       = require("path");
const cfg        = require("./config");
const handlers   = require("./sockets/handlers");
const presence   = require("./sockets/presence");

function loadSecret() {
  const keyPath = path.join(cfg.DATA_PATH, "secret.key");
  let waited = 0;
  while (!fs.existsSync(keyPath)) {
    if (waited === 0) console.log("  [Secret] Waiting for DATA/secret.key — start data_handling first...");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    waited += 1000;
    if (waited >= 30000) {
      console.error("  [Secret] Gave up waiting. Start data_handling first!");
      process.exit(1);
    }
  }
  const key = fs.readFileSync(keyPath, "utf8").trim();
  console.log("  [Secret] Loaded from DATA/secret.key");
  return key;
}

cfg.SECRET = loadSecret();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: cfg.CORS_ORIGIN, methods: ["GET", "POST"] },
  pingTimeout:  60000,
  pingInterval: 25000,
});

app.use(cors({ origin: cfg.CORS_ORIGIN }));
app.use(express.json());

app.get("/", (_, res) => res.json({ service: "LAN Chat Realtime", status: "running" }));
app.get("/health", (_, res) => res.json({
  status: "ok",
  online: presence.onlineList().length,
}));

handlers.init(io);

server.listen(cfg.PORT, cfg.HOST, () => {
  const os   = require("os");
  const nets = os.networkInterfaces();
  let ip = "127.0.0.1";
  for (const iface of Object.values(nets).flat()) {
    if (iface.family === "IPv4" && !iface.internal) { ip = iface.address; break; }
  }
  console.log(`\n  [realtime_msg] http://${ip}:${cfg.PORT}`);
  console.log(`  [realtime_msg] ws://${ip}:${cfg.PORT}\n`);
});
